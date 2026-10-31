import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.database import db_manager
from app.core.rate_limit import limiter
from app.routers import (
    adaptive,
    ai,
    arena,
    auth,
    folders,
    institutions,
    jobs,
    payments,
    psychology,
    telemetry,
    users,
    voice,
    zen,
)

logger = logging.getLogger("hubzy.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando conexiones con MongoDB y Qdrant...")
    await db_manager.connect()
    from app.services.job_service import recover_interrupted_jobs

    await recover_interrupted_jobs()
    yield
    await db_manager.close()


# Sentry solo si está configurado (nunca rompe el arranque)
if settings.SENTRY_DSN:
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,
        )
        logger.info("Sentry inicializado para observabilidad.")
    except Exception as e:
        logger.warning(f"No se pudo inicializar Sentry: {e}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API para Hubzi (SynapseHub) - Gamificación EdTech anti-estrés con Gemini, MongoDB, Qdrant y WebSockets.",
    version=settings.VERSION,
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
limiter.enabled = settings.RATE_LIMIT_ENABLED
if settings.RATE_LIMIT_ENABLED:
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    # Sin este middleware los default_limits no aplican a rutas sin decorador.
    app.add_middleware(SlowAPIMiddleware)

# CORS restringido a orígenes conocidos (nunca "*" con credenciales)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request-id + timing: correlación de logs por petición (observabilidad base)
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    import time
    import uuid

    req_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = req_id
    logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} "
        f"[{elapsed_ms:.0f}ms] req={req_id}"
    )
    return response


# Headers de seguridad HTTP (OWASP baseline)
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), payment=()"
    # CSP orientada a API: este servicio no sirve HTML en producción
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
    return response


@app.get("/health", status_code=status.HTTP_200_OK, tags=["System"])
async def health_check():
    """Endpoint básico de monitoreo de salud del sistema."""
    mongo_status = "connected" if db_manager.db is not None else "disconnected"
    qdrant_status = "connected" if db_manager.qdrant_client is not None else "disconnected"
    return {
        "status": "healthy",
        "project": "Hubzy API",
        "team": "SynapseHub",
        "mode": "zen",
        "version": settings.VERSION,
        "databases": {
            "mongodb": mongo_status,
            "mongodb_db": settings.MONGODB_DB_NAME,
            "qdrant": qdrant_status,
        },
    }


# Routers de dominio
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(arena.router)
app.include_router(folders.router)
app.include_router(zen.router)
app.include_router(voice.router)
app.include_router(psychology.router)
app.include_router(payments.router)
app.include_router(ai.router)
app.include_router(adaptive.router)
app.include_router(jobs.router)
app.include_router(institutions.router)
app.include_router(telemetry.router)
