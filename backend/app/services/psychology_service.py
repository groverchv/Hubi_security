import json
import logging
import re
from typing import Any

from pydantic import BaseModel, Field

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

logger = logging.getLogger("hubzy.psychology_service")

# Mensajes triviales donde la evaluación clínica por LLM no aporta: la
# heurística (<1ms) ya da una respuesta adecuada y se ahorra una llamada.
_TRIVIAL_MESSAGE_RE = re.compile(
    r"^(hola+|hey+|buenas?|buenos\w*|qué tal|como estas|cómo estás|ok+|okey+|vale+|"
    r"gracias+|muchas gracias|sí+|si+|no+|bien|genial|perfecto|listo|adiós|adios|"
    r"chao|bye|entendido|dale|va|mmmm*|ajá+|aja+|eh+|umm*)\W*$",
    re.IGNORECASE,
)
_TRIVIAL_MAX_CHARS = 30

# Modelos Gemini oficiales en orden de velocidad y cuota disponible
GEMINI_FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]


# =====================================================================
# ESQUEMAS PYDANTIC PARA PSICOLOGÍA Y SALUD EMOCIONAL
# =====================================================================


class PsychologyAnalysisResult(BaseModel):
    stress_level: float = Field(
        default=0.1,
        description="Nivel de estrés de 0.0 (total serenidad) a 1.0 (pánico/alta tensión)",
    )
    stress_category: str = Field(
        default="calm", description="calm | mild_tension | moderate_anxiety | high_stress | crisis"
    )
    emotion_detected: str = Field(
        default="calma", description="Emoción predominante identificada en el estudiante"
    )
    cognitive_distortion: str | None = Field(
        default=None,
        description="Distorsión cognitiva TCC (ej. Catastrofismo, Todo o Nada, Impostor)",
    )
    needs_somatic_intervention: bool = Field(
        default=False, description="Verdadero si se recomienda activar respiración o grounding"
    )
    recommended_intervention: str = Field(
        default="cognitive_reframe",
        description="breathing_478 | physiological_sigh | grounding_54321 | cognitive_reframe | micro_step",
    )
    empathic_response: str = Field(
        default="Estoy aquí contigo. Respira con calma y avancemos paso a paso.",
        description="Mensaje cálido y terapéutico de Hubzi",
    )
    clinical_rationale: str = Field(
        default="Regulación del tono vagal y desactivación simpática.",
        description="Fundamento neuropsicológico",
    )
    is_crisis: bool = Field(
        default=False, description="Bandera roja de seguridad clínica (autolesión o crisis severa)"
    )


# =====================================================================
# CATÁLOGO DE PROTOCOLOS CLÍNICOS BASADOS EN EVIDENCIA (TCC, ACT, VAGAL)
# =====================================================================

EVIDENCE_BASED_PROTOCOLS = {
    "breathing_478": {
        "name": "Respiración 4-7-8 (Dr. Andrew Weil)",
        "objective": "Desacelerar la frecuencia cardíaca mediante estimulación del nervio vago y activación parasimpática.",
        "steps": [
            "Inhala profundamente por la nariz durante 4 segundos.",
            "Retén el aire con calma en tus pulmones durante 7 segundos.",
            "Exhala lentamente por la boca en 8 segundos, vaciando toda la tensión.",
        ],
        "duration_seconds": 38,
        "ideal_for": ["moderate_anxiety", "high_stress", "taquicardia", "bloqueo_mental"],
    },
    "physiological_sigh": {
        "name": "Suspiro Fisiológico (Neurobiología de Stanford)",
        "objective": "Reabrir los alvéolos pulmonares colapsados y reducir el CO2 en sangre en menos de 20 segundos.",
        "steps": [
            "Toma una inhalación profunda por la nariz.",
            "Inmediatamente, da una segunda micro-inhalación corta por la nariz para llenar al máximo.",
            "Suelta todo el aire por la boca en una exhalación larga, suave y completa.",
        ],
        "duration_seconds": 15,
        "ideal_for": ["mild_tension", "impaciencia", "inicio_de_estres"],
    },
    "grounding_54321": {
        "name": "Técnica de Enraizamiento Sensorial 5-4-3-2-1",
        "objective": "Desactivar la hiperactivación de la amígdala cerebral trayendo la atención consciente a estímulos sensoriales tangibles del presente.",
        "steps": [
            "Nombra 5 cosas que puedas ver a tu alrededor.",
            "Toca 4 texturas u objetos cercanos.",
            "Escucha 3 sonidos sutiles de tu entorno.",
            "Identifica 2 aromas.",
            "Reconoce 1 sensación agradable en tu cuerpo o sabor.",
        ],
        "duration_seconds": 45,
        "ideal_for": ["desconexión", "ataque_de_pánico", "rumiación_obsesiva"],
    },
    "cognitive_reframe": {
        "name": "Reestructuración Cognitiva TCC (Aaron Beck)",
        "objective": "Desmantelar pensamientos automáticos distorsionados de incompetencia o catastrofismo académico.",
        "steps": [
            "Identifica el pensamiento limitante (ej: 'no voy a poder').",
            "Examina la evidencia real: ¿un error en una carta significa que no sabes nada?",
            "Reformula en una afirmación compasiva y realista basada en el aprendizaje continuo.",
        ],
        "duration_seconds": 30,
        "ideal_for": ["perfeccionismo", "miedo_a_fallar", "autocrítica"],
    },
    "micro_step": {
        "name": "Fraccionamiento de Carga Cognitiva",
        "objective": "Evitar la parálisis por análisis reduciendo el problema a una única acción inmediata de 10 segundos.",
        "steps": [
            "Olvida el resto del tablero.",
            "Lee únicamente una sola palabra del concepto más simple.",
            "Toma una sola carta sin preocuparte por el puntaje total.",
        ],
        "duration_seconds": 20,
        "ideal_for": ["abrumamiento", "sobrecarga_de_información"],
    },
}


# =====================================================================
# MOTOR DETERMINISTA DE CLASIFICACIÓN AFECTIVA Y DISTORSIONES (HEURÍSTICA CLÍNICA)
# =====================================================================

STRESS_KEYWORDS_MAP = {
    # Nivel Alto / Pánico (0.8 - 1.0)
    "crisis": [
        "no puedo más",
        "me quiero morir",
        "odio mi vida",
        "me rindo",
        "me voy a matar",
        "desesperado",
        "ataque de pánico",
        "no respiro",
        "me ahogo",
        "colapso",
    ],
    "high_stress": [
        "estoy muy estresado",
        "demasiado estresada",
        "ansiedad",
        "muy nervioso",
        "muy nerviosa",
        "no sirvo para nada",
        "voy a reprobar",
        "no entiendo nada",
        "todo mal",
        "no doy más",
        "bloqueado",
        "bloqueada",
        "me tiemblan las manos",
        "llorar",
        "frustración total",
    ],
    # Nivel Moderado (0.5 - 0.79)
    "moderate_anxiety": [
        "estresado",
        "estresada",
        "difícil",
        "complicado",
        "tengo miedo",
        "no sé qué hacer",
        "me cuesta",
        "me equivoqué",
        "fallé",
        "qué rabia",
        "confuso",
        "no llego",
        "apuro",
        "presión",
        "angustia",
        "tensión",
        "preocupado",
        "preocupada",
    ],
    # Nivel Leve / Impaciencia (0.25 - 0.49)
    "mild_tension": [
        "uhm",
        "a ver",
        "no sé",
        "duda",
        "pista",
        "ayuda",
        "perdido",
        "perdida",
        "un poco difícil",
        "no me sale",
        "vamos a ver",
    ],
}

DISTORTIONS_PATTERNS = [
    (
        r"\b(nunca|jamás|todo|nada|siempre)\b",
        "Pensamiento Todo o Nada (Polarización)",
        "Pensamiento dicotómico que ignora los matices y el progreso parcial.",
    ),
    (
        r"\b(voy a reprobar|es el fin|es un desastre|todo saldrá mal|arruiné todo)\b",
        "Catastrofismo",
        "Anticipación del peor escenario posible sin evidencia proporcional.",
    ),
    (
        r"\b(no sirvo|soy tonto|soy inútil|todos son mejores|no soy capaz)\b",
        "Desvalorización / Síndrome del Impostor",
        "Atribución interna negativa que socava la autoeficacia académica.",
    ),
    (
        r"\b(debería saber|tengo que ser perfecto|no puedo fallar)\b",
        "Exigencias Rígidas ('Los Debería')",
        "Autoexigencia desadaptativa que detona cortisol y parálisis.",
    ),
]


