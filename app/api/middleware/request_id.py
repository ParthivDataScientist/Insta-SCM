"""Propagate a correlation id across the request lifecycle."""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach ``request.state.request_id`` and echo it on the response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        header_rid = request.headers.get("X-Request-ID")
        request.state.request_id = header_rid or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response
