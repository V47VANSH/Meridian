"""Tests for AI Assistant endpoint and intent processing."""

from fastapi.testclient import TestClient


def test_ai_assistant_requires_authentication(client: TestClient):
    """Unauthenticated requests to AI endpoint are rejected with 401."""
    response = client.post(
        "/api/v1/ai/assistant",
        json={"prompt": "I want to book the clubhouse"},
    )
    assert response.status_code == 401


def test_ai_assistant_resident_booking_intent(client: TestClient, login):
    """Resident sending booking prompt gets AI response with booking card."""
    response = client.post(
        "/api/v1/ai/assistant",
        json={"prompt": "I want to book the clubhouse for tomorrow"},
        headers=login("resident"),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "reply" in data
    assert data["card_type"] == "booking"
    assert "provider" in data


def test_ai_assistant_resident_complaint_intent(client: TestClient, login):
    """Resident reporting an issue receives a complaint card."""
    response = client.post(
        "/api/v1/ai/assistant",
        json={"prompt": "Water is leaking from my bathroom ceiling, please report complaint"},
        headers=login("resident"),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "reply" in data
    assert data["card_type"] == "complaint"


def test_ai_assistant_resident_guestpass_intent(client: TestClient, login):
    """Resident requesting a visitor pass receives a guestpass card."""
    response = client.post(
        "/api/v1/ai/assistant",
        json={"prompt": "Create a visitor pass for my guest Ramesh"},
        headers=login("resident"),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["card_type"] == "guestpass"


def test_ai_assistant_official_directory_intent(client: TestClient, login):
    """Society Official requesting directory gets residentDirectory card."""
    response = client.post(
        "/api/v1/ai/assistant",
        json={"prompt": "Show me the resident directory records"},
        headers=login("official"),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["card_type"] == "residentDirectory"


def test_ai_assistant_security_guard_verify_intent(client: TestClient, login):
    """Security Guard requesting visitor verification gets verifyPass card."""
    response = client.post(
        "/api/v1/ai/assistant",
        json={"prompt": "Verify visitor pass for guest at gate"},
        headers=login("guard"),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["card_type"] == "verifyPass"


def test_ai_assistant_empty_prompt_validation(client: TestClient, login):
    """Empty prompt fails validation with 422."""
    response = client.post(
        "/api/v1/ai/assistant",
        json={"prompt": ""},
        headers=login("resident"),
    )
    assert response.status_code == 422
