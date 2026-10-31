import asyncio
import hashlib
import logging
import random
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.prompt_guard import (
    fence_untrusted,
    guard_model_fragments,
    guard_system,
    injection_fragments,
)
from app.core.database import db_manager
from app.core.plans import (
    enforce_docs_limit,
    enforce_folder_limit,
    enforce_question_limit,
    enforce_storage_limit,
    get_limits,
)
from app.core.rate_limit import limiter
from app.core.security import (
    assert_can_access_user_resource,
    get_optional_user,
    get_user_plan,
    resolve_effective_user_id,
    utcnow_iso,
)
from app.core.session_store import in_memory_study_folders
from app.routers.arena import MAX_FILE_SIZE, _validate_upload, summarize_and_store
from app.routers.institutions import (
    delete_student_progress,
    get_student_progress_doc,
    in_memory_student_progress,
    save_student_progress,
)
from app.schemas.schemas import GameBoardResponse, GenerateBoardRequest
from app.services.ai_service import CAMPAIGN_MAX_LEVEL, _level_info, ai_service
from app.services.board_service import generate_board, generate_boards_batch
from app.services.document_store import (
    folder_query as _folder_query,
)
from app.services.document_store import (
    invalidate_folder_game_cache,
    persist_document_to_folder,
    user_storage_bytes,
)
from app.services.document_store import (
    load_folder as _load_folder,
)
from app.services.job_service import create_job, execute_job, stage_updater
from app.services.llm_telemetry import (
    record_groq_usage,
    usage_elapsed_ms,
    usage_started,
)
from app.services.rag_service import rag_service
from app.services.topic_detector import (
    _similar,
    detect_document_topics,
    get_island_text,
    rebuild_islands,
)

logger = logging.getLogger("hubzy.folders")
router = APIRouter(prefix="/api/v1/folders", tags=["Folders"])

# Referencias a tareas de generación en background — evita que el GC
# las recolecte antes de terminar (RUF006).
_BACKGROUND_TASKS: set[asyncio.Task] = set()


class FolderCreateRequest(BaseModel):
    name: str
    description: str | None = "Carpeta de estudio"
    icon: str | None = "folder"
    color: str | None = "emerald"
    user_id: str | None = None  # ignorado si hay sesión autenticada


