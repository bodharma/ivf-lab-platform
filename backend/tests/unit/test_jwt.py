from ivf_lab.infrastructure.auth.jwt import create_access_token, create_refresh_token, decode_token


def test_create_and_decode_access_token() -> None:
    token = create_access_token(
        user_id="user-123",
        clinic_id="clinic-456",
        role="embryologist",
    )
    assert isinstance(token, str)
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["clinic_id"] == "clinic-456"
    assert payload["role"] == "embryologist"
    assert "exp" in payload
    assert "iat" in payload


def test_invalid_token_returns_none() -> None:
    result = decode_token("this.is.garbage")
    assert result is None
