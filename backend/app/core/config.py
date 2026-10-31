from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_JWT_SECRET = "dev-only-insecure-secret-change-me"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hubzy API"
    VERSION: str = "0.2.0"
    API_V1_STR: str = "/api/v1"

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "hubzy_db"

    # Qdrant Vector DB
    QDRANT_URL: str | None = None
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 6333
    QDRANT_API_KEY: str | None = None

    # Google Gemini
    GEMINI_API_KEY: str | None = None

    # ElevenLabs
    ELEVENLABS_API_KEY: str | None = None

    # Groq Cloud
    GROQ_API_KEY: str | None = None

    # VirusTotal: consulta por hash de archivos subidos. No se envía el archivo.
    VIRUSTOTAL_API_KEY: str | None = None

    # Stripe Payments
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_PUBLISHABLE_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_PRICE_ID: str | None = None  # price_... para suscripción mensual Pro
    STRIPE_SCHOOL_PRICE_ID: str | None = None  # price_... seat/mes institucional

    # Auth / JWT
    JWT_SECRET: str = _DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 días

    # Seguridad / Entorno
    ENVIRONMENT: str = "development"  # development | staging | production
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    ADMIN_EMAILS: str = ""  # lista separada por comas — acceso a dataset de IA
    FRONTEND_URL: str = "http://localhost:5173"
    SENTRY_DSN: str | None = None
    RATE_LIMIT_ENABLED: bool = True
    # Backend de almacenamiento de slowapi (memory:// por defecto).
    # Para múltiples workers/réplicas usar p. ej. redis://host:6379 o mongodb://host:27017
    RATE_LIMIT_STORAGE_URI: str | None = None

    # Recursos de crisis configurables (JSON: [{"name","detail","phone","url"}])
    # IMPORTANTE: verificar números locales reales antes de producción (ver docs/exploracion-ansiedad-uagrm.md)
    CRISIS_RESOURCES_JSON: str | None = None

    # Motores procedurales (matemática/física): generan ejercicios por
    # PLANTILLA, no desde el contenido del documento. Desactivados por
    # defecto — el requisito del producto es que todo salga del doc subido.
    # Activar solo si el público es genuinamente ejercicios de math/física.
    PROCEDURAL_ENGINES_ENABLED: bool = False
    # Confianza mínima para enrutar un doc al motor procedural (0-1).
    PROCEDURAL_MIN_CONFIDENCE: float = 0.45

    # Pre-generación del nivel 1 al subir el primer doc de una carpeta.
    # True = UX instantánea pero gasta tokens aunque el usuario nunca juegue;
    # False = se genera bajo demanda (menor gasto, primera carga más lenta).
    PREWARM_LEVEL1_ENABLED: bool = True

    # Modelos pretrained locales (opcional — requiere `pip install transformers torch`)
    # Desactivados por defecto; las heurísticas cubren el caso común. Activar
    # solo donde el peso del modelo justifica el recall extra.
    SAFETY_MODEL_ENABLED: bool = False
    SAFETY_MODEL_NAME: str = "unitary/toxic-bert"  # multilingüe limitado; configurable
    CRISIS_MODEL_ENABLED: bool = False
    CRISIS_MODEL_NAME: str = "finiteautomata/beto-emotion-analysis"  # emociones en español

    # Email transaccional (verificación + reset de contraseña)
    # Sin SMTP configurado, los emails se loguean en consola (modo dev).
    EMAIL_ENABLED: bool = True
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAIL_FROM: str = "noreply@hubzy.app"
    EMAIL_FROM_NAME: str = "Hubzy"
    SMTP_USE_TLS: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @model_validator(mode="after")
    def _reject_insecure_secrets_in_production(self):
        """Fail-fast: jamás arrancar en producción con credenciales por defecto."""
        if self.is_production:
            if (
                not self.JWT_SECRET
                or self.JWT_SECRET == _DEV_JWT_SECRET
                or len(self.JWT_SECRET) < 32
            ):
                raise ValueError(
                    "JWT_SECRET inseguro para producción. Genera uno con "
                    "`openssl rand -hex 32` y expórtalo como variable de entorno."
                )
        return self

    # extra=ignore: .env.example incluye vars de Compose (MONGO_ROOT_*, HTTP_PORT)
    # que no son settings de la app.
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


settings = Settings()
