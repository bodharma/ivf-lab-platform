"""Embryo model — an individual embryo within a cycle."""

import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import TenantBase
from .enums import EmbryoDisposition, EmbryoSource


class Embryo(TenantBase):
    __tablename__ = "embryos"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    cycle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cycles.id"))
    embryo_code: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(
        Text, default=EmbryoSource.FRESH.value, server_default=EmbryoSource.FRESH.value
    )
    disposition: Mapped[str] = mapped_column(
        Text,
        default=EmbryoDisposition.IN_CULTURE.value,
        server_default=EmbryoDisposition.IN_CULTURE.value,
    )
    storage_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_locations.id"), nullable=True
    )
