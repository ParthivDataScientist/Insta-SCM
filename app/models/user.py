from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlmodel import Field, Relationship
from sqlalchemy import Column, String
from .base import AuditMixin

if TYPE_CHECKING:
    from .dashboard_project import DashboardProject


class User(AuditMixin, table=True):
    """Consolidated User model for both standard users and project managers."""
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str = Field(
        sa_column=Column(String(255), index=True, nullable=False),
        description="Full display name of the user."
    )
    email: str = Field(
        sa_column=Column(String(255), unique=True, index=True, nullable=False),
        description="Primary identifier and contact email."
    )
    hashed_password: str = Field(
        sa_column=Column(String(255), nullable=False),
        description="Securely hashed password string."
    )
    role: str = Field(
        default="VIEWER",
        sa_column=Column(String(50), nullable=False),
        description="User permission level (e.g., ADMIN, PROJECT_MANAGER, VIEWER)."
    )
    is_active: bool = Field(default=True, description="Status flag for account enabling.")
    tenant_id: str = Field(default="gordian", index=True, description="Tenant identification slug (e.g., gordian, insta)")

    # Security & Recovery
    mfa_secret: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
        description="TOTP secret base32"
    )
    mfa_enabled: bool = Field(default=False, description="Is MFA required for this user")
    failed_login_attempts: int = Field(default=0, description="Counter for brute-force prevention")
    locked_until: Optional[datetime] = Field(default=None, description="Account lockout expiry timestamp")
    reset_token: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
        description="Password reset hash"
    )
    reset_token_expires: Optional[datetime] = Field(default=None, description="Password reset hash expiry")


    # Relationships
    managed_projects: List["DashboardProject"] = Relationship(back_populates="manager")
