from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ivf_lab.domain.repositories.user_repo import UserRepository
from ivf_lab.domain.services.auth_service import AuthService
from ivf_lab.infrastructure.api.deps import get_current_user, get_db
from ivf_lab.infrastructure.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    service = AuthService(UserRepository(session))
    result = await service.login(body.email, body.password)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(**result)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest) -> TokenResponse:
    service = AuthService.__new__(AuthService)
    result = service.refresh(body.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=body.refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: Annotated[dict, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    import uuid

    repo = UserRepository(session)
    user = await repo.get_by_id(uuid.UUID(current_user["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=str(user.role),
        clinic_id=str(user.clinic_id),
    )
