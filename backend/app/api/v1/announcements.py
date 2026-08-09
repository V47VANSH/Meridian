"""Announcement and notification endpoints (Epics 5 & 6).

User stories:
- *"As a society official, I want to post announcements so that residents are
  informed without a WhatsApp group."*
- *"As a non-resident owner, I want to follow society notices remotely so that
  I stay informed about my property."*
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, get_tenant_id, require_roles
from app.core.errors import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import Announcement, Audience, Notification, NotificationType, Role, User
from app.schemas import (
    AnnouncementCreate,
    AnnouncementResponse,
    ErrorResponse,
    NotificationResponse,
)
from app.services import audit, notifications

router = APIRouter(tags=["Announcements & Notifications"])

AUTH_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing or invalid access token"},
    403: {"model": ErrorResponse, "description": "Role is not permitted to perform this action"},
}

# Which roles each audience targets. Read-time filtering keeps one announcement
# row serving every audience rather than duplicating it per recipient.
_AUDIENCE_ROLES: dict[str, set[str]] = {
    Audience.RESIDENTS.value: {Role.RESIDENT_OWNER.value},
    Audience.NON_RESIDENT_OWNERS.value: {Role.NON_RESIDENT_OWNER.value},
    Audience.STAFF.value: {
        Role.SECURITY_GUARD.value,
        Role.MAINTENANCE_STAFF.value,
        Role.CLEANING_STAFF.value,
        Role.SERVICE_PROVIDER.value,
    },
}


def _visible_to(audience: str, role: str) -> bool:
    if audience == Audience.ALL.value:
        return True
    if role == Role.SOCIETY_OFFICIAL.value:
        # Officials always see everything they can post.
        return True
    return role in _AUDIENCE_ROLES.get(audience, set())


@router.post(
    "/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Post an announcement",
    responses={
        **AUTH_ERRORS,
        422: {"model": ErrorResponse, "description": "Title or body failed validation"},
    },
)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(Role.SOCIETY_OFFICIAL)),
    tenant_id: str = Depends(get_tenant_id),
) -> AnnouncementResponse:
    """Publish a notice and notify everyone in the target audience."""
    announcement = Announcement(
        tenant_id=tenant_id,
        posted_by=user.id,
        title=payload.title,
        body=payload.body,
        audience=payload.audience.value,
    )
    db.add(announcement)
    db.flush()

    recipients = [
        u
        for u in db.scalars(select(User).where(User.tenant_id == tenant_id))
        if u.id != user.id and _visible_to(payload.audience.value, u.role)
    ]
    notifications.notify_many(
        db,
        tenant_id=tenant_id,
        user_ids=[u.id for u in recipients],
        notification_type=NotificationType.ANNOUNCEMENT_POSTED.value,
        title=payload.title,
        body=payload.body[:200],
    )
    audit.record(
        db,
        tenant_id=tenant_id,
        actor=user.id,
        action="ANNOUNCEMENT_POSTED",
        entity_type="Announcement",
        entity_id=announcement.id,
        detail=payload.audience.value,
    )
    db.commit()
    db.refresh(announcement)
    return AnnouncementResponse.model_validate(announcement)


@router.get(
    "/announcements",
    response_model=list[AnnouncementResponse],
    summary="Read the announcement feed",
    responses=AUTH_ERRORS,
)
def list_announcements(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[AnnouncementResponse]:
    """Announcements addressed to the caller's role, newest first."""
    rows = db.scalars(
        select(Announcement)
        .where(Announcement.tenant_id == tenant_id)
        .order_by(Announcement.created_at.desc())
    ).all()
    return [
        AnnouncementResponse.model_validate(a) for a in rows if _visible_to(a.audience, user.role)
    ]


@router.get(
    "/notifications",
    response_model=list[NotificationResponse],
    summary="In-app notification feed",
    responses=AUTH_ERRORS,
)
def list_notifications(
    unread_only: bool = Query(False, description="Return only unread notifications"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> list[NotificationResponse]:
    """The caller's own notifications. Never returns another user's rows."""
    query = select(Notification).where(
        Notification.tenant_id == tenant_id, Notification.user_id == user.id
    )
    if unread_only:
        query = query.where(Notification.read_at.is_(None))

    rows = db.scalars(query.order_by(Notification.sent_at.desc())).all()
    return [NotificationResponse.model_validate(n) for n in rows]


@router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
    responses={
        **AUTH_ERRORS,
        404: {"model": ErrorResponse, "description": "Notification not found"},
    },
)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> NotificationResponse:
    """Clear one notification from the unread badge. Idempotent."""
    notification = db.get(Notification, notification_id)
    if notification is None or notification.tenant_id != tenant_id:
        raise NotFoundError("Notification not found", error="NOTIFICATION_NOT_FOUND")
    if notification.user_id != user.id:
        raise ForbiddenError("This notification belongs to another user", error="NOT_YOUR_NOTIFICATION")

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        db.refresh(notification)
    return NotificationResponse.model_validate(notification)
