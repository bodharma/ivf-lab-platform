from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.repositories.base import BaseRepository


class PatientRepository(BaseRepository[PatientAlias]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, PatientAlias)

    async def list_patients(
        self,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[PatientAlias]:
        query = select(PatientAlias)
        if search:
            query = query.where(PatientAlias.alias_code.ilike(f"%{search}%"))
        query = query.limit(limit).offset(offset)
        result = await self._session.execute(query)
        return list(result.scalars().all())
