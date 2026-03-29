import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.user import User
from ivf_lab.domain.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    async def find_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.email == email, User.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def list_users(self, clinic_id: uuid.UUID) -> list[User]:
        result = await self._session.execute(
            select(User)
            .where(User.clinic_id == clinic_id)
            .order_by(User.full_name)
        )
        return list(result.scalars().all())
