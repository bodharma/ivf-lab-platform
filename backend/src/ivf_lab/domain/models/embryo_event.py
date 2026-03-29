"""EmbryoEvent model — append-only event log for embryo state changes."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, SmallInteger, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import TenantBase
from .enums import EmbryoEventType


class EmbryoEvent(TenantBase):
    __tablename__ = "embryo_events"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    embryo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("embryos.id"))
    event_type: Mapped[str] = mapped_column(Text)
    event_day: Mapped[int] = mapped_column(SmallInteger)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    time_hpi: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    data: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    performed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
