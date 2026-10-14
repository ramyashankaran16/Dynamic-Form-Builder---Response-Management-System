"""Form & field business logic."""
import secrets
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import can_manage_form
from app.models import FieldOption, Form, FormField, FormResponse, User
from app.schemas.form import FormDetail, FormSummary
from app.services.form_engine import validate_field_definitions


def generate_slug(db: Session) -> str:
    while True:
        slug = secrets.token_urlsafe(9).replace("-", "a").replace("_", "b")
        if not db.scalar(select(Form.id).where(Form.slug == slug)):
            return slug


def get_form_or_404(db: Session, form_id: int) -> Form:
    form = db.scalar(
        select(Form).where(Form.id == form_id).options(selectinload(Form.fields).selectinload(FormField.options))
    )
    if form is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found.")
    return form


def get_manageable_form(db: Session, form_id: int, user: User) -> Form:
    form = get_form_or_404(db, form_id)
    if not can_manage_form(user, form):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to manage this form.")
    return form


def response_counts(db: Session, form_ids: list[int]) -> dict[int, int]:
    if not form_ids:
        return {}
    rows = db.execute(
        select(FormResponse.form_id, func.count(FormResponse.id))
        .where(FormResponse.form_id.in_(form_ids))
        .group_by(FormResponse.form_id)
    ).all()
    return {fid: count for fid, count in rows}


def _summary_dict(form: Form, response_count: int) -> dict[str, Any]:
    return {
        "id": form.id,
        "title": form.title,
        "description": form.description,
        "slug": form.slug,
        "public_path": f"/f/{form.slug}",
        "is_active": form.is_active,
        "is_public": form.is_public,
        "allow_response_edit": form.allow_response_edit,
        "allow_multiple_submissions": form.allow_multiple_submissions,
        "submit_message": form.submit_message,
        "owner_id": form.owner_id,
        "owner_name": form.owner.full_name if form.owner else None,
        "field_count": len(form.fields),
        "response_count": response_count,
        "created_at": form.created_at,
        "updated_at": form.updated_at,
    }


def to_summary(form: Form, response_count: int) -> FormSummary:
    return FormSummary(**_summary_dict(form, response_count))


def to_detail(db: Session, form: Form) -> FormDetail:
    count = response_counts(db, [form.id]).get(form.id, 0)
    return FormDetail(**_summary_dict(form, count), fields=form.fields)


def field_to_dict(f: FormField) -> dict[str, Any]:
    return {
        "id": f.id,
        "field_key": f.field_key,
        "label": f.label,
        "field_type": f.field_type,
        "placeholder": f.placeholder,
        "help_text": f.help_text,
        "is_required": f.is_required,
        "config": dict(f.config or {}),
        "visibility_rules": f.visibility_rules,
        "options": [{"label": o.label, "value": o.value} for o in f.options],
    }


def form_snapshot(form: Form) -> dict[str, Any]:
    return {
        "title": form.title,
        "description": form.description,
        "is_public": form.is_public,
        "is_active": form.is_active,
        "allow_response_edit": form.allow_response_edit,
        "allow_multiple_submissions": form.allow_multiple_submissions,
        "submit_message": form.submit_message,
    }


def save_fields(db: Session, form: Form, items: list[dict[str, Any]]) -> None:
    """Replace the form's complete field list (create / update / delete / reorder).

    `items` order is the display order (stable-sorted by order_index when given).
    Items with an `id` update that field; items without create a new one;
    existing fields missing from the list are deleted (their stored answers
    are kept with field_id = NULL thanks to the label snapshot).
    """
    indexed = list(enumerate(items))
    indexed.sort(key=lambda p: (p[1].get("order_index") if p[1].get("order_index") is not None else 10**9, p[0]))
    normalized = validate_field_definitions([item for _, item in indexed])

    existing = {f.id: f for f in form.fields}
    incoming_ids = [d["id"] for d in normalized if d.get("id")]
    if len(set(incoming_ids)) != len(incoming_ids):
        raise HTTPException(422, "Duplicate field ids in request.")
    unknown = [fid for fid in incoming_ids if fid not in existing]
    if unknown:
        raise HTTPException(422, f"Field id(s) {unknown} do not belong to this form.")

    # Phase 1: delete removed fields (before inserts, to free their keys)
    for fid, f in list(existing.items()):
        if fid not in incoming_ids:
            form.fields.remove(f)
    db.flush()

    # Phase 2: give renamed fields a temporary key to avoid unique clashes on swaps
    renamed = False
    for d in normalized:
        if d.get("id") and existing[d["id"]].field_key != d["field_key"]:
            existing[d["id"]].field_key = f"__tmp_{d['id']}"
            renamed = True
    if renamed:
        db.flush()

    # Phase 3: upsert in order
    for position, d in enumerate(normalized):
        if d.get("id"):
            f = existing[d["id"]]
        else:
            f = FormField()
            form.fields.append(f)  # append via parent so the save cascades
        f.field_key = d["field_key"]
        f.label = d["label"]
        f.field_type = d["field_type"]
        f.placeholder = d.get("placeholder")
        f.help_text = d.get("help_text")
        f.is_required = bool(d.get("is_required"))
        f.order_index = position
        f.config = d.get("config") or {}
        f.visibility_rules = d.get("visibility_rules")
        new_options = [(o["label"], o["value"]) for o in d["options"]]
        if [(o.label, o.value) for o in f.options] != new_options:
            f.options = [FieldOption(label=lbl, value=val, order_index=i) for i, (lbl, val) in enumerate(new_options)]
    db.flush()
    db.expire(form, ["fields"])


def create_form(db: Session, owner: User, data: dict[str, Any], fields: list[dict[str, Any]]) -> Form:
    form = Form(owner=owner, slug=generate_slug(db), **data)
    db.add(form)
    db.flush()
    if fields:
        save_fields(db, form, fields)
    return form
