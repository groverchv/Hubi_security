"""
Jobs asíncronos de generación de tableros.

El endpoint `generate-game?async=true` crea un job y devuelve 202 {job_id}
de inmediato; un asyncio.create_task corre el pipeline mientras el frontend
consulta GET /api/v1/jobs/{id} para progreso real por etapas y cancelación
del lado cliente (deja de sondear; el resultado queda cacheado).

Persistencia: colección `jobs` en MongoDB, o dict en memoria sin BD.
Limitación conocida (v1): el runner vive en el proceso — si éste muere a
media generación el job queda en 'running'; el siguiente paso es una cola
persistente con workers (Redis/arq) retomando jobs 'pending'.
"""

import logging
import secrets
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

from app.core.database import db_manager
from app.core.security import utcnow_iso
from app.core.session_store import in_memory_jobs

logger = logging.getLogger("hubzy.job_service")

JOB_STAGES = ("queued", "reading", "generating", "saving", "done")

# Higiene: los jobs terminados se conservan 1h (margen para que el cliente
# sondee el resultado) y el dict en memoria se acota para no crecer sin bound.
JOB_RESULT_TTL_S = 3600
_IN_MEMORY_JOBS_MAX = 500
_TERMINAL_STATUSES = ("done", "error", "cancelled")


def _prune_memory_jobs() -> None:
    if len(in_memory_jobs) <= _IN_MEMORY_JOBS_MAX:
        return
    finished = sorted(
        (j for j in in_memory_jobs.values() if j.get("status") in _TERMINAL_STATUSES),
        key=lambda j: j.get("updated_at") or "",
    )
    for job in finished[: len(in_memory_jobs) - _IN_MEMORY_JOBS_MAX]:
        in_memory_jobs.pop(job["id"], None)


async def _prune_mongo_jobs() -> None:
    """Borra jobs terminales con más de JOB_RESULT_TTL_S. Las fechas ISO de
    utcnow_iso comparan lexicográficamente, así que sirve como cutoff."""
    if db_manager.db is None:
        return
    try:
        cutoff = (datetime.now(UTC) - timedelta(seconds=JOB_RESULT_TTL_S)).isoformat()
        await db_manager.db["jobs"].delete_many(
            {"status": {"$in": list(_TERMINAL_STATUSES)}, "updated_at": {"$lt": cutoff}}
        )
    except Exception as e:
        logger.debug(f"No se pudieron purgar jobs antiguos en Mongo: {e}")


async def recover_interrupted_jobs() -> None:
    """Al arrancar, los jobs pending/running persistidos quedaron huérfanos:
    el runner vive en el proceso que murió. Se marcan como interrumpidos."""
    if db_manager.db is None:
        return
    try:
        res = await db_manager.db["jobs"].update_many(
            {"status": {"$in": ["pending", "running"]}},
            {
                "$set": {
                    "status": "error",
                    "stage": "error",
                    "error": "Generación interrumpida por reinicio del servidor.",
                    "status_code": 503,
                    "updated_at": utcnow_iso(),
                }
            },
        )
        if res.modified_count:
            logger.warning(f"{res.modified_count} jobs huérfanos marcados como interrumpidos.")
    except Exception as e:
        logger.warning(f"No se pudieron recuperar jobs interrumpidos: {e}")


async def create_job(kind: str, user_id: str | None = None, meta: dict | None = None) -> dict:
    job = {
        "id": f"job_{secrets.token_hex(8)}",
        "kind": kind,
        "status": "pending",
        "stage": "queued",
        "progress": 0,
        "result": None,
        "error": None,
        "status_code": None,
        "user_id": user_id,
        "meta": meta or {},
        "timings": {},
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
    }
    if db_manager.db is not None:
        try:
            await db_manager.db["jobs"].insert_one(dict(job))
        except Exception as e:
            logger.warning(f"No se pudo persistir job {job['id']} en Mongo: {e}")
    in_memory_jobs[job["id"]] = job
    _prune_memory_jobs()
    await _prune_mongo_jobs()
    return job


async def get_job(job_id: str) -> dict | None:
    # La copia en memoria es la fuente fresca (el runner la actualiza primero).
    job = in_memory_jobs.get(job_id)
    if job:
        return job
    if db_manager.db is not None:
        try:
            return await db_manager.db["jobs"].find_one({"id": job_id}, {"_id": 0})
        except Exception as e:
            logger.warning(f"Error leyendo job {job_id}: {e}")
    return None


async def _update(job_id: str, **fields) -> None:
    fields["updated_at"] = utcnow_iso()
    job = in_memory_jobs.get(job_id)
    if job:
        job.update(fields)
    if db_manager.db is not None:
        try:
            await db_manager.db["jobs"].update_one({"id": job_id}, {"$set": fields})
        except Exception as e:
            logger.debug(f"No se pudo actualizar job {job_id} en Mongo: {e}")


def stage_updater(job_id: str) -> Callable[[str, int], Awaitable[None]]:
    """Callback `await progress('generating', 55)` que el pipeline invoca por etapa."""

    async def _cb(stage: str, progress: int = 0) -> None:
        await _update(job_id, status="running", stage=stage, progress=progress)

    return _cb


async def execute_job(job_id: str, coro: Awaitable) -> None:
    """
    Runner: ejecuta la corrutina del pipeline y sella el job con
    resultado (done) o error (error + status_code). Registra timings por etapa.
    """
    t0 = time.perf_counter()
    try:
        result = await coro
        total_ms = (time.perf_counter() - t0) * 1000
        payload = result.model_dump() if hasattr(result, "model_dump") else result
        await _update(
            job_id,
            status="done",
            stage="done",
            progress=100,
            result=payload,
            timings={"total_ms": round(total_ms)},
        )
        logger.info(f"Job {job_id} completado en {total_ms:.0f}ms.")
    except HTTPException as he:
        await _update(
            job_id,
            status="error",
            stage="error",
            error=str(he.detail),
            status_code=he.status_code,
            timings={"total_ms": round((time.perf_counter() - t0) * 1000)},
        )
        logger.warning(f"Job {job_id} falló ({he.status_code}): {he.detail}")
    except Exception as e:
        logger.exception(f"Job {job_id} falló con error inesperado: {e}")
        await _update(
            job_id,
            status="error",
            stage="error",
            error="Error inesperado al generar el tablero.",
            status_code=500,
            timings={"total_ms": round((time.perf_counter() - t0) * 1000)},
        )
