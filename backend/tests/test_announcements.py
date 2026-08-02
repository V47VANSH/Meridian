"""Announcement and notification API tests."""

from fastapi.testclient import TestClient


def _post_announcement(
    client: TestClient, headers: dict, title: str = "Water supply interruption", audience: str = "ALL"
) -> dict:
    response = client.post(
        "/api/v1/announcements",
        json={
            "title": title,
            "body": "Water supply will be suspended from 10 AM to 1 PM for tank cleaning.",
            "audience": audience,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_official_can_post_an_announcement(client: TestClient, society: dict, login):
    """TC-21: an official publishes a notice to the whole society."""
    response = client.post(
        "/api/v1/announcements",
        json={
            "title": "Annual General Meeting",
            "body": "The AGM will be held at the Community Hall at 6 PM.",
            "audience": "ALL",
        },
        headers=login("official"),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Annual General Meeting"
    assert body["audience"] == "ALL"
    assert body["posted_by"] == society["official_id"]


def test_resident_cannot_post_an_announcement(client: TestClient, society: dict, login):
    """Publishing is an official-only action."""
    response = client.post(
        "/api/v1/announcements",
        json={"title": "Unofficial notice", "body": "Posted by a resident.", "audience": "ALL"},
        headers=login("resident"),
    )

    assert response.status_code == 403


def test_announcement_title_is_validated(client: TestClient, society: dict, login):
    """An empty title is rejected before anything is published."""
    response = client.post(
        "/api/v1/announcements",
        json={"title": "", "body": "Body text", "audience": "ALL"},
        headers=login("official"),
    )

    assert response.status_code == 422


def test_everyone_sees_an_all_audience_announcement(client: TestClient, society: dict, login):
    """TC-22: an ALL notice reaches residents, owners and staff alike."""
    _post_announcement(client, login("official"))

    for who in ("resident", "owner", "guard", "staff"):
        response = client.get("/api/v1/announcements", headers=login(who))
        assert response.status_code == 200
        assert len(response.json()) == 1, f"{who} could not see the announcement"


def test_audience_filter_hides_notices_from_other_roles(client: TestClient, society: dict, login):
    """A STAFF-only notice is not shown to residents."""
    _post_announcement(client, login("official"), title="Staff rota change", audience="STAFF")

    staff_view = client.get("/api/v1/announcements", headers=login("staff"))
    resident_view = client.get("/api/v1/announcements", headers=login("resident"))

    assert len(staff_view.json()) == 1
    assert resident_view.json() == []


def test_non_resident_owner_sees_owner_notices(client: TestClient, society: dict, login):
    """A remote owner follows notices addressed to non-resident owners."""
    _post_announcement(
        client, login("official"), title="Owner dues revision", audience="NON_RESIDENT_OWNERS"
    )

    owner_view = client.get("/api/v1/announcements", headers=login("owner"))
    resident_view = client.get("/api/v1/announcements", headers=login("resident"))

    assert len(owner_view.json()) == 1
    assert resident_view.json() == []


def test_posting_an_announcement_notifies_recipients(client: TestClient, society: dict, login):
    """Publishing pushes a notification into each recipient's feed."""
    _post_announcement(client, login("official"))

    feed = client.get("/api/v1/notifications", headers=login("resident"))

    assert feed.status_code == 200
    assert any(n["type"] == "ANNOUNCEMENT_POSTED" for n in feed.json())


def test_notification_feed_only_returns_the_callers_own(
    client: TestClient, society: dict, login
):
    """TC-23: one user's feed never contains another user's notifications."""
    _post_announcement(client, login("official"))

    resident_feed = client.get("/api/v1/notifications", headers=login("resident")).json()

    assert resident_feed
    assert all(n["user_id"] == society["resident_id"] for n in resident_feed)


def test_marking_a_notification_read_clears_it_from_unread(
    client: TestClient, society: dict, login
):
    """TC-24: a read notification drops out of the unread filter."""
    _post_announcement(client, login("official"))
    resident = login("resident")
    unread = client.get("/api/v1/notifications?unread_only=true", headers=resident).json()
    assert len(unread) == 1

    marked = client.post(f"/api/v1/notifications/{unread[0]['id']}/read", headers=resident)
    assert marked.status_code == 200
    assert marked.json()["read_at"] is not None

    remaining = client.get("/api/v1/notifications?unread_only=true", headers=resident).json()
    assert remaining == []


def test_cannot_mark_another_users_notification_read(client: TestClient, society: dict, login):
    """Touching someone else's notification returns 403."""
    _post_announcement(client, login("official"))
    resident_notification = client.get(
        "/api/v1/notifications", headers=login("resident")
    ).json()[0]

    response = client.post(
        f"/api/v1/notifications/{resident_notification['id']}/read", headers=login("neighbour")
    )

    assert response.status_code == 403
    assert response.json()["error"] == "NOT_YOUR_NOTIFICATION"
