"""Request context shared by the HTTP and logging boundaries."""

from contextvars import ContextVar

correlation_id: ContextVar[str] = ContextVar("correlation_id", default="-")
