import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.plans import get_limits
from app.core.rate_limit import limiter
from app.core.security import get_optional_user, get_user_plan
from app.services.voice_service import voice_service

logger = logging.getLogger("hubzy.voice")
router = APIRouter(prefix="/api/v1/voice", tags=["Voice"])


class SpeechRequest(BaseModel):
    text: str = Field(..., max_length=4000)  # TTS cobra por carácter
    voice_id: str | None = None
    profile: str | None = (
        "loving_psychologist"  # "loving_psychologist" | "crisis_soothing" | "anxiety_relief" | "zen" | "cute"
    )
    stress_level: float | None = None
    voice_gender: str | None = None  # "female" | "male"
    user_gender: str | None = None  # "masculino" | "femenino"


@router.post("/speak")
@limiter.limit("30/minute")
async def speak_zen_voice(
    request: Request,
    payload: SpeechRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Genera audio adaptando prosodia y género de voz:
    - Si el usuario es hombre → voz femenina dulce y maternal.
    - Si la usuaria es mujer → voz masculina sabia y serena.
    - La voz premium (ElevenLabs) es exclusiva de Pro/Escuela: el plan
      free usa Edge-TTS neural.
    """
    audio_bytes = await voice_service.generate_speech(
        payload.text,
        voice_id=payload.voice_id,
        profile=payload.profile or "loving_psychologist",
        stress_level=payload.stress_level,
        voice_gender=payload.voice_gender,
        user_gender=payload.user_gender,
        premium_voice=get_limits(get_user_plan(current_user))["premium_voice"],
    )
    if not audio_bytes:
        raise HTTPException(status_code=503, detail="No se pudo generar el audio.")
    return Response(content=audio_bytes, media_type="audio/mpeg")
