"""ML service.

One deployable carrying both models (docs/04 section 2): the complaint
classifier and the payment-risk scorer. One owner, one Render service, one set
of logs, with the two model domains kept apart as sibling packages.

The only caller is the backend, so authentication is a shared secret header
rather than a full auth stack (section 8).
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.complaints import classify as complaint_classifier
from app.payment_risk import score as risk_scorer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

INTERNAL_SECRET = os.getenv("ML_SHARED_SECRET", "")


def require_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    """Reject anything that is not the backend.

    When no secret is configured the check is skipped, which is what lets the
    service run locally and in tests without ceremony. A deployment that means
    to be protected sets `ML_SHARED_SECRET`; one that does not is open by
    choice rather than by accident, and the startup log says which it is.
    """
    if not INTERNAL_SECRET:
        return
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Internal-Secret",
        )


app = FastAPI(
    title="ACMS ML Service",
    version="1.0.0",
    description=(
        "Complaint classification and payment-risk scoring for the Apartment "
        "Complex Management System. Called only by the backend."
    ),
)


@app.on_event("startup")
def _log_configuration() -> None:
    logger.info(
        "ml-service starting: shared secret %s",
        "configured" if INTERNAL_SECRET else "NOT configured (endpoints are open)",
    )


class ClassifyRequest(BaseModel):
    description: str = Field(..., description="Free-text complaint description")


class ClassifyResponse(BaseModel):
    category: str
    urgency: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class RiskRequest(BaseModel):
    past_late_count: int = Field(0, ge=0, description="Invoices previously settled late")
    avg_days_late: float = Field(0.0, ge=0.0, description="Mean days late across those")
    current_dues_amount: float = Field(0.0, ge=0.0, description="Unpaid balance in INR")
    tenure_months: int = Field(0, ge=0, description="Months this flat has been billed")
    month: int = Field(1, ge=1, le=12, description="Calendar month being scored")


class RiskResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=1.0)


def _artifact_metadata(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/health", summary="Liveness probe")
def health() -> dict:
    """Reports whether each trained artifact is actually loadable.

    A service that is up but has no model is not healthy in any useful sense —
    it would fail every request — so the probe distinguishes the two.
    """
    complaints_meta = _artifact_metadata(
        complaint_classifier.MODEL_PATH.with_name("metadata.json")
    )
    risk_meta = _artifact_metadata(risk_scorer.MODEL_PATH.with_name("metadata.json"))

    models = {
        "complaint_classifier": complaint_classifier.MODEL_PATH.exists(),
        "payment_risk": risk_scorer.MODEL_PATH.exists(),
    }
    return {
        "status": "ok" if all(models.values()) else "degraded",
        "version": "1.0.0",
        "models": models,
        "trained_at": {
            "complaint_classifier": (complaints_meta or {}).get("trained_at"),
            "payment_risk": (risk_meta or {}).get("trained_at"),
        },
    }


@app.post(
    "/complaints/classify",
    response_model=ClassifyResponse,
    summary="Classify a complaint's category and urgency",
    dependencies=[Depends(require_internal_secret)],
)
def classify_complaint(payload: ClassifyRequest) -> ClassifyResponse:
    try:
        result = complaint_classifier.classify(payload.description)
    except complaint_classifier.ModelUnavailable as exc:
        # 503, not 500: the backend's fallback treats any failure the same way,
        # but the status says the service is unready rather than broken.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return ClassifyResponse(**result)


@app.post(
    "/payment-risk/score",
    response_model=RiskResponse,
    summary="Score a flat's likelihood of paying late",
    dependencies=[Depends(require_internal_secret)],
)
def score_payment_risk(payload: RiskRequest) -> RiskResponse:
    try:
        risk = risk_scorer.score(payload.model_dump())
    except risk_scorer.ModelUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return RiskResponse(risk_score=risk)
