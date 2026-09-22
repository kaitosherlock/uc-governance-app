"""Fail-closed role table and managed-catalog scope policy."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from app.api.v1.models import AppRole, ErrorCode, Identity
from app.config.settings import Mode

READ_ACTIONS = frozenset(
    {
        "context.read",
        "identity.read",
        "capabilities.read",
        "assets.read",
        "catalogs.read",
        "schemas.read",
        "principals.read",
        "grants.read",
        "privileges.read",
        "tags.read",
        "tag_policies.read",
        "classification.read",
        "abac_policies.read",
        "filters.read",
        "storage.read",
        "bindings.read",
        "federation.read",
        "sharing.read",
        "lineage.read",
        "activity.read",
        "audit.read",
        "findings.read",
        "quality.read",
        "models.read",
        "serving_endpoints.read",
        "requests.read",
        "reviews.read",
        "plans.read",
        "operations.read",
    }
)
STEWARD_ACTIONS = frozenset(
    {
        "edit_metadata",
        "assign_tags",
        "remove_tags",
        "transfer_ownership",
        "review_findings",
    }
)
ACCESS_ACTIONS = frozenset(
    {
        "grant",
        "revoke",
        "transfer_ownership",
        "approve",
        "access_review",
        "apply_access_request",
    }
)
PLATFORM_ACTIONS = (
    STEWARD_ACTIONS
    | ACCESS_ACTIONS
    | frozenset(
        {
            "set_row_filter",
            "drop_row_filter",
            "set_column_mask",
            "drop_column_mask",
            "replace_view_definition",
            "delete_asset",
            "update_binding",
            "create_abac_policy",
            "update_abac_policy",
            "delete_abac_policy",
            "update_share_permissions",
            "update_recipient",
            "create_quality_monitor",
            "refresh_quality_monitor",
            "storage.create",
            "storage.update",
            "storage.delete",
            "federation.create",
            "federation.update",
            "federation.delete",
            "sharing.create",
            "sharing.update",
            "sharing.delete",
            "admin.read",
            "admin.update",
        }
    )
)
ROLE_ACTIONS: Mapping[AppRole, frozenset[str]] = {
    AppRole.VIEWER: READ_ACTIONS,
    AppRole.STEWARD: READ_ACTIONS | STEWARD_ACTIONS,
    AppRole.ACCESS_ADMIN: READ_ACTIONS | ACCESS_ACTIONS,
    AppRole.AUDITOR: READ_ACTIONS | {"export"},
    AppRole.PLATFORM_ADMIN: READ_ACTIONS | PLATFORM_ACTIONS | {"export"},
}


@dataclass(frozen=True)
class Target:
    # Callers supply a canonical catalog, never a guessed split of a quoted FQN.
    catalog: str | None = None


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason_code: ErrorCode | None
    reason: str | None


def roles_for_groups(
    groups: Iterable[str] | None,
    role_groups: Mapping[str, list[str]],
) -> list[AppRole]:
    """No verified group membership means viewer; never infer from forwarded headers."""
    if groups is None:
        return [AppRole.VIEWER]
    membership = set(groups)
    roles = [role for role in AppRole if membership.intersection(role_groups.get(role.value, []))]
    return roles or [AppRole.VIEWER]


def decide(
    identity: Identity,
    action: str,
    target: Target,
    *,
    managed_catalogs: Iterable[str] = (),
    mode: Mode = Mode.FIXTURE,
) -> Decision:
    managed = set(managed_catalogs)
    if target.catalog is not None and managed and target.catalog not in managed:
        return Decision(False, ErrorCode.FORBIDDEN_SCOPE, "Target is outside the managed scope.")
    if mode == Mode.CONNECTED_READONLY and action not in READ_ACTIONS | {"export", "admin.read"}:
        return Decision(False, ErrorCode.MODE_READ_ONLY, "This application is in read-only mode.")
    if any(action in ROLE_ACTIONS[role] for role in identity.actor.roles):
        return Decision(True, None, None)
    return Decision(False, ErrorCode.FORBIDDEN_ROLE, "Your role cannot request this action.")
