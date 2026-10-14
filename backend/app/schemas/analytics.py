from datetime import datetime

from pydantic import BaseModel


class TrendPoint(BaseModel):
    date: str
    count: int


class TopForm(BaseModel):
    form_id: int
    title: str
    is_active: bool
    response_count: int


class RecentResponse(BaseModel):
    response_id: int
    form_id: int
    form_title: str
    submitter_name: str | None
    created_at: datetime


class DashboardStats(BaseModel):
    total_forms: int
    active_forms: int
    inactive_forms: int
    public_forms: int
    total_responses: int
    responses_today: int
    responses_last_7_days: int
    responses_last_30_days: int
    total_users: int | None = None
    active_users: int | None = None
    submissions_trend: list[TrendPoint]
    top_forms: list[TopForm]
    recent_responses: list[RecentResponse]


class OptionCount(BaseModel):
    label: str
    value: str
    count: int
    percentage: float


class FieldAnalytics(BaseModel):
    field_id: int
    field_key: str
    label: str
    field_type: str
    answered_count: int
    response_rate: float
    option_counts: list[OptionCount] | None = None
    average: float | None = None
    minimum: float | None = None
    maximum: float | None = None
    earliest: str | None = None
    latest: str | None = None


class FormAnalytics(BaseModel):
    form_id: int
    title: str
    is_active: bool
    total_responses: int
    authenticated_responses: int
    anonymous_responses: int
    edited_responses: int
    responses_today: int
    responses_last_7_days: int
    first_response_at: datetime | None
    last_response_at: datetime | None
    average_per_day: float
    submissions_trend: list[TrendPoint]
    fields: list[FieldAnalytics]
