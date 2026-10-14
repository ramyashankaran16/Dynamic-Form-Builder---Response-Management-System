from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "form_builder",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=60 * 60 * 24,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "cleanup-old-exports": {"task": "exports.cleanup_old_exports", "schedule": 60 * 60},
    },
)
