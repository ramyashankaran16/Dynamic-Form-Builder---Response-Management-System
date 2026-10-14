from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import Pagination, get_current_user, get_db
from app.core.constants import Action, EntityType
from app.models import ActivityLog, Form, FormField, FormResponse, User
from app.schemas.activity_log import ActivityLogOut
from app.schemas.common import MessageResponse, Page
from app.schemas.form import (
    FieldCreate, FieldReorderRequest, FieldsBulkSave, FieldUpdate, FormCreate, FormDetail, FormStatusUpdate,
    FormSummary, FormUpdate,
)
from app.services import form_service as fs
from app.services.activity_service import log_activity
from app.utils.pagination import page_meta, paginate

router = APIRouter(prefix="/forms", tags=["Forms"])


def _fields_log(db: Session, form: Form, user: User, request: Request, description: str, before: list[dict]) -> None:
    db.refresh(form)
    log_activity(
        db, action=Action.FORM_FIELDS_UPDATED, user=user, entity_type=EntityType.FORM, entity_id=form.id,
        description=description,
        old_values={"fields": [{"key": f["field_key"], "label": f["label"], "type": f["field_type"]} for f in before]},
        new_values={"fields": [{"key": f.field_key, "label": f.label, "type": f.field_type} for f in form.fields]},
        request=request,
    )


