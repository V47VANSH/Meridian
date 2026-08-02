"""Audit trail writer.

Every state-changing action records who did what to which entity. Rows are
only ever inserted — nothing in the codebase updates or deletes them.
"""

from sqlalchemy.orm import Session

from app.models import AuditLog


def record(
    db: Session,
    *,
    tenant_id: str,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    detail: str = "",
) -> AuditLog:
    """Append an audit entry. The caller owns the surrounding transaction."""
    entry = AuditLog(
        tenant_id=tenant_id,
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail,
    )
    db.add(entry)
    return entry
