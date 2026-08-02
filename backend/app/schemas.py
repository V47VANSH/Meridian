"""Pydantic request/response models.

These are the contract the frontend generates its client from, so every field
carries a description and an example — they become the schema documentation in
the generated OpenAPI spec.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    Audience,
    BookingStatus,
    ComplaintCategory,
    ComplaintStatus,
    GuestPassStatus,
    InvoiceStatus,
    OccupancyType,
    Relation,
    Role,
    SOSStatus,
    UrgencyLevel,
)

ORM = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


class ErrorResponse(BaseModel):
    """The uniform error body returned by every failing endpoint."""

    statusCode: int = Field(..., description="HTTP status code", examples=[400])
    error: str = Field(..., description="Machine-readable error code", examples=["VALIDATION_ERROR"])
    message: str = Field(..., description="Human-readable explanation")
    requestId: str = Field(..., description="Correlation id for server-side logs")


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    tenant_id: str = Field(..., description="Society the user is registering into")
    email: EmailStr = Field(..., description="Login email, unique within the society")
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field("", max_length=20)
    role: Role = Field(Role.RESIDENT_OWNER, description="Requested role")
    flat_id: str | None = Field(None, description="Flat to link the user to, when applicable")

    @field_validator("role")
    @classmethod
    def reject_privileged_self_registration(cls, value: Role) -> Role:
        """Nobody can hand themselves platform or society-admin rights on signup."""
        if value in {Role.SUPER_ADMIN, Role.SOCIETY_OFFICIAL}:
            raise ValueError(f"{value.value} accounts are created by an administrator, not by signup")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_id: str | None = Field(
        None, description="Required only when the same email exists in several societies"
    )


class TokenResponse(BaseModel):
    access_token: str = Field(..., description="Bearer token, expires in 15 minutes")
    refresh_token: str = Field(..., description="Used to obtain a new access token")
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds")


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = ORM

    id: str
    email: str
    full_name: str
    role: str
    phone: str
    status: str
    tenant_id: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Tenants & flats
# ---------------------------------------------------------------------------


class TenantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str = Field("", max_length=500)


class TenantResponse(BaseModel):
    model_config = ORM

    id: str
    name: str
    address: str
    created_at: datetime


class FlatCreate(BaseModel):
    block: str = Field(..., min_length=1, max_length=16, examples=["B"])
    flat_number: str = Field(..., min_length=1, max_length=16, examples=["304"])
    occupancy_type: OccupancyType = OccupancyType.OWNER_OCCUPIED


class FlatResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    block: str
    flat_number: str
    occupancy_type: str
    label: str = Field(..., description="Display identifier, e.g. B-304")


class FlatAssignRequest(BaseModel):
    user_id: str
    relation: Relation = Relation.OWNER


# ---------------------------------------------------------------------------
# Maintenance & payments
# ---------------------------------------------------------------------------


class InvoiceCreate(BaseModel):
    flat_id: str
    period: str = Field(..., pattern=r"^\d{4}-\d{2}$", description="Billing month, YYYY-MM")
    amount: float = Field(..., gt=0, description="Amount payable in INR")
    due_date: datetime


class InvoiceResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    flat_id: str
    period: str
    amount: float
    due_date: datetime
    status: str
    paid_at: datetime | None
    created_at: datetime


class PaymentOrderResponse(BaseModel):
    """Returned to the client so it can open the gateway checkout."""

    order_id: str = Field(..., description="Gateway order id")
    invoice_id: str
    amount: float
    currency: str = "INR"
    key_id: str = Field(..., description="Public gateway key for the checkout widget")


class PaymentConfirmRequest(BaseModel):
    """Client-side confirmation, verified by signature before it is trusted."""

    razorpay_order_id: str
    razorpay_payment_id: str
    signature: str = Field(..., description="HMAC-SHA256 of '<order_id>|<payment_id>'")
    method: str = Field("card", max_length=32)


class PaymentResponse(BaseModel):
    model_config = ORM

    id: str
    invoice_id: str
    razorpay_order_id: str
    razorpay_payment_id: str | None
    amount: float
    status: str
    method: str
    created_at: datetime


class MaintenanceSummaryResponse(BaseModel):
    total_invoices: int
    paid_count: int
    pending_count: int
    overdue_count: int
    total_collected: float
    total_outstanding: float


class RiskScoreResponse(BaseModel):
    flat_id: str
    period: str
    risk_score: float = Field(..., description="0 = reliable payer, 1 = very likely to pay late")
    computed_at: datetime


# ---------------------------------------------------------------------------
# Complaints
# ---------------------------------------------------------------------------


class ComplaintCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, description="Free text, classified automatically")
    flat_id: str | None = None
    attachment_urls: list[str] = Field(default_factory=list)
    # Callers may override the automatic classification when they are certain.
    category: ComplaintCategory | None = None
    urgency: UrgencyLevel | None = None


class ComplaintStatusUpdate(BaseModel):
    status: ComplaintStatus
    note: str = Field("", max_length=500)


class ComplaintAssignRequest(BaseModel):
    assigned_to: str = Field(..., description="User id of the staff member")


class ComplaintHistoryEntry(BaseModel):
    model_config = ORM

    id: str
    status: str
    changed_by: str
    note: str
    changed_at: datetime


class ComplaintResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    raised_by: str
    flat_id: str | None
    title: str
    description: str
    category: str
    urgency: str
    status: str
    assigned_to: str | None
    attachment_urls: list[str]
    needs_manual_triage: bool
    classification_confidence: float
    created_at: datetime
    resolved_at: datetime | None
    history: list[ComplaintHistoryEntry] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Facilities & bookings
# ---------------------------------------------------------------------------


class FacilityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    type: str = Field("COMMON", max_length=60)
    capacity: int = Field(1, ge=1)
    rules: str = ""


class FacilityResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    name: str
    type: str
    capacity: int
    rules: str


class SlotCreate(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", examples=["2026-07-14"])
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", examples=["18:00"])
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", examples=["19:00"])
    is_bookable: bool = True

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, end: str, info) -> str:
        start = info.data.get("start_time")
        if start and end <= start:
            raise ValueError("end_time must be later than start_time")
        return end


class SlotResponse(BaseModel):
    model_config = ORM

    id: str
    facility_id: str
    date: str
    start_time: str
    end_time: str
    is_bookable: bool
    is_available: bool = Field(..., description="False when a confirmed booking already exists")


class BookingCreate(BaseModel):
    slot_id: str


class BookingResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    slot_id: str
    booked_by: str
    status: str
    created_at: datetime
    cancelled_at: datetime | None
    facility_name: str | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None


# ---------------------------------------------------------------------------
# Visitors & SOS
# ---------------------------------------------------------------------------


class GuestPassCreate(BaseModel):
    visitor_name: str = Field(..., min_length=1, max_length=120)
    visitor_phone: str = Field("", max_length=20)
    purpose: str = Field("", max_length=200)
    flat_id: str
    valid_from: datetime
    valid_until: datetime

    @field_validator("valid_until")
    @classmethod
    def window_must_be_positive(cls, until: datetime, info) -> datetime:
        start = info.data.get("valid_from")
        if start and until <= start:
            raise ValueError("valid_until must be later than valid_from")
        return until


class GuestPassResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    flat_id: str
    generated_by: str
    visitor_name: str
    visitor_phone: str
    purpose: str
    valid_from: datetime
    valid_until: datetime
    status: str
    used_at: datetime | None
    created_at: datetime
    qr_token: str | None = Field(
        None, description="Returned to the resident who created the pass; omitted elsewhere"
    )


class GuestPassVerifyResponse(BaseModel):
    valid: bool = Field(..., description="Whether the guard should admit the visitor")
    reason: str = Field(..., description="Why the pass was accepted or rejected")
    visitor_name: str | None = None
    flat_label: str | None = None
    pass_id: str | None = None
    verified_at: datetime | None = None


class SOSCreate(BaseModel):
    flat_id: str | None = None
    location_note: str = Field("", max_length=300)


class SOSResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    raised_by: str
    flat_id: str | None
    status: str
    location_note: str
    acknowledged_by: str | None
    acknowledged_at: datetime | None
    created_at: datetime
    resolved_at: datetime | None


# ---------------------------------------------------------------------------
# Announcements & notifications
# ---------------------------------------------------------------------------


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=1)
    audience: Audience = Audience.ALL


class AnnouncementResponse(BaseModel):
    model_config = ORM

    id: str
    tenant_id: str
    posted_by: str
    title: str
    body: str
    audience: str
    created_at: datetime


class NotificationResponse(BaseModel):
    model_config = ORM

    id: str
    user_id: str
    type: str
    channel: str
    title: str
    body: str
    read_at: datetime | None
    sent_at: datetime


# Re-exported so routers can reference the enums for query parameters.
__all__ = [name for name in dir() if not name.startswith("_")]

_ENUMS = (
    InvoiceStatus,
    ComplaintStatus,
    BookingStatus,
    GuestPassStatus,
    SOSStatus,
)
