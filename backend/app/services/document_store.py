"""
Persistencia compartida de carpetas y documentos de estudio.

Centraliza la lógica que antes estaba duplicada entre routers:
- Query flexible de carpeta (ObjectId o id string).
- Carga de carpeta con error 503 estricto si Mongo configurada falla.
- Push de documento + INVALIDACIÓN de tableros cacheados (cached_board*):
  cualquier mutación de `documents` debe limpiar el caché de juegos,
  porque un doc nuevo/cambiado invalida los tableros generados antes.
- Cierre de race TOCTOU del límite freemium: insert → recount → rollback.
"""

import logging

from fastapi import HTTPException, status

from app.core.database import db_manager
from app.core.plans import enforce_storage_limit, get_limits
from app.core.security import get_user_plan, resolve_effective_user_id, utcnow_iso
from app.core.session_store import in_memory_study_folders

logger = logging.getLogger("hubzy.document_store")

_CACHE_FIELDS = (
    "cached_board",
    "cached_boards",
    "cached_board_hashes",
    "cached_content_hash",
)


def doc_size_bytes(doc: dict) -> int:
    """Bytes del documento: `size_bytes` nuevo o parseo del string legado 'X KB'."""
    raw = doc.get("size_bytes")
    if raw is not None:
        try:
            return int(raw)
        except (TypeError, ValueError):
            pass
    try:
        return int(float(str(doc.get("size", "")).split()[0]) * 1024)
    except (ValueError, IndexError):
        return 0


async def user_storage_bytes(user_id: str) -> int:
    """
    Suma los bytes de todos los documentos en las carpetas PERSONALES del
    usuario (las materias escolares las paga la institución — no cuentan).
    """
    total = 0
    if db_manager.db is not None:
        cursor = db_manager.db["study_folders"].find(
            {"user_id": user_id, "is_school_folder": {"$ne": True}},
            {"documents.size": 1, "documents.size_bytes": 1},
        )
        async for folder in cursor:
            for d in folder.get("documents", []):
                total += doc_size_bytes(d)
        return total
    for folder in in_memory_study_folders.values():
        if folder.get("user_id") == user_id and not folder.get("is_school_folder"):
            for d in folder.get("documents", []):
                total += doc_size_bytes(d)
    return total


def folder_query(folder_id: str) -> dict:
    try:
        from bson import ObjectId

        if len(folder_id) == 24:
            return {"_id": ObjectId(folder_id)}
    except Exception as oid_err:
        logger.debug(f"folder_id '{folder_id}' no es ObjectId válido: {oid_err}")
    return {"$or": [{"id": folder_id}, {"_id": folder_id}]}


async def load_folder(folder_id: str) -> dict | None:
    """Carga la carpeta completa. 503 si Mongo está configurada y falla."""
    if db_manager.db is not None:
        try:
            return await db_manager.db["study_folders"].find_one(folder_query(folder_id))
        except Exception as e:
            logger.error(f"Error consultando carpeta {folder_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e
    return in_memory_study_folders.get(folder_id)


def invalidate_folder_game_cache(folder_id: str) -> None:
    """Limpia el caché de tableros en el store en memoria (modo sin Mongo)."""
    folder = in_memory_study_folders.get(folder_id)
    if folder:
        for field in _CACHE_FIELDS:
            folder.pop(field, None)


async def persist_document_to_folder(
    folder_id: str,
    doc_record: dict,
    current_user: dict | None,
) -> None:
    """
    Inserta el documento en la carpeta e invalida los tableros cacheados.
    Cierra la race del límite freemium con push → recount → rollback + 402.
    """
    if db_manager.db is not None:
        try:
            await db_manager.db["study_folders"].update_one(
                folder_query(folder_id),
                {
                    "$push": {"documents": doc_record},
                    "$unset": dict.fromkeys(_CACHE_FIELDS, ""),
                },
            )
            limits = get_limits(get_user_plan(current_user))
            docs_limit = limits["max_docs_per_folder"]
            if docs_limit is not None:
                fresh = await db_manager.db["study_folders"].find_one(
                    folder_query(folder_id), {"documents": 1}
                )
                if fresh and len(fresh.get("documents", [])) > docs_limit:
                    await db_manager.db["study_folders"].update_one(
                        folder_query(folder_id),
                        {"$pull": {"documents": {"id": doc_record["id"]}}},
                    )
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail=f"Alcanzaste el límite de {docs_limit} documentos por carpeta del plan gratuito. Pasa a Hubzy Pro.",
                    )
            # Recuento post-push de la cuota de almacenamiento (race TOCTOU):
            # si otra subida concurrente llenó la cuenta, se revierte.
            storage_limit_mb = limits["max_storage_mb"]
            if storage_limit_mb is not None:
                owner = resolve_effective_user_id(current_user, None)
                used = await user_storage_bytes(owner)
                if used > storage_limit_mb * 1024 * 1024:
                    await db_manager.db["study_folders"].update_one(
                        folder_query(folder_id),
                        {"$pull": {"documents": {"id": doc_record["id"]}}},
                    )
                    enforce_storage_limit(
                        get_user_plan(current_user),
                        used - doc_size_bytes(doc_record),
                        doc_size_bytes(doc_record),
                    )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error guardando documento en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e
        return

    if folder_id in in_memory_study_folders:
        folder = in_memory_study_folders[folder_id]
        storage_limit_mb = get_limits(get_user_plan(current_user))["max_storage_mb"]
        if storage_limit_mb is not None and not folder.get("is_school_folder"):
            owner = folder.get("user_id") or resolve_effective_user_id(current_user, None)
            used = 0
            for f in in_memory_study_folders.values():
                if f.get("user_id") == owner and not f.get("is_school_folder"):
                    used += sum(doc_size_bytes(d) for d in f.get("documents", []))
            enforce_storage_limit(
                get_user_plan(current_user), used, doc_size_bytes(doc_record)
            )
        folder.setdefault("documents", []).append(doc_record)
        invalidate_folder_game_cache(folder_id)
    else:
        in_memory_study_folders[folder_id] = {
            "id": folder_id,
            "name": folder_id.replace("folder_", "").replace("_", " ").title(),
            "user_id": resolve_effective_user_id(current_user, None),
            "documents": [doc_record],
            "games": [],
            "created_at": utcnow_iso(),
        }
