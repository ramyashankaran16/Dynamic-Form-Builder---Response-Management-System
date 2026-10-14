from celery.result import AsyncResult
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, response_filters
from app.core.config import settings
from app.core.constants import Action, EntityType, ExportFormat
from app.models import User
from app.schemas.export import ExportTaskOut
from app.schemas.response import ResponseFilters
from app.services.activity_service import log_activity
from app.services.export_service import EXTENSIONS, MEDIA_TYPES, generate_export
from app.services.form_service import get_manageable_form
from app.worker.celery_app import celery_app
from app.worker.tasks import generate_form_export

router = APIRouter(prefix="/exports", tags=["Exports (Excel / PDF)"])


@router.post("/forms/{form_id}", response_model=ExportTaskOut, status_code=status.HTTP_202_ACCEPTED)
def request_export(
    form_id: int,
    request: Request,
    format: ExportFormat = Query(ExportFormat.EXCEL),
    filters: ResponseFilters = Depends(response_filters),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """**Async export via Celery.** Accepts the same filters as the responses list.
    Poll `GET /exports/tasks/{task_id}` and download when status is `SUCCESS`."""
    form = get_manageable_form(db, form_id, user)
    try:
        task = generate_form_export.delay(form.id, format.value, filters.model_dump(mode="json"), user.id)
    except Exception as exc:  # broker not reachable
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Background worker is unavailable. Use GET /exports/forms/{form_id}/download instead.",
        ) from exc
    log_activity(db, action=Action.EXPORT_REQUESTED, user=user, entity_type=EntityType.FORM, entity_id=form.id,
                 description=f"{format.value.upper()} export requested for '{form.title}'",
                 new_values={"task_id": task.id, "format": format.value}, request=request)
    db.commit()
    return ExportTaskOut(task_id=task.id, status="PENDING", format=format.value)


def _task_result(task_id: str, user: User) -> tuple[AsyncResult, dict | None]:
    result = AsyncResult(task_id, app=celery_app)
    info = result.result if result.state == "SUCCESS" and isinstance(result.result, dict) else None
    if info and not user.is_admin and info.get("user_id") != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Export not found.")
    return result, info


@router.get("/tasks/{task_id}", response_model=ExportTaskOut)
def export_status(task_id: str, user: User = Depends(get_current_user)):
    """Status: PENDING | STARTED | RETRY | SUCCESS | FAILURE."""
    result, info = _task_result(task_id, user)
    out = ExportTaskOut(task_id=task_id, status=result.state)
    if info:
        out.format = info.get("format")
        out.file_name = info.get("file_name")
        out.download_url = f"{settings.API_V1_PREFIX}/exports/tasks/{task_id}/download"
    elif result.state == "FAILURE":
        out.error = str(result.result)
    return out


@router.get("/tasks/{task_id}/download", response_class=FileResponse)
def download_export(task_id: str, user: User = Depends(get_current_user)):
    result, info = _task_result(task_id, user)
    if not info:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Export is not ready (status: {result.state}).")
    path = settings.export_dir / info["file_name"]
    if not path.is_file():
        raise HTTPException(status.HTTP_410_GONE, "Export file has expired. Please request a new export.")
    return FileResponse(path, filename=info["file_name"], media_type=MEDIA_TYPES[ExportFormat(info["format"])])


@router.get("/forms/{form_id}/download", response_class=FileResponse)
def download_export_now(
    form_id: int,
    request: Request,
    background: BackgroundTasks,
    format: ExportFormat = Query(ExportFormat.EXCEL),
    filters: ResponseFilters = Depends(response_filters),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """**Synchronous export** - generates and streams the file immediately (fine for small/medium forms)."""
    form = get_manageable_form(db, form_id, user)
    path = generate_export(db, form.id, format, filters)
    log_activity(db, action=Action.EXPORT_DOWNLOADED, user=user, entity_type=EntityType.FORM, entity_id=form.id,
                 description=f"{format.value.upper()} export downloaded for '{form.title}'",
                 new_values={"format": format.value, "file": path.name}, request=request)
    db.commit()
    background.add_task(path.unlink, missing_ok=True)
    return FileResponse(path, filename=path.name, media_type=MEDIA_TYPES[format])


__all__ = ["router", "EXTENSIONS"]
