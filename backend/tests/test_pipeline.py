"""
Tests del pipeline upload → procesamiento → juego:
invalidación de caché de tableros al mutar documentos, whitelist de
extensiones, jobs asíncronos de generación y persistencia del documento
en la carpeta vía upload-and-generate.

Usan textos de matemáticas para caer en el motor procedural (0 LLM).
"""

import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import db_manager
from app.core.session_store import in_memory_study_folders
from app.main import app
from app.services.document_store import folder_query
from app.services.topic_detector import (
    compute_total_levels,
    detect_sections,
    get_island_text,
    rebuild_islands,
)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _hermetic_ai(monkeypatch):
    """Aísla los tests de red: Gemini (resúmenes), Qdrant (indexado) y
    el pre-warm de nivel 1 se disparan en background tras el upload."""
    import app.routers.arena as arena_router
    import app.routers.folders as folders_router
    from app.services.rag_service import rag_service

    async def _noop(*_a, **_k):
        return None

    monkeypatch.setattr(arena_router, "summarize_and_store", _noop)
    monkeypatch.setattr(folders_router, "summarize_and_store", _noop)
    monkeypatch.setattr(folders_router, "_prewarm_level1", _noop)
    monkeypatch.setattr(folders_router, "detect_topics_and_store", _noop)
    monkeypatch.setattr(rag_service, "index_document", _noop)


def _folder_doc(folder_id: str) -> dict | None:
    """Lee la carpeta del store activo (Mongo real o memoria en tests sin BD)."""
    if db_manager.db is not None:
        from pymongo import MongoClient

        sync = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000)
        try:
            return sync[settings.MONGODB_DB_NAME]["study_folders"].find_one(folder_query(folder_id))
        finally:
            sync.close()
    return in_memory_study_folders.get(folder_id)


def _register(client, tag="pipe"):
    email = f"pytest_{tag}_{uuid.uuid4().hex[:8]}@hubzy.dev"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "secreto123",
            "username": f"U{tag}",
            "gender": "femenino",
            "age": 21,
        },
    )
    assert res.status_code == 200
    data = res.json()
    return {"Authorization": f"Bearer {data['token']}"}, data["user"]


# Texto con densidad suficiente de señales matemáticas para que
# classify_domain → "matematica" → motor procedural (sin LLM).
MATH_TEXT = (
    "Apuntes de matemáticas: la ecuación cuadrática x² - 5x + 6 = 0 se resuelve "
    "factorizando en (x-2)(x-3). Las fracciones 3/4 y 1/2 se comparan buscando "
    "un denominador común entre numerador y denominador. Un porcentaje del 25% "
    "equivale a la fracción 1/4. En álgebra se despeja la incógnita: de la "
    "ecuación x + 3 = 8 resulta x = 5. La suma, la resta, la multiplicación y "
    "la división son las operaciones básicas de la aritmética elemental. "
) * 3


def _create_folder_with_math_doc(client, headers):
    res = client.post("/api/v1/folders", json={"name": "Mates"}, headers=headers)
    assert res.status_code == 201
    folder_id = res.json()["id"]
    # Sembrar el doc con texto directo en el store — el endpoint /documents ya
    # NO acepta extracted_text del cliente (mass-assignment cerrado); el texto
    # real solo llega vía upload-document + pipeline de extracción.
    _patch_folder(
        folder_id,
        {"documents": [{"id": "doc_math_1", "name": "mates.txt", "extracted_text": MATH_TEXT}]},
    )
    return folder_id


# ---------------------------------------------------------------------
# Invalidación de caché: mutar documents debe limpiar cached_boards
# ---------------------------------------------------------------------


