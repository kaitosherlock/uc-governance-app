"""Frozen domain dataclasses; no SDK or API dependencies."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

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


@dataclass(frozen=True, kw_only=True)
class AllowedAction:
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


@dataclass(frozen=True, kw_only=True)
class AssetRef:
    securable_type: SecurableType
    full_name: str
    kind: ObjectKind
    display_name: str


@dataclass(frozen=True, kw_only=True)
class AssetSummary(AssetRef):
    securable_type: SecurableType
    full_name: str
    kind: ObjectKind
    display_name: str
    owner: str | None
    comment: str | None
    updated_at: datetime | None
    managed: ManagedStatus
    pipeline_managed: bool | None
    allowed_actions: tuple[AllowedAction, ...]


@dataclass(frozen=True, kw_only=True)
class Tag:
    key: str
    value: str | None
    kind: TagKind
    allowed_actions: tuple[AllowedAction, ...]


@dataclass(frozen=True, kw_only=True)
class TagPolicy:
    key: str
    description: str | None
    # None is an open value set; an empty tuple deliberately permits no values.
    allowed_values: tuple[str, ...] | None
    allowed_actions: tuple[AllowedAction, ...]


@dataclass(frozen=True, kw_only=True)
class RowFilterRef:
    function_full_name: str
    input_columns: tuple[str, ...]
    attached_via: AttachmentSource
    policy_id: str | None = None


@dataclass(frozen=True, kw_only=True)
class ColumnMaskRef:
    column: str
    function_full_name: str
    using_columns: tuple[str, ...]
    attached_via: AttachmentSource
    policy_id: str | None = None


@dataclass(frozen=True, kw_only=True)
class Column:
    name: str
    type_text: str
    nullable: bool | None
    comment: str | None
    position: int
    tags: tuple[Tag, ...]
    mask: ColumnMaskRef | None


@dataclass(frozen=True, kw_only=True)
class AssetDetail(AssetSummary):
    securable_type: SecurableType
    full_name: str
    kind: ObjectKind
    display_name: str
    owner: str | None
    comment: str | None
    updated_at: datetime | None
    managed: ManagedStatus
    pipeline_managed: bool | None
    allowed_actions: tuple[AllowedAction, ...]
    properties: dict[str, str]
    tags: tuple[Tag, ...]
    columns: tuple[Column, ...]
    row_filter: RowFilterRef | None
    view_definition: str | None
    storage_location: str | None
    table_type: str | None
    data_source_format: str | None
    created_at: datetime | None
    created_by: str | None
    parent: AssetRef | None
    raw: dict[str, object]


@dataclass(frozen=True, kw_only=True)
class Dependency:
    kind: DependencyKind
    full_name: str
    source: Literal[
        "unity_catalog_api",
        "account_api",
        "system_table",
        "durable_store",
        "application",
        "fixture",
    ]
    verified: bool


@dataclass(frozen=True, kw_only=True)
class Principal:
    name: str
    display: str
    kind: PrincipalKind
    scope: PrincipalScope
    uc_eligible: bool
    id: str | None


@dataclass(frozen=True, kw_only=True)
class Privilege:
    code: str
    label: str
    description: str
    category: PrivilegeCategory
    securable_types: tuple[SecurableType, ...]
    prerequisites: tuple[str, ...]


@dataclass(frozen=True, kw_only=True)
class GrantSource:
    type: GrantSourceType
    securable_type: SecurableType | None
    full_name: str | None


@dataclass(frozen=True, kw_only=True)
class Grant:
    principal: str
    principal_kind: PrincipalKind | None
    privilege: str
    source: GrantSource
    allowed_actions: tuple[AllowedAction, ...]


@dataclass(frozen=True, kw_only=True)
class GrantsData:
    target: AssetRef
    owner: str | None
    direct: tuple[Grant, ...]
    inherited: tuple[Grant, ...]
    group_membership_loaded: bool


@dataclass(frozen=True)
class DependenciesData:
    known: tuple[Dependency, ...]
    disclaimer: str
