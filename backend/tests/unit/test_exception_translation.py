"""SDK errors become safe contract errors at the adapter boundary."""

from types import SimpleNamespace

import pytest
from app.adapters.databricks.common import boundary, translate_exception
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