def test_board_cache_invalidated_on_bulk_add_documents(client):
    headers, _ = _register(client, "cache")
    folder_id = _create_folder_with_math_doc(client, headers)

    res = client.post(f"/api/v1/folders/{folder_id}/generate-game?level=1", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json().get("nodes")
    folder = _folder_doc(folder_id)
    assert folder and "cached_boards" in folder

    # Agregar otro documento → el tablero cacheado debe invalidarse,
    # si no el siguiente generate-game serviría contenido obsoleto.
    res = client.post(
        f"/api/v1/folders/{folder_id}/documents",
        json={"documents": [{"id": "doc_math_2", "name": "mas.txt", "extracted_text": MATH_TEXT}]},
        headers=headers,
    )
    assert res.status_code == 200
    folder = _folder_doc(folder_id)
    assert "cached_boards" not in folder and "cached_board" not in folder


def test_board_cache_invalidated_on_upload_document(client):
    headers, _ = _register(client, "upcache")
    folder_id = _create_folder_with_math_doc(client, headers)
    res = client.post(f"/api/v1/folders/{folder_id}/generate-game?level=1", headers=headers)
    assert res.status_code == 200
    assert "cached_boards" in _folder_doc(folder_id)

    res = client.post(
        f"/api/v1/folders/{folder_id}/upload-document",
        files={"file": ("otro.txt", MATH_TEXT.encode(), "text/plain")},
        headers=headers,
    )
    assert res.status_code == 200
    assert "cached_boards" not in _folder_doc(folder_id)


# ---------------------------------------------------------------------
# Validación de upload
# ---------------------------------------------------------------------


def test_upload_document_rejects_unsupported_extension(client):
    headers, _ = _register(client, "ext")
    res = client.post("/api/v1/folders", json={"name": "F"}, headers=headers)
    folder_id = res.json()["id"]
    res = client.post(
        f"/api/v1/folders/{folder_id}/upload-document",
        files={"file": ("payload.exe", b"MZ\x90\x00binary", "application/octet-stream")},
        headers=headers,
    )
    assert res.status_code == 415


# ---------------------------------------------------------------------
# Jobs asíncronos de generación
# ---------------------------------------------------------------------


def test_async_generation_job_completes(client):
    headers, _ = _register(client, "job")
    folder_id = _create_folder_with_math_doc(client, headers)

    res = client.post(
        f"/api/v1/folders/{folder_id}/generate-game?level=1&async=true",
        headers=headers,
    )
    assert res.status_code == 202
    job_id = res.json()["job_id"]

    job = None
    for _ in range(60):
        jr = client.get(f"/api/v1/jobs/{job_id}", headers=headers)
        assert jr.status_code == 200
        job = jr.json()
        if job["status"] in ("done", "error"):
            break
        time.sleep(0.1)

    assert job["status"] == "done", job
    assert job["stage"] == "done"
    assert job["progress"] == 100
    assert job["result"]["nodes"]
    assert job["timings"]["total_ms"] >= 0


def test_job_not_found_returns_404(client):
    headers, _ = _register(client, "nofound")
    res = client.get("/api/v1/jobs/job_inexistente", headers=headers)
    assert res.status_code == 404


# ---------------------------------------------------------------------
# upload-and-generate con folder_id: el doc queda persistido
# ---------------------------------------------------------------------


# ---------------------------------------------------------------------
# Progreso de campaña persistente
# ---------------------------------------------------------------------


def test_campaign_progress_max_merge_and_clamps(client):
    headers, _ = _register(client, "prog")
    res = client.post("/api/v1/folders", json={"name": "Campaña"}, headers=headers)
    folder_id = res.json()["id"]

    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={
            "unlocked_level": 3,
            "current_level": 3,
            "level_stars": {"1": 3, "2": 2},
        },
        headers=headers,
    )
    assert res.status_code == 200
    prog = res.json()["campaign_progress"]
    assert prog["unlocked_level"] == 3
    assert prog["level_stars"] == {"1": 3, "2": 2}

    # Max-merge: un guardado peor no baja estrellas ni desbloqueo
    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"unlocked_level": 2, "level_stars": {"2": 1}},
        headers=headers,
    )
    prog = res.json()["campaign_progress"]
    assert prog["unlocked_level"] == 3
    assert prog["level_stars"]["2"] == 2

    # Un guardado mejor sí sube
    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"level_stars": {"2": 3}},
        headers=headers,
    )
    assert res.json()["campaign_progress"]["level_stars"]["2"] == 3

    # Clamps: nivel tope 20, estrellas tope 3, claves fuera de rango ignoradas
    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"unlocked_level": 99, "level_stars": {"5": 9, "30": 3}},
        headers=headers,
    )
    prog = res.json()["campaign_progress"]
    assert prog["unlocked_level"] == 20
    assert prog["level_stars"]["5"] == 3
    assert "30" not in prog["level_stars"]

    # XP: se acumula entre rondas (suma, no max)
    client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"xp_gained": 40},
        headers=headers,
    )
    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"xp_gained": 30},
        headers=headers,
    )
    assert res.json()["campaign_progress"]["total_xp"] == 70

    # El progreso viaja en GET /folders para hidratar el mapa
    res = client.get("/api/v1/folders", headers=headers)
    f = next(f for f in res.json()["folders"] if f["id"] == folder_id)
    assert f["campaign_progress"]["unlocked_level"] == 20
    assert f["campaign_progress"]["total_xp"] == 70

    # Reset de campaña
    res = client.delete(f"/api/v1/folders/{folder_id}/campaign-progress", headers=headers)
    assert res.status_code == 200
    res = client.get("/api/v1/folders", headers=headers)
    f = next(f for f in res.json()["folders"] if f["id"] == folder_id)
    assert "campaign_progress" not in f


