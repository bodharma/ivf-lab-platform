from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ivf_lab.infrastructure.auth.jwt import decode_token


async def set_tenant_context(session: AsyncSession, token: str | None) -> dict | None:
    """Decode JWT and set RLS context on the DB session. Returns payload or None."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload or "clinic_id" not in payload:
        return None
    await session.execute(
        text("SET LOCAL app.current_clinic_id = :cid"),
        {"cid": payload["clinic_id"]},
    )
    return payload