# =====================================================================
# SYSTEM PROMPT DE PSICOLOGÍA CLÍNICA PARA GEMINI
# =====================================================================

PSYCHOLOGY_SYSTEM_PROMPT = """
Eres Hubzi, una neuropsicóloga clínica y tutora empática de élite en la plataforma EdTech Hubzy.
Tu misión es reducir el estrés agudo, la ansiedad ante exámenes y el bloqueo cognitivo en estudiantes universitarios,
utilizando principios rigurosos de Terapia Cognitivo-Conductual (TCC), Terapia de Aceptación y Compromiso (ACT) y Regulación Vagal.

CRITERIOS CLÍNICOS OBLIGATORIOS:
1. Evalúa el mensaje del usuario considerando su nivel de activación fisiológica, valencia emocional y distorsiones cognitivas.
2. Si detectas catastrofismo, autocrítica o pánico, NO des una respuesta fría ni técnica.
3. Brinda una validación emocional incondicional y un reencuadre cognitivo suave (máximo 25-35 palabras para voz).
4. Si el nivel de estrés es moderado o alto (>= 0.5), recomienda explícitamente una pausa de respiración consciente (ej. 'breathing_478' o 'physiological_sigh').
5. Si detectas ideación autolítica o crisis grave, activa 'is_crisis: true' y proporciona contención protectora inmediata.

FORMATO DE RESPUESTA OBLIGATORIO:
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "stress_level": 0.65,
  "stress_category": "moderate_anxiety",
  "emotion_detected": "frustración académica",
  "cognitive_distortion": "Catastrofismo",
  "needs_somatic_intervention": true,
  "recommended_intervention": "breathing_478",
  "empathic_response": "Tranquilo mi amiguito. Respirar hondo un momento calmará tu mente. Recuerda que equivocarse en una carta es parte natural del aprendizaje. ¡Hagamos una respiración juntos!",
  "clinical_rationale": "Desactivación del sistema simpático y reducción de rumiación mediante reestructuración y respiración 4-7-8.",
  "is_crisis": false
}
"""


