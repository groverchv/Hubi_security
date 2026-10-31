"""
Clasificadores pretrained locales para seguridad — activación por flags.

Dos modelos opcionales (HuggingFace, lazy-load, nunca bloquean el arranque):

1. SAFETY (contenido para menores): clasificador de toxicidad/contenido
   inseguro que complementa el filtro determinista de safety_filter.
   Modelo por defecto: unitary/toxic-bert (multilingüe parcial; configurable
   vía SAFETY_MODEL_NAME para un modelo específico en español).

2. CRISIS (salud mental): clasificador de emociones en español
   (finiteautomata/beto-emotion-analysis: anger/fear/sadness/joy/surprise/other).
   sadness/fear a alta confianza eleva el nivel de riesgo — especialmente
   para ideación expresada de forma indirecta ("ya no quiero seguir",
   "todo da igual") que los keywords literales no atrapan.

Requisito: `pip install transformers torch` (no están en requirements.txt —
son pesados; solo instalar donde se active el flag).

Diseño: fail-safe. Si el modelo no carga, las heurísticas siguen
funcionando — el ML solo AUMENTA el recall, nunca lo reemplaza.
"""

import logging

from app.core.config import settings

logger = logging.getLogger("hubzy.ml_safety")

_safety_pipe = None
_crisis_pipe = None
_safety_failed = False
_crisis_failed = False

# Umbrales conservadores: preferimos falsos positivos a falsos negativos
# en rutas de seguridad, pero no disparar crisis con ruido bajo.
SAFETY_THRESHOLD = 0.65
CRISIS_EMOTION_THRESHOLD = 0.55  # sadness/fear
CRISIS_SCORE_THRESHOLD = 0.85  # eleva directamente a crisis


def _load_pipeline(task_model: str):
    """Carga un pipeline de text-classification con lazy import."""
    try:
        from transformers import pipeline

        return pipeline(
            "text-classification",
            model=task_model,
            top_k=None,
            truncation=True,
            max_length=512,
        )
    except Exception as e:
        logger.warning(f"No se pudo cargar el modelo '{task_model}': {e}")
        return None


def _get_safety_pipe():
    global _safety_pipe, _safety_failed
    if _safety_failed or not settings.SAFETY_MODEL_ENABLED:
        return None
    if _safety_pipe is None:
        _safety_pipe = _load_pipeline(settings.SAFETY_MODEL_NAME)
        if _safety_pipe is None:
            _safety_failed = True
        else:
            logger.info(f"Modelo de seguridad '{settings.SAFETY_MODEL_NAME}' cargado.")
    return _safety_pipe


def _get_crisis_pipe():
    global _crisis_pipe, _crisis_failed
    if _crisis_failed or not settings.CRISIS_MODEL_ENABLED:
        return None
    if _crisis_pipe is None:
        _crisis_pipe = _load_pipeline(settings.CRISIS_MODEL_NAME)
        if _crisis_pipe is None:
            _crisis_failed = True
        else:
            logger.info(f"Modelo de crisis '{settings.CRISIS_MODEL_NAME}' cargado.")
    return _crisis_pipe


def _run(pipe, text: str) -> list | None:
    """Ejecuta un pipeline HF devolviendo [{label, score}, ...] o None."""
    try:
        out = pipe(text[:512])
        # HF devuelve [[{...}]] si top_k=None o [{...}] si top_k=1
        if isinstance(out, list) and out and isinstance(out[0], list):
            return out[0]
        if isinstance(out, list):
            return out
    except Exception as e:
        logger.warning(f"Error en inferencia ML de seguridad: {e}")
    return None


def ml_detect_unsafe(text: str) -> dict:
    """
    Clasificador de contenido inseguro para menores.
    Devuelve {"unsafe": bool, "score": float, "label": str, "available": bool}.
    available=False si el modelo está desactivado o falló → la heurística
    determinista sigue siendo la única capa.
    """
    pipe = _get_safety_pipe()
    if pipe is None or not text or not text.strip():
        return {"unsafe": False, "score": 0.0, "label": None, "available": False}

    results = _run(pipe, text)
    if not results:
        return {"unsafe": False, "score": 0.0, "label": None, "available": False}

    # toxic-bert devuelve labels tipo toxic/severe_toxic/insult/threat/...
    unsafe_labels = {
        "toxic",
        "severe_toxic",
        "obscene",
        "threat",
        "insult",
        "identity_hate",
        "LABEL_1",
        "1",
    }
    best = max(results, key=lambda r: r.get("score", 0))
    label = (best.get("label") or "").lower()
    score = best.get("score", 0.0)
    unsafe = label in unsafe_labels and score >= SAFETY_THRESHOLD

    return {"unsafe": unsafe, "score": round(score, 3), "label": label, "available": True}


def ml_detect_crisis_emotion(text: str) -> dict:
    """
    Clasificador de emociones en español para señales de riesgo indirectas.
    Devuelve {"risk_level": 0-1, "emotion": str, "score": float,
              "is_crisis_signal": bool, "available": bool}.

    risk_level es una aproximación clínica: sadness/fear a alta confianza
    elevan el nivel; no reemplaza los keywords de crisis sino que cubre
    el espacio de expresiones indirectas.
    """
    pipe = _get_crisis_pipe()
    if pipe is None or not text or not text.strip():
        return {
            "risk_level": 0.0,
            "emotion": None,
            "score": 0.0,
            "is_crisis_signal": False,
            "available": False,
        }

    results = _run(pipe, text)
    if not results:
        return {
            "risk_level": 0.0,
            "emotion": None,
            "score": 0.0,
            "is_crisis_signal": False,
            "available": False,
        }

    # beto-emotion: labels en español (sadness, fear, anger, joy, surprise, others)
    by_label = {r["label"].lower(): r.get("score", 0) for r in results}
    risk_score = max(
        by_label.get("sadness", 0),
        by_label.get("fear", 0),
        # disgust/anger también pueden indicar malestar, menos peso
        by_label.get("disgust", 0) * 0.6,
        by_label.get("anger", 0) * 0.4,
    )
    best_emotion = max(by_label, key=by_label.get) if by_label else None
    best_score = by_label.get(best_emotion, 0.0)

    # Señal de crisis: sadness/fear muy alta confianza — expresión indirecta
    is_crisis_signal = risk_score >= CRISIS_SCORE_THRESHOLD and best_emotion in ("sadness", "fear")

    return {
        "risk_level": round(risk_score, 3),
        "emotion": best_emotion,
        "score": round(best_score, 3),
        "is_crisis_signal": is_crisis_signal,
        "available": True,
    }
