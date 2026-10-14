import logging
import time

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.export_service import generate_export
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="exports.generate_form_export", max_retries=2)
def generate_form_export(self, form_id: int, fmt: str, filters: dict, user_id: int) -> dict:
    db = SessionLocal()
    try:
        path = generate_export(db, form_id, fmt, filters)
        logger.info("Export generated: %s", path)
        return {"form_id": form_id, "format": fmt, "file_name": path.name, "user_id": user_id}
    except Exception as exc:  # retry transient DB errors
        logger.exception("Export failed for form %s", form_id)
        raise self.retry(exc=exc, countdown=5) if self.request.retries < self.max_retries else exc
    finally:
        db.close()


@celery_app.task(name="exports.cleanup_old_exports")
def cleanup_old_exports() -> int:
    cutoff = time.time() - settings.EXPORT_RETENTION_HOURS * 3600
    removed = 0
    if settings.export_dir.exists():
        for f in settings.export_dir.iterdir():
            if f.is_file() and f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)
                removed += 1
    return removed
