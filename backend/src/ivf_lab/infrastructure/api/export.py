"""CSV export endpoints for cycles and embryos."""

import csv
import io
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.repositories.cycle_repo import CycleRepository
from ivf_lab.infrastructure.api.deps import get_current_user, get_db

router = APIRouter(prefix="/export", tags=["export"])

_CYCLE_COLUMNS = [
    "cycle_code",
    "patient_alias_code",
    "cycle_type",
    "status",
    "start_date",
    "retrieval_date",
    "insemination_time",
    "outcome",
    "total_embryos",
]

_EMBRYO_COLUMNS = [
    "cycle_code",
    "embryo_code",
    "source",
    "disposition",
    "latest_grade_day",
    "latest_grade",
]


def _make_csv(rows: list[dict], columns: list[str]) -> StreamingResponse:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )


@router.get("/cycles")
async def export_cycles(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> StreamingResponse:
    clinic_id = uuid.UUID(current_user["clinic_id"])
    repo = CycleRepository(session)

    result = await session.execute(
        select(Cycle).where(Cycle.clinic_id == clinic_id).order_by(Cycle.created_at.desc())
    )
    cycles = list(result.scalars().all())

    # Gather embryo counts per cycle
    embryo_counts: dict[uuid.UUID, int] = {}
    for cycle in cycles:
        embryos = await repo.get_embryos_for_cycle(cycle.id)
        embryo_counts[cycle.id] = len(embryos)

    rows = []
    for cycle in cycles:
        alias = await repo.get_patient_alias(cycle.patient_alias_id)
        alias_code = alias.alias_code if alias else ""
        rows.append({
            "cycle_code": cycle.cycle_code,
            "patient_alias_code": alias_code,
            "cycle_type": cycle.cycle_type,
            "status": cycle.status,
            "start_date": str(cycle.start_date) if cycle.start_date else "",
            "retrieval_date": str(cycle.retrieval_date) if cycle.retrieval_date else "",
            "insemination_time": cycle.insemination_time.isoformat() if cycle.insemination_time else "",
            "outcome": cycle.outcome or "",
            "total_embryos": embryo_counts.get(cycle.id, 0),
        })

    return _make_csv(rows, _CYCLE_COLUMNS)


@router.get("/embryos")
async def export_embryos(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    cycle_id: str | None = None,
) -> StreamingResponse:
    clinic_id = uuid.UUID(current_user["clinic_id"])
    repo = CycleRepository(session)

    query = select(Embryo).where(Embryo.clinic_id == clinic_id)
    if cycle_id:
        query = query.where(Embryo.cycle_id == uuid.UUID(cycle_id))
    query = query.order_by(Embryo.cycle_id, Embryo.embryo_code)

    result = await session.execute(query)
    embryos = list(result.scalars().all())

    # Gather cycle codes
    cycle_ids = list({e.cycle_id for e in embryos})
    cycle_code_map: dict[uuid.UUID, str] = {}
    for cid in cycle_ids:
        cycle = await session.get(Cycle, cid)
        if cycle:
            cycle_code_map[cid] = cycle.cycle_code

    # Gather latest grade events
    embryo_ids = [e.id for e in embryos]
    latest_grades = await repo.get_latest_grade_events(embryo_ids)

    rows = []
    for embryo in embryos:
        grade_event = latest_grades.get(embryo.id)
        latest_grade_day = ""
        latest_grade = ""
        if grade_event:
            latest_grade_day = str(grade_event.event_day) if grade_event.event_day is not None else ""
            data = grade_event.data or {}
            latest_grade = str(data.get("grade", data.get("score", "")))
        rows.append({
            "cycle_code": cycle_code_map.get(embryo.cycle_id, ""),
            "embryo_code": embryo.embryo_code,
            "source": embryo.source,
            "disposition": embryo.disposition,
            "latest_grade_day": latest_grade_day,
            "latest_grade": latest_grade,
        })

    return _make_csv(rows, _EMBRYO_COLUMNS)
