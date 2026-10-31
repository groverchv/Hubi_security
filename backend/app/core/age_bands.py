"""
Bandas de edad de Hubzi — la columna vertebral de la experiencia adaptativa.

Cada banda define los parámetros de juego, lectura y tono de Hubzi según el
desarrollo cognitivo del usuario (5 a 30+ años). Todo es configuración:
los servicios y routers consultan estos dicts, nunca hardcodean por edad.
"""

AGE_BANDS = {
    "sprout": {  # 5-7: pre-lectora / lectora inicial
        "label": "Semillita",
        "min_age": 4,
        "max_age": 7,
        "questions_per_level": 3,
        "cards_per_round": 3,
        "trap_count": 0,
        "hint_cost": 0,  # pistas ilimitadas gratis
        "max_statement_words": 8,
        "auto_tts": True,  # se lee todo en voz alta
        "show_map": False,  # mapa simple por "mundos", no 20 niveles
        "session_minutes": 5,
        "celebration": "max",
        "pressure": False,  # cero timers / vidas
        "capi_persona": "cuento_infantil",
        "numbers_max": 10,
        "requires_parental_consent": True,
    },
    "explorer": {  # 8-10: lectura funcional
        "label": "Explorador",
        "min_age": 8,
        "max_age": 10,
        "questions_per_level": 4,
        "cards_per_round": 4,
        "trap_count": 1,  # trampas obvias
        "hint_cost": 0,
        "max_statement_words": 15,
        "auto_tts": True,
        "show_map": True,
        "session_minutes": 10,
        "celebration": "high",
        "pressure": False,
        "capi_persona": "amiga_mayor",
        "numbers_max": 100,
        "requires_parental_consent": True,
    },
    "adventurer": {  # 11-14: concreto → abstracto
        "label": "Aventurero",
        "min_age": 11,
        "max_age": 14,
        "questions_per_level": 6,
        "cards_per_round": 5,
        "trap_count": 2,
        "hint_cost": 1,
        "max_statement_words": 30,
        "auto_tts": False,
        "show_map": True,
        "session_minutes": 15,
        "celebration": "medium",
        "pressure": False,
        "capi_persona": "companera_de_equipo",
        "numbers_max": 1000,
        "requires_parental_consent": False,  # 13+ en la mayoría de jurisdicciones
    },
    "challenger": {  # 15-18: secundaria / presión de exámenes
        "label": "Retador",
        "min_age": 15,
        "max_age": 18,
        "questions_per_level": 8,
        "cards_per_round": 7,
        "trap_count": 2,
        "hint_cost": 1,
        "max_statement_words": None,
        "auto_tts": False,
        "show_map": True,
        "session_minutes": 25,
        "celebration": "low",
        "pressure": True,  # rankings / timers opcionales
        "capi_persona": "coach_motivador",
        "numbers_max": 100000,
        "requires_parental_consent": False,
    },
    "scholar": {  # 19-25: universitario (configuración actual del producto)
        "label": "Académico",
        "min_age": 19,
        "max_age": 25,
        "questions_per_level": None,  # usa la curva actual (Nivel K = K preguntas)
        "cards_per_round": 8,
        "trap_count": None,  # curva actual de GAME_LEVELS
        "hint_cost": 1,
        "max_statement_words": None,
        "auto_tts": False,
        "show_map": True,
        "session_minutes": None,
        "celebration": "low",
        "pressure": True,
        "capi_persona": "psicologa_tcc",
        "numbers_max": 10**9,
        "requires_parental_consent": False,
    },
    "pro": {  # 26-30+: autodidacta / profesional
        "label": "Profesional",
        "min_age": 26,
        "max_age": 150,
        "questions_per_level": None,
        "cards_per_round": 8,
        "trap_count": None,
        "hint_cost": 2,
        "max_statement_words": None,
        "auto_tts": False,
        "show_map": True,
        "session_minutes": None,
        "celebration": "minimal",
        "pressure": True,
        "capi_persona": "directa",
        "numbers_max": 10**12,
        "requires_parental_consent": False,
    },
}

DEFAULT_BAND = "scholar"


def band_for_age(age: int | None) -> str:
    """Devuelve la banda correspondiente a una edad declarada."""
    if age is None:
        return DEFAULT_BAND
    for key, band in AGE_BANDS.items():
        if band["min_age"] <= age <= band["max_age"]:
            return key
    return DEFAULT_BAND


def get_band(band_key: str | None) -> dict:
    """Config de banda con fallback seguro."""
    return AGE_BANDS.get(band_key or DEFAULT_BAND, AGE_BANDS[DEFAULT_BAND])


def is_minor(band_key: str | None) -> bool:
    """True si la banda corresponde a menores de edad (<18)."""
    return band_key in ("sprout", "explorer", "adventurer", "challenger")


def needs_parental_consent(band_key: str | None) -> bool:
    return get_band(band_key)["requires_parental_consent"]


def resolve_level_question_count(band_key: str | None, level: int) -> int:
    """
    Preguntas para un nivel según la banda.
    scholar/pro conservan la curva actual (Nivel K = K preguntas).
    """
    band = get_band(band_key)
    q = band.get("questions_per_level")
    if q is None:
        return level  # curva legacy Nivel K
    return q


def resolve_trap_count(band_key: str | None, level: int, legacy_traps: int) -> int:
    """Trampas del nivel según banda; bandas pequeñas reducen o eliminan."""
    band = get_band(band_key)
    t = band.get("trap_count")
    if t is None:
        return legacy_traps
    # Las trampas solo aparecen cuando hay suficientes preguntas para no frustrar
    return min(t, max(0, resolve_level_question_count(band_key, level) - 2))


# ---------------------------------------------------------------------
# Lenguaje con género — plantillas inclusivas según género declarado
# ---------------------------------------------------------------------

CHEER_WORDS = {
    "masculino": ["campeón", "genio", "crack"],
    "femenino": ["campeona", "genia", "crack"],
    "otro": ["crack", "genio", "figura"],
    "default": ["crack", "genio"],
}


def cheer_word(gender: str | None) -> str:
    """Palabra de ánimo apropiada al género declarado (fallback neutro)."""
    import random

    g = (gender or "").strip().lower()
    words = CHEER_WORDS.get(g, CHEER_WORDS["default"])
    return random.choice(words)
