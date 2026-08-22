"""Maintenance invoicing and payment endpoints (Epic 1).

User stories:
- *"As a resident, I want to see my maintenance dues and pay them online so
  that I don't have to visit the society office."*
- *"As a society official, I want to raise monthly invoices and track
  collection so that dues are transparent."*
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import CurrentUser, get_current_user, get_tenant_id, require_roles
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.security import verify_signature
from app.db.session import get_db
from app.models import (
    Flat,
    FlatOwnership,
    InvoiceStatus,
    MaintenanceInvoice,
    NotificationType,
    Payment,
    PaymentRiskScore,
    PaymentStatus,
    Role,
    utcnow,
)
from app.schemas import (
    ErrorResponse,
    InvoiceCreate,
    InvoiceResponse,
    MaintenanceSummaryResponse,
    MessageResponse,
    OfflinePaymentRequest,
    PaymentConfirmRequest,
    PaymentOrderResponse,
    PaymentResponse,
    RiskScoreResponse,
)
from app.services import audit, notifications
from app.services.ml_client import score_payment_risk

router = APIRouter(prefix="/maintenance", tags=["Maintenance & Payments"])

AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    403: {"model": ErrorResponse, "description": "Role is not permitted to perform this action"},
}


def _flat_ids_for(db: Session, user_id: str) -> list[str]:
    """Flats the user owns or rents — the scope of their personal invoice view."""
    return list(db.scalars(select(FlatOwnership.flat_id).where(FlatOwnership.user_id == user_id)))


def _is_official(user: CurrentUser) -> bool:
    return user.role == Role.SOCIETY_OFFICIAL.value


def _risk_for_flat(db: Session, *, tenant_id: str, flat_id: str) -> float:
    """Likelihood this flat pays its next invoice late.

    Features come from the flat's own invoice history. The ML service owns the
    model in production; `score_payment_risk` is the documented deterministic
    fallback, so this answers either way.
    """
    history = list(
        db.scalars(
            select(MaintenanceInvoice).where(
                MaintenanceInvoice.tenant_id == tenant_id,
                MaintenanceInvoice.flat_id == flat_id,
            )
        )
    )
    settled = [i for i in history if i.status == InvoiceStatus.PAID.value]
    on_time = [i for i in settled if i.paid_at and i.paid_at <= i.due_date]
    overdue_count = len([i for i in history if i.status == InvoiceStatus.OVERDUE.value])

    return score_payment_risk(
        # No settled invoice yet means the punctuality of this flat is unknown,
        # not bad. Passing 0.0 here would have read as "never pays on time" and
        # made every flat's very first invoice look maximally risky.
        on_time_ratio=(len(on_time) / len(settled)) if settled else 0.5,
        overdue_count=overdue_count,
        months_tracked=len(history),
    )


def _occupants_of(db: Session, flat_id: str) -> list[str]:
    return list(db.scalars(select(FlatOwnership.user_id).where(FlatOwnership.flat_id == flat_id)))


def _refresh_overdue(db: Session, invoices: list[MaintenanceInvoice]) -> None:
    """Flip PENDING invoices past their due date to OVERDUE.

    Evaluated on read rather than by a nightly job, so the status is correct
    the moment it is displayed even if a scheduled job missed a run.

    The transition is also the moment the resident should hear about it. Because
    the status persists as OVERDUE afterwards, the branch is taken exactly once
    per invoice however many times the list is read.
    """
    now = utcnow().replace(tzinfo=None)
    changed = False
    for invoice in invoices:
        if invoice.status == InvoiceStatus.PENDING.value and invoice.due_date < now:
            invoice.status = InvoiceStatus.OVERDUE.value
            changed = True
            notifications.notify_many(
                db,
                tenant_id=invoice.tenant_id,
                user_ids=_occupants_of(db, invoice.flat_id),
                notification_type=NotificationType.PAYMENT_OVERDUE.value,
                title=f"Maintenance for {invoice.period} is overdue",
                body=f"₹{invoice.amount:.2f} was due on {invoice.due_date.date()}.",
            )
    if changed:
        db.commit()


@router.post(
    "/invoices",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Raise a maintenance invoice for a flat",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Flat not found in this society"},
        409: {"model": ErrorResponse, "description": "Invoice already exists for this period"},
        422: {"model": ErrorResponse, "description": "Invalid period format or non-positive amount"},
    },
)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> InvoiceResponse:
    """Create one invoice for one flat for one month.

    `(tenant, flat, period)` is unique, so re-running the monthly billing job
    cannot double-charge a resident.
    """
    flat = db.get(Flat, payload.flat_id)
    if flat is None or flat.tenant_id != tenant_id:
        raise NotFoundError("Flat not found in this society", error="FLAT_NOT_FOUND")

    duplicate = db.scalar(
        select(MaintenanceInvoice).where(
            MaintenanceInvoice.tenant_id == tenant_id,
            MaintenanceInvoice.flat_id == payload.flat_id,
            MaintenanceInvoice.period == payload.period,
        )
    )
    if duplicate is not None:
        raise ConflictError(
            f"An invoice for {flat.label} already exists for {payload.period}",
            error="INVOICE_ALREADY_EXISTS",
        )

    invoice = MaintenanceInvoice(
        tenant_id=tenant_id,
        flat_id=payload.flat_id,
        period=payload.period,
        amount=payload.amount,
        due_date=payload.due_date.replace(tzinfo=None),
    )
    db.add(invoice)
    db.flush()

    occupants = _occupants_of(db, flat.id)
    notifications.notify_many(
        db,
        tenant_id=tenant_id,
        user_ids=occupants,
        notification_type=NotificationType.PAYMENT_DUE_SOON.value,
        title=f"Maintenance invoice for {payload.period}",
        body=f"₹{payload.amount:.2f} is due on {payload.due_date.date()}.",
    )

    # Risk-based early reminder (docs/02 section 5.6). A flat with a history of
    # paying late gets a second, earlier nudge rather than only the standard
    # one at the due date. The score is cached per period so the ML service is
    # not consulted on every page load.
    risk = _risk_for_flat(db, tenant_id=tenant_id, flat_id=flat.id)
    db.add(
        PaymentRiskScore(
            tenant_id=tenant_id, flat_id=flat.id, period=payload.period, risk_score=risk
        )
    )
    if risk >= settings.PAYMENT_RISK_REMINDER_THRESHOLD:
        notifications.notify_many(
            db,
            tenant_id=tenant_id,
            user_ids=occupants,
            notification_type=NotificationType.PAYMENT_DUE_SOON.value,
            title=f"Early reminder: maintenance for {payload.period}",
            body=(
                f"₹{payload.amount:.2f} is due on {payload.due_date.date()}. "
                "Paying ahead of the due date avoids a late flag on your flat."
            ),
        )

    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="INVOICE_CREATED",
        entity_type="MaintenanceInvoice",
        entity_id=invoice.id,
        detail=f"{flat.label} {payload.period} ₹{payload.amount}",
    )
    db.commit()
    db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.get(
    "/invoices",
    response_model=list[InvoiceResponse],
    summary="List maintenance invoices",
    responses=AUTH_ERRORS,
)
def list_invoices(
    invoice_status: InvoiceStatus | None = Query(
        None, alias="status", description="Filter by invoice status"
    ),
    flat_id: str | None = Query(None, description="Officials only: filter to one flat"),
    period: str | None = Query(None, description="Filter by billing month, YYYY-MM"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[InvoiceResponse]:
    """Return invoices visible to the caller.

    Officials see the whole society; every other role sees only invoices for
    flats they are linked to.
    """
    query = select(MaintenanceInvoice).where(MaintenanceInvoice.tenant_id == tenant_id)

    if not _is_official(user):
        owned = _flat_ids_for(db, user.id)
        if not owned:
            return []
        query = query.where(MaintenanceInvoice.flat_id.in_(owned))
    elif flat_id:
        query = query.where(MaintenanceInvoice.flat_id == flat_id)

    if period:
        query = query.where(MaintenanceInvoice.period == period)

    invoices = list(db.scalars(query.order_by(MaintenanceInvoice.period.desc())))
    _refresh_overdue(db, invoices)

    if invoice_status:
        invoices = [i for i in invoices if i.status == invoice_status.value]
    return [InvoiceResponse.model_validate(i) for i in invoices]


def _load_invoice(db: Session, invoice_id: str, tenant_id: str) -> MaintenanceInvoice:
    invoice = db.get(MaintenanceInvoice, invoice_id)
    if invoice is None or invoice.tenant_id != tenant_id:
        raise NotFoundError("Invoice not found", error="INVOICE_NOT_FOUND")
    return invoice


def _assert_can_view(db: Session, user: CurrentUser, invoice: MaintenanceInvoice) -> None:
    if _is_official(user):
        return
    if invoice.flat_id not in _flat_ids_for(db, user.id):
        raise ForbiddenError("This invoice belongs to another flat", error="NOT_YOUR_INVOICE")


@router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceResponse,
    summary="Get a single invoice",
    responses={**AUTH_ERRORS, 404: {"model": ErrorResponse, "description": "Invoice not found"}},
)
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> InvoiceResponse:
    """Fetch one invoice, provided the caller is entitled to see it."""
    invoice = _load_invoice(db, invoice_id, tenant_id)
    _assert_can_view(db, user, invoice)
    _refresh_overdue(db, [invoice])
    return InvoiceResponse.model_validate(invoice)


@router.post(
    "/invoices/{invoice_id}/pay",
    response_model=PaymentOrderResponse,
    summary="Create a payment order for an invoice",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Invoice not found"},
        409: {"model": ErrorResponse, "description": "Invoice is already paid"},
    },
)
def create_payment_order(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> PaymentOrderResponse:
    """Open a gateway order so the client can launch checkout.

    The order is recorded as `CREATED`; the invoice is only marked paid once a
    signed confirmation arrives, never on the strength of this call alone.
    """
    invoice = _load_invoice(db, invoice_id, tenant_id)
    _assert_can_view(db, user, invoice)

    if invoice.status == InvoiceStatus.PAID.value:
        raise ConflictError("This invoice has already been paid", error="INVOICE_ALREADY_PAID")

    order_id = f"order_{uuid.uuid4().hex[:16]}"
    db.add(
        Payment(
            invoice_id=invoice.id,
            razorpay_order_id=order_id,
            amount=invoice.amount,
            status=PaymentStatus.CREATED.value,
        )
    )
    db.commit()

    return PaymentOrderResponse(
        order_id=order_id,
        invoice_id=invoice.id,
        amount=invoice.amount,
        key_id=settings.RAZORPAY_KEY_ID,
    )


@router.post(
    "/invoices/{invoice_id}/payments/confirm",
    response_model=PaymentResponse,
    summary="Confirm a payment against an invoice",
    responses={
        **AUTH_ERRORS,
        400: {"model": ErrorResponse, "description": "Signature verification failed"},
        404: {"model": ErrorResponse, "description": "Invoice or payment order not found"},
        409: {"model": ErrorResponse, "description": "Invoice is already paid"},
    },
)
def confirm_payment(
    invoice_id: str,
    payload: PaymentConfirmRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> PaymentResponse:
    """Verify the gateway signature, then settle the invoice.

    The HMAC over `<order_id>|<payment_id>` is checked **before** anything is
    trusted — without it a client could mark any invoice paid for free.
    """
    invoice = _load_invoice(db, invoice_id, tenant_id)
    _assert_can_view(db, user, invoice)

    if invoice.status == InvoiceStatus.PAID.value:
        raise ConflictError("This invoice has already been paid", error="INVOICE_ALREADY_PAID")

    payment = db.scalar(
        select(Payment).where(
            Payment.invoice_id == invoice.id,
            Payment.razorpay_order_id == payload.razorpay_order_id,
        )
    )
    if payment is None:
        raise NotFoundError("No payment order matches this invoice", error="ORDER_NOT_FOUND")

    expected_body = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    if not verify_signature(expected_body, payload.signature, settings.RAZORPAY_KEY_SECRET):
        payment.status = PaymentStatus.FAILED.value
        db.commit()
        raise ForbiddenError(
            "Payment signature verification failed; the invoice was not settled",
            error="INVALID_PAYMENT_SIGNATURE",
        )

    payment.razorpay_payment_id = payload.razorpay_payment_id
    payment.status = PaymentStatus.CAPTURED.value
    payment.method = payload.method

    invoice.status = InvoiceStatus.PAID.value
    invoice.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)

    notifications.notify(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        notification_type=NotificationType.PAYMENT_RECEIVED.value,
        title=f"Payment received for {invoice.period}",
        body=f"₹{invoice.amount:.2f} paid successfully.",
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="PAYMENT_CAPTURED",
        entity_type="MaintenanceInvoice",
        entity_id=invoice.id,
        detail=f"{payload.razorpay_payment_id} ₹{invoice.amount}",
    )
    db.commit()
    db.refresh(payment)
    return PaymentResponse.model_validate(payment)


@router.get(
    "/payments",
    response_model=list[PaymentResponse],
    summary="List payment records",
    responses=AUTH_ERRORS,
)
def list_payments(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[PaymentResponse]:
    """Payment history for the caller's flats, or the whole society for officials."""
    query = (
        select(Payment)
        .join(MaintenanceInvoice, Payment.invoice_id == MaintenanceInvoice.id)
        .where(MaintenanceInvoice.tenant_id == tenant_id)
    )
    if not _is_official(user):
        owned = _flat_ids_for(db, user.id)
        if not owned:
            return []
        query = query.where(MaintenanceInvoice.flat_id.in_(owned))

    payments = db.scalars(query.order_by(Payment.created_at.desc())).all()
    return [PaymentResponse.model_validate(p) for p in payments]


