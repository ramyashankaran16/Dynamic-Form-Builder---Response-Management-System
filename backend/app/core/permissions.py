"""Central place for authorization rules (RBAC + ownership)."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Form, FormResponse, User


def can_manage_form(user: "User | None", form: "Form") -> bool:
    """Admins manage every form; users manage only the forms they own."""
    return bool(user and (user.is_admin or form.owner_id == user.id))


def can_view_response(user: "User | None", response: "FormResponse") -> bool:
    if user is None:
        return False
    return can_manage_form(user, response.form) or response.submitted_by == user.id


def can_edit_response(user: "User | None", response: "FormResponse") -> bool:
    """Form owners/admins can always edit. Submitters can edit their own
    response only if the form allows it and the form is still active."""
    if user is None:
        return False
    if can_manage_form(user, response.form):
        return True
    form = response.form
    return response.submitted_by == user.id and form.allow_response_edit and form.is_active


def can_delete_response(user: "User | None", response: "FormResponse") -> bool:
    return can_manage_form(user, response.form)
