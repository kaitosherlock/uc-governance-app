"""Structured stdout logs with redaction after interpolation and traceback formatting."""

import json
import logging
import os
import re
import sys
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import TextIO

from app.correlation import correlation_id

REDACTED = "[REDACTED]"
BEARER = re.compile(r"\bBearer\s+[^\s\"',;<>]+", re.IGNORECASE)
SECRET_ASSIGNMENT = re.compile(
    r"(?i)(\b(?:UCGOV_PLAN_HMAC_KEY|DATABRICKS_CLIENT_SECRET|PG[A-Z_]*|"
    r"[A-Z0-9_]+_TOKEN|[A-Z0-9_]+_SECRET)\b[\"']?\s*[:=]\s*)"
    r"(?:\"[^\"]*\"|'[^']*'|[^\s,;}]+)"
)


def is_secret_name(name: str) -> bool:
    name = name.upper()
    return (
        name in {"UCGOV_PLAN_HMAC_KEY", "DATABRICKS_CLIENT_SECRET"}
        or name.startswith("PG")
        or name.endswith(("_TOKEN", "_SECRET"))
    )


class Redactor:
    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = os.environ if env is None else env

    def text(self, value: str) -> str:
        values = {v for k, v in self.env.items() if is_secret_name(k) and v}
        for secret in sorted(values, key=len, reverse=True):
            value = value.replace(secret, REDACTED)
        value = BEARER.sub("Bearer " + REDACTED, value)
        return SECRET_ASSIGNMENT.sub(lambda match: match[1] + REDACTED, value)

    def value(self, value: object) -> object:
        if isinstance(value, Mapping):
            return {
                self.text(str(k)): REDACTED if is_secret_name(str(k)) else self.value(v)
                for k, v in value.items()
            }
        if isinstance(value, (tuple, list)):
            return [self.value(v) for v in value]
        if isinstance(value, str):
            return self.text(value)
        if value is None or isinstance(value, (bool, int, float)):
            return value
        return self.text(str(value))


class RedactionFilter(logging.Filter):
    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        super().__init__()
        self.redactor = Redactor(env)

    def filter(self, record: logging.LogRecord) -> bool:
        # Sanitize the fully interpolated message, structured extras, and traceback.
        record.msg = self.redactor.text(record.getMessage())
        record.args = ()
        if record.exc_info:
            formatted_exception = logging.Formatter().formatException(record.exc_info)
            record.exc_text = self.redactor.text(formatted_exception)
            record.exc_info = None
        for key, value in list(vars(record).items()):
            record.__dict__[key] = (
                REDACTED if is_secret_name(key) else self.redactor.value(value)
            )
        record.correlation_id = self.redactor.text(correlation_id.get())
        return True


class JsonFormatter(logging.Formatter):
    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        super().__init__()
        self.redactor = Redactor(env)

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", correlation_id.get()),
        }
        if record.exc_text:
            payload["exception"] = record.exc_text
        if record.stack_info:
            payload["stack"] = record.stack_info
        if hasattr(record, "details"):
            payload["details"] = record.details
        return json.dumps(self.redactor.value(payload), ensure_ascii=False)


def configure_logging(stream: TextIO | None = None) -> None:
    root = logging.getLogger()
    # Preserve handlers owned by the host/test runner, replacing only our own.
    for handler in list(root.handlers):
        if getattr(handler, "ucgov_handler", False):
            root.removeHandler(handler)
    handler = logging.StreamHandler(stream or sys.stdout)
    handler.ucgov_handler = True  # type: ignore[attr-defined]
    handler.addFilter(RedactionFilter())
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(logging.INFO)
