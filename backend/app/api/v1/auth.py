"""Authentication endpoints.

User story: *"As any user, I want to register and log in securely so that my
society data is only accessible to me."*
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import CurrentUser, get_current_user
from app.core.errors import BadRequestError, ConflictError, NotFoundError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.session import get_db
from app.models import Flat, FlatOwnership, RefreshToken, Relation, Tenant, User, UserStatus
from app.schemas import (
    ErrorResponse,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

COMMON_ERRORS = {
    401: {"model": ErrorResponse, "description": "Invalid or missing credentials"},
    422: {"model": ErrorResponse, "description": "Request body failed validation"},
}


def _issue_tokens(db: Session, user: User) -> TokenResponse:
    """Mint an access/refresh pair and persist the refresh token's hash."""
    access_token = create_access_token(
        user_id=user.id, tenant_id=user.tenant_id, role=user.role
    )
    raw_refresh, expires_at = create_refresh_token(user_id=user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            expires_at=expires_at,
        )
    )
    db.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user in a society",
    responses={
        404: {"model": ErrorResponse, "description": "Society or flat not found"},
        409: {"model": ErrorResponse, "description": "Email already registered in this society"},
        422: {"model": ErrorResponse, "description": "Weak password or privileged role requested"},
    },
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> UserResponse:
    """Create an account inside a society.

    Emails are unique **per society**, not globally, so the same person can
    hold accounts in two societies. `SUPER_ADMIN` and `SOCIETY_OFFICIAL` cannot
    be self-assigned — an administrator provisions those.
    """
    tenant = db.get(Tenant, payload.tenant_id)
    if tenant is None:
        raise NotFoundError(f"Society '{payload.tenant_id}' does not exist", error="TENANT_NOT_FOUND")

    existing = db.scalar(
        select(User).where(User.tenant_id == tenant.id, User.email == payload.email.lower())
    )
    if existing is not None:
        raise ConflictError(
            "An account with this email already exists in this society",
            error="EMAIL_ALREADY_REGISTERED",
        )

    user = User(
        tenant_id=tenant.id,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role.value,
    )
    db.add(user)
    db.flush()

    if payload.flat_id:
        flat = db.get(Flat, payload.flat_id)
        if flat is None or flat.tenant_id != tenant.id:
            raise NotFoundError("Flat not found in this society", error="FLAT_NOT_FOUND")
        db.add(
            FlatOwnership(
                user_id=user.id,
                flat_id=flat.id,
                relation=Relation.OWNER.value,
            )
        )

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Exchange credentials for an access and refresh token",
    responses=COMMON_ERRORS,
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Authenticate and receive a token pair.

    A wrong email and a wrong password return the identical error, so the
    response cannot be used to discover which emails are registered.
    """
    query = select(User).where(User.email == payload.email.lower())
    if payload.tenant_id:
        query = query.where(User.tenant_id == payload.tenant_id)

    matches = list(db.scalars(query))
    if len(matches) > 1:
        raise BadRequestError(
            "This email exists in more than one society; supply tenant_id",
            error="TENANT_REQUIRED",
        )

    user = matches[0] if matches else None
    if user is None or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError("Incorrect email or password", error="INVALID_CREDENTIALS")
    if user.status != UserStatus.ACTIVE.value:
        raise UnauthorizedError("This account has been deactivated", error="ACCOUNT_INACTIVE")

    return _issue_tokens(db, user)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate a refresh token for a fresh token pair",
    responses=COMMON_ERRORS,
)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Issue a new token pair and revoke the token that was presented.

    Rotation means a stolen refresh token is usable at most once, and its reuse
    is detectable because the stored record is already revoked.
    """
    try:
        claims = decode_token(payload.refresh_token)
    except Exception:
        # `from None` on purpose: the decode failure describes the token's
        # internals, which must not ride along with an auth error.
        raise UnauthorizedError("Invalid refresh token", error="INVALID_TOKEN") from None

    if claims.get("type") != "refresh":
        raise UnauthorizedError("Not a refresh token", error="INVALID_TOKEN")

    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(payload.refresh_token))
    )
    if stored is None or stored.revoked_at is not None:
        raise UnauthorizedError("Refresh token has been revoked", error="TOKEN_REVOKED")
    if stored.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise UnauthorizedError("Refresh token has expired", error="TOKEN_EXPIRED")

    user = db.get(User, claims["sub"])
    if user is None:
        raise UnauthorizedError("User no longer exists", error="INVALID_TOKEN")

    stored.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    return _issue_tokens(db, user)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke a refresh token",
    responses=COMMON_ERRORS,
)
def logout(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> MessageResponse:
    """Revoke the supplied refresh token so it can no longer be rotated."""
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(payload.refresh_token),
            RefreshToken.user_id == user.id,
        )
    )
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
    # Always reports success: logging out is idempotent from the client's view.
    return MessageResponse(message="Logged out")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the authenticated user's profile",
    responses=COMMON_ERRORS,
)
def me(
    db: Session = Depends(get_db), current: CurrentUser = Depends(get_current_user)
) -> UserResponse:
    """Return the profile behind the presented access token."""
    user = db.get(User, current.id)
    if user is None:
        raise NotFoundError("User not found")
    return UserResponse.model_validate(user)
