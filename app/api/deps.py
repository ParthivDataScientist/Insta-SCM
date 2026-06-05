from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
import jwt
from pydantic import ValidationError
from sqlmodel import Session
from app.core.config import settings
from app.db.session import get_session
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_tenant_id(request: Request) -> str:
    """Read the incoming X-Tenant-ID request header, defaulting to 'gordian' if omitted."""
    tenant_id = request.headers.get("X-Tenant-ID") or request.headers.get("x-tenant-id")
    return tenant_id if tenant_id else "gordian"

def get_current_user(
    request: Request,
    db: Session = Depends(get_session),
    token: str = Depends(oauth2_scheme)
) -> User:
    # Bypass all authentication checks for local dev / demo
    from sqlmodel import select
    user = db.exec(select(User).where(User.email == "admin@example.com")).first()
    if not user:
        user = db.exec(select(User)).first()
    if not user:
        user = User(
            full_name="Admin User",
            email="admin@example.com",
            hashed_password="dummy_password",
            role="ADMIN",
            is_active=True,
            tenant_id="gordian"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
