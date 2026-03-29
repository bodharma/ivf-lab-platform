import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.storage import StorageLocation
from ivf_lab.domain.repositories.storage_repo import StorageRepository
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.storage import (
    StorageCreate,
    StorageResponse,
    StorageTreeResponse,
)

router = APIRouter(prefix="/storage", tags=["storage"])


def _to_response(loc: StorageLocation) -> StorageResponse:
    return StorageResponse(
        id=str(loc.id),
        parent_id=str(loc.parent_id) if loc.parent_id else None,
        name=loc.name,
        location_type=str(loc.location_type),
        is_managed=loc.is_managed,
        capacity=loc.capacity,
        created_at=loc.created_at,
    )


def _build_tree(
    locations: list[StorageLocation], parent_id: uuid.UUID | None = None
) -> list[StorageTreeResponse]:
    children = [loc for loc in locations if loc.parent_id == parent_id]
    return [
        StorageTreeResponse(
            id=str(loc.id),
            name=loc.name,
            location_type=str(loc.location_type),
            is_managed=loc.is_managed,
            capacity=loc.capacity,
            children=_build_tree(locations, loc.id),
        )
        for loc in children
    ]


@router.get("", response_model=list[StorageTreeResponse])
async def list_storage(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> list[StorageTreeResponse]:
    repo = StorageRepository(session)
    all_locs = await repo.list_all(uuid.UUID(current_user["clinic_id"]))
    return _build_tree(all_locs)


@router.get("/{location_id}", response_model=StorageResponse)
async def get_storage(
    location_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> StorageResponse:
    repo = StorageRepository(session)
    loc = await repo.get_by_id(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found")
    return _to_response(loc)


@router.post("", response_model=StorageResponse, status_code=201)
async def create_storage(
    body: StorageCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> StorageResponse:
    loc = StorageLocation(
        clinic_id=uuid.UUID(current_user["clinic_id"]),
        parent_id=uuid.UUID(body.parent_id) if body.parent_id else None,
        name=body.name,
        location_type=body.location_type,
        is_managed=body.is_managed,
        capacity=body.capacity,
    )
    repo = StorageRepository(session)
    created = await repo.create(loc)
    return _to_response(created)
