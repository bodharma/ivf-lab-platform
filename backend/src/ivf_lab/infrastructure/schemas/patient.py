from pydantic import BaseModel


class PatientCreate(BaseModel):
    alias_code: str
    partner_alias_id: str | None = None
    notes: str | None = None


class PatientUpdate(BaseModel):
    partner_alias_id: str | None = None
    notes: str | None = None


class PatientResponse(BaseModel):
    id: str
    clinic_id: str
    alias_code: str
    partner_alias_id: str | None
    notes: str | None
    created_at: str
