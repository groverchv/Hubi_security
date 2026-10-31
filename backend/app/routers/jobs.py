import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_optional_user
from app.services.job_service import get_job

logger = logging.getLogger("hubzy.jobs")
router = APIRouter(prefix="/api/v1/jobs", tags=["Jobs"])


@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Estado de un job de generación. Si el job pertenece a un usuario
    autenticado solo su dueño puede leerlo; los jobs de invitados se leen
    con el job_id (aleatorio e inadivinable).
    """
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job no encontrado.")

    owner = job.get("user_id")
    if owner and current_user:
        uid = str(current_user.get("id") or current_user.get("_id"))
        if uid != str(owner):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Este job pertenece a otro usuario.",
            )

    return {
        "id": job["id"],
        "kind": job.get("kind"),
        "status": job.get("status"),
        "stage": job.get("stage"),
        "progress": job.get("progress", 0),
        "result": job.get("result"),
        "error": job.get("error"),
        "status_code": job.get("status_code"),
        "timings": job.get("timings", {}),
    }
