from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ivf_lab.config.database import engine
from ivf_lab.config.settings import settings
from ivf_lab.domain.models.base import Base
from ivf_lab.infrastructure.api.auth import router as auth_router
from ivf_lab.infrastructure.api.cycles import router as cycles_router
from ivf_lab.infrastructure.api.embryos import router as embryos_router
from ivf_lab.infrastructure.api.audit import router as audit_router
from ivf_lab.infrastructure.api.checklists import router as checklists_router
from ivf_lab.infrastructure.api.export import router as export_router
from ivf_lab.infrastructure.api.patients import router as patients_router
from ivf_lab.infrastructure.api.storage import router as storage_router
from ivf_lab.infrastructure.api.users import router as users_router

# Import all models so Base.metadata knows about them
import ivf_lab.domain.models.user  # noqa: F401
import ivf_lab.domain.models.clinic  # noqa: F401
import ivf_lab.domain.models.patient_alias  # noqa: F401
import ivf_lab.domain.models.cycle  # noqa: F401
import ivf_lab.domain.models.embryo  # noqa: F401
import ivf_lab.domain.models.embryo_event  # noqa: F401
import ivf_lab.domain.models.checklist  # noqa: F401
import ivf_lab.domain.models.storage  # noqa: F401
import ivf_lab.domain.models.audit_log  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="IVF Lab Platform",
        version="0.1.0",
        description="B2B SaaS for IVF laboratories",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth_router)
    app.include_router(patients_router)
    app.include_router(cycles_router)
    app.include_router(embryos_router)
    app.include_router(checklists_router)
    app.include_router(storage_router)
    app.include_router(audit_router)
    app.include_router(users_router)
    app.include_router(export_router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
