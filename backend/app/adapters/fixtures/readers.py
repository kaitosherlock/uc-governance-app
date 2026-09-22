"""All read protocols plus isolated grant deltas for the future plan executor."""

import re
from dataclasses import replace
from datetime import UTC, datetime
from typing import TypeVar, cast

from app.adapters.protocols import METADATA_COMMENT_UNSET
from app.domain.enums import AttachmentSource, DependencyKind, GrantSourceType, SecurableType
from app.domain.models import (
    AbacPolicy,
    AssetDetail,
    AssetSummary,
    ColumnMaskRef,
    DependenciesData,
    Dependency,
    FunctionDetail,
    FunctionParameter,
    Grant,
    GrantSource,
    Principal,
    RowFilterRef,
    Tag,
    TagPolicy,
)
from app.errors import NotFound, ValidationFailed
from app.fixtures_data.dataset import (
    DEPENDENCIES,
    build_abac_policies,
    build_assets,
    build_grants,
    build_principals,
    build_tag_policies,
)

_HAS_TAG = re.compile(r"^has_tag\('([A-Za-z0-9_.-]+)'\)$")
_HAS_TAG_VALUE = re.compile(r"^has_tag_value\('([A-Za-z0-9_.-]+)',\s*'([^']+)'\)$")

T = TypeVar("T")


def page(items: list[T], size: int, token: str | None, scope: str) -> tuple[list[T], str | None]:
    size = max(1, min(size, 200))
    offset = 0
    if token:
        prefix, separator, number = token.rpartition(":")
        if not separator or prefix != scope or not number.isdecimal():
            raise ValidationFailed("Invalid page token for this listing.")
        offset = int(number)
        if offset > len(items):
            raise ValidationFailed("Page token is outside this listing.")
    end = offset + size
    return items[offset:end], f"{scope}:{end}" if end < len(items) else None


