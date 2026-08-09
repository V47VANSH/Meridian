"""Authentication API tests."""

from fastapi.testclient import TestClient

from tests.conftest import TEST_PASSWORD


def test_register_creates_resident_account(client: TestClient, society: dict):
    """TC-01: a valid registration returns 201 and the new user's profile."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_id": society["tenant_id"],
            "email": "newresident@greenvalley.example",
            "password": "StrongPass123",
            "full_name": "Kavya Menon",
            "phone": "9800000099",
            "role": "RESIDENT_OWNER",
            "flat_id": society["flat_a_id"],
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "newresident@greenvalley.example"
    assert body["role"] == "RESIDENT_OWNER"
    assert body["tenant_id"] == society["tenant_id"]
    assert body["status"] == "ACTIVE"
    # The hash must never appear in an API response.
    assert "password" not in body and "password_hash" not in body


def test_register_rejects_duplicate_email_in_same_society(client: TestClient, society: dict):
    """A second signup with an existing email returns 409, not a second account."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_id": society["tenant_id"],
            "email": society["emails"]["resident"],
            "password": "StrongPass123",
            "full_name": "Impostor",
            "role": "RESIDENT_OWNER",
        },
    )

    assert response.status_code == 409
    assert response.json()["error"] == "EMAIL_ALREADY_REGISTERED"


def test_register_rejects_short_password(client: TestClient, society: dict):
    """Passwords under 8 characters fail validation before any row is written."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_id": society["tenant_id"],
            "email": "weak@greenvalley.example",
            "password": "abc",
            "full_name": "Weak Password",
            "role": "RESIDENT_OWNER",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"] == "VALIDATION_ERROR"


def test_register_rejects_self_assigned_official_role(client: TestClient, society: dict):
    """Nobody can grant themselves society-admin rights at signup."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_id": society["tenant_id"],
            "email": "wannabe@greenvalley.example",
            "password": "StrongPass123",
            "full_name": "Wannabe Official",
            "role": "SOCIETY_OFFICIAL",
        },
    )

    assert response.status_code == 422


def test_login_returns_token_pair(client: TestClient, society: dict):
    """TC-02: correct credentials yield an access and refresh token."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": TEST_PASSWORD},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 15 * 60
    assert body["access_token"] and body["refresh_token"]


def test_login_with_wrong_password_is_rejected(client: TestClient, society: dict):
    """TC-03: a wrong password returns 401 and no token."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": "WrongPassword1"},
    )

    assert response.status_code == 401
    body = response.json()
    assert body["error"] == "INVALID_CREDENTIALS"
    assert "access_token" not in body


def test_login_does_not_reveal_whether_email_exists(client: TestClient, society: dict):
    """An unknown email and a wrong password return the identical error."""
    unknown = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@greenvalley.example", "password": TEST_PASSWORD},
    )
    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": "WrongPassword1"},
    )

    assert unknown.status_code == wrong_password.status_code == 401
    assert unknown.json()["message"] == wrong_password.json()["message"]


def test_me_returns_the_authenticated_profile(client: TestClient, society: dict, login):
    """The bearer token resolves to the user who logged in."""
    response = client.get("/api/v1/auth/me", headers=login("resident"))

    assert response.status_code == 200
    assert response.json()["email"] == society["emails"]["resident"]


def test_protected_route_requires_a_token(client: TestClient, society: dict):
    """Calling a protected route without a token returns 401."""
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"] == "UNAUTHORIZED"


def test_garbage_token_is_rejected(client: TestClient, society: dict):
    """A forged token fails signature verification."""
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not.a.real.token"}
    )

    assert response.status_code == 401
    assert response.json()["error"] == "INVALID_TOKEN"


def test_refresh_rotates_the_token_and_revokes_the_old_one(client: TestClient, society: dict):
    """A refresh token works once; reusing it afterwards is rejected."""
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": TEST_PASSWORD},
    )
    original_refresh = login_response.json()["refresh_token"]

    first = client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert first.status_code == 200
    assert first.json()["access_token"]

    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert replay.status_code == 401
    assert replay.json()["error"] == "TOKEN_REVOKED"


def test_refresh_token_cannot_be_used_as_an_access_token(client: TestClient, society: dict):
    """Presenting a refresh token as a bearer credential must fail."""
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": TEST_PASSWORD},
    )
    refresh_token = login_response.json()["refresh_token"]

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh_token}"}
    )

    assert response.status_code == 401
    assert response.json()["error"] == "INVALID_TOKEN"


def test_logout_revokes_the_refresh_token(client: TestClient, society: dict):
    """After logout the refresh token can no longer be rotated."""
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": TEST_PASSWORD},
    )
    tokens = login_response.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers=headers,
    )
    assert logout.status_code == 200

    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401


def test_every_error_uses_the_same_response_shape(client: TestClient, society: dict):
    """The uniform error contract holds, including the correlation id."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": "WrongPassword1"},
    )

    body = response.json()
    assert set(body) == {"statusCode", "error", "message", "requestId"}
    assert body["statusCode"] == 401
    assert body["requestId"] == response.headers["X-Request-Id"]
