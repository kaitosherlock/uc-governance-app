"""Plain inputs and domain outputs; pagination never implies a full inventory."""

from typing import Protocol

from app.domain.models import (
    AbacPolicy,
    AssetDetail,
    AssetSummary,
    DependenciesData,
    Grant,
    Principal,
    Tag,
    TagPolicy,
)

# Distinguishes a missing metadata field from an explicit null comment.
METADATA_COMMENT_UNSET = object()


class CatalogReader(Protocol):
    def list_catalogs(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]: ...


class SchemaReader(Protocol):
    def list_schemas(
        self, catalog: str, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]: ...


class ObjectReader(Protocol):
    def list_objects(
        self, catalog: str, schema: str, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]: ...


class AssetReader(Protocol):
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail: ...


class GrantReader(Protocol):
    def direct_grants(
        self, securable_type: str, full_name: str, page_size: int, page_token: str | None
    ) -> tuple[list[Grant], str | None]: ...
    def effective_grants(
        self, securable_type: str, full_name: str, page_size: int, page_token: str | None
    ) -> tuple[list[Grant], str | None]: ...


class GrantWriter(Protocol):
    def update_grants(
        self,
        securable_type: str,
        full_name: str,
        principal: str,
        add: tuple[str, ...],
        remove: tuple[str, ...],
    ) -> None: ...


class PrincipalReader(Protocol):
    def search_principals(
        self, query: str, kinds: tuple[str, ...], page_size: int, page_token: str | None
    ) -> tuple[list[Principal], str | None]: ...


class DependencyReader(Protocol):
    def dependencies(self, securable_type: str, full_name: str) -> DependenciesData: ...


class TagReader(Protocol):
    def tags(
        self, securable_type: str, full_name: str
    ) -> tuple[tuple[Tag, ...], dict[str, tuple[Tag, ...]]]: ...

    def list_tag_policies(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[TagPolicy], str | None]: ...


class PolicyReader(Protocol):
    def list_abac_policies(
        self, scope_full_name: str | None, page_size: int, page_token: str | None
    ) -> tuple[list[AbacPolicy], str | None]: ...

    def get_abac_policy(self, policy_id: str) -> AbacPolicy: ...

    def abac_policy_impact(
        self, policy_id: str, page_size: int
    ) -> tuple[list[AssetSummary], tuple[str, ...]]: ...
