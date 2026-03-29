import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.checklist import (
    ChecklistInstance,
    ChecklistItemResponse,
    ChecklistTemplate,
)
from ivf_lab.domain.repositories.base import BaseRepository


class ChecklistTemplateRepository(BaseRepository[ChecklistTemplate]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ChecklistTemplate)

    async def list_templates(
        self, clinic_id: uuid.UUID, active_only: bool = True
    ) -> list[ChecklistTemplate]:
        query = select(ChecklistTemplate).where(
            ChecklistTemplate.clinic_id == clinic_id
        )
        if active_only:
            query = query.where(ChecklistTemplate.is_active.is_(True))
        query = query.order_by(ChecklistTemplate.name)
        result = await self._session.execute(query)
        return list(result.scalars().all())


class ChecklistInstanceRepository(BaseRepository[ChecklistInstance]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ChecklistInstance)

    async def list_by_cycle(
        self, cycle_id: uuid.UUID
    ) -> list[ChecklistInstance]:
        result = await self._session.execute(
            select(ChecklistInstance).where(
                ChecklistInstance.cycle_id == cycle_id
            ).order_by(ChecklistInstance.created_at)
        )
        return list(result.scalars().all())

    async def get_items(
        self, instance_id: uuid.UUID
    ) -> list[ChecklistItemResponse]:
        result = await self._session.execute(
            select(ChecklistItemResponse).where(
                ChecklistItemResponse.checklist_instance_id == instance_id
            ).order_by(ChecklistItemResponse.item_index)
        )
        return list(result.scalars().all())
