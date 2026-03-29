"""Integration tests for Embryo CRUD and event recording API."""

import uuid
from datetime import date, datetime, timezone, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ivf_lab.config.settings import settings
from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
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


async def _set_insemination_time(
    clinic_id: uuid.UUID,
    cycle_id: str,
    insemination_time: datetime,
) -> None:
    """Directly update cycle insemination_time via DB."""
    factory = _make_session_factory()
    async with factory() as sess:
        cycle = await sess.get(Cycle, uuid.UUID(cycle_id))
        assert cycle is not None
        assert str(cycle.clinic_id) == str(clinic_id)
        cycle.insemination_time = insemination_time
        await sess.commit()


@pytest.mark.asyncio
async def test_create_embryo(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-CREATE-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-CREATE-001")

    resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": "E-001", "source": "fresh"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Create embryo failed: {resp.text}"
    data = resp.json()
    assert data["embryo_code"] == "E-001"
    assert data["source"] == "fresh"
    assert data["disposition"] == "in_culture"
    assert data["cycle_id"] == cycle_id
    assert data["storage_location_id"] is None
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_list_embryos_by_cycle(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-LIST-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-LIST-001")

    # Create two embryos
    for code in ["E-L01", "E-L02"]:
        resp = await client.post(
            f"/cycles/{cycle_id}/embryos",
            json={"embryo_code": code},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    list_resp = await client.get(
        f"/cycles/{cycle_id}/embryos",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    embryos = list_resp.json()
    assert isinstance(embryos, list)
    codes = [e["embryo_code"] for e in embryos]
    assert "E-L01" in codes
    assert "E-L02" in codes


@pytest.mark.asyncio
async def test_record_fertilization_event(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-FERT-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-FERT-001")

    embryo_resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": "E-FERT-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert embryo_resp.status_code == 200
    embryo_id = embryo_resp.json()["id"]

    observed_at = datetime.now(tz=timezone.utc).isoformat()
    event_resp = await client.post(
        f"/embryos/{embryo_id}/events",
        json={
            "event_type": "fertilization_check",
            "event_day": 1,
            "observed_at": observed_at,
            "data": {"pronuclei": "2pn", "polar_bodies": 2},
            "notes": "Normal fertilization",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert event_resp.status_code == 200, f"Record event failed: {event_resp.text}"
    ev = event_resp.json()
    assert ev["event_type"] == "fertilization_check"
    assert ev["event_day"] == 1
    assert ev["data"]["pronuclei"] == "2pn"
    assert ev["embryo_id"] == embryo_id
    assert ev["performed_by"] == str(test_user.id)


@pytest.mark.asyncio
async def test_record_blastocyst_grade(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-BLAST-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-BLAST-001")

    embryo_resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": "E-BLAST-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert embryo_resp.status_code == 200
    embryo_id = embryo_resp.json()["id"]

    observed_at = datetime.now(tz=timezone.utc).isoformat()
    event_resp = await client.post(
        f"/embryos/{embryo_id}/events",
        json={
            "event_type": "blastocyst_grade",
            "event_day": 5,
            "observed_at": observed_at,
            "data": {"expansion": 4, "icm": "A", "te": "B"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert event_resp.status_code == 200, f"Record blastocyst event failed: {event_resp.text}"
    ev = event_resp.json()
    assert ev["event_type"] == "blastocyst_grade"
    assert ev["event_day"] == 5
    assert ev["data"]["expansion"] == 4
    assert ev["data"]["icm"] == "A"
    assert ev["data"]["te"] == "B"


@pytest.mark.asyncio
async def test_record_disposition_change(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-DISP-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-DISP-001")

    embryo_resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": "E-DISP-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert embryo_resp.status_code == 200
    embryo_id = embryo_resp.json()["id"]
    # Default disposition is in_culture
    assert embryo_resp.json()["disposition"] == "in_culture"

    observed_at = datetime.now(tz=timezone.utc).isoformat()
    event_resp = await client.post(
        f"/embryos/{embryo_id}/events",
        json={
            "event_type": "disposition_change",
            "event_day": 5,
            "observed_at": observed_at,
            "data": {"from": "in_culture", "to": "vitrified", "reason": "excess embryo"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert event_resp.status_code == 200, f"Disposition change failed: {event_resp.text}"
    ev = event_resp.json()
    assert ev["event_type"] == "disposition_change"
    assert ev["data"]["to"] == "vitrified"

    # Verify embryo disposition updated
    embryo_detail = await client.get(
        f"/embryos/{embryo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert embryo_detail.status_code == 200
    assert embryo_detail.json()["disposition"] == "vitrified"


@pytest.mark.asyncio
async def test_get_embryo_with_events(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-WEVT-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-WEVT-001")

    embryo_resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": "E-WEVT-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert embryo_resp.status_code == 200
    embryo_id = embryo_resp.json()["id"]

    # Record two events
    for event_type, day, data in [
        ("fertilization_check", 1, {"pronuclei": "2pn", "polar_bodies": 2}),
        ("cleavage_grade", 2, {"cell_count": 4, "fragmentation": 1, "symmetry": "even", "multinucleation": False}),
    ]:
        resp = await client.post(
            f"/embryos/{embryo_id}/events",
            json={
                "event_type": event_type,
                "event_day": day,
                "observed_at": datetime.now(tz=timezone.utc).isoformat(),
                "data": data,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    # Get events list
    events_resp = await client.get(
        f"/embryos/{embryo_id}/events",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert events_resp.status_code == 200
    events = events_resp.json()
    assert len(events) == 2
    event_types = [e["event_type"] for e in events]
    assert "fertilization_check" in event_types
    assert "cleavage_grade" in event_types

    # Get embryo detail (GET /embryos/{id})
    detail_resp = await client.get(
        f"/embryos/{embryo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == embryo_id


@pytest.mark.asyncio
async def test_time_hpi_computed(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-HPI-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-HPI-001")

    # Set insemination_time to 18 hours ago
    insemination_time = datetime.now(tz=timezone.utc) - timedelta(hours=18)
    await _set_insemination_time(test_user.clinic_id, cycle_id, insemination_time)

    embryo_resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": "E-HPI-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert embryo_resp.status_code == 200
    embryo_id = embryo_resp.json()["id"]

    observed_at = datetime.now(tz=timezone.utc)
    event_resp = await client.post(
        f"/embryos/{embryo_id}/events",
        json={
            "event_type": "fertilization_check",
            "event_day": 1,
            "observed_at": observed_at.isoformat(),
            "data": {"pronuclei": "2pn", "polar_bodies": 2},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert event_resp.status_code == 200, f"Record event failed: {event_resp.text}"
    ev = event_resp.json()
    # HPI should be ~18 hours
    assert ev["time_hpi"] is not None
    assert 17.0 <= ev["time_hpi"] <= 19.0, f"Expected HPI ~18, got {ev['time_hpi']}"


@pytest.mark.asyncio
async def test_invalid_disposition_transition(
    client: AsyncClient,
    test_user: User,
) -> None:
    token = await _get_token(client)
    patient_id = await _create_patient(client, token, "PAT-EMB-INVD-001")
    cycle_id = await _create_cycle(client, token, patient_id, "CYC-EMB-INVD-001")

    embryo_resp = await client.post(
        f"/cycles/{cycle_id}/embryos",
        json={"embryo_code": "E-INVD-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert embryo_resp.status_code == 200
    embryo_id = embryo_resp.json()["id"]

    # transferred -> vitrified is invalid
    event_resp = await client.post(
        f"/embryos/{embryo_id}/events",
        json={
            "event_type": "disposition_change",
            "event_day": 5,
            "observed_at": datetime.now(tz=timezone.utc).isoformat(),
            "data": {"from": "transferred", "to": "vitrified"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert event_resp.status_code == 422, f"Expected 422, got {event_resp.status_code}: {event_resp.text}"


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient) -> None:
    fake_id = uuid.uuid4()
    resp = await client.get(f"/cycles/{fake_id}/embryos")
    assert resp.status_code == 401

    resp = await client.post(f"/cycles/{fake_id}/embryos", json={})
    assert resp.status_code == 401

    resp = await client.get(f"/embryos/{fake_id}")
    assert resp.status_code == 401

    resp = await client.get(f"/embryos/{fake_id}/events")
    assert resp.status_code == 401

    resp = await client.post(f"/embryos/{fake_id}/events", json={})
    assert resp.status_code == 401
