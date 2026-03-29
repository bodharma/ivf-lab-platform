import bcrypt


def hash_password(raw: str) -> str:
    """Return a bcrypt hash (cost factor 12) of the given plaintext password."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(raw.encode(), salt).decode()


def verify_password(raw: str, hashed: str) -> bool:
    """Return True if raw matches the bcrypt hash, False otherwise."""
    return bcrypt.checkpw(raw.encode(), hashed.encode())
