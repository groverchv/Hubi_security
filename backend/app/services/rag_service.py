"""
Servicio RAG (Retrieval-Augmented Generation) sobre Qdrant.
Indexa los documentos de cada carpeta como chunks vectorizados con embeddings
de Gemini (text-embedding-004, 768 dims) para:
  - Búsqueda semántica dentro de los apuntes del estudiante.
  - Contexto recuperado para "pregúntale a tus apuntes" (/folders/{id}/ask).
  - Mejor fundamentación de las preguntas generadas (menos alucinación).
"""

import asyncio
import hashlib
import logging
from typing import Any

from app.core.config import settings
from app.core.database import db_manager
from app.services.llm_telemetry import (
    record_llm_usage,
    usage_elapsed_ms,
    usage_started,
)

try:
    from google import genai

    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False

try:
    from qdrant_client.http import models as qdrant_models
except ImportError:
    qdrant_models = None

logger = logging.getLogger("hubzy.rag_service")

EMBEDDING_MODEL = "text-embedding-004"
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150

# Dedup de embeddings: el vector de un chunk se cachea por su hash —
# el mismo texto en otra carpeta (o re-indexado) copia el vector sin
# volver a llamar a la API. Documentos triviales no se indexan.
MIN_INDEX_CHARS = 300
_VEC_CACHE_MAX = 4000


def _chunk_text(text: str) -> list[str]:
    """Divide texto en chunks solapados respetando límites de párrafo cuando es posible."""
    text = text.strip()
    if len(text) <= CHUNK_SIZE:
        return [text] if text else []
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        if end < len(text):
            # Retroceder al último salto de párrafo o punto para no cortar ideas
            boundary = text.rfind("\n\n", start, end)
            if boundary == -1 or boundary <= start:
                boundary = text.rfind(". ", start, end)
            if boundary != -1 and boundary > start:
                end = boundary + 1
        chunks.append(text[start:end].strip())
        start = max(end - CHUNK_OVERLAP, start + 1)
        if end >= len(text):
            break
    return [c for c in chunks if len(c) > 30]