@router.get("")
async def list_folders(
    user_id: str | None = Query(None, description="Solo para invitados sin sesión"),
    current_user: dict | None = Depends(get_optional_user),
):
    """Retorna las carpetas del usuario efectivo (del token si hay sesión).
    Estudiantes de colegios: incluye las materias (carpetas) de sus grados."""
    effective_uid = resolve_effective_user_id(current_user, user_id)
    grade_ids = list((current_user or {}).get("grade_ids") or [])
    folders = []
    projection = {
        "documents.text": 0,
        "documents.full_text": 0,
        "documents.extracted_text": 0,
        "cached_board": 0,
        "cached_boards": 0,
        "_island_progress_graveyard": 0,
    }
    if db_manager.db is not None:
        try:
            query: dict = {"$or": [{"user_id": effective_uid}]}
            if grade_ids:
                query["$or"].append({"grade_id": {"$in": grade_ids}, "is_school_folder": True})
            cursor = db_manager.db["study_folders"].find(query, projection).sort("_id", -1)
            async for doc in cursor:
                doc["id"] = str(doc["_id"])
                del doc["_id"]
                folders.append(doc)
        except Exception as e:
            logger.error(f"Error listando carpetas de MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e

    if not folders and in_memory_study_folders:
        for f in in_memory_study_folders.values():
            is_own = f.get("user_id") == effective_uid
            is_grade_materia = f.get("is_school_folder") and f.get("grade_id") in grade_ids
            if is_own or is_grade_materia:
                folders.append(
                    {
                        k: v
                        for k, v in f.items()
                        if k
                        not in (
                            "cached_board",
                            "cached_boards",
                            "_island_progress_graveyard",
                        )
                    }
                )

    # Carpetas escolares compartidas: inyectar el progreso DE ESTE estudiante
    # (el doc no puede llevar campaign_progress global — es por usuario).
    if effective_uid:
        for doc in folders:
            if not doc.get("is_school_folder"):
                continue
            prog = await get_student_progress_doc(doc["id"], effective_uid, None)
            if prog:
                doc["campaign_progress"] = prog
            for isl in doc.get("islands") or []:
                iprog = await get_student_progress_doc(doc["id"], effective_uid, isl["id"])
                if iprog:
                    isl["campaign_progress"] = iprog

    # Uso de almacenamiento de la cuenta (cuota freemium, para la UI)
    used_bytes = 0
    if effective_uid:
        try:
            used_bytes = await user_storage_bytes(effective_uid)
        except Exception as e:
            logger.warning(f"No se pudo calcular almacenamiento de {effective_uid}: {e}")
    plan = get_user_plan(current_user)
    return {
        "folders": folders,
        "plan": plan,
        "storage_used_mb": round(used_bytes / 1024 / 1024, 2),
        "storage_limit_mb": get_limits(plan)["max_storage_mb"],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreateRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    """Crea una carpeta de estudio vinculada al usuario efectivo."""
    effective_uid = resolve_effective_user_id(current_user, payload.user_id)

    # Límite freemium (aplica con Mongo o con el almacén en memoria)
    plan = get_user_plan(current_user)
    try:
        if db_manager.db is not None:
            current_count = await db_manager.db["study_folders"].count_documents(
                {"user_id": effective_uid}
            )
        else:
            current_count = sum(
                1 for f in in_memory_study_folders.values() if f.get("user_id") == effective_uid
            )
        enforce_folder_limit(plan, current_count)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"No se pudo verificar límite de carpetas: {e}")

    folder_id = f"folder_{payload.name.lower().replace(' ', '_')}_{secrets.token_hex(4)}"
    new_folder = {
        "id": folder_id,
        "name": payload.name,
        "description": payload.description,
        "icon": payload.icon or "folder",
        "color": payload.color or "emerald",
        "user_id": effective_uid,
        "created_at": utcnow_iso(),
        "documents": [],
        "games": [],
    }
    if db_manager.db is not None:
        try:
            res = await db_manager.db["study_folders"].insert_one(dict(new_folder))
            new_folder["id"] = str(res.inserted_id)

            # Cierre de la race TOCTOU: recontar tras insertar; si dos requests
            # concurrentes pasaron el check previo, el que exceda revierte.
            post_count = await db_manager.db["study_folders"].count_documents(
                {"user_id": effective_uid}
            )
            if (
                get_limits(plan)["max_folders"] is not None
                and post_count > get_limits(plan)["max_folders"]
            ):
                await db_manager.db["study_folders"].delete_one({"_id": res.inserted_id})
                enforce_folder_limit(plan, post_count - 1)

            new_folder.pop("_id", None)
            return new_folder
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error guardando carpeta en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e

    in_memory_study_folders[new_folder["id"]] = new_folder
    return new_folder


# Campos que un doc declarado por cliente puede llevar — jamás contenido
# extraído o secciones (eso lo produce el pipeline de extracción real).
_DOC_ALLOWED_KEYS = {"name", "size", "type", "id", "uploaded_at", "pages"}


class AddDocsToFolderRequest(BaseModel):
    documents: list[dict] = Field(default_factory=list, max_length=20)


@router.post("/{folder_id}/documents")
async def add_documents_to_folder(
    folder_id: str,
    payload: AddDocsToFolderRequest,
    background_tasks: BackgroundTasks,
    current_user: dict | None = Depends(get_optional_user),
):
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    assert_can_access_user_resource(current_user, folder_doc.get("user_id"))
    effective_plan = (
        "school" if folder_doc.get("is_school_folder") else get_user_plan(current_user)
    )
    enforce_docs_limit(
        effective_plan,
        len(folder_doc.get("documents", [])) + len(payload.documents) - 1,
    )

    clean_docs = [
        {k: v for k, v in (d or {}).items() if k in _DOC_ALLOWED_KEYS and isinstance(v, (str, int, float, bool))}
        for d in payload.documents
    ]
    clean_docs = [d for d in clean_docs if isinstance(d.get("name"), str) and d["name"].strip()]
    if not clean_docs:
        raise HTTPException(status_code=400, detail="No llegaron documentos válidos.")

    if db_manager.db is not None:
        try:
            res = await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id),
                {
                    "$push": {"documents": {"$each": clean_docs}},
                    "$unset": {
                        "cached_board": "",
                        "cached_boards": "",
                        "cached_board_hashes": "",
                        "cached_content_hash": "",
                    },
                },
            )
            if res.matched_count == 0:
                raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
            # Detectar temas de cada doc nuevo → reconstruye islas de la carpeta.
            for d in clean_docs:
                if d.get("id"):
                    background_tasks.add_task(detect_topics_and_store, folder_id, d["id"])
            return {"status": "documents_added", "count": len(clean_docs)}
        except Exception as e:
            logger.error(f"Error agregando documentos a carpeta en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e

    if folder_id in in_memory_study_folders:
        in_memory_study_folders[folder_id].setdefault("documents", []).extend(clean_docs)
        invalidate_folder_game_cache(folder_id)
        for d in clean_docs:
            if d.get("id"):
                background_tasks.add_task(detect_topics_and_store, folder_id, d["id"])
        return {"status": "documents_added", "count": len(clean_docs)}
    return {"status": "acknowledged"}


class AddGameToFolderRequest(BaseModel):
    game: dict


@router.post("/{folder_id}/games")
async def add_game_to_folder(
    folder_id: str,
    payload: AddGameToFolderRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    folder_doc = await _load_folder(folder_id)
    if folder_doc:
        assert_can_access_user_resource(current_user, folder_doc.get("user_id"))
    if db_manager.db is not None:
        try:
            await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id), {"$push": {"games": payload.game}}
            )
            return {"status": "game_added"}
        except Exception as e:
            logger.error(f"Error agregando juego a carpeta en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e

    if folder_id in in_memory_study_folders:
        in_memory_study_folders[folder_id].setdefault("games", []).append(payload.game)
        return {"status": "game_added"}
    return {"status": "acknowledged"}


# ---------------------------------------------------------------------
# Progreso de campaña (estrellas, nivel desbloqueado y nivel actual)
# ---------------------------------------------------------------------


class CampaignProgressRequest(BaseModel):
    unlocked_level: int | None = None
    current_level: int | None = None
    level_stars: dict[str, int] | None = None
    xp_gained: int | None = None  # puntos ganados en esta ronda → se acumulan
    island_id: str | None = None  # None = campaña general de la carpeta
    total_levels: int | None = None  # campañas cortas (islas): meta de niveles
    study_date: str | None = None  # fecha local del cliente 'YYYY-MM-DD' (racha)


def _assert_folder_access(current_user: dict | None, folder_doc: dict) -> None:
    """Dueño de la carpeta, o estudiante matriculado en el grado si la
    carpeta es una materia escolar compartida."""
    if folder_doc.get("is_school_folder") and current_user:
        uid = str(current_user.get("id") or current_user.get("_id") or "")
        if folder_doc.get("grade_id") in (current_user.get("grade_ids") or []):
            return
        if uid and uid == str(folder_doc.get("user_id") or ""):
            return
        raise HTTPException(
            status_code=403,
            detail="Esta materia pertenece a un grado al que no estás matriculado.",
        )
    assert_can_access_user_resource(current_user, folder_doc.get("user_id"))


def _merge_campaign_progress(prev: dict | None, payload: CampaignProgressRequest) -> dict:
    """
    Merge 'max-wins': estrellas y nivel desbloqueado nunca retroceden, así
    dos pestañas o guardados fuera de orden no se pisan. `current_level`
    es estado de navegación → gana la última escritura.
    """
    prev = prev or {}
    stars = dict(prev.get("level_stars") or {})
    for k, v in (payload.level_stars or {}).items():
        try:
            lvl = int(k)
            s = int(v)
        except (TypeError, ValueError):
            continue
        if 1 <= lvl <= 20:
            stars[str(lvl)] = max(stars.get(str(lvl), 0), max(0, min(3, s)))

    unlocked_in = payload.unlocked_level
    unlocked = max(
        prev.get("unlocked_level", 1),
        max(1, min(20, unlocked_in)) if unlocked_in is not None else 1,
    )
    current_in = payload.current_level
    current = (
        max(1, min(20, current_in)) if current_in is not None else prev.get("current_level", 1)
    )
    completed = sum(1 for s in stars.values() if s >= 1)
    # XP acumulativa: cada nivel completado suma sus puntos al total histórico
    total_xp = max(0, int(prev.get("total_xp") or 0))
    if payload.xp_gained:
        total_xp += max(0, int(payload.xp_gained))

    # Streak diario suave (estilo Duolingo sin ansiedad): celebra días
    # seguidos de estudio — solo sube o se reinicia, nunca avisa ni castiga.
    # La fecha la manda el cliente (su día local): con UTC fijo, estudiar a
    # las 23:30 en Bolivia (UTC-4) cruzaba la medianoche UTC a media sesión
    # y la racha se contaba contra el día equivocado.
    utc_today = datetime.now(timezone.utc).date()
    today = utc_today.isoformat()
    if payload.study_date:
        try:
            client_date = datetime.strptime(payload.study_date.strip(), "%Y-%m-%d").date()
            # Sin fecha futura respecto al servidor (margen: zonas UTC+14).
            if client_date <= utc_today + timedelta(days=1):
                today = client_date.isoformat()
        except ValueError:
            pass
    last_date = prev.get("last_study_date")
    study_streak = int(prev.get("study_streak") or 0)
    total_days = int(prev.get("total_study_days") or 0)
    if last_date != today:
        yesterday = (
            datetime.strptime(today, "%Y-%m-%d").date() - timedelta(days=1)
        ).isoformat()
        study_streak = study_streak + 1 if last_date == yesterday else 1
        total_days += 1
        last_date = today

    # La meta de niveles se PERSISTE: sin esto, un guardado posterior sin
    # total_levels hacía regresar campaign_completed de True a False.
    total_levels = max(1, min(20, payload.total_levels or prev.get("total_levels") or 20))

    return {
        "unlocked_level": unlocked,
        "current_level": current,
        "level_stars": stars,
        "levels_completed": completed,
        # Islas con menos de 20 niveles completan su campaña en su propio total
        "campaign_completed": completed >= total_levels,
        "total_levels": total_levels,
        "total_xp": total_xp,
        "study_streak": study_streak,
        "last_study_date": last_date,
        "total_study_days": total_days,
        "last_played_at": utcnow_iso(),
    }


@router.put("/{folder_id}/campaign-progress")
@limiter.limit("30/minute")
async def save_campaign_progress(
    request: Request,
    folder_id: str,
    payload: CampaignProgressRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Persiste el progreso de la campaña de 20 niveles dentro del documento de
    la carpeta. Vive independiente de `cached_boards`: invalidar tableros por
    cambios en los apuntes NO borra los logros del jugador.
    """
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    _assert_folder_access(current_user, folder_doc)

    # Carpeta escolar compartida → progreso por estudiante (colección aparte)
    if folder_doc.get("is_school_folder") and current_user:
        uid = str(current_user.get("id") or current_user.get("_id"))
        prev = await get_student_progress_doc(folder_id, uid, payload.island_id)
        progress = _merge_campaign_progress(prev, payload)
        await save_student_progress(folder_id, uid, payload.island_id, progress)
        return {"status": "progress_saved", "campaign_progress": progress}

    # Progreso por isla: vive dentro de islands[i].campaign_progress
    if payload.island_id:
        islands = folder_doc.get("islands") or []
        island = next((i for i in islands if i.get("id") == payload.island_id), None)
        if not island:
            raise HTTPException(status_code=404, detail="Isla no encontrada.")
        progress = _merge_campaign_progress(island.get("campaign_progress"), payload)

        if db_manager.db is not None:
            try:
                await db_manager.db["study_folders"].update_one(
                    {**_folder_query(folder_id), "islands.id": payload.island_id},
                    {"$set": {"islands.$.campaign_progress": progress}},
                )
            except Exception as e:
                logger.error(f"Error guardando progreso de isla en MongoDB: {e}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Servicio de base de datos no disponible. Intenta de nuevo.",
                ) from e
        else:
            if folder_id in in_memory_study_folders:
                for i in in_memory_study_folders[folder_id].get("islands", []):
                    if i.get("id") == payload.island_id:
                        i["campaign_progress"] = progress
        return {"status": "progress_saved", "campaign_progress": progress}

    progress = _merge_campaign_progress(folder_doc.get("campaign_progress"), payload)

    if db_manager.db is not None:
        try:
            await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id), {"$set": {"campaign_progress": progress}}
            )
        except Exception as e:
            logger.error(f"Error guardando progreso de campaña en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e
    else:
        if folder_id in in_memory_study_folders:
            in_memory_study_folders[folder_id]["campaign_progress"] = progress

    return {"status": "progress_saved", "campaign_progress": progress}


@router.delete("/{folder_id}/campaign-progress")
async def reset_campaign_progress(
    folder_id: str,
    island_id: str | None = Query(None),
    current_user: dict | None = Depends(get_optional_user),
):
    """Reinicia la campaña: estrellas y desbloqueo vuelven al nivel 1."""
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    _assert_folder_access(current_user, folder_doc)

    # Carpeta escolar → solo se borra el progreso del propio estudiante
    if folder_doc.get("is_school_folder") and current_user:
        uid = str(current_user.get("id") or current_user.get("_id"))
        await delete_student_progress(folder_id, uid, island_id)
        return {"status": "progress_reset"}

    if island_id:
        if db_manager.db is not None:
            try:
                await db_manager.db["study_folders"].update_one(
                    {**_folder_query(folder_id), "islands.id": island_id},
                    {"$unset": {"islands.$.campaign_progress": ""}},
                )
            except Exception as e:
                logger.error(f"Error reiniciando progreso de isla: {e}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Servicio de base de datos no disponible. Intenta de nuevo.",
                ) from e
        elif folder_id in in_memory_study_folders:
            for i in in_memory_study_folders[folder_id].get("islands", []):
                if i.get("id") == island_id:
                    i.pop("campaign_progress", None)
        return {"status": "progress_reset"}

    if db_manager.db is not None:
        try:
            await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id), {"$unset": {"campaign_progress": ""}}
            )
        except Exception as e:
            logger.error(f"Error reiniciando progreso en MongoDB: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de base de datos no disponible. Intenta de nuevo.",
            ) from e
    else:
        if folder_id in in_memory_study_folders:
            in_memory_study_folders[folder_id].pop("campaign_progress", None)

    return {"status": "progress_reset"}


@router.delete("/{folder_id}/documents/{doc_id}")
async def delete_document_from_folder(
    folder_id: str,
    doc_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
    folder_doc = await _load_folder(folder_id)
    if folder_doc:
        assert_can_access_user_resource(current_user, folder_doc.get("user_id"))

    if db_manager.db is not None:
        try:
            result = await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id),
                {
                    "$pull": {"documents": {"$or": [{"id": doc_id}, {"name": doc_id}]}},
                    "$unset": {
                        "cached_board": "",
                        "cached_boards": "",
                        "cached_board_hashes": "",
                        "cached_content_hash": "",
                    },
                },
            )
            logger.info(
                f"Documento '{doc_id}' eliminado de carpeta '{folder_id}'. Modificados: {result.modified_count}"
            )
            await rag_service.delete_document_vectors(doc_id, folder_id=folder_id)
            # Reconstruir islas: el doc puede ser fuente de alguna (su progreso
            # se conserva si la isla sigue teniendo secciones de otros docs)
            fresh = await _load_folder(folder_id)
            if fresh is not None:
                prev_islands = fresh.get("islands") or []
                islands = rebuild_islands(fresh)
                await db_manager.db["study_folders"].update_one(
                    _folder_query(folder_id),
                    {
                        "$set": {
                            "islands": islands,
                            "_island_progress_graveyard": fresh.get(
                                "_island_progress_graveyard", {}
                            ),
                        }
                    },
                )
                await _remap_island_id_refs(folder_id, prev_islands, islands)
            return {"status": "document_deleted", "doc_id": doc_id}
        except Exception as e:
            logger.error(f"Error eliminando documento de carpeta en MongoDB: {e}")
            raise HTTPException(
                status_code=500, detail=f"Error al eliminar documento: {e!s}"
            ) from e

    if folder_id in in_memory_study_folders:
        docs = in_memory_study_folders[folder_id].get("documents", [])
        in_memory_study_folders[folder_id]["documents"] = [
            d for d in docs if d.get("id") != doc_id and d.get("name") != doc_id
        ]
        invalidate_folder_game_cache(folder_id)
        prev_islands = in_memory_study_folders[folder_id].get("islands") or []
        in_memory_study_folders[folder_id]["islands"] = rebuild_islands(
            in_memory_study_folders[folder_id]
        )
        await _remap_island_id_refs(
            folder_id, prev_islands, in_memory_study_folders[folder_id]["islands"]
        )
        await rag_service.delete_document_vectors(doc_id, folder_id=folder_id)
        return {"status": "document_deleted", "doc_id": doc_id}

    return {"status": "acknowledged"}


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
    folder_doc = await _load_folder(folder_id)
    if folder_doc:
        assert_can_access_user_resource(current_user, folder_doc.get("user_id"))

    # Cleanup asociado: vectores RAG + progreso por estudiante (si era
    # materia escolar). Sin esto quedan datos huérfanos para siempre.
    await rag_service.delete_folder_vectors(folder_id)
    if db_manager.db is not None:
        try:
            await db_manager.db["student_progress"].delete_many({"folder_id": folder_id})
        except Exception as e:
            logger.warning(f"Error limpiando student_progress de {folder_id}: {e}")
    else:
        prefix = f"{folder_id}:"
        for key in [k for k in in_memory_student_progress if k.startswith(prefix)]:
            in_memory_student_progress.pop(key, None)

    if db_manager.db is not None:
        try:
            await db_manager.db["study_folders"].delete_one(_folder_query(folder_id))
            logger.info(f"Carpeta '{folder_id}' eliminada con éxito de MongoDB.")
            return {"status": "folder_deleted", "folder_id": folder_id}
        except Exception as e:
            logger.error(f"Error eliminando carpeta de MongoDB: {e}")
            raise HTTPException(status_code=500, detail="Error al eliminar la carpeta.") from e

    in_memory_study_folders.pop(folder_id, None)
    return {"status": "folder_deleted", "folder_id": folder_id}


class UpdateFolderRequest(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)


@router.patch("/{folder_id}")
async def update_folder(
    folder_id: str,
    payload: UpdateFolderRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    """Renombra o actualiza la descripción de una carpeta propia."""
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    # Mismo criterio que delete: solo el dueño (docente incluido en
    # materias de colegio) puede editar — un estudiante no renombra la clase.
    assert_can_access_user_resource(current_user, folder_doc.get("user_id"))

    updates: dict = {}
    if payload.name is not None and payload.name.strip():
        updates["name"] = payload.name.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if not updates:
        return {"status": "folder_unchanged", "folder_id": folder_id}

    if db_manager.db is not None:
        try:
            await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id), {"$set": updates}
            )
        except Exception as e:
            logger.error(f"Error actualizando carpeta en MongoDB: {e}")
            raise HTTPException(
                status_code=500, detail="Error al actualizar la carpeta."
            ) from e
    else:
        in_memory_study_folders.setdefault(folder_id, {}).update(updates)

    return {"status": "folder_updated", "folder_id": folder_id, **updates}


@router.post("/{folder_id}/upload-document")
@limiter.limit("15/minute")
async def upload_document_to_folder(
    request: Request,
    folder_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Sube un archivo real (PDF, TXT, imagen), extrae su texto completo y lo guarda
    en la carpeta. Indexa chunks en Qdrant (RAG) para búsqueda semántica.
    """
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    assert_can_access_user_resource(current_user, folder_doc.get("user_id"))
    # Las materias escolares pertenecen a la institución — el plan del docente
    # no limita su contenido (la licencia por seats lo gobierna).
    effective_plan = (
        "school" if folder_doc.get("is_school_folder") else get_user_plan(current_user)
    )
    enforce_docs_limit(effective_plan, len(folder_doc.get("documents", [])))

    # Lectura acotada: nunca bufferizar más que el límite +1 byte (OOM/DoS).
    file_bytes = await file.read(MAX_FILE_SIZE + 1)
    filename = file.filename or "archivo"
    _validate_upload(file_bytes, filename)

    # Cuota de almacenamiento total de la cuenta (las carpetas escolares las
    # paga la institución). Check temprano — evita el costo OCR/IA si ya está llena.
    if effective_plan != "school":
        owner_id = folder_doc.get("user_id") or resolve_effective_user_id(
            current_user, None
        )
        used_bytes = await user_storage_bytes(owner_id)
        enforce_storage_limit(effective_plan, used_bytes, len(file_bytes))

    try:
        # Extracción/OCR son síncronos → thread para no congelar el event loop.
        extracted_text = await asyncio.to_thread(
            ai_service.extract_document_text, file_bytes, filename
        )
        logger.info(
            f"Texto extraído de '{filename}' (Pipeline Híbrido OCR/Nativo): {len(extracted_text)} caracteres"
        )
    except Exception as e:
        logger.error(f"Error procesando '{filename}' con OCR/IA: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No se pudo procesar '{filename}': {e!s}",
        ) from e

    if not extracted_text or len(extracted_text.strip()) < 15:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No se pudo extraer texto legible de '{filename}'. Asegúrate de que el archivo o imagen contenga texto claro.",
        )

    content_hash = hashlib.sha256(file_bytes).hexdigest()

    existing_analysis = None
    if db_manager.db is not None:
        try:
            cached = await db_manager.db["cached_analyses"].find_one({"content_hash": content_hash})
            if cached and "ai_data" in cached:
                existing_analysis = cached["ai_data"]
                logger.info(
                    f"Archivo '{filename}' coincide con análisis previo ({content_hash[:8]}). Vinculando caché..."
                )
        except Exception as ex_c:
            logger.warning(f"Error buscando análisis previo para '{filename}': {ex_c}")

    doc_id = f"doc_{filename}_{len(file_bytes)}_{content_hash[:8]}"
    from app.services.virustotal import lookup_sha256

    virus_report = await asyncio.to_thread(lookup_sha256, content_hash)
    model_hits, model_ok = guard_model_fragments(extracted_text)
    injection_hits = model_hits if model_ok else injection_fragments(extracted_text)
    doc_record = {
        "id": doc_id,
        "name": filename,
        "size": f"{len(file_bytes) / 1024:.1f} KB",
        "size_bytes": len(file_bytes),
        "type": filename.split(".")[-1].lower(),
        "content_hash": content_hash,
        "extracted_text": extracted_text,
        "char_count": len(extracted_text),
        "is_analyzed": existing_analysis is not None,
        "analysis_result": existing_analysis,
        "uploaded_at": utcnow_iso(),
        "prompt_injection_fragments": injection_hits,
        "prompt_injection_detected": bool(injection_hits),
        "virustotal_status": virus_report["status"],
        "virustotal_malicious": virus_report["malicious"],
        "virustotal_suspicious": virus_report["suspicious"],
    }

    is_first_doc = not folder_doc or not folder_doc.get("documents")

    # Push + invalidación de tableros cacheados + rollback por límite (TOCTOU)
    await persist_document_to_folder(folder_id, doc_record, current_user)

    # Indexar en Qdrant para RAG (búsqueda semántica + preguntas fundamentadas)
    background_tasks.add_task(
        rag_service.index_document,
        folder_id,
        doc_id,
        filename,
        extracted_text,
        resolve_effective_user_id(current_user, None),
    )

    # Resumen ejecutivo del doc en background (metadato ligero)
    background_tasks.add_task(summarize_and_store, folder_id, doc_id, extracted_text)

    # Detección de temas → islas (estructura → LLM fallback) en background
    background_tasks.add_task(detect_topics_and_store, folder_id, doc_id)

    # Pre-warm: si es el primer documento de la carpeta, pre-generar el nivel 1
    # en background para que "jugar ahora" sea instantáneo.
    if is_first_doc:
        if settings.PREWARM_LEVEL1_ENABLED:
            background_tasks.add_task(_prewarm_level1, folder_id, current_user)

    return {
        "status": "uploaded",
        "id": doc_record["id"],
        "name": doc_record["name"],
        "size": doc_record["size"],
        "type": doc_record["type"],
        "content_hash": content_hash,
        "is_analyzed": doc_record["is_analyzed"],
        "char_count": doc_record["char_count"],
        "uploaded_at": doc_record["uploaded_at"],
        "rag_indexed": rag_service.available,
        "prompt_injection_detected": doc_record["prompt_injection_detected"],
        "prompt_injection_fragments": doc_record["prompt_injection_fragments"],
        "virustotal_status": doc_record["virustotal_status"],
        "virustotal_malicious": doc_record["virustotal_malicious"],
        "virustotal_suspicious": doc_record["virustotal_suspicious"],
    }


# Presupuesto de caracteres del texto combinado que viaja al LLM por
# generación. Acota latencia y costo; la repartición justa por documento
# preserva el orden (las directivas sectoriales por nivel 0-25%, 25-50%…
# dependen de la posición del texto, por eso no se usa RAG top-k aquí).
GENERATION_TEXT_BUDGET = 150_000

# Umbral del modo multi-nivel: con documentos chicos una sola llamada LLM
# genera 2 niveles (el prompt de sistema + contexto se amortiza entre ambos).
MULTI_LEVEL_MAX_CHARS = 30_000

def _level_defaults(level: int) -> tuple[int, str]:
    """(preguntas, dificultad) por defecto del nivel — derivado de
    ai_service._level_info para soportar los 20 niveles de campaña."""
    info = _level_info(level)
    return info["questions"], info["difficulty"]


def _build_generation_text(
    folder_name: str,
    folder_description: str,
    texts_with_source: list[str],
    doc_summaries: list[str] | None = None,
) -> str:
    """Texto combinado acotado: reparto justo por doc preservando el orden.

    Cuando existen resúmenes por documento se anteponen al texto truncado: así
    el LLM conserva el contexto de TODA la carpeta aunque cada doc se recorte
    a su cuota (los resúmenes cubren lo que la truncación descarta).
    """
    header = f"ASIGNATURA / MATERIA: {folder_name}\nDESCRIPCIÓN: {folder_description}\n"
    if doc_summaries:
        header += "RESUMEN DE LOS DOCUMENTOS:\n" + "\n".join(doc_summaries) + "\n"
    header += "\n"
    budget = max(10_000, GENERATION_TEXT_BUDGET - len(header))
    if sum(len(t) for t in texts_with_source) <= budget:
        return header + "\n\n".join(texts_with_source)
    share = max(2_000, budget // len(texts_with_source))
    return header + "\n\n".join(t[:share] for t in texts_with_source)


async def _run_folder_generation(
    folder_id: str,
    force: bool,
    level: int,
    question_count: int | None,
    difficulty: str | None,
    current_user: dict | None,
    progress=None,
    island_id: str | None = None,
) -> GameBoardResponse:
    """
    Pipeline real de generación por carpeta. Compartido por el endpoint
    síncrono, el modo async (jobs) y el pre-warm de nivel 1.
    `progress` es un callback async opcional `await progress(stage, pct)`.
    """
    timings: dict[str, int] = {}
    t_start = time.perf_counter()

    async def _stage(stage_name: str, pct: int):
        if progress:
            try:
                await progress(stage_name, pct)
            except Exception as se:
                logger.debug(f"Actualización de progreso '{stage_name}' omitida: {se}")

    def_qc, def_diff = _level_defaults(level)
    final_qc = question_count if question_count is not None else def_qc
    final_diff = difficulty if difficulty is not None else def_diff

    await _stage("reading", 10)
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Carpeta '{folder_id}' no encontrada."
        )
    _assert_folder_access(current_user, folder_doc)
    # Carpetas escolares: `force` regenera con LLM (costo) — privilegio del
    # docente dueño; los estudiantes siempre consumen el tablero cacheado.
    if folder_doc.get("is_school_folder") and force:
        req_uid = (
            str(current_user.get("id") or current_user.get("_id")) if current_user else None
        )
        if req_uid != folder_doc.get("user_id"):
            force = False
    timings["load_ms"] = round((time.perf_counter() - t_start) * 1000)

    documents = folder_doc.get("documents", [])
    folder_name = folder_doc.get("name", "Asignatura")
    folder_description = folder_doc.get("description", "")

    # Alcance por isla: la generación usa SOLO el texto del tema seleccionado
    island = None
    if island_id:
        island = next(
            (i for i in (folder_doc.get("islands") or []) if i.get("id") == island_id),
            None,
        )
        if not island:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Isla '{island_id}' no encontrada en la carpeta.",
            )
        island_text = get_island_text(folder_doc, island_id).strip()
        if len(island_text) < 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La isla '{island.get('name')}' ya no tiene contenido (sus documentos cambiaron).",
            )
        folder_name = f"{folder_name} · {island.get('name', 'Tema')}"
        texts_with_source = [f"--- TEMA: {island.get('name', '')} ---\n{island_text}"]
        doc_summaries = []
    else:
        texts_with_source = []
        doc_summaries = []
        for doc in documents:
            extracted = doc.get("extracted_text", "").strip()
            if extracted and len(extracted) > 20:
                texts_with_source.append(
                    f"--- DOCUMENTO: {doc.get('name', 'Archivo')} ---\n{extracted}"
                )
                summary = (doc.get("summary") or "").strip()
                if summary:
                    doc_summaries.append(f"- {doc.get('name', 'Archivo')}: {summary}")

    if not texts_with_source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"La carpeta '{folder_name}' no tiene documentos con texto extraído. "
                "Sube tus archivos PDF desde dentro de la carpeta para que el sistema "
                "procese su contenido interno antes de generar el juego."
            ),
        )

    combined_text = _build_generation_text(
        folder_name, folder_description, texts_with_source, doc_summaries
    )

    user_band = "scholar"
    if current_user:
        from app.core.age_bands import band_for_age

        user_band = current_user.get("age_band") or band_for_age(current_user.get("age"))

    folder_content_hash = hashlib.sha256(
        f"{island_id or ''}_{combined_text.strip()}_lvl{level}_qc{final_qc}_{final_diff}_band{user_band}".encode()
    ).hexdigest()

    # Clave de caché por isla: "isl_2__level_3" (sin isla → "level_3" legacy)
    lvl_key = f"{island_id}__level_{level}" if island_id else f"level_{level}"

    if not force:
        await _stage("cache", 20)
        cached_boards_dict = folder_doc.get("cached_boards", {})
        # Hash por nivel: un tablero cacheado solo se sirve si fue generado
        # sobre EL MISMO contenido (isla + texto + nivel + preguntas + banda).
        # Docs legacy sin hash registrado caen al check de nodos como antes.
        board_hashes = folder_doc.get("cached_board_hashes") or {}
        stored_hash = board_hashes.get(lvl_key)
        hash_ok = stored_hash is None or stored_hash == folder_content_hash
        if lvl_key in cached_boards_dict and hash_ok:
            candidate = cached_boards_dict[lvl_key]
            if len(candidate.get("nodes", [])) == final_qc:
                logger.info(
                    f"⚡ REUTILIZACIÓN INSTANTÁNEA (0 ms, 0 tokens): Tablero de '{folder_name}' ({lvl_key}) recuperado de MongoDB."
                )
                return GameBoardResponse(**candidate)

        existing_board = folder_doc.get("cached_board")
        # El slot legacy `cached_board` solo es válido para el mismo nivel/isla
        # (sin la clave, niveles con igual question_count se contaminarían).
        if (
            existing_board
            and folder_doc.get("cached_board_key") == lvl_key
            and len(existing_board.get("nodes", [])) == final_qc
            and hash_ok
        ):
            logger.info(
                f"⚡ REUTILIZACIÓN INSTANTÁNEA: Tablero guardado de '{folder_name}' reutilizado."
            )
            return GameBoardResponse(**existing_board)

        if db_manager.db is not None:
            try:
                cached_folder_analysis = await db_manager.db["cached_analyses"].find_one(
                    {"content_hash": folder_content_hash}
                )
                if cached_folder_analysis and "board" in cached_folder_analysis:
                    logger.info(
                        f"⚡ REUTILIZACIÓN INSTANTÁNEA: Análisis global de '{folder_name}' ({folder_content_hash[:8]}) cargado."
                    )
                    return GameBoardResponse(**cached_folder_analysis["board"])
            except Exception as cache_err:
                logger.warning(f"Error verificando análisis guardado de carpeta: {cache_err}")

    # Conceptos evaluados en niveles previos para garantizar cobertura total sin repetir
    previously_evaluated_concepts = []
    cached_boards_dict = folder_doc.get("cached_boards", {})
    for prev_lvl in range(1, level):
        prev_key = f"{island_id}__level_{prev_lvl}" if island_id else f"level_{prev_lvl}"
        prev_board = cached_boards_dict.get(prev_key)
        if prev_board and "cards" in prev_board:
            for c in prev_board["cards"]:
                cname = c.get("concept_name")
                if cname and not c.get("id", "").startswith("card_distractor"):
                    previously_evaluated_concepts.append(cname)

    # Regeneración del MISMO nivel (force): los reactivos de la versión
    # anterior también son "ya vistos" — la IA prioriza preguntas nuevas
    # en lugar de reciclar las mismas.
    if force:
        prev_same_level = cached_boards_dict.get(lvl_key)
        if prev_same_level and "cards" in prev_same_level:
            for c in prev_same_level["cards"]:
                cname = c.get("concept_name")
                if cname and not c.get("id", "").startswith("card_distractor"):
                    previously_evaluated_concepts.append(cname)

    logger.info(
        f"Generando juego para carpeta '{folder_name}' ({folder_id}) [Nivel {level} ({final_diff}), {final_qc} preguntas, force={force}]: "
        f"{len(texts_with_source)} documentos, {len(combined_text)} caracteres. "
        f"Excluyendo {len(previously_evaluated_concepts)} conceptos previos."
    )

    await _stage("generating", 40)
    t_llm = time.perf_counter()
    seed = random.randint(1, 99999) if force else 0
    uid = str(current_user.get("id") or current_user.get("_id")) if current_user else None
    age_band = user_band if current_user else None
    gender = current_user.get("gender") if current_user else None

    # MULTI-NIVEL: si el documento es chico, una sola llamada LLM genera
    # este nivel y el siguiente — amortiza prompt de sistema + contexto.
    extra_boards: dict[int, GameBoardResponse] = {}
    board_response = None
    if (
        not force
        and island_id is None  # islas: texto ya acotado por tema, batch no compensa
        and len(combined_text) <= MULTI_LEVEL_MAX_CHARS
        and level < CAMPAIGN_MAX_LEVEL
    ):
        nxt = level + 1
        next_key = f"{island_id}__level_{nxt}" if island_id else f"level_{nxt}"
        if next_key not in (folder_doc.get("cached_boards") or {}):
            nxt_qc, nxt_diff = _level_defaults(nxt)
            specs = [(level, final_qc, final_diff), (nxt, nxt_qc, nxt_diff)]
            try:
                extra_boards = await generate_boards_batch(
                    combined_text,
                    specs,
                    previously_evaluated_concepts,
                    user_band if current_user else "scholar",
                    gender,
                    uid,
                )
            except Exception as be:
                logger.warning(f"Generación multi-nivel falló, volviendo a mono-nivel: {be}")
            if level in extra_boards:
                board_response = extra_boards[level]
                logger.info(
                    f"⚡ Multi-nivel: niveles {sorted(extra_boards)} generados en UNA llamada LLM."
                )

    if board_response is None:
        board_response = await generate_board(
            GenerateBoardRequest(
                text=combined_text,
                level=level,
                question_count=final_qc,
                difficulty=final_diff,
                excluded_concepts=previously_evaluated_concepts,
                age_band=age_band,
                gender=gender,
            ),
            force_refresh=force,
            variation_seed=seed,
            user_id=uid,
        )
    timings["generate_ms"] = round((time.perf_counter() - t_llm) * 1000)

    await _stage("saving", 90)
    if db_manager.db is not None:
        try:
            lvl_field = f"cached_boards.{lvl_key}"
            res = await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id),
                {
                    "$set": {
                        "cached_board": board_response.model_dump(),
                        "cached_board_key": lvl_key,
                        lvl_field: board_response.model_dump(),
                        f"cached_board_hashes.{lvl_key}": folder_content_hash,
                        "cached_content_hash": folder_content_hash,
                        "last_analyzed_at": utcnow_iso(),
                    }
                },
            )
            if res.matched_count == 0:
                logger.warning(
                    f"cached_board de '{folder_id}' no persistió: carpeta eliminada a mitad de la generación."
                )
            logger.info(
                f"Análisis guardado en la carpeta '{folder_name}' (Nivel {level}) en MongoDB."
            )

            # Persistir niveles extra del modo multi-nivel (1 llamada → N niveles)
            for extra_lvl, extra_board in extra_boards.items():
                if extra_lvl == level:
                    continue
                extra_key = (
                    f"{island_id}__level_{extra_lvl}"
                    if island_id
                    else f"level_{extra_lvl}"
                )
                e_qc, e_diff = _level_defaults(extra_lvl)
                extra_hash = hashlib.sha256(
                    f"{island_id or ''}_{combined_text.strip()}_lvl{extra_lvl}_qc{e_qc}_{e_diff}_band{user_band}".encode()
                ).hexdigest()
                try:
                    await db_manager.db["study_folders"].update_one(
                        _folder_query(folder_id),
                        {
                            "$set": {
                                f"cached_boards.{extra_key}": extra_board.model_dump(),
                                f"cached_board_hashes.{extra_key}": extra_hash,
                            }
                        },
                    )
                except Exception as ee:
                    logger.warning(f"Error guardando nivel extra {extra_lvl}: {ee}")
        except Exception as fe:
            logger.warning(f"Error guardando cached_board en la carpeta: {fe}")

    if folder_id in in_memory_study_folders:
        in_memory_folder = in_memory_study_folders[folder_id]
        in_memory_folder.setdefault("cached_boards", {})[lvl_key] = board_response.model_dump()
        in_memory_folder.setdefault("cached_board_hashes", {})[lvl_key] = folder_content_hash
        in_memory_folder["cached_board"] = board_response.model_dump()
        in_memory_folder["cached_board_key"] = lvl_key
        for extra_lvl, extra_board in extra_boards.items():
            if extra_lvl == level:
                continue
            extra_key = (
                f"{island_id}__level_{extra_lvl}" if island_id else f"level_{extra_lvl}"
            )
            in_memory_folder["cached_boards"][extra_key] = extra_board.model_dump()

    timings["total_ms"] = round((time.perf_counter() - t_start) * 1000)
    logger.info(f"⏱️ pipeline generate-game {folder_id} lvl{level}: {timings}")
    return board_response


