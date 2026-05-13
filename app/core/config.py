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

    # Set to "production" in Vercel settings
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # Security
    API_KEY: str = ""
    JWT_SECRET_KEY: str = Field(
        default=_DEV_JWT_PLACEHOLDER,
        description="Must be set to a strong random value in production.",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Public URL of the web client
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    ALLOWED_ORIGIN: str = "http://localhost:5173"
    CORS_EXTRA_ORIGINS: str = ""

    # Database
    DATABASE_URL: str = "sqlite:///./sql_app.db"
    SQLALCHEMY_ECHO: bool = False
    
    # Set to True to allow automatic schema updates (ALTER TABLE) on startup
    AUTO_SYNC_SCHEMA: bool = True

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # Integration credentials
    FEDEX_CLIENT_ID: str = ""
    FEDEX_CLIENT_SECRET: str = ""
    FEDEX_URL: str = "https://apis.fedex.com"
    FEDEX_ENABLE_MOCK_DATA: bool = False

    UPS_CLIENT_ID: str = ""
    UPS_CLIENT_SECRET: str = ""

    DHL_API_KEY: str = ""
    DHL_API_SECRET: str = ""
    DHL_WCF_WSDL_URL: str = "https://api.india.express.dhl.com/DHLWCFService_V6/DHLService.svc?wsdl"
    DHL_WCF_ENDPOINT: str = "https://api.india.express.dhl.com/DHLWCFService_V6/DHLService.svc"
    DHL_WCF_USERNAME: str = ""
    DHL_WCF_PASSWORD: str = ""
    DHL_WCF_SOAP_ACTION: str = "http://tempuri.org/IDHLService/PostTracking"
    DHL_WCF_SOAP_VERSION: Literal["1.1", "1.2"] = "1.1"
    DHL_WCF_TIMEOUT_SECONDS: int = 20
    
    STORAGE_DIR: str = os.path.join(_ROOT_DIR, "storage")
    DHL_LABELS_SUBDIR: str = "labels"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None) -> str:
        url = (v or "").strip() if isinstance(v, str) else ""
        
        # If running on Vercel, prioritize the DATABASE_URL from environment
        # If it's still empty or using the default sqlite path, we might be in trouble
        # but we allow the fallback for dev previews.
        if not url:
            url = "sqlite:///./sql_app.db"
            
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql://", 1)
            
        # Vercel serverless: only /tmp is writable.
        if os.environ.get("VERCEL") and url.startswith("sqlite") and "/tmp/" not in url:
            return "sqlite:////tmp/insta_track.db"
            
        return url

    @field_validator("STORAGE_DIR", mode="before")
    @classmethod
    def resolve_storage_dir(cls, v: str | None) -> str:
        path = (v or "").strip() if isinstance(v, str) else ""
        if not path:
            path = os.path.join(_ROOT_DIR, "storage")
        if os.environ.get("VERCEL"):
            return "/tmp/insta-track-storage"
        return path

    @model_validator(mode="after")
    def validate_production_settings(self) -> Self:
        """Strict checks for production environments."""
        if self.ENVIRONMENT == "production":
            if self.JWT_SECRET_KEY == _DEV_JWT_PLACEHOLDER:
                raise ValueError("JWT_SECRET_KEY must be a unique secure value in production.")
            
            if "sqlite" in self.DATABASE_URL and not os.environ.get("ALLOW_SQLITE_IN_PROD"):
                # Warning: SQLite on Vercel is ephemeral! Tables will reset on every cold start.
                # We should encourage Postgres for production.
                pass 
                
        return self

    def cors_origin_list(self) -> list[str]:
        origins: list[str] = [self.ALLOWED_ORIGIN.strip()]
        if self.ENVIRONMENT == "development":
            origins.extend(["http://127.0.0.1:5173", "http://localhost:5173"])
        
        # Add frontend base URL if it's different
        if self.FRONTEND_BASE_URL not in origins:
            origins.append(self.FRONTEND_BASE_URL)
            
        for part in self.CORS_EXTRA_ORIGINS.split(","):
            p = part.strip()
            if p and p not in origins:
                origins.append(p)
        return list(set(origins))


settings = Settings()
