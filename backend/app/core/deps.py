"""Request dependencies: authentication, role checks and tenant scoping."""

from collections.abc import Callable
from dataclasses import dataclass

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.db.session import get_db
from app.models import Role, User, UserStatus

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")


@dataclass
class CurrentUser:
    """The authenticated principal, derived entirely from verified JWT claims."""

    id: str
    email: str
    role: str
    tenant_id: str | None
    full_name: str

    @property
    def is_super_admin(self) -> bool:
        return self.role == Role.SUPER_ADMIN.value


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """Resolve the caller from the `Authorization: Bearer <token>` header."""
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Missing bearer token")

    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Access token has expired", error="TOKEN_EXPIRED")
    except jwt.PyJWTError:
        raise UnauthorizedError("Invalid access token", error="INVALID_TOKEN")

    if payload.get("type") != "access":
        # A refresh token must never be accepted as an access token.
        raise UnauthorizedError("Invalid token type", error="INVALID_TOKEN")

    user = db.get(User, payload.get("sub"))
    if user is None:
        raise UnauthorizedError("User no longer exists", error="INVALID_TOKEN")
    if user.status != UserStatus.ACTIVE.value:
        raise ForbiddenError("User account is inactive", error="ACCOUNT_INACTIVE")

    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role,
        tenant_id=user.tenant_id,
        full_name=user.full_name,
    )


def require_roles(*roles: Role) -> Callable[..., CurrentUser]:
    """Route guard restricting access to the given roles.

    SUPER_ADMIN is deliberately *not* auto-allowed: platform admins manage
    societies, they do not act inside one on a resident's behalf.
    """
    allowed = {role.value for role in roles}

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise ForbiddenError(
                f"Role {user.role} may not perform this action; "
                f"requires one of: {', '.join(sorted(allowed))}"
            )
        return user

    return dependency


def get_tenant_id(user: CurrentUser = Depends(get_current_user)) -> str:
    """The tenant every query in a request must be filtered by.

    Sourced from the verified token, never from a query parameter or body
    field, so a caller cannot ask for another society's data.
    """
    if not user.tenant_id:
        raise ForbiddenError(
            "This endpoint operates inside a society; the caller has no tenant context",
            error="NO_TENANT_CONTEXT",
        )
    return user.tenant_id


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")
