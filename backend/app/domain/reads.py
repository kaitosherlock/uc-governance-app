"""Read service policy, metadata limitations and safe action hints."""

from dataclasses import dataclass, replace

from app.adapters.protocols import (
    AssetReader,
    CatalogReader,
    DependencyReader,
    FunctionReader,
    GrantReader,
    ObjectReader,
    PolicyReader,
    PrincipalReader,
    SchemaReader,
    StorageReader,
    TagReader,
)
from app.api.v1.models import ErrorCode, Identity
from app.authz.roles import Target, decide
from app.config.settings import Settings
from app.domain.enums import ActionName, GrantSourceType, TagKind
from app.domain.models import (
    AbacPolicy,
    AllowedAction,
    AssetDetail,
    AssetSummary,
    ExternalLocation,
    FunctionDetail,
    Grant,
    GrantsData,
    StorageCredential,
    Tag,
    TagPolicy,
)
from app.domain.names import access_route, target_parts
from app.errors import AppError, ForbiddenScope

MEMBERSHIP_LIMITATION = (
    "Group membership was not loaded; access through group membership is not shown."
)


@dataclass(frozen=True)
class Readers:
    catalogs: CatalogReader
    schemas: SchemaReader
    objects: ObjectReader
    assets: AssetReader
    grants: GrantReader
    principals: PrincipalReader
    dependencies: DependencyReader
    functions: FunctionReader
    tags: TagReader
    policies: PolicyReader
    storage: StorageReader
    privilege_codes: tuple[str, ...]


class ReadPolicy:
    """One source of truth for tag action hints, including system-tag refusal."""

    @staticmethod
    def tag(tag: Tag, actions: tuple[AllowedAction, ...]) -> Tag:
        if tag.kind == TagKind.SYSTEM:
            actions = tuple(
                AllowedAction(
                    action=a,
                    allowed=False,
                    reason_code="SYSTEM_TAG",
                    reason="System-controlled tags cannot be edited.",
                )
                for a in (ActionName.ASSIGN_TAG, ActionName.REMOVE_TAG)
            )
        return replace(tag, allowed_actions=actions)


