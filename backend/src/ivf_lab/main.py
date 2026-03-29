from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(
        title="IVF Lab Platform",
        version="0.1.0",
        description="B2B SaaS for IVF laboratories",
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