async def _prewarm_level1(folder_id: str, current_user: dict | None) -> None:
    """Pre-genera el nivel 1 en background tras el primer doc de la carpeta."""
    try:
        await _run_folder_generation(folder_id, False, 1, None, None, current_user)
    except Exception as e:
        logger.debug(f"Pre-warm nivel 1 para carpeta {folder_id} omitido: {e}")


async def _remap_island_id_refs(
    folder_id: str, prev_islands: list, new_islands: list
) -> None:
    """Tras rebuild_islands, re-apunta referencias externas cuando un ID de
    isla cambió (migración de los legacy isl_1/isl_2 posicionales a los IDs
    estables por nombre). Cubre: student_progress (_key/island_id),
    folder.assignment.island_id y claves de cached_boards (`{isl}__level_N`)."""
    new_ids = {i.get("id") for i in new_islands}
    taken: set[str] = set()
    id_map: dict[str, str] = {}
    for old in prev_islands:
        oid = old.get("id")
        if not oid or oid in new_ids:
            continue
        for new in new_islands:
            nid = new.get("id")
            if nid in taken:
                continue
            if _similar(old.get("name", ""), new.get("name", "")):
                id_map[oid] = nid
                taken.add(nid)
                break
    if not id_map:
        return

    # 1) student_progress: _key = "folder:uid:island_id" + campo island_id
    for oid, nid in id_map.items():
        if db_manager.db is not None:
            try:
                cursor = db_manager.db["student_progress"].find(
                    {"folder_id": folder_id, "island_id": oid}
                )
                async for doc in cursor:
                    await db_manager.db["student_progress"].update_one(
                        {"_id": doc["_id"]},
                        {
                            "$set": {
                                "island_id": nid,
                                "_key": doc["_key"][: -len(oid)] + nid,
                            }
                        },
                    )
            except Exception as e:
                logger.warning(f"Remap student_progress {oid}→{nid} omitido: {e}")
        else:
            suffix = f":{oid}"
            for key in [
                k
                for k in in_memory_student_progress
                if k.startswith(f"{folder_id}:") and k.endswith(suffix)
            ]:
                doc = in_memory_student_progress.pop(key)
                doc["island_id"] = nid
                doc["_key"] = key[: -len(suffix)] + f":{nid}"
                in_memory_student_progress[doc["_key"]] = doc

    # 2) assignment.island_id + claves de cached_boards en el propio folder
    folder = await _load_folder(folder_id)
    if not folder:
        return
    sets: dict = {}
    assign_iid = (folder.get("assignment") or {}).get("island_id")
    if assign_iid in id_map:
        sets["assignment.island_id"] = id_map[assign_iid]
    boards = folder.get("cached_boards")
    if isinstance(boards, dict):
        new_boards, changed = {}, False
        for k, v in boards.items():
            nk = k
            for oid, nid in id_map.items():
                if k.startswith(f"{oid}__"):
                    nk = f"{nid}__" + k[len(oid) + 2 :]
                    changed = True
                    break
            new_boards[nk] = v
        if changed:
            sets["cached_boards"] = new_boards
            cbk = folder.get("cached_board_key")
            if isinstance(cbk, str):
                for oid, nid in id_map.items():
                    if cbk.startswith(f"{oid}__"):
                        sets["cached_board_key"] = f"{nid}__" + cbk[len(oid) + 2 :]
                        break
    if not sets:
        return
    if db_manager.db is not None:
        try:
            await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id), {"$set": sets}
            )
        except Exception as e:
            logger.warning(f"Remap de cached_boards/assignment omitido: {e}")
    elif folder_id in in_memory_study_folders:
        fdoc = in_memory_study_folders[folder_id]
        if "cached_boards" in sets:
            fdoc["cached_boards"] = sets["cached_boards"]
        if "cached_board_key" in sets:
            fdoc["cached_board_key"] = sets["cached_board_key"]
        if "assignment.island_id" in sets:
            fdoc.setdefault("assignment", {})["island_id"] = sets["assignment.island_id"]
    logger.info(f"🔄 Islas de '{folder_id}' re-mapeadas: {id_map}")


