import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.age_bands import band_for_age, get_band
from app.core.security import get_current_user
from app.services.adaptive_engine import (
    get_mastery,
    get_user_skill_map,
    recommend_next,
    record_attempt,
)

logger = logging.getLogger("hubzy.adaptive")
router = APIRouter(prefix="/api/v1/adaptive", tags=["Adaptive"])


class AttemptRequest(BaseModel):
    domain: str = Field(..., description="Dominio pedagógico (matematica, fisica, ...)")
    topic: str = Field(..., description="Subtema/habilidad (fracciones, algebra, ...)")
    correct: bool = Field(..., description="Si el intento fue correcto")
    response_ms: int | None = Field(default=None, description="Tiempo de respuesta en ms")


class NextRequest(BaseModel):
    domain: str
    topic: str
    current_level: int = Field(default=1, ge=1, le=20)
    streak: int = Field(default=0)


@router.post("/attempt")
async def log_attempt(payload: AttemptRequest, current_user: dict = Depends(get_current_user)):
    """
    Registra un intento del jugador en una habilidad y devuelve la nueva
    P(dominio) estimada por BKT + recomendación de acción.
    """
    uid = str(current_user.get("id") or current_user.get("_id"))
    band = current_user.get("age_band") or band_for_age(current_user.get("age"))
    return await record_attempt(
        uid,
        payload.domain,
        payload.topic,
        payload.correct,
        band_key=band,
        response_ms=payload.response_ms,
    )


@router.post("/next")
async def suggest_next(payload: NextRequest, current_user: dict = Depends(get_current_user)):
    """
    Sugiere qué hacer a continuación: subir, mantener o bajar nivel,
    basado en la P(dominio) actual de la habilidad.
    """
    uid = str(current_user.get("id") or current_user.get("_id"))
    band = current_user.get("age_band") or band_for_age(current_user.get("age"))
    p = await get_mastery(uid, payload.domain, payload.topic, band)
    rec = recommend_next(p, payload.streak)
    return {
        "p_mastery": round(p, 3),
        "current_level": payload.current_level,
        "suggested_level": max(1, min(20, payload.current_level + rec["difficulty_delta"])),
        **rec,
        "band_config": {
            "questions_per_level": get_band(band).get("questions_per_level"),
            "trap_count": get_band(band).get("trap_count"),
        },
    }


@router.get("/skills")
async def get_skills(current_user: dict = Depends(get_current_user)):
    """Mapa de habilidades del usuario: dominadas, en progreso, intentos."""
    uid = str(current_user.get("id") or current_user.get("_id"))
    return await get_user_skill_map(uid)
