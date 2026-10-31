"""
Filtro de seguridad de contenido para menores de edad.

Se aplica a TODA salida que pueda leer un usuario de banda infantil
(sprout, explorer, adventurer, challenger): enunciados de tableros,
respuestas de Hubzi, pistas y descripciones.

Dos capas:
1. Lista de temas/palabras prohibidas para <18 (violencia gráfica, sexual,
   sustancias, autolesión no clínica, contenido de odio).
2. Heurísticas de tono infantil: longitud máxima por banda, detección de
   lenguaje de evaluación punitiva para bandas pequeñas.

No es un clasificador ML (eso viene en la capa B del roadmap con modelos
fine-tuneados); es determinista y testeable, que es lo que se necesita HOY.
"""

import logging
import re

from app.core.age_bands import get_band, is_minor

logger = logging.getLogger("hubzy.safety")

# Temas/palabras que NUNCA deben aparecer en contenido para <18.
# Mantener deliberadamente conservadora — es un filtro, no un censor exacto.
_BLOCKED_PATTERNS = [
    # Sexual / adulto
    r"\bsexo\b",
    r"\bsexual\b",
    r"\bpornograf",
    r"\beroti",
    r"\bdesnud",
    r"\bv[ií]agra\b",
    r"\banticonceptiv",
    # Violencia gráfica
    r"\btortura\b",
    r"\bdegoll",
    r"\bdecapit",
    r"\bmutila",
    r"\bmasacre\b",
    r"\bgenocidio\b",
    r"\bviolen(cia|to)?\s+sexual",
    r"\bviolaci[oó]n\b",
    r"\bsangrient",
    r"\bcadav",
    # Sustancias
    r"\bcoca[ií]na\b",
    r"\bhero[ií]na\b",
    r"\bmarihuana\b",
    r"\bnarcotr",
    r"\bdroga\b(?!s?\s+farmac)",
    r"\balcoholismo\b",
    r"\bborrach",
    # Odio / discriminación (en enunciados, no en historia contextual)
    r"\braza inferior\b",
    r"\bextermin",
    # Auto-daño (la ruta de crisis la maneja psychology_service aparte)
    r"\bc[oó]mo suicidarse\b",
    r"\bautolesi[oó]n\b",
]
_BLOCKED_RE = [re.compile(p, re.IGNORECASE) for p in _BLOCKED_PATTERNS]

# Lenguaje punitivo/evaluativo prohibido para bandas pequeñas (sprout/explorer)
_PUNITIVE_PATTERNS = [
    r"\breprobaste\b",
    r"\breprob[aá]r",
    r"\bsuspendiste\b",
    r"\bfallaste\b",
    r"\bincorrect[ao]s?\b",
    r"\bmal\b.*\brespuesta\b",
    r"\bperdedor\b",
    r"\bexamen\b",
    r"\bprueba\b",
    r"\bnota\b",
    r"\bcalificaci",
]
_PUNITIVE_RE = [re.compile(p, re.IGNORECASE) for p in _PUNITIVE_PATTERNS]


def contains_blocked_content(text: str) -> bool:
    """True si el texto contiene algún patrón bloqueado para menores."""
    if not text:
        return False
    if any(p.search(text) for p in _BLOCKED_RE):
        return True
    # Capa ML opcional (solo si SAFETY_MODEL_ENABLED): cubre paráfrasis
    # que la lista literal no atrapa. La heurística siempre corre primero.
    try:
        from app.services.ml_safety import ml_detect_unsafe

        ml = ml_detect_unsafe(text)
        if ml.get("available") and ml.get("unsafe"):
            logger.warning(f"ML safety flag: {ml['label']} ({ml['score']}) en: {text[:80]}...")
            return True
    except Exception as ml_err:
        logger.debug(f"ML safety no disponible, usando solo heurística: {ml_err}")
    return False


def contains_punitive_tone(text: str) -> bool:
    """True si el texto usa lenguaje de evaluación punitiva (no apto <10)."""
    if not text:
        return False
    return any(p.search(text) for p in _PUNITIVE_RE)


def filter_text_for_band(text: str, band_key: str | None, apply_length_cap: bool = False) -> str:
    """
    Filtra un texto para una banda de edad.
    - <18 con contenido bloqueado → se reemplaza por texto seguro genérico.
    - sprout/explorer con tono punitivo → se suaviza.
    - apply_length_cap=True solo para texto auxiliar (pistas/descripciones);
      NUNCA truncar enunciados de problemas: un problema cortado es incorrecto.
    """
    if not text:
        return text

    band = get_band(band_key)
    result = text

    if is_minor(band_key) and contains_blocked_content(result):
        logger.warning(f"Contenido bloqueado detectado para banda '{band_key}': {result[:80]}...")
        result = "¡Vamos a aprender algo nuevo! Intenta con la siguiente pregunta."

    if band_key in ("sprout", "explorer") and contains_punitive_tone(result):
        # Suaviza términos punitivos puntuales sin descartar el texto
        result = re.sub(r"\bincorrect[ao]s?\b", "casi", result, flags=re.IGNORECASE)
        result = re.sub(r"\bfallaste\b", "no era esa", result, flags=re.IGNORECASE)
        result = re.sub(r"\bexamen\b", "desafío", result, flags=re.IGNORECASE)

    if apply_length_cap:
        max_words = band.get("max_statement_words")
        if max_words:
            words = result.split()
            if len(words) > max_words:
                result = " ".join(words[:max_words]) + "…"

    return result


def filter_board_for_band(board, band_key: str | None):
    """
    Filtra un GameBoardResponse completo: nodos, cartas, descripciones.
    Devuelve el tablero filtrado (muta una copia). Si la banda no es menor,
    se devuelve tal cual — cero costo.
    """
    if not is_minor(band_key):
        return board

    try:
        board = board.model_copy(deep=True)
        for node in board.nodes:
            node.question = filter_text_for_band(node.question, band_key)
            node.description = filter_text_for_band(
                node.description, band_key, apply_length_cap=True
            )
            if node.question_latex:
                node.question_latex = filter_text_for_band(node.question_latex, band_key)
        for card in board.cards:
            card.concept_name = filter_text_for_band(card.concept_name, band_key)
            card.content = filter_text_for_band(card.content, band_key, apply_length_cap=True)
        return board
    except Exception as e:
        logger.warning(f"Error filtrando tablero para banda {band_key}: {e}")
        return board
