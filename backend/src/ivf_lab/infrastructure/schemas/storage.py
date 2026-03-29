from datetime import datetime

from pydantic import BaseModel


class StorageCreate(BaseModel):
    parent_id: str | None = None
    name: str
    location_type: str  # LocationType value
    is_managed: bool = False
    capacity: int | None = None


class StorageResponse(BaseModel):
    id: str
    parent_id: str | None
    name: str
    location_type: str
    is_managed: bool
    capacity: int | None
    created_at: datetime


class StorageTreeResponse(BaseModel):
    id: str
    name: str
    location_type: str
    is_managed: bool
    capacity: int | None
    children: list["StorageTreeResponse"] = []


class StorageDetailResponse(StorageResponse):
    """Storage location with stored embryos."""
    stored_embryos: list[dict] = []
