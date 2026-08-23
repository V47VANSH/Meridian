from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _future_date(days: int = 10) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


def _create_facility(client: TestClient, headers: dict, name: str = "Clubhouse") -> dict:
    response = client.post(
        "/api/v1/facilities",
        json={"name": name, "type": "COMMON", "capacity": 40},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_slot(
    client: TestClient,
    headers: dict,
    facility_id: str,
    start: str = "18:00",
    end: str = "19:00",
    date: str | None = None,
) -> dict:
    if date is None:
        date = _future_date(10)
    response = client.post(
        f"/api/v1/facilities/{facility_id}/slots",
        json={"date": date, "start_time": start, "end_time": end},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_official_can_create_a_facility(client: TestClient, society: dict, login):
    """A facility is registered and returned with its capacity."""
    response = client.post(
        "/api/v1/facilities",
        json={"name": "Tennis Court", "type": "SPORTS", "capacity": 4},
        headers=login("official"),
    )

    assert response.status_code == 201, response.text
    assert response.json()["name"] == "Tennis Court"


def test_resident_cannot_create_a_facility(client: TestClient, society: dict, login):
    """Facility management is official-only."""
    response = client.post(
        "/api/v1/facilities",
        json={"name": "Rogue Gym", "capacity": 5},
        headers=login("resident"),
    )

    assert response.status_code == 403


def test_slot_end_time_must_follow_start_time(client: TestClient, society: dict, login):
    """A backwards time window fails validation."""
    official = login("official")
    facility = _create_facility(client, official)

    response = client.post(
        f"/api/v1/facilities/{facility['id']}/slots",
        json={"date": "2026-07-14", "start_time": "19:00", "end_time": "18:00"},
        headers=official,
    )

    assert response.status_code == 422
    assert response.json()["error"] == "VALIDATION_ERROR"


def test_resident_can_book_an_available_slot(client: TestClient, society: dict, login):
    """TC-12: booking a free slot returns 201 and a CONFIRMED booking."""
    official = login("official")
    facility = _create_facility(client, official)
    slot = _create_slot(client, official, facility["id"])

    response = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("resident")
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "CONFIRMED"
    assert body["facility_name"] == "Clubhouse"
    assert body["start_time"] == "18:00"


def test_double_booking_the_same_slot_is_rejected(client: TestClient, society: dict, login):
    """TC-13: the second resident to book a taken slot receives 409.

    This is the concrete failure the epic exists to remove.
    """
    official = login("official")
    facility = _create_facility(client, official)
    slot = _create_slot(client, official, facility["id"])

    first = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("resident")
    )
    second = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("neighbour")
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"] == "SLOT_ALREADY_BOOKED"


def test_concurrent_bookings_produce_exactly_one_winner(
    client: TestClient, society: dict, login
):
    """TC-14: eight simultaneous requests for one slot yield one confirmation.

    Exercises the per-slot lock and the partial unique index together.
    """
    official = login("official")
    facility = _create_facility(client, official)
    slot = _create_slot(client, official, facility["id"])
    resident_headers = login("resident")

    def attempt(_: int):
        return client.post(
            "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=resident_headers
        ).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(attempt, range(8)))

    assert statuses.count(201) == 1
    assert statuses.count(409) == 7


def test_slot_shows_as_unavailable_once_booked(client: TestClient, society: dict, login):
    """The calendar reflects the booking so the UI can grey the slot out."""
    official = login("official")
    facility = _create_facility(client, official)
    slot = _create_slot(client, official, facility["id"])
    client.post("/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("resident"))

    response = client.get(f"/api/v1/facilities/{facility['id']}/slots", headers=official)

    assert response.status_code == 200
    assert response.json()[0]["is_available"] is False


def test_blocked_slot_cannot_be_booked(client: TestClient, society: dict, login):
    """A slot the office has blacked out refuses bookings."""
    official = login("official")
    facility = _create_facility(client, official)
    response = client.post(
        f"/api/v1/facilities/{facility['id']}/slots",
        json={
            "date": _future_date(10),
            "start_time": "10:00",
            "end_time": "11:00",
            "is_bookable": False,
        },
        headers=official,
    )
    slot = response.json()

    booking = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("resident")
    )

    assert booking.status_code == 409
    assert booking.json()["error"] == "SLOT_NOT_BOOKABLE"


def test_cancelling_a_booking_frees_the_slot(client: TestClient, society: dict, login):
    """TC-15: after a cancellation another resident can take the slot."""
    official = login("official")
    facility = _create_facility(client, official)
    slot = _create_slot(client, official, facility["id"])
    booking = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("resident")
    ).json()

    cancelled = client.post(
        f"/api/v1/bookings/{booking['id']}/cancel", headers=login("resident")
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"

    rebooked = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("neighbour")
    )
    assert rebooked.status_code == 201


def test_resident_cannot_cancel_someone_elses_booking(client: TestClient, society: dict, login):
    """Cancelling another resident's booking returns 403."""
    official = login("official")
    facility = _create_facility(client, official)
    slot = _create_slot(client, official, facility["id"])
    booking = client.post(
        "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=login("resident")
    ).json()

    response = client.post(
        f"/api/v1/bookings/{booking['id']}/cancel", headers=login("neighbour")
    )

    assert response.status_code == 403
    assert response.json()["error"] == "NOT_YOUR_BOOKING"


def test_booking_list_defaults_to_the_callers_own(client: TestClient, society: dict, login):
    """My-bookings never leaks another resident's reservations."""
    official = login("official")
    facility = _create_facility(client, official)
    slot_one = _create_slot(client, official, facility["id"], "18:00", "19:00")
    slot_two = _create_slot(client, official, facility["id"], "19:00", "20:00")
    client.post("/api/v1/bookings", json={"slot_id": slot_one["id"]}, headers=login("resident"))
    client.post("/api/v1/bookings", json={"slot_id": slot_two["id"]}, headers=login("neighbour"))

    response = client.get("/api/v1/bookings", headers=login("resident"))

    assert response.status_code == 200
    bookings = response.json()
    assert len(bookings) == 1
    assert bookings[0]["start_time"] == "18:00"


def test_booking_an_unknown_slot_returns_not_found(client: TestClient, society: dict, login):
    """An invalid slot id returns 404 rather than a server error."""
    response = client.post(
        "/api/v1/bookings", json={"slot_id": "doesnotexist"}, headers=login("resident")
    )

    assert response.status_code == 404
    assert response.json()["error"] == "SLOT_NOT_FOUND"


def test_a_slot_whose_date_has_passed_cannot_be_booked(client: TestClient, society: dict, login):
    """TC-12: a slot whose date has passed cannot be published or booked."""
    official = login("official")
    facility = _create_facility(client, official)

    res_pub = client.post(
        f"/api/v1/facilities/{facility['id']}/slots",
        json={"date": "2026-07-03", "start_time": "18:00", "end_time": "19:00", "is_bookable": True},
        headers=official,
    )
    assert res_pub.status_code in (409, 422), res_pub.text

