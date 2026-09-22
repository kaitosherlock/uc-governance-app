"""Safe SDK exception boundary and allowlisted primitive extraction."""
import re
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from functools import wraps
from threading import Lock
from time import monotonic
from typing import ParamSpec, TypeVar
from uuid import uuid4

from app.api.v1.models import ErrorCode
from app.domain.enums import ManagedStatus, ObjectKind, SecurableType
from app.domain.models import AssetDetail, AssetRef
from app.domain.names import parts
from app.errors import AppError, UpstreamUnavailable, ValidationFailed

P = ParamSpec('P')
T = TypeVar('T')


def translate_exception(exc: Exception) -> AppError:
    status = getattr(exc, 'status_code', None) or getattr(exc, 'http_status_code', None)
    code = getattr(exc, 'error_code', None)
    if status is None:
        status = {'UNAUTHENTICATED': 401, 'PERMISSION_DENIED': 403, 'NOT_FOUND': 404,
                  'RESOURCE_DOES_NOT_EXIST': 404, 'REQUEST_LIMIT_EXCEEDED': 429,
                  'TOO_MANY_REQUESTS': 429, 'SCIM_401': 401, 'SCIM_403': 403,
                  'SCIM_404': 404, 'SCIM_429': 429}.get(code)
    if status is None:
        status = {'Unauthenticated': 401, 'PermissionDenied': 403, 'NotFound': 404,
                  'ResourceDoesNotExist': 404, 'TooManyRequests': 429,
                  'RequestLimitExceeded': 429}.get(type(exc).__name__)
    mapping = {401: (ErrorCode.INSUFFICIENT_PRIVILEGES, 403),
               403: (ErrorCode.INSUFFICIENT_PRIVILEGES, 403), 404: (ErrorCode.NOT_FOUND, 404),
               429: (ErrorCode.RATE_LIMITED, 429)}
    error_code, http_status = mapping.get(status, (ErrorCode.UPSTREAM_UNAVAILABLE, 503))
    message = {ErrorCode.INSUFFICIENT_PRIVILEGES: 'The executing identity cannot read this resource.',
               ErrorCode.NOT_FOUND: 'Not found or not visible to the executing identity.',
               ErrorCode.RATE_LIMITED: 'Databricks is rate-limiting requests. Try again later.',
               ErrorCode.UPSTREAM_UNAVAILABLE: 'Databricks is temporarily unavailable.'}[error_code]
    error = AppError(error_code, message, http_status)
    request_id = getattr(exc, 'request_id', None)
    if request_id is None:
        kwargs = getattr(exc, 'kwargs', None)
        if isinstance(kwargs, dict):
            request_id = kwargs.get('request_id')
    # Internal diagnostics only: ErrorResponse has no details property in v1.
    if isinstance(request_id, str) and re.fullmatch(r'[A-Za-z0-9._:-]{1,128}', request_id):
        error.details['databricks_request_id'] = request_id
    return error


def boundary(function: Callable[P, T]) -> Callable[P, T]:
    @wraps(function)
    def wrapped(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return function(*args, **kwargs)
        except AppError:
            raise
        except Exception as exc:
            raise translate_exception(exc) from None
    return wrapped


def text_field(value: object, name: str) -> str | None:
    result = getattr(value, name, None)
    return result if isinstance(result, str) else None


def enum_field(value: object, name: str) -> str | None:
    result = getattr(value, name, None)
    result = getattr(result, 'value', result)
    return result if isinstance(result, str) else None


def timestamp(value: object, name: str) -> datetime | None:
    result = getattr(value, name, None)
    if isinstance(result, int | float) and not isinstance(result, bool):
        return datetime.fromtimestamp(result / 1000, UTC)
    return None


def items_field(value: object, name: str) -> list[object]:
    result = getattr(value, name, None)
    return list(result) if isinstance(result, list | tuple) else []


def base_asset(value: object, stype: SecurableType, kind: ObjectKind) -> AssetDetail:
    full_name = text_field(value, 'full_name') or text_field(value, 'name')
    if not full_name:
        raise UpstreamUnavailable('Databricks returned incomplete object metadata.')
    bits = parts(full_name)
    parent = None
    if len(bits) > 1:
        # Retain the quoted parent spelling from upstream, not an unquoted reconstruction.
        parent_name = full_name.rsplit('.', 1)[0] if '`' not in full_name else '.'.join('`'+p.replace('`','``')+'`' for p in bits[:-1])
        parent = AssetRef(securable_type=SecurableType.CATALOG if len(bits) == 2 else SecurableType.SCHEMA,
            full_name=parent_name, kind=ObjectKind.CATALOG if len(bits) == 2 else ObjectKind.SCHEMA,
            display_name=bits[-2])
    return AssetDetail(securable_type=stype, full_name=full_name, kind=kind,
        display_name=text_field(value, 'name') or bits[-1], owner=text_field(value, 'owner'),
        comment=text_field(value, 'comment'), updated_at=timestamp(value, 'updated_at'),
        managed=ManagedStatus.UNKNOWN, pipeline_managed=None, allowed_actions=(),
        properties={}, tags=(), columns=(), row_filter=None, view_definition=None,
        storage_location=None, table_type=None, data_source_format=None,
        created_at=timestamp(value, 'created_at'), created_by=text_field(value, 'created_by'),
        parent=parent, raw={})


class CursorStore:
    """Five-minute, identity-and-query-bound continuations over SDK iterators.

    Avoids SDK iterator exhaustion and whole-workspace loading. Tokens are opaque,
    single-use and process-local; an expired token asks the caller to restart.
    """
    def __init__(self) -> None:
        self._entries: dict[str, tuple[float, str, Iterator[object]]] = {}
        self._lock = Lock()

    @boundary
    def page(self, factory: Callable[[], Iterator[object]], key: str, size: int, token: str | None) -> tuple[list[object], str | None]:
        size = max(1, min(size, 200))
        with self._lock:
            now = monotonic()
            self._entries = {k: v for k, v in self._entries.items() if v[0] > now}
            if token:
                entry = self._entries.get(token)
                if entry is None or entry[1] != key:
                    raise ValidationFailed('The page token expired or belongs to another listing. Restart the listing.')
                del self._entries[token]
                iterator = entry[2]
            else:
                iterator = factory()
            values: list[object] = []
            for _ in range(size):
                try:
                    values.append(next(iterator))
                except StopIteration:
                    return values, None
            if len(self._entries) >= 256:
                oldest = next(iter(self._entries))
                del self._entries[oldest]
            next_token = uuid4().hex
            self._entries[next_token] = (now + 300, key, iterator)
            return values, next_token
