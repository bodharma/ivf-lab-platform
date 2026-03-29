import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.storage import StorageLocation
from ivf_lab.domain.repositories.base import BaseRepository


class StorageRepository(BaseRepository[StorageLocation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, StorageLocation)

    async def list_roots(self, clinic_id: uuid.UUID) -> list[StorageLocation]:
        result = await self._session.execute(
            select(StorageLocation).where(
                StorageLocation.clinic_id == clinic_id,
                StorageLocation.parent_id.is_(None),
            )
        )
        return list(result.scalars().all())

    async def list_children(self, parent_id: uuid.UUID) -> list[StorageLocation]:
        result = await self._session.execute(
            select(StorageLocation).where(StorageLocation.parent_id == parent_id)
        )
        return list(result.scalars().all())

    async def list_all(self, clinic_id: uuid.UUID) -> list[StorageLocation]:
        result = await self._session.execute(
            select(StorageLocation).where(
                StorageLocation.clinic_id == clinic_id
            ).order_by(StorageLocation.name)
        )
        return list(result.scalars().all())
