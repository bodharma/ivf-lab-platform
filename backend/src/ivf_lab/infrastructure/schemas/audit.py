from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    actor_id: str
    action: str
    resource_type: str
    resource_id: str
    changes: dict | None
    ip_address: str | None
    request_id: str | None
    created_at: datetime
