"""Submission, response editing, search/filter and serialization."""
from datetime import datetime, time, timedelta
from typing import Any

from fastapi import Request
from sqlalchemy import Select, exists, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.constants import Action, EntityType
from app.core.permissions import can_delete_response, can_edit_response
from app.models import Form, FormResponse, ResponseDetail, User
from app.schemas.response import ResponseFilters, ResponseOut
from app.services.activity_service import log_activity
from app.services.form_engine import FieldSpec, decode_value, encode_value, validate_submission
from app.utils.http import client_ip, user_agent
from app.utils.time import utcnow


def response_answers(response: FormResponse) -> dict[str, Any]:
    return {d.field_key: decode_value(d.field_type, d.value) for d in response.details}


def _clean(form: Form, answers: dict[str, Any]) -> dict[str, Any]:
    specs = [FieldSpec.from_model(f) for f in form.fields]
    cleaned = validate_submission(specs, answers, form_id=form.id)
    return {k: v for k, v in cleaned.items() if v is not None}


def create_response(db: Session, form: Form, answers: dict[str, Any], user: User | None, request: Request | None) -> FormResponse:
    cleaned = _clean(form, answers)
    fields_by_key = {f.field_key: f for f in form.fields}
    response = FormResponse(
        form=form,
        submitted_by=user.id if user else None,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        version=1,
    )
    for key, value in cleaned.items():
        f = fields_by_key[key]
        response.details.append(
            ResponseDetail(field_id=f.id, field_key=key, field_label=f.label, field_type=f.field_type, value=encode_value(value))
        )
    db.add(response)
    db.flush()
    log_activity(
        db,
        action=Action.RESPONSE_SUBMITTED,
        user=user,
        entity_type=EntityType.FORM_RESPONSE,
        entity_id=response.id,
        description=f"Response #{response.id} submitted to form '{form.title}'"
        + ("" if user else " (anonymous)"),
        new_values={"form_id": form.id, "answers": cleaned},
        request=request,
    )
    return response


def update_response(
    db: Session, response: FormResponse, answers: dict[str, Any], user: User, request: Request | None
) -> dict[str, dict[str, Any]]:
    """Re-validate the full answer set and store the diff in the history log.
    Returns the changes ({field_key: {"old", "new"}}); empty when nothing changed."""
    form = response.form
    cleaned = _clean(form, answers)
    old = response_answers(response)
    fields_by_key = {f.field_key: f for f in form.fields}
    details_by_key = {d.field_key: d for d in response.details}

    changes: dict[str, dict[str, Any]] = {}
    for key, f in fields_by_key.items():
        new_value, old_value = cleaned.get(key), old.get(key)
        if new_value == old_value:
            continue
        changes[key] = {"old": old_value, "new": new_value}
        detail = details_by_key.get(key)
        if new_value is None:
            if detail is not None:
                response.details.remove(detail)
        elif detail is not None:
            detail.value = encode_value(new_value)
            detail.field_id, detail.field_label, detail.field_type = f.id, f.label, f.field_type
        else:
            response.details.append(
                ResponseDetail(field_id=f.id, field_key=key, field_label=f.label, field_type=f.field_type, value=encode_value(new_value))
            )

    if not changes:
        return changes

    response.version += 1
    response.updated_by = user.id
    response.updated_at = utcnow()
    db.flush()
    log_activity(
        db,
        action=Action.RESPONSE_UPDATED,
        user=user,
        entity_type=EntityType.FORM_RESPONSE,
        entity_id=response.id,
        description=f"Response #{response.id} updated to version {response.version} ({len(changes)} field(s) changed)",
        old_values={k: c["old"] for k, c in changes.items()},
        new_values={k: c["new"] for k, c in changes.items()},
        request=request,
    )
    return changes


def build_response_query(form_id: int, filters: ResponseFilters) -> Select:
    stmt = select(FormResponse).where(FormResponse.form_id == form_id).options(selectinload(FormResponse.details))

    if filters.date_from:
        stmt = stmt.where(FormResponse.created_at >= datetime.combine(filters.date_from, time.min))
    if filters.date_to:
        stmt = stmt.where(FormResponse.created_at < datetime.combine(filters.date_to + timedelta(days=1), time.min))
    if filters.submitted_by:
        stmt = stmt.where(FormResponse.submitted_by == filters.submitted_by)
    if filters.submitter_type == "anonymous":
        stmt = stmt.where(FormResponse.submitted_by.is_(None))
    elif filters.submitter_type == "authenticated":
        stmt = stmt.where(FormResponse.submitted_by.is_not(None))

    if filters.search and filters.search.strip():
        term = f"%{filters.search.strip()}%"
        conditions = [
            exists().where(ResponseDetail.response_id == FormResponse.id, ResponseDetail.value.ilike(term)),
            FormResponse.submitter.has(or_(User.full_name.ilike(term), User.email.ilike(term))),
        ]
        if filters.search.strip().isdigit():
            conditions.append(FormResponse.id == int(filters.search.strip()))
        stmt = stmt.where(or_(*conditions))

    if filters.field_key and filters.field_value not in (None, ""):
        stmt = stmt.where(
            exists().where(
                ResponseDetail.response_id == FormResponse.id,
                ResponseDetail.field_key == filters.field_key,
                ResponseDetail.value.ilike(f"%{filters.field_value}%"),
            )
        )

    sort_col = getattr(FormResponse, filters.sort_by)
    stmt = stmt.order_by(sort_col.asc() if filters.sort_order == "asc" else sort_col.desc(), FormResponse.id.desc())
    return stmt


def serialize_response(response: FormResponse, user: User | None) -> ResponseOut:
    form = response.form
    order = {f.field_key: f.order_index for f in form.fields}
    details = sorted(response.details, key=lambda d: (order.get(d.field_key, 10**6), d.id))
    return ResponseOut(
        id=response.id,
        form_id=response.form_id,
        form_title=form.title,
        form_slug=form.slug,
        submitted_by=response.submitted_by,
        submitter_name=response.submitter.full_name if response.submitter else None,
        submitter_email=response.submitter.email if response.submitter else None,
        updated_by=response.updated_by,
        updated_by_name=response.editor.full_name if response.editor else None,
        version=response.version,
        ip_address=response.ip_address,
        created_at=response.created_at,
        updated_at=response.updated_at,
        answers={d.field_key: decode_value(d.field_type, d.value) for d in details},
        details=[
            {
                "id": d.id,
                "field_id": d.field_id,
                "field_key": d.field_key,
                "field_label": d.field_label,
                "field_type": d.field_type,
                "value": decode_value(d.field_type, d.value),
            }
            for d in details
        ],
        can_edit=can_edit_response(user, response),
        can_delete=can_delete_response(user, response),
    )
