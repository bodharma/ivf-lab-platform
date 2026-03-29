import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.repositories.patient_repo import PatientRepository
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.patient import (
    PatientCreate,
    PatientResponse,
    PatientUpdate,
)

router = APIRouter(prefix="/patients", tags=["patients"])


def _to_response(patient: PatientAlias) -> PatientResponse:
    return PatientResponse(
        id=str(patient.id),
        clinic_id=str(patient.clinic_id),
        alias_code=patient.alias_code,
        partner_alias_id=str(patient.partner_alias_id) if patient.partner_alias_id else None,
        notes=patient.notes,
        created_at=patient.created_at.isoformat(),
    )


@router.get("", response_model=list[PatientResponse])
async def list_patients(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[PatientResponse]:
    repo = PatientRepository(session)
    patients = await repo.list_patients(search=search, limit=limit, offset=offset)
    return [_to_response(p) for p in patients]


@router.post("", response_model=PatientResponse)
async def create_patient(
    body: PatientCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> PatientResponse:
    repo = PatientRepository(session)
    partner_alias_uuid: uuid.UUID | None = None
    if body.partner_alias_id:
        partner_alias_uuid = uuid.UUID(body.partner_alias_id)
    patient = PatientAlias(
        clinic_id=uuid.UUID(current_user["clinic_id"]),
        alias_code=body.alias_code,
        partner_alias_id=partner_alias_uuid,
        notes=body.notes,
    )
    created = await repo.create(patient)
    return _to_response(created)


@router.patch("/{id}", response_model=PatientResponse)
async def update_patient(
    id: uuid.UUID,
    body: PatientUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> PatientResponse:
    repo = PatientRepository(session)
    patient = await repo.get_by_id(id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    if body.partner_alias_id is not None:
        patient.partner_alias_id = uuid.UUID(body.partner_alias_id)
    if body.notes is not None:
        patient.notes = body.notes
    await session.flush()
    return _to_response(patient)
