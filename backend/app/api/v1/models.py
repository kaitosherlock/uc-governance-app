"""DTOs matching the frozen v1 contract; no SDK objects cross this boundary."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, hide_input_in_errors=True,
    )


class ErrorCode(StrEnum):
    VALIDATION_FAILED = "VALIDATION_FAILED"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    IDENTITY_MISMATCH = "IDENTITY_MISMATCH"
    FORBIDDEN_ROLE = "FORBIDDEN_ROLE"
    FORBIDDEN_SCOPE = "FORBIDDEN_SCOPE"
    MODE_READ_ONLY = "MODE_READ_ONLY"
    INSUFFICIENT_PRIVILEGES = "INSUFFICIENT_PRIVILEGES"
    SOD_VIOLATION = "SOD_VIOLATION"
    NOT_FOUND = "NOT_FOUND"
    PLAN_STALE = "PLAN_STALE"
    PLAN_EXPIRED = "PLAN_EXPIRED"
    PLAN_TAMPERED = "PLAN_TAMPERED"
    PLAN_INVALIDATED = "PLAN_INVALIDATED"
    DUPLICATE_SUBMISSION = "DUPLICATE_SUBMISSION"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    UNSUPPORTED = "UNSUPPORTED"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
    OUTCOME_UNKNOWN = "OUTCOME_UNKNOWN"


class DataSource(StrEnum):
    UNITY_CATALOG_API = "unity_catalog_api"
    ACCOUNT_API = "account_api"
    SYSTEM_TABLE = "system_table"
    DURABLE_STORE = "durable_store"
    APPLICATION = "application"
    FIXTURE = "fixture"


class Completeness(StrEnum):
    COMPLETE = "complete"
    TRUNCATED = "truncated"
    PARTIAL_VISIBILITY = "partial_visibility"
    UNKNOWN = "unknown"


def as_utc(value: datetime) -> datetime:
    return value.astimezone(UTC)


UtcTimestamp = Annotated[AwareDatetime, AfterValidator(as_utc)]


class Scope(ContractModel):
    catalog: str | None = None
    schema_name: str | None = Field(default=None, alias="schema")


class Meta(ContractModel):
    source: DataSource
    observed_at: UtcTimestamp
    scope: Scope | None = None
    completeness: Completeness
    limitations: list[str]
    correlation_id: str


class Page(ContractModel):
    page_size: int
    next_page_token: str | None


T = TypeVar("T")


class SuccessResponse(ContractModel, Generic[T]):
    success: Literal[True]
    data: T
    meta: Meta


class FieldError(ContractModel):
    field: str
    code: str
    message: str


class ErrorResponse(ContractModel):
    success: Literal[False]
    code: ErrorCode
    message: str
    correlation_id: str
    next_steps: list[str] = Field(default_factory=list)
    errors: list[FieldError] = Field(default_factory=list)


class AppMode(StrEnum):
    FIXTURE = "fixture"
    CONNECTED_READONLY = "connected_readonly"
    CONNECTED = "connected"


class Context(ContractModel):
    mode: AppMode
    mode_label: Literal["Demo — synthetic data", "Read-only", "Editing enabled"]
    environment_label: str
    workspace_host: str
    workspace_id: str | None
    managed_catalogs: list[str]
    support_contact: str | None
    bootstrap_allowlist_active: bool
    warehouse_configured: bool
    durable_store_configured: bool
    account_client_configured: bool


class ContextResponse(SuccessResponse[Context]):
    pass


class AppRole(StrEnum):
    VIEWER = "viewer"
    STEWARD = "steward"
    ACCESS_ADMIN = "access_admin"
    AUDITOR = "auditor"
    PLATFORM_ADMIN = "platform_admin"


class ActorKind(StrEnum):
    USER = "user"
    SERVICE_PRINCIPAL = "service_principal"


class Actor(ContractModel):
    id: str
    display: str
    kind: ActorKind
    roles: list[AppRole]
    verified_by: Literal["user_token", "cli_profile", "fixture"]


class Executor(ContractModel):
    kind: Literal["service_principal", "user", "account_service_principal"]
    display: str
    reason: str


class Identity(ContractModel):
    actor: Actor
    executor: Executor


class IdentityResponse(SuccessResponse[Identity]):
    pass


class CapabilityStatusValue(StrEnum):
    AVAILABLE = "available"
    NOT_CONFIGURED = "not_configured"
    INSUFFICIENT_PERMISSIONS = "insufficient_permissions"
    UNSUPPORTED_IN_ENVIRONMENT = "unsupported_in_environment"
    NOT_IMPLEMENTED = "not_implemented"
    TEMPORARILY_UNAVAILABLE = "temporarily_unavailable"
    UNKNOWN = "unknown"


class CapabilityRequirement(StrEnum):
    SQL_WAREHOUSE = "sql_warehouse"
    DURABLE_STORE = "durable_store"
    ACCOUNT_CLIENT = "account_client"
    USER_TOKEN_SCOPE = "user_token_scope"


class Capability(ContractModel):
    capability: str
    domain: str
    status: CapabilityStatusValue
    reason: str | None
    requires: list[CapabilityRequirement]
    checked_at: UtcTimestamp


class CapabilitiesResponse(SuccessResponse[list[Capability]]):
    pass
