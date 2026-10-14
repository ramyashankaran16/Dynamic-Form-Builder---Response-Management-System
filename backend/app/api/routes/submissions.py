"""Form rendering + submission. Works for anonymous users (public forms) and
authenticated users (send the Bearer token)."""
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user_optional, get_db
from app.core.config import settings
from app.core.constants import FieldType
from app.models import Form, FormField, FormResponse, User
from app.schemas.form import PublicFormOut
from app.schemas.response import FileUploadOut, SubmissionRequest, SubmissionResult
from app.services import response_service
from app.utils.http import secure_filename

router = APIRouter(prefix="/public/forms", tags=["Form Submission (Public & Authenticated)"])

CHUNK = 1024 * 1024


def get_form_for_submission(db: Session, slug: str, user: User | None) -> Form:
    form = db.scalar(select(Form).where(Form.slug == slug).options(selectinload(Form.fields).selectinload(FormField.options)))
    if form is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found.")
    if not form.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This form is currently not accepting responses.")
    if not form.is_public and user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in to access this form.", headers={"WWW-Authenticate": "Bearer"})
    return form


@router.get("/{slug}", response_model=PublicFormOut)
def get_public_form(slug: str, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """Form definition for the renderer (fields, options, validation config, visibility rules)."""
    return get_form_for_submission(db, slug, user)


@router.post("/{slug}/upload", response_model=FileUploadOut, status_code=status.HTTP_201_CREATED)
def upload_file(
    slug: str,
    field_key: str = Query(..., description="Key of the file field"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """Step 1 for file fields: upload the file, then send the returned `file_path`
    as that field's answer in `/submit`."""
    form = get_form_for_submission(db, slug, user)
    field = next((f for f in form.fields if f.field_key == field_key and f.field_type == FieldType.FILE), None)
    if field is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"File field '{field_key}' not found on this form.")

    cfg = field.config or {}
    name = secure_filename(file.filename)
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    allowed = cfg.get("allowed_extensions") or settings.default_allowed_extensions
    if ext not in allowed:
        raise HTTPException(422, f"File type '.{ext}' is not allowed. Allowed: {', '.join(allowed)}.")
    max_bytes = int(float(min(cfg.get("max_size_mb") or settings.MAX_UPLOAD_SIZE_MB, settings.MAX_UPLOAD_SIZE_MB)) * CHUNK)

    rel = f"{form.id}/{uuid.uuid4().hex}_{name}"
    dest = settings.upload_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    with dest.open("wb") as out:
        while chunk := file.file.read(CHUNK):
            size += len(chunk)
            if size > max_bytes:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds the {max_bytes // CHUNK} MB limit.")
            out.write(chunk)
    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(422, "Uploaded file is empty.")
    return FileUploadOut(file_path=rel, file_name=name, size_bytes=size, content_type=file.content_type)


@router.post("/{slug}/submit", response_model=SubmissionResult, status_code=status.HTTP_201_CREATED)
def submit_form(
    slug: str,
    payload: SubmissionRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """Submit answers as `{field_key: value}`. Validation applies required rules,
    type checks and conditional visibility (hidden fields are ignored).
    On failure returns **422** with `errors: {field_key: message}`."""
    form = get_form_for_submission(db, slug, user)
    if not form.allow_multiple_submissions and user is not None:
        already = db.scalar(select(FormResponse.id).where(FormResponse.form_id == form.id, FormResponse.submitted_by == user.id).limit(1))
        if already:
            raise HTTPException(status.HTTP_409_CONFLICT, "You have already submitted this form.")
    response = response_service.create_response(db, form, payload.answers, user, request)
    db.commit()
    return SubmissionResult(response_id=response.id, message=form.submit_message or "Thank you! Your response has been recorded.")
