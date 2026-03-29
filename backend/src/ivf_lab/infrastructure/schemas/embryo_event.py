"""Pydantic schemas for EmbryoEvent recording."""

from datetime import datetime

from pydantic import BaseModel, Field


class FertilizationData(BaseModel):
    pronuclei: str  # "2pn", "1pn", "0pn", "3pn"
    polar_bodies: int


class CleavageGradeData(BaseModel):
    cell_count: int
    fragmentation: int  # 1-4
    symmetry: str  # "even" / "uneven"
    multinucleation: bool


class BlastocystGradeData(BaseModel):
    expansion: int  # 1-6
    icm: str  # A/B/C
    te: str  # A/B/C


class DispositionChangeData(BaseModel):
    from_status: str = Field(alias="from")
    to_status: str = Field(alias="to")
    reason: str | None = None
    storage_location_id: str | None = None

    model_config = {"populate_by_name": True}


class TransferData(BaseModel):
    catheter_type: str | None = None
    difficulty: str | None = None


class VitrificationData(BaseModel):
    device: str | None = None
    medium: str | None = None


class WarmingData(BaseModel):
    survival: bool
    re_expansion_time_min: int | None = None


class BiopsyData(BaseModel):
    cells_removed: int
    purpose: str


class ObservationData(BaseModel):
    note: str


# Map event_type values to their data schema classes
EVENT_DATA_SCHEMAS: dict[str, type[BaseModel]] = {
    "fertilization_check": FertilizationData,
    "cleavage_grade": CleavageGradeData,
    "blastocyst_grade": BlastocystGradeData,
    "disposition_change": DispositionChangeData,
    "transfer": TransferData,
    "vitrification": VitrificationData,
    "warming": WarmingData,
    "biopsy": BiopsyData,
    "observation": ObservationData,
}


class EmbryoEventCreate(BaseModel):
    event_type: str
    event_day: int
    observed_at: datetime
    data: dict
    notes: str | None = None


class EmbryoEventResponse(BaseModel):
    id: str
    embryo_id: str
    event_type: str
    event_day: int
    observed_at: datetime
    time_hpi: float | None
    data: dict
    performed_by: str
    notes: str | None
    created_at: datetime