class PsychologyNLPService:
    def __init__(self):
        self.client = None
        self.groq_client = None

        if GROQ_AVAILABLE and settings.GROQ_API_KEY:
            try:
                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
                logger.info(
                    "Psychology NLP Service conectado a Groq Cloud para análisis ultrarrápido."
                )
            except Exception as e:
                self.groq_client = None
                logger.warning(f"No se pudo inicializar Groq en PsychologyService: {e}")

        if GENAI_AVAILABLE and settings.GEMINI_API_KEY:
            try:
                self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
                logger.info("Psychology NLP Service conectado a Gemini con SDK google-genai.")
            except Exception as e:
                logger.warning(f"No se pudo inicializar Gemini para PsychologyService: {e}")

    @staticmethod
    def is_trivial_message(text: str) -> bool:
        """Saludos/acks cortos donde la evaluación LLM no aporta nada."""
        t = (text or "").lower().strip()
        return len(t) <= _TRIVIAL_MAX_CHARS and bool(_TRIVIAL_MESSAGE_RE.match(t))

    def analyze_emotional_state(
        self, text: str, context: dict[str, Any] | None = None, llm: bool = True
    ) -> PsychologyAnalysisResult:
        """
        Analiza el estado psicológico y nivel de estrés del usuario a partir de texto o transcripción de voz.
        Combina un analizador heurístico neuropsicológico determinista ultrarrápido con Gemini Multimodal.
        """
        if not text or not text.strip():
            return PsychologyAnalysisResult(
                stress_level=0.1,
                stress_category="calm",
                emotion_detected="serenidad",
                needs_somatic_intervention=False,
                recommended_intervention="micro_step",
                empathic_response="Estoy aquí para acompañarte en tu estudio. ¿En qué concepto te gustaría enfocarte?",
            )

        clean_text = text.lower().strip()

        # 1. VERIFICACIÓN DE SEGURIDAD CLÍNICA / BANDERA ROJA (CRISIS)
        for crisis_word in STRESS_KEYWORDS_MAP["crisis"]:
            if crisis_word in clean_text:
                logger.warning(
                    f"🚨 ALERTA DE SEGURIDAD PSICOLÓGICA DETECTADA: '{crisis_word}' en texto."
                )
                return PsychologyAnalysisResult(
                    stress_level=1.0,
                    stress_category="crisis",
                    emotion_detected="desesperanza aguda",
                    cognitive_distortion="Catastrofismo / Crisis",
                    needs_somatic_intervention=True,
                    recommended_intervention="grounding_54321",
                    empathic_response="Tu vida y tu bienestar son lo más valioso. Por favor detén la pantalla, respira conmigo y recuerda que no estás solo. Puedes llamar a las líneas de ayuda gratuita en salud mental.",
                    clinical_rationale="Protocolo ético de protección y contención inmediata en crisis.",
                    is_crisis=True,
                )

        # 1.5. CAPA ML OPCIONAL — clasificador pretrained de emociones (español)
        # Cubre ideación/riesgo expresado de forma indirecta que los keywords
        # literales no atrapan ("ya no quiero seguir", "todo da igual").
        # Solo se ejecuta si CRISIS_MODEL_ENABLED=true. Nunca reemplaza la
        # heurística — solo eleva el nivel si detecta sadness/fear extremo.
        try:
            from app.services.ml_safety import ml_detect_crisis_emotion

            ml = ml_detect_crisis_emotion(clean_text)
            if ml.get("available"):
                if ml.get("is_crisis_signal"):
                    logger.warning(
                        f"🚨 ALERTA ML: emoción '{ml['emotion']}' score={ml['score']} — "
                        f"posible señal indirecta de crisis en texto."
                    )
                    return PsychologyAnalysisResult(
                        stress_level=1.0,
                        stress_category="crisis",
                        emotion_detected=f"{ml['emotion']} (detectado por modelo ML)",
                        cognitive_distortion="Desesperanza / Riesgo indirecto",
                        needs_somatic_intervention=True,
                        recommended_intervention="grounding_54321",
                        empathic_response="Percibo que algo muy pesado te está pasando. Tu bienestar es lo más importante — detén la pantalla un momento y respira conmigo. No estás solo, hay líneas de ayuda gratuita.",
                        clinical_rationale="Señal ML de alta confianza en emoción de riesgo (sadness/fear extremo) — se activa protocolo de crisis preventivo.",
                        is_crisis=True,
                    )
                if ml.get("risk_level", 0) >= 0.55:
                    # Eleva el análisis heurístico si el modelo detecta malestar
                    ml_elevation = ml["risk_level"]
                    logger.info(f"ML elevó riesgo a {ml_elevation} (emoción: {ml['emotion']})")
                    heur = self._heuristic_analysis(clean_text)
                    if heur.stress_level < ml_elevation:
                        heur = heur.model_copy(
                            update={
                                "stress_level": max(heur.stress_level, ml_elevation),
                                "stress_category": "high_stress"
                                if ml_elevation >= 0.75
                                else "moderate_anxiety",
                                "needs_somatic_intervention": True,
                                "emotion_detected": f"{heur.emotion_detected} + {ml['emotion']}",
                                "clinical_rationale": f"{heur.clinical_rationale} [ML risk={ml_elevation}]",
                            }
                        )
                    base_result = heur
                    # Continuar con Gemini si está disponible para profundizar
                    if self.client:
                        try:
                            ai_result = self._gemini_clinical_evaluation(text, context)
                            if ai_result:
                                return ai_result
                        except Exception as e:
                            logger.warning(f"Error en evaluación clínica Gemini: {e}")
                    return base_result
        except Exception as e:
            logger.warning(f"Capa ML de crisis no disponible: {e}")

        # 2. EVALUACIÓN HEURÍSTICA BASE
        base_result = self._heuristic_analysis(clean_text)

        # Gating: mensajes triviales (saludos, "ok", "gracias") en calma → la
        # llamada LLM no aporta nada clínico que la heurística no cubra.
        if not llm or (
            base_result.stress_level < 0.35
            and len(clean_text) <= _TRIVIAL_MAX_CHARS
            and _TRIVIAL_MESSAGE_RE.match(clean_text)
        ):
            return base_result

        # 3. SI HAY LLM DISPONIBLE, PROFUNDIZAR CON NLP CLÍNICO AVANZADO
        if self.groq_client or self.client:
            try:
                ai_result = self._gemini_clinical_evaluation(text, context)
                if ai_result:
                    return ai_result
            except Exception as e:
                logger.warning(
                    f"Error en evaluación clínica LLM, usando análisis heurístico: {e}"
                )

        return base_result

    def _heuristic_analysis(self, clean_text: str) -> PsychologyAnalysisResult:
        """
        Motor de clasificación neuropsicológica determinista de baja latencia (<1ms).
        Evalúa densidad de términos estresores, distorsiones cognitivas y signos de activación.
        """
        stress_score = 0.1
        category = "calm"
        detected_emotion = "curiosidad"
        distortion = None
        needs_breathing = False
        intervention = "micro_step"
        empathic_text = "¡Vas por buen camino! Tómate tu tiempo para analizar cada concepto."

        # Detectar distorsiones cognitivas
        for pattern, dist_name, _ in DISTORTIONS_PATTERNS:
            if re.search(pattern, clean_text):
                distortion = dist_name
                stress_score += 0.25
                break

        # Evaluar palabras clave de estrés
        if any(w in clean_text for w in STRESS_KEYWORDS_MAP["high_stress"]):
            stress_score = max(stress_score, 0.78)
            category = "high_stress"
            detected_emotion = "ansiedad académica / frustración intensa"
            needs_breathing = True
            intervention = "breathing_478"
            empathic_text = "Siento que hay mucha tensión ahora mismo amiguito. Detengámonos 30 segundos a respirar. Tu cerebro necesita oxígeno para brillar."
        elif any(w in clean_text for w in STRESS_KEYWORDS_MAP["moderate_anxiety"]):
            stress_score = max(stress_score, 0.55)
            category = "moderate_anxiety"
            detected_emotion = "tensión / inseguridad"
            needs_breathing = True
            intervention = "physiological_sigh"
            empathic_text = "No te preocupes por equivocarte. Cada intento entrena tus neuronas. Respira suave y elige la opción que más te resuene."
        elif any(w in clean_text for w in STRESS_KEYWORDS_MAP["mild_tension"]):
            stress_score = max(stress_score, 0.35)
            category = "mild_tension"
            detected_emotion = "duda cognitiva"
            needs_breathing = False
            intervention = "cognitive_reframe"
            empathic_text = "Es normal tener dudas con temas complejos. Miremos las palabras clave de la pregunta juntos."

        # Signos de exclamación o longitud de queja
        if clean_text.count("!") >= 2 or clean_text.count("?") >= 3:
            stress_score = min(1.0, stress_score + 0.15)

        return PsychologyAnalysisResult(
            stress_level=min(1.0, round(stress_score, 2)),
            stress_category=category,
            emotion_detected=detected_emotion,
            cognitive_distortion=distortion,
            needs_somatic_intervention=needs_breathing,
            recommended_intervention=intervention,
            empathic_response=empathic_text,
            clinical_rationale=f"Evaluación de carga alostática: {category} con distorsión '{distortion or 'Ninguna'}'.",
        )

    def _gemini_clinical_evaluation(
        self, text: str, context: dict[str, Any] | None = None
    ) -> PsychologyAnalysisResult | None:
        """
        Ejecuta el pipeline de NLP psicológico con Groq o Gemini para captar sutilezas emocionales,
        ironía, fatiga o sobrecarga mental con latencia mínima.
        """
        context_str = ""
        if context:
            context_str = f"\nContexto del estudiante: {json.dumps(context, ensure_ascii=False)}"

        user_content = f'Mensaje del estudiante (voz/texto):\n"{text}"{context_str}'

        # 1. Intentar con Groq primero (8b-instant: clasificación clínica
        # no necesita el 70b — cuesta ~10x menos por token)
        if self.groq_client:
            for g_model in ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]:
                try:
                    t0 = usage_started()
                    chat_comp = self.groq_client.chat.completions.create(
                        model=g_model,
                        messages=[
                            {"role": "system", "content": PSYCHOLOGY_SYSTEM_PROMPT},
                            {"role": "user", "content": user_content},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                        max_tokens=350,
                    )
                    record_groq_usage(chat_comp, g_model, "psych_eval", usage_elapsed_ms(t0))
                    raw_text = (chat_comp.choices[0].message.content or "").strip()
                    if raw_text:
                        data = json.loads(raw_text)
                        return PsychologyAnalysisResult(
                            stress_level=float(data.get("stress_level", 0.2)),
                            stress_category=str(data.get("stress_category", "calm")),
                            emotion_detected=str(data.get("emotion_detected", "calma")),
                            cognitive_distortion=data.get("cognitive_distortion"),
                            needs_somatic_intervention=bool(
                                data.get("needs_somatic_intervention", False)
                            ),
                            recommended_intervention=str(
                                data.get("recommended_intervention", "cognitive_reframe")
                            ),
                            empathic_response=str(
                                data.get(
                                    "empathic_response",
                                    "Estoy contigo para ayudarte a aprender con serenidad.",
                                )
                            ),
                            clinical_rationale=str(
                                data.get(
                                    "clinical_rationale",
                                    f"Intervención rápida calibrada con {g_model}.",
                                )
                            ),
                            is_crisis=bool(data.get("is_crisis", False)),
                        )
                except Exception as ge:
                    logger.debug(f"Groq psychology eval ({g_model}) no disponible: {ge}")

        # 2. Si Groq no está disponible, usar Gemini
        if not self.client:
            return None

        for model_name in GEMINI_FALLBACK_MODELS:
            try:
                t0 = usage_started()
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=PSYCHOLOGY_SYSTEM_PROMPT,
                        temperature=0.3,
                        response_mime_type="application/json",
                        max_output_tokens=350,
                    ),
                )
                record_gemini_usage(response, model_name, "psych_eval", usage_elapsed_ms(t0))

                if response and response.text:
                    data = json.loads(response.text.strip())
                    return PsychologyAnalysisResult(
                        stress_level=float(data.get("stress_level", 0.2)),
                        stress_category=str(data.get("stress_category", "calm")),
                        emotion_detected=str(data.get("emotion_detected", "calma")),
                        cognitive_distortion=data.get("cognitive_distortion"),
                        needs_somatic_intervention=bool(
                            data.get("needs_somatic_intervention", False)
                        ),
                        recommended_intervention=str(
                            data.get("recommended_intervention", "cognitive_reframe")
                        ),
                        empathic_response=str(
                            data.get(
                                "empathic_response",
                                "Estoy contigo para ayudarte a aprender con serenidad.",
                            )
                        ),
                        clinical_rationale=str(
                            data.get(
                                "clinical_rationale", "Intervención de psicología positiva y TCC."
                            )
                        ),
                        is_crisis=bool(data.get("is_crisis", False)),
                    )
            except Exception as e:
                logger.debug(f"Intento de análisis con {model_name} no disponible: {e}")
                continue

        return None

    def analyze_and_reply(
        self,
        text: str,
        context: dict[str, Any] | None = None,
        reply_directives: str = "",
    ) -> dict[str, Any] | None:
        """
        Evaluación clínica + respuesta final de Hubzi en UNA sola llamada LLM.
        `reply_directives` lleva la persona, contexto del tablero y reglas de
        voz — el mismo JSON clínico de siempre pero `empathic_response` sale
        ya personalizada para el tablero, eliminando la segunda llamada que
        antes hacía ai_service.generate_capy_response_with_psychology.
        Devuelve {"reply": str, "psychology": PsychologyAnalysisResult} o None.
        """
        context_str = ""
        if context:
            context_str = f"\nContexto del estudiante: {json.dumps(context, ensure_ascii=False)}"
        user_content = f'Mensaje del estudiante (voz/texto):\n"{text}"{context_str}'

        system_prompt = PSYCHOLOGY_SYSTEM_PROMPT
        if reply_directives:
            system_prompt += (
                "\n\nREGLAS DE RESPUESTA PERSONALIZADA (para `empathic_response`):\n"
                + reply_directives
            )

        # Groq primero (8b: barato y veloz), Gemini como respaldo
        if self.groq_client:
            for g_model in ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]:
                try:
                    t0 = usage_started()
                    comp = self.groq_client.chat.completions.create(
                        model=g_model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.5,
                        max_tokens=400,
                        timeout=10.0,
                    )
                    record_groq_usage(comp, g_model, "capy_ask", usage_elapsed_ms(t0))
                    raw = (comp.choices[0].message.content or "").strip()
                    if raw:
                        data = json.loads(raw)
                        parsed = self._parse_analysis_json(data)
                        if parsed:
                            reply = parsed.empathic_response.strip().replace('"', "").replace("*", "")
                            if reply:
                                return {"reply": reply, "psychology": parsed}
                except Exception as ge:
                    logger.debug(f"Groq analyze_and_reply ({g_model}) falló: {ge}")

        if self.client:
            for model_name in GEMINI_FALLBACK_MODELS:
                try:
                    t0 = usage_started()
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=user_content,
                        config=genai_types.GenerateContentConfig(
                            system_instruction=system_prompt,
                            temperature=0.5,
                            response_mime_type="application/json",
                            max_output_tokens=400,
                        ),
                    )
                    record_gemini_usage(response, model_name, "capy_ask", usage_elapsed_ms(t0))
                    if response and response.text:
                        data = json.loads(response.text.strip())
                        parsed = self._parse_analysis_json(data)
                        if parsed:
                            reply = parsed.empathic_response.strip().replace('"', "").replace("*", "")
                            if reply:
                                return {"reply": reply, "psychology": parsed}
                except Exception as e:
                    logger.debug(f"Gemini analyze_and_reply ({model_name}) falló: {e}")
                    continue

        return None

    @staticmethod
    def _parse_analysis_json(data: dict) -> PsychologyAnalysisResult | None:
        """Parse defensivo del JSON clínico común a ambos proveedores."""
        if not isinstance(data, dict):
            return None
        try:
            return PsychologyAnalysisResult(
                stress_level=float(data.get("stress_level", 0.2)),
                stress_category=str(data.get("stress_category", "calm")),
                emotion_detected=str(data.get("emotion_detected", "calma")),
                cognitive_distortion=data.get("cognitive_distortion"),
                needs_somatic_intervention=bool(data.get("needs_somatic_intervention", False)),
                recommended_intervention=str(
                    data.get("recommended_intervention", "cognitive_reframe")
                ),
                empathic_response=str(
                    data.get("empathic_response", "Estoy contigo para ayudarte a aprender con serenidad.")
                ),
                clinical_rationale=str(
                    data.get("clinical_rationale", "Intervención de psicología positiva y TCC.")
                ),
                is_crisis=bool(data.get("is_crisis", False)),
            )
        except Exception:
            return None

    def reframe_negative_thought(self, anxious_thought: str) -> dict[str, str]:
        """
        Reestructura un pensamiento automático negativo o catastrófico del estudiante
        en una perspectiva equilibrada, realista y compasiva según la TCC.
        """
        if not self.client:
            return {
                "original_thought": anxious_thought,
                "reframe": "Este pensamiento es solo una reacción temporal al esfuerzo. Un error no define tu capacidad de aprender.",
                "technique": "Descentramiento cognitivo TCC",
            }

        reframe_prompt = (
            "Eres un terapeuta cognitivo-conductual experto en psicología educativa. "
            "Toma el siguiente pensamiento ansioso de un estudiante universitario "
            "y transfórmalo en una reformulación realista, profundamente compasiva y constructiva en máximo 1-2 oraciones.\n"
            f"Pensamiento ansioso: '{anxious_thought}'"
        )
        try:
            res = self.client.models.generate_content(
                model=GEMINI_FALLBACK_MODELS[0], contents=reframe_prompt
            )
            if res and res.text:
                return {
                    "original_thought": anxious_thought,
                    "reframe": res.text.strip().replace('"', ""),
                    "technique": "Reestructuración Cognitiva TCC",
                }
        except Exception as e:
            logger.warning(f"Error en reframe con Gemini: {e}")

        return {
            "original_thought": anxious_thought,
            "reframe": "Equivocarse en un ejercicio es la forma más rápida y efectiva en que tu cerebro consolida nuevos conocimientos.",
            "technique": "Normalización del error y crecimiento neuronal",
        }

    def get_protocols(self) -> dict[str, Any]:
        """Devuelve los protocolos clínicos indexados para reducción de estrés."""
        return EVIDENCE_BASED_PROTOCOLS


# Instancia singleton del servicio
psychology_service = PsychologyNLPService()
