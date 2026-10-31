import json
import logging
from collections import deque
from typing import Any

try:
    from google import genai
    from google.genai import types as genai_types

    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    genai_types = None
    GENAI_AVAILABLE = False

try:
    from groq import Groq

    GROQ_AVAILABLE = True
except ImportError:
    Groq = None
    GROQ_AVAILABLE = False

from app.core.config import settings
from app.services.llm_telemetry import (
    record_gemini_usage,
    record_groq_usage,
    usage_elapsed_ms,
    usage_started,
)

logger = logging.getLogger("hubzy.ai_service")

# Modelos ultrarrápidos de Groq
# Generación de tableros: 70b primero (calidad sobre docs grandes).
GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]

# Tareas chicas (speech, psicología, /ask): 8b-instant primero — cuesta ~10x
# menos por token y para frases de 25 palabras o clasificación sobra.
GROQ_FAST_MODELS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
]

# Directivas pedagógicas y de progresión curricular a lo largo del documento (100% de cobertura)
LEVEL_DESCRIPTIONS = {
    1: {
        "name": "Fácil",
        "questions": 3,
        "difficulty": "facil",
        "doc_sector": "Sector Inicial (0% al 25% del texto: Introducción, Objetivos Generales, Definición Central y Alcance)",
        "guideline": (
            "NIVEL 1 - FÁCIL: Enfócate en el SECTOR INICIAL del documento (0% al 25%). "
            "Las preguntas deben ser directas y fundacionales: definiciones centrales, propósito del plan/texto y conceptos rectoriales."
        ),
    },
    2: {
        "name": "Semi-normal",
        "questions": 5,
        "difficulty": "seminormal",
        "doc_sector": "Sector Estructural (25% al 50% del texto: Fundamentos, Estructura, Roles, Procedimientos iniciales)",
        "guideline": (
            "NIVEL 2 - SEMI-NORMAL: Enfócate en el PRIMER TERCIO/MITAD del documento (25% al 50%). "
            "Preguntas sobre organización, roles, etapas iniciales, requisitos y normas de operación explicadas en esta sección."
        ),
    },
    3: {
        "name": "Normal",
        "questions": 8,
        "difficulty": "normal",
        "doc_sector": "Sector Central y Técnico (45% al 70% del texto: Metodologías, Algoritmos, Actividades, Fases de Ejecución)",
        "guideline": (
            "NIVEL 3 - NORMAL: Enfócate en la ZONA MEDIA del documento (45% al 70%). "
            "Preguntas de aplicación metodológica, fases técnicas, relación causa-efecto y taxonomías detalladas en el núcleo del texto."
        ),
    },
    4: {
        "name": "Semi-difícil",
        "questions": 15,
        "difficulty": "semidificil",
        "doc_sector": "Sector Avanzado y de Control (65% al 85% del texto: Métricas, Gestión de Riesgos, Control de Calidad y Casos)",
        "guideline": (
            "NIVEL 4 - SEMI-DIFÍCIL: Enfócate en la SECCIÓN AVANZADA del documento (65% al 85%). "
            "Preguntas de análisis crítico, estándares de verificación, criterios de aceptación, métricas cuantitativas y contingencias."
        ),
    },
    5: {
        "name": "Difícil",
        "questions": 20,
        "difficulty": "dificil",
        "doc_sector": "Sector Final y Síntesis Holística (75% al 100% del texto: Auditorías, Conclusiones, Entregables y Síntesis Total)",
        "guideline": (
            "NIVEL 5 - DIFÍCIL: Enfócate en las SECCIONES FINALES (75% al 100%) combinadas con una SÍNTESIS INTEGRAL de todo el documento. "
            "Preguntas exhaustivas, distinciones de alta precisión, dictámenes finales, criterios de validación y conclusiones."
        ),
    },
}


# La campaña tiene 20 niveles: 4 rondas sobre los 5 sectores del documento.
# Los niveles 6-20 derivan del sector correspondiente (round-robin) con más
# preguntas, repaso intersectorial y dificultad ascendente.
CAMPAIGN_MAX_LEVEL = 20

_DIFFICULTY_RANK = ["facil", "seminormal", "normal", "semidificil", "dificil"]

_ROUND_NAMES = {1: "", 2: " · Ronda II", 3: " · Ronda III", 4: " · Ronda IV"}


def _level_info(level: int) -> dict:
    """Info pedagógica del nivel. 1-5 son canónicos; 6-20 derivan del sector
    del nivel ((level-1)%5)+1 en la ronda (level-1)//5 + 1, con +preguntas
    por ronda (+4·(r-1)) y dificultad que sube un escalón por ronda a partir
    de la III (cap en 'dificil'). El jefe final (20) exige síntesis total."""
    if level in LEVEL_DESCRIPTIONS:
        return LEVEL_DESCRIPTIONS[level]

    lvl = max(1, min(CAMPAIGN_MAX_LEVEL, int(level or 1)))
    sector = ((lvl - 1) % 5) + 1
    round_n = (lvl - 1) // 5 + 1
    base = LEVEL_DESCRIPTIONS[sector]

    diff_rank = _DIFFICULTY_RANK.index(base["difficulty"])
    diff_rank = min(len(_DIFFICULTY_RANK) - 1, diff_rank + max(0, round_n - 2))
    difficulty = _DIFFICULTY_RANK[diff_rank]
    if lvl >= 16:
        difficulty = "dificil"

    questions = min(30, base["questions"] + 4 * (round_n - 1))
    name = f"{base['name']}{_ROUND_NAMES.get(round_n, '')}"

    if lvl == CAMPAIGN_MAX_LEVEL:
        guideline = (
            "NIVEL 20 - JEFE FINAL · MAESTRÍA TOTAL: evalúa el DOMINIO INTEGRAL del documento "
            "completo. Preguntas de síntesis que exijan conectar sectores distantes, "
            "comparar conceptos, inferir consecuencias y demostrar dominio holístico. "
            "Es el examen de graduación de la campaña: riguroso pero siempre justo."
        )
        doc_sector = "Documento COMPLETO (0% al 100%): integración total de todos los sectores."
    elif round_n == 2:
        guideline = (
            f"{base['guideline']} "
            "RONDA II - CONSOLIDACIÓN: revisita el mismo sector con enfoque distinto — "
            "pregunta por matices, excepciones y detalles que la primera pasada no cubrió."
        )
        doc_sector = base["doc_sector"]
    elif round_n == 3:
        guideline = (
            f"{base['guideline']} "
            "RONDA III - DOMINIO: exige conectar este sector con los demás — "
            "comparaciones, relaciones causa-efecto entre secciones y transferencia de conceptos."
        )
        doc_sector = base["doc_sector"] + " + vínculos con el resto del documento."
    else:
        guideline = (
            f"{base['guideline']} "
            "RONDA IV - MAESTRÍA: síntesis del sector en contexto global del documento — "
            "preguntas de juicio crítico, aplicación a casos nuevos y argumentación."
        )
        doc_sector = base["doc_sector"] + " + integración con sectores adyacentes."

    return {
        "name": name,
        "questions": questions,
        "difficulty": difficulty,
        "doc_sector": doc_sector,
        "guideline": guideline,
    }


# Directivas de audiencia por banda de edad — se inyectan en el prompt
_AUDIENCE_DIRECTIVES = {
    "sprout": (
        "\n\n👶 AUDIENCIA: NIÑO/A DE 5-7 AÑOS. OBLIGATORIO:\n"
        "- Enunciados de MÁXIMO 8 palabras, vocabulario de 1º de primaria, una sola idea por frase.\n"
        "- Usa ejemplos con juguetes, animales, dibujos y comida. Nada abstracto.\n"
        "- Las cartas deben ser respuestas de 1-2 palabras o un número.\n"
        "- Las pistas deben leerse en voz alta de forma natural y cariñosa.\n"
        "- PROHIBIDO contenido que asuste, avergüence o mencione evaluación/examen."
    ),
    "explorer": (
        "\n\n🧒 AUDIENCIA: NIÑO/A DE 8-10 AÑOS. OBLIGATORIO:\n"
        "- Frases de máximo 15 palabras, vocabulario de primaria.\n"
        "- Ejemplos concretos del mundo del niño (escuela, juegos, mascotas, deportes).\n"
        "- Nada de jerga técnica sin explicación inmediata entre paréntesis.\n"
        "- Tono alegre y de aventura, nunca de examen ni de evaluación."
    ),
    "adventurer": (
        "\n\n🧑 AUDIENCIA: ADOLESCENTE DE 11-14 AÑOS.\n"
        "- Lenguaje claro de secundaria, frases de máximo 30 palabras.\n"
        "- Ejemplos cercanos a su mundo (redes, videojuegos, música, deportes) sin forzar.\n"
        "- Explica tecnicismos la primera vez que aparecen."
    ),
    "challenger": (
        "\n\n🧑‍🎓 AUDIENCIA: ESTUDIANTE DE 15-18 AÑOS (secundaria).\n"
        "- Lenguaje académico estándar, rigor de examen de ingreso a la universidad."
    ),
    "pro": (
        "\n\n💼 AUDIENCIA: PROFESIONAL/AUTODIDACTA ADULTO.\n"
        "- Lenguaje técnico preciso, sin simplificaciones ni motivación extra."
    ),
}

