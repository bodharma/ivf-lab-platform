import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.repositories.cycle_repo import CycleRepository
from ivf_lab.domain.services import cycle_service
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.cycle import (
    CycleCreate,
    CycleDetailResponse,
    CycleResponse,
    CycleTodayResponse,
    CycleUpdate,
    EmbryoSummary,
)

router = APIRouter(prefix="/cycles", tags=["cycles"])


def _compute_hpi(insemination_time: datetime | None) -> float | None:
    if insemination_time is None:
        return None
    now = datetime.now(tz=timezone.utc)
    if insemination_time.tzinfo is None:
        insemination_time = insemination_time.replace(tzinfo=timezone.utc)
    delta = now - insemination_time
    return round(delta.total_seconds() / 3600, 2)


def _compute_current_day(insemination_time: datetime | None) -> int | None:
    if insemination_time is None:
        return None
    hpi = _compute_hpi(insemination_time)
    if hpi is None:
        return None
    # Day 1 starts at 0 HPI, Day 2 at 24 HPI, etc.
    return int(hpi // 24) + 1


def _embryo_to_summary(
    embryo: Embryo,
    latest_grade: EmbryoEvent | None,
    insemination_time: datetime | None,
) -> EmbryoSummary:
    latest_grade_dict: dict | None = None
    if latest_grade is not None:
        latest_grade_dict = {
            "event_type": latest_grade.event_type,
            "event_day": latest_grade.event_day,
            "data": latest_grade.data,
            "observed_at": latest_grade.observed_at.isoformat(),
        }
    return EmbryoSummary(
        id=str(embryo.id),
        embryo_code=embryo.embryo_code,
        disposition=embryo.disposition,
        latest_grade=latest_grade_dict,
        current_day=_compute_current_day(insemination_time),
        hours_post_insemination=_compute_hpi(insemination_time),
        pending_checklists=0,
    )


def _build_summary(embryos: list[Embryo]) -> dict:
    total = len(embryos)
    by_disposition: dict[str, int] = {}
    for embryo in embryos:
        by_disposition[embryo.disposition] = by_disposition.get(embryo.disposition, 0) + 1
    return {
        "total_embryos": total,
        "in_culture": by_disposition.get("in_culture", 0),
        "vitrified": by_disposition.get("vitrified", 0),
        "transferred": by_disposition.get("transferred", 0),
        "discarded": by_disposition.get("discarded", 0),
        "donated": by_disposition.get("donated", 0),
        "biopsied_pending": by_disposition.get("biopsied_pending", 0),
    }


def _cycle_to_response(cycle: Cycle, alias_code: str | None = None) -> CycleResponse:
    return CycleResponse(
        id=str(cycle.id),
        clinic_id=str(cycle.clinic_id),
        patient_alias_id=str(cycle.patient_alias_id),
        patient_alias_code=alias_code,
        cycle_code=cycle.cycle_code,
        cycle_type=cycle.cycle_type,
        status=cycle.status,
        start_date=cycle.start_date,
        retrieval_date=cycle.retrieval_date,
        insemination_time=cycle.insemination_time,
        transfer_date=cycle.transfer_date,
        outcome=cycle.outcome,
        assigned_embryologist_id=str(cycle.assigned_embryologist_id)
        if cycle.assigned_embryologist_id
        else None,
        notes=cycle.notes,
        created_at=cycle.created_at.isoformat(),
    )


def _cycle_to_detail(
    cycle: Cycle,
    embryos: list[Embryo],
    latest_grades: dict[uuid.UUID, EmbryoEvent],
    alias_code: str | None = None,
) -> CycleDetailResponse:
    embryo_summaries = [
        _embryo_to_summary(e, latest_grades.get(e.id), cycle.insemination_time)
        for e in embryos
    ]
    summary = _build_summary(embryos)
    base = _cycle_to_response(cycle, alias_code)
    return CycleDetailResponse(
        **base.model_dump(),
        embryos=embryo_summaries,
        summary=summary,
    )


@router.get("", response_model=list[CycleResponse])
async def list_cycles(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    status: str | None = None,
    patient_alias_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CycleResponse]:
    repo = CycleRepository(session)
    cycles = await repo.list_cycles(
        status=status,
        patient_alias_id=patient_alias_id,
        limit=limit,
        offset=offset,
    )
    return [_cycle_to_response(c) for c in cycles]


@router.get("/today", response_model=CycleTodayResponse)
async def get_today_cycles(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> CycleTodayResponse:
    repo = CycleRepository(session)
    cycles = await repo.get_today_cycles()

    cycle_details: list[CycleDetailResponse] = []
    for cycle in cycles:
        embryos = await repo.get_embryos_for_cycle(cycle.id)
        embryo_ids = [e.id for e in embryos]
        latest_grades = await repo.get_latest_grade_events(embryo_ids)
        detail = _cycle_to_detail(cycle, embryos, latest_grades)
        cycle_details.append(detail)

    return CycleTodayResponse(
        date=date.today(),
        cycles=cycle_details,
    )


@router.post("", response_model=CycleResponse)
async def create_cycle(
    body: CycleCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> CycleResponse:
    repo = CycleRepository(session)

    # Verify patient alias exists
    patient_alias_uuid = uuid.UUID(body.patient_alias_id)
    patient_alias = await repo.get_patient_alias(patient_alias_uuid)
    if not patient_alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient alias not found",
        )

    assigned_embryologist_uuid: uuid.UUID | None = None
    if body.assigned_embryologist_id:
        assigned_embryologist_uuid = uuid.UUID(body.assigned_embryologist_id)

    cycle = Cycle(
        clinic_id=uuid.UUID(current_user["clinic_id"]),
        patient_alias_id=patient_alias_uuid,
        cycle_code=body.cycle_code,
        cycle_type=body.cycle_type,
        start_date=body.start_date,
        assigned_embryologist_id=assigned_embryologist_uuid,
        notes=body.notes,
    )
    created = await repo.create(cycle)
    return _cycle_to_response(created, alias_code=patient_alias.alias_code)


@router.get("/{id}", response_model=CycleDetailResponse)
async def get_cycle(
    id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> CycleDetailResponse:
    repo = CycleRepository(session)
    cycle, embryos, latest_grades = await repo.get_detail(id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")

    patient_alias = await repo.get_patient_alias(cycle.patient_alias_id)
    alias_code = patient_alias.alias_code if patient_alias else None

    return _cycle_to_detail(cycle, embryos, latest_grades, alias_code)


@router.patch("/{id}", response_model=CycleResponse)
async def update_cycle(
    id: uuid.UUID,
    body: CycleUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> CycleResponse:
    repo = CycleRepository(session)
    cycle = await repo.get_by_id(id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")

    try:
        updated = cycle_service.update_cycle(cycle, body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await session.flush()
    return _cycle_to_response(updated)
