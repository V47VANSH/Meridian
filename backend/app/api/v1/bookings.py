"""Facility and booking endpoints (Epic 3).

User stories:
- *"As a resident, I want to book a facility slot so that I can use the
  clubhouse without clashing with someone else."*
- *"As a society official, I want to publish and black out slots so that the
  schedule reflects reality."*

Double-booking is the concrete failure mode this epic exists to remove, so
`POST /bookings` is defended twice: a lock serialises concurrent requests for
the same slot, and a partial unique index makes a second confirmed booking
impossible at the database level even if the lock were bypassed.
"""

import threading
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, get_tenant_id, require_roles
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import (
    Booking,
    BookingStatus,
    Facility,
    FacilitySlot,
    NotificationType,
    Role,
)
from app.schemas import (
    BookingCreate,
    BookingResponse,
    ErrorResponse,
    FacilityCreate,
    FacilityResponse,
    SlotCreate,
    SlotResponse,
    SlotUpdate,
)
from app.services import audit, notifications

router = APIRouter(tags=["Facilities & Bookings"])

AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    403: {"model": ErrorResponse, "description": "Role is not permitted to perform this action"},
}

# Per-slot locks. Redis holds these in a multi-instance deployment (see
# docs/02-backend-architecture.md section 7); in-process locks are equivalent
# for the single-instance deploy this milestone targets.
_slot_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)


def _confirmed_booking(db: Session, slot_id: str) -> Booking | None:
    return db.scalar(
        select(Booking).where(
            Booking.slot_id == slot_id, Booking.status == BookingStatus.CONFIRMED.value
        )
    )


def _slot_response(db: Session, slot: FacilitySlot) -> SlotResponse:
    return SlotResponse(
        id=slot.id,
        facility_id=slot.facility_id,
        date=slot.date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        is_bookable=slot.is_bookable,
        is_available=slot.is_bookable and _confirmed_booking(db, slot.id) is None,
    )


def _booking_response(booking: Booking, slot: FacilitySlot, facility: Facility) -> BookingResponse:
    return BookingResponse(
        id=booking.id,
        tenant_id=booking.tenant_id,
        slot_id=booking.slot_id,
        booked_by=booking.booked_by,
        status=booking.status,
        created_at=booking.created_at,
        cancelled_at=booking.cancelled_at,
        facility_name=facility.name,
        date=slot.date,
        start_time=slot.start_time,
        end_time=slot.end_time,
    )


@router.post(
    "/facilities",
    response_model=FacilityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a bookable facility",
    responses=AUTH_ERRORS,
)
def create_facility(
    payload: FacilityCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> FacilityResponse:
    """Register a facility such as the clubhouse or tennis court."""
    facility = Facility(
        tenant_id=tenant_id,
        name=payload.name,
        type=payload.type,
        capacity=payload.capacity,
        rules=payload.rules,
    )
    db.add(facility)
    db.flush()
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="FACILITY_CREATED",
        entity_type="Facility",
        entity_id=facility.id,
        detail=facility.name,
    )
    db.commit()
    db.refresh(facility)
    return FacilityResponse.model_validate(facility)


