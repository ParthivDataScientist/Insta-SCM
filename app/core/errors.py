"""Typed application errors and stable public error codes.

Why: clients and operators correlate failures without exposing stack traces
or internal identifiers to end users.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    """Stable, documented codes returned in API error payloads."""

    VALIDATION_FAILED = "VALIDATION_FAILED"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    AUTH_FORBIDDEN = "AUTH_FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    UPSTREAM_TIMEOUT = "UPSTREAM_TIMEOUT"
    INTERNAL = "INTERNAL"


class AppError(Exception):
    """Domain-level error mapped to HTTP status and a public ``ErrorCode``."""

    def __init__(
        self,
        *,
        code: ErrorCode,
        message: str,
        status_code: int = 400,
        context: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.context = context or {}
