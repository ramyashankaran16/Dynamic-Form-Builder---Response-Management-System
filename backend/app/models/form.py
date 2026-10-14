from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.response import FormResponse
    from app.models.user import User


class Form(TimestampMixin, Base):
    __tablename__ = "forms"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("1"))
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("0"))
    allow_response_edit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("0"))
    allow_multiple_submissions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("1")
    )
    submit_message: Mapped[str | None] = mapped_column(String(500))

    owner: Mapped["User"] = relationship(back_populates="forms", lazy="joined")
    fields: Mapped[list["FormField"]] = relationship(
        back_populates="form",
        cascade="all, delete-orphan",
        order_by="FormField.order_index",
        passive_deletes=True,
    )
    responses: Mapped[list["FormResponse"]] = relationship(
        back_populates="form", cascade="all, delete-orphan", passive_deletes=True
    )


class FormField(TimestampMixin, Base):
    __tablename__ = "form_fields"
    __table_args__ = (UniqueConstraint("form_id", "field_key", name="uq_form_fields_form_id_field_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True, nullable=False)
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)
    placeholder: Mapped[str | None] = mapped_column(String(255))
    help_text: Mapped[str | None] = mapped_column(String(500))
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("0"))
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    # Type specific settings: min/max, max_rating, allowed_extensions, ...
    config: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    # Conditional visibility: {"logic": "all|any", "conditions": [{"field_key", "operator", "value"}]}
    visibility_rules: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    form: Mapped["Form"] = relationship(back_populates="fields")
    options: Mapped[list["FieldOption"]] = relationship(
        back_populates="field",
        cascade="all, delete-orphan",
        order_by="FieldOption.order_index",
        passive_deletes=True,
    )


class FieldOption(Base):
    __tablename__ = "field_options"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("form_fields.id", ondelete="CASCADE"), index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))

    field: Mapped["FormField"] = relationship(back_populates="options")
