import pytest
from httpx import AsyncClient

from ivf_lab.domain.models.clinic import Clinic
from ivf_lab.domain.models.user import User


async def _get_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/login",
        json={"email": "embryologist@test.com", "password": "testpass123"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_list_patients_empty(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    resp = await client.get(
        "/patients",
        params={"search": "nonexistent_xyz_999"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_patient(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    resp = await client.post(
        "/patients",
        json={"alias_code": "PAT-001", "notes": "Test patient"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["alias_code"] == "PAT-001"
    assert data["notes"] == "Test patient"
    assert data["clinic_id"] == str(test_user.clinic_id)
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_and_list(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    await client.post(
        "/patients",
        json={"alias_code": "PAT-LIST-TEST"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/patients",
        params={"search": "PAT-LIST-TEST"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    alias_codes = [p["alias_code"] for p in data]
    assert "PAT-LIST-TEST" in alias_codes


@pytest.mark.asyncio
async def test_update_patient_notes(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    create_resp = await client.post(
        "/patients",
        json={"alias_code": "PAT-UPDATE-TEST", "notes": "original notes"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 200
    patient_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/patients/{patient_id}",
        json={"notes": "updated notes"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["notes"] == "updated notes"
    assert patch_resp.json()["alias_code"] == "PAT-UPDATE-TEST"


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/patients")
    assert resp.status_code == 401
