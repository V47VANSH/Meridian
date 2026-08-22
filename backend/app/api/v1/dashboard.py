"""Dashboard aggregation endpoints (Epic 5 & 6).

User stories:
- *"As a residential member/flat owner, I want to view my payments, complaints, and bookings in one place."*
- *"As a society official, I want to access society records and communications from one place."*
- *"As a non-residential flat owner, I want to view my maintenance payments and complaint status remotely."*
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.announcements import _visible_to
from app.api.v1.bookings import _booking_response
from app.api.v1.complaints import _to_response
from app.api.v1.maintenance import _flat_ids_for, _refresh_overdue
from app.core.deps import CurrentUser, get_current_user, get_tenant_id, require_roles
from app.db.session import get_db
from app.models import (
    Announcement,
    Booking,
    BookingStatus,
    Complaint,
    ComplaintStatus,
    Facility,
    FacilitySlot,
    Flat,
    FlatOwnership,
    InvoiceStatus,
    MaintenanceInvoice,
    Role,
    SOSIncident,
    SOSStatus,
)
from app.schemas import (
    AnnouncementResponse,
    ErrorResponse,
    InvoiceResponse,
    NonResidentDashboardResponse,
    OfficialDashboardResponse,
    ResidentDashboardResponse,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    403: {"model": ErrorResponse, "description": "Role is not permitted to perform this action"},
}


@router.get(
    "/resident",
    response_model=ResidentDashboardResponse,
    summary="Get resident dashboard data",
    responses=AUTH_ERRORS,
)
def resident_dashboard(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> ResidentDashboardResponse:
    """Aggregate dues, complaints, bookings and notices for the resident dashboard."""
    owned = _flat_ids_for(db, user.id)

    # Pending invoice
    pending_invoice = None
    if owned:
        inv = db.scalar(
            select(MaintenanceInvoice)
            .where(
                MaintenanceInvoice.tenant_id == tenant_id,
                MaintenanceInvoice.flat_id.in_(owned),
                MaintenanceInvoice.status != InvoiceStatus.PAID.value,
            )
            .order_by(MaintenanceInvoice.due_date.asc())
        )
        if inv:
            # The invoice list re-evaluates overdue status on read; without the
            # same step here the dashboard reports an invoice as PENDING that
            # every other screen shows as OVERDUE.
            _refresh_overdue(db, [inv])
            pending_invoice = InvoiceResponse.model_validate(inv)

    # Open complaints
    c_rows = list(
        db.scalars(
            select(Complaint)
            .where(
                Complaint.tenant_id == tenant_id,
                Complaint.raised_by == user.id,
                Complaint.status != ComplaintStatus.CLOSED.value,
            )
            .order_by(Complaint.created_at.desc())
        )
    )
    open_complaints = [_to_response(c) for c in c_rows]

    # Upcoming bookings. Joined to the slot so "upcoming" means what it says:
    # ordering by when the booking was created put a slot from last month
    # ahead of one later this week, and past slots were included at all.
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    b_rows = list(
        db.scalars(
            select(Booking)
            .join(FacilitySlot, FacilitySlot.id == Booking.slot_id)
            .where(
                Booking.tenant_id == tenant_id,
                Booking.booked_by == user.id,
                Booking.status == BookingStatus.CONFIRMED.value,
                FacilitySlot.date >= today,
            )
            .order_by(FacilitySlot.date.asc(), FacilitySlot.start_time.asc())
        )
    )
    upcoming_bookings = []
    for b in b_rows:
        slot = db.get(FacilitySlot, b.slot_id)
        facility = db.get(Facility, slot.facility_id) if slot else None
        if slot and facility:
            upcoming_bookings.append(_booking_response(b, slot, facility))

    # Announcements
    a_rows = list(
        db.scalars(
            select(Announcement)
            .where(Announcement.tenant_id == tenant_id)
            .order_by(Announcement.created_at.desc())
            .limit(5)
        )
    )
    latest_announcements = [
        AnnouncementResponse.model_validate(a) for a in a_rows if _visible_to(a.audience, user.role)
    ]

    return ResidentDashboardResponse(
        pending_invoice=pending_invoice,
        open_complaints=open_complaints,
        upcoming_bookings=upcoming_bookings,
        latest_announcements=latest_announcements,
    )


@router.get(
    "/official",
    response_model=OfficialDashboardResponse,
    summary="Get official dashboard metrics",
    responses=AUTH_ERRORS,
)
def official_dashboard(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> OfficialDashboardResponse:
    """Aggregate society-wide metrics for the official dashboard."""
    open_complaints_count = len(
        list(
            db.scalars(
                select(Complaint.id).where(
                    Complaint.tenant_id == tenant_id,
                    Complaint.status.in_(
                        [ComplaintStatus.OPEN.value, ComplaintStatus.IN_PROGRESS.value]
                    ),
                )
            )
        )
    )

    overdue_invoices_count = len(
        list(
            db.scalars(
                select(MaintenanceInvoice.id).where(
                    MaintenanceInvoice.tenant_id == tenant_id,
                    MaintenanceInvoice.status == InvoiceStatus.OVERDUE.value,
                )
            )
        )
    )

    pending_invoices = list(
        db.scalars(
            select(MaintenanceInvoice.flat_id).where(
                MaintenanceInvoice.tenant_id == tenant_id,
                MaintenanceInvoice.status != InvoiceStatus.PAID.value,
            )
        )
    )
    pending_dues_residents_count = len(set(pending_invoices))

    active_bookings_count = len(
        list(
            db.scalars(
                select(Booking.id).where(
                    Booking.tenant_id == tenant_id,
                    Booking.status == BookingStatus.CONFIRMED.value,
                )
            )
        )
    )

    active_sos_count = len(
        list(
            db.scalars(
                select(SOSIncident.id).where(
                    SOSIncident.tenant_id == tenant_id,
                    SOSIncident.status.in_([SOSStatus.OPEN.value, SOSStatus.ACKNOWLEDGED.value]),
                )
            )
        )
    )

    total_flats = len(
        list(db.scalars(select(Flat.id).where(Flat.tenant_id == tenant_id)))
    )

    return OfficialDashboardResponse(
        open_complaints_count=open_complaints_count,
        overdue_invoices_count=overdue_invoices_count,
        pending_dues_residents_count=pending_dues_residents_count,
        active_bookings_count=active_bookings_count,
        active_sos_count=active_sos_count,
        total_flats=total_flats,
    )


@router.get(
    "/non-resident",
    response_model=NonResidentDashboardResponse,
    summary="Get non-resident owner dashboard data",
    responses=AUTH_ERRORS,
)
def non_resident_dashboard(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> NonResidentDashboardResponse:
    """Aggregate dues, complaints, and notices for non-resident owners."""
    owned = _flat_ids_for(db, user.id)

    pending_invoice = None
    if owned:
        inv = db.scalar(
            select(MaintenanceInvoice)
            .where(
                MaintenanceInvoice.tenant_id == tenant_id,
                MaintenanceInvoice.flat_id.in_(owned),
                MaintenanceInvoice.status != InvoiceStatus.PAID.value,
            )
            .order_by(MaintenanceInvoice.due_date.asc())
        )
        if inv:
            # The invoice list re-evaluates overdue status on read; without the
            # same step here the dashboard reports an invoice as PENDING that
            # every other screen shows as OVERDUE.
            _refresh_overdue(db, [inv])
            pending_invoice = InvoiceResponse.model_validate(inv)

    c_rows = list(
        db.scalars(
            select(Complaint)
            .where(
                Complaint.tenant_id == tenant_id,
                Complaint.raised_by == user.id,
                Complaint.status != ComplaintStatus.CLOSED.value,
            )
            .order_by(Complaint.created_at.desc())
        )
    )
    open_complaints = [_to_response(c) for c in c_rows]

    a_rows = list(
        db.scalars(
            select(Announcement)
            .where(Announcement.tenant_id == tenant_id)
            .order_by(Announcement.created_at.desc())
            .limit(5)
        )
    )
    latest_announcements = [
        AnnouncementResponse.model_validate(a) for a in a_rows if _visible_to(a.audience, user.role)
    ]

    return NonResidentDashboardResponse(
        pending_invoice=pending_invoice,
        open_complaints=open_complaints,
        latest_announcements=latest_announcements,
    )
