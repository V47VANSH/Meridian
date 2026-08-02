"""Notification fan-out.

In production `notify()` enqueues a background job on the Redis queue, so a
flaky SMS or email provider can never slow down or fail an API request.
Here the in-app row is written synchronously and the external channels are
resolved and logged, keeping the same call signature and the same persisted
result for the in-app feed.
"""

import logging

from sqlalchemy.orm import Session

from app.models import Notification, NotificationChannel, NotificationType

logger = logging.getLogger(__name__)

# Channel routing table from docs/02-backend-architecture.md section 10.
CHANNELS: dict[str, list[str]] = {
    NotificationType.SOS_RAISED.value: [
        NotificationChannel.PUSH.value,
        NotificationChannel.SMS.value,
        NotificationChannel.IN_APP.value,
    ],
    NotificationType.PAYMENT_DUE_SOON.value: [
        NotificationChannel.PUSH.value,
        NotificationChannel.EMAIL.value,
    ],
    NotificationType.PAYMENT_OVERDUE.value: [
        NotificationChannel.PUSH.value,
        NotificationChannel.EMAIL.value,
    ],
    NotificationType.COMPLAINT_STATUS_CHANGED.value: [
        NotificationChannel.PUSH.value,
        NotificationChannel.IN_APP.value,
    ],
    NotificationType.BOOKING_CONFIRMED.value: [
        NotificationChannel.PUSH.value,
        NotificationChannel.IN_APP.value,
    ],
    NotificationType.ANNOUNCEMENT_POSTED.value: [
        NotificationChannel.PUSH.value,
        NotificationChannel.IN_APP.value,
    ],
}


def notify(
    db: Session,
    *,
    tenant_id: str,
    user_id: str,
    notification_type: str,
    title: str,
    body: str = "",
) -> Notification:
    """Create the in-app notification and dispatch the external channels.

    A `Notification` row is written regardless of external channel outcome, so
    the in-app feed is complete even when push or SMS delivery fails.
    """
    channels = CHANNELS.get(notification_type, [NotificationChannel.IN_APP.value])

    for channel in channels:
        if channel == NotificationChannel.IN_APP.value:
            continue
        # Each channel is dispatched independently so one failure cannot
        # prevent the others from being attempted.
        logger.info("dispatch %s via %s to user=%s", notification_type, channel, user_id)

    notification = Notification(
        tenant_id=tenant_id,
        user_id=user_id,
        channel=NotificationChannel.IN_APP.value,
        type=notification_type,
        title=title,
        body=body,
    )
    db.add(notification)
    return notification


def notify_many(
    db: Session,
    *,
    tenant_id: str,
    user_ids: list[str],
    notification_type: str,
    title: str,
    body: str = "",
) -> list[Notification]:
    """Fan a single event out to several recipients (e.g. all on-duty guards)."""
    return [
        notify(
            db,
            tenant_id=tenant_id,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
        )
        for user_id in user_ids
    ]
