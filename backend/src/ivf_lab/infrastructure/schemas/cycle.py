from datetime import date, datetime

from pydantic import BaseModel


class CycleCreate(BaseModel):
    patient_alias_id: str
    cycle_code: str
    cycle_type: str  # fresh_ivf, fresh_icsi, fet, donor_oocyte, donor_embryo
    start_date: date
    assigned_embryologist_id: str | None = None
    notes: str | None = None


class CycleUpdate(BaseModel):
    status: str | None = None  # state transition
    retrieval_date: date | None = None
    insemination_time: datetime | None = None
    transfer_date: date | None = None
    outcome: str | None = None
    assigned_embryologist_id: str | None = None
    notes: str | None = None


class EmbryoSummary(BaseModel):
    id: str
    embryo_code: str
    disposition: str
    latest_grade: dict | None = None
    current_day: int | None = None
    hours_post_insemination: float | None = None
    pending_checklists: int = 0


class CycleResponse(BaseModel):
    id: str
    clinic_id: str
    patient_alias_id: str
    patient_alias_code: str | None = None
    cycle_code: str
    cycle_type: str
    status: str
    start_date: date
    retrieval_date: date | None
    insemination_time: datetime | None
    transfer_date: date | None
    outcome: str | None
    assigned_embryologist_id: str | None
    notes: str | None
    created_at: str


class CycleDetailResponse(CycleResponse):
    embryos: list[EmbryoSummary] = []
    summary: dict = {}  # {total_embryos, in_culture, vitrified, ...}


class CycleTodayResponse(BaseModel):
    date: date
    cycles: list[CycleDetailResponse]


class CycleWeekResponse(BaseModel):
    date: date
    cycles: list[CycleResponse]
