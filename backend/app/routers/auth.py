import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.age_bands import band_for_age, needs_parental_consent
from app.core.database import db_manager
from app.core.plans import trial_days_left
from app.core.rate_limit import limiter
from app.core.security import (
    consume_purpose_token,
    create_access_token,
    create_purpose_token,
    get_current_user,
    hash_password,
    is_legacy_password_hash,
    utcnow_iso,
    verify_password,
)
from app.core.session_store import in_memory_auth_users
from app.models.user import (
    AuthResponse,
    UserAuthLoginRequest,
    UserAuthRegisterRequest,
    UserProfileResponse,
)
from app.services import email_service

logger = logging.getLogger("hubzy.auth")
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


def assign_voice_gender(gender: str, voice_preference: str | None = None) -> str:
    """Regla de voz complementaria de Hubzi: hombre→voz femenina, mujer→voz masculina."""
    if voice_preference and voice_preference in ("female", "male"):
        return voice_preference
    norm = (gender or "").strip().lower()
    if norm in ("masculino", "hombre", "varon"):
        return "female"
    if norm in ("femenino", "mujer", "dama"):
        return "male"
    return "female"


def _to_profile(user_id: str, doc: dict) -> UserProfileResponse:
    age = doc.get("age") or 20  # legacy docs con age=None no rompen el perfil
    plan = doc.get("plan", "free")
    return UserProfileResponse(
        id=user_id,
        email=doc.get("email"),
        username=doc.get("username", "Estudiante"),
        gender=doc.get("gender", "masculino"),
        age=age,
        age_band=doc.get("age_band") or band_for_age(age),
        avatar=doc.get("avatar", "capy_fan"),
        voice_preference=doc.get("voice_preference", "auto"),
        assigned_voice_gender=doc.get("assigned_voice_gender", "female"),
        created_at=str(doc.get("created_at", "")),
        plan=plan,
        pro_since=doc.get("pro_since"),
        trial_days_left=(
            trial_days_left(str(doc.get("created_at", "")))
            if plan == "free"
            else None
        ),
    )


@router.post("/register", response_model=AuthResponse)
@limiter.limit("10/minute")
async def auth_register(request: Request, payload: UserAuthRegisterRequest):
    """
    Registra una nueva cuenta con correo, contraseña (bcrypt), nombre, sexo y edad.
    Devuelve un JWT de acceso.
    """
    clean_email = payload.email.strip().lower()
    clean_username = payload.username.strip()
    norm_gender = payload.gender.strip().lower()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=400, detail="Por favor ingresa un correo electrónico válido."
        )

    age_band = band_for_age(payload.age)
    if needs_parental_consent(age_band) and not payload.parental_consent:
        raise HTTPException(
            status_code=400,
            detail="Las cuentas de menores de 11 años requieren el consentimiento de un padre, madre o tutor.",
        )

    assigned_voice = assign_voice_gender(norm_gender, payload.voice_preference)
    pwd_hash = hash_password(payload.password)

    user_doc = {
        "email": clean_email,
        "password_hash": pwd_hash,
        "username": clean_username,
        "gender": norm_gender,
        "age": payload.age,
        "age_band": age_band,
        "parental_consent": bool(payload.parental_consent)
        if needs_parental_consent(age_band)
        else None,
        "consented_at": utcnow_iso() if payload.parental_consent else None,
        "avatar": payload.avatar or "capy_fan",
        "voice_preference": payload.voice_preference or "auto",
        "assigned_voice_gender": assigned_voice,
        "plan": "free",
        "email_verified": False,
        "created_at": utcnow_iso(),
    }

    user_id = None
    if db_manager.db is not None:
        from pymongo.errors import DuplicateKeyError

        try:
            existing = await db_manager.db["users"].find_one({"email": clean_email})
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe una cuenta registrada con este correo electrónico.",
                )
            res = await db_manager.db["users"].insert_one(user_doc)
            user_id = str(res.inserted_id)
        except HTTPException:
            raise
        except DuplicateKeyError:
            # Race check-then-insert: el índice único de email es la última línea
            raise HTTPException(
                status_code=400,
                detail="Ya existe una cuenta registrada con este correo electrónico.",
            ) from None
        except Exception as e:
            logger.error(f"Error registrando en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e

    if user_id is None:
        if clean_email in in_memory_auth_users:
            raise HTTPException(
                status_code=400,
                detail="Ya existe una cuenta registrada con este correo electrónico.",
            )
        user_id = f"user_{hashlib.md5(clean_email.encode()).hexdigest()[:10]}"
        in_memory_auth_users[clean_email] = {**user_doc, "id": user_id}

    token = create_access_token(user_id, clean_email)

    # Email de verificación (fire-and-forget: nunca bloquea el registro)
    verify_token = create_purpose_token(user_id, clean_email, "verify_email", 60 * 24)
    await email_service.send_verification_email(clean_email, clean_username, verify_token)

    return AuthResponse(token=token, user=_to_profile(user_id, user_doc))


@router.post("/login", response_model=AuthResponse)
@limiter.limit("15/minute")
async def auth_login(request: Request, payload: UserAuthLoginRequest):
    """Inicia sesión con correo y contraseña. Devuelve JWT + perfil."""
    clean_email = payload.email.strip().lower()

    user_data = None
    user_id = None
    user_from_mongo = False

    if db_manager.db is not None:
        try:
            user_db = await db_manager.db["users"].find_one({"email": clean_email})
            if user_db:
                user_data = user_db
                user_id = str(user_db["_id"])
                user_from_mongo = True
        except Exception as e:
            logger.error(f"Error buscando usuario en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e

    if not user_data and clean_email in in_memory_auth_users:
        user_data = in_memory_auth_users[clean_email]
        user_id = user_data.get("id")

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas. No existe una cuenta con este correo.",
        )

    stored_hash = user_data.get("password_hash")
    if not stored_hash or not verify_password(stored_hash, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta. Por favor verifica tus credenciales.",
        )

    # Migración transparente: si el hash es sha256 legado, re-hashear con bcrypt
    if is_legacy_password_hash(stored_hash):
        try:
            new_hash = hash_password(payload.password)
            if user_from_mongo and db_manager.db is not None:
                from bson import ObjectId

                await db_manager.db["users"].update_one(
                    {"_id": ObjectId(user_id)}, {"$set": {"password_hash": new_hash}}
                )
            elif clean_email in in_memory_auth_users:
                in_memory_auth_users[clean_email]["password_hash"] = new_hash
            logger.info(f"Hash de contraseña migrado a bcrypt para {clean_email}")
        except Exception as e:
            logger.warning(f"No se pudo migrar hash legado: {e}")

    token = create_access_token(user_id, clean_email)
    return AuthResponse(token=token, user=_to_profile(user_id, user_data))


@router.get("/me", response_model=UserProfileResponse)
async def auth_get_current_user(current_user: dict = Depends(get_current_user)):
    """Retorna el perfil del usuario autenticado según su JWT."""
    return _to_profile(str(current_user.get("id") or current_user.get("_id")), current_user)


# ---------------------------------------------------------------------
# Flujos de email: verificación de cuenta y recuperación de contraseña
# ---------------------------------------------------------------------


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10)


