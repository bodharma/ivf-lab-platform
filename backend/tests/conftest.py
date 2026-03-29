import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ivf_lab.config.settings import settings
from ivf_lab.domain.models.clinic import Clinic
from ivf_lab.domain.models.cycle import Cycle
from ivf_lab.domain.models.embryo import Embryo
from ivf_lab.domain.models.embryo_event import EmbryoEvent
from ivf_lab.domain.models.patient_alias import PatientAlias
from ivf_lab.domain.models.user import User
from ivf_lab.infrastructure.auth.password import hash_password
from ivf_lab.infrastructure.api import deps
from ivf_lab.main import create_app


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create a session factory with NullPool so connections are not reused across event loops."""
    engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def _delete_clinic_data(sess: AsyncSession, clinic_id: uuid.UUID) -> None:
    """Delete all data for a clinic in correct FK dependency order."""
    await sess.execute(delete(EmbryoEvent).where(EmbryoEvent.clinic_id == clinic_id))
    await sess.execute(delete(Embryo).where(Embryo.clinic_id == clinic_id))
    await sess.execute(delete(Cycle).where(Cycle.clinic_id == clinic_id))
    await sess.execute(delete(PatientAlias).where(PatientAlias.clinic_id == clinic_id))
    await sess.execute(delete(User).where(User.clinic_id == clinic_id))
    await sess.execute(delete(Clinic).where(Clinic.id == clinic_id))


def pytest_configure(config: object) -> None:
    """Clean up stale test data before the test session starts.

    Runs before any fixtures or tests, in its own asyncio.run() call so it is
    completely independent of the per-test event loops managed by pytest-asyncio.
    """
    import asyncio

    async def _cleanup() -> None:
        factory = _make_session_factory()
        async with factory() as sess:
            result = await sess.execute(select(Clinic.id).where(Clinic.name == "Test Clinic"))
            clinic_ids = [row[0] for row in result.fetchall()]
            if clinic_ids:
                for cid in clinic_ids:
                    await _delete_clinic_data(sess, cid)
            # Also clean up any orphaned test users not covered by clinic deletion
            await sess.execute(delete(User).where(User.email == "embryologist@test.com"))
            await sess.commit()

    asyncio.run(_cleanup())


@pytest_asyncio.fixture
async def test_clinic() -> AsyncGenerator[Clinic, None]:
    factory = _make_session_factory()
    clinic_id = uuid.uuid4()
    clinic = Clinic(id=clinic_id, name="Test Clinic", timezone="UTC")

    async with factory() as sess:
        sess.add(clinic)
        await sess.commit()

    yield clinic

    async with factory() as sess:
        await _delete_clinic_data(sess, clinic_id)
        await sess.commit()


@pytest_asyncio.fixture
async def test_user(test_clinic: Clinic) -> AsyncGenerator[User, None]:
    factory = _make_session_factory()
    user = User(
        id=uuid.uuid4(),
        clinic_id=test_clinic.id,
        email="embryologist@test.com",
        password_hash=hash_password("testpass123"),
        full_name="Test Embryologist",
        role="embryologist",
        is_active=True,
    )
    async with factory() as sess:
        sess.add(user)
        await sess.commit()

    yield user

    # Delete embryo_events referencing this user first, then the user itself.
    # This runs before test_clinic teardown so there is never a window where
    # multiple test users with the same email exist simultaneously.
    async with factory() as sess:
        await sess.execute(delete(EmbryoEvent).where(EmbryoEvent.performed_by == user.id))
        await sess.execute(delete(User).where(User.id == user.id))
        await sess.commit()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    test_app = create_app()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        factory = _make_session_factory()
        async with factory() as sess:
            async with sess.begin():
                yield sess

    test_app.dependency_overrides[deps.get_db] = override_get_db

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    test_app.dependency_overrides.clear()
