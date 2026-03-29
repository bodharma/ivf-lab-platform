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
    # SET LOCAL does not support parameterized queries in asyncpg.
    # Validate clinic_id is a valid UUID to prevent injection, then interpolate.
    import uuid as _uuid

    clinic_id_str = str(payload["clinic_id"])
    _uuid.UUID(clinic_id_str)  # Raises ValueError if not a valid UUID
    await session.execute(text(f"SET LOCAL app.current_clinic_id = '{clinic_id_str}'"))
    return payload
