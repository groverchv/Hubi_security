from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# storage_uri configurable: memory:// por defecto (1 worker); redis:// o
# mongodb:// cuando hay múltiples réplicas para que el límite sea global.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI or "memory://",
)
