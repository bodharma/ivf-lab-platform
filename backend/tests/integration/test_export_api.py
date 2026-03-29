"""Integration tests for CSV export endpoints."""

import uuid
from datetime import date, datetime, timezone, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ivf_lab.config.settings import settings
from ivf_lab.domain.models.cycle import Cycle
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


async def _create_patient(client: AsyncClient, token: str, alias_code: str) -> str:
    resp = await client.post(
        "/patients",
        json={"alias_code": alias_code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Create patient failed: {resp.text}"
    return resp.json()["id"]


async def _create_cycle(
    client: AsyncClient, token: str, patient_id: str, cycle_code: str
) -> str:
    resp = await client.post(
        "/cycles",
        json={
            "patient_alias_id": patient_id,
            "cycle_code": cycle_code,
            "cycle_type": "fresh_ivf",
            "start_date": str(date.today()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Create cycle failed: {resp.text}"
    return resp.json()["id"]


async def _create_embryo(client: AsyncClient, token: str, cycle_id: str, embryo_code: str) -> str:
    resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": embryo_code, "source": "fresh"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Create embryo failed: {resp.text}"
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_export_cycles_csv(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EXP-CYC-001")
    await _create_cycle(client, token, patient_id, "CYC-EXPORT-001")

    resp = await client.get(
        "/export/cycles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")

    content = resp.text
    lines = content.strip().splitlines()
    assert len(lines) >= 2, "Expected header + at least one data row"

    header = lines[0]
    assert "cycle_code" in header
    assert "patient_alias_code" in header
    assert "cycle_type" in header
    assert "status" in header
    assert "total_embryos" in header

    # Verify our created cycle appears in the export
    cycle_codes = [line.split(",")[0] for line in lines[1:]]
    assert "CYC-EXPORT-001" in cycle_codes


@pytest.mark.asyncio
async def test_export_cycles_csv_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/export/cycles")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_embryos_csv(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EXP-EMB-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EXP-EMB-001")
    await _create_embryo(client, token, cycle_id, "E-EXP-001")
    await _create_embryo(client, token, cycle_id, "E-EXP-002")

    resp = await client.get(
        "/export/embryos",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")

    content = resp.text
    lines = content.strip().splitlines()
    assert len(lines) >= 3, "Expected header + at least 2 data rows"

    header = lines[0]
    assert "cycle_code" in header
    assert "embryo_code" in header
    assert "source" in header
    assert "disposition" in header
    assert "latest_grade_day" in header
    assert "latest_grade" in header

    embryo_codes = [line.split(",")[1] for line in lines[1:]]
    assert "E-EXP-001" in embryo_codes
    assert "E-EXP-002" in embryo_codes


@pytest.mark.asyncio
async def test_export_embryos_csv_filtered_by_cycle(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EXP-EMB-FILT-001")
    cycle_id_a = await _create_cycle(client, token, patient_id, "CYC-EXP-FILT-A")
    cycle_id_b = await _create_cycle(client, token, patient_id, "CYC-EXP-FILT-B")
    await _create_embryo(client, token, cycle_id_a, "E-FILT-A-001")
    await _create_embryo(client, token, cycle_id_b, "E-FILT-B-001")

    resp = await client.get(
        f"/export/embryos?cycle_id={cycle_id_a}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    content = resp.text
    assert "E-FILT-A-001" in content
    assert "E-FILT-B-001" not in content


@pytest.mark.asyncio
async def test_export_embryos_csv_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/export/embryos")
    assert resp.status_code == 401
