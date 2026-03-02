"""
Security dependencies for FastAPI.
Provides API key authentication for protected endpoints.
"""
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(key: str = Depends(api_key_header)) -> str:
    """
    Dependency: validates the X-API-Key header.
    If API_KEY is not configured in settings, auth is skipped (dev mode).
    """
    if not settings.API_KEY:
        # No key configured → open access (development mode)
        return "dev-no-key"

    if key != settings.API_KEY:
        logger.warning("Rejected request with invalid API key.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key. Set the X-API-Key header.",
        )
    return key
