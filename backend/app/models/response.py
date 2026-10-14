from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.form import Form
    from app.models.user import User


class FormResponse(TimestampMixin, Base):
    __tablename__ = "form_responses"
    __table_args__ = (Index("ix_form_responses_form_id_created_at", "form_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    submitted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))

    form: Mapped["Form"] = relationship(back_populates="responses", lazy="joined")
    submitter: Mapped["User | None"] = relationship(foreign_keys=[submitted_by], lazy="joined")
    editor: Mapped["User | None"] = relationship(foreign_keys=[updated_by], lazy="joined")
    details: Mapped[list["ResponseDetail"]] = relationship(
        back_populates="response",
        cascade="all, delete-orphan",
        order_by="ResponseDetail.id",
        passive_deletes=True,
    )


class ResponseDetail(TimestampMixin, Base):
    """One answer per field. Label/type are snapshotted so answers survive field deletion."""

    __tablename__ = "response_details"
    __table_args__ = (Index("ix_response_details_response_id_field_key", "response_id", "field_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("form_responses.id", ondelete="CASCADE"), nullable=False)
    field_id: Mapped[int | None] = mapped_column(ForeignKey("form_fields.id", ondelete="SET NULL"), index=True)
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    field_label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[str | None] = mapped_column(Text)

    response: Mapped["FormResponse"] = relationship(back_populates="details")
