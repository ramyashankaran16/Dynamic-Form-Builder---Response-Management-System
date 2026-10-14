from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import Pagination, get_current_user, get_db
from app.core.constants import Action, EntityType
from app.models import ActivityLog, User
from app.schemas.activity_log import ActivityLogOut
from app.schemas.common import Page
from app.utils.pagination import page_meta, paginate

router = APIRouter(prefix="/activity-logs", tags=["Activity Logs"])


@router.get("", response_model=Page[ActivityLogOut])
def list_activity_logs(
    pagination: Pagination = Depends(),
    user_id: int | None = Query(None, description="Admin only"),
    action: Action | None = None,
    entity_type: EntityType | None = None,
    entity_id: int | None = None,
    search: str | None = Query(None, description="Search in description"),
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admins see all activity; regular users see their own actions."""
    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
    if not user.is_admin:
        stmt = stmt.where(ActivityLog.user_id == user.id)
    elif user_id:
        stmt = stmt.where(ActivityLog.user_id == user_id)
    if action:
        stmt = stmt.where(ActivityLog.action == action)
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(ActivityLog.entity_id == entity_id)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(ActivityLog.description.ilike(term), ActivityLog.action.ilike(term)))
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(ActivityLog.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    items, total = paginate(db, stmt, pagination.page, pagination.size)
    return {"items": items, **page_meta(total, pagination.page, pagination.size)}


@router.get("/actions", response_model=list[str])
def list_actions(_: User = Depends(get_current_user)):
    """All action codes (for the filter dropdown)."""
    return [a.value for a in Action]
