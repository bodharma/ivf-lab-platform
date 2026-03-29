from datetime import datetime

from pydantic import BaseModel


class ChecklistTemplateCreate(BaseModel):
    name: str
    procedure_type: str
    items: list[dict]  # [{order, label, required, field_type}]


class ChecklistTemplateUpdate(BaseModel):
    name: str | None = None
    items: list[dict] | None = None
    is_active: bool | None = None


class ChecklistTemplateResponse(BaseModel):
    id: str
    name: str
    procedure_type: str
    items: list[dict]
    is_active: bool
    created_at: datetime


class ChecklistInstanceCreate(BaseModel):
    template_id: str
    embryo_id: str | None = None


class ChecklistItemComplete(BaseModel):
    value: dict | bool | str | int  # flexible value depending on field_type


class ChecklistItemResponseData(BaseModel):
    item_index: int
    value: dict
    completed_by: str
    completed_at: datetime


class ChecklistInstanceResponse(BaseModel):
    id: str
    template_id: str
    cycle_id: str
    embryo_id: str | None
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    completed_by: str | None
    created_at: datetime
    items: list[ChecklistItemResponseData] = []
