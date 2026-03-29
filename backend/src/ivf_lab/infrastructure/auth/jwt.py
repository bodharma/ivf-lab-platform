from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from ivf_lab.config.settings import settings


def create_access_token(
    user_id: str,
    clinic_id: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token with user/clinic/role claims."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": user_id,
        "clinic_id": clinic_id,
        "role": role,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    """Create a signed JWT refresh token (subject only, no role/clinic)."""
    now = datetime.now(UTC)
    expires_delta = timedelta(days=settings.jwt_refresh_token_expire_days)
    payload: dict[str, object] = {
        "sub": user_id,
        "type": "refresh",
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, object] | None:
    """Decode and validate a JWT token. Returns the payload dict or None if invalid/expired."""
    try:
        payload: dict[str, object] = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError:
        return None
