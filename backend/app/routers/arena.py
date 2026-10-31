import asyncio
import hashlib
import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field

from app.core.age_bands import band_for_age
from app.core.plans import enforce_docs_limit, enforce_question_limit
from app.core.rate_limit import limiter
from app.core.security import (
    assert_can_access_user_resource,
    get_optional_user,
    get_user_plan,
    resolve_effective_user_id,
    utcnow_iso,
)
from app.schemas.schemas import GameBoardResponse, GenerateBoardRequest
from app.services.ai_service import ai_service
from app.services.board_service import generate_board
from app.services.document_store import load_folder, persist_document_to_folder
from app.services.rag_service import rag_service

logger = logging.getLogger("hubzy.arena")
router = APIRouter(prefix="/api/v1/arena", tags=["Arena"])

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

# Extensiones con pipeline de extracción real — el resto se rechaza con 415
# en vez de decodificar binario basura y mandarlo al LLM.
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
    ".md",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".bmp",
}


def _validate_upload(file_bytes: bytes, filename: str):
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo '{filename}' supera el tamaño máximo permitido de 25 MB.",
        )
    lower_f = filename.lower()
    if not any(lower_f.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Tipo de archivo no soportado: '{filename}'. "
                "Formatos aceptados: PDF, DOCX, TXT, MD, CSV, PNG, JPG, WEBP, BMP."
            ),
        )
    if lower_f.endswith(".pdf") and not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo PDF no tiene una cabecera binaria válida o está corrupto.",
        )
    if lower_f.endswith(".docx") and not file_bytes.startswith(b"PK\x03\x04"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo Word (.docx) no tiene una estructura de compresión válida.",
        )


@router.post("/generate", response_model=GameBoardResponse, status_code=status.HTTP_200_OK)
@limiter.limit("20/minute")
async def generate_arena_board(
    request: Request,
    payload: GenerateBoardRequest,
    force_refresh: bool = False,
    variation_seed: int = 0,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Recibe un texto denso de estudio, invoca a Gemini para extraer conceptos clave
    calibrados al nivel y cantidad requerida, y ensambla el GameBoardResponse.
    """
    plan = get_user_plan(current_user)
    payload.question_count = (
        enforce_question_limit(plan, payload.question_count) or payload.question_count
    )
    uid = str(current_user.get("id") or current_user.get("_id")) if current_user else None
    if current_user:
        payload.age_band = (
            payload.age_band
            or current_user.get("age_band")
            or band_for_age(current_user.get("age"))
        )
        payload.gender = payload.gender or current_user.get("gender")
    return await generate_board(
        payload, force_refresh=force_refresh, variation_seed=variation_seed, user_id=uid
    )


@router.post(
    "/upload-and-generate", response_model=GameBoardResponse, status_code=status.HTTP_200_OK
)
@limiter.limit("10/minute")
async def upload_and_generate_arena_board(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile | None = File(None),
    raw_text: str | None = Form(None),
    folder_id: str | None = Form(None),
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Recibe un documento real (PDF, TXT, imagen), extrae su texto con pipeline
    híbrido OCR/Gemini y genera o reutiliza el tablero (caché SHA-256).

    Si se indica `folder_id`, el documento queda persistido en la carpeta del
    usuario (con extracción e indexación RAG) — unifica "subir y jugar" con la
    biblioteca, evitando procesar el mismo archivo dos veces.
    """
    extracted_text = ""
    persisted_doc_id = None

    if file:
        # Lectura acotada: nunca bufferizar más que el límite +1 byte (OOM/DoS).
        file_bytes = await file.read(MAX_FILE_SIZE + 1)
        filename = file.filename or "archivo"
        _validate_upload(file_bytes, filename)
        try:
            # Extracción/OCR son síncronos → thread para no congelar el loop.
            extracted_text = await asyncio.to_thread(
                ai_service.extract_document_text, file_bytes, filename
            )
            logger.info(
                f"Texto extraído del archivo '{filename}': {len(extracted_text)} caracteres"
            )
        except Exception as e:
            logger.warning(f"Error extrayendo texto u OCR de '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error al procesar el archivo: {e!s}",
            ) from e

        # Persistir en la carpeta del usuario si se pidió (flujo "subir y jugar").
        if folder_id:
            folder_doc = await load_folder(folder_id)
            if not folder_doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Carpeta '{folder_id}' no encontrada.",
                )
            assert_can_access_user_resource(current_user, folder_doc.get("user_id"))
            enforce_docs_limit(get_user_plan(current_user), len(folder_doc.get("documents", [])))
            content_hash = hashlib.sha256(file_bytes).hexdigest()
            doc_record = {
                "id": f"doc_{filename}_{len(file_bytes)}_{content_hash[:8]}",
                "name": filename,
                "size": f"{len(file_bytes) / 1024:.1f} KB",
                "type": filename.split(".")[-1].lower(),
                "content_hash": content_hash,
                "extracted_text": extracted_text,
                "char_count": len(extracted_text),
                "is_analyzed": False,
                "analysis_result": None,
                "uploaded_at": utcnow_iso(),
            }
            await persist_document_to_folder(folder_id, doc_record, current_user)
            persisted_doc_id = doc_record["id"]
            background_tasks.add_task(
                rag_service.index_document,
                folder_id,
                doc_record["id"],
                filename,
                extracted_text,
                resolve_effective_user_id(current_user, None),
            )
            background_tasks.add_task(
                summarize_and_store, folder_id, doc_record["id"], extracted_text
            )
            # Islas del archipiélago: mismo disparo que el upload de carpetas —
            # sin esto, "subir y jugar" dejaba los docs sin detección de temas.
            from app.routers.folders import detect_topics_and_store

            background_tasks.add_task(
                detect_topics_and_store, folder_id, doc_record["id"]
            )
            logger.info(
                f"Documento '{filename}' persistido en carpeta '{folder_id}' vía upload-and-generate."
            )

    if raw_text and raw_text.strip():
        extracted_text = (
            f"{extracted_text}\n\n{raw_text.strip()}" if extracted_text else raw_text.strip()
        )

    if not extracted_text or len(extracted_text.strip()) < 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo o texto provisto no contiene suficiente contenido legible para extraer preguntas.",
        )

    uid = str(current_user.get("id") or current_user.get("_id")) if current_user else None
    board = await generate_board(GenerateBoardRequest(text=extracted_text), user_id=uid)
    if persisted_doc_id:
        logger.info(f"Tablero generado para doc persistido '{persisted_doc_id}'.")
    return board


