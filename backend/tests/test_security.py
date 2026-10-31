"""
Tests de seguridad y privacidad: IDOR entre usuarios, límites freemium,
webhook de Stripe y derecho de supresión de cuenta.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _register(client, tag="sec"):
    email = f"pytest_{tag}_{uuid.uuid4().hex[:8]}@hubzy.dev"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "secreto123",
            "username": f"User{tag}",
            "gender": "femenino",
            "age": 21,
        },
    )
    assert res.status_code == 200
    data = res.json()
    return {"Authorization": f"Bearer {data['token']}"}, data["user"]


@pytest.fixture
def user_a(client):
    return _register(client, "a")


@pytest.fixture
def user_b(client):
    return _register(client, "b")


# ---------------------------------------------------------------------
# Anti-IDOR: un usuario no puede tocar recursos de otro
# ---------------------------------------------------------------------


def test_user_b_cannot_add_docs_to_user_a_folder(client, user_a, user_b):
    headers_a, _ = user_a
    headers_b, _ = user_b

    res = client.post("/api/v1/folders", json={"name": "Carpeta A"}, headers=headers_a)
    assert res.status_code == 201
    folder_id = res.json()["id"]

    res = client.post(
        f"/api/v1/folders/{folder_id}/documents",
        json={"documents": [{"id": "d1", "name": "apunte.txt"}]},
        headers=headers_b,
    )
    assert res.status_code == 403


def test_user_b_cannot_delete_user_a_folder(client, user_a, user_b):
    headers_a, _ = user_a
    headers_b, _ = user_b

    res = client.post("/api/v1/folders", json={"name": "Carpeta A"}, headers=headers_a)
    folder_id = res.json()["id"]

    res = client.delete(f"/api/v1/folders/{folder_id}", headers=headers_b)
    assert res.status_code == 403

    # La carpeta sigue existiendo para su dueño
    res = client.get("/api/v1/folders", headers=headers_a)
    assert any(f["id"] == folder_id for f in res.json()["folders"])


def test_user_b_cannot_upload_to_user_a_folder(client, user_a, user_b):
    headers_a, _ = user_a
    headers_b, _ = user_b

    res = client.post("/api/v1/folders", json={"name": "Carpeta A"}, headers=headers_a)
    folder_id = res.json()["id"]

    res = client.post(
        f"/api/v1/folders/{folder_id}/upload-document",
        files={"file": ("notas.txt", b"texto de estudio de ejemplo", "text/plain")},
        headers=headers_b,
    )
    assert res.status_code == 403


def test_user_b_cannot_generate_game_from_user_a_folder(client, user_a, user_b):
    headers_a, _ = user_a
    headers_b, _ = user_b

    res = client.post("/api/v1/folders", json={"name": "Carpeta A"}, headers=headers_a)
    folder_id = res.json()["id"]

    res = client.post(
        f"/api/v1/folders/{folder_id}/generate-game",
        headers=headers_b,
    )
    assert res.status_code == 403


def test_profile_of_other_user_forbidden(client, user_a, user_b):
    headers_b, _ = user_b
    _, user_a_data = user_a

    res = client.get(f"/api/v1/users/{user_a_data['id']}", headers=headers_b)
    assert res.status_code == 403


# ---------------------------------------------------------------------
# Límites freemium
# ---------------------------------------------------------------------


def test_free_plan_folder_limit(client, user_a):
    headers_a, _ = user_a
    for i in range(3):
        res = client.post("/api/v1/folders", json={"name": f"Carpeta {i}"}, headers=headers_a)
        assert res.status_code == 201, res.text

    res = client.post("/api/v1/folders", json={"name": "Carpeta extra"}, headers=headers_a)
    assert res.status_code == 402


# ---------------------------------------------------------------------
# Webhook de Stripe
# ---------------------------------------------------------------------


def test_webhook_never_accepts_unsigned_payload(client):
    """El webhook jamás debe aceptar un evento sin firma válida."""
    res = client.post(
        "/api/v1/payments/webhook",
        content=b'{"type": "checkout.session.completed", "data": {"object": {"client_reference_id": "x"}}}',
        headers={"Content-Type": "application/json"},
    )
    # 400 firma inválida / 500 sin secret configurado — nunca 200
    assert res.status_code in (400, 500)


# ---------------------------------------------------------------------
# Derecho de supresión (datos sensibles de salud mental)
# ---------------------------------------------------------------------


def test_delete_account_removes_user_and_folders(client, user_a):
    headers_a, _user = user_a

    res = client.post("/api/v1/folders", json={"name": "Carpeta personal"}, headers=headers_a)
    assert res.status_code == 201

    res = client.delete("/api/v1/users/me", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "account_deleted"

    # El token ya no resuelve a ningún usuario
    res = client.get("/api/v1/auth/me", headers=headers_a)
    assert res.status_code == 401


def test_delete_account_requires_auth(client):
    res = client.delete("/api/v1/users/me")
    assert res.status_code in (401, 403)