class ReadService:
    def __init__(self, readers: Readers, identity: Identity, settings: Settings) -> None:
        self.readers = readers
        self.identity = identity
        self.settings = settings

    def authorize(self, action: str, catalog: str | None = None) -> None:
        result = decide(
            self.identity,
            action,
            Target(catalog),
            managed_catalogs=self.settings.managed_catalogs,
            mode=self.settings.mode,
        )
        if not result.allowed:
            raise AppError(
                result.reason_code or ErrorCode.FORBIDDEN_ROLE,
                result.reason or "Read is not permitted.",
                403,
            )

    def catalog_for(self, stype: str, name: str) -> str | None:
        bits = target_parts(stype, name)
        if stype in ("CATALOG", "SCHEMA", "TABLE", "VOLUME", "FUNCTION", "REGISTERED_MODEL"):
            return bits[0]
        if self.settings.managed_catalogs:
            raise ForbiddenScope("This resource cannot be scoped to a managed catalog.")
        return None

    def action(self, action: ActionName, catalog: str | None) -> AllowedAction:
        names = {
            ActionName.DELETE: "delete_asset",
            ActionName.ASSIGN_TAG: "assign_tags",
            ActionName.REMOVE_TAG: "remove_tags",
        }
        result = decide(
            self.identity,
            names.get(action, action.value),
            Target(catalog),
            managed_catalogs=self.settings.managed_catalogs,
            mode=self.settings.mode,
        )
        if not result.allowed:
            codes = {
                ErrorCode.FORBIDDEN_ROLE: "ROLE_INSUFFICIENT",
                ErrorCode.FORBIDDEN_SCOPE: "OUT_OF_SCOPE",
                ErrorCode.MODE_READ_ONLY: "MODE_READ_ONLY",
            }
            code = codes.get(result.reason_code or ErrorCode.FORBIDDEN_ROLE, "UNKNOWN")
            # Construction through explicit literals keeps the contract's closed reason vocabulary.
            if code == "OUT_OF_SCOPE":
                return AllowedAction(
                    action=action, allowed=False, reason_code="OUT_OF_SCOPE", reason=result.reason
                )
            if code == "MODE_READ_ONLY":
                return AllowedAction(
                    action=action, allowed=False, reason_code="MODE_READ_ONLY", reason=result.reason
                )
            return AllowedAction(
                action=action, allowed=False, reason_code="ROLE_INSUFFICIENT", reason=result.reason
            )
        if action in {
            ActionName.GRANT,
            ActionName.REVOKE,
            ActionName.TRANSFER_OWNERSHIP,
            ActionName.EDIT_METADATA,
            ActionName.ASSIGN_TAG,
            ActionName.REMOVE_TAG,
            ActionName.SET_ROW_FILTER,
            ActionName.DROP_ROW_FILTER,
            ActionName.SET_COLUMN_MASK,
            ActionName.DROP_COLUMN_MASK,
        }:
            return AllowedAction(action=action, allowed=True)
        return AllowedAction(
            action=action,
            allowed=False,
            reason_code="NOT_IMPLEMENTED",
            reason="The plan lifecycle for this change is not implemented yet.",
        )

    def summary(self, asset: AssetSummary) -> AssetSummary:
        catalog = self.catalog_for(asset.securable_type, asset.full_name)
        actions = [
            self.action(a, catalog)
            for a in (
                ActionName.GRANT,
                ActionName.EDIT_METADATA,
                ActionName.TRANSFER_OWNERSHIP,
                ActionName.DELETE,
            )
        ]
        if asset.pipeline_managed:
            actions[1] = AllowedAction(
                action=ActionName.EDIT_METADATA,
                allowed=False,
                reason_code="PIPELINE_MANAGED",
                reason=(
                    "This object is managed by a pipeline. Edit its description in the pipeline "
                    "definition."
                ),
            )
        return replace(asset, allowed_actions=tuple(actions))

    def tag(self, tag: Tag, catalog: str | None) -> Tag:
        actions = tuple(
            self.action(a, catalog) for a in (ActionName.ASSIGN_TAG, ActionName.REMOVE_TAG)
        )
        return ReadPolicy.tag(tag, actions)

    def tag_policy(self, policy: TagPolicy) -> TagPolicy:
        return replace(
            policy,
            allowed_actions=(
                AllowedAction(
                    action=ActionName.ASSIGN_TAG,
                    allowed=False,
                    reason_code="UNKNOWN",
                    reason="Governed tag assignment authority could not be determined.",
                ),
            ),
        )

    def detail(self, stype: str, name: str) -> AssetDetail:
        catalog = self.catalog_for(stype, name)
        self.authorize("assets.read", catalog)
        asset = self.readers.assets.get_asset(stype, name)
        return replace(
            asset,
            allowed_actions=self.summary(asset).allowed_actions,
            tags=tuple(self.tag(t, catalog) for t in asset.tags),
            columns=tuple(
                replace(c, tags=tuple(self.tag(t, catalog) for t in c.tags)) for c in asset.columns
            ),
        )

    def tags(
        self, stype: str, name: str
    ) -> tuple[AssetDetail, tuple[Tag, ...], dict[str, tuple[Tag, ...]]]:
        catalog = self.catalog_for(stype, name)
        self.authorize("tags.read", catalog)
        asset = self.readers.assets.get_asset(stype, name)
        tags, column_tags = self.readers.tags.tags(stype, name)
        return (
            asset,
            tuple(self.tag(tag, catalog) for tag in tags),
            {
                column: tuple(self.tag(tag, catalog) for tag in values)
                for column, values in column_tags.items()
                if values
            },
        )

    def tag_policies(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[TagPolicy], str | None]:
        self.authorize("tag_policies.read")
        values, token = self.readers.tags.list_tag_policies(page_size, page_token)
        return [self.tag_policy(value) for value in values], token

    def storage_action(self, action: ActionName) -> AllowedAction:
        if self.settings.mode.value == "connected_readonly":
            return self.action(action, None)
        noun = "storage credential or external location"
        if action == ActionName.DELETE:
            return AllowedAction(
                action=action,
                allowed=False,
                reason_code="NOT_IMPLEMENTED",
                reason=(
                    "The frozen API contract defines no delete route or plan kind for this "
                    f"{noun}; delete_asset is not applied to this type."
                ),
            )
        return AllowedAction(
            action=action,
            allowed=False,
            reason_code="NOT_IMPLEMENTED",
            reason=(
                "The frozen API contract defines no route or plan kind for this "
                f"{action.value.replace('_', ' ')} action on a {noun}."
            ),
        )

    def storage_credentials(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[StorageCredential], str | None]:
        self.authorize("storage.read")
        values, token = self.readers.storage.list_storage_credentials(page_size, page_token)
        actions = tuple(
            self.storage_action(action)
            for action in (ActionName.EDIT_METADATA, ActionName.DELETE, ActionName.VALIDATE)
        )
        return [replace(value, allowed_actions=actions) for value in values], token

    def external_locations(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[ExternalLocation], str | None]:
        self.authorize("storage.read")
        values, token = self.readers.storage.list_external_locations(page_size, page_token)
        actions = tuple(
            self.storage_action(action)
            for action in (ActionName.EDIT_METADATA, ActionName.DELETE, ActionName.VALIDATE)
        )
        return [replace(value, allowed_actions=actions) for value in values], token

    def abac_policies(
        self, scope_full_name: str | None, page_size: int, page_token: str | None
    ) -> tuple[list[AbacPolicy], str | None]:
        if scope_full_name:
            self.authorize("abac_policies.read", scope_full_name.split(".")[0])
        else:
            self.authorize("abac_policies.read")
        values, token = self.readers.policies.list_abac_policies(
            scope_full_name, page_size, page_token
        )
        return values, token

    def abac_policy(self, policy_id: str) -> AbacPolicy:
        value = self.readers.policies.get_abac_policy(policy_id)
        self.authorize("abac_policies.read", value.scope.full_name.split(".")[0])
        return value

    def abac_policy_impact(
        self, policy_id: str, page_size: int
    ) -> tuple[AbacPolicy, list[AssetSummary], tuple[str, ...]]:
        policy = self.abac_policy(policy_id)
        values, unknown = self.readers.policies.abac_policy_impact(policy_id, page_size)
        visible = [
            value
            for value in values
            if not self.settings.managed_catalogs
            or value.full_name.split(".")[0] in self.settings.managed_catalogs
        ]
        if self.settings.managed_catalogs and policy.scope.full_name.split(".")[0] not in set(
            self.settings.managed_catalogs
        ):
            raise ForbiddenScope("Policy scope is outside the managed scope.")
        return policy, visible, unknown

    def row_access(self, name: str) -> AssetDetail:
        catalog = self.catalog_for("TABLE", name)
        self.authorize("filters.read", catalog)
        asset = self.readers.assets.get_asset("TABLE", name)
        if asset.securable_type.value != "TABLE":
            raise AppError(ErrorCode.NOT_FOUND, "The requested table was not found.", 404)
        return asset

    def function(self, name: str) -> FunctionDetail:
        catalog = self.catalog_for("FUNCTION", name)
        self.authorize("filters.read", catalog)
        return self.readers.functions.get_function(name)

    def explain(self, grant: Grant, catalog: str | None) -> Grant:
        if grant.source.type == GrantSourceType.INHERITED:
            action = AllowedAction(
                action=ActionName.REVOKE,
                allowed=False,
                reason_code="INHERITED_FROM_PARENT",
                reason="This privilege is inherited. Revoke it at the source.",
                navigate_to=access_route(grant.source.full_name)
                if grant.source.full_name
                else None,
            )
        elif grant.source.type == GrantSourceType.UNKNOWN:
            action = AllowedAction(
                action=ActionName.REVOKE,
                allowed=False,
                reason_code="UNKNOWN",
                reason="The source of this privilege is unknown.",
            )
        else:
            action = self.action(ActionName.REVOKE, catalog)
        return replace(grant, allowed_actions=(action,))

    def grants(
        self,
        stype: str,
        name: str,
        principal: str | None,
        privilege: str | None,
        source: str | None,
    ) -> tuple[GrantsData, list[str], bool]:
        catalog = self.catalog_for(stype, name)
        self.authorize("grants.read", catalog)
        target = self.detail(stype, name)
        direct, dt = self.readers.grants.direct_grants(stype, name, 200, None)
        effective, et = self.readers.grants.effective_grants(stype, name, 200, None)
        inherited = [g for g in effective if g.source.type != GrantSourceType.DIRECT]

        def matches(g: Grant) -> bool:
            return (
                (principal is None or g.principal == principal)
                and (privilege is None or g.privilege == privilege)
                and (source is None or g.source.type == source)
            )

        limitations = [
            MEMBERSHIP_LIMITATION,
            "Visible grants are not a complete effective-access calculation.",
        ]
        if dt or et:
            limitations.append(
                "Grants are limited to the first 200 assignments from each source; additional "
                "grants were not loaded."
            )
        return (
            GrantsData(
                target=target,
                owner=target.owner,
                direct=tuple(self.explain(g, catalog) for g in direct if matches(g)),
                inherited=tuple(self.explain(g, catalog) for g in inherited if matches(g)),
                group_membership_loaded=False,
            ),
            limitations,
            bool(dt or et),
        )
