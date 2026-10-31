"""
Motor de dominios de Hubzi.

Clasifica el tema de un documento/carpeta en uno de los dominios pedagógicos
soportados y decide qué motor genera el tablero (procedural, plantillas o LLM).

Dos niveles de clasificación:
1. Heurístico por señales (keywords ponderadas + patrones regex de símbolos,
   fórmulas y código) — rápido, gratis, determinista, testeable.
2. (Opcional, futuro) Por embeddings e5 contra centroides de dominio.
"""

import re

DOMAINS = [
    "matematica",
    "fisica",
    "quimica",
    "biologia",
    "historia",
    "idiomas",
    "programacion",
    "derecho",
    "general",
]

# Palabras clave ponderadas por dominio. score += peso por cada match.
_KEYWORDS = {
    "matematica": {
        "fracción": 3,
        "fracciones": 3,
        "ecuación": 3,
        "ecuaciones": 3,
        "álgebra": 3,
        "geometría": 3,
        "trigonometría": 3,
        "aritmética": 3,
        "multiplicación": 2,
        "división": 2,
        "suma": 1,
        "resta": 1,
        "número": 1,
        "números": 1,
        "decimal": 2,
        "porcentaje": 2,
        "teorema": 2,
        "logaritmo": 3,
        "derivada": 3,
        "integral": 3,
        "polinomio": 3,
        "raíz cuadrada": 3,
        "probabilidad": 2,
        "estadística": 2,
        "matriz": 3,
        "vector": 2,
        "función cuadrática": 3,
        "pitágoras": 3,
        "perímetro": 2,
        "área": 1,
        "volumen": 2,
        "m.c.m": 3,
        "m.c.d": 3,
        "numerador": 3,
        "denominador": 3,
        "congruente": 2,
        "hipotenusa": 3,
    },
    "fisica": {
        "física": 3,
        "newton": 3,
        "velocidad": 2,
        "aceleración": 3,
        "gravedad": 3,
        "energía cinética": 3,
        "energía potencial": 3,
        "trabajo mecánico": 3,
        "potencia": 2,
        "momento lineal": 3,
        "fuerza": 2,
        "masa": 2,
        "peso": 1,
        "densidad": 2,
        "presión": 2,
        "voltaje": 3,
        "corriente eléctrica": 3,
        "resistencia eléctrica": 3,
        "circuito": 2,
        "ohm": 3,
        "joule": 3,
        "watt": 3,
        "pascal": 3,
        "onda": 2,
        "frecuencia": 2,
        "óptica": 3,
        "termodinámica": 3,
        "caída libre": 3,
        "mru": 3,
        "mruv": 3,
        "cinemática": 3,
    },
    "quimica": {
        "química": 3,
        "átomo": 3,
        "molécula": 3,
        "elemento": 2,
        "tabla periódica": 3,
        "enlace químico": 3,
        "enlace iónico": 3,
        "enlace covalente": 3,
        "oxidación": 3,
        "reducción": 3,
        "redox": 3,
        "ácido": 2,
        "base": 1,
        "ph": 3,
        "mol": 3,
        "molaridad": 3,
        "estequiometría": 3,
        "reacción": 2,
        "reactivo": 2,
        "catálisis": 3,
        "compuesto": 2,
        "ion": 2,
        "electrón": 1,
        "protón": 2,
        "neutrón": 2,
        "solución": 1,
        "solubilidad": 3,
        "hidróxido": 3,
    },
    "biologia": {
        "biología": 3,
        "célula": 3,
        "adn": 3,
        "genética": 3,
        "gen": 2,
        "ecosistema": 3,
        "fotosíntesis": 3,
        "mitosis": 3,
        "meiosis": 3,
        "organismo": 2,
        "especie": 2,
        "evolución": 3,
        "taxonomía": 3,
        "vertebrado": 2,
        "invertebrado": 2,
        "bacteria": 2,
        "virus": 2,
        "metabolismo": 3,
        "respiración celular": 3,
        "proteína": 2,
        "enzima": 3,
        "tejido": 2,
        "órgano": 1,
        "anatomía": 3,
        "neurona": 3,
        "ecología": 3,
        "cadena alimenticia": 3,
        "polinización": 3,
    },
    "historia": {
        "historia": 3,
        "siglo": 2,
        "guerra": 2,
        "revolución": 3,
        "independencia": 3,
        "imperio": 3,
        "civilización": 3,
        "colonia": 2,
        "monarquía": 3,
        "república": 2,
        "tratado": 2,
        "batalla": 2,
        "conquista": 3,
        "renacimiento": 3,
        "edad media": 3,
        "antigüedad": 2,
        "democracia": 2,
        "constitución": 2,
        "dictadura": 3,
        "presidente": 1,
        "descubrimiento": 2,
        "cultura": 1,
        "arqueología": 3,
        "abolición": 3,
    },
    "idiomas": {
        "inglés": 3,
        "english": 3,
        "vocabulario": 2,
        "gramática": 3,
        "verb": 3,
        "verbo": 2,
        "conjugación": 3,
        "present perfect": 3,
        "past simple": 3,
        "francés": 3,
        "portugués": 3,
        "idioma": 2,
        "pronunciación": 3,
        "ortografía": 2,
        "sustantivo": 2,
        "adjetivo": 2,
        "adverbio": 2,
        "preposición": 2,
        "sílaba": 2,
        "traducción": 2,
    },
    "derecho": {
        "ley": 3,
        "leyes": 3,
        "artículo": 2,
        "articulo": 2,
        "decreto": 3,
        "decreto supremo": 3,
        "jurisprudencia": 3,
        "constitución": 3,
        "código civil": 3,
        "código penal": 3,
        "demanda": 3,
        "sentencia": 3,
        "tribunal": 2,
        "juez": 2,
        "jurídico": 2,
        "jurídica": 2,
        "norma": 1,
        "normativa": 2,
        "reglamento": 2,
        "ordenanza": 3,
        "estatuto": 2,
        "contrato": 2,
        "obligación": 1,
        "responsabilidad civil": 3,
        "responsabilidad penal": 3,
        "amparo": 2,
        "habeas": 3,
        "ministerio público": 3,
        "fiscalía": 3,
        "derecho": 2,
        "legislación": 3,
        "sanción": 2,
        "infracción": 3,
        "delito": 3,
    },
    "programacion": {
        "programación": 3,
        "código": 2,
        "python": 3,
        "javascript": 3,
        "java": 2,
        "algoritmo": 3,
        "variable": 2,
        "función": 1,
        "bucle": 3,
        "array": 3,
        "lista": 1,
        "bucle for": 3,
        "while": 3,
        "if": 1,
        "clase": 2,
        "objeto": 2,
        "herencia": 3,
        "recursión": 3,
        "compilador": 3,
        "debug": 2,
        "sql": 3,
        "base de datos": 2,
        "api": 2,
        "framework": 2,
        "html": 3,
        "css": 3,
        "git": 2,
    },
}

