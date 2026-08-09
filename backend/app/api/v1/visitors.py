"""Visitor management and emergency endpoints (Epic 4).

User stories:
- *"As a resident, I want to issue a digital pass to my visitor so the guard
  can admit them without calling me."*
- *"As a security guard, I want to verify a pass by scanning it so that only
  expected visitors enter."*
- *"As a resident, I want an SOS button so that guards are alerted instantly
  in an emergency."*
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, get_tenant_id, require_roles
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.security import generate_qr_token
from app.db.session import get_db
from app.models import (
    Flat,
    FlatOwnership,
    GuestPass,
    GuestPassStatus,
    NotificationType,
    Role,
    SOSIncident,
    SOSStatus,
    User,
)
from app.schemas import (
    ErrorResponse,
    GuestPassCreate,
    GuestPassResponse,
    GuestPassVerifyResponse,
    SOSCreate,
    SOSResponse,
)
from app.services import audit, notifications

router = APIRouter(tags=["Visitors & Emergency"])

AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    403: {"model": ErrorResponse, "description": "Role is not permitted to perform this action"},
}

# Roles that may issue a pass for a flat they are linked to.
PASS_ISSUERS = (Role.RESIDENT_OWNER, Role.NON_RESIDENT_OWNER, Role.SOCIETY_OFFICIAL)


def _naive_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _pass_response(guest_pass: GuestPass, *, include_token: bool) -> GuestPassResponse:
    """The raw token is only ever returned to the resident who created the pass."""
    return GuestPassResponse(
        id=guest_pass.id,
        tenant_id=guest_pass.tenant_id,
        flat_id=guest_pass.flat_id,
        generated_by=guest_pass.generated_by,
        visitor_name=guest_pass.visitor_name,
        visitor_phone=guest_pass.visitor_phone,
        purpose=guest_pass.purpose,
        valid_from=guest_pass.valid_from,
        valid_until=guest_pass.valid_until,
        status=guest_pass.status,
        used_at=guest_pass.used_at,
        created_at=guest_pass.created_at,
        qr_token=guest_pass.qr_token if include_token else None,
    )


@router.post(
    "/visitors/guest-passes",
    response_model=GuestPassResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a single-use guest pass",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Flat not found in this society"},
        422: {"model": ErrorResponse, "description": "valid_until is not after valid_from"},
    },
)
def create_guest_pass(
    payload: GuestPassCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(*PASS_ISSUERS)),
    tenant_id: str = Depends(get_tenant_id),
) -> GuestPassResponse:
    """Issue a time-boxed pass and return the token to encode as a QR code.

    The token is 192 bits of randomness rather than a sequential id, so passes
    cannot be guessed or enumerated.
    """
    flat = db.get(Flat, payload.flat_id)
    if flat is None or flat.tenant_id != tenant_id:
        raise NotFoundError("Flat not found in this society", error="FLAT_NOT_FOUND")

    if user.role != Role.SOCIETY_OFFICIAL.value:
        linked = db.get(FlatOwnership, (user.id, flat.id))
        if linked is None:
            raise ForbiddenError(
                "You may only issue passes for a flat you are linked to",
                error="NOT_YOUR_FLAT",
            )

    guest_pass = GuestPass(
        tenant_id=tenant_id,
        generated_by=user.id,
        flat_id=flat.id,
        visitor_name=payload.visitor_name,
        visitor_phone=payload.visitor_phone,
        purpose=payload.purpose,
        valid_from=payload.valid_from.replace(tzinfo=None),
        valid_until=payload.valid_until.replace(tzinfo=None),
        qr_token=generate_qr_token(),
        status=GuestPassStatus.ACTIVE.value,
    )
    db.add(guest_pass)
    db.flush()
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="GUEST_PASS_CREATED",
        entity_type="GuestPass",
        entity_id=guest_pass.id,
        detail=f"{payload.visitor_name} for {flat.label}",
    )
    db.commit()
    db.refresh(guest_pass)
    return _pass_response(guest_pass, include_token=True)


@router.get(
    "/visitors/guest-passes",
    response_model=list[GuestPassResponse],
    summary="List guest passes",
    responses=AUTH_ERRORS,
)
def list_guest_passes(
    pass_status: GuestPassStatus | None = Query(
        None, alias="status", description="Filter by pass status"
    ),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[GuestPassResponse]:
    """Pass history. Residents see their own; officials and guards see all."""
    query = select(GuestPass).where(GuestPass.tenant_id == tenant_id)

    wide_view = {Role.SOCIETY_OFFICIAL.value, Role.SECURITY_GUARD.value}
    if user.role not in wide_view:
        query = query.where(GuestPass.generated_by == user.id)
    if pass_status:
        query = query.where(GuestPass.status == pass_status.value)

    passes = db.scalars(query.order_by(GuestPass.created_at.desc())).all()
    # The token is withheld here — a list view is not where a secret belongs.
    return [_pass_response(p, include_token=False) for p in passes]


@router.post(
    "/visitors/guest-passes/{qr_token}/verify",
    response_model=GuestPassVerifyResponse,
    summary="Verify a scanned guest pass (guard)",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "No pass matches this token"},
    },
)
def verify_guest_pass(
    qr_token: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SECURITY_GUARD, Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> GuestPassVerifyResponse:
    """Check a pass and consume it in the same step.

    Validity is evaluated at scan time rather than by a background job, and the
    `ACTIVE → USED` flip happens in the same transaction that returns the
    result — so a captured QR image cannot be replayed at the gate.
    """
    guest_pass = db.scalar(select(GuestPass).where(GuestPass.qr_token == qr_token))
    if guest_pass is None or guest_pass.tenant_id != tenant_id:
        raise NotFoundError("No guest pass matches this token", error="PASS_NOT_FOUND")

    now = _naive_now()

    if guest_pass.status == GuestPassStatus.USED.value:
        return GuestPassVerifyResponse(
            valid=False, reason="This pass has already been used", pass_id=guest_pass.id
        )
    if guest_pass.status == GuestPassStatus.REVOKED.value:
        return GuestPassVerifyResponse(
            valid=False, reason="This pass was revoked by the resident", pass_id=guest_pass.id
        )
    if now < guest_pass.valid_from:
        return GuestPassVerifyResponse(
            valid=False,
            reason=f"This pass is not valid until {guest_pass.valid_from:%Y-%m-%d %H:%M}",
            pass_id=guest_pass.id,
        )
    if now > guest_pass.valid_until:
        # Expiry is a read-time decision; persist it so the list view agrees.
        guest_pass.status = GuestPassStatus.EXPIRED.value
        db.commit()
        return GuestPassVerifyResponse(
            valid=False, reason="This pass has expired", pass_id=guest_pass.id
        )

    guest_pass.status = GuestPassStatus.USED.value
    guest_pass.used_at = now
    guest_pass.verified_by = user.id

    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="GUEST_PASS_VERIFIED",
        entity_type="GuestPass",
        entity_id=guest_pass.id,
        detail=guest_pass.visitor_name,
    )
    db.commit()

    flat = db.get(Flat, guest_pass.flat_id)
    return GuestPassVerifyResponse(
        valid=True,
        reason="Pass is valid; visitor may be admitted",
        visitor_name=guest_pass.visitor_name,
        flat_label=flat.label if flat else None,
        pass_id=guest_pass.id,
        verified_at=now,
    )


@router.post(
    "/visitors/guest-passes/{pass_id}/revoke",
    response_model=GuestPassResponse,
    summary="Revoke a guest pass before it is used",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Pass not found"},
        409: {"model": ErrorResponse, "description": "Pass is already used or revoked"},
    },
)
def revoke_guest_pass(
    pass_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> GuestPassResponse:
    """Cancel an unused pass, for example when a visit is called off."""
    guest_pass = db.get(GuestPass, pass_id)
    if guest_pass is None or guest_pass.tenant_id != tenant_id:
        raise NotFoundError("Guest pass not found", error="PASS_NOT_FOUND")

    if guest_pass.generated_by != user.id and user.role != Role.SOCIETY_OFFICIAL.value:
        raise ForbiddenError("You may only revoke passes you issued", error="NOT_YOUR_PASS")

    if guest_pass.status != GuestPassStatus.ACTIVE.value:
        raise ConflictError(
            f"Cannot revoke a pass that is {guest_pass.status}", error="PASS_NOT_ACTIVE"
        )

    guest_pass.status = GuestPassStatus.REVOKED.value
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="GUEST_PASS_REVOKED",
        entity_type="GuestPass",
        entity_id=guest_pass.id,
    )
    db.commit()
    db.refresh(guest_pass)
    return _pass_response(guest_pass, include_token=False)


# ---------------------------------------------------------------------------
# SOS
# ---------------------------------------------------------------------------


@router.post(
    "/sos",
    response_model=SOSResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Raise an SOS alert",
    responses=AUTH_ERRORS,
)
def raise_sos(
    payload: SOSCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> SOSResponse:
    """Alert every on-duty guard in the society immediately.

    The incident row is written first so the alert survives even if every
    notification channel fails.
    """
    if payload.flat_id:
        flat = db.get(Flat, payload.flat_id)
        if flat is None or flat.tenant_id != tenant_id:
            raise NotFoundError("Flat not found in this society", error="FLAT_NOT_FOUND")

    incident = SOSIncident(
        tenant_id=tenant_id,
        raised_by=user.id,
        flat_id=payload.flat_id,
        location_note=payload.location_note,
        status=SOSStatus.OPEN.value,
    )
    db.add(incident)
    db.flush()

    guard_ids = list(
        db.scalars(
            select(User.id).where(
                User.tenant_id == tenant_id, User.role == Role.SECURITY_GUARD.value
            )
        )
    )
    notifications.notify_many(
        db,
        tenant_id=tenant_id,
        user_ids=guard_ids,
        notification_type=NotificationType.SOS_RAISED.value,
        title="SOS raised",
        body=payload.location_note or "Emergency assistance requested",
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="SOS_RAISED",
        entity_type="SOSIncident",
        entity_id=incident.id,
        detail=payload.location_note,
    )
    db.commit()
    db.refresh(incident)
    return SOSResponse.model_validate(incident)


@router.get(
    "/sos",
    response_model=list[SOSResponse],
    summary="List SOS incidents",
    responses=AUTH_ERRORS,
)
def list_sos(
    sos_status: SOSStatus | None = Query(None, alias="status", description="Filter by status"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[SOSResponse]:
    """The guard's inbox. Residents see only the incidents they raised."""
    query = select(SOSIncident).where(SOSIncident.tenant_id == tenant_id)

    responders = {Role.SECURITY_GUARD.value, Role.SOCIETY_OFFICIAL.value}
    if user.role not in responders:
        query = query.where(SOSIncident.raised_by == user.id)
    if sos_status:
        query = query.where(SOSIncident.status == sos_status.value)

    incidents = db.scalars(query.order_by(SOSIncident.created_at.desc())).all()
    return [SOSResponse.model_validate(i) for i in incidents]


