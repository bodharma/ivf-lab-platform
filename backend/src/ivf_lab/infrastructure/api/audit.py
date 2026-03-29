import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.audit_log import AuditLog
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["audit"])

ALLOWED_ROLES = {"lab_manager", "clinic_admin"}


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    actor_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLogResponse]:
    if current_user["role"] not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    clinic_id = uuid.UUID(current_user["clinic_id"])
    query = select(AuditLog).where(AuditLog.clinic_id == clinic_id)

    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at <= date_to)

    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            actor_id=str(log.actor_id),
            action=str(log.action),
            resource_type=log.resource_type,
            resource_id=str(log.resource_id),
            changes=log.changes,
            ip_address=str(log.ip_address) if log.ip_address else None,
            request_id=str(log.request_id) if log.request_id else None,
            created_at=log.created_at,
        )
        for log in logs
    ]
