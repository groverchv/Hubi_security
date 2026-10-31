import json
import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.rate_limit import limiter
from app.services.psychology_service import PsychologyAnalysisResult, psychology_service

logger = logging.getLogger("hubzy.psychology")
router = APIRouter(prefix="/api/v1/psychology", tags=["Psychology"])


class PsychologyAnalyzeRequest(BaseModel):
    text: str
    context: dict | None = None


@router.post("/analyze", response_model=PsychologyAnalysisResult)
@limiter.limit("30/minute")
async def analyze_student_stress(request: Request, payload: PsychologyAnalyzeRequest):
    """
    Analiza el nivel de estrés, emociones, distorsiones cognitivas TCC y
    recomienda intervenciones somáticas. Devuelve is_crisis=true si se detecta
    riesgo clínico — el frontend DEBE mostrar el protocolo de crisis.
    """
    return psychology_service.analyze_emotional_state(payload.text, context=payload.context)


@router.get("/protocols")
async def get_anti_stress_protocols():
    """Protocolos clínicos de reducción de estrés basados en evidencia (4-7-8, suspiro fisiológico, 5-4-3-2-1)."""
    return psychology_service.get_protocols()


class PsychologyReframeRequest(BaseModel):
    thought: str


@router.post("/reframe")
@limiter.limit("20/minute")
async def reframe_negative_thought(request: Request, payload: PsychologyReframeRequest):
    """Reestructura pensamientos catastróficos mediante TCC."""
    return psychology_service.reframe_negative_thought(payload.thought)


# ---------------------------------------------------------------------
# PROTOCOLO DE CRISIS — obligación ética del producto
# (ver docs/exploracion-ansiedad-uagrm.md: protocolo de derivación)
# ---------------------------------------------------------------------

DEFAULT_CRISIS_RESOURCES = [
    {
        "name": "Emergencias (Bolivia)",
        "detail": "Si tu vida o la de alguien está en peligro inmediato, llama a emergencias.",
        "phone": "911",
        "type": "emergency",
    },
    {
        "name": "Línea de la Vida — Salud Mental (SEDESS/Ministerio de Salud)",
        "detail": "Atención gratuita y confidencial en crisis emocionales. Verifica el número vigente en tu ciudad.",
        "phone": None,  # TODO: confirmar número oficial vigente para Santa Cruz antes de producción
        "type": "hotline",
    },
    {
        "name": "Bienestar Universitario UAGRM",
        "detail": "Servicio de psicología de tu universidad. Acude a la Dirección de Bienestar Universitario.",
        "phone": None,  # TODO: confirmar contacto oficial con la UAGRM (ver doc de exploración)
        "type": "institutional",
    },
    {
        "name": "Habla con alguien de confianza",
        "detail": "Un familiar, amigo o docente. Decirlo en voz alta ya reduce la carga.",
        "phone": None,
        "type": "guidance",
    },
]


@router.get("/crisis-resources")
async def get_crisis_resources():
    """
    Recursos de derivación en crisis mostrados por la UI cuando is_crisis=true.
    Configurables por entorno vía CRISIS_RESOURCES_JSON (JSON array).
    """
    if settings.CRISIS_RESOURCES_JSON:
        try:
            custom = json.loads(settings.CRISIS_RESOURCES_JSON)
            if isinstance(custom, list) and custom:
                return {"resources": custom, "configured": True}
        except Exception as e:
            logger.warning(f"CRISIS_RESOURCES_JSON inválido: {e}")
    return {"resources": DEFAULT_CRISIS_RESOURCES, "configured": False}
