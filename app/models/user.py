from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, Relationship
from sqlalchemy import Column, String
from .base import AuditMixin

class User(AuditMixin, table=True):
    """Consolidated User model for both standard users and project managers."""
    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str = Field(index=True, description="Full display name of the user.")
    email: str = Field(
        sa_column=Column(String, unique=True, index=True, nullable=False),
        description="Primary identifier and contact email."
    )
    hashed_password: str = Field(description="Securely hashed password string.")
    role: str = Field(default="VIEWER", description="User permission level (e.g., ADMIN, PROJECT_MANAGER, VIEWER).")
    is_active: bool = Field(default=True, description="Status flag for account enabling.")

    # Security & Recovery
    mfa_secret: Optional[str] = Field(default=None, description="TOTP secret base32")
    mfa_enabled: bool = Field(default=False, description="Is MFA required for this user")
    failed_login_attempts: int = Field(default=0, description="Counter for brute-force prevention")
    locked_until: Optional[datetime] = Field(default=None, description="Account lockout expiry timestamp")
    reset_token: Optional[str] = Field(default=None, description="Password reset hash")
    reset_token_expires: Optional[datetime] = Field(default=None, description="Password reset hash expiry")


    # Relationships
    managed_projects: List["DashboardProject"] = Relationship(back_populates="manager")
