from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.db.session import engine
from app.services.form_engine import FieldDefinitionError, SubmissionValidationError

DESCRIPTION = """
Build dynamic forms without code changes: drag-and-drop field ordering, 9 field types,
required/type validation, conditional visibility, public & authenticated submissions,
permission-based response editing with full history, search & filters, analytics,
Excel/PDF exports (Celery) and activity logs.

**Auth:** click **Authorize** and log in with your email as `username`.
Default admin: `admin@formbuilder.com` / `Admin@123` (change it!).
"""

TAGS = [
    {"name": "Authentication", "description": "Register, login (JWT), refresh, profile"},
    {"name": "Users (Admin)", "description": "Role-based user management - **Admin only**"},
    {"name": "Forms", "description": "Form CRUD, enable/disable, duplicate, field builder & ordering"},
    {"name": "Form Submission (Public & Authenticated)", "description": "Render & submit forms, file uploads"},
    {"name": "Responses", "description": "Search/filter, view, edit (permission based), history, delete"},
    {"name": "Dashboard & Analytics", "description": "Dashboard KPIs and form-wise analytics"},
    {"name": "Exports (Excel / PDF)", "description": "Async (Celery) and synchronous exports"},
    {"name": "Activity Logs", "description": "Audit trail"},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.export_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=DESCRIPTION,
    openapi_tags=TAGS,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={"persistAuthorization": True, "docExpansion": "none"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(SubmissionValidationError)
async def submission_error_handler(_: Request, exc: SubmissionValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Please correct the highlighted fields.", "errors": exc.errors},
    )


@app.exception_handler(FieldDefinitionError)
async def definition_error_handler(_: Request, exc: FieldDefinitionError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid form definition.", "errors": exc.errors},
    )


app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": db_ok, "version": settings.VERSION}
