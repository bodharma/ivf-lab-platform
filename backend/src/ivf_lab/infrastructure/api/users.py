import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.models.user import User
from ivf_lab.domain.repositories.user_repo import UserRepository
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.auth.password import hash_password
from ivf_lab.infrastructure.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _require_clinic_admin(current_user: dict) -> None:
    if current_user["role"] != "clinic_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="clinic_admin role required",
        )


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("", response_model=list[UserResponse])
async def list_users(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> list[UserResponse]:
    _require_clinic_admin(current_user)
    repo = UserRepository(session)
    clinic_id = uuid.UUID(current_user["clinic_id"])
    users = await repo.list_users(clinic_id)
    return [_user_to_response(u) for u in users]


@router.post("", response_model=UserResponse)
async def create_user(
    body: UserCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserResponse:
    _require_clinic_admin(current_user)
    repo = UserRepository(session)
    clinic_id = uuid.UUID(current_user["clinic_id"])
    user = User(
        id=uuid.uuid4(),
        clinic_id=clinic_id,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        is_active=True,
    )
    created = await repo.create(user)
    return _user_to_response(created)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserResponse:
    _require_clinic_admin(current_user)
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent self-deactivation
    if body.is_active is False and str(user.id) == current_user["sub"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active

    await session.flush()
    return _user_to_response(user)
