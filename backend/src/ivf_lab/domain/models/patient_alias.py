"""PatientAlias model — de-identified patient references (no PII stored)."""

import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import TenantBase


class PatientAlias(TenantBase):
    __tablename__ = "patient_aliases"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinics.id"), index=True
    )
    alias_code: Mapped[str] = mapped_column(Text)
    partner_alias_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("patient_aliases.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
