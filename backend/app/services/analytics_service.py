"""Dashboard and form-wise analytics."""
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.constants import OPTION_FIELD_TYPES, FieldType
from app.models import Form, FormResponse, ResponseDetail, User
from app.schemas.analytics import DashboardStats, FieldAnalytics, FormAnalytics, OptionCount, TrendPoint
from app.services.form_engine import decode_value
from app.utils.time import utcnow


def _start_of(d: date) -> datetime:
    return datetime.combine(d, time.min)


def _scoped_forms(user: User) -> Select:
    stmt = select(Form.id)
    return stmt if user.is_admin else stmt.where(Form.owner_id == user.id)


def _count(db: Session, stmt: Select) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def _trend(db: Session, base_filter: list[Any], days: int) -> list[TrendPoint]:
    today = utcnow().date()
    start = today - timedelta(days=days - 1)
    day_col = func.date(FormResponse.created_at)
    rows = db.execute(
        select(day_col, func.count(FormResponse.id))
        .where(*base_filter, FormResponse.created_at >= _start_of(start))
        .group_by(day_col)
    ).all()
    counts = {str(d)[:10]: c for d, c in rows}
    return [
        TrendPoint(date=(start + timedelta(days=i)).isoformat(), count=counts.get((start + timedelta(days=i)).isoformat(), 0))
        for i in range(days)
    ]


def dashboard(db: Session, user: User, days: int = 30) -> DashboardStats:
    form_ids = _scoped_forms(user)
    forms_q = select(Form).where(Form.id.in_(form_ids))
    resp_filter = [FormResponse.form_id.in_(form_ids)]
    today = utcnow().date()

    def responses_since(d: date) -> int:
        return _count(db, select(FormResponse.id).where(*resp_filter, FormResponse.created_at >= _start_of(d)))

    top_rows = db.execute(
        select(Form.id, Form.title, Form.is_active, func.count(FormResponse.id).label("cnt"))
        .outerjoin(FormResponse, FormResponse.form_id == Form.id)
        .where(Form.id.in_(form_ids))
        .group_by(Form.id, Form.title, Form.is_active)
        .order_by(func.count(FormResponse.id).desc(), Form.id.desc())
        .limit(5)
    ).all()

    recent = db.scalars(
        select(FormResponse).where(*resp_filter).order_by(FormResponse.created_at.desc(), FormResponse.id.desc()).limit(5)
    ).unique().all()

    total_forms = _count(db, forms_q)
    active_forms = _count(db, forms_q.where(Form.is_active.is_(True)))
    stats = DashboardStats(
        total_forms=total_forms,
        active_forms=active_forms,
        inactive_forms=total_forms - active_forms,
        public_forms=_count(db, forms_q.where(Form.is_public.is_(True))),
        total_responses=_count(db, select(FormResponse.id).where(*resp_filter)),
        responses_today=responses_since(today),
        responses_last_7_days=responses_since(today - timedelta(days=6)),
        responses_last_30_days=responses_since(today - timedelta(days=29)),
        submissions_trend=_trend(db, resp_filter, days),
        top_forms=[{"form_id": r[0], "title": r[1], "is_active": r[2], "response_count": r[3]} for r in top_rows],
        recent_responses=[
            {
                "response_id": r.id,
                "form_id": r.form_id,
                "form_title": r.form.title,
                "submitter_name": r.submitter.full_name if r.submitter else None,
                "created_at": r.created_at,
            }
            for r in recent
        ],
    )
    if user.is_admin:
        stats.total_users = _count(db, select(User.id))
        stats.active_users = _count(db, select(User.id).where(User.is_active.is_(True)))
    return stats


def form_analytics(db: Session, form: Form, days: int = 30) -> FormAnalytics:
    base = [FormResponse.form_id == form.id]
    today = utcnow().date()

    total, first_at, last_at = db.execute(
        select(func.count(FormResponse.id), func.min(FormResponse.created_at), func.max(FormResponse.created_at)).where(*base)
    ).one()
    authenticated = _count(db, select(FormResponse.id).where(*base, FormResponse.submitted_by.is_not(None)))
    edited = _count(db, select(FormResponse.id).where(*base, FormResponse.version > 1))
    trend = _trend(db, base, days)

    # Load all answers for the form once and aggregate in Python.
    rows = db.execute(
        select(ResponseDetail.field_key, ResponseDetail.field_type, ResponseDetail.value)
        .join(FormResponse, FormResponse.id == ResponseDetail.response_id)
        .where(*base)
    ).all()
    values_by_key: dict[str, list[Any]] = defaultdict(list)
    for key, ftype, raw in rows:
        values_by_key[key].append(decode_value(ftype, raw))

    field_stats = [_field_stats(f, values_by_key.get(f.field_key, []), total) for f in form.fields]

    return FormAnalytics(
        form_id=form.id,
        title=form.title,
        is_active=form.is_active,
        total_responses=total,
        authenticated_responses=authenticated,
        anonymous_responses=total - authenticated,
        edited_responses=edited,
        responses_today=_count(db, select(FormResponse.id).where(*base, FormResponse.created_at >= _start_of(today))),
        responses_last_7_days=_count(
            db, select(FormResponse.id).where(*base, FormResponse.created_at >= _start_of(today - timedelta(days=6)))
        ),
        first_response_at=first_at,
        last_response_at=last_at,
        average_per_day=round(sum(p.count for p in trend) / days, 2),
        submissions_trend=trend,
        fields=field_stats,
    )


def _pct(count: int, total: int) -> float:
    return round(count * 100 / total, 2) if total else 0.0


def _field_stats(field, values: list[Any], total: int) -> FieldAnalytics:
    answered = len(values)
    stats = FieldAnalytics(
        field_id=field.id,
        field_key=field.field_key,
        label=field.label,
        field_type=field.field_type,
        answered_count=answered,
        response_rate=_pct(answered, total),
    )
    ftype = field.field_type

    if ftype in OPTION_FIELD_TYPES and field.options:
        counter: Counter = Counter()
        for v in values:
            for item in (v if isinstance(v, list) else [v]):
                counter[str(item)] += 1
        stats.option_counts = [
            OptionCount(label=o.label, value=o.value, count=counter.get(o.value, 0), percentage=_pct(counter.get(o.value, 0), answered))
            for o in field.options
        ]
    elif ftype == FieldType.CHECKBOX:  # boolean checkbox
        yes = sum(1 for v in values if v is True)
        stats.option_counts = [
            OptionCount(label="Yes", value="true", count=yes, percentage=_pct(yes, answered)),
            OptionCount(label="No", value="false", count=answered - yes, percentage=_pct(answered - yes, answered)),
        ]
    elif ftype in (FieldType.NUMBER, FieldType.RATING):
        nums = [float(v) for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
        if nums:
            stats.average = round(sum(nums) / len(nums), 2)
            stats.minimum, stats.maximum = min(nums), max(nums)
        if ftype == FieldType.RATING:
            max_rating = int((field.config or {}).get("max_rating", 5))
            counter = Counter(int(n) for n in nums)
            stats.option_counts = [
                OptionCount(label=f"{i} star{'s' if i > 1 else ''}", value=str(i), count=counter.get(i, 0), percentage=_pct(counter.get(i, 0), len(nums)))
                for i in range(1, max_rating + 1)
            ]
    elif ftype == FieldType.DATE and values:
        dates = sorted(str(v) for v in values)
        stats.earliest, stats.latest = dates[0], dates[-1]
    return stats
