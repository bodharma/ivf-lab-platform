"""Integration tests for GET /cycles/week endpoint."""

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
            "cycle_type": "fresh_icsi",
            "start_date": str(date.today()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Create cycle failed: {resp.text}"
    return resp.json()["id"]


async def _activate_cycle_with_insemination(
    client: AsyncClient,
    token: str,
    cycle_id: str,
    insemination_time: datetime,
) -> None:
    """Activate a cycle and set its insemination time."""
    patch_resp = await client.patch(
        f"/cycles/{cycle_id}",
        json={
            "status": "active",
            "insemination_time": insemination_time.isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200, f"Activate cycle failed: {patch_resp.text}"


@pytest.mark.asyncio
async def test_week_view_returns_list(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)

    resp = await client.get(
        "/cycles/week",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    for entry in data:
        assert "date" in entry
        assert "cycles" in entry
        assert isinstance(entry["cycles"], list)


@pytest.mark.asyncio
async def test_week_view_cycle_appears_on_assessment_day(
    client: AsyncClient,
    test_user: User,
) -> None:
    """A cycle inseminated today should appear on Day 1 (today)."""
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-WEEK-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-WEEK-001")

    # Inseminate today so Day 1 falls on today
    insemination_time = datetime.now(tz=timezone.utc)
    await _activate_cycle_with_insemination(client, token, cycle_id, insemination_time)

    resp = await client.get(
        "/cycles/week",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    today_str = str(date.today())
    today_entry = next((e for e in data if e["date"] == today_str), None)
    assert today_entry is not None, f"Expected an entry for today ({today_str}) but got: {[e['date'] for e in data]}"
    cycle_codes = [c["cycle_code"] for c in today_entry["cycles"]]
    assert "CYC-WEEK-001" in cycle_codes


@pytest.mark.asyncio
async def test_week_view_cycle_not_shown_without_insemination_time(
    client: AsyncClient,
    test_user: User,
) -> None:
    """An active cycle without insemination_time should not appear in week view."""
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-WEEK-NO-INS-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-WEEK-NO-INS-001")

    # Activate without insemination time
    patch_resp = await client.patch(
        f"/cycles/{cycle_id}",
        json={"status": "active"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200

    resp = await client.get(
        "/cycles/week",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    all_cycle_codes = [
        c["cycle_code"]
        for entry in data
        for c in entry["cycles"]
    ]
    assert "CYC-WEEK-NO-INS-001" not in all_cycle_codes


@pytest.mark.asyncio
async def test_week_view_planned_cycle_not_shown(
    client: AsyncClient,
    test_user: User,
) -> None:
    """A planned (not active) cycle should not appear in week view."""
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-WEEK-PLAN-001")
    await _create_cycle(client, token, patient_id, "CYC-WEEK-PLAN-001")

    resp = await client.get(
        "/cycles/week",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    all_cycle_codes = [
        c["cycle_code"]
        for entry in data
        for c in entry["cycles"]
    ]
    assert "CYC-WEEK-PLAN-001" not in all_cycle_codes


@pytest.mark.asyncio
async def test_week_view_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/cycles/week")
    assert resp.status_code == 401
