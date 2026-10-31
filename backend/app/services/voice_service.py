import asyncio
import json
import logging
import time
import urllib.error
import urllib.request

from app.core.config import settings

logger = logging.getLogger("hubzy.voice_service")

# =====================================================================
# IDENTIFICADORES DE VOZ CURADOS ELEVENLABS
# =====================================================================
# Voces Femeninas (Cálidas, dulces, maternales y reconfortantes)
FEMALE_VOICE_PRIMARY = "pFZP5JQG7iQjIQuC4Bku"  # Lily (dulce y maternal)
FEMALE_VOICE_BACKUP = "XrExE9yKIg1WjnnlVkGX"  # Matilda
FEMALE_VOICE_BACKUP2 = "EXAVITQu4vr4xnSDxMaL"  # Sarah

# Voces Masculinas (Cálidas, sabias, serenas y protectoras)
MALE_VOICE_PRIMARY = "nPczCjzI2devNBz1zQrb"  # Brian (sabio, reflexivo y sereno)
MALE_VOICE_BACKUP = "ErXwobaYiN019PkySvjV"  # Antoni (cálido y motivador)
MALE_VOICE_BACKUP2 = "pNInz6obpgDQGcFmaJgB"  # Adam

# Edge-TTS Neural Voices
EDGE_VOICE_FEMALE = "es-ES-ElviraNeural"  # Femenina cálida y dulce
EDGE_VOICE_MALE = "es-ES-AlvaroNeural"  # Masculina serena y empática


# Reintentar ElevenLabs cada hora: la cuota se renueva y el latch permanente
# anterior dejaba el servicio muerto en Edge-TTS para siempre tras un 429.
_ELEVENLABS_QUOTA_COOLDOWN_S = 3600


