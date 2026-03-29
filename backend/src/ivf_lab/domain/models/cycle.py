"""Cycle model — an IVF treatment cycle for a patient alias."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import TenantBase
from .enums import CycleOutcome, CycleStatus, CycleType


class Cycle(TenantBase):
    __tablename__ = "cycles"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    patient_alias_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patient_aliases.id")
    )
    cycle_code: Mapped[str] = mapped_column(Text)
    cycle_type: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Text, default=CycleStatus.PLANNED.value, server_default=CycleStatus.PLANNED.value
    )
    start_date: Mapped[date] = mapped_column(Date)
    retrieval_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    insemination_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    transfer_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_embryologist_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
