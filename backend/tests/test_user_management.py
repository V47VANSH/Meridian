"""Tests for user creation by Society Official and user directory management."""

from fastapi.testclient import TestClient


def test_official_can_create_new_user_and_link_flat(client: TestClient, society: dict, login):
    """Society Official creates a new resident user and links them to flat A-102."""
    response = client.post(
        "/api/v1/users",
        json={
            "email": "aarav.sharma@greenvalley.example",
            "password": "Password123",
            "full_name": "Aarav Sharma",
            "phone": "9800000010",
            "role": "RESIDENT_OWNER",
            "flat_id": society["flat_a_id"],
            "relation": "OWNER",
        },
        headers=login("official"),
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["email"] == "aarav.sharma@greenvalley.example"
    assert data["full_name"] == "Aarav Sharma"
    assert data["role"] == "RESIDENT_OWNER"


def test_resident_cannot_create_users(client: TestClient, login):
    """Resident accounts are forbidden from adding new users."""
    response = client.post(
        "/api/v1/users",
        json={
            "email": "hacker@example.com",
            "password": "Password123",
            "full_name": "Illegal User",
            "role": "RESIDENT_OWNER",
        },
        headers=login("resident"),
    )
    assert response.status_code == 403


def test_duplicate_user_creation_is_rejected(client: TestClient, login):
    """Creating a user with an email already present in society fails with 409."""
    # Try creating user with official's email
    response = client.post(
        "/api/v1/users",
        json={
            "email": "official@greenvalley.example",
            "password": "Password123",
            "full_name": "Duplicate Official",
            "role": "SOCIETY_OFFICIAL",
        },
        headers=login("official"),
    )
    assert response.status_code == 409
    assert response.json()["error"] == "USER_ALREADY_EXISTS"


def test_list_users_includes_created_user(client: TestClient, login):
    """GET /users lists all users in the society including newly created ones."""
    # Create user
    client.post(
        "/api/v1/users",
        json={
            "email": "rohan.verma@greenvalley.example",
            "password": "Password123",
            "full_name": "Rohan Verma",
            "phone": "9800000013",
            "role": "RESIDENT_OWNER",
        },
        headers=login("official"),
    )

    response = client.get("/api/v1/users", headers=login("official"))
    assert response.status_code == 200, response.text
    emails = [u["email"] for u in response.json()]
    assert "rohan.verma@greenvalley.example" in emails
