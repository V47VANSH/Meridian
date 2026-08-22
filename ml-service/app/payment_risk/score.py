"""Payment-risk inference.

The service is stateless (docs/04 section 4): every feature arrives in the
request body, and nothing here queries the application's database.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"


class ModelUnavailable(RuntimeError):
    """Raised when no trained artifact is present."""


@lru_cache(maxsize=1)
def _load() -> dict:
    if not MODEL_PATH.exists():
        raise ModelUnavailable(
            f"No trained model at {MODEL_PATH}. Run: python -m app.payment_risk.train"
        )
    return joblib.load(MODEL_PATH)


def build_vector(features: dict, feature_order: list[str]) -> np.ndarray:
    """Order the request's features the way the artifact was trained on.

    Reading the order from the artifact rather than assuming it is what stops a
    retrained model with reordered columns from scoring nonsense — the values
    would still be numbers, so nothing else would notice.
    """
    return np.array([[float(features[name]) for name in feature_order]])


def score(features: dict) -> float:
    """Probability (0..1) that this flat pays its next invoice late."""
    artifact = _load()
    vector = build_vector(features, artifact["feature_order"])
    probability = artifact["model"].predict_proba(vector)[0, 1]
    return round(float(probability), 4)
