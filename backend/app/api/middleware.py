"""ASGI middleware keeps request context alive through errors and streaming."""

from urllib.parse import urlsplit
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.errors_handler import error_response, unhandled_error_handler
from app.correlation import correlation_id
from app.errors import ForbiddenRole


class CorrelationMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        supplied = Headers(scope=scope).get("x-request-id", "")
        # Reject controls/oversized values to keep headers and logs safe.
        request_id = (
            supplied
            if (supplied and len(supplied) <= 200 and all(32 <= ord(c) < 127 for c in supplied))
            else str(uuid4())
        )
        token = correlation_id.set(request_id)
        scope.setdefault("state", {})["correlation_id"] = request_id
        started = False

        async def send_with_id(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["X-Request-Id"] = request_id
                started = True
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception as exc:
            response = await unhandled_error_handler(Request(scope), exc)
            if started:
                raise
            await response(scope, receive, send_with_id)
        finally:
            correlation_id.reset(token)


def origin_tuple(value: str) -> tuple[str, str, int] | None:
    try:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            return None
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        return (parsed.scheme, parsed.hostname, port)
    except ValueError:
        return None


class OriginGuardMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] in {"POST", "PATCH", "PUT", "DELETE"}:
            request = Request(scope)
            origin = request.headers.get("origin")
            fetch_site = request.headers.get("sec-fetch-site", "").lower()
            expected = origin_tuple(str(request.base_url))
            if fetch_site in {"cross-site", "same-site"} or (
                origin is not None
                and (origin_tuple(origin) is None or origin_tuple(origin) != expected)
            ):
                response = error_response(ForbiddenRole("Cross-site mutations are not permitted."))
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
