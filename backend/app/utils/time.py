from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC datetime (MySQL DATETIME has no timezone)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
