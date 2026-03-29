from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ivf_lab.config.settings import settings
from ivf_lab.infrastructure.api.auth import router as auth_router
from ivf_lab.infrastructure.api.patients import router as patients_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="IVF Lab Platform",
        version="0.1.0",
        description="B2B SaaS for IVF laboratories",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth_router)
    app.include_router(patients_router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
