"""
Deduplicación de cached_analyses.content_hash (MongoDB).

Contexto: datos legacy insertaron el mismo content_hash varias veces, lo que
impide crear el índice único. Este script:

1. Modo --dry-run (por defecto): solo REPORTA los hashes duplicados.
2. Modo --apply: conserva el documento MÁS RECIENTE de cada hash y elimina
   el resto, luego recrea el índice único.

Uso:
    cd backend
    python ../scripts/dedup_cached_analyses.py           # reporte
    python ../scripts/dedup_cached_analyses.py --apply   # aplica
    (con el venv activo: source venv/bin/activate en Linux/macOS,
     .\venv\Scripts\Activate.ps1 en Windows)

RECOMENDADO: hacer un backup antes de --apply:
    mongodump --db hubzy_db --collection cached_analyses --out ./backup_mongo
"""
import argparse
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from app.core.config import settings  # noqa: E402


async def main(apply: bool):
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    col = db["cached_analyses"]

    pipeline = [
        {"$group": {"_id": "$content_hash", "count": {"$sum": 1}, "ids": {"$push": "$_id"}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    groups = await col.aggregate(pipeline).to_list(None)

    if not groups:
        print("✓ No hay content_hash duplicados.")
    else:
        total_dupes = sum(g["count"] - 1 for g in groups)
        print(f"Encontrados {len(groups)} hashes duplicados ({total_dupes} docs de más).")

    if apply and groups:
        removed = 0
        for g in groups:
            # Conservar el más reciente (mayor _id = insertado después)
            keep = max(g["ids"])
            to_delete = [i for i in g["ids"] if i != keep]
            res = await col.delete_many({"_id": {"$in": to_delete}})
            removed += res.deleted_count
            print(f"  hash {str(g['_id'])[:16]}…: conservado {keep}, eliminados {res.deleted_count}")
        print(f"✓ Eliminados {removed} documentos duplicados.")

    if apply:
        try:
            await col.drop_index("content_hash_1")
            print("Índice previo eliminado.")
        except Exception:
            pass
        await col.create_index("content_hash", unique=True)
        print("✓ Índice único content_hash_1 creado.")
    elif groups:
        print("\nEjecuta con --apply para deduplicar y restaurar el índice único.")

    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Aplica la deduplicación (default: solo reporte)")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
