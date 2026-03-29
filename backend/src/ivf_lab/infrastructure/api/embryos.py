"""API router for Embryo CRUD and event recording."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.repositories.embryo_repo import EmbryoRepository
from ivf_lab.domain.services.embryo_service import EmbryoServiceError, create_embryo, record_event
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.embryo import EmbryoCreate, EmbryoResponse
from ivf_lab.infrastructure.schemas.embryo_event import EmbryoEventCreate, EmbryoEventResponse

router = APIRouter(tags=["embryos"])


def _embryo_to_response(embryo: Embryo) -> EmbryoResponse:
    return EmbryoResponse(
        id=str(embryo.id),
        cycle_id=str(embryo.cycle_id),
        embryo_code=embryo.embryo_code,
        source=embryo.source,
        disposition=embryo.disposition,
        storage_location_id=str(embryo.storage_location_id) if embryo.storage_location_id else None,
        created_at=embryo.created_at,
    )


def _event_to_response(event: EmbryoEvent) -> EmbryoEventResponse:
    return EmbryoEventResponse(
        id=str(event.id),
        embryo_id=str(event.embryo_id),
        event_type=event.event_type,
        event_day=event.event_day,
        observed_at=event.observed_at,
        time_hpi=float(event.time_hpi) if event.time_hpi is not None else None,
        data=event.data,
        performed_by=str(event.performed_by),
        notes=event.notes,
        created_at=event.created_at,
    )


@router.get("/cycles/{cycle_id}/embryos", response_model=list[EmbryoResponse])
async def list_embryos(
    cycle_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> list[EmbryoResponse]:
    repo = EmbryoRepository(session)
    embryos = await repo.list_by_cycle(cycle_id)
    return [_embryo_to_response(e) for e in embryos]


@router.post("/cycles/{cycle_id}/embryos", response_model=EmbryoResponse)
async def create_embryo_endpoint(
    cycle_id: uuid.UUID,
    body: EmbryoCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> EmbryoResponse:
    clinic_id = uuid.UUID(current_user["clinic_id"])
    embryo = await create_embryo(session, clinic_id, cycle_id, body)
    return _embryo_to_response(embryo)


@router.get("/embryos/{id}", response_model=EmbryoResponse)
async def get_embryo(
    id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> EmbryoResponse:
    repo = EmbryoRepository(session)
    embryo, _ = await repo.get_with_events(id)
    if not embryo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Embryo not found")
    return _embryo_to_response(embryo)


@router.get("/embryos/{id}/events", response_model=list[EmbryoEventResponse])
async def list_embryo_events(
    id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> list[EmbryoEventResponse]:
    repo = EmbryoRepository(session)
    embryo = await repo.get_by_id(id)
    if not embryo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Embryo not found")
    events = await repo.list_events(id)
    return [_event_to_response(ev) for ev in events]


@router.post("/embryos/{id}/events", response_model=EmbryoEventResponse)
async def record_embryo_event(
    id: uuid.UUID,
    body: EmbryoEventCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> EmbryoEventResponse:
    clinic_id = uuid.UUID(current_user["clinic_id"])
    user_id = uuid.UUID(current_user["sub"])
    try:
        event = await record_event(session, clinic_id, id, user_id, body)
    except EmbryoServiceError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return _event_to_response(event)
