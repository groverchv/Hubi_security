import logging

from app.core.config import settings

try:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
except ImportError:
    AsyncIOMotorClient = None
    AsyncIOMotorDatabase = None

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qdrant_models
except ImportError:
    QdrantClient = None
    qdrant_models = None

logger = logging.getLogger("hubzy.database")


class DatabaseManager:
    def __init__(self):
        self.mongo_client: AsyncIOMotorClient | None = None
        self.db: AsyncIOMotorDatabase | None = None
        self.qdrant_client: QdrantClient | None = None
        self.qdrant_collection: str = "hubzy_study_embeddings"

    async def connect(self):
        """Inicializa conexiones asíncronas con MongoDB y cliente Qdrant Vector DB."""
        try:
            if AsyncIOMotorClient is None:
                logger.info(
                    "Motor no instalado en el entorno actual. Modo local sin MongoDB activado."
                )
                self.db = None
            else:
                logger.info(f"Conectando a MongoDB en: {settings.MONGODB_URI}...")
                self.mongo_client = AsyncIOMotorClient(
                    settings.MONGODB_URI, serverSelectionTimeoutMS=5000
                )
                self.db = self.mongo_client[settings.MONGODB_DB_NAME]
                # Validar conexión
                await self.mongo_client.admin.command("ping")
                logger.info(f"Conectado exitosamente a MongoDB (BD: {settings.MONGODB_DB_NAME})")

                # Crear índices de alto rendimiento si no existen
                try:
                    try:
                        await self.db["cached_analyses"].create_index("content_hash", unique=True)
                    except Exception as dup_err:
                        # Datos legacy con content_hash duplicados: índice no-único para no bloquear el arranque
                        logger.warning(
                            "No se pudo crear índice único en cached_analyses (datos duplicados legacy). "
                            "Usando índice no-único. Ejecuta una deduplicación para restaurar la unicidad. "
                            f"Detalle: {dup_err}"
                        )
                        try:
                            await self.db["cached_analyses"].drop_index("content_hash_1")
                        except Exception as drop_err:
                            logger.debug(
                                f"Índice content_hash_1 no existía o no se pudo eliminar: {drop_err}"
                            )
                        await self.db["cached_analyses"].create_index("content_hash")
                    await self.db["study_folders"].create_index([("user_id", 1), ("_id", -1)])
                    await self.db["ai_training_dataset"].create_index("created_at")
                    await self.db["users"].create_index("email", unique=True, sparse=True)
                    await self.db["zen_logs"].create_index([("user_id", 1), ("created_at", -1)])
                    # Tokens de propósito único (verify_email / reset_password):
                    # jti único + TTL de 7 días para auto-limpieza
                    await self.db["consumed_tokens"].create_index("jti", unique=True, sparse=True)
                    await self.db["consumed_tokens"].create_index(
                        "consumed_at", expireAfterSeconds=60 * 60 * 24 * 7
                    )
                    # Progreso por estudiante en materias escolares: _key es
                    # la clave natural — el unique index cierra el doble-insert
                    # de upserts concurrentes sobre el mismo estudiante+isla.
                    await self.db["student_progress"].create_index(
                        "_key", unique=True, sparse=True
                    )
                    await self.db["skill_mastery"].create_index(
                        [("user_id", 1), ("domain", 1), ("topic", 1)], unique=True
                    )
                    # Dedup persistente de embeddings RAG: chunk_hash único
                    # permite copiar vectores sin re-embeddear texto idéntico.
                    await self.db["embedding_cache"].create_index(
                        "chunk_hash", unique=True
                    )
                    logger.info("Índices de MongoDB optimizados y verificados.")
                except Exception as ie:
                    logger.warning(f"Aviso al verificar índices de MongoDB: {ie}")
        except Exception as e:
            logger.error(f"Error conectando a MongoDB: {e}")
            self.db = None

        try:
            if QdrantClient is not None:
                if settings.QDRANT_URL:
                    logger.info("Conectando a Qdrant Cloud Vector DB...")
                    self.qdrant_client = QdrantClient(
                        url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY, timeout=10
                    )
                else:
                    logger.info(
                        f"Conectando a Qdrant local en {settings.QDRANT_HOST}:{settings.QDRANT_PORT}..."
                    )
                    self.qdrant_client = QdrantClient(
                        host=settings.QDRANT_HOST, port=settings.QDRANT_PORT, timeout=5
                    )
                collections = [c.name for c in self.qdrant_client.get_collections().collections]
                if self.qdrant_collection not in collections:
                    self.qdrant_client.create_collection(
                        collection_name=self.qdrant_collection,
                        vectors_config=qdrant_models.VectorParams(
                            size=768, distance=qdrant_models.Distance.COSINE
                        ),
                    )
                logger.info(
                    f"Conectado exitosamente a Qdrant (Colección: {self.qdrant_collection})"
                )
            else:
                logger.info("Qdrant no disponible (qdrant-client no instalado)")
        except Exception as e:
            logger.warning(f"Qdrant no accesible ({e}); el RAG queda desactivado.")
            self.qdrant_client = None

    async def close(self):
        """Cierra conexiones activas."""
        if self.mongo_client:
            self.mongo_client.close()
            logger.info("Conexión MongoDB cerrada limpiamente.")


db_manager = DatabaseManager()
