"""
Telemetría UX (Fase 4.6) — eventos de funnel anónimos del frontend.
POST /api/v1/telemetry/events acepta lotes {events: [{event, props, at}]}
y los persiste en Mongo (`ux_events`) o en memoria sin BD. Sin auth:
los eventos no llevan identidad ni contenido del usuario.
"""

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.database import db_manager
from app.core.security import utcnow_iso

logger = logging.getLogger("hubzy.telemetry")
router = APIRouter(prefix="/api/v1/telemetry", tags=["Telemetry"])

_in_memory_events: list[dict] = []
_IN_MEMORY_MAX = 5000
_ALLOWED = {
    "folder_created",
    "doc_uploaded",
    "gen_started",
    "first_move",
    "level_done",
    "offline_gen_fail",
}


class TelemetryBatch(BaseModel):
    events: list[dict[str, Any]] = Field(default_factory=list, max_length=50)


@router.post("/events")
async def ingest_events(batch: TelemetryBatch):
    stored = 0
    now = utcnow_iso()
    docs = []
    for ev in batch.events:
        name = ev.get("event")
        if name not in _ALLOWED:
            continue
        props = ev.get("props")
        docs.append(
            {
                "event": name,
                "props": props if isinstance(props, dict) else {},
                "at": str(ev.get("at") or now),
                "received_at": now,
            }
        )
    if not docs:
        return {"ok": True, "stored": 0}

    if db_manager.db is not None:
        try:
            await db_manager.db["ux_events"].insert_many(docs)
            stored = len(docs)
        except Exception as e:
            logger.warning(f"No se pudieron persistir eventos UX en Mongo: {e}")
    else:
        _in_memory_events.extend(docs)
        if len(_in_memory_events) > _IN_MEMORY_MAX:
            del _in_memory_events[:-_IN_MEMORY_MAX]
        stored = len(docs)
    return {"ok": True, "stored": stored}
