"""SQLAlchemy ORM models.

A direct translation of the ER diagram in `docs/09-database-design.md`:
18 tables, the same column names, the same unique constraints and the same
`(tenant_id, ...)`-prefixed indexes.

Enums are declared as Python `str` enums and stored as VARCHAR with a CHECK
constraint, which keeps the values readable in the database and avoids the
migration cost of native Postgres enum types.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def new_id() -> str:
    """Primary keys are opaque UUID hex strings — never guessable, never sequential."""
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums (mirrors doc 09 section 5)
# ---------------------------------------------------------------------------


class Role(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    SOCIETY_OFFICIAL = "SOCIETY_OFFICIAL"
    RESIDENT_OWNER = "RESIDENT_OWNER"
    NON_RESIDENT_OWNER = "NON_RESIDENT_OWNER"
    SECURITY_GUARD = "SECURITY_GUARD"
    MAINTENANCE_STAFF = "MAINTENANCE_STAFF"
    CLEANING_STAFF = "CLEANING_STAFF"
    SERVICE_PROVIDER = "SERVICE_PROVIDER"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class OccupancyType(str, enum.Enum):
    OWNER_OCCUPIED = "OWNER_OCCUPIED"
    RENTED = "RENTED"
    VACANT = "VACANT"


class Relation(str, enum.Enum):
    OWNER = "OWNER"
    RESIDENT_TENANT = "RESIDENT_TENANT"


class InvoiceStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    OVERDUE = "OVERDUE"


class PaymentStatus(str, enum.Enum):
    CREATED = "CREATED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"


class ComplaintStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class ComplaintCategory(str, enum.Enum):
    PLUMBING = "PLUMBING"
    ELECTRICAL = "ELECTRICAL"
    STRUCTURAL = "STRUCTURAL"
    SECURITY = "SECURITY"
    CLEANING = "CLEANING"
    GENERAL = "GENERAL"


class UrgencyLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class BookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class GuestPassStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    USED = "USED"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class SOSStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class Audience(str, enum.Enum):
    ALL = "ALL"
    RESIDENTS = "RESIDENTS"
    NON_RESIDENT_OWNERS = "NON_RESIDENT_OWNERS"
    STAFF = "STAFF"


class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    PUSH = "PUSH"
    EMAIL = "EMAIL"
    SMS = "SMS"


class NotificationType(str, enum.Enum):
    SOS_RAISED = "SOS_RAISED"
    PAYMENT_DUE_SOON = "PAYMENT_DUE_SOON"
    PAYMENT_OVERDUE = "PAYMENT_OVERDUE"
    COMPLAINT_STATUS_CHANGED = "COMPLAINT_STATUS_CHANGED"
    BOOKING_CONFIRMED = "BOOKING_CONFIRMED"
    ANNOUNCEMENT_POSTED = "ANNOUNCEMENT_POSTED"


def _values(enum_cls) -> list[str]:
    return [member.value for member in enum_cls]


def _check(column: str, enum_cls, name: str) -> CheckConstraint:
    allowed = ", ".join(f"'{v}'" for v in _values(enum_cls))
    return CheckConstraint(f"{column} IN ({allowed})", name=name)


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


class Tenant(Base):
    """A society. The isolation boundary for every other tenant-scoped table."""

    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    flats: Mapped[list["Flat"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),
        Index("ix_user_tenant_email", "tenant_id", "email"),
        _check("role", Role, "ck_user_role"),
        _check("status", UserStatus, "ck_user_status"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    # Nullable only for SUPER_ADMIN, who sits above every society.
    tenant_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=UserStatus.ACTIVE.value)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    tenant: Mapped["Tenant | None"] = relationship(back_populates="users")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    flat_links: Mapped[list["FlatOwnership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    """Stores only the hash, so a DB dump yields no usable tokens."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_token_hash", "token_hash"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Flat(Base):
    __tablename__ = "flats"
    __table_args__ = (
        UniqueConstraint("tenant_id", "block", "flat_number", name="uq_flat_tenant_block_number"),
        Index("ix_flat_tenant_block_number", "tenant_id", "block", "flat_number"),
        _check("occupancy_type", OccupancyType, "ck_flat_occupancy"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    block: Mapped[str] = mapped_column(String(16), nullable=False)
    flat_number: Mapped[str] = mapped_column(String(16), nullable=False)
    occupancy_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OccupancyType.OWNER_OCCUPIED.value
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="flats")
    owners: Mapped[list["FlatOwnership"]] = relationship(
        back_populates="flat", cascade="all, delete-orphan"
    )

    @property
    def label(self) -> str:
        """Human-facing flat identifier, e.g. `B-304`."""
        return f"{self.block}-{self.flat_number}"


class FlatOwnership(Base):
    """Join table: a user may hold several flats, a flat several occupants."""

    __tablename__ = "flat_ownerships"
    __table_args__ = (_check("relation", Relation, "ck_ownership_relation"),)

    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    flat_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("flats.id", ondelete="CASCADE"), primary_key=True
    )
    relation: Mapped[str] = mapped_column(String(20), nullable=False, default=Relation.OWNER.value)

    user: Mapped["User"] = relationship(back_populates="flat_links")
    flat: Mapped["Flat"] = relationship(back_populates="owners")


