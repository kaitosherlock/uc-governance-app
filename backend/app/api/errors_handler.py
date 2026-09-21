"""One safe error envelope for route, validation, HTTP and unexpected failures."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from app.api.v1.models import ErrorCode, ErrorResponse, FieldError
from app.correlation import correlation_id
from app.errors import (
    AppError,
    ForbiddenRole,
    NotFound,
    RateLimited,
    Unauthenticated,
    UpstreamUnavailable,
    ValidationFailed,
)
from app.logging_setup import Redactor

logger = logging.getLogger(__name__)


def error_response(error: AppError, request_id: str | None = None) -> JSONResponse:
    request_id = request_id or correlation_id.get()
    envelope = ErrorResponse(
        success=False, code=error.code, message=error.message, correlation_id=request_id,
        next_steps=error.next_steps, errors=error.errors,
    )
    return JSONResponse(
        status_code=error.http_status,
        content=Redactor().value(envelope.model_dump(mode="json")),
        headers={"X-Request-Id": request_id},
    )


async def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return error_response(exc, getattr(request.state, "correlation_id", None))


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    # Pydantic messages, input and ctx can contain arbitrary user values; omit them.
    fields = [FieldError(
        field=".".join(str(part) for part in error["loc"]),
        code="INVALID_FIELD", message="Invalid value for this field.",
    ) for error in exc.errors()]
    return error_response(ValidationFailed(errors=fields), request.state.correlation_id)


async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)
    if exc.status_code == 404:
        error: AppError = NotFound()
    elif exc.status_code == 401:
        error = Unauthenticated()
    elif exc.status_code == 403:
        error = ForbiddenRole()
    elif exc.status_code == 429:
        error = RateLimited()
    elif exc.status_code in {502, 503, 504}:
        error = UpstreamUnavailable()
    elif exc.status_code >= 500:
        error = AppError(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred.", 500)
    else:
        error = ValidationFailed("The HTTP request could not be processed.")
    return error_response(error, getattr(request.state, "correlation_id", None))


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled request failure", exc_info=(type(exc), exc, exc.__traceback__))
    return error_response(
        AppError(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred.", 500),
        getattr(request.state, "correlation_id", None),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
