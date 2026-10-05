"""Application errors. Each scenario has its own class, with a stable code, name and HTTP status.

Layers raise these; they never build HTTP responses. `core/handlers.py` turns them into JSON.
"""

from typing import Any


class AppError(Exception):
    """Base class. Subclasses set `status_code` and `code`; `name` is the class name."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    default_message: str = "Internal server error"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: Any = None,
        headers: dict[str, str] | None = None,
    ):
        self.message = message or self.default_message
        self.details = details
        self.headers = headers
        super().__init__(self.message)

    @property
    def name(self) -> str:
        return type(self).__name__


# --- OpenSky (upstream) errors -----------------------------------------------------------------


class OpenSkyRateLimitedError(AppError):
    status_code = 429
    code = "OPENSKY_RATE_LIMITED"
    default_message = "OpenSky rate limit reached; try again later"


class OpenSkyTimeoutError(AppError):
    status_code = 504
    code = "OPENSKY_TIMEOUT"
    default_message = "OpenSky did not respond in time"


class OpenSkyUnreachableError(AppError):
    status_code = 502
    code = "OPENSKY_UNREACHABLE"
    default_message = "Could not reach OpenSky"


class OpenSkyBadResponseError(AppError):
    status_code = 502
    code = "OPENSKY_BAD_RESPONSE"
    default_message = "OpenSky returned an unexpected HTTP status"


class OpenSkyInvalidDataError(AppError):
    status_code = 502
    code = "OPENSKY_INVALID_DATA"
    default_message = "OpenSky returned invalid or unexpected data"


class OpenSkyAuthError(AppError):
    status_code = 502
    code = "OPENSKY_AUTH_FAILED"
    default_message = "Authentication with OpenSky failed"


# --- Request / generic errors ------------------------------------------------------------------


class RequestValidationFailedError(AppError):
    status_code = 422
    code = "REQUEST_VALIDATION_FAILED"
    default_message = "Request parameters are invalid"


class ResourceNotFoundError(AppError):
    status_code = 404
    code = "RESOURCE_NOT_FOUND"
    default_message = "Resource not found"


class MethodNotAllowedError(AppError):
    status_code = 405
    code = "METHOD_NOT_ALLOWED"
    default_message = "Method not allowed"


class InternalServerError(AppError):
    status_code = 500
    code = "INTERNAL_ERROR"
    default_message = "Internal server error"