async def detect_topics_and_store(
    folder_id: str, doc_id: str, force: bool = False
) -> None:
    """
    Detecta los temas de un documento recién subido y reconstruye las islas
    de la carpeta. Corre en background tras el upload — nunca bloquea la
    respuesta. Islas existentes conservan su progreso por nombre similar.
    Con force=True re-analiza aunque el doc ya tenga topic_sections.
    """
    try:
        folder_doc = await _load_folder(folder_id)
        if not folder_doc:
            return
        docs = folder_doc.get("documents") or []
        doc = next((d for d in docs if d.get("id") == doc_id), None)
        if not doc or (doc.get("topic_sections") and not force):
            return  # ya detectado
        text = (doc.get("extracted_text") or "").strip()
        if len(text) < 300:
            return

        sections = await asyncio.to_thread(detect_document_topics, text, doc.get("name", ""))
        if not sections:
            # Documento plano → una sola sección "General" cubre todo el texto
            sections = [{"title": "General", "start": 0, "end": len(text)}]

        # Persistir las secciones en el doc (posicional por documents.id)
        if db_manager.db is not None:
            await db_manager.db["study_folders"].update_one(
                {**_folder_query(folder_id), "documents.id": doc_id},
                {"$set": {"documents.$.topic_sections": sections}},
            )
        else:
            if folder_id in in_memory_study_folders:
                for d in in_memory_study_folders[folder_id].get("documents", []):
                    if d.get("id") == doc_id:
                        d["topic_sections"] = sections

        # Re-leer y reconstruir islas con el doc ya actualizado
        folder_doc = await _load_folder(folder_id)
        if not folder_doc:
            return
        prev_islands = folder_doc.get("islands") or []
        islands = rebuild_islands(folder_doc)
        if db_manager.db is not None:
            await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id),
                {
                    "$set": {
                        "islands": islands,
                        "_island_progress_graveyard": folder_doc.get(
                            "_island_progress_graveyard", {}
                        ),
                    }
                },
            )
        elif folder_id in in_memory_study_folders:
            in_memory_study_folders[folder_id]["islands"] = islands
        await _remap_island_id_refs(folder_id, prev_islands, islands)
        logger.info(
            f"🏝️ Islas de '{folder_id}' reconstruidas: {len(islands)} → "
            f"{[i['name'] for i in islands]}"
        )
    except Exception as e:
        logger.warning(f"Detección de temas omitida para {folder_id}/{doc_id}: {e}")


