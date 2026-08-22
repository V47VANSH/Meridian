"""Complaint classification inference.

The artifact is loaded once at import and reused, because loading it per
request would dominate the backend's 2-second timeout for no benefit.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import joblib

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"

CATEGORIES = {"PLUMBING", "ELECTRICAL", "STRUCTURAL", "SECURITY", "CLEANING", "GENERAL"}
URGENCIES = {"LOW", "MEDIUM", "HIGH"}


class ModelUnavailable(RuntimeError):
    """Raised when no trained artifact is present."""


@lru_cache(maxsize=1)
def _load() -> dict:
    if not MODEL_PATH.exists():
        raise ModelUnavailable(
            f"No trained model at {MODEL_PATH}. Run: python -m app.complaints.train"
        )
    return joblib.load(MODEL_PATH)


def classify(description: str) -> dict:
    """Predict category and urgency for a complaint description.

    `confidence` is the category model's probability for the label it chose.
    The backend compares it against its own threshold and falls back to keyword
    rules below it, so an unsure answer is reported honestly rather than being
    dressed up as a confident one.
    """
    text = (description or "").strip()
    if not text:
        # Nothing to go on. Saying so lets the backend's fallback take over
        # instead of the model guessing from an empty string.
        return {"category": "GENERAL", "urgency": "MEDIUM", "confidence": 0.0}

    models = _load()
    category_model = models["category"]
    urgency_model = models["urgency"]

    category = str(category_model.predict([text])[0])
    urgency = str(urgency_model.predict([text])[0])
    confidence = float(category_model.predict_proba([text]).max())

    # A retrained artifact could introduce a label this service's contract does
    # not include; clamp rather than pass it through to the backend.
    if category not in CATEGORIES:
        logger.warning("model returned unknown category %r", category)
        category, confidence = "GENERAL", 0.0
    if urgency not in URGENCIES:
        logger.warning("model returned unknown urgency %r", urgency)
        urgency = "MEDIUM"

    return {"category": category, "urgency": urgency, "confidence": round(confidence, 4)}
