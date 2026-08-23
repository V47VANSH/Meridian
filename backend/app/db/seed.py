"""Demo data.

Creates one society with a user per role, flats, invoices, complaints,
facilities and slots — enough to exercise every endpoint in the docs UI
without setting anything up by hand.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal, init_db
from app.models import (
    Announcement,
    Audience,
    Complaint,
    ComplaintCategory,
    ComplaintStatus,
    ComplaintStatusHistory,
    Facility,
    FacilitySlot,
    Flat,
    FlatOwnership,
    InvoiceStatus,
    MaintenanceInvoice,
    OccupancyType,
    Relation,
    Role,
    Tenant,
    UrgencyLevel,
    User,
)

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "Password123"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def seed_if_empty() -> None:
    """Populate demo data only when the database has no societies yet."""
    init_db()
    db = SessionLocal()
    try:
        if db.scalar(select(Tenant).limit(1)) is not None:
            return

        now = _now()

        tenant = Tenant(name="Green Valley Residency", address="Whitefield, Bengaluru 560066")
        db.add(tenant)
        db.flush()

        platform_admin = User(
            tenant_id=None,
            email="admin@platform.example",
            password_hash=hash_password(DEMO_PASSWORD),
            full_name="Platform Administrator",
            role=Role.SUPER_ADMIN.value,
        )
        db.add(platform_admin)

        people = {
            "official": ("official@greenvalley.example", "Meera Iyer", Role.SOCIETY_OFFICIAL),
            "resident": ("resident@greenvalley.example", "Arjun Rao", Role.RESIDENT_OWNER),
            "owner": ("owner@greenvalley.example", "Sunita Desai", Role.NON_RESIDENT_OWNER),
            "guard": ("guard@greenvalley.example", "Ramesh Kumar", Role.SECURITY_GUARD),
            "staff": ("staff@greenvalley.example", "Vikram Singh", Role.MAINTENANCE_STAFF),
        }
        users: dict[str, User] = {}
        for key, (email, name, role) in people.items():
            user = User(
                tenant_id=tenant.id,
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                full_name=name,
                phone="98000000" + str(len(users) + 10),
                role=role.value,
            )
            db.add(user)
            users[key] = user
        db.flush()

        flats = []
        for block, number, occupancy in [
            ("A", "102", OccupancyType.OWNER_OCCUPIED),
            ("B", "304", OccupancyType.OWNER_OCCUPIED),
            ("C", "101", OccupancyType.RENTED),
            ("D", "205", OccupancyType.VACANT),
        ]:
            flat = Flat(
                tenant_id=tenant.id,
                block=block,
                flat_number=number,
                occupancy_type=occupancy.value,
            )
            db.add(flat)
            flats.append(flat)
        db.flush()

        db.add(
            FlatOwnership(
                user_id=users["resident"].id, flat_id=flats[1].id, relation=Relation.OWNER.value
            )
        )
        db.add(
            FlatOwnership(
                user_id=users["owner"].id, flat_id=flats[2].id, relation=Relation.OWNER.value
            )
        )

        # A paid invoice and an unpaid one, so both dashboard states are visible.
        db.add(
            MaintenanceInvoice(
                tenant_id=tenant.id,
                flat_id=flats[1].id,
                period="2026-06",
                amount=4200.0,
                due_date=now - timedelta(days=40),
                status=InvoiceStatus.PAID.value,
                paid_at=now - timedelta(days=42),
            )
        )
        db.add(
            MaintenanceInvoice(
                tenant_id=tenant.id,
                flat_id=flats[1].id,
                period="2026-07",
                amount=4200.0,
                due_date=now + timedelta(days=8),
                status=InvoiceStatus.PENDING.value,
            )
        )

        complaint = Complaint(
            tenant_id=tenant.id,
            raised_by=users["resident"].id,
            flat_id=flats[1].id,
            title="Water leakage in basement parking",
            description="Water is leaking from the ceiling near the B-block parking ramp.",
            category=ComplaintCategory.PLUMBING.value,
            urgency=UrgencyLevel.HIGH.value,
            status=ComplaintStatus.IN_PROGRESS.value,
            assigned_to=users["staff"].id,
            classification_confidence=0.91,
        )
        db.add(complaint)
        db.flush()
        db.add(
            ComplaintStatusHistory(
                complaint_id=complaint.id,
                status=ComplaintStatus.OPEN.value,
                changed_by=users["resident"].id,
                note="Complaint raised",
            )
        )
        db.add(
            ComplaintStatusHistory(
                complaint_id=complaint.id,
                status=ComplaintStatus.IN_PROGRESS.value,
                changed_by=users["official"].id,
                note="Assigned to maintenance staff",
            )
        )

        facility = Facility(
            tenant_id=tenant.id,
            name="Clubhouse",
            type="COMMON",
            capacity=40,
            rules="Booking limited to one slot per flat per day.",
        )
        db.add(facility)
        db.add(Facility(tenant_id=tenant.id, name="Tennis Court", type="SPORTS", capacity=4))
        db.flush()

        booking_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        for start, end in [("06:00", "07:00"), ("17:00", "18:00"), ("18:00", "19:00")]:
            db.add(
                FacilitySlot(
                    facility_id=facility.id,
                    date=booking_date,
                    start_time=start,
                    end_time=end,
                )
            )

        db.add(
            Announcement(
                tenant_id=tenant.id,
                posted_by=users["official"].id,
                title="Water supply interruption",
                body="Water supply will be suspended from 10 AM to 1 PM for tank cleaning.",
                audience=Audience.ALL.value,
            )
        )

        db.commit()
        logger.info("Seeded demo society '%s' (tenant_id=%s)", tenant.name, tenant.id)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_if_empty()
