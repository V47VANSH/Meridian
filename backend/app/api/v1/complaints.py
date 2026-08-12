"""Complaint management endpoints (Epic 2).

User stories:
- *"As a resident, I want to raise a complaint and track its progress so that
  I know it is being acted on."*
- *"As a society official, I want complaints auto-categorised and prioritised
  so that urgent issues surface first."*
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, get_tenant_id, require_roles
from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import (
    Complaint,
    ComplaintStatus,
    ComplaintStatusHistory,
    Flat,
    NotificationType,
    Role,
    UrgencyLevel,
    User,
)
from app.schemas import (
    ComplaintAssignRequest,
    ComplaintCreate,
    ComplaintPriorityUpdate,
    ComplaintResponse,
    ComplaintStatusUpdate,
    ComplaintSummaryResponse,
    ErrorResponse,
)
from app.services import audit, notifications
from app.services.ml_client import classify_complaint

router = APIRouter(prefix="/complaints", tags=["Complaints"])

AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    403: {"model": ErrorResponse, "description": "Role is not permitted to perform this action"},
}

# Only these roles triage and progress complaints.
TRIAGE_ROLES = (Role.SOCIETY_OFFICIAL, Role.MAINTENANCE_STAFF, Role.CLEANING_STAFF)

# Urgency ordering used to sort the triage queue most-severe first.
_URGENCY_RANK = {
    UrgencyLevel.HIGH.value: 0,
    UrgencyLevel.MEDIUM.value: 1,
    UrgencyLevel.LOW.value: 2,
}

# A complaint may only move forward through its lifecycle. Reopening a closed
# complaint would erase the accountability trail, so it is rejected.
_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    ComplaintStatus.OPEN.value: {ComplaintStatus.IN_PROGRESS.value, ComplaintStatus.CLOSED.value},
    ComplaintStatus.IN_PROGRESS.value: {
        ComplaintStatus.RESOLVED.value,
        ComplaintStatus.CLOSED.value,
    },
    ComplaintStatus.RESOLVED.value: {ComplaintStatus.CLOSED.value},
    ComplaintStatus.CLOSED.value: set(),
}


def _to_response(complaint: Complaint) -> ComplaintResponse:
    """Serialise, expanding the stored comma-separated attachment list."""
    urls = [u for u in complaint.attachment_urls.split(",") if u]
    return ComplaintResponse(
        id=complaint.id,
        tenant_id=complaint.tenant_id,
        raised_by=complaint.raised_by,
        flat_id=complaint.flat_id,
        title=complaint.title,
        description=complaint.description,
        category=complaint.category,
        urgency=complaint.urgency,
        status=complaint.status,
        assigned_to=complaint.assigned_to,
        attachment_urls=urls,
        needs_manual_triage=complaint.needs_manual_triage,
        classification_confidence=complaint.classification_confidence,
        created_at=complaint.created_at,
        resolved_at=complaint.resolved_at,
        history=[h for h in complaint.history],
    )


def _load(db: Session, complaint_id: str, tenant_id: str) -> Complaint:
    complaint = db.get(Complaint, complaint_id)
    if complaint is None or complaint.tenant_id != tenant_id:
        raise NotFoundError("Complaint not found", error="COMPLAINT_NOT_FOUND")
    return complaint


@router.post(
    "",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Raise a complaint",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Flat not found in this society"},
        422: {"model": ErrorResponse, "description": "Title or description too short"},
    },
)
def create_complaint(
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> ComplaintResponse:
    """Submit a complaint; category and urgency are classified automatically.

    If the classifier is unavailable or not confident, the complaint is still
    accepted with a rule-based guess and flagged for manual triage — submission
    never depends on the ML service being up.
    """
    if payload.flat_id:
        flat = db.get(Flat, payload.flat_id)
        if flat is None or flat.tenant_id != tenant_id:
            raise NotFoundError("Flat not found in this society", error="FLAT_NOT_FOUND")

    if payload.category and payload.urgency:
        # Caller stated both explicitly; skip classification entirely.
        category = payload.category.value
        urgency = payload.urgency.value
        confidence = 1.0
        needs_triage = False
    else:
        result = classify_complaint(f"{payload.title}. {payload.description}")
        category = payload.category.value if payload.category else result.category
        urgency = payload.urgency.value if payload.urgency else result.urgency
        confidence = result.confidence
        needs_triage = result.needs_manual_triage

    complaint = Complaint(
        tenant_id=tenant_id,
        raised_by=user.id,
        flat_id=payload.flat_id,
        title=payload.title,
        description=payload.description,
        category=category,
        urgency=urgency,
        status=ComplaintStatus.OPEN.value,
        attachment_urls=",".join(payload.attachment_urls),
        needs_manual_triage=needs_triage,
        classification_confidence=confidence,
    )
    db.add(complaint)
    db.flush()

    db.add(
        ComplaintStatusHistory(
            complaint_id=complaint.id,
            status=ComplaintStatus.OPEN.value,
            changed_by=user.id,
            note="Complaint raised",
        )
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="COMPLAINT_CREATED",
        entity_type="Complaint",
        entity_id=complaint.id,
        detail=f"{category}/{urgency}",
    )
    db.commit()
    db.refresh(complaint)
    return _to_response(complaint)


@router.get(
    "",
    response_model=list[ComplaintResponse],
    summary="List complaints",
    responses=AUTH_ERRORS,
)
def list_complaints(
    complaint_status: ComplaintStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    assigned_to_me: bool = Query(False, description="Staff: only complaints assigned to me"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[ComplaintResponse]:
    """Return complaints visible to the caller, most urgent first.

    Officials and staff see the society-wide triage queue; residents see only
    the complaints they raised themselves.
    """
    query = select(Complaint).where(Complaint.tenant_id == tenant_id)

    if user.role not in {r.value for r in TRIAGE_ROLES}:
        query = query.where(Complaint.raised_by == user.id)
    elif assigned_to_me:
        query = query.where(Complaint.assigned_to == user.id)

    if complaint_status:
        query = query.where(Complaint.status == complaint_status.value)

    complaints = list(db.scalars(query))
    complaints.sort(key=lambda c: (_URGENCY_RANK.get(c.urgency, 3), c.created_at))
    return [_to_response(c) for c in complaints]


@router.get(
    "/summary",
    response_model=ComplaintSummaryResponse,
    summary="Summary statistics of complaints",
    responses=AUTH_ERRORS,
)
def complaint_summary(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(*TRIAGE_ROLES)),
    tenant_id: str = Depends(get_tenant_id),
) -> ComplaintSummaryResponse:
    """Return aggregated counts of complaints by status and urgency."""
    rows = list(db.scalars(select(Complaint).where(Complaint.tenant_id == tenant_id)))
    return ComplaintSummaryResponse(
        total_complaints=len(rows),
        open_count=len([c for c in rows if c.status == ComplaintStatus.OPEN.value]),
        in_progress_count=len([c for c in rows if c.status == ComplaintStatus.IN_PROGRESS.value]),
        resolved_count=len([c for c in rows if c.status == ComplaintStatus.RESOLVED.value]),
        closed_count=len([c for c in rows if c.status == ComplaintStatus.CLOSED.value]),
        high_urgency_count=len([c for c in rows if c.urgency == UrgencyLevel.HIGH.value]),
    )


@router.get(
    "/{complaint_id}",
    response_model=ComplaintResponse,
    summary="Get a complaint with its full status history",
    responses={**AUTH_ERRORS, 404: {"model": ErrorResponse, "description": "Complaint not found"}},
)
def get_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> ComplaintResponse:
    """Fetch one complaint and every recorded status transition on it."""
    complaint = _load(db, complaint_id, tenant_id)
    if (
        user.role not in {r.value for r in TRIAGE_ROLES}
        and complaint.raised_by != user.id
    ):
        raise ForbiddenError("You may only view complaints you raised", error="NOT_YOUR_COMPLAINT")
    return _to_response(complaint)


@router.patch(
    "/{complaint_id}/status",
    response_model=ComplaintResponse,
    summary="Advance a complaint's status",
    responses={
        **AUTH_ERRORS,
        400: {"model": ErrorResponse, "description": "Illegal status transition"},
        404: {"model": ErrorResponse, "description": "Complaint not found"},
    },
)
def update_status(
    complaint_id: str,
    payload: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(*TRIAGE_ROLES)),
    tenant_id: str = Depends(get_tenant_id),
) -> ComplaintResponse:
    """Move a complaint forward and append to its history.

    Transitions are validated against the lifecycle, so a complaint cannot jump
    from OPEN straight to RESOLVED without ever being worked on.
    """
    complaint = _load(db, complaint_id, tenant_id)
    target = payload.status.value

    if target == complaint.status:
        raise BadRequestError(
            f"Complaint is already {target}", error="INVALID_STATUS_TRANSITION"
        )
    if target not in _ALLOWED_TRANSITIONS[complaint.status]:
        raise BadRequestError(
            f"Cannot move a complaint from {complaint.status} to {target}",
            error="INVALID_STATUS_TRANSITION",
        )

    complaint.status = target
    if target == ComplaintStatus.RESOLVED.value:
        complaint.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.add(
        ComplaintStatusHistory(
            complaint_id=complaint.id,
            status=target,
            changed_by=user.id,
            note=payload.note,
        )
    )
    notifications.notify(
        db,
        tenant_id=tenant_id,
        user_id=complaint.raised_by,
        notification_type=NotificationType.COMPLAINT_STATUS_CHANGED.value,
        title=f"Complaint '{complaint.title}' is now {target}",
        body=payload.note,
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="COMPLAINT_STATUS_CHANGED",
        entity_type="Complaint",
        entity_id=complaint.id,
        detail=target,
    )
    db.commit()
    db.refresh(complaint)
    return _to_response(complaint)


@router.post(
    "/{complaint_id}/assign",
    response_model=ComplaintResponse,
    summary="Assign a complaint to a staff member",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Complaint or staff member not found"},
        422: {"model": ErrorResponse, "description": "Assignee is not a staff member"},
    },
)
def assign_complaint(
    complaint_id: str,
    payload: ComplaintAssignRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> ComplaintResponse:
    """Triage a complaint to the staff member who will resolve it.

    Assignment also clears the manual-triage flag, since a human has now
    reviewed the classification.
    """
    complaint = _load(db, complaint_id, tenant_id)

    assignee = db.get(User, payload.assigned_to)
    if assignee is None or assignee.tenant_id != tenant_id:
        raise NotFoundError("Staff member not found in this society", error="USER_NOT_FOUND")

    staff_roles = {
        Role.MAINTENANCE_STAFF.value,
        Role.CLEANING_STAFF.value,
        Role.SERVICE_PROVIDER.value,
        Role.SECURITY_GUARD.value,
    }
    if assignee.role not in staff_roles:
        raise BadRequestError(
            f"{assignee.role} cannot be assigned complaints", error="INVALID_ASSIGNEE"
        )

    complaint.assigned_to = assignee.id
    complaint.needs_manual_triage = False

    notifications.notify(
        db,
        tenant_id=tenant_id,
        user_id=assignee.id,
        notification_type=NotificationType.COMPLAINT_STATUS_CHANGED.value,
        title="A complaint was assigned to you",
        body=complaint.title,
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="COMPLAINT_ASSIGNED",
        entity_type="Complaint",
        entity_id=complaint.id,
        detail=assignee.email,
    )
    db.commit()
    db.refresh(complaint)
    return _to_response(complaint)


@router.patch(
    "/{complaint_id}/priority",
    response_model=ComplaintResponse,
    summary="Update complaint priority / urgency level",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Complaint not found"},
    },
)
def update_priority(
    complaint_id: str,
    payload: ComplaintPriorityUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(*TRIAGE_ROLES)),
    tenant_id: str = Depends(get_tenant_id),
) -> ComplaintResponse:
    """Reprioritise a complaint (HIGH, MEDIUM, LOW) manually."""
    complaint = _load(db, complaint_id, tenant_id)
    complaint.urgency = payload.urgency.value
    complaint.needs_manual_triage = False

    db.add(
        ComplaintStatusHistory(
            complaint_id=complaint.id,
            status=complaint.status,
            changed_by=user.id,
            note=payload.note or f"Priority updated to {payload.urgency.value}",
        )
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="COMPLAINT_PRIORITY_UPDATED",
        entity_type="Complaint",
        entity_id=complaint.id,
        detail=payload.urgency.value,
    )
    db.commit()
    db.refresh(complaint)
    return _to_response(complaint)

