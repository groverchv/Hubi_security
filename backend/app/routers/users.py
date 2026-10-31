import logging
import re

from fastapi import APIRouter, Depends, HTTPException

from app.core.age_bands import band_for_age, needs_parental_consent
from app.core.database import db_manager
from app.core.plans import trial_days_left
from app.core.security import get_current_user, utcnow_iso
from app.core.session_store import in_memory_auth_users, in_memory_study_folders
from app.models.user import UserProfileResponse, UserRegisterRequest
from app.routers.auth import assign_voice_gender
from app.services.rag_service import rag_service

logger = logging.getLogger("hubzy.users")
router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.post("/register", response_model=UserProfileResponse)
async def register_or_login_user(payload: UserRegisterRequest):
    """
    Flujo ligero (sin contraseña) para invitados: registra o actualiza un perfil
    con nombre, sexo y edad, y asigna el género de voz complementario de Hubzi.
    """
    clean_username = payload.username.strip()
    norm_gender = payload.gender.strip().lower()
    assigned_voice = assign_voice_gender(norm_gender, payload.voice_preference)
    age_band = band_for_age(payload.age)

    if needs_parental_consent(age_band) and not payload.parental_consent:
        raise HTTPException(
            status_code=400,
            detail="Las cuentas de menores de 11 años requieren el consentimiento de un padre, madre o tutor.",
        )

    user_doc = {
        "username": clean_username,
        "gender": norm_gender,
        "age": payload.age,
        "age_band": age_band,
        "avatar": payload.avatar or "capy_fan",
        "voice_preference": payload.voice_preference or "auto",
        "assigned_voice_gender": assigned_voice,
        "updated_at": utcnow_iso(),
    }

    if db_manager.db is not None:
        try:
            existing = await db_manager.db["users"].find_one(
                {
                    "username": {
                        "$regex": f"^{re.escape(clean_username)}$",
                        "$options": "i",
                    }
                }
            )
            if existing and existing.get("password_hash"):
                # Cuenta real con credenciales — jamás se toca desde el
                # registro de invitados (evita hijack del perfil ajeno).
                raise HTTPException(
                    status_code=409,
                    detail="Ese nombre pertenece a una cuenta registrada. Inicia sesión con tu correo.",
                )
            if existing:
                await db_manager.db["users"].update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "gender": norm_gender,
                            "age": payload.age,
                            "assigned_voice_gender": assigned_voice,
                            "avatar": payload.avatar or existing.get("avatar", "capy_fan"),
                            "voice_preference": payload.voice_preference
                            or existing.get("voice_preference", "auto"),
                        }
                    },
                )
                existing_id = str(existing["_id"])
                return UserProfileResponse(
                    id=existing_id,
                    username=existing["username"],
                    gender=norm_gender,
                    age=payload.age,
                    age_band=age_band,
                    avatar=payload.avatar or existing.get("avatar", "capy_fan"),
                    voice_preference=payload.voice_preference
                    or existing.get("voice_preference", "auto"),
                    assigned_voice_gender=assigned_voice,
                    created_at=str(existing.get("created_at", "")),
                )

            user_doc["created_at"] = utcnow_iso()
            res = await db_manager.db["users"].insert_one(user_doc)
            user_doc["id"] = str(res.inserted_id)
            return UserProfileResponse(**user_doc)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error registrando usuario en MongoDB: {e}")
            raise HTTPException(
                status_code=503,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e

    import hashlib

    fallback_id = f"user_{hashlib.md5(clean_username.lower().encode()).hexdigest()[:8]}"
    return UserProfileResponse(
        id=fallback_id,
        username=clean_username,
        gender=norm_gender,
        age=payload.age,
        avatar=payload.avatar or "capy_fan",
        voice_preference=payload.voice_preference or "auto",
        assigned_voice_gender=assigned_voice,
        created_at=utcnow_iso(),
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Perfil del usuario autenticado (desde JWT)."""
    user_id = str(current_user.get("id") or current_user.get("_id"))
    age = current_user.get("age") or 20  # tolera age=None en docs legacy
    plan = current_user.get("plan", "free")
    return UserProfileResponse(
        id=user_id,
        email=current_user.get("email"),
        username=current_user.get("username", "Estudiante"),
        gender=current_user.get("gender", "masculino"),
        age=age,
        age_band=current_user.get("age_band") or band_for_age(age),
        avatar=current_user.get("avatar", "capy_fan"),
        voice_preference=current_user.get("voice_preference", "auto"),
        assigned_voice_gender=current_user.get("assigned_voice_gender", "female"),
        created_at=str(current_user.get("created_at", "")),
        plan=plan,
        pro_since=current_user.get("pro_since"),
        trial_days_left=(
            trial_days_left(str(current_user.get("created_at", "")))
            if plan == "free"
            else None
        ),
    )


@router.get("/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Obtiene el perfil del usuario — solo el propio perfil autenticado."""
    uid = str(current_user.get("id") or current_user.get("_id"))
    if user_id != uid:
        raise HTTPException(status_code=403, detail="Solo puedes consultar tu propio perfil.")
    return await get_my_profile(current_user)


@router.delete("/me")
async def delete_my_account(current_user: dict = Depends(get_current_user)):
    """
    Elimina la cuenta del usuario autenticado y todos sus datos asociados
    (carpetas, documentos y vectores RAG). Requisito de privacidad para datos
    sensibles: el usuario siempre puede ejercer su derecho de supresión.
    """
    uid = str(current_user.get("id") or current_user.get("_id"))
    email = (current_user.get("email") or "").strip().lower()
    deleted = {"folders": 0, "vectors": 0, "user": False}

    # 1. Vectores RAG de los documentos del usuario (mejor esfuerzo)
    folder_ids = []
    if db_manager.db is not None:
        try:
            async for f in db_manager.db["study_folders"].find(
                {"user_id": uid}, {"documents.id": 1}
            ):
                folder_ids.append(str(f["_id"]))
                for doc in f.get("documents", []):
                    if doc.get("id"):
                        await rag_service.delete_document_vectors(doc["id"])
                        deleted["vectors"] += 1
        except Exception as e:
            logger.warning(f"Error limpiando vectores RAG del usuario {uid}: {e}")

    for f in in_memory_study_folders.values():
        if f.get("user_id") == uid:
            for doc in f.get("documents", []):
                if doc.get("id"):
                    await rag_service.delete_document_vectors(doc["id"])
                    deleted["vectors"] += 1

    # 2. Carpetas del usuario — si falla con BD configurada se aborta:
    # una supresión parcial silenciosa viola el derecho de supresión.
    if db_manager.db is not None:
        try:
            res = await db_manager.db["study_folders"].delete_many({"user_id": uid})
            deleted["folders"] += res.deleted_count
        except Exception as e:
            logger.error(f"Error eliminando carpetas del usuario {uid}: {e}")
            raise HTTPException(
                status_code=500,
                detail="No se pudo completar la eliminación de tus datos. Intenta de nuevo.",
            ) from e

    mem_folder_ids = [fid for fid, f in in_memory_study_folders.items() if f.get("user_id") == uid]
    for fid in mem_folder_ids:
        del in_memory_study_folders[fid]
        deleted["folders"] += 1

    # 3. El usuario
    if db_manager.db is not None:
        try:
            from bson import ObjectId

            query = {"_id": ObjectId(uid)} if ObjectId.is_valid(uid) else {"id": uid}
            res = await db_manager.db["users"].delete_one(query)
            deleted["user"] = deleted["user"] or res.deleted_count > 0
        except Exception as e:
            logger.error(f"Error eliminando usuario {uid} de MongoDB: {e}")
            raise HTTPException(
                status_code=500,
                detail="No se pudo completar la eliminación de tu cuenta. Intenta de nuevo.",
            ) from e

    if email and email in in_memory_auth_users:
        del in_memory_auth_users[email]
        deleted["user"] = True
    else:
        for key, u in list(in_memory_auth_users.items()):
            if u.get("id") == uid:
                del in_memory_auth_users[key]
                deleted["user"] = True

    logger.info(
        f"Cuenta eliminada: user={uid} folders={deleted['folders']} vectors={deleted['vectors']}"
    )
    return {"status": "account_deleted", "deleted": deleted}


@router.get("/me/export")
async def export_my_data(current_user: dict = Depends(get_current_user)):
    """
    Portabilidad de datos: devuelve TODO lo que el sistema guarda del usuario
    autenticado en un solo JSON descargable (perfil, carpetas con documentos,
    dominio de habilidades BKT). Sin campos internos sensibles como el hash.
    """
    uid = str(current_user.get("id") or current_user.get("_id"))

    profile = {
        "id": uid,
        "email": current_user.get("email"),
        "username": current_user.get("username"),
        "gender": current_user.get("gender"),
        "age_band": current_user.get("age_band"),
        "plan": current_user.get("plan", "free"),
        "email_verified": current_user.get("email_verified", False),
        "created_at": str(current_user.get("created_at", "")),
    }

    # Con BD configurada un fallo aborta: una exportación parcial silenciosa
    # incumpliría la promesa de portabilidad completa.
    folders = []
    if db_manager.db is not None:
        try:
            async for f in db_manager.db["study_folders"].find({"user_id": uid}):
                f.pop("_id", None)
                folders.append(f)
        except Exception as e:
            logger.error(f"Error exportando carpetas del usuario {uid}: {e}")
            raise HTTPException(
                status_code=500, detail="No se pudo completar la exportación. Intenta de nuevo."
            ) from e
    else:
        for f in in_memory_study_folders.values():
            if f.get("user_id") == uid:
                folders.append(f)

    skills = []
    if db_manager.db is not None:
        try:
            async for s in db_manager.db["skill_mastery"].find({"user_id": uid}):
                s.pop("_id", None)
                skills.append(s)
        except Exception as e:
            logger.error(f"Error exportando habilidades del usuario {uid}: {e}")
            raise HTTPException(
                status_code=500, detail="No se pudo completar la exportación. Intenta de nuevo."
            ) from e

    return {
        "exported_at": utcnow_iso(),
        "profile": profile,
        "folders": folders,
        "skill_mastery": skills,
        "note": "Exportación completa de tus datos personales en Hubzy.",
    }
