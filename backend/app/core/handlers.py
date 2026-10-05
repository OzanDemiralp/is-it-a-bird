"""Global exception handlers: every error leaves the API in the same flat JSON shape.

    {"code": "...", "name": "...", "message": "...", "details": ...}   (details only if present)
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .errors import (
    AppError,
    InternalServerError,
    MethodNotAllowedError,
    RequestValidationFailedError,
    ResourceNotFoundError,
)

logger = logging.getLogger(__name__)


def _response(error: AppError) -> JSONResponse:
    body: dict = {"code": error.code, "name": error.name, "message": error.message}
    if error.details is not None:
        body["details"] = error.details
    return JSONResponse(status_code=error.status_code, content=body, headers=error.headers)


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return _response(exc)


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"field": ".".join(str(p) for p in e["loc"][1:]), "issue": e["msg"]} for e in exc.errors()
    ]
    return _response(RequestValidationFailedError(details=details))


async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Framework-raised errors (unknown route, wrong method) get the same shape.
    if exc.status_code == 404:
        return _response(ResourceNotFoundError())
    if exc.status_code == 405:
        return _response(MethodNotAllowedError(headers=dict(exc.headers or {})))
    return _response(InternalServerError(str(exc.detail)))


async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    # Log the real cause server-side; never leak it to the client.
    logger.exception("Unhandled exception", exc_info=exc)
    return _response(InternalServerError())


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
