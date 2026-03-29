from ivf_lab.domain.repositories.user_repo import UserRepository
from ivf_lab.infrastructure.auth.jwt import create_access_token, create_refresh_token, decode_token
from ivf_lab.infrastructure.auth.password import verify_password


class AuthService:
    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def login(self, email: str, password: str) -> dict | None:
        user = await self._user_repo.find_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            return None
        return {
            "access_token": create_access_token(
                user_id=str(user.id),
                clinic_id=str(user.clinic_id),
                role=user.role.value if hasattr(user.role, "value") else user.role,
            ),
            "refresh_token": create_refresh_token(user_id=str(user.id)),
        }

    def refresh(self, refresh_token: str) -> dict | None:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        return {
            "access_token": create_access_token(
                user_id=str(payload["sub"]),
                clinic_id="",
                role="",
            ),
        }
