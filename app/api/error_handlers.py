"""Global exception handlers: consistent payloads, safe client messaging, rich server logs."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError, ErrorCode

logger = logging.getLogger(__name__)


def _request_id(request: Request) -> str:
    rid = getattr(request.state, "request_id", None)
    if rid:
        return str(rid)
    return str(uuid.uuid4())


def _error_body(
    *,
    request_id: str,
    code: ErrorCode | str,
    message: str,
    detail: Any = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": {
            "code": code.value if isinstance(code, ErrorCode) else code,
            "message": message,
            "request_id": request_id,
        }
    }
    if detail is not None:
        body["detail"] = detail
    return body


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    request_id = _request_id(request)
    logger.warning(
        "app_error",
        extra={
            "event": "app_error",
            "request_id": request_id,
            "error_code": exc.code.value,
            "context": exc.context,
        },
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(
            request_id=request_id,
            code=exc.code,
            message=exc.message,
            detail=exc.context if exc.context else None,
        ),
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    request_id = _request_id(request)
    code = _status_to_code(exc.status_code)
    message = _stringify_detail(exc.detail)
    logger.info(
        "http_exception",
        extra={
            "event": "http_exception",
            "request_id": request_id,
            "status_code": exc.status_code,
            "error_code": code.value,
        },
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(
            request_id=request_id,
            code=code,
            message=message,
            detail=exc.detail,
        ),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = _request_id(request)
    logger.info(
        "validation_error",
        extra={
            "event": "validation_error",
            "request_id": request_id,
            "error_code": ErrorCode.VALIDATION_FAILED.value,
        },
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            request_id=request_id,
            code=ErrorCode.VALIDATION_FAILED,
            message="Request validation failed.",
            detail=jsonable_encoder(exc.errors()),
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = _request_id(request)
    logger.exception(
        "unhandled_exception",
        extra={
            "event": "unhandled_exception",
            "request_id": request_id,
            "error_code": ErrorCode.INTERNAL.value,
        },
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body(
            request_id=request_id,
            code=ErrorCode.INTERNAL,
            message="An unexpected error occurred. Reference the request_id when contacting support.",
        ),
    )


def _status_to_code(status_code: int) -> ErrorCode:
    if status_code == 401:
        return ErrorCode.AUTH_REQUIRED
    if status_code == 403:
        return ErrorCode.AUTH_FORBIDDEN
    if status_code == 404:
        return ErrorCode.NOT_FOUND
    if status_code == 409:
        return ErrorCode.CONFLICT
    if status_code == 429:
        return ErrorCode.RATE_LIMITED
    if status_code == 504:
        return ErrorCode.UPSTREAM_TIMEOUT
    return ErrorCode.VALIDATION_FAILED if status_code < 500 else ErrorCode.INTERNAL


def _stringify_detail(detail: Any) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        return "Request could not be processed."
    return "Request could not be processed."
