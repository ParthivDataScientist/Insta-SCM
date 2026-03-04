from datetime import datetime, timedelta, timezone
from typing import Any, Union
import jwt
import bcrypt
from app.core.config import settings

ALGORITHM = "HS256"

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Default 8 hours if not configured
        expire = datetime.now(timezone.utc) + timedelta(minutes=getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 8))
    
    to_encode = {"exp": expire, "sub": str(subject)}
    
    # Needs a secret key from settings
    secret = getattr(settings, "JWT_SECRET_KEY", "fallback_secret_for_local_dev_only")
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
