from datetime import datetime
from typing import Any

from app.schemas.common import ORMModel


class ActivityLogOut(ORMModel):
    id: int
    user_id: int | None
    user_name: str | None
    user_email: str | None
    action: str
    entity_type: str | None
    entity_id: int | None
    description: str | None
    old_values: dict[str, Any] | None
    new_values: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime
