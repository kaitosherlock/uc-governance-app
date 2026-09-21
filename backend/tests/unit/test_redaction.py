import io
import json
import logging

import pytest
from app.correlation import correlation_id
from app.logging_setup import JsonFormatter, RedactionFilter


def test_secrets_redacted_after_interpolation_and_in_tracebacks() -> None:
    stream = io.StringIO()
    env = {
        "UCGOV_PLAN_HMAC_KEY": "synthetic-hmac-value",
        "DATABRICKS_CLIENT_SECRET": "synthetic-client-value",
        "PGPASSWORD": "synthetic-password-value",
        "SERVICE_TOKEN": "synthetic-token-value",
        "OTHER_SECRET": "synthetic-other-value",
        "PGHOST": "synthetic-host-value",
    }
    handler = logging.StreamHandler(stream)
    handler.addFilter(RedactionFilter(env))
    handler.setFormatter(JsonFormatter(env))
    logger = logging.Logger("redaction-test")
    logger.addHandler(handler)
    token = correlation_id.set("test-correlation")
    try:
        try:
            raise RuntimeError("Bearer synthetic-bearer-value " + env["PGPASSWORD"])
        except RuntimeError:
            logger.exception(
                "values %s and SERVICE_TOKEN=synthetic-inline-value", list(env.values()),
                extra={"details": {"nested": {"NEW_SECRET": "synthetic-structured-value"}}},
            )
    finally:
        correlation_id.reset(token)
    line = stream.getvalue()
    for secret in [*env.values(), "synthetic-bearer-value", "synthetic-inline-value",
                   "synthetic-structured-value"]:
        assert secret not in line
    record = json.loads(line)
    assert record["correlation_id"] == "test-correlation"
    assert "RuntimeError" in record["exception"]
    assert "[REDACTED]" in line


@pytest.mark.parametrize("message", [
    "Bearer synthetic-bearer", "{'PGPASSWORD': 'synthetic-keyed'}",
    'EXAMPLE_SECRET="synthetic-keyed"', "PGHOST=synthetic-keyed",
])
def test_redaction_without_environment_value(message: str) -> None:
    record = logging.LogRecord("test", logging.INFO, "test", 1, message, (), None)
    RedactionFilter({}).filter(record)
    assert "synthetic-" not in JsonFormatter({}).format(record)
