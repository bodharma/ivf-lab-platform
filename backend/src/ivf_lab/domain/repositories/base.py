import uuid
from typing import Generic, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, id: uuid.UUID) -> T | None:
        return await self._session.get(self._model, id)

    async def create(self, entity: T) -> T:
        self._session.add(entity)
        await self._session.flush()
        return entity
