"""Errores de dominio desacoplados de HTTP + respuestas problem+json (RFC 9457).

Skill handling-fastapi-errors. Los services lanzan subclases de `AppError`; nunca `HTTPException`.
Un 500 significa siempre un bug, nunca un caso de negocio.
"""

import logging
from collections.abc import Mapping
from typing import Any, ClassVar

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.observability.tracing import current_trace_id

logger = logging.getLogger(__name__)
PROBLEM_JSON = "application/problem+json"


class AppError(Exception):
    """Base de los errores de dominio."""

    status_code: ClassVar[int] = status.HTTP_400_BAD_REQUEST
    code: ClassVar[str] = "bad_request"
    title: ClassVar[str] = "Bad request"

    def __init__(
        self,
        detail: str,
        *,
        extra: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.extra: dict[str, Any] = dict(extra or {})
        # Por instancia (no ClassVar): el Retry-After de un 429 depende de cada request.
        self.headers: dict[str, str] = dict(headers or {})


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    title = "Resource not found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    title = "Conflict"


class BusinessRuleError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "business_rule_violation"
    title = "Business rule violated"


class RateLimitedError(AppError):
    """Límite de solicitudes por IP (protege la cuota gratuita de IA)."""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"
    title = "Too many requests"


def problem(
    request: Request,
    *,
    status_code: int,
    code: str,
    title: str,
    detail: str | None = None,
    extra: Mapping[str, Any] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"{get_settings().ERRORS_BASE_URL}/{code}",
        "title": title,
        "status": status_code,
        "code": code,
        "instance": request.url.path,
    }
    if detail:
        body["detail"] = detail
    if trace_id := current_trace_id():
        body["trace_id"] = trace_id
    if extra:
        body.update(jsonable_encoder(extra))
    return JSONResponse(body, status_code=status_code, media_type=PROBLEM_JSON, headers=headers)


async def _app_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    logger.info("domain error", extra={"error_code": exc.code, "status": exc.status_code})
    return problem(
        request,
        status_code=exc.status_code,
        code=exc.code,
        title=exc.title,
        detail=exc.detail,
        extra=exc.extra,
        headers=exc.headers,
    )


async def _validation_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [{k: e[k] for k in ("type", "loc", "msg") if k in e} for e in exc.errors()]
    return problem(
        request,
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        code="validation_error",
        title="Request validation failed",
        extra={"errors": errors},
    )


async def _http_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    return problem(
        request,
        status_code=exc.status_code,
        code=f"http_{exc.status_code}",
        title=str(exc.detail),
        headers=exc.headers,
    )


async def _unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    # El traceback va al log; al cliente nunca le llega el mensaje interno.
    logger.exception("unhandled error", extra={"path": request.url.path})
    return problem(request, status_code=500, code="internal_error", title="Internal server error")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unhandled_error)