@router.get(
    "/summary",
    response_model=MaintenanceSummaryResponse,
    summary="Collection summary for the society",
    responses=AUTH_ERRORS,
)
def summary(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> MaintenanceSummaryResponse:
    """Aggregate counts and totals powering the official's dashboard."""
    invoices = list(
        db.scalars(select(MaintenanceInvoice).where(MaintenanceInvoice.tenant_id == tenant_id))
    )
    _refresh_overdue(db, invoices)

    paid = [i for i in invoices if i.status == InvoiceStatus.PAID.value]
    pending = [i for i in invoices if i.status == InvoiceStatus.PENDING.value]
    overdue = [i for i in invoices if i.status == InvoiceStatus.OVERDUE.value]

    return MaintenanceSummaryResponse(
        total_invoices=len(invoices),
        paid_count=len(paid),
        pending_count=len(pending),
        overdue_count=len(overdue),
        total_collected=round(sum(i.amount for i in paid), 2),
        total_outstanding=round(sum(i.amount for i in pending + overdue), 2),
    )


@router.get(
    "/flats/{flat_id}/risk-score",
    response_model=RiskScoreResponse,
    summary="Payment-risk score for a flat",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Flat not found in this society"},
    },
)
def risk_score(
    flat_id: str,
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="Billing month, YYYY-MM"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> RiskScoreResponse:
    """Predict how likely a flat is to pay late, so reminders can go out early.

    Backed by the ML service in production; the deterministic fallback keeps
    this endpoint answering even when the model is unavailable.
    """
    flat = db.get(Flat, flat_id)
    if flat is None or flat.tenant_id != tenant_id:
        raise NotFoundError("Flat not found in this society", error="FLAT_NOT_FOUND")

    score = _risk_for_flat(db, tenant_id=tenant_id, flat_id=flat_id)

    record = db.scalar(
        select(PaymentRiskScore).where(
            PaymentRiskScore.tenant_id == tenant_id,
            PaymentRiskScore.flat_id == flat_id,
            PaymentRiskScore.period == period,
        )
    )
    if record is None:
        record = PaymentRiskScore(
            tenant_id=tenant_id, flat_id=flat_id, period=period, risk_score=score
        )
        db.add(record)
    else:
        record.risk_score = score
        record.computed_at = utcnow().replace(tzinfo=None)
    db.commit()
    db.refresh(record)

    return RiskScoreResponse(
        flat_id=flat_id,
        period=period,
        risk_score=record.risk_score,
        computed_at=record.computed_at,
    )


@router.post(
    "/invoices/{invoice_id}/remind",
    response_model=MessageResponse,
    summary="Send a payment reminder for an invoice",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Invoice not found"},
        409: {"model": ErrorResponse, "description": "Invoice is already paid"},
    },
)
def remind_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> MessageResponse:
    """Send a payment reminder notification to occupants linked to the invoice flat."""
    invoice = _load_invoice(db, invoice_id, tenant_id)
    if invoice.status == InvoiceStatus.PAID.value:
        raise ConflictError("This invoice has already been paid", error="INVOICE_ALREADY_PAID")

    occupants = list(
        db.scalars(select(FlatOwnership.user_id).where(FlatOwnership.flat_id == invoice.flat_id))
    )
    if not occupants:
        return MessageResponse(message="No residents linked to this flat to send reminder to")

    notifications.notify_many(
        db,
        tenant_id=tenant_id,
        user_ids=occupants,
        notification_type=NotificationType.PAYMENT_DUE_SOON.value,
        title=f"Payment Reminder: Maintenance for {invoice.period}",
        body=f"Reminder: ₹{invoice.amount:.2f} due on {invoice.due_date.date()}.",
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="INVOICE_REMINDER_SENT",
        entity_type="MaintenanceInvoice",
        entity_id=invoice.id,
        detail=f"Period {invoice.period}",
    )
    db.commit()
    return MessageResponse(message=f"Reminder sent to {len(occupants)} resident(s)")


