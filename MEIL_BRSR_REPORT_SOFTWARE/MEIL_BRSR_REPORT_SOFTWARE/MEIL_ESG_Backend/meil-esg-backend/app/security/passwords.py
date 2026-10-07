"""
Password hashing lives in its own module so routes/services never import argon2/bcrypt directly
— if the hasher changes, this is the only file that moves.
"""
from flask import current_app


def hash_password(plain: str) -> str:
    if current_app.config.get("PASSWORD_HASHER", "argon2") == "bcrypt":
        import bcrypt
        return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    from argon2 import PasswordHasher
    return PasswordHasher().hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    if current_app.config.get("PASSWORD_HASHER", "argon2") == "bcrypt":
        import bcrypt
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
        except ValueError:
            return False
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError, InvalidHash
    try:
        return PasswordHasher().verify(hashed, plain)
    except (VerifyMismatchError, InvalidHash):
        return False
