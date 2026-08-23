"""Society (tenant), flat and directory endpoints.

User story: *"As a society official, I want to manage the society's flats and
residents so that records stay accurate."*
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, get_tenant_id, require_roles
from app.core.errors import ConflictError, NotFoundError
from app.core.security import hash_password
from app.db.session import get_db
from app.models import AuditLog, Flat, FlatOwnership, Role, Tenant, User
from app.schemas import (
    AuditLogResponse,
    ErrorResponse,
    FlatAssignRequest,
    FlatCreate,
    FlatOccupant,
    FlatResponse,
    MessageResponse,
    TenantCreate,
    TenantResponse,
    UserCreate,
    UserResponse,
)
from app.services import audit

router = APIRouter(tags=["Society Administration"])


AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    403: {"model": ErrorResponse, "description": "Role is not permitted to perform this action"},
}


def _flat_response(db: Session, flat: Flat) -> FlatResponse:
    """Serialise a flat together with the people linked to it.

    Every record in the system points at a flat by id, so a directory that
    cannot say who lives in B-304 forces each screen to invent an answer.
    """
    links = db.scalars(
        select(FlatOwnership).where(FlatOwnership.flat_id == flat.id)
    ).all()

    occupants = []
    for link in links:
        occupant = db.get(User, link.user_id)
        if occupant is None:
            continue
        occupants.append(
            FlatOccupant(
                user_id=occupant.id,
                full_name=occupant.full_name,
                email=occupant.email,
                phone=occupant.phone,
                role=occupant.role,
                relation=link.relation,
            )
        )

    return FlatResponse(
        id=flat.id,
        tenant_id=flat.tenant_id,
        block=flat.block,
        flat_number=flat.flat_number,
        occupancy_type=flat.occupancy_type,
        label=flat.label,
        occupants=occupants,
    )


@router.post(
    "/tenants",
    response_model=TenantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a new society (platform admin only)",
    responses=AUTH_ERRORS,
)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SUPER_ADMIN)),
) -> TenantResponse:
    """Create a society. Only the platform operator can do this."""
    tenant = Tenant(name=payload.name, address=payload.address)
    db.add(tenant)
    db.flush()
    audit.record(
        db,
        tenant_id=tenant.id,
        actor=user.id,
        action="TENANT_CREATED",
        entity_type="Tenant",
        entity_id=tenant.id,
        detail=tenant.name,
    )
    db.commit()
    db.refresh(tenant)
    return TenantResponse.model_validate(tenant)


@router.get(
    "/tenants",
    response_model=list[TenantResponse],
    summary="List all societies (platform admin only)",
    responses=AUTH_ERRORS,
)
def list_tenants(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_roles(Role.SUPER_ADMIN)),
) -> list[TenantResponse]:
    """Return every society on the platform."""
    tenants = db.scalars(select(Tenant).order_by(Tenant.created_at.desc())).all()
    return [TenantResponse.model_validate(t) for t in tenants]


@router.post(
    "/flats",
    response_model=FlatResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a flat to the society",
    responses={
        **AUTH_ERRORS,
        409: {"model": ErrorResponse, "description": "Flat already exists in this society"},
    },
)
def create_flat(
    payload: FlatCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> FlatResponse:
    """Register a flat. `(block, flat_number)` is unique within a society."""
    duplicate = db.scalar(
        select(Flat).where(
            Flat.tenant_id == tenant_id,
            Flat.block == payload.block,
            Flat.flat_number == payload.flat_number,
        )
    )
    if duplicate is not None:
        raise ConflictError(
            f"Flat {payload.block}-{payload.flat_number} already exists in this society",
            error="FLAT_ALREADY_EXISTS",
        )

    flat = Flat(
        tenant_id=tenant_id,
        block=payload.block,
        flat_number=payload.flat_number,
        occupancy_type=payload.occupancy_type.value,
    )
    db.add(flat)
    db.flush()
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="FLAT_CREATED",
        entity_type="Flat",
        entity_id=flat.id,
        detail=flat.label,
    )
    db.commit()
    db.refresh(flat)
    return _flat_response(db, flat)


@router.get(
    "/flats",
    response_model=list[FlatResponse],
    summary="List flats in the caller's society",
    responses=AUTH_ERRORS,
)
def list_flats(
    block: str | None = Query(None, description="Filter to a single block"),
    mine: bool = Query(
        False,
        description="Return only the flats the caller owns or rents",
    ),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[FlatResponse]:
    """Return the society's flats, optionally filtered by block or occupancy.

    Without `mine`, this is the society-wide list an official works from. With
    `mine=true` it answers "which flat am I in?" — the question a resident's
    guest pass, SOS alert and invoice screens need answered, and which cannot
    be derived from the society-wide list.
    """
    query = select(Flat).where(Flat.tenant_id == tenant_id)
    if block:
        query = query.where(Flat.block == block)
    if mine:
        query = query.where(
            Flat.id.in_(select(FlatOwnership.flat_id).where(FlatOwnership.user_id == user.id))
        )
    flats = db.scalars(query.order_by(Flat.block, Flat.flat_number)).all()
    return [_flat_response(db, f) for f in flats]


@router.post(
    "/flats/{flat_id}/occupants",
    response_model=MessageResponse,
    summary="Link a user to a flat",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Flat or user not found in this society"},
        409: {"model": ErrorResponse, "description": "User is already linked to this flat"},
    },
)
def assign_occupant(
    flat_id: str,
    payload: FlatAssignRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> MessageResponse:
    """Record that a user owns or rents a flat."""
    flat = db.get(Flat, flat_id)
    if flat is None or flat.tenant_id != tenant_id:
        raise NotFoundError("Flat not found in this society", error="FLAT_NOT_FOUND")

    occupant = db.get(User, payload.user_id)
    if occupant is None or occupant.tenant_id != tenant_id:
        raise NotFoundError("User not found in this society", error="USER_NOT_FOUND")

    existing = db.get(FlatOwnership, (payload.user_id, flat_id))
    if existing is not None:
        raise ConflictError("User is already linked to this flat", error="ALREADY_LINKED")

    db.add(
        FlatOwnership(user_id=payload.user_id, flat_id=flat_id, relation=payload.relation.value)
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="FLAT_OCCUPANT_ADDED",
        entity_type="Flat",
        entity_id=flat_id,
        detail=f"{occupant.email} as {payload.relation.value}",
    )
    db.commit()
    return MessageResponse(message=f"{occupant.full_name} linked to {flat.label}")


@router.post(

    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new user to the society (Society Official)",
    responses={
        **AUTH_ERRORS,
        409: {"model": ErrorResponse, "description": "Email already exists in this society"},
    },
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL, Role.SUPER_ADMIN)),
    tenant_id: str = Depends(get_tenant_id),
) -> UserResponse:
    """Society official registers a new user into the society database."""
    duplicate = db.scalar(
        select(User).where(User.tenant_id == tenant_id, User.email == payload.email)
    )
    if duplicate is not None:
        raise ConflictError(
            f"User with email {payload.email} already exists in this society",
            error="USER_ALREADY_EXISTS",
        )

    new_user = User(
        tenant_id=tenant_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role.value,
    )
    db.add(new_user)
    db.flush()

    if payload.flat_id:
        flat = db.get(Flat, payload.flat_id)
        if flat and flat.tenant_id == tenant_id:
            db.add(
                FlatOwnership(
                    user_id=new_user.id,
                    flat_id=payload.flat_id,
                    relation=payload.relation.value,
                )
            )

    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="USER_CREATED",
        entity_type="User",
        entity_id=new_user.id,
        detail=f"{new_user.email} as {new_user.role}",
    )
    db.commit()
    db.refresh(new_user)
    return UserResponse.model_validate(new_user)


@router.get(
    "/users",

    response_model=list[UserResponse],
    summary="List users in the caller's society",
    responses=AUTH_ERRORS,
)
def list_users(
    role: Role | None = Query(None, description="Filter by role"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> list[UserResponse]:
    """Society directory. Scoped to the caller's society by the token claim."""
    query = select(User).where(User.tenant_id == tenant_id)
    if role:
        query = query.where(User.role == role.value)
    users = db.scalars(query.order_by(User.full_name)).all()
    return [UserResponse.model_validate(u) for u in users]


@router.get(
    "/audit-logs",
    response_model=list[AuditLogResponse],
    summary="List society audit log history (Society Official)",
    responses=AUTH_ERRORS,
)
def list_audit_logs(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> list[AuditLogResponse]:
    """Return audit log entries for the caller's society."""
    logs = db.scalars(
        select(AuditLog)
        .where(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.created_at.desc())
    ).all()
    return [AuditLogResponse.model_validate(entry) for entry in logs]