@router.post("/{folder_id}/detect-topics", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def detect_topics_endpoint(
    request: Request,
    folder_id: str,
    force: bool = Query(False, description="Re-detectar aunque ya haya secciones"),
    current_user: dict | None = Depends(get_optional_user),
):
    """(Re)detecta temas de todos los docs sin secciones y devuelve las islas.
    Con ?force=true re-analiza todos los docs: las islas se reconstruyen y los
    tableros cacheados se invalidan (las preguntas quedaban del texto viejo)."""
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    _assert_folder_access(current_user, folder_doc)

    for doc in folder_doc.get("documents") or []:
        if force or not doc.get("topic_sections"):
            await detect_topics_and_store(folder_id, doc.get("id"), force=force)

    if force:
        # Secciones nuevas → los tableros guardados describen el texto viejo
        await _invalidate_folder_boards(folder_id)

    folder_doc = await _load_folder(folder_id)
    return {"islands": (folder_doc or {}).get("islands") or []}


async def _invalidate_folder_boards(folder_id: str, island_id: str | None = None) -> None:
    """Borra tableros cacheados. Con island_id solo los de esa isla
    (claves `{isla}__level_N`); sin él, toda la carpeta."""
    if island_id:
        folder_doc = await _load_folder(folder_id)
        if not folder_doc:
            return
        prefix = f"{island_id}__"
        boards = folder_doc.get("cached_boards") or {}
        hashes = folder_doc.get("cached_board_hashes") or {}
        unset: dict = {}
        for k in [k for k in boards if str(k).startswith(prefix)]:
            unset[f"cached_boards.{k}"] = ""
        for k in [k for k in hashes if str(k).startswith(prefix)]:
            unset[f"cached_board_hashes.{k}"] = ""
        if str(folder_doc.get("cached_board_key") or "").startswith(prefix):
            unset["cached_board"] = ""
            unset["cached_board_key"] = ""
        if not unset:
            return
        if db_manager.db is not None:
            await db_manager.db["study_folders"].update_one(
                _folder_query(folder_id), {"$unset": unset}
            )
        fdoc = in_memory_study_folders.get(folder_id)
        if fdoc is not None:
            for k in [k for k in (fdoc.get("cached_boards") or {}) if str(k).startswith(prefix)]:
                fdoc["cached_boards"].pop(k, None)
            for k in [k for k in (fdoc.get("cached_board_hashes") or {}) if str(k).startswith(prefix)]:
                fdoc["cached_board_hashes"].pop(k, None)
            if str(fdoc.get("cached_board_key") or "").startswith(prefix):
                fdoc.pop("cached_board", None)
                fdoc.pop("cached_board_key", None)
        return

    unsets = {
        "cached_board": "",
        "cached_boards": "",
        "cached_board_hashes": "",
        "cached_board_key": "",
        "cached_content_hash": "",
    }
    if db_manager.db is not None:
        await db_manager.db["study_folders"].update_one(
            _folder_query(folder_id), {"$unset": unsets}
        )
    fdoc = in_memory_study_folders.get(folder_id)
    if fdoc is not None:
        for k in unsets:
            fdoc.pop(k, None)


@router.post("/{folder_id}/islands/{island_id}/regenerate", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def regenerate_island_questions(
    request: Request,
    folder_id: str,
    island_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Invalida los tableros cacheados de UNA isla — el próximo "Jugar" genera
    preguntas nuevas sobre el mismo tema. El progreso (estrellas/XP) se
    conserva: solo se renuevan los reactivos.
    """
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    _assert_folder_access(current_user, folder_doc)
    if not any(i.get("id") == island_id for i in (folder_doc.get("islands") or [])):
        raise HTTPException(status_code=404, detail="Isla no encontrada.")

    await _invalidate_folder_boards(folder_id, island_id)
    logger.info(f"♻️ Tableros de isla '{island_id}' invalidados en '{folder_id}'.")
    return {"status": "island_boards_invalidated", "island_id": island_id}


@router.post("/{folder_id}/generate-game", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def generate_game_from_folder(
    request: Request,
    folder_id: str,
    force: bool = Query(False, description="Forzar regeneración sin usar caché"),
    level: int = Query(1, ge=1, le=20),
    question_count: int | None = Query(None, ge=1, le=30),
    difficulty: str | None = Query(None),
    island_id: str | None = Query(None, description="Isla temática a usar (solo su texto)"),
    async_mode: bool = Query(False, alias="async"),
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Genera un tablero usando EXCLUSIVAMENTE el texto de los documentos de la
    carpeta, calibrado al nivel pedagógico indicado (1-5).

    Con `?async=true` devuelve 202 {job_id} de inmediato y el pipeline corre
    en background — el frontend consulta GET /api/v1/jobs/{id} para progreso
    real por etapas (reading → generating → saving → done).
    """
    # La carpeta gobierna el plan efectivo: en materias escolares la licencia
    # institucional paga — el plan personal del estudiante no limita el juego.
    folder_doc = await _load_folder(folder_id)
    effective_plan = (
        "school"
        if (folder_doc or {}).get("is_school_folder")
        else get_user_plan(current_user)
    )
    question_count = enforce_question_limit(effective_plan, question_count)

    if async_mode:
        # Atajo de caché: si el tablero ya existe (y sigue fresco — los hashes
        # se borran con cada invalidación), responder 200 al instante en vez
        # de crear un job y obligar al frontend a sondearlo con overlay.
        if not force:
            lvl_key = (
                f"{island_id}__level_{level}" if island_id else f"level_{level}"
            )
            cached = (folder_doc.get("cached_boards") or {}).get(lvl_key)
            if cached and (folder_doc.get("cached_board_hashes") or {}).get(
                lvl_key
            ):
                logger.info(
                    f"⚡ Tablero cacheado '{lvl_key}' de '{folder_id}' servido sin job."
                )
                return GameBoardResponse(**cached)

        uid = str(current_user.get("id") or current_user.get("_id")) if current_user else None
        job = await create_job(
            "folder_generation",
            user_id=uid,
            meta={
                "folder_id": folder_id,
                "level": level,
                "force": force,
                "island_id": island_id,
            },
        )
        task = asyncio.create_task(
            execute_job(
                job["id"],
                _run_folder_generation(
                    folder_id,
                    force,
                    level,
                    question_count,
                    difficulty,
                    current_user,
                    progress=stage_updater(job["id"]),
                    island_id=island_id,
                ),
            )
        )
        _BACKGROUND_TASKS.add(task)
        task.add_done_callback(_BACKGROUND_TASKS.discard)
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"job_id": job["id"], "status": "pending", "stage": "queued"},
        )

    return await _run_folder_generation(
        folder_id,
        force,
        level,
        question_count,
        difficulty,
        current_user,
        island_id=island_id,
    )


class FolderAskRequest(BaseModel):
    question: str = Field(..., max_length=4000)
    top_k: int | None = Field(default=5, ge=1, le=20)


@router.post("/{folder_id}/ask")
@limiter.limit("20/minute")
async def ask_folder_documents(
    request: Request,
    folder_id: str,
    payload: FolderAskRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    "Pregúntale a tus apuntes": RAG sobre Qdrant — recupera los chunks más
    relevantes de los documentos de la carpeta y responde con Gemini/Groq.
    """
    folder_doc = await _load_folder(folder_id)
    if not folder_doc:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    _assert_folder_access(current_user, folder_doc)

    chunks = await rag_service.search(folder_id, payload.question, top_k=payload.top_k or 5)
    if not chunks:
        if not rag_service.available:
            raise HTTPException(
                status_code=503,
                detail="La búsqueda semántica no está disponible (Qdrant o Gemini no configurados).",
            )
        return {
            "answer": "No encontré información relevante en tus apuntes para esa pregunta.",
            "sources": [],
        }

    context = "\n\n".join(f"[{c['doc_name']}] {c['text']}" for c in chunks)

    answer = None
    # Groq primero (rápido y barato)
    try:
        from app.services.ai_service import ai_service as _ai

        if getattr(_ai, "groq_client", None):
            # 8b-instant: para responder con contexto RAG acotado sobra —
            # ~10x más barato que el 70b por token.
            t0 = usage_started()
            comp = await asyncio.to_thread(
                _ai.groq_client.chat.completions.create,
                model="qwen/qwen3.8-27b",
                messages=[
                    {
                        "role": "system",
                        "content": guard_system(
                            "Eres Hubzi, tutora de Hubzy. Responde SOLO con base en el contexto de apuntes "
                            "provisto. Si la respuesta no está en el contexto, dilo honestamente. "
                            "Sé concisa, cálida y pedagógica (máx. 120 palabras)."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            fence_untrusted(context, "apuntes")
                            + "\n\n"
                            + fence_untrusted(payload.question, "pregunta")
                        ),
                    },
                ],
                temperature=0.3,
                max_tokens=400,
                timeout=10.0,
            )
            record_groq_usage(comp, "qwen/qwen3.8-27b", "ask_rag", usage_elapsed_ms(t0))
            answer = (comp.choices[0].message.content or "").strip()
    except Exception as e:
        logger.warning(f"Groq no respondió para /ask: {e}")

    if not answer:
        answer = "Encontré fragmentos relevantes en tus apuntes pero no pude redactar la respuesta ahora. Revisa las fuentes abajo."

    return {
        "answer": answer,
        "sources": [
            {"doc_name": c["doc_name"], "excerpt": c["text"][:280], "score": round(c["score"], 3)}
            for c in chunks
        ],
    }