class FixtureReaders:
    def __init__(self) -> None:
        self.assets = build_assets()
        self.principals = build_principals()
        self.grants = build_grants()
        self.tag_policies = build_tag_policies()
        self.abac_policies = {value.id: value for value in build_abac_policies()}

    def list_catalogs(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]:
        values: list[AssetSummary] = [
            a for a in self.assets.values() if a.securable_type == SecurableType.CATALOG
        ]
        return page(values, page_size, page_token, "catalogs")

    def list_schemas(
        self, catalog: str, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]:
        self.get_asset("CATALOG", catalog)
        values: list[AssetSummary] = [
            a
            for a in self.assets.values()
            if a.securable_type == SecurableType.SCHEMA
            and a.parent
            and a.parent.full_name == catalog
        ]
        return page(values, page_size, page_token, f"schemas:{catalog}")

    def list_objects(
        self, catalog: str, schema: str, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]:
        self.get_asset("SCHEMA", f"{catalog}.{schema}")
        values: list[AssetSummary] = [
            a
            for a in self.assets.values()
            if a.parent and a.parent.full_name == f"{catalog}.{schema}"
        ]
        return page(values, page_size, page_token, f"objects:{catalog}.{schema}")

    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        result = self.assets.get((securable_type, full_name))
        if result is None:
            raise NotFound()
        return result

    def get_function(self, full_name: str) -> FunctionDetail:
        self.get_asset("FUNCTION", full_name)
        if full_name == "shared_ref.governance.normalize_id":
            return FunctionDetail(
                full_name=full_name,
                owner="shared_ref-owners",
                comment="Synthetic row filter predicate.",
                return_type="BOOLEAN",
                parameters=(FunctionParameter(name="id", type_text="BIGINT", position=0),),
                language="SQL",
                dependents=(
                    Dependency(
                        kind=DependencyKind.DOWNSTREAM_TABLE,
                        full_name="sales.crm.orders",
                        source="fixture",
                        verified=True,
                    ),
                ),
                used_as_policy_function=True,
                allowed_actions=(),
            )
        if full_name == "shared_ref.governance.mask_email":
            return FunctionDetail(
                full_name=full_name,
                owner="shared_ref-owners",
                comment="Synthetic email redaction function.",
                return_type="STRING",
                parameters=(FunctionParameter(name="email", type_text="STRING", position=0),),
                language="SQL",
                dependents=(
                    Dependency(
                        kind=DependencyKind.DOWNSTREAM_TABLE,
                        full_name="sales.crm.customers",
                        source="fixture",
                        verified=True,
                    ),
                ),
                used_as_policy_function=True,
                allowed_actions=(),
            )
        return FunctionDetail(
            full_name=full_name,
            owner=None,
            comment=None,
            return_type=None,
            parameters=(),
            language=None,
            dependents=(),
            used_as_policy_function=None,
            allowed_actions=(),
        )

    def direct_grants(
        self, securable_type: str, full_name: str, page_size: int, page_token: str | None
    ) -> tuple[list[Grant], str | None]:
        self.get_asset(securable_type, full_name)
        return page(
            self.grants.get((securable_type, full_name), []),
            page_size,
            page_token,
            f"direct:{full_name}",
        )

    def effective_grants(
        self, securable_type: str, full_name: str, page_size: int, page_token: str | None
    ) -> tuple[list[Grant], str | None]:
        asset = self.get_asset(securable_type, full_name)
        values = list(self.grants.get((securable_type, full_name), []))
        while asset.parent:
            parent = asset.parent
            values.extend(
                replace(g, source=replace(g.source, type=GrantSourceType.INHERITED))
                for g in self.grants.get((parent.securable_type, parent.full_name), [])
            )
            asset = self.get_asset(parent.securable_type, parent.full_name)
        return page(values, page_size, page_token, f"effective:{full_name}")

    def search_principals(
        self, query: str, kinds: tuple[str, ...], page_size: int, page_token: str | None
    ) -> tuple[list[Principal], str | None]:
        values = [
            p
            for p in self.principals
            if query.casefold() in p.display.casefold() and (not kinds or p.kind in kinds)
        ]
        return page(values, page_size, page_token, f"principals:{query}:{','.join(kinds)}")

    def dependencies(self, securable_type: str, full_name: str) -> DependenciesData:
        self.get_asset(securable_type, full_name)
        return DependenciesData(
            known=DEPENDENCIES.get(full_name, ()),
            disclaimer="Missing dependency information is not proof that deletion is safe.",
        )

    def tags(
        self, securable_type: str, full_name: str
    ) -> tuple[tuple[Tag, ...], dict[str, tuple[Tag, ...]]]:
        asset = self.get_asset(securable_type, full_name)
        return (
            asset.tags,
            {column.name: column.tags for column in asset.columns if column.tags},
        )

    def list_tag_policies(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[TagPolicy], str | None]:
        return page(list(self.tag_policies), page_size, page_token, "tag-policies")

    def list_abac_policies(
        self, scope_full_name: str | None, page_size: int, page_token: str | None
    ) -> tuple[list[AbacPolicy], str | None]:
        values = list(self.abac_policies.values())
        if scope_full_name is not None:
            values = [value for value in values if value.scope.full_name == scope_full_name]
        return page(values, page_size, page_token, f"abac-policies:{scope_full_name or 'visible'}")

    def get_abac_policy(self, policy_id: str) -> AbacPolicy:
        result = self.abac_policies.get(policy_id)
        if result is None:
            raise NotFound()
        return result

    @staticmethod
    def _matches_policy(asset: AssetSummary, policy: AbacPolicy) -> bool:
        if asset.securable_type != SecurableType.TABLE:
            return False
        condition = _HAS_TAG.fullmatch(policy.when_condition)
        key: str | None = None
        expected: str | None = None
        if condition:
            key = condition.group(1)
        else:
            condition = _HAS_TAG_VALUE.fullmatch(policy.when_condition)
            if condition:
                key, expected = condition.groups()
        if key is None:
            return False
        details = asset if isinstance(asset, AssetDetail) else None
        if details is None:
            return False
        tags = (
            details.tags
            if policy.policy_type == "row_filter"
            else tuple(tag for column in details.columns for tag in column.tags)
        )
        return any(tag.key == key and (expected is None or tag.value == expected) for tag in tags)

    def abac_policy_impact(
        self, policy_id: str, page_size: int
    ) -> tuple[list[AssetSummary], tuple[str, ...]]:
        return self.abac_policy_impact_for(self.get_abac_policy(policy_id), page_size)

    def abac_policy_impact_for(
        self, policy: AbacPolicy, page_size: int
    ) -> tuple[list[AssetSummary], tuple[str, ...]]:
        prefix = policy.scope.full_name + "."
        candidates = [
            asset
            for asset in self.assets.values()
            if asset.full_name == policy.scope.full_name or asset.full_name.startswith(prefix)
        ]
        known: list[AssetSummary] = [
            asset for asset in candidates if self._matches_policy(asset, policy)
        ]
        values, token = page(known, page_size, None, f"abac-impact:{policy.id}")
        unknown = [
            "Not evaluated by Databricks. This application matched only visible metadata tags; "
            "it did not execute the policy.",
            "Group membership and unresolved principals were not evaluated.",
            "Assets outside the caller's visible scope may also be affected.",
        ]
        if token:
            unknown.append(
                "Additional matching visible assets were not enumerated due to the page limit."
            )
        return values, tuple(unknown)

    def create_abac_policy(self, value: AbacPolicy) -> None:
        if value.id in self.abac_policies:
            raise ValidationFailed("An ABAC policy with this id already exists.")
        self.abac_policies[value.id] = value

    def update_abac_policy(self, policy_id: str, value: AbacPolicy) -> None:
        self.get_abac_policy(policy_id)
        self.abac_policies[policy_id] = replace(value, id=policy_id, updated_at=datetime.now(UTC))

    def delete_abac_policy(self, policy_id: str) -> None:
        self.get_abac_policy(policy_id)
        del self.abac_policies[policy_id]

    def update_tags(
        self,
        securable_type: str,
        full_name: str,
        column: str | None,
        assign: tuple[Tag, ...],
        remove: tuple[str, ...],
    ) -> None:
        asset = self.get_asset(securable_type, full_name)

        def update(current: tuple[Tag, ...]) -> tuple[Tag, ...]:
            assigned_keys = {item.key for item in assign}
            values = [
                tag for tag in current if tag.key not in remove and tag.key not in assigned_keys
            ]
            values.extend(assign)
            return tuple(values)

        if column is None:
            self.assets[(securable_type, full_name)] = replace(asset, tags=update(asset.tags))
            return
        if not any(item.name == column for item in asset.columns):
            raise ValidationFailed(f"Column '{column}' does not exist on '{full_name}'.")
        self.assets[(securable_type, full_name)] = replace(
            asset,
            columns=tuple(
                replace(item, tags=update(item.tags)) if item.name == column else item
                for item in asset.columns
            ),
        )

    def update_grants(
        self,
        securable_type: str,
        full_name: str,
        principal: str,
        add: tuple[str, ...],
        remove: tuple[str, ...],
    ) -> None:
        self.get_asset(securable_type, full_name)
        person = next((p for p in self.principals if p.name == principal), None)
        if person is None or not person.uc_eligible:
            raise ValidationFailed("The principal is not eligible for Unity Catalog grants.")
        key = (securable_type, full_name)
        current = [
            g
            for g in self.grants.get(key, [])
            if not (g.principal == principal and g.privilege in remove)
        ]
        for privilege in add:
            if not any(g.principal == principal and g.privilege == privilege for g in current):
                current.append(
                    Grant(
                        principal=principal,
                        principal_kind=person.kind,
                        privilege=privilege,
                        source=GrantSource(
                            type=GrantSourceType.DIRECT,
                            securable_type=SecurableType(securable_type),
                            full_name=full_name,
                        ),
                        allowed_actions=(),
                    )
                )
        self.grants[key] = current

    def transfer_ownership(self, securable_type: str, full_name: str, new_owner: str) -> None:
        asset = self.get_asset(securable_type, full_name)
        person = next((p for p in self.principals if p.name == new_owner), None)
        if person is None or not person.uc_eligible:
            raise ValidationFailed("The new owner is not eligible for Unity Catalog ownership.")
        self.assets[(securable_type, full_name)] = replace(asset, owner=new_owner)

    def update_metadata(
        self,
        securable_type: str,
        full_name: str,
        comment: str | None | object,
        properties: dict[str, str] | None,
        column_comments: dict[str, str | None] | None,
    ) -> None:
        asset = self.get_asset(securable_type, full_name)
        values = dict(asset.properties)
        if properties is not None:
            values.update(properties)
        columns = tuple(
            replace(column, comment=column_comments[column.name])
            if column_comments is not None and column.name in column_comments
            else column
            for column in asset.columns
        )
        self.assets[(securable_type, full_name)] = replace(
            asset,
            comment=(
                asset.comment if comment is METADATA_COMMENT_UNSET else cast(str | None, comment)
            ),
            properties=values,
            columns=columns,
        )

    def update_row_filter(
        self, full_name: str, function_full_name: str | None, input_columns: tuple[str, ...]
    ) -> None:
        asset = self.get_asset("TABLE", full_name)
        self.assets[("TABLE", full_name)] = replace(
            asset,
            row_filter=(
                None
                if function_full_name is None
                else RowFilterRef(
                    function_full_name=function_full_name,
                    input_columns=input_columns,
                    attached_via=AttachmentSource.DIRECT,
                )
            ),
        )

    def update_column_mask(
        self,
        full_name: str,
        column: str,
        function_full_name: str | None,
        using_columns: tuple[str, ...],
    ) -> None:
        asset = self.get_asset("TABLE", full_name)
        if not any(item.name == column for item in asset.columns):
            raise ValidationFailed(f"Column '{column}' does not exist on '{full_name}'.")
        self.assets[("TABLE", full_name)] = replace(
            asset,
            columns=tuple(
                replace(
                    item,
                    mask=(
                        None
                        if function_full_name is None
                        else ColumnMaskRef(
                            column=column,
                            function_full_name=function_full_name,
                            using_columns=using_columns,
                            attached_via=AttachmentSource.DIRECT,
                        )
                    ),
                )
                if item.name == column
                else item
                for item in asset.columns
            ),
        )

    def replace_view_definition(self, full_name: str, definition: str) -> None:
        asset = self.get_asset("TABLE", full_name)
        self.assets[("TABLE", full_name)] = replace(asset, view_definition=definition)
