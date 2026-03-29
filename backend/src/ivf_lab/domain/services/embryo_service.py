"""Service layer for Embryo CRUD and event recording."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.models.enums import EmbryoDisposition, EmbryoEventType
from ivf_lab.domain.repositories.embryo_repo import EmbryoRepository
from ivf_lab.infrastructure.schemas.embryo import EmbryoCreate
from ivf_lab.infrastructure.schemas.embryo_event import EmbryoEventCreate

# Valid disposition transitions
_DISPOSITION_TRANSITIONS: dict[str, set[str]] = {
    EmbryoDisposition.IN_CULTURE.value: {
        EmbryoDisposition.VITRIFIED.value,
        EmbryoDisposition.TRANSFERRED.value,
        EmbryoDisposition.DISCARDED.value,
        EmbryoDisposition.DONATED.value,
        EmbryoDisposition.BIOPSIED_PENDING.value,
    },
    EmbryoDisposition.BIOPSIED_PENDING.value: {
        EmbryoDisposition.IN_CULTURE.value,
    },
    EmbryoDisposition.VITRIFIED.value: {
        EmbryoDisposition.IN_CULTURE.value,
    },
}


class EmbryoServiceError(Exception):
    pass


async def create_embryo(
    session: AsyncSession,
    clinic_id: uuid.UUID,
    cycle_id: uuid.UUID,
    data: EmbryoCreate,
) -> Embryo:
    embryo = Embryo(
        clinic_id=clinic_id,
        cycle_id=cycle_id,
        embryo_code=data.embryo_code,
        source=data.source,
    )
    repo = EmbryoRepository(session)
    return await repo.create(embryo)


async def record_event(
    session: AsyncSession,
    clinic_id: uuid.UUID,
    embryo_id: uuid.UUID,
    user_id: uuid.UUID,
    event_data: EmbryoEventCreate,
) -> EmbryoEvent:
    # Validate event_type
    valid_types = {e.value for e in EmbryoEventType}
    if event_data.event_type not in valid_types:
        raise EmbryoServiceError(f"Invalid event_type: {event_data.event_type}")

    # Fetch embryo
    repo = EmbryoRepository(session)
    embryo = await repo.get_by_id(embryo_id)
    if not embryo:
        raise EmbryoServiceError(f"Embryo {embryo_id} not found")

    # Fetch cycle to compute HPI
    cycle = await session.get(Cycle, embryo.cycle_id)
    time_hpi: float | None = None
    if cycle and cycle.insemination_time:
        insem = cycle.insemination_time
        observed = event_data.observed_at
        # Ensure both are offset-aware for subtraction
        if insem.tzinfo is None:
            insem = insem.replace(tzinfo=timezone.utc)
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=timezone.utc)
        delta_seconds = (observed - insem).total_seconds()
        time_hpi = round(delta_seconds / 3600, 2)

    # Handle disposition_change
    if event_data.event_type == EmbryoEventType.DISPOSITION_CHANGE.value:
        from_status = event_data.data.get("from")
        to_status = event_data.data.get("to")
        if not from_status or not to_status:
            raise EmbryoServiceError("disposition_change event requires 'from' and 'to' fields in data")
        allowed = _DISPOSITION_TRANSITIONS.get(from_status, set())
        if to_status not in allowed:
            raise EmbryoServiceError(
                f"Invalid disposition transition: {from_status} → {to_status}"
            )
        embryo.disposition = to_status

    event = EmbryoEvent(
        clinic_id=clinic_id,
        embryo_id=embryo_id,
        event_type=event_data.event_type,
        event_day=event_data.event_day,
        observed_at=event_data.observed_at,
        time_hpi=time_hpi,
        data=event_data.data,
        performed_by=user_id,
        notes=event_data.notes,
    )
    session.add(event)
    await session.flush()
    return event
