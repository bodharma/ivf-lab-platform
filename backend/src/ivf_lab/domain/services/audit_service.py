"""Append-only audit logging service."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.audit_log import AuditLog
from ivf_lab.domain.models.enums import AuditAction


async def log_audit(
    session: AsyncSession,
    clinic_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: AuditAction,
    resource_type: str,
    resource_id: uuid.UUID,
    changes: dict | None = None,
    ip_address: str | None = None,
    request_id: uuid.UUID | None = None,
) -> None:
    """Write an immutable audit log entry."""
    entry = AuditLog(
        clinic_id=clinic_id,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        changes=changes,
        ip_address=ip_address,
        request_id=request_id,
    )
    session.add(entry)
    await session.flush()