# Directivas de lenguaje inclusivo por género declarado
_GENDER_DIRECTIVES = {
    "masculino": "- Dirígete al estudiante en masculino ('campeón', 'genio').",
    "femenino": "- Dirígete a la estudiante en femenino ('campeona', 'genia').",
    "otro": "- Usa lenguaje neutro e inclusivo ('crack', 'genio/a', 'figura'); evita marcas de género.",
}


def build_system_instruction(
    question_count: int = 5,
    difficulty: str = "normal",
    level: int = 1,
    excluded_concepts: list[str] | None = None,
    age_band: str | None = None,
    gender: str | None = None,
) -> str:
    """Construye las instrucciones dinámicas de Gemini/Groq con exclusión estricta de conceptos previos y cobertura sectorizada."""
    distractor_count = max(1, round(question_count * 0.30))
    lvl_info = _level_info(level)
    guideline = lvl_info["guideline"]
    doc_sector = lvl_info.get("doc_sector", "Todo el documento")

    audience_directive = _AUDIENCE_DIRECTIVES.get(age_band or "", "")
    gender_directive = _GENDER_DIRECTIVES.get((gender or "").strip().lower(), "")
    if gender_directive:
        gender_directive = (
            "\n\n🗣️ LENGUAJE INCLUSIVO:\n"
            + gender_directive
            + "\n- Usa ejemplos balanceados (mujeres científicas, hombres enfermeros) sin estereotipos."
        )

    exclusion_clause = ""
    if excluded_concepts and len(excluded_concepts) > 0:
        clean_excluded = [f'"{c.strip()}"' for c in excluded_concepts if c and len(c.strip()) > 1][
            :50
        ]
        if clean_excluded:
            exclusion_clause = f"""
🚫 PROHIBICIÓN ESTRICTA DE REPETICIÓN (CONCEPTOS YA EVALUADOS EN NIVELES ANTERIORES):
Los siguientes conceptos ya fueron aprendidos y superados por el estudiante en niveles anteriores:
[{", ".join(clean_excluded)}]
- ESTÁ TERMINANTEMENTE PROHIBIDO generar preguntas cuyas respuestas o conceptos ("concept_name") sean idénticos o sinónimos directos de los conceptos listados arriba.
- DEBES extraer conceptos NUEVOS, DISTINTOS y NO EVALUADOS AÚN a partir del sector correspondiente del texto.
"""

    return f"""
Eres un evaluador pedagógico de élite universitaria encargado de diseñar simulacros de examen profesionales en Hubzy.
Tu objetivo es que el estudiante domine y asimile el 100% DEL DOCUMENTO ACADÉMICO a través de sus {CAMPAIGN_MAX_LEVEL} niveles progresivos.

🎯 ZONA PRIORITARIA DEL DOCUMENTO PARA ESTE NIVEL ({level}/{CAMPAIGN_MAX_LEVEL}):
{doc_sector}

{guideline}
{audience_directive}{gender_directive}
{exclusion_clause}

⚠️ REGLAS OBLIGATORIAS:
1. ÚNICAMENTE extrae información, citas y conceptos EXPLÍCITAMENTE presentes en el texto proporcionado.
2. NUNCA alucines o traigas conocimiento externo que no esté en el documento.
3. Para cada uno de los {question_count} reactivos requeridos genera:
   - "concept_name": Término o principio técnico exacto (la carta en mano del estudiante, máximo 4 palabras).
   - "content": Explicación sintética y precisa fundamentada en el texto (1-2 líneas).
   - "source_quote": Cita textual exacta de 1 renglón extraída del texto que respalda y valida la respuesta.
   - "points_multiplier": "1x" (nivel 1-2), "2x" (nivel 3), "3x" (nivel 4-5).
   - "node_question": Reactivo de examen riguroso, claro y desafiante adecuado al nivel {level}.
   - "node_hint": Pista conceptual orientadora que ayude al alumno sin revelar el nombre exacto de la carta.

🎭 CARTAS DISTRACTORAS ({distractor_count} DISTRACTORES TEMÁTICOS CONTEXTUALES):
- Genera exactamente {distractor_count} conceptos distractores.
- REGLA CRÍTICA DE DISTRACTORES: Los distractores DEBEN pertenecer al MISMO CAMPO TEMÁTICO y vocabulario del documento (conceptos verosímiles o doctrinas afines pero incorrectas para esa pregunta puntual).
- PROHIBIDO usar distractores de áreas no relacionadas (por ejemplo, si el tema es un plan de administración de software, los distractores deben ser de gestión o ingeniería de software, NO de medicina, física cuántica ni redes no vinculadas).

⚖️ DISTRIBUCIÓN EQUITATIVA SI HAY MÚLTIPLES ARCHIVOS:
- Si el texto contiene delimitadores '--- DOCUMENTO: [Nombre] ---', distribuye los reactivos equitativamente entre los diferentes documentos para que la evaluación abarque todo el material de estudio y no solo el primer archivo.

Estructura JSON requerida (responde ÚNICAMENTE con JSON válido):
{{
  "title": "Simulacro: [Tema Real del Texto]",
  "level": {level},
  "difficulty": "{difficulty}",
  "concepts": [
    {{
      "concept_name": "Término Técnico 1",
      "content": "Fundamentación extraída del texto...",
      "source_quote": "Cita textual del texto que respalda esto...",
      "points_multiplier": "1x",
      "node_question": "¿Según el documento, qué establece...?",
      "node_hint": "Revisa la sección donde se explica..."
    }}
  ],
  "distractors": [
    {{
      "concept_name": "Distractor Temático Verosímil 1",
      "content": "Concepto de la materia no aplicable a estos reactivos.",
      "points_multiplier": "1x"
    }}
  ]
}}
"""


SYSTEM_INSTRUCTION = build_system_instruction(question_count=5, difficulty="normal", level=2)


# Tope de texto extraído por documento: acota el uso de memoria y el
# tamaño del prompt que viaja al LLM en cada generación.
MAX_DOC_TEXT_CHARS = 200_000

# SLICING POR SECTOR — cada nivel evalúa ~1/5 del documento (ver
# LEVEL_DESCRIPTIONS.doc_sector). Antes se mandaba el documento COMPLETO
# en cada nivel: ~5x tokens de input desperdiciados, porque el modelo solo
# usa el sector indicado. Por debajo de SLICE_MIN_CHARS no compensa cortar.
SLICE_MIN_CHARS = 45_000
_SECTOR_RANGES = {
    1: (0.00, 0.25),
    2: (0.25, 0.50),
    3: (0.45, 0.70),
    4: (0.65, 0.85),
    5: (0.75, 1.00),
}
# Solape para que el LLM no pierda frases justo en los bordes del corte.
_SECTOR_MARGIN = 0.06

# Modelos en orden de preferencia y cuota disponible. Si uno falla con 429 (cuota agotada) o 503, se usa el siguiente automáticamente.
# Modelos oficiales de Google Gemini en orden de velocidad y cuota disponible.
GEMINI_FALLBACK_MODELS = [
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]

# Directivas de estilo rotativas para los phrase-packs: cada relleno cambia
# el registro para que la voz de Hubzi no repita fórmulas entre packs.
_PACK_STYLES = [
    "ESTILO DE ESTE PACK: validación emocional directa y breve.",
    "ESTILO DE ESTE PACK: una metáfora corta (naturaleza, luz, raíces, agua).",
    "ESTILO DE ESTE PACK: termina con una pregunta reflexiva que invite a seguir.",
    "ESTILO DE ESTE PACK: menciona el proceso cognitivo (memoria, atención, conexiones).",
    "ESTILO DE ESTE PACK: segunda persona, cercana, como un compañero de estudio.",
]

# OCR: el modelo lite transcribe igual de bien a una fracción del costo.
GEMINI_OCR_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]


