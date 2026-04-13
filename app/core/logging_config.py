"""Application-wide logging setup with structured, machine-parseable records.

Why structured logs: operations teams can filter and alert on ``level``, ``logger``,
and stable ``event`` keys without scraping free-form text.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings


class StructuredJSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON for aggregation pipelines."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # Optional ``extra`` keys from logger.info(..., extra={...})
        for key in ("event", "request_id", "error_code"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        return json.dumps(payload, default=str)


class HumanReadableFormatter(logging.Formatter):
    """Console-friendly format for local development."""

    def __init__(self) -> None:
        super().__init__(
            fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )


def configure_logging() -> None:
    """Configure root logger once (idempotent for tests and reloads)."""
    root = logging.getLogger()
    if getattr(root, "_insta_track_configured", False):
        return

    level_name = settings.LOG_LEVEL.upper()
    level = getattr(logging, level_name, logging.INFO)
    root.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    if settings.LOG_JSON:
        handler.setFormatter(StructuredJSONFormatter())
    else:
        handler.setFormatter(HumanReadableFormatter())

    root.handlers.clear()
    root.addHandler(handler)

    # Reduce noise from third-party loggers in production-like setups
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.SQLALCHEMY_ECHO else logging.WARNING
    )

    root._insta_track_configured = True  # type: ignore[attr-defined]
