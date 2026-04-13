from __future__ import annotations

import os
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from project root (one level above app/)
_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_ENV_PATH = os.path.join(_ROOT_DIR, ".env")

_DEV_JWT_PLACEHOLDER = "super_secret_dev_key_change_in_production"


class Settings(BaseSettings):
    """Validated runtime configuration loaded from environment and optional ``.env`` file."""

    model_config = SettingsConfigDict(
        env_file=_ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Operations Control API"

    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # Security — set API_KEY in .env to require ``X-API-Key`` on protected routes (when enforced).
    API_KEY: str = ""

    JWT_SECRET_KEY: str = Field(
        default=_DEV_JWT_PLACEHOLDER,
        min_length=1,
        description="HS256 signing secret; must be a strong random value in production.",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Public URL of the web client (password reset links, deep links).
    FRONTEND_BASE_URL: str = "http://localhost:5173"

    # CORS — primary SPA origin plus optional comma-separated extras (e.g. preview deploys).
    ALLOWED_ORIGIN: str = "http://localhost:5173"
    CORS_EXTRA_ORIGINS: str = ""

    # Database
    DATABASE_URL: str = "sqlite:///./sql_app.db"
    SQLALCHEMY_ECHO: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # Integration credentials (never commit real values; use environment only).
    FEDEX_CLIENT_ID: str = ""
    FEDEX_CLIENT_SECRET: str = ""
    FEDEX_URL: str = "https://apis.fedex.com"

    UPS_CLIENT_ID: str = ""
    UPS_CLIENT_SECRET: str = ""

    DHL_API_KEY: str = ""
    DHL_API_SECRET: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v or "sqlite:///./sql_app.db"

    @model_validator(mode="after")
    def reject_weak_jwt_in_production(self) -> Self:
        """Prevent accidental deployment with a well-known development signing secret."""
        if self.ENVIRONMENT == "production" and self.JWT_SECRET_KEY == _DEV_JWT_PLACEHOLDER:
            raise ValueError(
                "JWT_SECRET_KEY must be set to a unique strong value when ENVIRONMENT=production"
            )
        return self

    def cors_origin_list(self) -> list[str]:
        """Build the full allowlist for ``CORSMiddleware`` without duplicating literals in code."""
        origins: list[str] = [self.ALLOWED_ORIGIN.strip()]
        if self.ENVIRONMENT == "development":
            for dev in (
                "http://127.0.0.1:5173",
                "http://localhost:5173",
            ):
                if dev not in origins:
                    origins.append(dev)
        for part in self.CORS_EXTRA_ORIGINS.split(","):
            p = part.strip()
            if p and p not in origins:
                origins.append(p)
        return origins


settings = Settings()
