"""Safe application errors. Messages supplied here must be application-authored."""

from app.api.v1.models import ErrorCode, FieldError


class AppError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        http_status: int,
        next_steps: list[str] | None = None,
        errors: list[FieldError] | None = None,
    ) -> None:
        if not 400 <= http_status <= 599 or code == ErrorCode.OUTCOME_UNKNOWN:
            raise ValueError("HTTP errors require a failure status and an HTTP error code.")
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.next_steps = next_steps or []
        self.errors = errors or []
        self.details: dict[str, str] = {}


class StandardError(AppError):
    error_code: ErrorCode
    status: int
    default_message: str

    def __init__(
        self,
        message: str | None = None,
        *,
        next_steps: list[str] | None = None,
        errors: list[FieldError] | None = None,
    ) -> None:
        super().__init__(
            self.error_code, message or self.default_message, self.status, next_steps, errors
        )


class ValidationFailed(StandardError):
    error_code = ErrorCode.VALIDATION_FAILED
    status = 400
    default_message = "The request contains invalid fields."


class Unauthenticated(StandardError):
    error_code = ErrorCode.UNAUTHENTICATED
    status = 401
    default_message = "Sign-in required through Databricks."


class IdentityMismatch(StandardError):
    error_code = ErrorCode.IDENTITY_MISMATCH
    status = 401
    default_message = "The forwarded identity does not match the verified user."


class ForbiddenRole(StandardError):
    error_code = ErrorCode.FORBIDDEN_ROLE
    status = 403
    default_message = "Your role cannot request this action."


class ForbiddenScope(StandardError):
    error_code = ErrorCode.FORBIDDEN_SCOPE
    status = 403
    default_message = "This object is outside the managed scope of this application."


class ModeReadOnly(StandardError):
    error_code = ErrorCode.MODE_READ_ONLY
    status = 403
    default_message = "This application is in read-only mode."


class NotFound(StandardError):
    error_code = ErrorCode.NOT_FOUND
    status = 404
    default_message = "Not found or not visible to the application."


class NotConfigured(StandardError):
    error_code = ErrorCode.NOT_CONFIGURED
    status = 503
    default_message = "A required resource is not configured."


class NotImplementedYet(StandardError):
    error_code = ErrorCode.NOT_IMPLEMENTED
    status = 501
    default_message = "This capability is not implemented in this version."


class UpstreamUnavailable(StandardError):
    error_code = ErrorCode.UPSTREAM_UNAVAILABLE
    status = 503
    default_message = "A required service is temporarily unavailable."


class RateLimited(StandardError):
    error_code = ErrorCode.RATE_LIMITED
    status = 429
    default_message = "Databricks is rate-limiting requests. Try again in a moment."
