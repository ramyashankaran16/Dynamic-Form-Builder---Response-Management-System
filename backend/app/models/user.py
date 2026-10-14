from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import RoleName
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.form import Form
    from app.models.role import Role


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("1"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)

    role: Mapped["Role"] = relationship(back_populates="users", lazy="joined")
    forms: Mapped[list["Form"]] = relationship(back_populates="owner", passive_deletes=True)

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None

    @property
    def is_admin(self) -> bool:
        return self.role_name == RoleName.ADMIN
