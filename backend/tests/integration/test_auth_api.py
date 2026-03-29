import pytest
from httpx import AsyncClient

from ivf_lab.domain.models.user import User


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/login",
        json={"email": "wrong@test.com", "password": "wrong"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient) -> None:
    response = await client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_valid_credentials(client: AsyncClient, test_user: User) -> None:
    response = await client.post(
        "/auth/login",
        json={"email": test_user.email, "password": "testpass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_with_valid_token(client: AsyncClient, test_user: User) -> None:
    login_resp = await client.post(
        "/auth/login",
        json={"email": test_user.email, "password": "testpass123"},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]

    response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_refresh_with_invalid_token(client: AsyncClient) -> None:
    response = await client.post("/auth/refresh", json={"refresh_token": "not-a-valid-token"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_with_valid_token(client: AsyncClient, test_user: User) -> None:
    login_resp = await client.post(
        "/auth/login",
        json={"email": test_user.email, "password": "testpass123"},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]

    response = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_user.id)
    assert data["role"] == test_user.role
