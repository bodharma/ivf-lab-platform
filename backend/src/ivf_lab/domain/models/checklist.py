"""Checklist models — templates, instances, and item responses for procedure checklists."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, SmallInteger, Text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from .base import TenantBase
from .enums import ChecklistStatus


class ChecklistTemplate(TenantBase):
    __tablename__ = "checklist_templates"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    name: Mapped[str] = mapped_column(Text)
    procedure_type: Mapped[str] = mapped_column(Text)
    items: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )


class ChecklistInstance(TenantBase):
    __tablename__ = "checklist_instances"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("checklist_templates.id")
    )
    cycle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cycles.id"))
    embryo_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("embryos.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Text,
        default=ChecklistStatus.PENDING.value,
        server_default=ChecklistStatus.PENDING.value,
    )
    started_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    completed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )


class ChecklistItemResponse(TenantBase):
    __tablename__ = "checklist_item_responses"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    checklist_instance_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("checklist_instances.id")
    )
    item_index: Mapped[int] = mapped_column(SmallInteger)
    value: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    completed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