async def summarize_and_store(folder_id: str, doc_id: str, text: str) -> None:
    """Genera el resumen del doc en background y lo guarda en su registro."""
    try:
        summary = await asyncio.to_thread(ai_service.summarize_document, text)
        if not summary:
            return
        from app.core.database import db_manager
        from app.core.session_store import in_memory_study_folders

        if db_manager.db is not None:
            from app.services.document_store import folder_query

            await db_manager.db["study_folders"].update_one(
                folder_query(folder_id),
                {"$set": {"documents.$[d].summary": summary}},
                array_filters=[{"d.id": doc_id}],
            )
        else:
            folder = in_memory_study_folders.get(folder_id)
            if folder:
                for d in folder.get("documents", []):
                    if d.get("id") == doc_id:
                        d["summary"] = summary
    except Exception as e:
        logger.debug(f"Resumen en background para '{doc_id}' omitido: {e}")


class CapySpeechRequest(BaseModel):
    situation: str = "correct"
    level: int = 1
    theme: str = ""
    history: list[str] = Field(default_factory=list)


@router.post("/capy-speech", tags=["Arena"])
@limiter.limit("30/minute")
async def get_capy_speech(request: Request, payload: CapySpeechRequest):
    """Genera locución dinámica y serena de Hubzi como psicólogo cognitivo."""
    speech = ai_service.generate_capy_speech(
        situation=payload.situation,
        level=payload.level,
        theme=payload.theme,
        history=payload.history,
    )
    return {"speech": speech, "level": payload.level, "situation": payload.situation}


class CapyAskRequest(BaseModel):
    message: str
    nodes: list | None = []
    hand: list | None = []
    theme: str | None = ""
    user_profile: dict | None = None
    # Historial reciente de conversación: [{role: "user"|"capi", text: "..."}]
    history: list | None = []


@router.post("/capy-ask", tags=["Arena"])
@limiter.limit("30/minute")
async def ask_capybara(request: Request, payload: CapyAskRequest):
    """
    Recibe la transcripción del micrófono del usuario y genera una pista pedagógica
    o intervención empática anti-estrés evaluada con NLP clínico y Gemini.
    La respuesta puede incluir is_crisis=true → el frontend debe mostrar el
    protocolo de crisis (ver /api/v1/psychology/crisis-resources).
    """
    # Gemini es síncrono: offload al thread para no congelar el event loop
    return await asyncio.to_thread(
        ai_service.generate_capy_response_with_psychology,
        user_message=payload.message,
        nodes_context=payload.nodes or [],
        hand_context=payload.hand or [],
        theme=payload.theme or "",
        user_profile=payload.user_profile or {},
        history=payload.history or [],
    )
