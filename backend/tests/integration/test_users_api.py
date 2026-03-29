import uuid

import pytest
import pytest_asyncio
from collections.abc import AsyncGenerator
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ivf_lab.config.settings import settings
from ivf_lab.domain.models.clinic import Clinic
from ivf_lab.domain.models.user import User
from ivf_lab.infrastructure.auth.password import hash_password


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def admin_user(test_clinic: Clinic) -> AsyncGenerator[User, None]:
    factory = _make_session_factory()
    user = User(
        id=uuid.uuid4(),
        clinic_id=test_clinic.id,
        email="admin@test.com",
        password_hash=hash_password("adminpass123"),
        full_name="Test Admin",
        role="clinic_admin",
        is_active=True,
    )
    async with factory() as sess:
        sess.add(user)
        await sess.commit()

    yield user

    async with factory() as sess:
        await sess.execute(delete(User).where(User.id == user.id))
        await sess.commit()


async def _get_admin_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/login",
        json={"email": "admin@test.com", "password": "adminpass123"},
    )
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


async def _get_embryologist_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/login",
        json={"email": "embryologist@test.com", "password": "testpass123"},
    )
    assert resp.status_code == 200, f"Embryologist login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_list_users(
    client: AsyncClient,
    admin_user: User,
    test_user: User,
) -> None:
    token = await _get_admin_token(client)
    resp = await client.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    emails = [u["email"] for u in data]
    assert "admin@test.com" in emails
    assert "embryologist@test.com" in emails


@pytest.mark.asyncio
async def test_create_user(
    client: AsyncClient,
    admin_user: User,
) -> None:
    token = await _get_admin_token(client)
    resp = await client.post(
        "/users",
        json={
            "email": "newembryo@test.com",
            "password": "newpass123",
            "full_name": "New Embryologist",
            "role": "embryologist",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "newembryo@test.com"
    assert data["full_name"] == "New Embryologist"
    assert data["role"] == "embryologist"
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_update_user_role(
    client: AsyncClient,
    admin_user: User,
    test_user: User,
) -> None:
    token = await _get_admin_token(client)
    resp = await client.patch(
        f"/users/{test_user.id}",
        json={"role": "senior_embryologist"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "senior_embryologist"
    assert data["id"] == str(test_user.id)


@pytest.mark.asyncio
async def test_non_admin_forbidden(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_embryologist_token(client)
    resp = await client.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
