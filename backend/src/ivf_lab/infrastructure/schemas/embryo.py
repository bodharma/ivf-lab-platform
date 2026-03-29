"""Pydantic schemas for Embryo CRUD."""

from datetime import datetime

from pydantic import BaseModel


class EmbryoCreate(BaseModel):
    embryo_code: str
    source: str = "fresh"


class EmbryoResponse(BaseModel):
    id: str
    cycle_id: str
    embryo_code: str
    source: str
    disposition: str
    storage_location_id: str | None
    created_at: datetime
