from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "IVF_"}

    # App
    debug: bool = False
    secret_key: str = "change-me-in-production"
    allowed_origins: list[str] = ["http://localhost:5173"]

    # Database
    database_url: str = "postgresql+asyncpg://ivf_app:ivf_pass@localhost:5432/ivf_lab"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # Auth
    bcrypt_rounds: int = 12
    max_login_attempts: int = 5
    lockout_minutes: int = 15


settings = Settings()
