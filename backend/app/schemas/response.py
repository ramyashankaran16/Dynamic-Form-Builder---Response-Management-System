from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SubmissionRequest(BaseModel):
    answers: dict[str, Any] = Field(
        description="Map of field_key -> value",
        examples=[{"full_name": "Asha", "email": "asha@example.com", "rating": 5, "skills": ["python", "sql"]}],
    )


class ResponseUpdate(SubmissionRequest):
    pass


class SubmissionResult(BaseModel):
    response_id: int
    message: str


class FileUploadOut(BaseModel):
    file_path: str = Field(description="Use this value as the answer for the file field")
    file_name: str
    size_bytes: int
    content_type: str | None


class ResponseDetailOut(BaseModel):
    id: int
    field_id: int | None
    field_key: str
    field_label: str
    field_type: str
    value: Any


class ResponseOut(BaseModel):
    id: int
    form_id: int
    form_title: str
    form_slug: str
    submitted_by: int | None
    submitter_name: str | None
    submitter_email: str | None
    updated_by: int | None
    updated_by_name: str | None
    version: int
    ip_address: str | None
    created_at: datetime
    updated_at: datetime
    answers: dict[str, Any]
    details: list[ResponseDetailOut]
    can_edit: bool
    can_delete: bool


class ResponseHistoryEntry(BaseModel):
    id: int
    action: str
    description: str | None
    user_id: int | None
    user_name: str | None
    old_values: dict[str, Any] | None
    new_values: dict[str, Any] | None
    created_at: datetime


class ResponseFilters(BaseModel):
    search: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    submitted_by: int | None = None
    submitter_type: Literal["all", "authenticated", "anonymous"] = "all"
    field_key: str | None = None
    field_value: str | None = None
    sort_by: Literal["created_at", "updated_at", "id"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"