@router.get(
    "/facilities",
    response_model=list[FacilityResponse],
    summary="List the society's facilities",
    responses=AUTH_ERRORS,
)
def list_facilities(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[FacilityResponse]:
    """Return every facility residents can book."""
    facilities = db.scalars(
        select(Facility).where(Facility.tenant_id == tenant_id).order_by(Facility.name)
    ).all()
    return [FacilityResponse.model_validate(f) for f in facilities]


def _load_facility(db: Session, facility_id: str, tenant_id: str) -> Facility:
    facility = db.get(Facility, facility_id)
    if facility is None or facility.tenant_id != tenant_id:
        raise NotFoundError("Facility not found in this society", error="FACILITY_NOT_FOUND")
    return facility


@router.post(
    "/facilities/{facility_id}/slots",
    response_model=SlotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Publish a bookable time slot",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Facility not found"},
        409: {"model": ErrorResponse, "description": "Slot already exists for this time"},
        422: {"model": ErrorResponse, "description": "end_time is not after start_time"},
    },
)
def create_slot(
    facility_id: str,
    payload: SlotCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> SlotResponse:
    """Open a time window on a facility's calendar."""
    facility = _load_facility(db, facility_id, tenant_id)

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if payload.date < today_str:
        raise ConflictError(
            "Cannot publish a slot for a past date", error="SLOT_NOT_BOOKABLE"
        )

    duplicate = db.scalar(
        select(FacilitySlot).where(
            FacilitySlot.facility_id == facility.id,
            FacilitySlot.date == payload.date,
            FacilitySlot.start_time == payload.start_time,
        )
    )
    if duplicate is not None:
        raise ConflictError(
            f"A slot already starts at {payload.start_time} on {payload.date}",
            error="SLOT_ALREADY_EXISTS",
        )

    slot = FacilitySlot(
        facility_id=facility.id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_bookable=payload.is_bookable,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _slot_response(db, slot)


@router.get(
    "/facilities/{facility_id}/slots",
    response_model=list[SlotResponse],
    summary="View a facility's calendar",
    responses={**AUTH_ERRORS, 404: {"model": ErrorResponse, "description": "Facility not found"}},
)
def list_slots(
    facility_id: str,
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Filter to one day"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[SlotResponse]:
    """List slots with live availability, so the UI can grey out taken ones."""
    facility = _load_facility(db, facility_id, tenant_id)

    query = select(FacilitySlot).where(FacilitySlot.facility_id == facility.id)
    if date:
        query = query.where(FacilitySlot.date == date)
    slots = db.scalars(query.order_by(FacilitySlot.date, FacilitySlot.start_time)).all()
    return [_slot_response(db, s) for s in slots]


@router.post(
    "/bookings",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book a facility slot",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Slot not found in this society"},
        409: {"model": ErrorResponse, "description": "Slot is already booked or not bookable"},
    },
)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> BookingResponse:
    """Reserve a slot for the caller.

    The check-and-insert runs inside a per-slot lock so two residents pressing
    *Book* simultaneously cannot both succeed; the second receives a 409.
    """
    slot = db.get(FacilitySlot, payload.slot_id)
    if slot is None:
        raise NotFoundError("Slot not found", error="SLOT_NOT_FOUND")

    facility = db.get(Facility, slot.facility_id)
    if facility is None or facility.tenant_id != tenant_id:
        raise NotFoundError("Slot not found in this society", error="SLOT_NOT_FOUND")

    if not slot.is_bookable:
        raise ConflictError(
            "This slot has been blocked by the society office", error="SLOT_NOT_BOOKABLE"
        )

    try:
        slot_end_dt = datetime.strptime(f"{slot.date} {slot.end_time}", "%Y-%m-%d %H:%M")
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        if slot_end_dt < now_naive:
            raise ConflictError(
                "This slot is in the past and cannot be booked", error="SLOT_NOT_BOOKABLE"
            )
    except ValueError:
        pass

    with _slot_locks[slot.id]:
        if _confirmed_booking(db, slot.id) is not None:
            raise ConflictError(
                "This slot has already been booked", error="SLOT_ALREADY_BOOKED"
            )

        booking = Booking(
            tenant_id=tenant_id,
            slot_id=slot.id,
            booked_by=user.id,
            status=BookingStatus.CONFIRMED.value,
        )
        db.add(booking)
        try:
            db.flush()
        except IntegrityError as exc:
            # The partial unique index caught a race the lock did not cover
            # (for example a second process). Same outcome for the caller; the
            # cause is kept so the server log shows the database made the call.
            db.rollback()
            raise ConflictError(
                "This slot has already been booked", error="SLOT_ALREADY_BOOKED"
            ) from exc

        notifications.notify(
            db,
            tenant_id=tenant_id,
            user_id=user.id,
            notification_type=NotificationType.BOOKING_CONFIRMED.value,
            title=f"{facility.name} booked",
            body=f"{slot.date} {slot.start_time}–{slot.end_time}",
        )
        audit.record(
            db,
            tenant_id=tenant_id,
            actor=user.id,
            action="BOOKING_CREATED",
            entity_type="Booking",
            entity_id=booking.id,
            detail=f"{facility.name} {slot.date} {slot.start_time}",
        )
        db.commit()
        db.refresh(booking)

    return _booking_response(booking, slot, facility)


@router.get(
    "/bookings",
    response_model=list[BookingResponse],
    summary="List bookings",
    responses=AUTH_ERRORS,
)
def list_bookings(
    mine: bool = Query(True, description="Only the caller's bookings; officials may set false"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[BookingResponse]:
    """Return bookings, defaulting to the caller's own.

    Only officials may widen the view to the whole society.
    """
    query = select(Booking).where(Booking.tenant_id == tenant_id)
    if mine or user.role != Role.SOCIETY_OFFICIAL.value:
        query = query.where(Booking.booked_by == user.id)

    results = []
    for booking in db.scalars(query.order_by(Booking.created_at.desc())):
        slot = db.get(FacilitySlot, booking.slot_id)
        facility = db.get(Facility, slot.facility_id) if slot else None
        if slot and facility:
            results.append(_booking_response(booking, slot, facility))
    return results


@router.post(
    "/bookings/{booking_id}/cancel",
    response_model=BookingResponse,
    summary="Cancel a booking",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Booking not found"},
        409: {"model": ErrorResponse, "description": "Booking is already cancelled"},
    },
)
def cancel_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> BookingResponse:
    """Release a slot. Cancelling makes the slot bookable by someone else."""
    booking = db.get(Booking, booking_id)
    if booking is None or booking.tenant_id != tenant_id:
        raise NotFoundError("Booking not found", error="BOOKING_NOT_FOUND")

    if booking.booked_by != user.id and user.role != Role.SOCIETY_OFFICIAL.value:
        raise ForbiddenError("You may only cancel your own bookings", error="NOT_YOUR_BOOKING")

    if booking.status == BookingStatus.CANCELLED.value:
        raise ConflictError("This booking is already cancelled", error="ALREADY_CANCELLED")

    booking.status = BookingStatus.CANCELLED.value
    booking.cancelled_at = datetime.now(timezone.utc).replace(tzinfo=None)

    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="BOOKING_CANCELLED",
        entity_type="Booking",
        entity_id=booking.id,
    )
    db.commit()
    db.refresh(booking)

    slot = db.get(FacilitySlot, booking.slot_id)
    facility = db.get(Facility, slot.facility_id)
    return _booking_response(booking, slot, facility)


@router.get(
    "/bookings/{booking_id}",
    response_model=BookingResponse,
    summary="Get a booking confirmation details",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Booking not found"},
    },
)
def get_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> BookingResponse:
    """Fetch details of a single booking."""
    booking = db.get(Booking, booking_id)
    if booking is None or booking.tenant_id != tenant_id:
        raise NotFoundError("Booking not found", error="BOOKING_NOT_FOUND")

    if booking.booked_by != user.id and user.role != Role.SOCIETY_OFFICIAL.value:
        raise ForbiddenError("You may only view your own bookings", error="NOT_YOUR_BOOKING")

    slot = db.get(FacilitySlot, booking.slot_id)
    facility = db.get(Facility, slot.facility_id) if slot else None
    return _booking_response(booking, slot, facility)


@router.patch(
    "/facilities/{facility_id}/slots/{slot_id}",
    response_model=SlotResponse,
    summary="Update a slot's availability status (Society Official)",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Facility or slot not found"},
    },
)
def update_slot(
    facility_id: str,
    slot_id: str,
    payload: SlotUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> SlotResponse:
    """Block or unblock a time slot on the facility schedule."""
    facility = _load_facility(db, facility_id, tenant_id)
    slot = db.get(FacilitySlot, slot_id)
    if slot is None or slot.facility_id != facility.id:
        raise NotFoundError("Slot not found", error="SLOT_NOT_FOUND")

    slot.is_bookable = payload.is_bookable
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="SLOT_UPDATED",
        entity_type="FacilitySlot",
        entity_id=slot.id,
        detail=f"is_bookable={payload.is_bookable}",
    )
    db.commit()
    db.refresh(slot)
    return _slot_response(db, slot)

