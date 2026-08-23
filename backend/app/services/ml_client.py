"""Client for the FastAPI ML service, with a deterministic fallback.

Design rule from `docs/04-ml-architecture.md`: complaint submission must never
fail because the ML service is slow, down, or unsure. Every path through this
module returns a usable classification.
"""

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass

from app.core.config import settings
from app.models import ComplaintCategory, UrgencyLevel

logger = logging.getLogger(__name__)


@dataclass
class Classification:
    category: str
    urgency: str
    confidence: float
    # True when the caller should surface this to a human for confirmation.
    needs_manual_triage: bool
    source: str  # "ml" | "fallback"


# Keyword rules used when ML is unavailable or not confident enough. Ordered
# most-specific first; the first category with a keyword hit wins.
_CATEGORY_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (
        ComplaintCategory.PLUMBING.value,
        ("leak", "leakage", "water", "tap", "pipe", "drain", "sewage", "flush", "toilet"),
    ),
    (
        ComplaintCategory.ELECTRICAL.value,
        ("light", "power", "electric", "wiring", "short circuit", "fuse", "lift", "elevator"),
    ),
    (
        ComplaintCategory.STRUCTURAL.value,
        ("crack", "wall", "ceiling", "plaster", "seepage", "tile", "railing", "balcony"),
    ),
    (
        ComplaintCategory.SECURITY.value,
        ("theft", "stolen", "intruder", "trespass", "cctv", "gate", "unauthorised", "unauthorized"),
    ),
    (
        ComplaintCategory.CLEANING.value,
        ("garbage", "trash", "waste", "dirty", "clean", "litter", "smell", "pest", "mosquito"),
    ),
]

_HIGH_URGENCY_KEYWORDS = (
    "fire",
    "gas",
    "smoke",
    "flood",
    "sparking",
    "shock",
    "collapse",
    "trapped",
    "emergency",
    "urgent",
    "danger",
)

_LOW_URGENCY_KEYWORDS = ("whenever", "minor", "cosmetic", "paint", "suggestion")

# Checked before the HIGH keywords, because a plain substring scan reads the
# "urgent" inside "not urgent" as an emergency and inverts the priority.
_NEGATED_URGENCY_PHRASES = (
    "not urgent",
    "no urgency",
    "not an emergency",
    "no rush",
    "not a priority",
)


def _rule_based(description: str) -> Classification:
    """Keyword classifier used whenever the model cannot be trusted."""
    text = description.lower()

    category = ComplaintCategory.GENERAL.value
    for candidate, keywords in _CATEGORY_KEYWORDS:
        if any(keyword in text for keyword in keywords):
            category = candidate
            break

    if any(phrase in text for phrase in _NEGATED_URGENCY_PHRASES):
        urgency = UrgencyLevel.LOW.value
    elif any(keyword in text for keyword in _HIGH_URGENCY_KEYWORDS):
        urgency = UrgencyLevel.HIGH.value
    elif any(keyword in text for keyword in _LOW_URGENCY_KEYWORDS):
        urgency = UrgencyLevel.LOW.value
    else:
        urgency = UrgencyLevel.MEDIUM.value

    return Classification(
        category=category,
        urgency=urgency,
        confidence=0.0,
        # A rule-based guess is always flagged so an official reviews it.
        needs_manual_triage=True,
        source="fallback",
    )


def classify_complaint(description: str) -> Classification:
    """Classify a complaint's category and urgency.

    Calls the ML service when configured. Falls back to the keyword classifier
    on timeout, transport error, malformed response, or low confidence.
    """
    if not settings.ML_SERVICE_URL:
        return _rule_based(description)

    request = urllib.request.Request(
        url=f"{settings.ML_SERVICE_URL.rstrip('/')}/complaints/classify",
        data=json.dumps({"description": description}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Internal-Secret": settings.ML_SHARED_SECRET,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings.ML_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
        category = str(payload["category"])
        urgency = str(payload["urgency"])
        confidence = float(payload["confidence"])
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("ML classify unavailable, using rule-based fallback: %s", exc)
        return _rule_based(description)

    # Guard against a model returning a label outside our enum.
    if category not in {c.value for c in ComplaintCategory}:
        category = ComplaintCategory.GENERAL.value
    if urgency not in {u.value for u in UrgencyLevel}:
        urgency = UrgencyLevel.MEDIUM.value

    if confidence < settings.ML_CONFIDENCE_THRESHOLD:
        fallback = _rule_based(description)
        fallback.confidence = confidence
        return fallback

    return Classification(
        category=category,
        urgency=urgency,
        confidence=confidence,
        needs_manual_triage=False,
        source="ml",
    )


@dataclass
class RiskFeatures:
    """The feature set docs/04-ml-architecture.md section 4 defines.

    Computed by the backend and passed in the request body — the ML service is
    stateless and never queries this database itself.
    """

    past_late_count: int
    avg_days_late: float
    current_dues_amount: float
    tenure_months: int
    month: int
    # Not sent to the model; used only by the deterministic fallback below.
    on_time_ratio: float
    overdue_count: int
    months_tracked: int

    def as_payload(self) -> dict:
        return {
            "past_late_count": self.past_late_count,
            "avg_days_late": round(self.avg_days_late, 4),
            "current_dues_amount": round(self.current_dues_amount, 2),
            "tenure_months": self.tenure_months,
            "month": self.month,
        }


def _fallback_risk(features: RiskFeatures) -> float:
    """Deterministic score used whenever the model is unavailable.

    docs/04 section 7: an unreachable ML service must never block a user-facing
    action, and payment risk is the least critical of the two — so this returns
    a usable number rather than an error.
    """
    if features.months_tracked <= 0:
        return 0.5  # No history yet: neutral score, never a penalty.

    lateness = 1.0 - max(0.0, min(1.0, features.on_time_ratio))
    recency_penalty = min(features.overdue_count / max(features.months_tracked, 1), 1.0)
    score = (0.65 * lateness) + (0.35 * recency_penalty)
    return round(max(0.0, min(1.0, score)), 4)


def score_payment_risk(features: RiskFeatures) -> float:
    """Likelihood (0..1) that a flat pays its next invoice late.

    Calls the trained model when one is configured, and falls back to the
    deterministic formula on any failure.
    """
    if not settings.ML_SERVICE_URL:
        return _fallback_risk(features)

    request = urllib.request.Request(
        url=f"{settings.ML_SERVICE_URL.rstrip('/')}/payment-risk/score",
        data=json.dumps(features.as_payload()).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Internal-Secret": settings.ML_SHARED_SECRET,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings.ML_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
        score = float(payload["risk_score"])
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("ML risk scoring unavailable, using deterministic fallback: %s", exc)
        return _fallback_risk(features)

    # A model is not required to return a probability; clamping keeps the
    # threshold comparison downstream meaningful whatever comes back.
    return round(max(0.0, min(1.0, score)), 4)
