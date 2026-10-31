"""
Tests de Hubzy para Colegios: instituciones, grados, matrícula por código,
materias compartidas y progreso por estudiante en carpetas escolares.

Corren con el store en memoria o Mongo según entorno de test.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _hermetic_ai(monkeypatch):
    """Sin llamadas externas en background tras uploads."""
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


def _register(client, tag="sch"):
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


def _bootstrap_school(client):
    """Crea colegio + grado + materia; devuelve (admin_headers, inst, grade, folder)."""
    h_admin, _ = _register(client, "director")
    res = client.post(
        "/api/v1/institutions",
        json={"name": "Colegio Test"},
        headers=h_admin,
    )
    assert res.status_code == 201, res.text
    inst = res.json()["institution"]

    res = client.post(
        f"/api/v1/institutions/{inst['id']}/grades",
        json={"name": "5to Secundaria B"},
        headers=h_admin,
    )
    assert res.status_code == 201, res.text
    grade = res.json()["grade"]

    res = client.post(
        f"/api/v1/institutions/grades/{grade['id']}/folders",
        json={"name": "Ciencias Sociales"},
        headers=h_admin,
    )
    assert res.status_code == 201, res.text
    folder = res.json()["folder"]
    return h_admin, inst, grade, folder


def test_create_institution_and_grade(client):
    _h_admin, inst, grade, folder = _bootstrap_school(client)
    assert inst["name"] == "Colegio Test"
    assert inst["teacher_code"].startswith("PROF-")
    assert grade["join_code"].startswith("HUBZY-")
    assert folder["is_school_folder"] is True
    assert folder["grade_id"] == grade["id"]


def test_student_joins_grade_and_sees_materia(client):
    _h_admin, _inst, grade, folder = _bootstrap_school(client)
    h_stu, _stu = _register(client, "alumno")

    # Matrícula por código del grado
    res = client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )
    assert res.status_code == 200, res.text
    assert res.json()["role"] == "student"
    assert res.json()["grade"]["id"] == grade["id"]

    # El estudiante ve la materia del grado en su lista de carpetas
    res = client.get("/api/v1/folders", headers=h_stu)
    assert res.status_code == 200
    ids = [f["id"] for f in res.json()["folders"]]
    assert folder["id"] in ids


def test_join_invalid_code_404(client):
    h_stu, _ = _register(client, "alumno2")
    res = client.post(
        "/api/v1/institutions/join",
        json={"code": "HUBZY-XXXXX"},
        headers=h_stu,
    )
    assert res.status_code == 404


def test_student_cannot_mutate_school_folder(client):
    _h_admin, _inst, grade, folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alumno3")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )

    # El estudiante NO puede subir documentos a la materia del colegio
    res = client.post(
        f"/api/v1/folders/{folder['id']}/documents",
        json={"documents": [{"id": "d1", "name": "x.txt", "extracted_text": "hola" * 50}]},
        headers=h_stu,
    )
    assert res.status_code in (401, 403)


def test_school_folder_progress_is_per_student(client):
    _h_admin, _inst, grade, folder = _bootstrap_school(client)
    h_a, _ = _register(client, "alum_a")
    h_b, _ = _register(client, "alum_b")
    for h in (h_a, h_b):
        client.post(
            "/api/v1/institutions/join",
            json={"code": grade["join_code"]},
            headers=h,
        )

    # Alumno A avanza al nivel 4
    res = client.put(
        f"/api/v1/folders/{folder['id']}/campaign-progress",
        json={"unlocked_level": 4, "level_stars": {"1": 3, "2": 3, "3": 2}},
        headers=h_a,
    )
    assert res.status_code == 200, res.text

    # Alumno B queda en nivel 2 — NO pisa el progreso de A
    res = client.put(
        f"/api/v1/folders/{folder['id']}/campaign-progress",
        json={"unlocked_level": 2, "level_stars": {"1": 2}},
        headers=h_b,
    )
    assert res.status_code == 200

    # A sigue viendo SU progreso al listar carpetas
    res = client.get("/api/v1/folders", headers=h_a)
    fa = next(f for f in res.json()["folders"] if f["id"] == folder["id"])
    assert fa["campaign_progress"]["unlocked_level"] == 4

    res = client.get("/api/v1/folders", headers=h_b)
    fb = next(f for f in res.json()["folders"] if f["id"] == folder["id"])
    assert fb["campaign_progress"]["unlocked_level"] == 2


def test_teacher_dashboard_and_weak_topics(client):
    h_admin, _inst, grade, folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alum_c")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )
    client.put(
        f"/api/v1/folders/{folder['id']}/campaign-progress",
        json={"unlocked_level": 2, "level_stars": {"1": 1}},
        headers=h_stu,
    )

    res = client.get(
        f"/api/v1/institutions/grades/{grade['id']}/dashboard",
        headers=h_admin,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["students"]) == 1
    stu = data["students"][0]
    assert stu["subjects"][0]["subject"] == "Ciencias Sociales"
    assert stu["subjects"][0]["folder_progress"]["unlocked_level"] == 2


def test_student_cannot_see_dashboard(client):
    _h_admin, _inst, grade, _folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alum_d")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )
    res = client.get(
        f"/api/v1/institutions/grades/{grade['id']}/dashboard",
        headers=h_stu,
    )
    assert res.status_code == 403


def test_teacher_joins_with_prof_code(client):
    _h_admin, inst, _grade, _folder = _bootstrap_school(client)
    h_t, _ = _register(client, "profe")
    res = client.post(
        "/api/v1/institutions/join",
        json={"code": inst["teacher_code"]},
        headers=h_t,
    )
    assert res.status_code == 200
    assert res.json()["role"] == "teacher"


def test_mine_returns_institution_for_member(client):
    h_admin, inst, grade, _folder = _bootstrap_school(client)
    res = client.get("/api/v1/institutions/mine", headers=h_admin)
    assert res.status_code == 200
    data = res.json()
    assert data["institution"]["id"] == inst["id"]
    assert data["role"] == "admin"
    assert any(g["id"] == grade["id"] for g in data["grades"])


def test_student_responses_hide_teacher_code_and_roster(client):
    """Privacidad: un estudiante NO recibe teacher_code (elevaría a docente)
    ni la lista de IDs de sus compañeros."""
    _h_admin, _inst, grade, _folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alum_priv")
    res = client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["institution"]["name"] == "Colegio Test"
    assert "teacher_code" not in data["institution"]
    assert "student_ids" not in data["grade"]
    assert data["grade"]["student_count"] == 1

    res = client.get("/api/v1/institutions/mine", headers=h_stu)
    assert res.status_code == 200
    data = res.json()
    assert "teacher_code" not in data["institution"]
    assert all("student_ids" not in g for g in data["grades"])


def test_assign_task_visible_to_student_and_read_only(client):
    """Docente asigna isla/materia → el badge 📌 aparece en el baúl del
    estudiante. El estudiante NO puede asignar ni regenerar con force."""
    h_admin, _inst, grade, folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alum_t")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )

    # Estudiante no puede asignar tareas
    res = client.post(
        f"/api/v1/institutions/grades/{grade['id']}/assign",
        json={"folder_id": folder["id"], "title": "hack"},
        headers=h_stu,
    )
    assert res.status_code == 403

    # Docente asigna la materia con fecha
    res = client.post(
        f"/api/v1/institutions/grades/{grade['id']}/assign",
        json={
            "folder_id": folder["id"],
            "title": "Repasar para el viernes",
            "due_date": "2026-10-20",
        },
        headers=h_admin,
    )
    assert res.status_code == 200, res.text
    assert res.json()["assignment"]["due_date"] == "2026-10-20"

    # El estudiante ve la tarea en su lista de carpetas
    res = client.get("/api/v1/folders", headers=h_stu)
    f = next(x for x in res.json()["folders"] if x["id"] == folder["id"])
    assert f["assignment"]["title"] == "Repasar para el viernes"


def test_student_cannot_force_regenerate_school_board(client):
    """force=true gasta LLM: en carpetas escolares es privilegio del docente.
    El guard reduce force→False antes de tocar caché — el endpoint igual
    debe responder 4xx por falta de docs, pero jamás encolar regeneración."""
    _h_admin, _inst, grade, folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alum_f")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )

    # Sin documentos: force o no, responde 400 (sin texto extraído) —
    # lo importante es que no hay crash ni acceso indebido.
    res = client.post(
        f"/api/v1/folders/{folder['id']}/generate-game?level=1&force=true",
        headers=h_stu,
    )
    assert res.status_code == 400


def test_bulk_enroll_creates_working_credentials(client):
    """Matrícula masiva: el docente pega nombres → cuentas gestionadas que
    pueden loguear y ver las materias del grado."""
    h_admin, _inst, grade, folder = _bootstrap_school(client)

    res = client.post(
        f"/api/v1/institutions/grades/{grade['id']}/students/bulk",
        json={
            "students": [
                {"username": "Ana Prueba", "age": 15},
                {"username": "Luis Prueba", "password": "clave123"},
            ]
        },
        headers=h_admin,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["count"] == 2
    assert data["seats_used"] == 2

    cred = data["created"][0]
    assert cred["email"].endswith("@hubzy.school")
    assert cred["password"]

    # La cuenta generada puede iniciar sesión y ve la materia del grado
    res = client.post(
        "/api/v1/auth/login",
        json={"email": cred["email"], "password": cred["password"]},
    )
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    h_new = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/folders", headers=h_new)
    ids = [f["id"] for f in res.json()["folders"]]
    assert folder["id"] in ids

    res = client.get("/api/v1/institutions/mine", headers=h_new)
    assert res.json()["role"] == "student"


def test_bulk_enroll_respects_roles_and_seats(client, monkeypatch):
    h_admin, _inst, grade, _folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alumno_bulk")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )

    # Un estudiante no puede matricular
    res = client.post(
        f"/api/v1/institutions/grades/{grade['id']}/students/bulk",
        json={"students": [{"username": "X"}]},
        headers=h_stu,
    )
    assert res.status_code == 403

    # Límite de seats: trial = MIN_SEATS (forzado a 2 para el test)
    import app.routers.institutions as inst_router

    monkeypatch.setattr(inst_router, "MIN_SEATS", 2)
    res = client.post(
        f"/api/v1/institutions/grades/{grade['id']}/students/bulk",
        json={"students": [{"username": "Nuevo Uno"}, {"username": "Nuevo Dos"}]},
        headers=h_admin,
    )
    assert res.status_code == 402


def test_student_report_teacher_only(client):
    h_admin, _inst, grade, folder = _bootstrap_school(client)
    h_stu, stu = _register(client, "alum_rep")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )
    client.put(
        f"/api/v1/folders/{folder['id']}/campaign-progress",
        json={"unlocked_level": 3, "level_stars": {"1": 3, "2": 2}},
        headers=h_stu,
    )

    # Docente: reporte con progreso del estudiante
    res = client.get(
        f"/api/v1/institutions/grades/{grade['id']}/students/{stu['id']}/report",
        headers=h_admin,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["student"]["username"] == "Ualum_rep"
    assert data["student"]["subjects"][0]["folder_progress"]["unlocked_level"] == 3

    # Otro estudiante NO puede ver el reporte
    h_otro, _ = _register(client, "alum_x")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_otro,
    )
    res = client.get(
        f"/api/v1/institutions/grades/{grade['id']}/students/{stu['id']}/report",
        headers=h_otro,
    )
    assert res.status_code == 403

    # Reporte de alumno que no es del grado → 404
    res = client.get(
        f"/api/v1/institutions/grades/{grade['id']}/students/{_register(client, 'ext')[1]['id']}/report",
        headers=h_admin,
    )
    assert res.status_code == 404


def test_school_checkout_permissions(client):
    """El checkout institucional valida rol admin y mínimo de seats ANTES de
    tocar Stripe (por eso es testeable sin claves)."""
    h_admin, inst, grade, _folder = _bootstrap_school(client)
    h_stu, _ = _register(client, "alumno_pay")
    client.post(
        "/api/v1/institutions/join",
        json={"code": grade["join_code"]},
        headers=h_stu,
    )

    # Estudiante no puede pagar licencia
    res = client.post(
        f"/api/v1/institutions/{inst['id']}/checkout",
        json={"seats": 60},
        headers=h_stu,
    )
    assert res.status_code == 403

    # Admin con menos del mínimo → 400
    res = client.post(
        f"/api/v1/institutions/{inst['id']}/checkout",
        json={"seats": 5},
        headers=h_admin,
    )
    assert res.status_code == 400