def test_campaign_progress_rejects_other_users_folder(client):
    h1, _ = _register(client, "owner")
    h2, _ = _register(client, "intruso")
    res = client.post("/api/v1/folders", json={"name": "Privada"}, headers=h1)
    folder_id = res.json()["id"]

    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"unlocked_level": 5},
        headers=h2,
    )
    assert res.status_code in (403, 404)


def test_upload_and_generate_persists_doc_in_folder(client):
    headers, _ = _register(client, "uag")
    res = client.post("/api/v1/folders", json={"name": "Mates 2"}, headers=headers)
    folder_id = res.json()["id"]

    res = client.post(
        "/api/v1/arena/upload-and-generate",
        files={"file": ("mates.txt", MATH_TEXT.encode(), "text/plain")},
        data={"folder_id": folder_id},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json().get("nodes")

    folder = _folder_doc(folder_id)
    assert folder and len(folder.get("documents", [])) == 1
    doc = folder["documents"][0]
    assert doc["name"] == "mates.txt"
    assert doc["char_count"] > 20


# ────────────────────────── Archipiélago de islas ──────────────────────────

# Documento estilo "libro de sociales" con 3 temas estructurados.
SOCIALES_TEXT = (
    "Tema 1: La Edad Media\n"
    + (
        "La Edad Media fue un periodo histórico entre los siglos V y XV, "
        "marcado por el feudalismo, los castillos y el poder de la Iglesia. "
    )
    * 25
    + "\n\nTema 2: El Renacimiento\n"
    + (
        "El Renacimiento fue un movimiento cultural de los siglos XV y XVI "
        "que recuperó el arte y la ciencia clásicos de Grecia y Roma. "
    )
    * 25
    + "\n\nTema 3: La Ilustración\n"
    + (
        "La Ilustración fue un movimiento intelectual del siglo XVIII que "
        "defendió la razón, la ciencia y los derechos individuales. "
    )
    * 25
)


def test_detect_sections_finds_tema_headings():
    sections = detect_sections(SOCIALES_TEXT)
    assert len(sections) == 3
    titles = [s["title"] for s in sections]
    assert any("Edad Media" in t for t in titles)
    assert any("Renacimiento" in t for t in titles)
    assert any("Ilustración" in t for t in titles)
    # Los rangos cubren el documento completo sin solaparse
    assert sections[0]["start"] == 0
    assert sections[-1]["end"] == len(SOCIALES_TEXT)


def test_detect_sections_flat_doc_returns_empty():
    flat = "Este texto no tiene encabezados ni estructura visible alguna. " * 60
    assert detect_sections(flat) == []


def test_rebuild_islands_groups_sections_and_scales_levels():
    folder = {
        "documents": [
            {
                "id": "doc_soc",
                "extracted_text": SOCIALES_TEXT,
                "topic_sections": detect_sections(SOCIALES_TEXT),
            }
        ]
    }
    islands = rebuild_islands(folder)
    folder["islands"] = islands
    assert len(islands) == 3
    assert all(i["id"].startswith("isl_") for i in islands)
    # Campaña fija de 20 niveles por isla (regla de producto)
    assert all(i["total_levels"] == 20 for i in islands)
    # Cada isla solo extrae SU texto — sin mezcla entre temas
    isl_ren = next(i for i in islands if "Renacimiento" in i["name"])
    txt = get_island_text(folder, isl_ren["id"])
    assert "Renacimiento" in txt
    assert "Ilustración" not in txt


def test_rebuild_islands_preserves_progress_by_name():
    folder = {
        "documents": [
            {
                "id": "doc_soc",
                "extracted_text": SOCIALES_TEXT,
                "topic_sections": detect_sections(SOCIALES_TEXT),
            }
        ],
        "islands": [
            {
                "id": "isl_99",
                "name": "Tema 2: El Renacimiento",
                "campaign_progress": {"unlocked_level": 4, "level_stars": {"1": 3}},
            }
        ],
    }
    islands = rebuild_islands(folder)
    ren = next(i for i in islands if "Renacimiento" in i["name"])
    assert ren["campaign_progress"]["unlocked_level"] == 4


def _patch_folder(folder_id: str, fields: dict) -> None:
    """Escribe campos en la carpeta del store activo (Mongo o memoria)."""
    if db_manager.db is not None:
        from pymongo import MongoClient

        sync = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000)
        try:
            sync[settings.MONGODB_DB_NAME]["study_folders"].update_one(
                folder_query(folder_id), {"$set": fields}
            )
        finally:
            sync.close()
    else:
        in_memory_study_folders[folder_id].update(fields)