class VoiceService:
    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self._elevenlabs_quota_exceeded_at: float | None = None

    @property
    def elevenlabs_quota_exceeded(self) -> bool:
        if self._elevenlabs_quota_exceeded_at is None:
            return False
        if (time.time() - self._elevenlabs_quota_exceeded_at) > _ELEVENLABS_QUOTA_COOLDOWN_S:
            self._elevenlabs_quota_exceeded_at = None
            logger.info("Reintentando ElevenLabs tras cooldown de cuota.")
            return False
        return True

    def _mark_quota_exceeded(self) -> None:
        self._elevenlabs_quota_exceeded_at = time.time()

    def determine_voice_gender(
        self, voice_gender: str | None = None, user_gender: str | None = None
    ) -> str:
        """
        Determina el género de la voz de Hubzi según la regla psicológica del usuario:
        - Si el usuario es Hombre (masculino) -> Hubzi habla con voz FEMENINA.
        - Si la usuaria es Mujer (femenino) -> Hubzi habla con voz MASCULINA.
        - O preferencia directa si fue especificada.
        """
        if voice_gender in ("female", "femenino"):
            return "female"
        if voice_gender in ("male", "masculino"):
            return "male"

        norm_user = (user_gender or "").strip().lower()
        if norm_user in ("masculino", "hombre", "varon", "male", "chico"):
            return "female"  # Usuario hombre -> voz femenina
        elif norm_user in ("femenino", "mujer", "dama", "female", "chica"):
            return "male"  # Usuaria mujer -> voz masculina

        # Por defecto voz femenina empática
        return "female"

    async def generate_speech(
        self,
        text: str,
        voice_id: str | None = None,
        profile: str = "loving_psychologist",
        stress_level: float | None = None,
        voice_gender: str | None = None,
        user_gender: str | None = None,
        premium_voice: bool = True,
    ) -> bytes | None:
        """
        Genera audio MP3 mediante ElevenLabs o Edge-TTS modulando prosodia y ternura
        según el nivel de estrés o perfil terapéutico del estudiante.
        premium_voice=False (plan free/guest) salta ElevenLabs y va directo a Edge-TTS.
        """
        target_gender = self.determine_voice_gender(voice_gender, user_gender)

        # 1. Calibración de velocidad y estabilidad según estrés y perfil
        if stress_level is not None:
            if stress_level >= 0.80:
                speed = 0.80
                stability = 0.88
                style = 0.50
            elif stress_level >= 0.55:
                speed = 0.86
                stability = 0.80
                style = 0.45
            elif stress_level >= 0.30:
                speed = 0.92
                stability = 0.74
                style = 0.40
            else:
                speed = 0.98
                stability = 0.70
                style = 0.35
        else:
            if profile == "crisis_soothing":
                speed = 0.80
                stability = 0.88
                style = 0.50
            elif profile in ("zen", "anxiety_relief"):
                speed = 0.74 if profile == "zen" else 0.86
                stability = 0.90
                style = 0.20 if profile == "zen" else 0.45
            elif profile == "loving_psychologist":
                speed = 0.92
                stability = 0.75
                style = 0.45
            else:  # "cute"
                speed = 0.98
                stability = 0.68
                style = 0.40

        voice_settings = {
            "stability": stability,
            "similarity_boost": 0.90,
            "style": style,
            "use_speaker_boost": True,
        }

        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": voice_settings,
            "pronunciation_dictionary_locators": [],
            "speed": speed,
        }

        # Selección de voces según el género asignado
        if target_gender == "female":
            primary_voice = voice_id or FEMALE_VOICE_PRIMARY
            backup_voice_1 = FEMALE_VOICE_BACKUP
            edge_voice_name = EDGE_VOICE_FEMALE
        else:
            primary_voice = voice_id or MALE_VOICE_PRIMARY
            backup_voice_1 = MALE_VOICE_BACKUP
            edge_voice_name = EDGE_VOICE_MALE

        # 2. Si hay API key de ElevenLabs, el plan lo permite y no se ha
        # agotado la cuota, intentar en hilo separado
        if (
            premium_voice
            and self.api_key
            and len(self.api_key.strip()) > 5
            and not self.elevenlabs_quota_exceeded
        ):
            res_bytes = await asyncio.to_thread(self._call_elevenlabs, primary_voice, payload)
            if res_bytes:
                return res_bytes

            if not self.elevenlabs_quota_exceeded and primary_voice != backup_voice_1:
                res_bytes = await asyncio.to_thread(self._call_elevenlabs, backup_voice_1, payload)
                if res_bytes:
                    return res_bytes

        # 3. Respaldo Inmediato y Ultra-Rápido: Edge-TTS Neural (Calidad Estudio nativa)
        edge_bytes = await self._call_edge_tts_async(text, speed=speed, voice=edge_voice_name)
        if edge_bytes:
            return edge_bytes

        return None

    async def _call_edge_tts_async(
        self, text: str, speed: float = 0.92, voice: str = EDGE_VOICE_FEMALE
    ) -> bytes | None:
        """
        Sintetiza audio con Microsoft Edge Neural TTS en español de forma asíncrona sin bloqueos.
        """
        try:
            import edge_tts

            rate_pct = round((speed - 1.0) * 100)
            rate_str = f"{rate_pct:+d}%" if rate_pct != 0 else "+0%"
            pitch_str = "+3Hz" if voice == EDGE_VOICE_FEMALE else "-2Hz"

            communicate = edge_tts.Communicate(text, voice=voice, rate=rate_str, pitch=pitch_str)

            async def _collect() -> bytes:
                buf = bytearray()
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        buf.extend(chunk["data"])
                return bytes(buf)

            # El stream de Edge-TTS no tiene timeout propio: una conexión
            # colgada con Microsoft dejaba el request vivo para siempre.
            return await asyncio.wait_for(_collect(), timeout=8.0)
        except Exception as e:
            logger.error(f"Error en Edge-TTS: {e}")
            return None

    def _call_elevenlabs(self, v_id: str, payload: dict) -> bytes | None:
        if not self.api_key or self.elevenlabs_quota_exceeded:
            return None
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{v_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key.strip(),
        }
        try:
            req = urllib.request.Request(
                url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"
            )
            with urllib.request.urlopen(req, timeout=3.5) as response:  # noqa: S310 -- request construido arriba con URL fija https
                if response.status == 200:
                    return response.read()
                return None
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            if e.code == 401 and "quota_exceeded" in err_body:
                logger.warning(
                    "Cuota de ElevenLabs agotada. Edge-TTS durante ~1h (se reintenta tras cooldown)."
                )
                self._mark_quota_exceeded()
            else:
                logger.error(f"Error HTTP ElevenLabs ({v_id}): {e.code} - {err_body}")
            return None
        except Exception as e:
            logger.error(f"Error al conectar con ElevenLabs ({v_id}): {e}")
            return None


voice_service = VoiceService()