# ------------------------------------------------------------------ forms CRUD
@router.get("", response_model=Page[FormSummary])
def list_forms(
    pagination: Pagination = Depends(),
    search: str | None = Query(None, description="Search title / description"),
    is_active: bool | None = None,
    is_public: bool | None = None,
    owner_id: int | None = Query(None, description="Admin only: filter by owner"),
    mine: bool = Query(False, description="Admin only: show only my forms"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Users see their own forms; admins see all forms."""
    stmt = select(Form).options(selectinload(Form.fields)).order_by(Form.updated_at.desc(), Form.id.desc())
    if not user.is_admin or mine:
        stmt = stmt.where(Form.owner_id == user.id)
    elif owner_id:
        stmt = stmt.where(Form.owner_id == owner_id)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(Form.title.ilike(term), Form.description.ilike(term)))
    if is_active is not None:
        stmt = stmt.where(Form.is_active.is_(is_active))
    if is_public is not None:
        stmt = stmt.where(Form.is_public.is_(is_public))
    items, total = paginate(db, stmt, pagination.page, pagination.size)
    counts = fs.response_counts(db, [f.id for f in items])
    return {"items": [fs.to_summary(f, counts.get(f.id, 0)) for f in items], **page_meta(total, pagination.page, pagination.size)}


@router.post("", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def create_form(payload: FormCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Create a form, optionally with its fields in the same request."""
    data = payload.model_dump(exclude={"fields"})
    form = fs.create_form(db, user, data, [f.model_dump(mode="json") for f in payload.fields])
    log_activity(db, action=Action.FORM_CREATED, user=user, entity_type=EntityType.FORM, entity_id=form.id,
                 description=f"Form '{form.title}' created", new_values=fs.form_snapshot(form), request=request)
    db.commit()
    return fs.to_detail(db, fs.get_form_or_404(db, form.id))


@router.get("/{form_id}", response_model=FormDetail)
def get_form(form_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return fs.to_detail(db, fs.get_manageable_form(db, form_id, user))


@router.put("/{form_id}", response_model=FormDetail)
def update_form(form_id: int, payload: FormUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Update form settings (title, description, visibility, edit permissions...)."""
    form = fs.get_manageable_form(db, form_id, user)
    old = fs.form_snapshot(form)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "title" and value is None:
            continue
        setattr(form, key, value)
    new = fs.form_snapshot(form)
    changed = {k: new[k] for k in new if new[k] != old[k]}
    if changed:
        log_activity(db, action=Action.FORM_UPDATED, user=user, entity_type=EntityType.FORM, entity_id=form.id,
                     description=f"Form '{form.title}' updated", old_values={k: old[k] for k in changed},
                     new_values=changed, request=request)
    db.commit()
    return fs.to_detail(db, form)


@router.delete("/{form_id}", response_model=MessageResponse)
def delete_form(form_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Delete a form together with all its fields and responses."""
    form = fs.get_manageable_form(db, form_id, user)
    log_activity(db, action=Action.FORM_DELETED, user=user, entity_type=EntityType.FORM, entity_id=form.id,
                 description=f"Form '{form.title}' deleted", old_values=fs.form_snapshot(form), request=request)
    db.delete(form)
    db.commit()
    return {"message": "Form deleted."}


@router.patch("/{form_id}/status", response_model=FormSummary)
def set_form_status(form_id: int, payload: FormStatusUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Enable / disable a form. Disabled forms reject new submissions and submitter edits."""
    form = fs.get_manageable_form(db, form_id, user)
    if form.is_active != payload.is_active:
        form.is_active = payload.is_active
        log_activity(db, action=Action.FORM_ENABLED if payload.is_active else Action.FORM_DISABLED, user=user,
                     entity_type=EntityType.FORM, entity_id=form.id,
                     description=f"Form '{form.title}' {'enabled' if payload.is_active else 'disabled'}",
                     old_values={"is_active": not payload.is_active}, new_values={"is_active": payload.is_active},
                     request=request)
        db.commit()
    return fs.to_summary(form, fs.response_counts(db, [form.id]).get(form.id, 0))


@router.post("/{form_id}/duplicate", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def duplicate_form(form_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Copy a form's settings and fields (not responses). The copy starts disabled."""
    src = fs.get_manageable_form(db, form_id, user)
    data = fs.form_snapshot(src) | {"title": f"{src.title} (Copy)"[:255], "is_active": False}
    fields = [{k: v for k, v in fs.field_to_dict(f).items() if k != "id"} for f in src.fields]
    form = fs.create_form(db, user, data, fields)
    log_activity(db, action=Action.FORM_DUPLICATED, user=user, entity_type=EntityType.FORM, entity_id=form.id,
                 description=f"Form '{src.title}' duplicated as #{form.id}", new_values={"source_form_id": src.id},
                 request=request)
    db.commit()
    return fs.to_detail(db, fs.get_form_or_404(db, form.id))


@router.get("/{form_id}/activity", response_model=Page[ActivityLogOut])
def form_activity(form_id: int, pagination: Pagination = Depends(), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Activity on this form and its responses."""
    form = fs.get_manageable_form(db, form_id, user)
    response_ids = select(FormResponse.id).where(FormResponse.form_id == form.id)
    stmt = (
        select(ActivityLog)
        .where(or_(
            and_(ActivityLog.entity_type == EntityType.FORM, ActivityLog.entity_id == form.id),
            and_(ActivityLog.entity_type == EntityType.FORM_RESPONSE, ActivityLog.entity_id.in_(response_ids)),
        ))
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
    )
    items, total = paginate(db, stmt, pagination.page, pagination.size)
    return {"items": items, **page_meta(total, pagination.page, pagination.size)}


# ------------------------------------------------------------------ fields
@router.put("/{form_id}/fields", response_model=FormDetail)
def save_all_fields(form_id: int, payload: FieldsBulkSave, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """**Drag-and-drop builder save.** Send the complete field list in display order.
    Items with `id` are updated, items without `id` are created, missing fields are deleted."""
    form = fs.get_manageable_form(db, form_id, user)
    before = [fs.field_to_dict(f) for f in form.fields]
    fs.save_fields(db, form, [f.model_dump(mode="json") for f in payload.fields])
    _fields_log(db, form, user, request, f"Fields of '{form.title}' saved ({len(payload.fields)} fields)", before)
    db.commit()
    return fs.to_detail(db, fs.get_form_or_404(db, form.id))


@router.post("/{form_id}/fields", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def add_field(form_id: int, payload: FieldCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Add one field. `order_index` sets its position (appended when omitted)."""
    form = fs.get_manageable_form(db, form_id, user)
    before = [fs.field_to_dict(f) for f in form.fields]
    items = [dict(f) for f in before]
    new = payload.model_dump(mode="json")
    position = new.pop("order_index", None)
    items.insert(len(items) if position is None else min(position, len(items)), new)
    fs.save_fields(db, form, items)
    _fields_log(db, form, user, request, f"Field '{payload.label}' added to '{form.title}'", before)
    db.commit()
    return fs.to_detail(db, fs.get_form_or_404(db, form.id))


@router.patch("/{form_id}/fields/{field_id}", response_model=FormDetail)
def update_field(form_id: int, field_id: int, payload: FieldUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form = fs.get_manageable_form(db, form_id, user)
    before = [fs.field_to_dict(f) for f in form.fields]
    items = [dict(f) for f in before]
    idx = next((i for i, f in enumerate(items) if f["id"] == field_id), None)
    if idx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Field not found in this form.")
    changes = payload.model_dump(mode="json", exclude_unset=True)
    position = changes.pop("order_index", None)
    items[idx].update(changes)
    if position is not None:
        items.insert(min(position, len(items) - 1), items.pop(idx))
    fs.save_fields(db, form, items)
    label = changes.get("label") or before[idx]["label"]
    _fields_log(db, form, user, request, f"Field '{label}' updated in '{form.title}'", before)
    db.commit()
    return fs.to_detail(db, fs.get_form_or_404(db, form.id))


@router.delete("/{form_id}/fields/{field_id}", response_model=FormDetail)
def delete_field(form_id: int, field_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Delete a field. Existing answers are kept in responses (label snapshot)."""
    form = fs.get_manageable_form(db, form_id, user)
    before = [fs.field_to_dict(f) for f in form.fields]
    target = next((f for f in before if f["id"] == field_id), None)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Field not found in this form.")
    fs.save_fields(db, form, [f for f in before if f["id"] != field_id])
    _fields_log(db, form, user, request, f"Field '{target['label']}' removed from '{form.title}'", before)
    db.commit()
    return fs.to_detail(db, fs.get_form_or_404(db, form.id))


@router.put("/{form_id}/fields/reorder", response_model=FormDetail)
def reorder_fields(form_id: int, payload: FieldReorderRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Reorder fields. `field_ids` must contain every field id of the form exactly once."""
    form = fs.get_manageable_form(db, form_id, user)
    before = [fs.field_to_dict(f) for f in form.fields]
    by_id = {f["id"]: f for f in before}
    if sorted(payload.field_ids) != sorted(by_id):
        raise HTTPException(422, "field_ids must contain every field of the form exactly once.")
    fs.save_fields(db, form, [by_id[i] for i in payload.field_ids])
    _fields_log(db, form, user, request, f"Fields of '{form.title}' reordered", before)
    db.commit()
    return fs.to_detail(db, fs.get_form_or_404(db, form.id))