class RagService:
    def __init__(self):
        self._genai_client = None
        # chunk_sha256 -> vector (memoria; Mongo 'embedding_cache' persiste)
        self._vec_cache: dict[str, list[float]] = {}
        if GENAI_AVAILABLE and settings.GEMINI_API_KEY:
            try:
                self._genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                logger.warning(f"No se pudo inicializar Gemini para RAG: {e}")

    @property
    def available(self) -> bool:
        return self._genai_client is not None and db_manager.qdrant_client is not None

    def _embed(self, texts: list[str]) -> list[list[float]]:
        result = self._genai_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts,
        )
        return [e.values for e in result.embeddings]

    async def index_document(
        self, folder_id: str, doc_id: str, doc_name: str, text: str, user_id: str | None = None
    ) -> int:
        """Vectoriza un documento y lo indexa en Qdrant. Retorna # de chunks indexados."""
        if not self.available:
            return 0
        if not text or len(text) < MIN_INDEX_CHARS:
            return 0
        chunks = _chunk_text(text)
        if not chunks:
            return 0
        try:
            # DEDUP POR CHUNK-HASH: solo se llaman embeddings para los chunks
            # que nunca se han visto (memoria → Mongo → API, en ese orden).
            hashes = [hashlib.sha256(c.encode("utf-8")).hexdigest() for c in chunks]
            vectors: list[list[float] | None] = [None] * len(chunks)
            missing = []
            for i, h in enumerate(hashes):
                cached = self._vec_cache.get(h)
                if cached is not None:
                    vectors[i] = cached
                else:
                    missing.append(i)

            if missing and db_manager.db is not None:
                try:
                    found = await db_manager.db["embedding_cache"].find(
                        {"chunk_hash": {"$in": [hashes[i] for i in missing]}},
                        {"chunk_hash": 1, "vector": 1},
                    ).to_list(None)
                    found_map = {d["chunk_hash"]: d["vector"] for d in found}
                    still_missing = []
                    for i in missing:
                        v = found_map.get(hashes[i])
                        if v is not None:
                            vectors[i] = v
                            self._vec_cache[hashes[i]] = v
                        else:
                            still_missing.append(i)
                    missing = still_missing
                except Exception as e:
                    logger.debug(f"Lectura de embedding_cache falló: {e}")

            # Embeddings en lotes de 50 para no saturar la API.
            # Las llamadas al SDK son síncronas → threads para no bloquear el loop.
            new_vectors: dict[int, list[float]] = {}
            for i in range(0, len(missing), 50):
                batch_idx = missing[i : i + 50]
                t0 = usage_started()
                batch_emb = await asyncio.to_thread(
                    self._embed, [chunks[j] for j in batch_idx]
                )
                record_llm_usage(
                    "gemini",
                    EMBEDDING_MODEL,
                    "embed",
                    input_tokens=sum(len(chunks[j]) for j in batch_idx) // 4,
                    ms=usage_elapsed_ms(t0),
                )
                for j, v in zip(batch_idx, batch_emb, strict=False):
                    vectors[j] = v
                    new_vectors[j] = v
                    if len(self._vec_cache) >= _VEC_CACHE_MAX:
                        self._vec_cache.pop(next(iter(self._vec_cache)), None)
                    self._vec_cache[hashes[j]] = v

            # Persistir vectores nuevos (ordered=False → duplicados se ignoran)
            if new_vectors and db_manager.db is not None:
                try:
                    await db_manager.db["embedding_cache"].insert_many(
                        [
                            {"chunk_hash": hashes[j], "vector": new_vectors[j]}
                            for j in new_vectors
                        ],
                        ordered=False,
                    )
                except Exception as e:
                    # hashes duplicados por concurrencia: ya existen
                    logger.debug(f"Persistencia parcial de embedding_cache: {e}")

            embeddings = vectors
            if any(v is None for v in embeddings):
                logger.warning("Embedding incompleto tras dedup; abortando indexado del doc.")
                return 0

            points = []
            for idx, (chunk, vector) in enumerate(zip(chunks, embeddings, strict=False)):
                point_id = hashlib.md5(f"{folder_id}:{doc_id}:{idx}".encode()).hexdigest()
                points.append(
                    qdrant_models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload={
                            "folder_id": folder_id,
                            "doc_id": doc_id,
                            "doc_name": doc_name,
                            "user_id": user_id,
                            "chunk_idx": idx,
                            "text": chunk,
                        },
                    )
                )
            await asyncio.to_thread(
                db_manager.qdrant_client.upsert,
                collection_name=db_manager.qdrant_collection,
                points=points,
            )
            logger.info(
                f"📚 RAG: {len(points)} chunks de '{doc_name}' indexados en Qdrant (carpeta {folder_id})."
            )
            return len(points)
        except Exception as e:
            logger.warning(f"Error indexando documento en Qdrant: {e}")
            return 0

    async def delete_document_vectors(self, doc_id: str, folder_id: str | None = None):
        """Elimina los chunks de un doc. `folder_id` es OBLIGATORIO en la
        práctica: el doc_id incluye el content_hash, así que el mismo archivo
        subido a dos carpetas comparte doc_id — filtrar solo por doc_id
        borraría los vectores de la OTRA carpeta."""
        if not self.available:
            return
        conditions = [
            qdrant_models.FieldCondition(
                key="doc_id",
                match=qdrant_models.MatchValue(value=doc_id),
            )
        ]
        if folder_id:
            conditions.append(
                qdrant_models.FieldCondition(
                    key="folder_id",
                    match=qdrant_models.MatchValue(value=folder_id),
                )
            )
        try:
            await asyncio.to_thread(
                db_manager.qdrant_client.delete,
                collection_name=db_manager.qdrant_collection,
                points_selector=qdrant_models.FilterSelector(
                    filter=qdrant_models.Filter(must=conditions)
                ),
            )
        except Exception as e:
            logger.warning(f"Error eliminando vectores de {doc_id}: {e}")

    async def delete_folder_vectors(self, folder_id: str):
        """Elimina TODOS los chunks de una carpeta (al borrarla completa)."""
        if not self.available:
            return
        try:
            await asyncio.to_thread(
                db_manager.qdrant_client.delete,
                collection_name=db_manager.qdrant_collection,
                points_selector=qdrant_models.FilterSelector(
                    filter=qdrant_models.Filter(
                        must=[
                            qdrant_models.FieldCondition(
                                key="folder_id",
                                match=qdrant_models.MatchValue(value=folder_id),
                            )
                        ]
                    )
                ),
            )
        except Exception as e:
            logger.warning(f"Error eliminando vectores de carpeta {folder_id}: {e}")

    async def search(self, folder_id: str, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """Búsqueda semántica limitada a una carpeta (aislamiento por usuario vía folder_id)."""
        if not self.available or not query.strip():
            return []
        try:
            query_vector = (await asyncio.to_thread(self._embed, [query]))[0]
            result = await asyncio.to_thread(
                db_manager.qdrant_client.query_points,
                collection_name=db_manager.qdrant_collection,
                query=query_vector,
                query_filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="folder_id",
                            match=qdrant_models.MatchValue(value=folder_id),
                        )
                    ]
                ),
                limit=top_k,
                with_payload=True,
            )
            return [
                {
                    "text": p.payload.get("text", ""),
                    "doc_name": p.payload.get("doc_name", ""),
                    "score": getattr(p, "score", 0.0),
                }
                for p in result.points
            ]
        except Exception as e:
            logger.warning(f"Error en búsqueda RAG (carpeta {folder_id}): {e}")
            return []


rag_service = RagService()