@router.post(
    "/invoices/{invoice_id}/offline-payment",
    response_model=PaymentResponse,
    summary="Record an offline maintenance payment (Society Official)",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Invoice not found"},
        409: {"model": ErrorResponse, "description": "Invoice is already paid"},
    },
)
def record_offline_payment(
    invoice_id: str,
    payload: OfflinePaymentRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> PaymentResponse:
    """Manually record a cash/cheque/bank-transfer payment and mark the invoice paid."""
    invoice = _load_invoice(db, invoice_id, tenant_id)
    if invoice.status == InvoiceStatus.PAID.value:
        raise ConflictError("This invoice has already been paid", error="INVOICE_ALREADY_PAID")

    order_id = f"offline_{uuid.uuid4().hex[:16]}"
    payment_id = f"pay_{uuid.uuid4().hex[:16]}"
    payment = Payment(
        invoice_id=invoice.id,
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        amount=invoice.amount,
        status=PaymentStatus.CAPTURED.value,
        method=payload.method,
    )
    db.add(payment)

    invoice.status = InvoiceStatus.PAID.value
    invoice.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)

    occupants = list(
        db.scalars(select(FlatOwnership.user_id).where(FlatOwnership.flat_id == invoice.flat_id))
    )
    notifications.notify_many(
        db,
        tenant_id=tenant_id,
        user_ids=occupants,
        notification_type=NotificationType.PAYMENT_RECEIVED.value,
        title=f"Payment recorded for {invoice.period}",
        body=f"Offline payment of ₹{invoice.amount:.2f} ({payload.method}) recorded.",
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="OFFLINE_PAYMENT_RECORDED",
        entity_type="MaintenanceInvoice",
        entity_id=invoice.id,
        detail=f"{payload.method} ₹{invoice.amount}",
    )
    db.commit()
    db.refresh(payment)
    return PaymentResponse.model_validate(payment)


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentResponse,
    summary="Get payment details / receipt",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Payment record not found"},
    },
)
def get_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> PaymentResponse:
    """Fetch details/receipt for a single payment."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("Payment not found", error="ORDER_NOT_FOUND")
    invoice = db.get(MaintenanceInvoice, payment.invoice_id)
    if invoice is None or invoice.tenant_id != tenant_id:
        raise NotFoundError("Payment not found", error="ORDER_NOT_FOUND")

    _assert_can_view(db, user, invoice)
    return PaymentResponse.model_validate(payment)

