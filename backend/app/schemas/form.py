from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.constants import ConditionOperator, FieldType
from app.schemas.common import ORMModel

FIELD_KEY_PATTERN = r"^[a-zA-Z][a-zA-Z0-9_]*$"


# ---------- Options ----------
class FieldOptionIn(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    value: str | None = Field(default=None, max_length=255, description="Defaults to the label")


class FieldOptionOut(ORMModel):
    id: int
    label: str
    value: str
    order_index: int


# ---------- Conditional visibility ----------
class Condition(BaseModel):
    field_key: str = Field(description="Key of the field this condition depends on")
    operator: ConditionOperator
    value: Any = None


class VisibilityRules(BaseModel):
    logic: Literal["all", "any"] = "all"
    conditions: list[Condition] = Field(min_length=1)


# ---------- Fields ----------
class FieldBase(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    field_key: str | None = Field(
        default=None, max_length=100, pattern=FIELD_KEY_PATTERN,
        description="Unique key inside the form. Auto-generated from the label when omitted.",
    )
    field_type: FieldType
    placeholder: str | None = Field(default=None, max_length=255)
    help_text: str | None = Field(default=None, max_length=500)
    is_required: bool = False
    order_index: int | None = Field(default=None, ge=0)
    config: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "text: min_length, max_length, pattern, pattern_message | number: min, max, integer_only | "
            "date: min_date, max_date | checkbox: min_selected, max_selected | rating: max_rating (1-10) | "
            "file: allowed_extensions, max_size_mb"
        ),
    )
    visibility_rules: VisibilityRules | None = None
    options: list[FieldOptionIn] = Field(default_factory=list)


class FieldCreate(FieldBase):
    pass


class FieldUpsert(FieldBase):
    id: int | None = Field(default=None, description="Existing field id; omit to create a new field")


class FieldUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=255)
    field_key: str | None = Field(default=None, max_length=100, pattern=FIELD_KEY_PATTERN)
    field_type: FieldType | None = None
    placeholder: str | None = None
    help_text: str | None = None
    is_required: bool | None = None
    order_index: int | None = Field(default=None, ge=0)
    config: dict[str, Any] | None = None
    visibility_rules: VisibilityRules | None = None
    options: list[FieldOptionIn] | None = None


class FieldOut(ORMModel):
    id: int
    field_key: str
    label: str
    field_type: str
    placeholder: str | None
    help_text: str | None
    is_required: bool
    order_index: int
    config: dict[str, Any] | None
    visibility_rules: dict[str, Any] | None
    options: list[FieldOptionOut]


class FieldsBulkSave(BaseModel):
    fields: list[FieldUpsert] = Field(description="Complete field list. Array order = display order.")


class FieldReorderRequest(BaseModel):
    field_ids: list[int] = Field(min_length=1, description="All field ids of the form in the new order")


# ---------- Forms ----------
class FormBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    is_public: bool = Field(default=False, description="Public forms accept anonymous submissions")
    is_active: bool = True
    allow_response_edit: bool = Field(default=False, description="Submitters may edit their own responses")
    allow_multiple_submissions: bool = True
    submit_message: str | None = Field(default=None, max_length=500)


class FormCreate(FormBase):
    fields: list[FieldCreate] = Field(default_factory=list)


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_public: bool | None = None
    is_active: bool | None = None
    allow_response_edit: bool | None = None
    allow_multiple_submissions: bool | None = None
    submit_message: str | None = Field(default=None, max_length=500)


class FormStatusUpdate(BaseModel):
    is_active: bool


class FormSummary(BaseModel):
    id: int
    title: str
    description: str | None
    slug: str
    public_path: str
    is_active: bool
    is_public: bool
    allow_response_edit: bool
    allow_multiple_submissions: bool
    submit_message: str | None
    owner_id: int
    owner_name: str | None
    field_count: int
    response_count: int
    created_at: datetime
    updated_at: datetime


class FormDetail(FormSummary):
    fields: list[FieldOut]


class PublicFormOut(BaseModel):
    """What the form renderer needs (no owner / admin data)."""

    id: int
    slug: str
    title: str
    description: str | None
    is_public: bool
    allow_response_edit: bool
    fields: list[FieldOut]