def test_island_progress_endpoint_isolated(client):
    headers, _ = _register(client, "isla")
    res = client.post("/api/v1/folders", json={"name": "Sociales"}, headers=headers)
    folder_id = res.json()["id"]
    # Sembrar isla manualmente (sin pasar por detección LLM)
    _patch_folder(
        folder_id,
        {
            "islands": [
                {"id": "isl_1", "name": "Edad Media", "sections": [], "total_levels": 3},
                {"id": "isl_2", "name": "Renacimiento", "sections": [], "total_levels": 3},
            ]
        },
    )

    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"island_id": "isl_1", "unlocked_level": 3, "level_stars": {"1": 3}},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["campaign_progress"]["unlocked_level"] == 3

    # La isla 2 sigue sin progreso; la carpeta tampoco tiene progreso global
    folder = _folder_doc(folder_id)
    isl2 = next(i for i in folder["islands"] if i["id"] == "isl_2")
    assert "campaign_progress" not in isl2
    assert "campaign_progress" not in folder

    # Isla inexistente → 404
    res = client.put(
        f"/api/v1/folders/{folder_id}/campaign-progress",
        json={"island_id": "isl_999", "unlocked_level": 2},
        headers=headers,
    )
    assert res.status_code == 404


def test_island_generate_uses_only_island_text(client, monkeypatch):
    # Sin API keys de LLM en CI: se mockea generate_board y se captura el
    # texto que recibe — así se verifica de verdad que solo viaja el texto
    # de la isla elegida (aislamiento, que es lo que nombra al test).
    import app.routers.folders as folders_router
    from app.schemas.schemas import CardSchema, GameBoardResponse, NodeSchema

    captured: dict = {}

    async def _fake_board(request, **_kwargs):
        captured["text"] = request.text
        return GameBoardResponse(
            id_tablero="tablero_test",
            title="Tablero de prueba",
            nodes=[
                NodeSchema(id="n1", correct_card_id="c1", description="pista del nodo")
            ],
            cards=[CardSchema(id="c1", concept_name="Feudalismo", content="sistema")],
        )

    monkeypatch.setattr(folders_router, "generate_board", _fake_board)

    headers, _ = _register(client, "gen_isla")
    res = client.post("/api/v1/folders", json={"name": "Sociales"}, headers=headers)
    folder_id = res.json()["id"]
    sections = detect_sections(SOCIALES_TEXT)
    docs = [
        {
            "id": "d1",
            "name": "sociales.txt",
            "extracted_text": SOCIALES_TEXT,
            "topic_sections": sections,
        }
    ]
    islands = rebuild_islands({"documents": docs})
    _patch_folder(folder_id, {"documents": docs, "islands": islands})
    island = next(i for i in islands if "Edad Media" in i["name"])

    res = client.post(
        f"/api/v1/folders/{folder_id}/generate-game",
        params={"island_id": island["id"], "level": 1},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    board = res.json()
    assert board.get("nodes")

    # Aislamiento real: el texto enviado a generación es solo el de la isla
    # "Edad Media" — no contiene contenido de las otras secciones del doc.
    assert "Edad Media" in captured["text"]
    assert "Ilustración" not in captured["text"]
    assert "Renacimiento" not in captured["text"]
    # El cache quedó bajo clave de isla
    folder = _folder_doc(folder_id)
    assert f"{island['id']}__level_1" in folder.get("cached_boards", {})

    # Isla inexistente → 404
    res = client.post(
        f"/api/v1/folders/{folder_id}/generate-game",
        params={"island_id": "isl_nope", "level": 1},
        headers=headers,
    )
    assert res.status_code == 404


def test_compute_total_levels_scaling():
    assert compute_total_levels(100) == 3  # mínimo
    assert compute_total_levels(9000) == 3
    assert compute_total_levels(20000) == 3  # ceil(20000/9000)=3
    assert compute_total_levels(40000) == 5
    assert compute_total_levels(999_999) == 10  # máximo


def test_island_progress_survives_doc_delete_and_reupload():
    """Borrar el doc tumba la isla pero conserva su progreso; al re-subir un
    tema homónimo el progreso resucita."""
    sections = detect_sections(SOCIALES_TEXT)
    folder = {
        "documents": [
            {
                "id": "doc_soc",
                "extracted_text": SOCIALES_TEXT,
                "topic_sections": sections,
            }
        ],
        "islands": [],
    }
    islands = rebuild_islands(folder)
    folder["islands"] = islands
    # Simular progreso en la isla Renacimiento
    ren = next(i for i in islands if "Renacimiento" in i["name"])
    ren["campaign_progress"] = {"unlocked_level": 5, "level_stars": {"1": 3, "2": 3}}

    # Borrar el doc → todas las islas pierden sus secciones
    folder["documents"] = []
    islands2 = rebuild_islands(folder)
    assert islands2 == []
    assert folder["_island_progress_graveyard"]  # progreso guardado en lápida

    # Re-subir el mismo doc → la isla vuelve con su progreso intacto
    folder["documents"] = [
        {
            "id": "doc_soc_2",
            "extracted_text": SOCIALES_TEXT,
            "topic_sections": detect_sections(SOCIALES_TEXT),
        }
    ]
    islands3 = rebuild_islands(folder)
    ren3 = next(i for i in islands3 if "Renacimiento" in i["name"])
    assert ren3["campaign_progress"]["unlocked_level"] == 5
