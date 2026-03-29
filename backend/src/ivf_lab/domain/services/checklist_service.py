"""Checklist business logic: create instances from templates, complete items."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.checklist import (
    ChecklistInstance,
    ChecklistItemResponse,
    ChecklistTemplate,
)
from ivf_lab.domain.repositories.checklist_repo import (
    ChecklistInstanceRepository,
)


async def create_instance(
    session: AsyncSession,
    clinic_id: uuid.UUID,
    cycle_id: uuid.UUID,
    template_id: uuid.UUID,
    embryo_id: uuid.UUID | None = None,
) -> ChecklistInstance:
    """Create a new checklist instance from a template."""
    template = await session.get(ChecklistTemplate, template_id)
    if not template:
        raise ValueError("Checklist template not found")

    instance = ChecklistInstance(
        clinic_id=clinic_id,
        template_id=template_id,
        cycle_id=cycle_id,
        embryo_id=embryo_id,
        status="pending",
    )
    session.add(instance)
    await session.flush()
    return instance


async def complete_item(
    session: AsyncSession,
    clinic_id: uuid.UUID,
    instance_id: uuid.UUID,
    item_index: int,
    value: dict,
    user_id: uuid.UUID,
) -> ChecklistItemResponse:
    """Complete a checklist item and update instance status."""
    instance = await session.get(ChecklistInstance, instance_id)
    if not instance:
        raise ValueError("Checklist instance not found")

    now = datetime.now(timezone.utc)

    # Mark instance as in_progress if pending
    if instance.status == "pending":
        instance.status = "in_progress"
        instance.started_at = now

    # Create item response
    item_response = ChecklistItemResponse(
        clinic_id=clinic_id,
        checklist_instance_id=instance_id,
        item_index=item_index,
        value=value if isinstance(value, dict) else {"value": value},
        completed_by=user_id,
        completed_at=now,
    )
    session.add(item_response)
    await session.flush()

    # Check if all items are completed
    repo = ChecklistInstanceRepository(session)
    completed_items = await repo.get_items(instance_id)
    template = await session.get(ChecklistTemplate, instance.template_id)

    if template and len(completed_items) >= len(template.items):
        instance.status = "completed"
        instance.completed_at = now
        instance.completed_by = user_id

    return item_response
