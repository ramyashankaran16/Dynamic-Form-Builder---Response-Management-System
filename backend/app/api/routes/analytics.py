from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.analytics import DashboardStats, FormAnalytics
from app.services import analytics_service
from app.services.form_service import get_manageable_form

router = APIRouter(prefix="/analytics", tags=["Dashboard & Analytics"])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(days: int = Query(30, ge=7, le=365, description="Trend window"), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Dashboard KPIs, submission trend, top forms and recent responses.
    Admins see platform-wide numbers (plus user counts); users see their own forms."""
    return analytics_service.dashboard(db, user, days)


@router.get("/forms/{form_id}", response_model=FormAnalytics)
def form_analytics(form_id: int, days: int = Query(30, ge=7, le=365), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Form-wise analytics: totals, trend, and per-field stats (option distribution,
    rating averages, number min/max/avg, response rate)."""
    return analytics_service.form_analytics(db, get_manageable_form(db, form_id, user), days)