class AIService:
    def __init__(self):
        self.client = None
        self.groq_client = None
        # Stickiness: recordar el último modelo que respondió para probarlo
        # primero y no pagar la cascada de fallos en cada request.
        self._last_good_groq: str | None = None
        self._last_good_gemini: str | None = None

        # Phrase-packs: 1 llamada LLM genera N frases por (situación, nivel,
        # tema); el pack se sirve agotándolo y solo entonces se regenera.
        # ~80% menos llamadas que 1-por-evento, contenido sigue siendo LLM.
        self._speech_packs: dict[tuple, deque] = {}
        # Frases ya servidas por pack_key + contador de rellenos — al
        # regenerar un pack se prohibe repetir lo ya dicho (no-repetición real).
        self._pack_served: dict[tuple, set] = {}
        self._pack_round: dict[tuple, int] = {}
        # Mensajes triviales: rotación de respuestas para no repetir seguido.
        self._trivial_cycle = 0

        # Groq Client (Ultra fast inference)
        if GROQ_AVAILABLE and settings.GROQ_API_KEY:
            try:
                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
                logger.info(
                    "Groq Cloud client inicializado correctamente para respuestas ultrarrápidas."
                )
            except Exception as e:
                self.groq_client = None
                logger.warning(f"No se pudo inicializar Groq Client: {e}")

        # Google Gemini Client — timeout explícito para que una llamada
        # colgada no congele el worker indefinidamente.
        if GENAI_AVAILABLE and settings.GEMINI_API_KEY:
            try:
                http_options = None
                if hasattr(genai_types, "HttpOptions"):
                    http_options = genai_types.HttpOptions(timeout=90_000)
                self.client = genai.Client(
                    api_key=settings.GEMINI_API_KEY, http_options=http_options
                )
                logger.info("Google GenAI client inicializado correctamente (SDK google-genai).")
            except Exception as e:
                self.client = None
                logger.warning(f"No se pudo inicializar google-genai Client: {e}")
        else:
            if not GENAI_AVAILABLE:
                logger.warning(
                    "google-genai no está instalado. Instala con: pip install google-genai"
                )
            else:
                logger.warning("GEMINI_API_KEY no configurada en el entorno.")

    def extract_concepts_from_text(
        self,
        study_text: str,
        variation_seed: int = 0,
        question_count: int = 3,
        difficulty: str = "facil",
        level: int = 1,
        excluded_concepts: list[str] | None = None,
        age_band: str | None = None,
        gender: str | None = None,
    ) -> dict[str, Any]:
        """
        Envía el texto REAL del documento a Gemini con prompt estructurado
        y parsea el JSON resultante para generar preguntas dinámicas de examen
        calibradas exactamente al nivel (1 a 5), dificultad y número de preguntas,
        excluyendo conceptos de niveles anteriores para garantizar no-repetición.
        """
        if not self.groq_client and not self.client:
            raise RuntimeError(
                "Ni GROQ_API_KEY ni GEMINI_API_KEY están configuradas en el servidor. "
                "Agrega al menos una clave en el archivo .env para procesar el material dinámicamente con IA."
            )

        # Analizar el documento COMPLETO sin truncar arbitrariamente (hasta 500k caracteres)
        full_text = study_text[:500000] if len(study_text) > 500000 else study_text
        # Slicing por sector: el prompt ya sectoriza el nivel; el extracto
        # enviado ahora coincide con ese sector (ahorro ~60-75% de input).
        full_text = self._slice_text_for_level(full_text, level)

        dynamic_sys_instruction = build_system_instruction(
            question_count=question_count,
            difficulty=difficulty,
            level=level,
            excluded_concepts=excluded_concepts,
            age_band=age_band,
            gender=gender,
        )

        variation_directive = ""
        if variation_seed > 0:
            variation_directive = (
                f"\n\n🚨 INSTRUCCIÓN DE REINICIO DE PARTIDA (RONDA #{variation_seed}):\n"
                f"- El usuario ha reiniciado la partida. ESTÁ TERMINANTEMENTE PROHIBIDO repetir preguntas anteriores.\n"
                f"- Formula exactamente {question_count} preguntas y conceptos clave COMPLETAMENTE DIFERENTES basados en otras secciones, definiciones o fórmulas del texto.\n"
                f"- Respeta con exactitud la dificultad '{difficulty}' (Nivel {level}/{CAMPAIGN_MAX_LEVEL})."
            )

        prompt = (
            f"Analiza exhaustivamente el siguiente documento académico completo para el NIVEL {level} ({difficulty.upper()} con {question_count} preguntas):{variation_directive}\n\n"
            f"Texto del documento:\n{full_text}"
        )

        # =====================================================================
        # 1. PRIORIDAD: GROQ (Velocidad ultrarrápida / baja latencia ~300+ tok/s)
        # =====================================================================
        # Tope de salida: el JSON de reactivos nunca debería exceder esto —
        # acota un output desbocado que solo quema cuota.
        max_out = min(8192, question_count * 140 + 500)

        # =====================================================================
        # 1. PRIORIDAD: GROQ (Velocidad ultrarrápida / baja latencia ~300+ tok/s)
        # =====================================================================
        if self.groq_client:
            for g_model in self._ordered_models(GROQ_MODELS, self._last_good_groq):
                try:
                    logger.info(
                        f"⚡ Invocando Groq ultrarrápido con modelo '{g_model}' (nivel: {level}, {question_count} preguntas)..."
                    )
                    t0 = usage_started()
                    chat_completion = self.groq_client.chat.completions.create(
                        model=g_model,
                        messages=[
                            {"role": "system", "content": dynamic_sys_instruction},
                            {"role": "user", "content": prompt},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.85 if variation_seed > 0 else 0.3,
                        max_tokens=max_out,
                        timeout=8.0,
                    )
                    record_groq_usage(
                        chat_completion, g_model, "board_gen", usage_elapsed_ms(t0)
                    )
                    raw_text = (chat_completion.choices[0].message.content or "").strip()
                    parsed_json = json.loads(raw_text)
                    self._last_good_groq = g_model
                    logger.info(
                        f"⚡ Reactivos generados exitosamente con Groq ({g_model}) a máxima velocidad."
                    )
                    return parsed_json
                except Exception as ge:
                    logger.warning(
                        f"Groq ({g_model}) falló o alcanzó límite: {ge}. Intentando siguiente..."
                    )

        # =====================================================================
        # 2. FALLBACK: GOOGLE GEMINI
        # =====================================================================
        if not self.client:
            raise RuntimeError("Groq falló y Gemini no está configurado.")

        last_error = None
        for model_name in self._ordered_models(GEMINI_FALLBACK_MODELS, self._last_good_gemini):
            try:
                logger.info(
                    f"Invocando Gemini con modelo '{model_name}' (nivel: {level}, {question_count} preguntas, seed: {variation_seed})..."
                )
                config_kwargs = {
                    "system_instruction": dynamic_sys_instruction,
                    "temperature": 0.85 if variation_seed > 0 else 0.4,
                    "response_mime_type": "application/json",
                    "max_output_tokens": max_out,
                }

                if hasattr(genai_types, "ThinkingConfig"):
                    try:
                        config_kwargs["thinking_config"] = genai_types.ThinkingConfig(
                            thinking_budget=0
                        )
                    except Exception as tc_err:
                        logger.debug(f"ThinkingConfig no soportado en este SDK: {tc_err}")

                try:
                    t0 = usage_started()
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(**config_kwargs),
                    )
                except Exception as call_err:
                    logger.warning(
                        f"Error inicial con {model_name}: {call_err}. Reintentando sin thinking_config..."
                    )
                    t0 = usage_started()
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            system_instruction=dynamic_sys_instruction,
                            temperature=0.85 if variation_seed > 0 else 0.4,
                            response_mime_type="application/json",
                            max_output_tokens=max_out,
                        ),
                    )
                record_gemini_usage(response, model_name, "board_gen", usage_elapsed_ms(t0))

                raw_text = (response.text or "").strip()

                # Limpieza y reparación defensiva de JSON
                parsed_json = None
                cleaned = raw_text
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                try:
                    parsed_json = json.loads(cleaned)
                except json.JSONDecodeError:
                    # Intento de auto-reparación defensiva (cierre de llaves o corchetes faltantes)
                    try:
                        # Extraer el bloque JSON más exterior
                        start_idx = cleaned.find("{")
                        if start_idx != -1:
                            sub = cleaned[start_idx:]
                            # Si se cortó en medio de una cadena o array, intentar equilibrar llaves
                            open_braces = sub.count("{") - sub.count("}")
                            open_brackets = sub.count("[") - sub.count("]")
                            repaired = (
                                sub + ("]" * max(0, open_brackets)) + ("}" * max(0, open_braces))
                            )
                            parsed_json = json.loads(repaired)
                    except Exception as rep_err:
                        logger.debug(f"Reparación defensiva de JSON falló: {rep_err}")

                if not parsed_json or not isinstance(parsed_json, dict):
                    raise json.JSONDecodeError("JSON no válido o no diccionario", raw_text, 0)

                self._last_good_gemini = model_name
                logger.info(f"Reactivos generados exitosamente con modelo '{model_name}'.")
                return parsed_json

            except json.JSONDecodeError as jde:
                logger.error(
                    f"Error parseando JSON de Gemini ({model_name}): {jde} | Contenido: {raw_text[:500]}"
                )
                last_error = ValueError(
                    f"La IA ({model_name}) no devolvió un formato JSON válido: {jde!s}"
                )
                continue
            except Exception as e:
                err_str = str(e)
                logger.warning(
                    f"Modelo '{model_name}' falló ({err_str[:200]}). Probando siguiente modelo de respaldo..."
                )
                last_error = e
                continue

        logger.error(f"Todos los modelos de Gemini fallaron: {last_error}")
        raise RuntimeError(
            f"Error de comunicación con el motor de IA (todos los modelos agotados): {last_error!s}"
        )

    def extract_concepts_multi_level(
        self,
        study_text: str,
        specs: list[tuple[int, int, str]],
        excluded_concepts: list[str] | None = None,
        age_band: str | None = None,
        gender: str | None = None,
    ) -> dict[int, dict[str, Any]]:
        """
        UNA llamada LLM genera los reactivos de varios niveles a la vez.
        specs = [(level, question_count, difficulty), ...] — pensado para
        documentos chicos donde el costo del prompt de sistema + el texto
        amortiza generar 2-3 niveles juntos en vez de una llamada por nivel.
        Devuelve {level: ai_data} (mismo formato que extract_concepts_from_text).
        """
        if not specs:
            return {}
        if len(specs) == 1:
            lvl, qc, diff = specs[0]
            return {
                lvl: self.extract_concepts_from_text(
                    study_text,
                    question_count=qc,
                    difficulty=diff,
                    level=lvl,
                    excluded_concepts=excluded_concepts,
                    age_band=age_band,
                    gender=gender,
                )
            }

        if not self.groq_client and not self.client:
            return {}

        level_blocks = []
        for lvl, qc, diff in specs:
            info = _level_info(lvl)
            level_blocks.append(
                f"NIVEL {lvl} ({info['name']}, dificultad {diff}, {qc} reactivos):\n"
                f"- Sector: {info.get('doc_sector', 'Todo el documento')}\n"
                f"- Guía: {info['guideline']}"
            )
        audience_directive = _AUDIENCE_DIRECTIVES.get(age_band or "", "")
        exclusion_clause = ""
        if excluded_concepts:
            clean = [f'"{c.strip()}"' for c in excluded_concepts if c and len(c.strip()) > 1][:50]
            if clean:
                exclusion_clause = (
                    "\n🚫 CONCEPTOS YA EVALUADOS (prohibido repetir): "
                    + ", ".join(clean)
                )

        sys_instruction = f"""Eres un evaluador pedagógico de élite en Hubzy. Genera reactivos para VARIOS niveles en una sola respuesta.
{chr(10).join(level_blocks)}
{audience_directive}
{exclusion_clause}

⚠️ REGLAS OBLIGATORIAS:
1. Solo información EXPLÍCITA del texto. Nunca conocimiento externo.
2. Por nivel genera EXACTAMENTE los reactivos indicados, cada uno con:
   "concept_name" (máx 4 palabras), "content" (1-2 líneas), "source_quote" (cita textual de 1 renglón),
   "points_multiplier" ("1x"/"2x"/"3x"), "node_question" (reactivo riguroso), "node_hint" (pista sin revelar la carta).
3. Entre niveles NO repitas conceptos ni preguntas.
4. Por nivel, además, distractors = 30% de sus reactivos (mismo campo temático, verosímiles pero incorrectos).
5. Responde ÚNICAMENTE JSON válido:
{{"levels":[{{"level":<n>,"title":"Simulacro: tema","difficulty":"<diff>","concepts":[{{"concept_name":"...","content":"...","source_quote":"...","points_multiplier":"1x","node_question":"...","node_hint":"..."}}],"distractors":[{{"concept_name":"...","content":"...","points_multiplier":"1x"}}]}}]}}"""

        prompt = (
            f"Analiza el documento y genera los reactivos de {len(specs)} niveles "
            f"({', '.join(str(lv) for lv, _, _ in specs)}):\n\nTexto del documento:\n{study_text[:120_000]}"
        )
        total_q = sum(qc for _, qc, _ in specs)
        max_out = min(16384, total_q * 140 + 800)

        def _unpack(data: dict) -> dict[int, dict[str, Any]]:
            out: dict[int, dict[str, Any]] = {}
            for entry in (data or {}).get("levels", []):
                try:
                    lv = int(entry.get("level"))
                except (TypeError, ValueError):
                    continue
                if entry.get("concepts"):
                    out[lv] = entry
            return out

        if self.groq_client:
            for g_model in self._ordered_models(GROQ_MODELS, self._last_good_groq):
                try:
                    t0 = usage_started()
                    comp = self.groq_client.chat.completions.create(
                        model=g_model,
                        messages=[
                            {"role": "system", "content": sys_instruction},
                            {"role": "user", "content": prompt},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.4,
                        max_tokens=max_out,
                        timeout=15.0,
                    )
                    record_groq_usage(comp, g_model, "board_gen_multi", usage_elapsed_ms(t0))
                    parsed = _unpack(json.loads((comp.choices[0].message.content or "").strip()))
                    if parsed:
                        self._last_good_groq = g_model
                        return parsed
                except Exception as ge:
                    logger.warning(f"Groq multi-nivel ({g_model}) falló: {ge}")

        if self.client:
            # Cascada acotada a 2 modelos: el batch es una optimización, no
            # debe duplicar la latencia total de fallos vs el mono-nivel.
            for model_name in self._ordered_models(
                GEMINI_FALLBACK_MODELS[:3], self._last_good_gemini
            )[:2]:
                try:
                    t0 = usage_started()
                    resp = self.client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            system_instruction=sys_instruction,
                            temperature=0.4,
                            response_mime_type="application/json",
                            max_output_tokens=max_out,
                        ),
                    )
                    record_gemini_usage(
                        resp, model_name, "board_gen_multi", usage_elapsed_ms(t0)
                    )
                    raw = (resp.text or "").strip()
                    if raw.startswith("```"):
                        raw = raw.split("```")[1]
                        if raw.startswith("json"):
                            raw = raw[4:]
                    parsed = _unpack(json.loads(raw))
                    if parsed:
                        self._last_good_gemini = model_name
                        return parsed
                except Exception as e:
                    logger.warning(f"Gemini multi-nivel ({model_name}) falló: {e}")

        return {}

    def extract_text_multimodal_ocr(self, file_bytes: bytes, mime_type: str) -> str:
        """
        Motor OCR Multimodal con Gemini:
        Transcribe fielmente documentos escaneados, imágenes de apuntes manuscritos,
        pizarras, diapositivas o PDFs que son únicamente imágenes.
        Con fallback automático entre modelos para máxima disponibilidad.
        """
        if not self.client:
            raise RuntimeError(
                "GEMINI_API_KEY no configurada. Necesaria para ejecutar el motor OCR con IA."
            )

        prompt = (
            "Eres un motor de OCR y transcripción académica de ultra-alta fidelidad para Hubzy. "
            "Tu objetivo es transcribir fielmente TODO el contenido legible de este documento o imagen:\n"
            "- Transcribe títulos, subtítulos, párrafos, listas, definiciones y teoremas.\n"
            "- Si hay fórmulas matemáticas, transcríbelas en notación clara o LaTeX.\n"
            "- Si hay tablas o diagramas conceptuales, transcribe sus datos estructurados.\n"
            "- Conserva el orden lógico del documento.\n"
            "⚠️ REGLA: Devuelve ÚNICAMENTE el texto extraído. No añadas saludos, intros, explicaciones ni comentarios tuyos."
        )

        part = genai_types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
        last_error = None

        for model_name in self._ordered_models(GEMINI_OCR_MODELS, self._last_good_gemini):
            try:
                logger.info(f"Ejecutando OCR Multimodal ultra-rápido con modelo '{model_name}'...")
                t0 = usage_started()
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=[part, prompt],
                    config=genai_types.GenerateContentConfig(
                        temperature=0.2,
                        thinking_config=genai_types.ThinkingConfig(thinking_budget=0)
                        if hasattr(genai_types, "ThinkingConfig")
                        else None,
                    ),
                )
                record_gemini_usage(response, model_name, "ocr", usage_elapsed_ms(t0))
                extracted = (response.text or "").strip()
                self._last_good_gemini = model_name
                logger.info(
                    f"OCR completado exitosamente con '{model_name}': {len(extracted)} caracteres extraídos."
                )
                return extracted
            except Exception as e:
                logger.warning(
                    f"OCR con '{model_name}' falló ({str(e)[:200]}). Intentando siguiente modelo..."
                )
                last_error = e
                continue

        logger.error(f"Error en OCR multimodal en todos los modelos: {last_error}")
        raise RuntimeError(f"Error procesando OCR del archivo: {last_error!s}")

    @staticmethod
    def _slice_text_for_level(text: str, level: int) -> str:
        """
        Recorta el texto al sector pedagógico del nivel (±margen de solape),
        preservando la cabecera de carpeta (materia + resúmenes de docs).
        Nivel 20 (síntesis total) y textos chicos reciben el texto completo.
        """
        if not text or len(text) <= SLICE_MIN_CHARS or level >= CAMPAIGN_MAX_LEVEL:
            return text
        sector = ((max(1, level) - 1) % 5) + 1
        lo, hi = _SECTOR_RANGES[sector]
        lo = max(0.0, lo - _SECTOR_MARGIN)
        hi = min(1.0, hi + _SECTOR_MARGIN)

        header = ""
        body = text
        if text.startswith("ASIGNATURA"):
            split_idx = text.find("\n\n")
            if 0 < split_idx < 4000:
                header, body = text[: split_idx + 2], text[split_idx + 2 :]

        n = len(body)
        s = int(n * lo)
        e = int(n * hi)
        # Alinear a bordes de línea para no cortar frases a la mitad
        if s > 0:
            b = body.rfind("\n", 0, min(s + 120, n))
            if b != -1:
                s = b + 1
        if e < n:
            f = body.find("\n", max(e - 120, s))
            if f != -1:
                e = f + 1

        sliced = body[s:e].strip()
        if len(sliced) < 300:
            return text  # sector demasiado pequeño: mejor mandar todo
        note = (
            f"[EXTRACTO: sector {int(lo * 100)}%-{int(hi * 100)}% del documento completo"
            + (
                "; el contexto del resto llega en los resúmenes de la cabecera"
                if "RESUMEN" in header
                else ""
            )
            + "]\n\n"
        )
        return header + note + sliced

    @staticmethod
    def _ordered_models(models: list[str], last_good: str | None) -> list[str]:
        """Pone primero el último modelo que funcionó (evita pagar la cascada de fallos)."""
        if last_good and last_good in models:
            return [last_good] + [m for m in models if m != last_good]
        return list(models)

    def extract_document_text(self, file_bytes: bytes, filename: str) -> str:
        """Extracción con tope de tamaño para acotar memoria y prompts del LLM."""
        text = self._extract_document_text(file_bytes, filename)
        if len(text) > MAX_DOC_TEXT_CHARS:
            logger.info(
                f"Texto de '{filename}' truncado a {MAX_DOC_TEXT_CHARS} caracteres ({len(text)} originales)."
            )
            text = text[:MAX_DOC_TEXT_CHARS]
        return text

    def _extract_document_text(self, file_bytes: bytes, filename: str) -> str:
        """
        Pipeline Híbrido Inteligente de Extracción de Texto:
        1. PDFs:
           - Paso 1: Intenta pypdf (ultrarrápido, ~50-200ms para PDFs digitales nativos completos).
           - Analiza TODAS las páginas del documento sin límites arbitrarios.
           - Paso 2: Si el texto extraído es insuficiente (< 50 caracteres), activa Gemini OCR multimodal.
        2. Imágenes (.png, .jpg, .jpeg, .webp):
           - Activa Gemini OCR multimodal directamente.
        3. Texto plano (.txt, .md, .csv):
           - Decodifica en UTF-8 o latin-1.
        """
        lower_name = (filename or "").lower()

        # 1. ARCHIVOS PDF
        if lower_name.endswith(".pdf"):
            pdf_text = ""
            try:
                import io

                from pypdf import PdfReader
                from pypdf.errors import FileNotDecryptedError, PdfReadError

                reader = PdfReader(io.BytesIO(file_bytes))

                # Verificar si el PDF está protegido con contraseña
                if reader.is_encrypted:
                    try:
                        reader.decrypt("")
                    except Exception:
                        raise RuntimeError(
                            "El archivo PDF está protegido con contraseña. Por favor, sube una versión desbloqueada."
                        ) from None

                pages = []
                for p in reader.pages:
                    t = p.extract_text()
                    if t:
                        pages.append(t)
                pdf_text = "\n\n".join(pages).strip()
            except (PdfReadError, FileNotDecryptedError) as pfe:
                logger.warning(f"PDF encriptado o dañado en '{filename}': {pfe}")
                raise RuntimeError(
                    "El archivo PDF está protegido con contraseña o dañado. Por favor, sube un archivo legible."
                ) from pfe
            except Exception as pe:
                logger.warning(f"Extracción directa pypdf falló para '{filename}': {pe}")

            # Si se obtuvo texto nativo suficiente, retornarlo de inmediato (0 costo y milisegundos)
            if len(pdf_text) >= 50:
                logger.info(
                    f"Extracción nativa pypdf exitosa para '{filename}': {len(pdf_text)} caracteres"
                )
                return pdf_text

            # Si el PDF es escaneado (sin capa de texto), activar OCR Multimodal con Gemini
            logger.info(
                f"PDF '{filename}' parece ser escaneado o imagen (longitud {len(pdf_text)}). Activando OCR Multimodal Gemini..."
            )
            return self.extract_text_multimodal_ocr(file_bytes, "application/pdf")

        # 2. DOCUMENTOS WORD (.docx)
        if lower_name.endswith(".docx"):
            try:
                import io

                import docx

                doc = docx.Document(io.BytesIO(file_bytes))
                full_paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                for table in doc.tables:
                    for row in table.rows:
                        full_paragraphs.append(
                            " | ".join(
                                [cell.text.strip() for cell in row.cells if cell.text.strip()]
                            )
                        )
                docx_text = "\n".join(full_paragraphs).strip()
                if len(docx_text) >= 20:
                    return docx_text
                raise RuntimeError(
                    f"El documento Word '{filename}' no contiene texto legible. "
                    "¿Es un archivo .docx real? Convierte a PDF si es un formato antiguo."
                )
            except RuntimeError:
                raise
            except Exception as docx_err:
                logger.warning(f"Error procesando .docx '{filename}': {docx_err}")
                raise RuntimeError(
                    f"No se pudo leer el documento Word '{filename}': está dañado "
                    "o no es un .docx válido. Prueba exportándolo de nuevo o como PDF."
                ) from docx_err

        # 2. IMÁGENES
        image_mimes = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
        }
        for ext, mime in image_mimes.items():
            if lower_name.endswith(ext):
                logger.info(f"Procesando imagen '{filename}' con OCR Multimodal ({mime})...")
                return self.extract_text_multimodal_ocr(file_bytes, mime)

        # 3. TEXTO PLANO — latin-1 nunca falla, así que un binario con nombre
        # .txt decodificaría a basura que terminaría indexada en Qdrant y
        # alimentando al LLM. Sniff: >10% de caracteres de control → no es texto.
        def _looks_binary(t: str) -> bool:
            if not t:
                return False
            sample = t[:2000]
            ctrl = sum(1 for c in sample if ord(c) < 32 and c not in "\n\r\t")
            return ctrl / len(sample) > 0.10

        try:
            decoded = file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                decoded = file_bytes.decode("latin-1").strip()
            except Exception:
                return ""
        if _looks_binary(decoded):
            logger.warning(f"'{filename}' decodifica pero parece binario — descartado.")
            return ""
        return decoded

    def summarize_document(self, text: str, max_chars: int = 1500) -> str:
        """
        Resumen ejecutivo del documento (viñetas de conceptos clave).
        Se usa como metadato ligero por doc y para futuras generaciones
        con contexto acotado. Devuelve "" si ningún proveedor responde.
        """
        if not text or len(text.strip()) < 80:
            return ""
        prompt = (
            "Resume en un máximo de 8 viñetas los conceptos, definiciones y fórmulas "
            "clave del siguiente material de estudio. Español, denso, directo, sin saludos "
            "ni comentarios meta:\n\n"
            f"{text[:60000]}"
        )
        if self.groq_client:
            for g_model in self._ordered_models(GROQ_FAST_MODELS, self._last_good_groq):
                try:
                    t0 = usage_started()
                    comp = self.groq_client.chat.completions.create(
                        model=g_model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.3,
                        max_tokens=500,
                        timeout=10.0,
                    )
                    record_groq_usage(comp, g_model, "summary", usage_elapsed_ms(t0))
                    out = (comp.choices[0].message.content or "").strip()
                    if out:
                        self._last_good_groq = g_model
                        return out[:max_chars]
                except Exception as e:
                    logger.debug(f"Resumen con Groq ({g_model}) falló: {e}")
        if self.client:
            for model_name in self._ordered_models(
                GEMINI_FALLBACK_MODELS[:3], self._last_good_gemini
            ):
                try:
                    t0 = usage_started()
                    resp = self.client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(temperature=0.3),
                    )
                    record_gemini_usage(resp, model_name, "summary", usage_elapsed_ms(t0))
                    out = (resp.text or "").strip()
                    if out:
                        self._last_good_gemini = model_name
                        return out[:max_chars]
                except Exception as e:
                    logger.debug(f"Resumen con Gemini ({model_name}) falló: {e}")
        return ""

    def generate_capy_response_with_psychology(
        self,
        user_message: str,
        nodes_context: list,
        hand_context: list,
        theme: str = "",
        user_profile: dict[str, Any] | None = None,
        history: list | None = None,
    ) -> dict[str, Any]:
        """
        Analiza el estado psicológico y emocional del estudiante usando NLP
        y formula una respuesta empática, tierna y personalizada según el nombre,
        género y edad del estudiante.
        """
        from app.services.psychology_service import psychology_service

        user_info = user_profile or {}
        student_name = user_info.get("username", "amiguito")
        gender = (user_info.get("gender") or "otro").strip().lower()
        age = user_info.get("age", 20)

        # Configuración de rol según la regla de género:
        # Estudiante Hombre -> Hubzi como figura protectora y maternal femenina
        # Estudiante Mujer -> Hubzi como figura sabia y serena masculina
        if gender in ("masculino", "hombre", "varon"):
            persona_role = "Hablas como una capibara consejera femenina, infinitamente dulce, tierna y maternal."
            vocative = "mi campeón lindo, mi cielo, mi rey inteligente"
        elif gender in ("femenino", "mujer", "dama"):
            persona_role = "Hablas como un capibara consejero masculino, sabio, sereno, protector y profundamente comprensivo."
            vocative = "mi campeona hermosa, mi niña linda, mi estrella brillante"
        else:
            persona_role = "Hablas como una capibara sabia y amorosa, refugio incondicional de paz."
            vocative = "mi corazón, mi sol, mi gran pensador"

        # Modulación según grupo etario
        if age < 18:
            age_tone = f"El estudiante {student_name} tiene {age} años. Tu tono debe ser lúdico, dinámico, entusiasta y muy cercano, sin formalismos rígidos."
        elif age <= 25:
            age_tone = f"El estudiante {student_name} tiene {age} años (etapa universitaria/académica). Comprende la ansiedad de exámenes, entregas y desvelos; sé su bálsamo anti-estrés."
        else:
            age_tone = f"El estudiante {student_name} tiene {age} años (adulto/profesional). Sé respetuoso, maduro, empático y centrado en la serenidad mental y claridad cognitiva."

        # 1. Evaluación heurística rápida (sin LLM): detecta crisis keywords,
        #    estrés explícito y mensajes triviales sin quemar tokens.
        context_data = {
            "unsolved_nodes": len([n for n in nodes_context if not n.get("isSolved")]),
            "theme": theme,
            "student_name": student_name,
            "age": age,
            "gender": gender,
        }
        psych_analysis = psychology_service.analyze_emotional_state(
            user_message, context=context_data, llm=False
        )

        # 2. Crisis o estrés muy agudo → contención inmediata (protocolo
        #    intacto, nunca depende de que un LLM responda).
        if psych_analysis.is_crisis or psych_analysis.stress_level >= 0.85:
            return {
                "reply": psych_analysis.empathic_response,
                "psychology": psych_analysis.model_dump(),
            }

        # 3. Mensaje trivial en calma ("hola", "ok", "gracias") → sin LLM,
        #    pero rotando variantes personalizadas (nada repetido seguido).
        if (
            psych_analysis.stress_level < 0.35
            and psychology_service.is_trivial_message(user_message)
        ):
            return {
                "reply": self._trivial_reply(user_message, student_name, vocative),
                "psychology": psych_analysis.model_dump(),
            }

        # 4. Contexto del tablero acotado: solo nodos pendientes (máx 8),
        #    label + pista corta — la pregunta completa no aporta al tono.
        pending = [n for n in nodes_context if not n.get("isSolved")][:8]
        nodes_summary = (
            "\n".join(
                f"- {n.get('label', '')}: pista={str(n.get('hint', ''))[:90]}"
                for n in pending
            )
            or "Nodos del circuito pendientes."
        )

        hand_summary = (
            ", ".join(
                [
                    f"{c.get('name', '')}{' (distractor)' if c.get('isDistractor') else ''}"
                    for c in hand_context[:10]
                ]
            )
            or "Cartas en mano del usuario."
        )

        # Adaptación del tono según el nivel de estrés (heurística rápida)
        tone_instruction = ""
        if psych_analysis.stress_level >= 0.5:
            tone_instruction = (
                f"\n🚨 ATENCIÓN CLÍNICA: El estudiante muestra {psych_analysis.stress_category} "
                f"(nivel {psych_analysis.stress_level}) con emoción '{psych_analysis.emotion_detected}'. "
                f"Distorsión detectada: '{psych_analysis.cognitive_distortion or 'tensión general'}'. "
                "Tu máxima prioridad es calmarlo con enorme calidez, validar su esfuerzo "
                "y recordarle que errar es parte del juego. Sugiere hacer una pausa o respirar juntos si lo necesita."
            )

        # Memoria conversacional: los últimos intercambios le dan a Hubzi
        # continuidad de amigo real (máx ~6 turnos para no inflar el prompt)
        history_summary = ""
        for h in (history or [])[-6:]:
            speaker = student_name if h.get("role") == "user" else "Hubzi"
            snippet = str(h.get("text", ""))[:140]
            if snippet:
                history_summary += f"- {speaker}: {snippet}\n"
        if history_summary:
            history_summary = (
                "CONVERSACIÓN RECIENTE (mantén continuidad, recuerda lo que te contó):\n"
                + history_summary
                + "\n"
            )

        # UNA SOLA LLAMADA LLM (antes eran dos: eval clínica + respuesta).
        # El eval clínico y la respuesta personalizada se fusionan: el campo
        # empathic_response del JSON clínico sale ya adaptado al tablero.
        reply_directives = (
            f"PERSONA: Eres Hubzi, capibara terapeuta gamer. {persona_role}\n"
            f"Te diriges a {student_name}. {age_tone}\n"
            f"Tema de la sesión: '{theme}'. {tone_instruction}\n"
            f"TABLERO (nodos pendientes):\n{nodes_summary}\n"
            f"CARTAS EN MANO: {hand_summary}\n"
            f"{history_summary}"
            "VOZ Y PERSONALIDAD:\n"
            f"- Afecto sincero; llámalo a veces {student_name} o usa ({vocative}).\n"
            "- `empathic_response`: máx. 2 oraciones breves (18-30 palabras), cálidas.\n"
            "- Si habla de su vida/emociones fuera del juego, conversa como amigo cercano.\n"
            "- Si pide pista, orienta con cariño usando las pistas del tablero.\n"
            "- `empathic_response` es texto limpio para TTS: sin asteriscos ni comillas."
        )

        fused = psychology_service.analyze_and_reply(
            user_message, context=context_data, reply_directives=reply_directives
        )
        if fused:
            return {
                "reply": fused["reply"],
                "psychology": fused["psychology"].model_dump(),
            }

        # Fallback total: heurística sin LLM (el LLM está caído)
        return {
            "reply": psych_analysis.empathic_response
            or "¡Confía en tu respiración y en tu mente! Todo saldrá bien.",
            "psychology": psych_analysis.model_dump(),
        }

    def generate_capy_hint(
        self, user_message: str, nodes_context: list, hand_context: list, theme: str = ""
    ) -> str:
        """Compatibilidad regresiva: devuelve únicamente la locución textual."""
        result = self.generate_capy_response_with_psychology(
            user_message, nodes_context, hand_context, theme
        )
        return result.get("reply", "¡Confía en ti! Vamos paso a paso.")

    def generate_capy_speech(
        self,
        situation: str,
        level: int = 1,
        theme: str = "",
        user_profile: dict | None = None,
        history: list | None = None,
        context_data: dict | None = None,
    ) -> str:
        """
        Genera alocuciones 100% dinámicas y no repetidas enfocadas en psicología positiva,
        reducción de ansiedad cognitiva y soporte emocional sereno y profesional.
        Sin piropos ni cursilerías exageradas.
        """
        history = history or []
        avoid_clause = ""
        if history:
            recent_avoid = "; ".join([f'"{h}"' for h in history[-8:]])
            avoid_clause = f"\n⚠️ REGLA ESTRICTA DE NO REPETICIÓN: NO repitas ninguna de estas frases previas ni uses sus mismas palabras iniciales: {recent_avoid}."

        level_psychology_descriptors = {
            1: "Calmado, claro y acogedor. Valida el inicio del proceso y promueve una respiración tranquila.",
            2: "Enfoque en autoeficacia. Destaca la atención sostenida, el análisis reflexivo y el progreso mental paso a paso.",
            3: "Refuerzo cognitivo. Valida el razonamiento lógico, ayuda a gestionar la frustración y normaliza el esfuerzo mental.",
            4: "Estrategias de regulación emocional ante la complejidad. Refuerza la serenidad, la paciencia y la confianza fundada en datos.",
            5: "Consolidación de maestría cognitiva. Celebra la resiliencia, la agudeza analítica y la madurez para resolver problemas difíciles con mente despejada.",
        }
        psy_desc = level_psychology_descriptors.get(level, level_psychology_descriptors[1])

        situation_prompts = {
            "correct": "El estudiante acaba de conectar una carta correcta. Refuerza su capacidad de deducción lógica y concentración.",
            "wrong": "El estudiante colocó una carta errónea. Desdramatiza el error desde la Terapia Cognitivo-Conductual (el error es solo retroalimentación informativa). Invítalo a respirar y replantear.",
            "level_up": f"El estudiante avanza al Nivel {level}. Reconoce su resiliencia cognitiva y su capacidad de adaptación.",
            "hint": "El estudiante solicita una pista. Brinda orientación reflexiva estructurada para estimular su propio criterio.",
            "welcome": f"Inicio del Nivel {level}. Transmite calma mental, claridad de objetivos y contención.",
            "victory": "¡El estudiante ha completado con éxito todo el circuito! Valida su perseverancia y fortaleza mental.",
        }
        sit_desc = situation_prompts.get(
            situation, "Intervención psicológica de apoyo en el estudio."
        )

        # 1. PHRASE-PACK: servir del pack cacheado o regenerar N frases en
        #    UNA llamada (clave por situación+nivel efectivo+tema). Al
        #    rellenar se prohíbe repetir lo ya servido + rota la directiva
        #    de estilo para variar el registro entre packs.
        pack_key = (situation, min(max(1, level), 5), (theme or "")[:60])
        pack = self._speech_packs.get(pack_key)
        if pack:
            while pack:
                candidate = pack.popleft()
                if candidate and candidate not in history:
                    self._pack_served.setdefault(pack_key, set()).add(candidate)
                    return candidate
            self._speech_packs.pop(pack_key, None)

        served = self._pack_served.get(pack_key, set())
        avoid_extra = ""
        if served:
            avoid_extra = "\nYA DIJISTE ANTES (prohibido repetir ideas ni palabras iniciales): " + "; ".join(
                f'"{p[:60]}"' for p in list(served)[-12:]
            )
        round_n = self._pack_round.get(pack_key, 0)
        self._pack_round[pack_key] = round_n + 1
        style = _PACK_STYLES[round_n % len(_PACK_STYLES)]
        phrases = self._generate_speech_pack(
            situation,
            level,
            theme,
            psy_desc,
            sit_desc,
            avoid_clause + avoid_extra,
            style_directive=style,
        )
        if phrases:
            self._speech_packs[pack_key] = deque(phrases)
            while self._speech_packs[pack_key]:
                candidate = self._speech_packs[pack_key].popleft()
                if candidate and candidate not in history:
                    self._pack_served.setdefault(pack_key, set()).add(candidate)
                    return candidate

        # 2. Respaldo: una sola frase con Groq (8b primero)
        if self.groq_client:
            for g_model in GROQ_FAST_MODELS:
                try:
                    sys_instruction = (
                        "Eres Hubzi: un psicólogo cognitivo sereno, empático, profesional y reconfortante. "
                        "Tu objetivo es reducir la ansiedad ante exámenes y optimizar el rendimiento del estudiante.\n"
                        f"NIVEL COGNITIVO: Nivel {level}/{CAMPAIGN_MAX_LEVEL}. Enfoque: {psy_desc}\n"
                        f"SITUACIÓN: {sit_desc}\n"
                        f"TEMA DE ESTUDIO: '{theme or 'Materia'}'\n"
                        f"{avoid_clause}\n"
                        "REGLAS OBLIGATORIAS:\n"
                        "1. NO uses piropos ni apelativos empalagosos.\n"
                        "2. Mantén un tono cálido, profesional, sereno y psicológicamente seguro.\n"
                        "3. Escribe exactamente UNA o DOS oraciones concisas (15 a 25 palabras máximo).\n"
                        "4. Devuelve SOLO el texto plano para síntesis de voz, sin comillas ni asteriscos."
                    )
                    t0 = usage_started()
                    chat_comp = self.groq_client.chat.completions.create(
                        model=g_model,
                        messages=[
                            {"role": "system", "content": sys_instruction},
                            {
                                "role": "user",
                                "content": f"Genera una frase de apoyo para la situación: {situation} (Nivel {level})",
                            },
                        ],
                        max_tokens=65,
                        temperature=0.85,
                    )
                    record_groq_usage(chat_comp, g_model, "capy_speech", usage_elapsed_ms(t0))
                    content = (
                        (chat_comp.choices[0].message.content or "")
                        .strip()
                        .replace('"', "")
                        .replace("*", "")
                    )
                    if content and content not in history:
                        return content
                except Exception as ge:
                    logger.debug(f"Groq speech ({g_model}) no disponible: {ge}")

        # 3. Respaldo con Gemini
        if self.client:
            sys_instruction = (
                "Eres Hubzi: un psicólogo cognitivo sereno, empático, profesional y reconfortante. "
                "Tu objetivo es reducir la ansiedad ante exámenes y optimizar el rendimiento del estudiante.\n"
                f"NIVEL COGNITIVO: Nivel {level}/{CAMPAIGN_MAX_LEVEL}. Enfoque: {psy_desc}\n"
                f"SITUACIÓN: {sit_desc}\n"
                f"TEMA DE ESTUDIO: '{theme or 'Materia'}'\n"
                f"{avoid_clause}\n"
                "REGLAS OBLIGATORIAS:\n"
                "1. NO uses piropos, NO uses cursilerías ni apelativos empalagosos ('mi amor', 'mi rey', 'mi cielo', 'me derrito', etc.).\n"
                "2. Mantén un tono cálido, profesional, sereno y psicológicamente seguro (puedes llamarlo por su nombre, 'amigo', o hablar de forma directa y respetuosa).\n"
                "3. Escribe exactamente UNA o DOS oraciones concisas (15 a 25 palabras máximo).\n"
                "4. Enfatiza la calma, la evidencia, la respiración y el proceso de aprendizaje.\n"
                "5. Devuelve SOLO el texto plano para síntesis de voz, sin comillas ni asteriscos."
            )

            for model_name in ["gemini-flash-latest", "gemini-2.5-flash"]:
                try:
                    t0 = usage_started()
                    resp = self.client.models.generate_content(
                        model=model_name,
                        contents=f"Genera una frase de apoyo psicológico para la situación: {situation} (Nivel {level})",
                        config=genai_types.GenerateContentConfig(
                            system_instruction=sys_instruction,
                            temperature=0.85,
                            max_output_tokens=65,
                        ),
                    )
                    record_gemini_usage(resp, model_name, "capy_speech", usage_elapsed_ms(t0))
                    if resp and resp.text:
                        cleaned = resp.text.strip().replace('"', "").replace("*", "")
                        if cleaned and cleaned not in history:
                            return cleaned
                except Exception as e:
                    logger.info(
                        f"Gemini {model_name} ocupado o no disponible ({e}), activando generador psicológico procedural."
                    )
                    break

        # Fallback procedural psicológico garantizado sin piropos
        return self._generate_procedural_unique_speech(situation, level, history)

    def _generate_speech_pack(
        self,
        situation: str,
        level: int,
        theme: str,
        psy_desc: str,
        sit_desc: str,
        avoid_clause: str,
        pack_size: int = 8,
        style_directive: str = "",
    ) -> list[str]:
        """
        Genera un pack de N frases distintas en UNA llamada LLM y devuelve la
        lista limpia. Amortiza el costo del prompt de sistema (que domina el
        gasto de una llamada de speech) sobre N respuestas en vez de 1.
        """
        sys_instruction = (
            "Eres Hubzi: un psicólogo cognitivo sereno, empático, profesional y reconfortante. "
            "Tu objetivo es reducir la ansiedad ante exámenes y optimizar el rendimiento del estudiante.\n"
            f"NIVEL COGNITIVO: Nivel {level}/{CAMPAIGN_MAX_LEVEL}. Enfoque: {psy_desc}\n"
            f"SITUACIÓN: {sit_desc}\n"
            f"TEMA DE ESTUDIO: '{theme or 'Materia'}'\n"
            f"{avoid_clause}\n"
            f"{style_directive}\n"
            "REGLAS OBLIGATORIAS:\n"
            "1. NO uses piropos ni apelativos empalagosos.\n"
            "2. Tono cálido, profesional, sereno y psicológicamente seguro.\n"
            f"3. Genera EXACTAMENTE {pack_size} frases DISTINTAS entre sí (sin repetir ideas).\n"
            "4. Cada frase: UNA o DOS oraciones concisas (15 a 25 palabras máximo).\n"
            "5. Devuelve SOLO un JSON array de strings, sin comillas extra ni markdown. "
            'Ejemplo: ["frase 1", "frase 2", "frase 3"].'
        )
        user_content = f"Genera {pack_size} frases de apoyo para la situación: {situation} (Nivel {level})"

        def _parse_pack(raw: str) -> list[str]:
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            try:
                data = json.loads(raw)
                if isinstance(data, list):
                    return [
                        str(p).strip().replace('"', "").replace("*", "")
                        for p in data
                        if isinstance(p, str) and 15 < len(p.strip()) < 300
                    ]
            except Exception as pe:
                logger.debug(f"Parse de pack JSON falló, intentando por líneas: {pe}")
            # Fallback: separar por líneas numeradas
            lines = [
                ln.strip().lstrip("0123456789.-)•* ").strip('"').replace("*", "")
                for ln in raw.splitlines()
                if ln.strip()
            ]
            return [ln for ln in lines if 15 < len(ln) < 300]

        if self.groq_client:
            for g_model in GROQ_FAST_MODELS:
                try:
                    t0 = usage_started()
                    comp = self.groq_client.chat.completions.create(
                        model=g_model,
                        messages=[
                            {"role": "system", "content": sys_instruction},
                            {"role": "user", "content": user_content},
                        ],
                        temperature=0.9,
                        max_tokens=pack_size * 60,
                        timeout=10.0,
                    )
                    record_groq_usage(comp, g_model, "capy_speech_pack", usage_elapsed_ms(t0))
                    phrases = _parse_pack(comp.choices[0].message.content or "")
                    if len(phrases) >= 2:
                        return phrases
                except Exception as ge:
                    logger.debug(f"Groq speech pack ({g_model}) falló: {ge}")

        if self.client:
            for model_name in ["gemini-flash-latest", "gemini-2.5-flash"]:
                try:
                    t0 = usage_started()
                    resp = self.client.models.generate_content(
                        model=model_name,
                        contents=user_content,
                        config=genai_types.GenerateContentConfig(
                            system_instruction=sys_instruction,
                            temperature=0.9,
                            max_output_tokens=pack_size * 60,
                            response_mime_type="application/json",
                        ),
                    )
                    record_gemini_usage(
                        resp, model_name, "capy_speech_pack", usage_elapsed_ms(t0)
                    )
                    phrases = _parse_pack(resp.text or "")
                    if len(phrases) >= 2:
                        return phrases
                except Exception as e:
                    logger.debug(f"Gemini speech pack ({model_name}) falló: {e}")

        return []

    def _trivial_reply(self, message: str, name: str, vocative: str) -> str:
        """Respuestas rotativas para mensajes triviales (0 tokens) — el
        contador garantiza no repetir hasta agotar el pool de la categoría."""
        import random

        t = message.lower().strip()
        if any(g in t for g in ("hola", "hey", "buenas", "buenos", "qué tal", "saludos")):
            pool = [
                f"¡Hola {name}! Qué alegría escucharte — ¿en qué te ayudo hoy?",
                f"¡{name}! Aquí estoy, lista para lo que necesites en el juego.",
                f"Hola {name.split()[0] if name else ''}, ¿pregunta, pista o solo charlamos un rato?",
                "¡Qué gusto tenerte por aquí! Cuéntame qué necesitas.",
            ]
        elif "gracias" in t:
            pool = [
                f"Para eso estoy, {name}. Seguimos cuando quieras.",
                "¡Un placer ayudarte! Tu esfuerzo es el que hace la magia.",
                "Gracias a ti por confiar en mí. ¿Vamos por más?",
            ]
        else:  # acks: ok, vale, dale, sí, bien, genial
            pool = [
                f"Perfecto, {vocative.split(',')[0] if vocative else name}. Cuando quieras seguimos.",
                "Entendido — aquí sigo contigo para lo que necesites.",
                f"Dale, {name}. El tablero te espera cuando estés listo/a.",
            ]
        idx = self._trivial_cycle % len(pool)
        self._trivial_cycle += 1
        if idx == 0:
            random.shuffle(pool)
        return pool[idx]

    def _generate_procedural_unique_speech(self, situation: str, level: int, history: list) -> str:
        """Generador procedural combinatorio de enfoque psicológico riguroso, sereno y sin piropos."""
        import random

        prefixes = [
            "Excelente deducción",
            "Mantén ese ritmo sereno",
            "Bien pensado",
            "Observo gran claridad mental",
            "Paso firme y seguro",
            "Buen análisis",
        ]
        prefix = random.choice(prefixes)

        actions = {
            "correct": [
                "identificaste con precisión el concepto clave. Tu razonamiento lógico está funcionando muy bien.",
                "conexión exacta. Cuando enfocas tu atención con calma, los patrones se revelan por sí solos.",
                "acierto fundamentado. Sigue confiando en tu análisis reflexivo, vas por excelente camino.",
                "respuesta correcta. Tu capacidad de relacionar ideas demuestra una comprensión sólida.",
            ],
            "wrong": [
                "recuerda que un error es únicamente información, no define tu capacidad. Respira profundo y analiza otra opción.",
                "toma una pausa consciente. Los distractores suelen parecer lógicos; descartarlo te acerca a la respuesta verdadera.",
                "inmune a la frustración: cada descarte entrena tu criterio crítico. Revisa las premisas y volvamos a intentarlo.",
                "mantén la mente despejada. La equivocación es parte del aprendizaje activo; confía en tu razonamiento.",
            ],
            "level_up": [
                f"has completado esta etapa con constancia mental. Tu cerebro se adapta con éxito al Nivel {level}.",
                f"ascendemos al Nivel {level}. Tu concentración sostenida está dando frutos muy claros.",
                "excelente progreso cognitivo. Cada nivel superado refuerza tu seguridad y dominio sobre el tema.",
            ],
            "hint": [
                "analiza la raíz del término: busca en tus cartas la función operativa principal que responda al reactivo.",
                "despeja la mente: elimina primero las opciones extremas y concéntrate en la definición central.",
                "respira y lee con atención: la clave está en el verbo principal de la pregunta.",
            ],
            "welcome": [
                f"iniciamos el Nivel {level}. Mantén una respiración serena y confía plenamente en tu proceso analítico.",
                "aquí estamos para avanzar con calma. Tu enfoque estructurado es tu mejor herramienta en este nivel.",
            ],
            "victory": [
                "has completado todo el circuito demostrando equilibrio emocional y rigor analítico. Gran trabajo mental.",
                "prueba superada con excelencia. Mantuviste la serenidad y la claridad bajo presión intelectual.",
            ],
        }

        act_list = actions.get(situation, actions["correct"])
        act = random.choice(act_list)

        if situation == "wrong":
            phrase = act
        else:
            phrase = f"{prefix}: {act}"

        if phrase in history:
            phrase += " Respira con calma y continúa."

        return phrase


ai_service = AIService()
