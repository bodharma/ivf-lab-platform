from collections.abc import AsyncGenerator
from typing import Annotated
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ivf_lab.config.database import async_session_factory
from ivf_lab.infrastructure.middleware.tenant import set_tenant_context


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        async with session.begin():
            yield session


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_db)],
    authorization: str | None = Header(None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )
    token = authorization.removeprefix("Bearer ")
    payload = await set_tenant_context(session, token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload
