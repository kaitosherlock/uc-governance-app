"""SDK errors become safe contract errors at the adapter boundary."""

import json
from types import SimpleNamespace

import pytest
from app.adapters.databricks.common import OperationContext, boundary, translate_exception
from app.adapters.databricks.factory import LazyService
from app.api.errors_handler import error_response
from app.errors import AppError


@pytest.mark.parametrize(
    ("status", "code", "http_status"),
    [
        (401, "INSUFFICIENT_PRIVILEGES", 403),
        (403, "INSUFFICIENT_PRIVILEGES", 403),
        (404, "NOT_FOUND", 404),
        (429, "RATE_LIMITED", 429),
        (500, "UPSTREAM_UNAVAILABLE", 503),
        (503, "UPSTREAM_UNAVAILABLE", 503),
    ],
)
def test_status_translation_is_safe(status: int, code: str, http_status: int) -> None:
    upstream = Exception("DO NOT EXPOSE upstream response")
    upstream.status_code = status  # type: ignore[attr-defined]
    upstream.request_id = "synthetic-request-123"  # type: ignore[attr-defined]
    result = translate_exception(upstream)
    assert result.code == code
    assert result.http_status == http_status
    assert result.details == {"databricks_request_id": "synthetic-request-123"}
    assert "DO NOT EXPOSE" not in str(result)


def test_timeout_and_iterator_errors_are_translated() -> None:
    assert translate_exception(TimeoutError()).code == "UPSTREAM_UNAVAILABLE"

    @boundary
    def consume() -> None:
        raise TimeoutError("untrusted upstream response")

    with pytest.raises(AppError, match="temporarily unavailable"):
        consume()


@pytest.mark.parametrize("code", ["PERMISSION_DENIED", "SCIM_403", "SCIM_401", "UNAUTHENTICATED"])
def test_sdk_codes_without_http_status_are_permissions_failures(code: str) -> None:
    upstream = SimpleNamespace(error_code=code)
    assert translate_exception(upstream).code == "INSUFFICIENT_PRIVILEGES"


def test_user_permission_error_names_safe_context_and_oauth_scope() -> None:
    upstream = SimpleNamespace(status_code=403)
    result = translate_exception(
        upstream,
        OperationContext(
            executor="user",
            operation="list catalogs",
            securable="sales",
            oauth_scope="catalog.catalogs",
        ),
    )

    assert result.code == "INSUFFICIENT_PRIVILEGES"
    assert result.http_status == 403
    assert "signed-in user" in result.message
    assert "sales" in result.message
    assert result.next_steps
    assert "catalog.catalogs" in result.next_steps[0]


def test_service_principal_permission_error_has_distinct_grant_step() -> None:
    upstream = SimpleNamespace(status_code=403)
    user = translate_exception(
        upstream,
        OperationContext("user", "read table", "sales.crm.orders", "catalog.tables"),
    )
    service_principal = translate_exception(
        upstream,
        OperationContext(
            executor="sp",
            operation="read direct grants",
            securable="sales.crm.orders",
            uc_privilege="MANAGE",
        ),
    )

    assert "application's service principal" in service_principal.message
    assert "sales.crm.orders" in service_principal.message
    assert service_principal.next_steps != user.next_steps
    assert "MANAGE" in service_principal.next_steps[0]
    assert "metastore or catalog admin" in service_principal.next_steps[0]


def test_permission_next_steps_do_not_include_upstream_sensitive_values() -> None:
    upstream = Exception(
        "Bearer secret-token https://workspace.example.test Traceback (most recent call last)"
    )
    upstream.status_code = 403  # type: ignore[attr-defined]
    result = translate_exception(
        upstream,
        OperationContext("sp", "read direct grants", "sales.crm.orders", uc_privilege="MANAGE"),
    )
    rendered = " ".join([result.message, *result.next_steps])

    assert "secret-token" not in rendered
    assert "workspace.example.test" not in rendered
    assert "Traceback" not in rendered


def test_lazy_sdk_service_carries_executor_and_securable_to_translation() -> None:
    def denied(*args: object, **kwargs: object) -> None:
        error = Exception("private upstream details")
        error.status_code = 403  # type: ignore[attr-defined]
        raise error

    service = LazyService(
        lambda: SimpleNamespace(catalogs=SimpleNamespace(get=denied)), "catalogs", "user"
    )

    with pytest.raises(AppError) as raised:
        service.get(name="sales")

    assert "signed-in user" in raised.value.message
    assert "sales" in raised.value.message
    assert "catalog.catalogs" in raised.value.next_steps[0]


def test_contextual_permission_error_keeps_the_frozen_error_envelope() -> None:
    upstream = SimpleNamespace(status_code=403)
    error = translate_exception(
        upstream,
        OperationContext("sp", "read direct grants", "sales.crm.orders", uc_privilege="MANAGE"),
    )
    response = error_response(error, "synthetic-correlation")

    assert response.status_code == 403
    assert response.headers["X-Request-Id"] == "synthetic-correlation"
    body = json.loads(response.body)
    assert set(body) == {
        "success",
        "code",
        "message",
        "correlation_id",
        "next_steps",
        "errors",
    }
    assert body["success"] is False
    assert body["code"] == "INSUFFICIENT_PRIVILEGES"
    assert body["errors"] == []