# Patrones de alta señal (regex → dominio → peso)
# NOTA: `\d+/\d+` ya NO cuenta como fracción por sí solo — en documentos
# legales/históricos matchea fechas (15/03/2024) y citaciones (Ley 045/2010,
# Art. 12/2020) y un doc de derecho entero clasificaba como "matematica".
# Las fracciones reales se detectan vía keywords (numerador/denominador).
_PATTERNS = [
    (r"[∑∫√π≈≠≤≥±×÷]|\b\d+\s*/\s*\d+\s*=|\b[a-z]\s*[=²³]|\bx\s*[²³]|\\frac\b", "matematica", 4),
    (r"\b\d+\s*(m/s|km/h|kg|N\b|J\b|Pa\b|Hz\b|V\b|A\b|Ω|ohm)", "fisica", 4),
    (r"\b[A-Z][a-z]?\d*\s*→|\bH2O|CO2|NaCl|H2SO4|O2\b", "quimica", 4),
    (r"\b(def|class|import|print|return|function|const|let|var)\s*\(", "programacion", 4),
    (r"[{};]\s*(//|/\*)|=>|console\.log|system\.out", "programacion", 4),
    (r"\b(el|la|los|las)?\s*(1[0-9]{3}|20[0-9]{2})\s*(d\.?\s?C|a\.?\s?C)", "historia", 3),
]

# Qué generador usa cada dominio
GENERATOR_KIND = {
    "matematica": "procedural",  # math_engine: 0 tokens, verificación exacta
    "fisica": "procedural",  # physics_engine: plantillas magnitud/fórmula/conversión
    "quimica": "hybrid",  # (pendiente) plantillas + LLM para enunciados
    "biologia": "llm_rag",
    "historia": "llm_rag",
    "idiomas": "hybrid",
    "programacion": "llm_rag",
    "derecho": "llm_rag",
    "general": "llm_rag",
}

