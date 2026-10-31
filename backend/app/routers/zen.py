import logging

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.core.database import db_manager
from app.core.security import get_optional_user, utcnow_iso

logger = logging.getLogger("hubzy.zen")
router = APIRouter(prefix="/api/v1/zen", tags=["Zen"])


class ZenLogRequest(BaseModel):
    log_type: str = "breathing_session"
    duration_seconds: int = 60
    notes: str | None = "Sesión completada con Hubzi Zen"


@router.post("/log", status_code=status.HTTP_201_CREATED)
async def log_zen_session(
    payload: ZenLogRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    """Guarda los ciclos de respiración o pausas activas completadas por el usuario."""
    doc = payload.model_dump()
    doc["created_at"] = utcnow_iso()
    if current_user:
        doc["user_id"] = str(current_user.get("id") or current_user.get("_id"))
    if db_manager.db is not None:
        try:
            res = await db_manager.db["zen_logs"].insert_one(doc)
            return {"status": "saved", "id": str(res.inserted_id)}
        except Exception as e:
            logger.error(f"Error guardando zen log: {e}")
    return {"status": "acknowledged"}


@router.get("/stats")
async def get_zen_stats(current_user: dict | None = Depends(get_optional_user)):
    """Estadísticas agregadas de bienestar del usuario autenticado."""
    if not current_user:
        return {"total_sessions": 0, "total_seconds": 0, "plan": "guest"}
    uid = str(current_user.get("id") or current_user.get("_id"))
    stats = {"total_sessions": 0, "total_seconds": 0}
    if db_manager.db is not None:
        try:
            pipeline = [
                {"$match": {"user_id": uid}},
                {
                    "$group": {
                        "_id": None,
                        "total_sessions": {"$sum": 1},
                        "total_seconds": {"$sum": "$duration_seconds"},
                    }
                },
            ]
            async for row in db_manager.db["zen_logs"].aggregate(pipeline):
                stats["total_sessions"] = row.get("total_sessions", 0)
                stats["total_seconds"] = row.get("total_seconds", 0)
        except Exception as e:
            logger.warning(f"Error agregando stats zen: {e}")
    return stats
