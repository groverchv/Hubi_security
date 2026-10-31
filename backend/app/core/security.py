import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

logger = logging.getLogger("hubzy.security")

bearer_scheme = HTTPBearer(auto_error=False)
optional_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash seguro de contraseña con bcrypt (factor de costo por defecto 12)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(stored_password_hash: str, provided_password: str) -> bool:
    """Verifica contraseña contra hash bcrypt. Soporta migración desde sha256$salt legado."""
    try:
        if stored_password_hash.startswith("$2"):  # bcrypt
            return bcrypt.checkpw(
                provided_password.encode("utf-8"),
                stored_password_hash.encode("utf-8"),
            )
        # Migración: formato legado "salt$sha256"
        if "$" in stored_password_hash:
            import hashlib

            salt, expected_hash = stored_password_hash.split("$", 1)
            calculated = hashlib.sha256((salt + provided_password).encode("utf-8")).hexdigest()
            return secrets.compare_digest(calculated, expected_hash)
        return False
    except Exception:
        return False


def is_legacy_password_hash(stored_password_hash: str) -> bool:
    return bool(stored_password_hash) and not stored_password_hash.startswith("$2")


def create_access_token(user_id: str, email: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def create_purpose_token(user_id: str, email: str, purpose: str, expires_minutes: int) -> str:
    """Token firmado de un solo propósito (verify_email | reset_password)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
        "type": "purpose",
        "purpose": purpose,
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_purpose_token(token: str, expected_purpose: str) -> dict | None:
    """Decodifica un token de propósito; rechaza si el propósito no coincide."""
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "purpose":
        return None
    if payload.get("purpose") != expected_purpose:
        return None
    return payload


async def _try_consume_jti(jti: str) -> bool:
    """
    Marca un jti como consumido de forma atómica.
    True si es la primera vez que se usa; False si ya fue canjeado.
    """
    from app.core.database import db_manager
    from app.core.session_store import in_memory_consumed_tokens

    if db_manager.db is not None:
        try:
            await db_manager.db["consumed_tokens"].insert_one(
                {"jti": jti, "consumed_at": datetime.now(timezone.utc)}
            )
            return True
        except Exception:
            # DuplicateKeyError en el índice único de jti → token ya canjeado
            return False
    if jti in in_memory_consumed_tokens:
        return False
    in_memory_consumed_tokens.add(jti)
    return True


async def consume_purpose_token(token: str, expected_purpose: str) -> dict | None:
    """
    Decodifica un token de propósito y lo marca como consumido (un solo uso).
    Devuelve el payload si es válido y no fue canjeado antes; None en caso contrario.
    """
    payload = decode_purpose_token(token, expected_purpose)
    if not payload:
        return None
    jti = payload.get("jti")
    if not jti:
        # Token emitido antes de la introducción de jti: se acepta (expira pronto)
        return payload
    if not await _try_consume_jti(jti):
        return None
    return payload


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------
# Dependencias de autenticación
# ---------------------------------------------------------------------


async def _resolve_user(user_id: str) -> dict | None:
    """Busca al usuario en MongoDB y luego en el almacén en memoria (dev sin BD)."""
    from bson import ObjectId

    from app.core.database import db_manager
    from app.core.session_store import in_memory_auth_users

    if db_manager.db is not None:
        # ObjectId.is_valid evita el InvalidId de bson. Un fallo real de
        # MongoDB propaga como 500 en lugar de degradar silenciosamente a memoria.
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        user = await db_manager.db["users"].find_one(query)
        if user:
            user["id"] = str(user["_id"])
            # Auto-curación: docs antiguos con created_at inválido ("now", null,
            # o formato viejo) reciben una fecha real para que la prueba funcione.
            try:
                datetime.fromisoformat(str(user.get("created_at", "")).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                user["created_at"] = utcnow_iso()
                await db_manager.db["users"].update_one(
                    {"_id": user["_id"]},
                    {"$set": {"created_at": user["created_at"]}},
                )
            return user

    for u in in_memory_auth_users.values():
        if u.get("id") == user_id:
            return u
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Exige un JWT válido y retorna el documento del usuario autenticado."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await _resolve_user(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(optional_bearer),
) -> dict | None:
    """Retorna el usuario autenticado o None para flujos de invitado."""
    if credentials is None:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None
    return await _resolve_user(payload["sub"])


def resolve_effective_user_id(user: dict | None, requested_user_id: str | None) -> str:
    """
    Regla anti-IDOR: si hay sesión autenticada, el user_id SIEMPRE sale del token.
    Sin sesión, el invitado opera en el pool compartido 'default_user' — el cliente
    no puede reclamar un user_id ajeno (eso sería un IDOR anónimo).
    """
    if user:
        return str(user.get("id") or user.get("_id"))
    if requested_user_id in ("guest", "default_user"):
        return requested_user_id
    return "default_user"


def assert_can_access_user_resource(user: dict | None, resource_owner_id: str | None):
    """Con sesión activa, un usuario solo puede tocar recursos propios o del pool
    de invitados. Sin sesión, el invitado solo toca ese pool — jamás recursos de
    usuarios registrados o docentes."""
    if not user:
        if resource_owner_id and resource_owner_id not in ("default_user", "guest"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Necesitas una cuenta para acceder a este recurso.",
            )
        return
    uid = str(user.get("id") or user.get("_id"))
    if resource_owner_id and resource_owner_id not in (uid, "default_user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a este recurso.",
        )


def get_user_plan(user: dict | None) -> str:
    if not user:
        return "guest"
    return user.get("plan", "free")
