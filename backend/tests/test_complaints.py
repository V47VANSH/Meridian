"""Complaint management API tests."""

from fastapi.testclient import TestClient


def _raise_complaint(
    client: TestClient,
    headers: dict,
    title: str = "Water leakage in basement parking",
    description: str = "Water is leaking from the ceiling near the B-block parking ramp.",
    **extra,
) -> dict:
    payload = {"title": title, "description": description, **extra}
    response = client.post("/api/v1/complaints", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_resident_can_raise_a_complaint(client: TestClient, society: dict, login):
    """TC-08: a new complaint is stored OPEN with its first history entry."""
    response = client.post(
        "/api/v1/complaints",
        json={
            "title": "Water leakage in basement parking",
            "description": "Water is leaking from the ceiling near the B-block parking ramp.",
            "flat_id": society["flat_b_id"],
        },
        headers=login("resident"),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "OPEN"
    assert body["assigned_to"] is None
    assert len(body["history"]) == 1
    assert body["history"][0]["status"] == "OPEN"


def test_complaint_is_auto_classified_from_its_text(client: TestClient, society: dict, login):
    """TC-09: the description drives category and urgency without user input.

    'leaking' points at PLUMBING; the classifier flags its own guess for
    manual triage because it is the rule-based fallback, not the model.
    """
    complaint = _raise_complaint(
        client,
        login("resident"),
        title="Tap leaking continuously",
        description="The kitchen tap is leaking and water is being wasted.",
    )

    assert complaint["category"] == "PLUMBING"
    assert complaint["urgency"] == "MEDIUM"
    assert complaint["needs_manual_triage"] is True


def test_emergency_wording_raises_urgency_to_high(client: TestClient, society: dict, login):
    """A complaint mentioning fire or gas is prioritised automatically."""
    complaint = _raise_complaint(
        client,
        login("resident"),
        title="Gas smell on the staircase",
        description="There is a strong gas smell near the staircase, this is an emergency.",
    )

    assert complaint["urgency"] == "HIGH"


def test_explicit_category_and_urgency_override_the_classifier(
    client: TestClient, society: dict, login
):
    """A caller who states both values is trusted over the classifier."""
    complaint = _raise_complaint(
        client,
        login("resident"),
        title="Lift stuck between floors",
        description="The lift in C block stopped between the second and third floor.",
        category="ELECTRICAL",
        urgency="HIGH",
    )

    assert complaint["category"] == "ELECTRICAL"
    assert complaint["urgency"] == "HIGH"
    assert complaint["needs_manual_triage"] is False


def test_complaint_description_must_be_meaningful(client: TestClient, society: dict, login):
    """A one-word description fails validation rather than creating noise."""
    response = client.post(
        "/api/v1/complaints",
        json={"title": "Broken", "description": "bad"},
        headers=login("resident"),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "VALIDATION_ERROR"


def test_resident_sees_only_their_own_complaints(client: TestClient, society: dict, login):
    """One resident's list never contains another resident's complaint."""
    _raise_complaint(client, login("resident"), title="Leaking tap in my kitchen")
    _raise_complaint(client, login("neighbour"), title="Noise from the terrace")

    response = client.get("/api/v1/complaints", headers=login("resident"))

    assert response.status_code == 200
    titles = [c["title"] for c in response.json()]
    assert titles == ["Leaking tap in my kitchen"]


def test_official_triage_queue_is_sorted_most_urgent_first(
    client: TestClient, society: dict, login
):
    """TC-10: the queue puts HIGH urgency complaints above LOW ones."""
    resident = login("resident")
    _raise_complaint(
        client,
        resident,
        title="Cosmetic paint chip",
        description="Minor cosmetic paint chip in the corridor, not urgent whenever convenient.",
    )
    _raise_complaint(
        client,
        resident,
        title="Sparking socket",
        description="The socket near the lift is sparking and there is a danger of fire.",
    )

    response = client.get("/api/v1/complaints", headers=login("official"))

    assert response.status_code == 200
    complaints = response.json()
    assert complaints[0]["urgency"] == "HIGH"
    assert complaints[0]["title"] == "Sparking socket"
    assert complaints[-1]["urgency"] == "LOW"


def test_official_can_assign_a_complaint_to_staff(client: TestClient, society: dict, login):
    """Assignment records the staff member and clears the triage flag."""
    complaint = _raise_complaint(client, login("resident"))

    response = client.post(
        f"/api/v1/complaints/{complaint['id']}/assign",
        json={"assigned_to": society["staff_id"]},
        headers=login("official"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["assigned_to"] == society["staff_id"]
    assert body["needs_manual_triage"] is False


def test_a_resident_cannot_be_assigned_a_complaint(client: TestClient, society: dict, login):
    """Only staff roles may be given work; assigning a resident is rejected."""
    complaint = _raise_complaint(client, login("resident"))

    response = client.post(
        f"/api/v1/complaints/{complaint['id']}/assign",
        json={"assigned_to": society["neighbour_id"]},
        headers=login("official"),
    )

    assert response.status_code == 400
    assert response.json()["error"] == "INVALID_ASSIGNEE"


def test_status_moves_through_the_lifecycle(client: TestClient, society: dict, login):
    """TC-11: OPEN → IN_PROGRESS → RESOLVED, each step appended to history."""
    complaint = _raise_complaint(client, login("resident"))
    staff = login("staff")

    in_progress = client.patch(
        f"/api/v1/complaints/{complaint['id']}/status",
        json={"status": "IN_PROGRESS", "note": "Plumber scheduled"},
        headers=staff,
    )
    assert in_progress.status_code == 200, in_progress.text
    assert in_progress.json()["status"] == "IN_PROGRESS"

    resolved = client.patch(
        f"/api/v1/complaints/{complaint['id']}/status",
        json={"status": "RESOLVED", "note": "Pipe replaced"},
        headers=staff,
    )
    assert resolved.status_code == 200
    body = resolved.json()
    assert body["status"] == "RESOLVED"
    assert body["resolved_at"] is not None
    assert [h["status"] for h in body["history"]] == ["OPEN", "IN_PROGRESS", "RESOLVED"]


def test_illegal_status_jump_is_rejected(client: TestClient, society: dict, login):
    """A complaint cannot go straight from OPEN to RESOLVED."""
    complaint = _raise_complaint(client, login("resident"))

    response = client.patch(
        f"/api/v1/complaints/{complaint['id']}/status",
        json={"status": "RESOLVED", "note": "Skipping ahead"},
        headers=login("staff"),
    )

    assert response.status_code == 400
    assert response.json()["error"] == "INVALID_STATUS_TRANSITION"


def test_resident_cannot_change_complaint_status(client: TestClient, society: dict, login):
    """Residents raise complaints; only staff and officials progress them."""
    complaint = _raise_complaint(client, login("resident"))

    response = client.patch(
        f"/api/v1/complaints/{complaint['id']}/status",
        json={"status": "RESOLVED", "note": "Marking my own complaint done"},
        headers=login("resident"),
    )

    assert response.status_code == 403


def test_resident_cannot_read_another_residents_complaint(
    client: TestClient, society: dict, login
):
    """Fetching someone else's complaint by id returns 403."""
    complaint = _raise_complaint(client, login("neighbour"))

    response = client.get(f"/api/v1/complaints/{complaint['id']}", headers=login("resident"))

    assert response.status_code == 403
    assert response.json()["error"] == "NOT_YOUR_COMPLAINT"


def test_unknown_complaint_returns_not_found(client: TestClient, society: dict, login):
    """A non-existent id returns a clean 404, not a server error."""
    response = client.get("/api/v1/complaints/doesnotexist", headers=login("official"))

    assert response.status_code == 404
    assert response.json()["error"] == "COMPLAINT_NOT_FOUND"


def test_needs_triage_filter_isolates_uncertain_classifications(
    client: TestClient, society: dict, login
):
    """Feedback item 3: an official wants to see what the system guessed at.

    Urgency ordering cannot surface these on its own — a complaint the
    classifier was unsure about is precisely the one whose urgency may be wrong.
    """
    resident = login("resident")

    # Keyword-matched, then confirmed by an explicit category and urgency, so
    # nothing was guessed.
    confident = client.post(
        "/api/v1/complaints",
        json={
            "title": "Basement tap leaking",
            "description": "The tap in the basement is leaking steadily.",
            "category": "PLUMBING",
            "urgency": "MEDIUM",
        },
        headers=resident,
    )
    assert confident.status_code == 201, confident.text
    assert confident.json()["needs_manual_triage"] is False

    # No category or urgency given, so the rule-based classifier guesses and
    # flags it for a human.
    guessed = client.post(
        "/api/v1/complaints",
        json={
            "title": "Something is off",
            "description": "There is a strange situation near the community hall.",
        },
        headers=resident,
    )
    assert guessed.status_code == 201, guessed.text
    assert guessed.json()["needs_manual_triage"] is True

    response = client.get("/api/v1/complaints?needs_triage=true", headers=login("official"))
    assert response.status_code == 200, response.text

    ids = [c["id"] for c in response.json()]
    assert ids == [guessed.json()["id"]]


def test_needs_triage_filter_is_off_by_default(client: TestClient, login):
    """Omitting the flag keeps the full queue, so the default view is unchanged."""
    resident = login("resident")
    for title in ("Lift is stuck", "Corridor light is out"):
        client.post(
            "/api/v1/complaints",
            json={"title": title, "description": f"{title} and needs attention."},
            headers=resident,
        )

    unfiltered = client.get("/api/v1/complaints", headers=login("official"))
    assert unfiltered.status_code == 200, unfiltered.text
    assert len(unfiltered.json()) == 2


def test_assigning_a_complaint_clears_it_from_the_triage_filter(
    client: TestClient, society: dict, login
):
    """Assignment is a human reviewing the classification, so the flag clears."""
    official = login("official")
    complaint_id = client.post(
        "/api/v1/complaints",
        json={"title": "Unclear issue", "description": "Hard to describe, please look."},
        headers=login("resident"),
    ).json()["id"]

    assert client.get("/api/v1/complaints?needs_triage=true", headers=official).json()

    assigned = client.post(
        f"/api/v1/complaints/{complaint_id}/assign",
        json={"assigned_to": society["staff_id"]},
        headers=official,
    )
    assert assigned.status_code == 200, assigned.text

    assert client.get("/api/v1/complaints?needs_triage=true", headers=official).json() == []
