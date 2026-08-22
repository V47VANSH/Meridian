"""ML service tests (docs/04-ml-architecture.md section 9).

Three kinds, deliberately separated:

- contract tests, which the backend depends on and which must not drift
- unit tests on the pre/post-processing, which hold regardless of the model
- evaluation, which guards against a training regression being published
"""

from __future__ import annotations

import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.complaints import classify as complaint_classifier
from app.main import app
from app.payment_risk import score as risk_scorer
from app.payment_risk.train import FEATURE_ORDER, ROC_AUC_FLOOR

CATEGORIES = {"PLUMBING", "ELECTRICAL", "STRUCTURAL", "SECURITY", "CLEANING", "GENERAL"}
URGENCIES = {"LOW", "MEDIUM", "HIGH"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- Contract ---------------------------------------------------------------


def test_classify_returns_the_shape_the_backend_expects(client: TestClient):
    """The backend reads exactly these three keys and clamps anything else."""
    response = client.post(
        "/complaints/classify",
        json={"description": "Water is leaking from the ceiling in the bathroom"},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert set(body) == {"category", "urgency", "confidence"}
    assert body["category"] in CATEGORIES
    assert body["urgency"] in URGENCIES
    assert 0.0 <= body["confidence"] <= 1.0


def test_risk_returns_the_shape_the_backend_expects(client: TestClient):
    response = client.post(
        "/payment-risk/score",
        json={
            "past_late_count": 3,
            "avg_days_late": 6.2,
            "current_dues_amount": 4500,
            "tenure_months": 14,
            "month": 11,
        },
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert set(body) == {"risk_score"}
    assert 0.0 <= body["risk_score"] <= 1.0


def test_health_reports_which_models_are_loadable(client: TestClient):
    """A service with no artifact is up but useless; the probe must say so."""
    response = client.get("/health")
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["models"] == {"complaint_classifier": True, "payment_risk": True}
    assert body["status"] == "ok"


def test_risk_rejects_an_impossible_month(client: TestClient):
    """Validation belongs at the edge, not in the feature vector."""
    response = client.post(
        "/payment-risk/score",
        json={
            "past_late_count": 0,
            "avg_days_late": 0,
            "current_dues_amount": 0,
            "tenure_months": 1,
            "month": 13,
        },
    )
    assert response.status_code == 422


# --- Auth -------------------------------------------------------------------


def test_shared_secret_is_enforced_when_configured(monkeypatch):
    """With a secret set, an unauthenticated call is refused."""
    monkeypatch.setattr("app.main.INTERNAL_SECRET", "top-secret")
    with TestClient(app) as guarded:
        refused = guarded.post("/complaints/classify", json={"description": "lift stuck"})
        assert refused.status_code == 401

        allowed = guarded.post(
            "/complaints/classify",
            json={"description": "lift stuck"},
            headers={"X-Internal-Secret": "top-secret"},
        )
        assert allowed.status_code == 200, allowed.text


# --- Unit: pre/post-processing ---------------------------------------------


def test_empty_description_is_reported_as_no_confidence():
    """An empty string is not something to guess from.

    Returning confidence 0 hands the decision to the backend's keyword
    fallback rather than inventing a category.
    """
    result = complaint_classifier.classify("   ")
    assert result["confidence"] == 0.0
    assert result["category"] == "GENERAL"


def test_feature_vector_follows_the_artifact_order():
    """A retrained model with reordered columns must not be scored blindly."""
    features = {
        "past_late_count": 1,
        "avg_days_late": 2,
        "current_dues_amount": 3,
        "tenure_months": 4,
        "month": 5,
    }
    vector = risk_scorer.build_vector(features, FEATURE_ORDER)
    assert vector.tolist() == [[1.0, 2.0, 3.0, 4.0, 5.0]]

    reversed_order = list(reversed(FEATURE_ORDER))
    reversed_vector = risk_scorer.build_vector(features, reversed_order)
    assert reversed_vector.tolist() == [[5.0, 4.0, 3.0, 2.0, 1.0]]


def test_risk_rises_with_a_worse_payment_history():
    """The score must order flats sensibly — that is all it is used for."""
    base = {
        "past_late_count": 0,
        "avg_days_late": 0.0,
        "current_dues_amount": 1000.0,
        "tenure_months": 24,
        "month": 6,
    }
    worse = {**base, "past_late_count": 10, "avg_days_late": 12.0}
    assert risk_scorer.score(worse) > risk_scorer.score(base)


# --- Evaluation -------------------------------------------------------------


def test_published_metrics_are_above_their_floors():
    """The committed artifacts must not be below the bar their trainer sets."""
    complaints_meta = json.loads(
        (complaint_classifier.MODEL_PATH.with_name("metadata.json")).read_text(encoding="utf-8")
    )
    assert (
        complaints_meta["metrics"]["category_macro_f1"]
        >= complaints_meta["floors"]["category_macro_f1"]
    )
    assert (
        complaints_meta["metrics"]["urgency_macro_f1"]
        >= complaints_meta["floors"]["urgency_macro_f1"]
    )

    risk_meta = json.loads(
        (risk_scorer.MODEL_PATH.with_name("metadata.json")).read_text(encoding="utf-8")
    )
    assert risk_meta["metrics"]["roc_auc"] >= ROC_AUC_FLOOR


def test_risk_model_stays_near_the_achievable_ceiling():
    """A held-out AUC is only meaningful against what is reachable.

    The simulation samples outcomes from a probability, so a chunk of the
    lateness is irreducible. Comparing against the Bayes-optimal ranking is
    what turns 0.67 from "mediocre" into "near-optimal".
    """
    meta = json.loads(
        (risk_scorer.MODEL_PATH.with_name("metadata.json")).read_text(encoding="utf-8")
    )
    assert meta["metrics"]["share_of_achievable"] >= 0.90


# Phrasings written for this test alone. None appear in the training templates,
# so this is the closest thing here to a real held-out check — the reported
# macro-F1 is inflated by the synthetic data being template-generated and
# should not be read as a generalisation estimate.
UNSEEN_COMPLAINTS = [
    ("The commode won't flush and the cistern keeps filling up", "PLUMBING"),
    ("Bulbs in the stairway have blown and nobody replaced them", "ELECTRICAL"),
    ("A chunk of concrete fell off the overhang near the entrance", "STRUCTURAL"),
    ("A stranger tailgated me through the gate last night", "SECURITY"),
    ("Bins are overflowing and it stinks by the back stairs", "CLEANING"),
    ("Could someone share this month's maintenance receipt", "GENERAL"),
]

# The backend's ML_CONFIDENCE_THRESHOLD. Anything below it is discarded in
# favour of the keyword fallback and flagged for manual triage.
BACKEND_CONFIDENCE_THRESHOLD = 0.55


@pytest.mark.parametrize("description,expected", UNSEEN_COMPLAINTS)
def test_classifier_is_never_confidently_wrong_on_unseen_phrasing(
    description: str, expected: str
):
    """Either right, or unsure enough that the backend ignores it.

    A wrong-but-confident answer is the only genuinely damaging outcome: the
    backend accepts it, routes the complaint to the wrong trade, and does not
    flag it for a human. Being wrong while under the threshold is the fallback
    working as designed, so that is what this asserts rather than demanding
    accuracy the bootstrapped data cannot support.
    """
    result = complaint_classifier.classify(description)
    if result["category"] != expected:
        assert result["confidence"] < BACKEND_CONFIDENCE_THRESHOLD, (
            f"confidently mislabelled as {result['category']}: {result}"
        )


def test_classifier_gets_most_unseen_phrasings_right():
    """A weak but real accuracy bar, so the model cannot degrade to guessing."""
    correct = sum(
        complaint_classifier.classify(text)["category"] == expected
        for text, expected in UNSEEN_COMPLAINTS
    )
    assert correct >= 4, f"only {correct}/{len(UNSEEN_COMPLAINTS)} unseen phrasings correct"


@pytest.mark.parametrize(
    "description",
    [
        "There is a gas smell in the corridor, this is an emergency",
        "Someone is trapped in the lift, please send help immediately",
        "Live wire is sparking near the children's play area, very dangerous",
    ],
)
def test_explicit_emergencies_are_not_under_called(description: str):
    """Under-calling HIGH is the costly error here (docs/04 section 6)."""
    assert complaint_classifier.classify(description)["urgency"] == "HIGH"


def test_simulation_is_reproducible():
    """A fixed seed keeps the published metrics meaningful across runs."""
    from app.payment_risk.train import simulate

    first, first_labels, _ = simulate(n=500, seed=7)
    second, second_labels, _ = simulate(n=500, seed=7)
    assert np.array_equal(first, second)
    assert np.array_equal(first_labels, second_labels)
