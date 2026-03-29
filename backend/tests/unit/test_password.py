from ivf_lab.infrastructure.auth.password import hash_password, verify_password


def test_hash_and_verify() -> None:
    raw = "SuperSecret123!"
    hashed = hash_password(raw)
    assert hashed != raw
    assert hashed.startswith("$2b$")
    assert verify_password(raw, hashed) is True


def test_wrong_password() -> None:
    raw = "SuperSecret123!"
    hashed = hash_password(raw)
    assert verify_password("WrongPassword!", hashed) is False