# Referencias tipo fecha (15/03/2024) o citación legal/normativa
# (Ley 045/2010, D.S. 29894/09, Art. 12/2020) — se eliminan del sample antes
# de puntuar para no confundirlas con fracciones matemáticas.
_NOISE_PATTERNS = [
    re.compile(r"\b\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2,4}\b"),  # fechas
    re.compile(
        r"\b(?:ley|decreto|d\.?\s?s\.?|art[ií]culo|resoluci[oó]n|norma|ordenanza|"
        r"c[oó]d(?:igo)?|r\.?\s?m\.?|d\.?\s?u\.?)\s*[°ºn]?\s*\d+\s*/\s*\d{2,4}\b",
        re.IGNORECASE,
    ),  # citaciones legales
    re.compile(r"\b\d{3,}/\d{4}\b"),  # "045/2010" suelto estilo norma
]


def classify_domain(text: str, title: str = "") -> dict:
    """
    Clasifica un texto en un dominio pedagógico.
    Devuelve {"domain", "confidence", "scores", "generator"}.
    """
    sample = (title + " " + (text or ""))[:60000].lower()
    # Quitar fechas y citaciones legales/normativas: inflaban el score de
    # "matematica" vía el regex de fracciones en documentos de derecho.
    for noise_re in _NOISE_PATTERNS:
        sample = noise_re.sub(" ", sample)
    scores = dict.fromkeys(DOMAINS, 0)

    for domain, kws in _KEYWORDS.items():
        for kw, w in kws.items():
            if kw in sample:
                # contar ocurrencias limitadas para no inflar por repetición
                scores[domain] += w * min(sample.count(kw), 5)

    for pattern, domain, weight in _PATTERNS:
        matches = re.findall(pattern, sample, flags=re.IGNORECASE)
        if matches:
            scores[domain] += weight * min(len(matches), 5)

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best, best_score = ranked[0]
    _second, second_score = ranked[1] if len(ranked) > 1 else ("general", 0)

    if best_score == 0:
        domain = "general"
        confidence = 0.0
    else:
        domain = best
        # confianza por separación respecto al segundo dominio
        confidence = round(min(1.0, (best_score - second_score) / (best_score + 1)), 2)

    return {
        "domain": domain,
        "confidence": confidence,
        "scores": scores,
        "generator": GENERATOR_KIND.get(domain, "llm_rag"),
    }


def detect_math_topics(text: str) -> list:
    """
    Extrae subtemas matemáticos del documento para sembrar el motor procedural.
    Ordenados por fuerza de señal.
    """
    sample = (text or "").lower()[:60000]
    topics = []
    topic_signals = {
        "fracciones": ["fracción", "fracciones", "numerador", "denominador"],
        "porcentajes": ["porcentaje", "por ciento", "%"],
        "operaciones": ["suma", "resta", "multiplicación", "división", "aritmética"],
        "algebra": ["álgebra", "ecuación", "incógnita", "variable", "despeja"],
        "geometria": ["geometría", "área", "perímetro", "triángulo", "círculo", "ángulo"],
        "potencias_raices": ["potencia", "raíz", "exponente", "logaritmo"],
        "estadistica": ["estadística", "promedio", "media", "mediana", "moda", "probabilidad"],
        "sucesiones": ["sucesión", "patrón", "secuencia", "serie"],
        "razones_proporciones": ["razón", "proporción", "regla de tres", "regla de 3"],
        "trigonometria": ["seno", "coseno", "tangente", "hipotenusa", "trigonometría"],
    }
    for topic, signals in topic_signals.items():
        score = sum(sample.count(s) for s in signals)
        if score > 0:
            topics.append((topic, score))
    topics.sort(key=lambda t: t[1], reverse=True)
    return [t for t, _ in topics] or ["operaciones"]


def has_math_signal(text: str) -> bool:
    """True solo si el documento tiene señales matemáticas REALES —
    evita que el fallback 'operaciones' de detect_math_topics enrute
    documentos ajenos (leyes, historia) al motor procedural."""
    sample = (text or "").lower()[:60000]
    strong_kw = (
        "fracción", "fracciones", "ecuación", "ecuaciones", "álgebra",
        "geometría", "trigonometría", "aritmética", "logaritmo", "derivada",
        "integral", "polinomio", "numerador", "denominador", "hipotenusa",
        "pitágoras", "raíz cuadrada", "función cuadrática",
    )
    if any(kw in sample for kw in strong_kw):
        return True
    # Símbolos matemáticos inequívocos (no fracciones de fecha/citación)
    return bool(re.search(r"[∑∫√π≈≠≤≥±×÷]|\\frac\b|\bx\s*[²³]", sample))
