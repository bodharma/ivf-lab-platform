"""Storage model — hierarchical storage locations for cryo specimens."""

import uuid

from sqlalchemy import Boolean, ForeignKey, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import TenantBase
from .enums import LocationType


class StorageLocation(TenantBase):
    __tablename__ = "storage_locations"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_locations.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text)
    location_type: Mapped[str] = mapped_column(Text)
    is_managed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    capacity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
