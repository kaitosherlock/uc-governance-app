import pytest
from app.api.v1.models import ErrorCode
from app.errors import (
    AppError,
    ForbiddenRole,
    ForbiddenScope,
    IdentityMismatch,
    ModeReadOnly,
    NotConfigured,
    NotFound,
    NotImplementedYet,
    RateLimited,
    Unauthenticated,
    UpstreamUnavailable,
    ValidationFailed,
)
from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_unknown_path_has_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/no-such-route", headers={"X-Request-Id": "missing-route"})
    assert response.status_code == 404
    assert response.json() == {
        "success": False,
        "code": "NOT_FOUND",
        "message": "Not found or not visible to the application.",
        "correlation_id": "missing-route",
        "next_steps": [],
        "errors": [],
    }
    assert response.headers["X-Request-Id"] == "missing-route"


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (ValidationFailed(), 400, "VALIDATION_FAILED"),
        (Unauthenticated(), 401, "UNAUTHENTICATED"),
        (IdentityMismatch(), 401, "IDENTITY_MISMATCH"),
        (ForbiddenRole(), 403, "FORBIDDEN_ROLE"),
        (ForbiddenScope(), 403, "FORBIDDEN_SCOPE"),
        (ModeReadOnly(), 403, "MODE_READ_ONLY"),
        (NotFound(), 404, "NOT_FOUND"),
        (NotConfigured(), 503, "NOT_CONFIGURED"),
        (NotImplementedYet(), 501, "NOT_IMPLEMENTED"),
        (UpstreamUnavailable(), 503, "UPSTREAM_UNAVAILABLE"),
        (RateLimited(), 429, "RATE_LIMITED"),
    ],
)
def test_app_error_status(app: FastAPI, error: AppError, status: int, code: str) -> None:
    @app.get("/test-error")
    def fail() -> None:
        raise error

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/test-error", headers={"X-Request-Id": "error-request"})
    assert response.status_code == status
    assert response.json()["success"] is False
    assert response.json()["code"] == code
    assert response.json()["correlation_id"] == response.headers["X-Request-Id"] == "error-request"


def test_unhandled_failure_is_generic_and_correlated(app: FastAPI) -> None:
    @app.get("/test-internal-error")
    def fail() -> None:
        raise RuntimeError("private upstream response Bearer synthetic-unsafe-value")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get(
            "/test-internal-error",
            headers={"X-Request-Id": "internal-request"},
        )
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert response.json()["message"] == "An unexpected error occurred."
    assert response.json()["correlation_id"] == "internal-request"
    assert response.headers["X-Request-Id"] == "internal-request"
    assert "upstream" not in response.text
    assert "synthetic-unsafe-value" not in response.text
    assert "RuntimeError" not in response.text


def test_validation_is_400_and_omits_input(app: FastAPI) -> None:
    @app.get("/test-validation")
    def validate(count: int) -> int:
        return count

    with TestClient(app) as client:
        response = client.get("/test-validation?count=synthetic-sensitive-value")
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_FAILED"
    assert response.json()["errors"][0]["field"] == "query.count"
    assert "synthetic-sensitive-value" not in response.text


def test_http_method_not_allowed_uses_envelope(client: TestClient) -> None:
    response = client.post("/api/v1/me")
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert "detail" not in response.json()


def test_error_cannot_have_success_status_or_outcome_unknown() -> None:
    with pytest.raises(ValueError):
        AppError(ErrorCode.NOT_IMPLEMENTED, "Invalid success status", 200)
    with pytest.raises(ValueError):
        AppError(ErrorCode.OUTCOME_UNKNOWN, "Not an HTTP error", 500)
