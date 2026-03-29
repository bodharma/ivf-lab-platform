import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.checklist import ChecklistTemplate
from ivf_lab.domain.repositories.checklist_repo import (
    ChecklistInstanceRepository,
    ChecklistTemplateRepository,
)
from ivf_lab.domain.services.checklist_service import complete_item, create_instance
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.checklist import (
    ChecklistInstanceCreate,
    ChecklistInstanceResponse,
    ChecklistItemComplete,
    ChecklistItemResponseData,
    ChecklistTemplateCreate,
    ChecklistTemplateResponse,
    ChecklistTemplateUpdate,
)

router = APIRouter(tags=["checklists"])

TEMPLATE_ROLES = {"lab_manager", "clinic_admin"}


def _template_to_response(t: ChecklistTemplate) -> ChecklistTemplateResponse:
    return ChecklistTemplateResponse(
        id=str(t.id),
        name=t.name,
        procedure_type=str(t.procedure_type),
        items=t.items,
        is_active=t.is_active,
        created_at=t.created_at,
    )


# --- Templates ---


@router.get("/checklist-templates", response_model=list[ChecklistTemplateResponse])
async def list_templates(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> list[ChecklistTemplateResponse]:
    repo = ChecklistTemplateRepository(session)
    templates = await repo.list_templates(uuid.UUID(current_user["clinic_id"]))
    return [_template_to_response(t) for t in templates]


@router.post("/checklist-templates", response_model=ChecklistTemplateResponse, status_code=201)
async def create_template(
    body: ChecklistTemplateCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ChecklistTemplateResponse:
    if current_user["role"] not in TEMPLATE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    template = ChecklistTemplate(
        clinic_id=uuid.UUID(current_user["clinic_id"]),
        name=body.name,
        procedure_type=body.procedure_type,
        items=body.items,
    )
    repo = ChecklistTemplateRepository(session)
    created = await repo.create(template)
    return _template_to_response(created)


@router.patch("/checklist-templates/{template_id}", response_model=ChecklistTemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    body: ChecklistTemplateUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ChecklistTemplateResponse:
    if current_user["role"] not in TEMPLATE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    repo = ChecklistTemplateRepository(session)
    template = await repo.get_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if body.name is not None:
        template.name = body.name
    if body.items is not None:
        template.items = body.items
    if body.is_active is not None:
        template.is_active = body.is_active
    await session.flush()
    return _template_to_response(template)


# --- Instances ---


@router.post("/cycles/{cycle_id}/checklists", response_model=ChecklistInstanceResponse, status_code=201)
async def create_checklist_instance(
    cycle_id: uuid.UUID,
    body: ChecklistInstanceCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ChecklistInstanceResponse:
    instance = await create_instance(
        session=session,
        clinic_id=uuid.UUID(current_user["clinic_id"]),
        cycle_id=cycle_id,
        template_id=uuid.UUID(body.template_id),
        embryo_id=uuid.UUID(body.embryo_id) if body.embryo_id else None,
    )
    return ChecklistInstanceResponse(
        id=str(instance.id),
        template_id=str(instance.template_id),
        cycle_id=str(instance.cycle_id),
        embryo_id=str(instance.embryo_id) if instance.embryo_id else None,
        status=str(instance.status),
        started_at=instance.started_at,
        completed_at=instance.completed_at,
        completed_by=str(instance.completed_by) if instance.completed_by else None,
        created_at=instance.created_at,
    )


@router.get("/cycles/{cycle_id}/checklists", response_model=list[ChecklistInstanceResponse])
async def list_cycle_checklists(
    cycle_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> list[ChecklistInstanceResponse]:
    repo = ChecklistInstanceRepository(session)
    instances = await repo.list_by_cycle(cycle_id)
    result = []
    for inst in instances:
        items = await repo.get_items(inst.id)
        result.append(
            ChecklistInstanceResponse(
                id=str(inst.id),
                template_id=str(inst.template_id),
                cycle_id=str(inst.cycle_id),
                embryo_id=str(inst.embryo_id) if inst.embryo_id else None,
                status=str(inst.status),
                started_at=inst.started_at,
                completed_at=inst.completed_at,
                completed_by=str(inst.completed_by) if inst.completed_by else None,
                created_at=inst.created_at,
                items=[
                    ChecklistItemResponseData(
                        item_index=item.item_index,
                        value=item.value,
                        completed_by=str(item.completed_by),
                        completed_at=item.completed_at,
                    )
                    for item in items
                ],
            )
        )
    return result


@router.get("/checklists/{checklist_id}", response_model=ChecklistInstanceResponse)
async def get_checklist(
    checklist_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ChecklistInstanceResponse:
    repo = ChecklistInstanceRepository(session)
    instance = await repo.get_by_id(checklist_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Checklist not found")
    items = await repo.get_items(checklist_id)
    return ChecklistInstanceResponse(
        id=str(instance.id),
        template_id=str(instance.template_id),
        cycle_id=str(instance.cycle_id),
        embryo_id=str(instance.embryo_id) if instance.embryo_id else None,
        status=str(instance.status),
        started_at=instance.started_at,
        completed_at=instance.completed_at,
        completed_by=str(instance.completed_by) if instance.completed_by else None,
        created_at=instance.created_at,
        items=[
            ChecklistItemResponseData(
                item_index=item.item_index,
                value=item.value,
                completed_by=str(item.completed_by),
                completed_at=item.completed_at,
            )
            for item in items
        ],
    )


@router.post("/checklists/{checklist_id}/items/{item_index}")
async def complete_checklist_item(
    checklist_id: uuid.UUID,
    item_index: int,
    body: ChecklistItemComplete,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    value = body.value if isinstance(body.value, dict) else {"value": body.value}
    await complete_item(
        session=session,
        clinic_id=uuid.UUID(current_user["clinic_id"]),
        instance_id=checklist_id,
        item_index=item_index,
        value=value,
        user_id=uuid.UUID(current_user["sub"]),
    )
    return {"status": "ok"}
