"""DTOs matching the frozen v1 contract; no SDK objects cross this boundary."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field

from app.domain.enums import (
    ActionName,
    AttachmentSource,
    DependencyKind,
    GrantSourceType,
    ManagedStatus,
    ObjectKind,
    PrincipalKind,
    PrincipalScope,
    PrivilegeCategory,
    SecurableType,
    TagKind,
)


class ContractModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
        hide_input_in_errors=True,
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


class AllowedAction(ContractModel):
    action: ActionName
    allowed: bool
    reason_code: (
        Literal[
            "INHERITED_FROM_PARENT",
            "ROLE_INSUFFICIENT",
            "MODE_READ_ONLY",
            "NOT_IMPLEMENTED",
            "NOT_CONFIGURED",
            "UNSUPPORTED_FOR_TYPE",
            "PIPELINE_MANAGED",
            "SYSTEM_TAG",
            "OUT_OF_SCOPE",
            "INSUFFICIENT_PRIVILEGES",
            "UNKNOWN",
        ]
        | None
    ) = None
    reason: str | None = None
    navigate_to: str | None = None


class AssetRef(ContractModel):
    securable_type: SecurableType
    full_name: str
    kind: ObjectKind
    display_name: str


class AssetSummary(ContractModel):
    securable_type: SecurableType
    full_name: str
    kind: ObjectKind
    display_name: str
    owner: str | None
    comment: str | None
    updated_at: UtcTimestamp | None
    managed: ManagedStatus
    pipeline_managed: bool | None
    allowed_actions: list[AllowedAction]


class Tag(ContractModel):
    key: str
    value: str | None
    kind: TagKind
    allowed_actions: list[AllowedAction]


class RowFilterRef(ContractModel):
    function_full_name: str
    input_columns: list[str]
    attached_via: AttachmentSource
    policy_id: str | None = None


class ColumnMaskRef(ContractModel):
    column: str
    function_full_name: str
    using_columns: list[str]
    attached_via: AttachmentSource
    policy_id: str | None = None


class Column(ContractModel):
    name: str
    type_text: str
    nullable: bool | None
    comment: str | None
    position: int
    tags: list[Tag]
    mask: ColumnMaskRef | None


class AssetDetail(ContractModel):
    securable_type: SecurableType
    full_name: str
    kind: ObjectKind
    display_name: str
    owner: str | None
    comment: str | None
    updated_at: UtcTimestamp | None
    managed: ManagedStatus
    pipeline_managed: bool | None
    allowed_actions: list[AllowedAction]
    properties: dict[str, str]
    tags: list[Tag]
    columns: list[Column]
    row_filter: RowFilterRef | None
    view_definition: str | None
    storage_location: str | None
    table_type: str | None
    data_source_format: str | None
    created_at: UtcTimestamp | None
    created_by: str | None
    parent: AssetRef | None
    raw: dict[str, object]


class Dependency(ContractModel):
    kind: DependencyKind
    full_name: str
    source: DataSource
    verified: bool


class Principal(ContractModel):
    name: str
    display: str
    kind: PrincipalKind
    scope: PrincipalScope
    uc_eligible: bool
    id: str | None


class Privilege(ContractModel):
    code: str
    label: str
    description: str
    category: PrivilegeCategory
    securable_types: list[SecurableType]
    prerequisites: list[str]


class GrantSource(ContractModel):
    type: GrantSourceType
    securable_type: SecurableType | None
    full_name: str | None


class Grant(ContractModel):
    principal: str
    principal_kind: PrincipalKind | None
    privilege: str
    source: GrantSource
    allowed_actions: list[AllowedAction]


class GrantsData(ContractModel):
    target: AssetRef
    owner: str | None
    direct: list[Grant]
    inherited: list[Grant]
    group_membership_loaded: bool


class DependenciesData(ContractModel):
    known: list[Dependency]
    disclaimer: str


class AssetListResponse(SuccessResponse[list[AssetSummary]]):
    page: Page


class AssetDetailResponse(SuccessResponse[AssetDetail]):
    pass


class DependenciesResponse(SuccessResponse[DependenciesData]):
    pass


class PrincipalListResponse(SuccessResponse[list[Principal]]):
    page: Page


class PrivilegeListResponse(SuccessResponse[list[Privilege]]):
    pass


class GrantsResponse(SuccessResponse[GrantsData]):
    pass


class TagsData(ContractModel):
    target: AssetRef
    tags: list[Tag]
    column_tags: dict[str, list[Tag]]


class TagsResponse(SuccessResponse[TagsData]):
    pass


class TagPolicy(ContractModel):
    key: str
    description: str | None
    allowed_values: list[str] | None
    allowed_actions: list[AllowedAction]


class TagPolicyListResponse(SuccessResponse[list[TagPolicy]]):
    page: Page


class AbacPolicyType(StrEnum):
    ROW_FILTER = "row_filter"
    COLUMN_MASK = "column_mask"


class AbacPolicy(ContractModel):
    id: str
    name: str
    policy_type: AbacPolicyType
    scope: AssetRef
    when_condition: str
    to_principals: list[str]
    except_principals: list[str]
    function_full_name: str
    match_columns: list[str]
    owner: str | None
    created_at: UtcTimestamp | None
    updated_at: UtcTimestamp | None
    allowed_actions: list[AllowedAction]


class AbacPolicyResponse(SuccessResponse[AbacPolicy]):
    pass


class AbacPolicyListResponse(SuccessResponse[list[AbacPolicy]]):
    page: Page


class PolicyImpactData(ContractModel):
    potentially_affected: list[AssetSummary]
    disclaimer: str


class PolicyImpactResponse(SuccessResponse[PolicyImpactData]):
    pass


class RowAccessData(ContractModel):
    target: AssetRef
    row_filter: RowFilterRef | None
    column_masks: list[ColumnMaskRef]
    allowed_actions: list[AllowedAction]


class RowAccessResponse(SuccessResponse[RowAccessData]):
    pass


class FunctionParameter(ContractModel):
    name: str
    type_text: str
    position: int


class FunctionDetail(ContractModel):
    full_name: str
    owner: str | None
    comment: str | None
    return_type: str | None
    parameters: list[FunctionParameter]
    language: str | None
    dependents: list[Dependency]
    used_as_policy_function: bool | None
    allowed_actions: list[AllowedAction]


class FunctionDetailResponse(SuccessResponse[FunctionDetail]):
    pass


class StorageCredential(ContractModel):
    name: str
    owner: str | None
    cloud_provider: Literal[
        "aws_iam_role", "azure_managed_identity", "gcp_service_account", "unknown"
    ] | None
    read_only: bool | None
    isolation_mode: Literal["ISOLATION_MODE_OPEN", "ISOLATION_MODE_ISOLATED"] | None
    comment: str | None
    created_at: UtcTimestamp | None
    used_for_managed_storage: bool | None
    allowed_actions: list[AllowedAction]


class StorageCredentialListResponse(SuccessResponse[list[StorageCredential]]):
    page: Page


class ExternalLocation(ContractModel):
    name: str
    url: str
    credential_name: str | None
    owner: str | None
    read_only: bool | None
    isolation_mode: Literal["ISOLATION_MODE_OPEN", "ISOLATION_MODE_ISOLATED"] | None
    comment: str | None
    created_at: UtcTimestamp | None
    allowed_actions: list[AllowedAction]


class ExternalLocationListResponse(SuccessResponse[list[ExternalLocation]]):
    page: Page


class PlanKind(StrEnum):
    GRANT = "grant"
    REVOKE = "revoke"
    TRANSFER_OWNERSHIP = "transfer_ownership"
    EDIT_METADATA = "edit_metadata"
    ASSIGN_TAGS = "assign_tags"
    REMOVE_TAGS = "remove_tags"
    SET_ROW_FILTER = "set_row_filter"
    DROP_ROW_FILTER = "drop_row_filter"
    SET_COLUMN_MASK = "set_column_mask"
    DROP_COLUMN_MASK = "drop_column_mask"
    REPLACE_VIEW_DEFINITION = "replace_view_definition"
    DELETE_ASSET = "delete_asset"
    UPDATE_BINDING = "update_binding"
    CREATE_ABAC_POLICY = "create_abac_policy"
    UPDATE_ABAC_POLICY = "update_abac_policy"
    DELETE_ABAC_POLICY = "delete_abac_policy"
    UPDATE_SHARE_PERMISSIONS = "update_share_permissions"
    UPDATE_RECIPIENT = "update_recipient"
    CREATE_QUALITY_MONITOR = "create_quality_monitor"
    REFRESH_QUALITY_MONITOR = "refresh_quality_monitor"
    APPLY_ACCESS_REQUEST = "apply_access_request"


class PlanTarget(ContractModel):
    securable_type: SecurableType
    full_name: str


class PlanCreateRequest(ContractModel):
    kind: PlanKind
    targets: list[PlanTarget] = Field(min_length=1, max_length=50)
    changes: dict[str, object]
    reason: str = Field(min_length=3, max_length=200)
    access_request_id: UUID | None = None


class PlanStatus(StrEnum):
    PREVIEWED = "previewed"
    CONFIRMED = "confirmed"
    REVALIDATING = "revalidating"
    EXECUTING = "executing"
    APPLIED = "applied"
    PARTIALLY_APPLIED = "partially_applied"
    FAILED = "failed"
    UNKNOWN = "unknown"
    EXPIRED = "expired"
    STALE = "stale"
    INVALIDATED = "invalidated"


class NormalizedChange(ContractModel):
    target: AssetRef
    description: str
    statement_preview: str


class Impact(ContractModel):
    known: list[str]
    unknown: list[str]


class Plan(ContractModel):
    id: UUID
    kind: PlanKind
    status: PlanStatus
    identity: Identity
    workspace_id: str | None
    environment_label: str
    targets: list[AssetRef]
    normalized_changes: list[NormalizedChange]
    observed_state_hash: str
    impact: Impact
    prerequisite_notes: list[str]
    inheritance_note: str | None
    requires_typed_confirmation: bool
    typed_confirmation_value: str | None
    atomic: bool
    expires_at: UtcTimestamp
    confirmation_token: str
    created_at: UtcTimestamp
    invalidated_by: UUID | None
    access_request_id: UUID | None


class PlanResponse(SuccessResponse[Plan]):
    pass


class PlanExecuteRequest(ContractModel):
    confirmation_token: str
    typed_name: str | None = None


class OperationStatus(StrEnum):
    EXECUTING = "executing"
    APPLIED = "applied"
    PARTIALLY_APPLIED = "partially_applied"
    FAILED = "failed"
    UNKNOWN = "unknown"


class TargetOutcomeStatus(StrEnum):
    PENDING = "pending"
    APPLIED = "applied"
    FAILED = "failed"
    UNKNOWN = "unknown"
    SKIPPED = "skipped"


class TargetOutcomeError(ContractModel):
    code: ErrorCode
    message: str


class TargetOutcome(ContractModel):
    target: AssetRef
    status: TargetOutcomeStatus
    verified: bool
    verified_at: UtcTimestamp | None
    databricks_request_id: str | None
    error: TargetOutcomeError | None
    summary: str


class Operation(ContractModel):
    id: UUID
    plan_id: UUID
    kind: PlanKind
    status: OperationStatus
    identity: Identity
    started_at: UtcTimestamp
    finished_at: UtcTimestamp | None
    atomic: bool
    targets: list[TargetOutcome]
    reconcile_available: bool
    summary: str
    correlation_id: str


class OperationResponse(SuccessResponse[Operation]):
    pass
