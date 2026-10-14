"""Activity / audit logging."""
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models import ActivityLog, User
from app.utils.http import client_ip


def log_activity(
    db: Session,
    *,
    action: str,
    user: User | None = None,
    user_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    description: str | None = None,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    request: Request | None = None,
) -> ActivityLog:
    """Add a log entry to the session. The caller is responsible for committing,
    so the log is saved atomically with the change it describes."""
    entry = ActivityLog(
        user_id=user.id if user else user_id,
        action=str(action),
        entity_type=str(entity_type) if entity_type else None,
        entity_id=entity_id,
        description=(description or "")[:500] or None,
        old_values=jsonable_encoder(old_values) if old_values is not None else None,
        new_values=jsonable_encoder(new_values) if new_values is not None else None,
        ip_address=client_ip(request),
    )
    db.add(entry)
    return entry
