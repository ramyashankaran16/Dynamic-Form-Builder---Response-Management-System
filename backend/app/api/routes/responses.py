from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import Pagination, get_current_user, get_db, response_filters
from app.core.config import settings
from app.core.constants import Action, EntityType, FieldType
from app.core.permissions import can_delete_response, can_edit_response, can_view_response
from app.models import ActivityLog, Form, FormField, FormResponse, User
from app.schemas.common import MessageResponse, Page
from app.schemas.response import ResponseFilters, ResponseHistoryEntry, ResponseOut, ResponseUpdate
from app.services import response_service as rs
from app.services.activity_service import log_activity
from app.services.form_engine import original_file_name
from app.services.form_service import get_manageable_form
from app.utils.pagination import page_meta, paginate

router = APIRouter(tags=["Responses"])


def _get_response(db: Session, response_id: int) -> FormResponse:
    response = db.scalar(
        select(FormResponse)
        .where(FormResponse.id == response_id)
        .options(
            selectinload(FormResponse.details),
            selectinload(FormResponse.form).selectinload(Form.fields).selectinload(FormField.options),
        )
    )
    if response is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Response not found.")
    return response


@router.get("/forms/{form_id}/responses", response_model=Page[ResponseOut])
def list_form_responses(
    form_id: int,
    pagination: Pagination = Depends(),
    filters: ResponseFilters = Depends(response_filters),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Responses of a form with **search, filters, sorting & pagination** (form owner / admin)."""
    form = get_manageable_form(db, form_id, user)
    items, total = paginate(db, rs.build_response_query(form.id, filters), pagination.page, pagination.size)
    return {"items": [rs.serialize_response(r, user) for r in items], **page_meta(total, pagination.page, pagination.size)}


@router.get("/responses/mine", response_model=Page[ResponseOut])
def my_responses(pagination: Pagination = Depends(), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Responses submitted by the logged-in user (across all forms)."""
    stmt = (
        select(FormResponse)
        .where(FormResponse.submitted_by == user.id)
        .options(selectinload(FormResponse.details), selectinload(FormResponse.form).selectinload(Form.fields))
        .order_by(FormResponse.created_at.desc(), FormResponse.id.desc())
    )
    items, total = paginate(db, stmt, pagination.page, pagination.size)
    return {"items": [rs.serialize_response(r, user) for r in items], **page_meta(total, pagination.page, pagination.size)}


@router.get("/responses/{response_id}", response_model=ResponseOut)
def get_response(response_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    response = _get_response(db, response_id)
    if not can_view_response(user, response):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to view this response.")
    return rs.serialize_response(response, user)


@router.put("/responses/{response_id}", response_model=ResponseOut)
def update_response(response_id: int, payload: ResponseUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Edit a response (send the **complete** answer set; it is re-validated).

    Allowed for admins and the form owner, or for the original submitter when the
    form has `allow_response_edit = true` and is active. Every change is stored in
    the response history."""
    response = _get_response(db, response_id)
    if not can_edit_response(user, response):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to edit this response.")
    rs.update_response(db, response, payload.answers, user, request)
    db.commit()
    return rs.serialize_response(_get_response(db, response_id), user)


@router.delete("/responses/{response_id}", response_model=MessageResponse)
def delete_response(response_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    response = _get_response(db, response_id)
    if not can_delete_response(user, response):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to delete this response.")
    log_activity(db, action=Action.RESPONSE_DELETED, user=user, entity_type=EntityType.FORM_RESPONSE, entity_id=response.id,
                 description=f"Response #{response.id} of form '{response.form.title}' deleted",
                 old_values={"form_id": response.form_id, "answers": rs.response_answers(response)}, request=request)
    for d in response.details:  # remove uploaded files of this response
        if d.field_type == FieldType.FILE and d.value:
            (settings.upload_dir / d.value).unlink(missing_ok=True)
    db.delete(response)
    db.commit()
    return {"message": "Response deleted."}


@router.get("/responses/{response_id}/history", response_model=list[ResponseHistoryEntry])
def response_history(response_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Full change history: the original submission followed by every edit (old -> new values)."""
    response = _get_response(db, response_id)
    if not can_view_response(user, response):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to view this response.")
    logs = db.scalars(
        select(ActivityLog)
        .where(and_(ActivityLog.entity_type == EntityType.FORM_RESPONSE, ActivityLog.entity_id == response_id))
        .order_by(ActivityLog.created_at.asc(), ActivityLog.id.asc())
    ).unique().all()
    return [
        ResponseHistoryEntry(
            id=log.id, action=log.action, description=log.description, user_id=log.user_id, user_name=log.user_name,
            old_values=log.old_values, new_values=log.new_values, created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/responses/{response_id}/files/{detail_id}", response_class=FileResponse)
def download_response_file(response_id: int, detail_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Download a file uploaded in a response."""
    response = _get_response(db, response_id)
    if not can_view_response(user, response):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to view this response.")
    detail = next((d for d in response.details if d.id == detail_id and d.field_type == FieldType.FILE), None)
    if detail is None or not detail.value:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    path = (settings.upload_dir / detail.value).resolve()
    if settings.upload_dir.resolve() not in path.parents or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    return FileResponse(path, filename=original_file_name(detail.value))
