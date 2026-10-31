import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from app.core.config import settings
from app.core.database import db_manager
from app.core.security import get_current_user

logger = logging.getLogger("hubzy.ai")
router = APIRouter(prefix="/api/v1/ai", tags=["AI Evolution"])


def _require_dataset_admin(user: dict):
    """El dataset contiene extractos de documentos de TODOS los usuarios —
    solo admins configurados vía ADMIN_EMAILS pueden consultarlo."""
    admin_emails = {
        e.strip().lower()
        for e in (settings.ADMIN_EMAILS or "").split(",")
        if e.strip()
    }
    if (user.get("email") or "").lower() not in admin_emails:
        raise HTTPException(status_code=403, detail="Solo administradores.")


@router.get("/training-dataset/stats")
async def get_training_dataset_stats(current_user: dict = Depends(get_current_user)):
    """
    Estadísticas del dataset pedagógico acumulado para fine-tuning
    de modelos propios de Hubzy (Llama-3, Qwen, etc.). Solo admins.
    """
    _require_dataset_admin(current_user)
    count = 0
    recent_titles = []
    if db_manager.db is not None:
        try:
            count = await db_manager.db["ai_training_dataset"].count_documents({})
            cursor = (
                db_manager.db["ai_training_dataset"]
                .find({}, {"source_title": 1, "created_at": 1})
                .sort("_id", -1)
                .limit(5)
            )
            async for doc in cursor:
                recent_titles.append(doc.get("source_title", "Sin título"))
        except Exception as e:
            logger.warning(f"Error consultando dataset de IA: {e}")

    return {
        "status": "ready",
        "total_training_sessions": count,
        "recent_topics": recent_titles,
        "target_model_for_finetuning": "Qwen-2.5-7B / Llama-3.3-8B (LoRA)",
    }


@router.get("/training-dataset/export")
async def export_training_dataset(current_user: dict = Depends(get_current_user)):
    """
    Exporta pares pregunta/concepto en formato JSONL listo para
    Unsloth, HuggingFace o vLLM. Solo admins (contiene extractos de docs).
    """
    _require_dataset_admin(current_user)
    jsonl_lines = []
    if db_manager.db is not None:
        try:
            cursor = db_manager.db["ai_training_dataset"].find({}).limit(500)
            async for doc in cursor:
                for sample in doc.get("samples", []):
                    line = {
                        "instruction": f"Genera un reactivo universitario para evaluar el concepto '{sample.get('target_concept')}' con dificultad {doc.get('difficulty', 'normal')}.",
                        "input": doc.get("document_context_sample", ""),
                        "output": {
                            "question": sample.get("question"),
                            "hint": sample.get("hint"),
                            "target_concept": sample.get("target_concept"),
                            "explanation": sample.get("explanation"),
                        },
                    }
                    jsonl_lines.append(json.dumps(line, ensure_ascii=False))
        except Exception as e:
            logger.error(f"Error exportando dataset: {e}")

    return PlainTextResponse("\n".join(jsonl_lines), media_type="application/jsonlines")
