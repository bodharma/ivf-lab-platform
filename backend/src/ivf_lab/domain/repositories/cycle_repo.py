import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.repositories.base import BaseRepository


class CycleRepository(BaseRepository[Cycle]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Cycle)

    async def list_cycles(
        self,
        status: str | None = None,
        patient_alias_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Cycle]:
        query = select(Cycle)
        if status:
            query = query.where(Cycle.status == status)
        if patient_alias_id:
            query = query.where(Cycle.patient_alias_id == uuid.UUID(patient_alias_id))
        query = query.order_by(Cycle.created_at.desc()).limit(limit).offset(offset)
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_today_cycles(self) -> list[Cycle]:
        """Return active cycles that have at least one embryo with disposition='in_culture'."""
        subquery = (
            select(Embryo.cycle_id)
            .where(Embryo.disposition == "in_culture")
            .distinct()
            .scalar_subquery()
        )
        query = (
            select(Cycle)
            .where(Cycle.status == "active")
            .where(Cycle.id.in_(subquery))
            .order_by(Cycle.created_at.desc())
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_embryos_for_cycle(self, cycle_id: uuid.UUID) -> list[Embryo]:
        query = select(Embryo).where(Embryo.cycle_id == cycle_id)
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_latest_grade_events(
        self, embryo_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, EmbryoEvent]:
        """Return the most recent grading event per embryo."""
        if not embryo_ids:
            return {}
        grade_event_types = [
            "fertilization_check",
            "cleavage_grade",
            "blastocyst_grade",
        ]
        query = (
            select(EmbryoEvent)
            .where(EmbryoEvent.embryo_id.in_(embryo_ids))
            .where(EmbryoEvent.event_type.in_(grade_event_types))
            .order_by(EmbryoEvent.embryo_id, EmbryoEvent.observed_at.desc())
        )
        result = await self._session.execute(query)
        events = result.scalars().all()

        latest: dict[uuid.UUID, EmbryoEvent] = {}
        for event in events:
            if event.embryo_id not in latest:
                latest[event.embryo_id] = event
        return latest

    async def get_week_cycles(self, clinic_id: uuid.UUID) -> list[Cycle]:
        """Active cycles that have embryos in culture."""
        result = await self._session.execute(
            select(Cycle).where(
                Cycle.clinic_id == clinic_id,
                Cycle.status == "active",
            ).order_by(Cycle.insemination_time)
        )
        return list(result.scalars().all())

    async def get_patient_alias(self, patient_alias_id: uuid.UUID) -> PatientAlias | None:
        return await self._session.get(PatientAlias, patient_alias_id)

    async def get_detail(self, cycle_id: uuid.UUID) -> tuple[Cycle | None, list[Embryo], dict[uuid.UUID, EmbryoEvent]]:
        """Return (cycle, embryos, latest_grade_events_by_embryo_id)."""
        cycle = await self.get_by_id(cycle_id)
        if not cycle:
            return None, [], {}
        embryos = await self.get_embryos_for_cycle(cycle_id)
        embryo_ids = [e.id for e in embryos]
        latest_grades = await self.get_latest_grade_events(embryo_ids)
        return cycle, embryos, latest_grades