@router.post(
    "/sos/{incident_id}/acknowledge",
    response_model=SOSResponse,
    summary="Acknowledge an SOS alert (guard)",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Incident not found"},
        409: {"model": ErrorResponse, "description": "Incident is no longer open"},
    },
)
def acknowledge_sos(
    incident_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SECURITY_GUARD, Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> SOSResponse:
    """Confirm a responder is on the way, and tell the person who raised it.

    Acknowledgement is what turns the SOS button from fire-and-forget into a
    two-way exchange the resident can see.
    """
    incident = db.get(SOSIncident, incident_id)
    if incident is None or incident.tenant_id != tenant_id:
        raise NotFoundError("SOS incident not found", error="SOS_NOT_FOUND")

    if incident.status != SOSStatus.OPEN.value:
        raise ConflictError(
            f"This incident is already {incident.status}", error="SOS_NOT_OPEN"
        )

    incident.status = SOSStatus.ACKNOWLEDGED.value
    incident.acknowledged_by = user.id
    incident.acknowledged_at = _naive_now()

    notifications.notify(
        db,
        tenant_id=tenant_id,
        user_id=incident.raised_by,
        notification_type=NotificationType.SOS_RAISED.value,
        title="Help is on the way",
        body=f"{user.full_name} has acknowledged your SOS.",
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="SOS_ACKNOWLEDGED",
        entity_type="SOSIncident",
        entity_id=incident.id,
    )
    db.commit()
    db.refresh(incident)
    return SOSResponse.model_validate(incident)


@router.post(
    "/sos/{incident_id}/resolve",
    response_model=SOSResponse,
    summary="Close out an SOS incident",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Incident not found"},
        409: {"model": ErrorResponse, "description": "Incident is already resolved"},
    },
)
def resolve_sos(
    incident_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SECURITY_GUARD, Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> SOSResponse:
    """Mark an incident handled once the situation is under control."""
    incident = db.get(SOSIncident, incident_id)
    if incident is None or incident.tenant_id != tenant_id:
        raise NotFoundError("SOS incident not found", error="SOS_NOT_FOUND")

    if incident.status == SOSStatus.RESOLVED.value:
        raise ConflictError("This incident is already resolved", error="SOS_ALREADY_RESOLVED")

    incident.status = SOSStatus.RESOLVED.value
    incident.resolved_at = _naive_now()

    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="SOS_RESOLVED",
        entity_type="SOSIncident",
        entity_id=incident.id,
    )
    db.commit()
    db.refresh(incident)
    return SOSResponse.model_validate(incident)