async def _find_user_by_email(clean_email: str) -> tuple[dict | None, str | None]:
    """Busca usuario por email en Mongo o memoria. Devuelve (doc, user_id)."""
    if db_manager.db is not None:
        doc = await db_manager.db["users"].find_one({"email": clean_email})
        if doc:
            return doc, str(doc["_id"])
        return None, None
    if clean_email in in_memory_auth_users:
        doc = in_memory_auth_users[clean_email]
        return doc, doc.get("id")
    return None, None


async def _update_user(user_id: str, clean_email: str, updates: dict) -> None:
    """Aplica un $set al usuario en Mongo o en el store en memoria."""
    if db_manager.db is not None:
        from bson import ObjectId

        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await db_manager.db["users"].update_one(query, {"$set": updates})
        return
    if clean_email in in_memory_auth_users:
        in_memory_auth_users[clean_email].update(updates)


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def auth_forgot_password(request: Request, payload: ForgotPasswordRequest):
    """
    Inicia el flujo de recuperación. SIEMPRE responde 200 — no revela
    si el correo existe (anti-enumeración de cuentas).
    """
    clean_email = payload.email.strip().lower()
    if "@" not in clean_email:
        # Respuesta genérica también aquí — no confirmamos formato ni existencia
        return {
            "status": "ok",
            "detail": "Si el correo existe, recibirás un enlace de recuperación.",
        }
    user_doc, user_id = await _find_user_by_email(clean_email)

    if user_doc and user_id:
        token = create_purpose_token(user_id, clean_email, "reset_password", 60)
        await email_service.send_password_reset_email(
            clean_email, user_doc.get("username", "Estudiante"), token
        )

    return {"status": "ok", "detail": "Si el correo existe, recibirás un enlace de recuperación."}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def auth_reset_password(request: Request, payload: ResetPasswordRequest):
    """Canjea el token de recuperación por una contraseña nueva (un solo uso)."""
    data = await consume_purpose_token(payload.token, "reset_password")
    if not data:
        raise HTTPException(
            status_code=400, detail="El enlace es inválido, expiró o ya fue utilizado."
        )

    clean_email = (data.get("email") or "").strip().lower()
    await _update_user(
        data["sub"], clean_email, {"password_hash": hash_password(payload.new_password)}
    )
    logger.info(f"Contraseña restablecida para {clean_email}")
    return {"status": "ok", "detail": "Contraseña actualizada. Ya puedes iniciar sesión."}


@router.post("/verify-email")
@limiter.limit("10/minute")
async def auth_verify_email(request: Request, payload: VerifyEmailRequest):
    """Confirma el correo del usuario con el token enviado al registrarse (un solo uso)."""
    data = await consume_purpose_token(payload.token, "verify_email")
    if not data:
        raise HTTPException(
            status_code=400,
            detail="El enlace de verificación es inválido, expiró o ya fue utilizado.",
        )

    clean_email = (data.get("email") or "").strip().lower()
    await _update_user(data["sub"], clean_email, {"email_verified": True})
    return {"status": "ok", "detail": "Correo verificado correctamente."}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def auth_resend_verification(
    request: Request, current_user: dict = Depends(get_current_user)
):
    """Reenvía el email de verificación al usuario autenticado."""
    if current_user.get("email_verified"):
        return {"status": "ok", "detail": "Tu correo ya está verificado."}

    user_id = str(current_user.get("id") or current_user.get("_id"))
    email = (current_user.get("email") or "").strip().lower()
    token = create_purpose_token(user_id, email, "verify_email", 60 * 24)
    await email_service.send_verification_email(
        email, current_user.get("username", "Estudiante"), token
    )
    return {"status": "ok", "detail": "Email de verificación reenviado."}
