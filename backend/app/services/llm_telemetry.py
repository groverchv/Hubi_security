"""
Telemetría de consumo de tokens LLM (Gemini / Groq).

Cada llamada instrumentada registra provider, modelo, propósito (qué feature
la disparó), tokens de entrada/salida y latencia. Sirve para medir el ahorro
de las optimizaciones de prompt/contexto y detectar endpoints que queman
cuota sin beneficio pedagógico.

Uso:
    from app.services.llm_telemetry import record_llm_usage, record_gemini_usage, record_groq_usage

Los contadores viven en memoria del proceso (rolling); get_usage_snapshot()
expone el agregado para logs o futuros endpoints de observabilidad.
"""

import logging
import threading
import time
from collections import defaultdict
from typing import Any

logger = logging.getLogger("hubzy.llm_usage")

_lock = threading.Lock()
# (provider, model, purpose) -> agregado
_stats: dict[tuple[str, str, str], dict[str, Any]] = defaultdict(
    lambda: {"calls": 0, "errors": 0, "input_tokens": 0, "output_tokens": 0, "ms": 0.0}
)


def record_llm_usage(
    provider: str,
    model: str,
    purpose: str,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    ms: float | None = None,
    error: bool = False,
) -> None:
    """Registra una llamada LLM. `purpose` identifica la feature
    (board_gen, ocr, summary, capy_speech, capy_ask, psych_eval, ask_rag, topics, embed)."""
    in_t = int(input_tokens or 0)
    out_t = int(output_tokens or 0)
    key = (provider, model or "?", purpose)
    with _lock:
        s = _stats[key]
        s["calls"] += 1
        s["input_tokens"] += in_t
        s["output_tokens"] += out_t
        s["ms"] += ms or 0.0
        if error:
            s["errors"] += 1
    logger.info(
        f"LLM_USAGE {provider}/{model} purpose={purpose} "
        f"in={in_t} out={out_t} ms={ms or 0:.0f}{' ERROR' if error else ''}"
    )


def record_gemini_usage(response: Any, model: str, purpose: str, ms: float | None = None) -> None:
    """Extrae usage_metadata de una respuesta google-genai y la registra."""
    in_t = out_t = None
    um = getattr(response, "usage_metadata", None)
    if um is not None:
        in_t = getattr(um, "prompt_token_count", None)
        out_t = getattr(um, "candidates_token_count", None)
    record_llm_usage("gemini", model, purpose, in_t, out_t, ms)


def record_groq_usage(completion: Any, model: str, purpose: str, ms: float | None = None) -> None:
    """Extrae `usage` de una respuesta Groq (formato OpenAI) y la registra."""
    in_t = out_t = None
    u = getattr(completion, "usage", None)
    if u is not None:
        in_t = getattr(u, "prompt_tokens", None)
        out_t = getattr(u, "completion_tokens", None)
    record_llm_usage("groq", model, purpose, in_t, out_t, ms)


def get_usage_snapshot() -> dict[str, dict[str, Any]]:
    """Copia del agregado en memoria: {provider/model/purpose: stats}."""
    with _lock:
        return {f"{p}/{m} :: {purpose}": dict(s) for (p, m, purpose), s in _stats.items()}


def usage_started() -> float:
    """Timestamp helper para medir ms de una llamada."""
    return time.perf_counter()


def usage_elapsed_ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000
