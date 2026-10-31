"""
Límites del modelo freemium de Hubzy.
None = ilimitado.
"""

import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

# Duración de la prueba gratuita en días (cuenta regresiva desde el registro)
TRIAL_DAYS = 7

PLAN_LIMITS = {
    "guest": {
        "max_folders": 1,
        "max_docs_per_folder": 5,
        "max_questions_per_game": 8,
        "max_storage_mb": 10,
        "premium_voice": False,
    },
    "free": {
        "max_folders": 1,
        "max_docs_per_folder": 5,
        "max_questions_per_game": 8,
        "max_storage_mb": 10,
        "premium_voice": False,
    },
    "pro": {
        "max_folders": None,
        "max_docs_per_folder": None,
        "max_questions_per_game": 30,
        "max_storage_mb": 50,
        "premium_voice": True,
    },
    # Plan institucional (colegios): miembros con rol student/teacher/admin
    "school": {
        "max_folders": None,
        "max_docs_per_folder": None,
        "max_questions_per_game": 30,
        "max_storage_mb": None,
        "premium_voice": True,
    },
}


def get_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def trial_days_left(created_at_iso: str | None) -> int | None:
    """Días restantes de prueba gratis. None si no hay fecha válida."""
    if not created_at_iso:
        return None
    try:
        created = datetime.fromisoformat(str(created_at_iso).replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        end = created + timedelta(days=TRIAL_DAYS)
        remaining = (end - datetime.now(timezone.utc)).total_seconds()
        return max(0, math.ceil(remaining / 86400))
    except (ValueError, TypeError):
        return None


def enforce_folder_limit(plan: str, current_folders: int):
    limit = get_limits(plan)["max_folders"]
    if limit is not None and current_folders >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Alcanzaste el límite de {limit} carpetas del plan gratuito. Pasa a Hubzy Pro para carpetas ilimitadas.",
        )


def enforce_docs_limit(plan: str, current_docs: int):
    limit = get_limits(plan)["max_docs_per_folder"]
    if limit is not None and current_docs >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Alcanzaste el límite de {limit} documentos por carpeta del plan gratuito. Pasa a Hubzy Pro.",
        )


def enforce_storage_limit(plan: str, used_bytes: int, incoming_bytes: int):
    """Cuota de almacenamiento TOTAL de la cuenta (todas sus carpetas)."""
    limit_mb = get_limits(plan)["max_storage_mb"]
    if limit_mb is not None and used_bytes + incoming_bytes > limit_mb * 1024 * 1024:
        used_mb = used_bytes / 1024 / 1024
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Alcanzaste tu límite de {limit_mb} MB de almacenamiento "
                f"({used_mb:.1f} MB usados). Borra documentos o carpetas para "
                "liberar espacio, o pasa a Hubzy Pro."
            ),
        )


def enforce_question_limit(plan: str, requested: int | None) -> int | None:
    limit = get_limits(plan)["max_questions_per_game"]
    if requested is not None and limit is not None and requested > limit:
        return limit
    return requested
