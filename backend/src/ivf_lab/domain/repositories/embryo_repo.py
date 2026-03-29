"""Repository for Embryo and EmbryoEvent data access."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.repositories.base import BaseRepository


class EmbryoRepository(BaseRepository[Embryo]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Embryo)

    async def list_by_cycle(self, cycle_id: uuid.UUID) -> list[Embryo]:
        query = select(Embryo).where(Embryo.cycle_id == cycle_id)
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_with_events(self, embryo_id: uuid.UUID) -> tuple[Embryo | None, list[EmbryoEvent]]:
        embryo = await self._session.get(Embryo, embryo_id)
        if not embryo:
            return None, []
        events_query = (
            select(EmbryoEvent)
            .where(EmbryoEvent.embryo_id == embryo_id)
            .order_by(EmbryoEvent.created_at)
        )
        result = await self._session.execute(events_query)
        events = list(result.scalars().all())
        return embryo, events

    async def list_events(self, embryo_id: uuid.UUID) -> list[EmbryoEvent]:
        query = (
            select(EmbryoEvent)
            .where(EmbryoEvent.embryo_id == embryo_id)
            .order_by(EmbryoEvent.created_at)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())
