"""
Tests del flujo de autenticación JWT + protección de endpoints.
Usan el almacén en memoria (sin MongoDB) — deterministas y rápidos.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def registered_user(client):
    email = f"pytest_{uuid.uuid4().hex[:8]}@hubzy.dev"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "secreto123",
            "username": "PytestUser",
            "gender": "femenino",
            "age": 21,
        },
    )
    assert res.status_code == 200
    data = res.json()
    data["email"] = email
    return data


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_register_returns_jwt(registered_user):
    token = registered_user["token"]
    assert len(token) > 50  # JWT real, no hex corto
    assert registered_user["user"]["username"] == "PytestUser"


def test_register_duplicate_email(client, registered_user):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": registered_user["email"],
            "password": "otro123",
            "username": "Otro",
            "gender": "masculino",
            "age": 30,
        },
    )
    assert res.status_code == 400


def test_login_ok(client, registered_user):
    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_user["email"],
            "password": "secreto123",
        },
    )
    assert res.status_code == 200
    assert res.json()["token"]


def test_login_wrong_password(client, registered_user):
    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_user["email"],
            "password": "mala",
        },
    )
    assert res.status_code == 401


def test_me_requires_token(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code in (401, 403)


def test_me_with_token(client, registered_user):
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {registered_user['token']}"},
    )
    assert res.status_code == 200
    assert res.json()["email"] == registered_user["email"]


def test_me_invalid_token(client):
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer token-falso"},
    )
    assert res.status_code == 401


def test_folders_scoped_to_token_user(client, registered_user):
    """Anti-IDOR: el user_id de la query NO debe poder suplantar al del token."""
    headers = {"Authorization": f"Bearer {registered_user['token']}"}

    # Crear carpeta propia
    res = client.post("/api/v1/folders", json={"name": "Mi Carpeta"}, headers=headers)
    assert res.status_code == 201
    folder = res.json()
    assert folder["user_id"] == registered_user["user"]["id"]

    # Aunque pida user_id ajeno, solo ve sus carpetas
    res = client.get("/api/v1/folders?user_id=otro_usuario", headers=headers)
    assert res.status_code == 200
    assert len(res.json()["folders"]) >= 1


def test_crisis_resources_public(client):
    res = client.get("/api/v1/psychology/crisis-resources")
    assert res.status_code == 200
    assert isinstance(res.json()["resources"], list)


def test_psychology_analyze_crisis_detection(client):
    """El detector heurístico debe marcar crisis sin necesidad de IA."""
    res = client.post(
        "/api/v1/psychology/analyze",
        json={
            "text": "no puedo más, me quiero morir",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_crisis"] is True
    assert data["stress_category"] == "crisis"


# ---------------------------------------------------------------------
# Flujos de email: verificación y reset de contraseña
# ---------------------------------------------------------------------


def test_verify_email_flow(client, registered_user):
    """El token de verificación marca email_verified en el perfil."""
    from app.core.security import create_purpose_token

    uid = registered_user["user"]["id"]
    email = registered_user["email"]
    token = create_purpose_token(uid, email, "verify_email", 60)

    res = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert res.status_code == 200

    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    resend = client.post("/api/v1/auth/resend-verification", headers=headers)
    assert resend.status_code == 200
    assert "ya está verificado" in resend.json()["detail"]


def test_verify_email_rejects_wrong_purpose(client, registered_user):
    """Un token de reset no sirve para verificar email."""
    from app.core.security import create_purpose_token

    uid = registered_user["user"]["id"]
    email = registered_user["email"]
    bad = create_purpose_token(uid, email, "reset_password", 60)

    res = client.post("/api/v1/auth/verify-email", json={"token": bad})
    assert res.status_code == 400


def test_forgot_password_no_enumeration(client):
    """Email inexistente también devuelve 200 genérico (anti-enumeración)."""
    res = client.post("/api/v1/auth/forgot-password", json={"email": "fantasma@x.com"})
    assert res.status_code == 200


def test_reset_password_flow(client, registered_user):
    """Reset token → nueva contraseña → login con la nueva funciona."""
    from app.core.security import create_purpose_token

    uid = registered_user["user"]["id"]
    email = registered_user["email"]
    token = create_purpose_token(uid, email, "reset_password", 60)

    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "nuevaClave456"},
    )
    assert res.status_code == 200

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "nuevaClave456"},
    )
    assert login.status_code == 200

    # La contraseña vieja ya no funciona
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "secreto123"},
    )
    assert old_login.status_code == 401


def test_reset_password_rejects_bad_token(client):
    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "token-falso-de-verdad", "new_password": "cualquiera1"},
    )
    assert res.status_code == 400


def test_purpose_tokens_are_single_use(client, registered_user):
    """Un token de propósito canjeado no puede volver a usarse."""
    from app.core.security import create_purpose_token

    uid = registered_user["user"]["id"]
    email = registered_user["email"]

    verify_token = create_purpose_token(uid, email, "verify_email", 60)
    res = client.post("/api/v1/auth/verify-email", json={"token": verify_token})
    assert res.status_code == 200
    # Segundo uso del MISMO token → rechazado
    res = client.post("/api/v1/auth/verify-email", json={"token": verify_token})
    assert res.status_code == 400

    reset_token = create_purpose_token(uid, email, "reset_password", 60)
    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "otraClave789"},
    )
    assert res.status_code == 200
    # Reutilizar el enlace de reset → rechazado
    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "otraClave999"},
    )
    assert res.status_code == 400
