import uuid
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ivf_lab.config.settings import settings
from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.models.user import User


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def _get_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/auth/login",
        json={"email": "embryologist@test.com", "password": "testpass123"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


async def _create_patient_alias(client: AsyncClient, token: str, alias_code: str = "PAT-CYC-001") -> str:
    """Create a patient alias and return its ID."""
    resp = await client.post(
        "/patients",
        json={"alias_code": alias_code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Create patient failed: {resp.text}"
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_cycle(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient_alias(client, token, "PAT-CYC-CREATE-001")

    resp = await client.post(
        "/cycles",
        json={
            "patient_alias_id": patient_id,
            "cycle_code": "CYC-TEST-001",
            "cycle_type": "fresh_ivf",
            "start_date": str(date.today()),
            "notes": "Test cycle",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Create cycle failed: {resp.text}"
    data = resp.json()
    assert data["cycle_code"] == "CYC-TEST-001"
    assert data["cycle_type"] == "fresh_ivf"
    assert data["status"] == "planned"
    assert data["patient_alias_id"] == patient_id
    assert data["notes"] == "Test cycle"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_list_cycles(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient_alias(client, token, "PAT-CYC-LIST-001")

    create_resp = await client.post(
        "/cycles",
        json={
            "patient_alias_id": patient_id,
            "cycle_code": "CYC-LIST-TEST",
            "cycle_type": "fresh_icsi",
            "start_date": str(date.today()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 200, f"Create cycle failed: {create_resp.text}"

    resp = await client.get(
        "/cycles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    cycle_codes = [c["cycle_code"] for c in data]
    assert "CYC-LIST-TEST" in cycle_codes


@pytest.mark.asyncio
async def test_get_cycle_detail(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient_alias(client, token, "PAT-CYC-DETAIL-001")

    create_resp = await client.post(
        "/cycles",
        json={
            "patient_alias_id": patient_id,
            "cycle_code": "CYC-DETAIL-TEST",
            "cycle_type": "fet",
            "start_date": str(date.today()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 200, f"Create cycle failed: {create_resp.text}"
    cycle_id = create_resp.json()["id"]

    resp = await client.get(
        f"/cycles/{cycle_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == cycle_id
    assert "embryos" in data
    assert "summary" in data
    assert isinstance(data["embryos"], list)
    assert isinstance(data["summary"], dict)
    assert "total_embryos" in data["summary"]


@pytest.mark.asyncio
async def test_transition_planned_to_active(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient_alias(client, token, "PAT-CYC-TRANS-001")

    create_resp = await client.post(
        "/cycles",
        json={
            "patient_alias_id": patient_id,
            "cycle_code": "CYC-TRANS-TEST",
            "cycle_type": "fresh_ivf",
            "start_date": str(date.today()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 200, f"Create cycle failed: {create_resp.text}"
    cycle_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "planned"

    patch_resp = await client.patch(
        f"/cycles/{cycle_id}",
        json={"status": "active"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200, f"Transition failed: {patch_resp.text}"
    assert patch_resp.json()["status"] == "active"


@pytest.mark.asyncio
async def test_invalid_transition(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient_alias(client, token, "PAT-CYC-INVALID-001")

    create_resp = await client.post(
        "/cycles",
        json={
            "patient_alias_id": patient_id,
            "cycle_code": "CYC-INVALID-TRANS",
            "cycle_type": "fresh_ivf",
            "start_date": str(date.today()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 200, f"Create cycle failed: {create_resp.text}"
    cycle_id = create_resp.json()["id"]

    # planned -> completed is not a valid transition
    patch_resp = await client.patch(
        f"/cycles/{cycle_id}",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 400
    assert "completed" in patch_resp.json()["detail"].lower() or "transition" in patch_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_today(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)

    resp = await client.get(
        "/cycles/today",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "date" in data
    assert "cycles" in data
    assert isinstance(data["cycles"], list)


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/cycles")
    assert resp.status_code == 401

    resp = await client.get("/cycles/today")
    assert resp.status_code == 401

    resp = await client.post("/cycles", json={})
    assert resp.status_code == 401

    resp = await client.get(f"/cycles/{uuid.uuid4()}")
    assert resp.status_code == 401
