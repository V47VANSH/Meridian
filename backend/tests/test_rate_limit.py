"""Rate limiting (docs/02-backend-architecture.md §4).

The suite runs with the ceilings lifted (see `conftest.py`) so that no ordinary
test trips them. These tests lower the ceilings deliberately and assert the
behaviour, so the control is genuinely covered rather than merely present.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from app.core import ratelimit
from app.core.config import settings


def _login_body(email: str = "resident@greenvalley.example") -> dict:
    return {"email": email, "password": "wrong-password"}


def test_auth_endpoint_throttles_after_its_limit(client: TestClient, society, monkeypatch):
    """Repeated login attempts are refused once the window's allowance is spent.

    This is the case the control exists for: an attacker guessing passwords
    against a known address should be stopped by the endpoint, not by the
    password hash being slow.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH", 3)
    ratelimit.reset_for_tests()

    statuses = [
        client.post("/api/v1/auth/login", json=_login_body()).status_code
        for _ in range(5)
    ]

    # The first three are answered (401 — wrong password), the rest refused.
    assert statuses[:3] == [401, 401, 401]
    assert statuses[3:] == [429, 429]


def test_a_throttled_response_uses_the_standard_error_envelope(
    client: TestClient, society, monkeypatch
):
    """A 429 must be parseable by exactly the same client code as any other error."""
    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH", 1)
    ratelimit.reset_for_tests()

    client.post("/api/v1/auth/login", json=_login_body())
    refused = client.post("/api/v1/auth/login", json=_login_body())

    assert refused.status_code == 429
    body = refused.json()
    assert body["statusCode"] == 429
    assert body["error"] == "RATE_LIMITED"
    assert body["requestId"]
    assert "Retry-After" in refused.headers
    assert int(refused.headers["Retry-After"]) >= 1


def test_limits_are_per_bucket_not_global(client: TestClient, society, monkeypatch):
    """Exhausting the auth allowance must not lock the caller out of the whole API.

    The buckets are separate precisely so that a burst of failed logins cannot
    deny someone the ability to, say, read their invoices.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 100)
    ratelimit.reset_for_tests()

    client.post("/api/v1/auth/login", json=_login_body())
    assert client.post("/api/v1/auth/login", json=_login_body()).status_code == 429

    # A different bucket, so still served — 401 for want of a token, not 429.
    assert client.get("/api/v1/maintenance/invoices").status_code == 401


def test_each_path_is_routed_to_its_own_limit(monkeypatch):
    """The three buckets must be selected by path, not collapsed into one."""
    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH", 11)
    monkeypatch.setattr(settings, "RATE_LIMIT_SOS", 22)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 33)

    assert ratelimit.limit_for("/api/v1/auth/login") == 11
    assert ratelimit.limit_for("/api/v1/auth/refresh") == 11
    assert ratelimit.limit_for("/api/v1/sos") == 22
    assert ratelimit.limit_for("/api/v1/sos/abc/acknowledge") == 22
    assert ratelimit.limit_for("/api/v1/complaints") == 33
    assert ratelimit.limit_for("/api/v1/maintenance/invoices") == 33


def test_shipped_defaults_are_tighter_on_auth_and_sos():
    """The defaults a real deployment gets, not the ceilings this suite runs with.

    conftest raises every limit so ordinary tests never trip the middleware, and
    those values are baked in when `config` is imported — so reading `settings`
    or the `Settings` class from inside this process would assert nothing. A
    subprocess with those variables stripped resolves the actual defaults.
    """
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("RATE_LIMIT_")
    }
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.core.config import settings;"
            "print(settings.RATE_LIMIT_DEFAULT, settings.RATE_LIMIT_AUTH,"
            " settings.RATE_LIMIT_SOS, settings.RATE_LIMIT_ENABLED)",
        ],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr

    default, auth, sos, enabled = result.stdout.split()

    assert enabled == "True", "rate limiting must be on unless explicitly disabled"
    assert int(auth) < int(default), "auth should be tighter than general traffic"
    assert int(sos) < int(default), "sos should be tighter than general traffic"


def test_health_and_docs_are_exempt(client: TestClient, monkeypatch):
    """A monitor polling /health must never be able to lock itself out."""
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 1)
    ratelimit.reset_for_tests()

    for _ in range(5):
        assert client.get("/health").status_code == 200


def test_successful_responses_carry_the_remaining_allowance(
    client: TestClient, monkeypatch
):
    """Clients can back off before being refused, rather than after."""
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT", 10)
    ratelimit.reset_for_tests()

    first = client.get("/api/v1/maintenance/invoices")
    assert first.headers["X-RateLimit-Limit"] == "10"
    assert first.headers["X-RateLimit-Remaining"] == "9"

    second = client.get("/api/v1/maintenance/invoices")
    assert second.headers["X-RateLimit-Remaining"] == "8"


def test_forwarded_header_is_ignored_unless_the_proxy_is_trusted(
    client: TestClient, society, monkeypatch
):
    """Otherwise a caller resets their own counter by varying a header they control."""
    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH", 2)
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", False)
    ratelimit.reset_for_tests()

    for index in range(2):
        response = client.post(
            "/api/v1/auth/login",
            json=_login_body(),
            headers={"X-Forwarded-For": f"10.0.0.{index}"},
        )
        assert response.status_code == 401

    spoofed = client.post(
        "/api/v1/auth/login",
        json=_login_body(),
        headers={"X-Forwarded-For": "10.0.0.99"},
    )
    assert spoofed.status_code == 429, "a spoofed forwarded-for reset the counter"


def test_trusted_proxy_headers_separate_callers(client: TestClient, society, monkeypatch):
    """Behind a trusted proxy, distinct clients must get distinct allowances.

    Without this, every user behind one proxy shares a single counter and the
    limiter becomes a shared outage rather than a per-caller control.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH", 1)
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", True)
    ratelimit.reset_for_tests()

    first = client.post(
        "/api/v1/auth/login", json=_login_body(), headers={"X-Forwarded-For": "203.0.113.1"}
    )
    assert first.status_code == 401

    # Same caller again — refused.
    assert (
        client.post(
            "/api/v1/auth/login",
            json=_login_body(),
            headers={"X-Forwarded-For": "203.0.113.1"},
        ).status_code
        == 429
    )

    # A different caller — served.
    assert (
        client.post(
            "/api/v1/auth/login",
            json=_login_body(),
            headers={"X-Forwarded-For": "203.0.113.2"},
        ).status_code
        == 401
    )
