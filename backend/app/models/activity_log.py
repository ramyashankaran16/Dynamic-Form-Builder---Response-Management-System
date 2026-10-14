from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.utils.time import utcnow

if TYPE_CHECKING:
    from app.models.user import User


class ActivityLog(Base):
    """Audit trail. Also stores response edit history (old/new values)."""

    __tablename__ = "activity_logs"
    __table_args__ = (Index("ix_activity_logs_entity_type_entity_id", "entity_type", "entity_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(String(500))
    old_values: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    new_values: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, index=True, default=utcnow, server_default=text("CURRENT_TIMESTAMP")
    )

    user: Mapped["User | None"] = relationship(lazy="joined")

    @property
    def user_name(self) -> str | None:
        return self.user.full_name if self.user else None

    @property
    def user_email(self) -> str | None:
        return self.user.email if self.user else None