class MaintenanceInvoice(Base):
    __tablename__ = "maintenance_invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "flat_id", "period", name="uq_invoice_tenant_flat_period"),
        Index("ix_invoice_tenant_status", "tenant_id", "status"),
        _check("status", InvoiceStatus, "ck_invoice_status"),
        CheckConstraint("amount >= 0", name="ck_invoice_amount_non_negative"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    flat_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("flats.id", ondelete="CASCADE"), nullable=False
    )
    period: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=InvoiceStatus.PENDING.value
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    flat: Mapped["Flat"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )


class Payment(Base):
    """Append-only record of a gateway payment attempt against an invoice."""

    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payment_invoice", "invoice_id"),
        _check("status", PaymentStatus, "ck_payment_status"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("maintenance_invoices.id", ondelete="CASCADE"), nullable=False
    )
    razorpay_order_id: Mapped[str] = mapped_column(String(64), nullable=False)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=PaymentStatus.CREATED.value
    )
    method: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    invoice: Mapped["MaintenanceInvoice"] = relationship(back_populates="payments")


class PaymentRiskScore(Base):
    """ML-produced likelihood that a flat pays late for a given period."""

    __tablename__ = "payment_risk_scores"
    __table_args__ = (
        UniqueConstraint("tenant_id", "flat_id", "period", name="uq_risk_tenant_flat_period"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    flat_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("flats.id", ondelete="CASCADE"), nullable=False
    )
    period: Mapped[str] = mapped_column(String(7), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Complaint(Base):
    __tablename__ = "complaints"
    __table_args__ = (
        Index("ix_complaint_tenant_status_urgency", "tenant_id", "status", "urgency"),
        Index("ix_complaint_tenant_raised_by", "tenant_id", "raised_by"),
        _check("status", ComplaintStatus, "ck_complaint_status"),
        _check("category", ComplaintCategory, "ck_complaint_category"),
        _check("urgency", UrgencyLevel, "ck_complaint_urgency"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    raised_by: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    flat_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("flats.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ComplaintCategory.GENERAL.value
    )
    urgency: Mapped[str] = mapped_column(
        String(10), nullable=False, default=UrgencyLevel.MEDIUM.value
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ComplaintStatus.OPEN.value
    )
    # Null until an official triages the complaint to a staff member.
    assigned_to: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)
    attachment_urls: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # True when ML confidence was too low (or ML was down) and a human must confirm.
    needs_manual_triage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    classification_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    flat: Mapped["Flat | None"] = relationship()
    history: Mapped[list["ComplaintStatusHistory"]] = relationship(
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="ComplaintStatusHistory.changed_at",
    )


class ComplaintStatusHistory(Base):
    """Append-only audit trail of every status transition on a complaint."""

    __tablename__ = "complaint_status_history"
    __table_args__ = (
        Index("ix_history_complaint", "complaint_id"),
        _check("status", ComplaintStatus, "ck_history_status"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    complaint_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    changed_by: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    complaint: Mapped["Complaint"] = relationship(back_populates="history")


class Facility(Base):
    __tablename__ = "facilities"
    __table_args__ = (Index("ix_facility_tenant", "tenant_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[str] = mapped_column(String(60), nullable=False, default="COMMON")
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    rules: Mapped[str] = mapped_column(Text, nullable=False, default="")

    slots: Mapped[list["FacilitySlot"]] = relationship(
        back_populates="facility", cascade="all, delete-orphan"
    )


class FacilitySlot(Base):
    __tablename__ = "facility_slots"
    __table_args__ = (
        UniqueConstraint(
            "facility_id", "date", "start_time", name="uq_slot_facility_date_start"
        ),
        Index("ix_slot_facility_date", "facility_id", "date"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    facility_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    # Lets an official black out a slot (maintenance, private event) without
    # deleting it and losing the booking history attached to it.
    is_bookable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    facility: Mapped["Facility"] = relationship(back_populates="slots")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="slot")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        # The partial unique index is the database-level guarantee against
        # double-booking; the application lock is the first line of defence.
        # Partial (not plain) unique so a cancelled booking frees the slot.
        Index(
            "uq_booking_confirmed_slot",
            "slot_id",
            unique=True,
            sqlite_where=text("status = 'CONFIRMED'"),
            postgresql_where=text("status = 'CONFIRMED'"),
        ),
        Index("ix_booking_tenant_booked_by", "tenant_id", "booked_by"),
        _check("status", BookingStatus, "ck_booking_status"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    slot_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("facility_slots.id", ondelete="CASCADE"), nullable=False
    )
    booked_by: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=BookingStatus.CONFIRMED.value
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    slot: Mapped["FacilitySlot"] = relationship(back_populates="bookings")


class GuestPass(Base):
    __tablename__ = "guest_passes"
    __table_args__ = (
        UniqueConstraint("qr_token", name="uq_guest_pass_token"),
        Index("ix_guest_pass_tenant_flat_status", "tenant_id", "flat_id", "status"),
        _check("status", GuestPassStatus, "ck_guest_pass_status"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    generated_by: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    flat_id: Mapped[str] = mapped_column(String(32), ForeignKey("flats.id"), nullable=False)
    visitor_name: Mapped[str] = mapped_column(String(120), nullable=False)
    visitor_phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    purpose: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    valid_from: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    qr_token: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=GuestPassStatus.ACTIVE.value
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    flat: Mapped["Flat"] = relationship()


class SOSIncident(Base):
    __tablename__ = "sos_incidents"
    __table_args__ = (
        Index("ix_sos_tenant_status", "tenant_id", "status"),
        _check("status", SOSStatus, "ck_sos_status"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    raised_by: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    flat_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("flats.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=SOSStatus.OPEN.value)
    location_note: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    acknowledged_by: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("users.id"), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    flat: Mapped["Flat | None"] = relationship()


class Announcement(Base):
    __tablename__ = "announcements"
    __table_args__ = (
        Index("ix_announcement_tenant_created", "tenant_id", "created_at"),
        _check("audience", Audience, "ck_announcement_audience"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    posted_by: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    audience: Mapped[str] = mapped_column(String(24), nullable=False, default=Audience.ALL.value)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notification_tenant_user_read", "tenant_id", "user_id", "read_at"),
        _check("channel", NotificationChannel, "ck_notification_channel"),
        _check("type", NotificationType, "ck_notification_type"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    channel: Mapped[str] = mapped_column(
        String(10), nullable=False, default=NotificationChannel.IN_APP.value
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="SENT")


class AuditLog(Base):
    """Append-only. Rows are never updated or deleted."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_tenant_entity", "tenant_id", "entity_type", "entity_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(32), nullable=False)
    actor: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(32), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
