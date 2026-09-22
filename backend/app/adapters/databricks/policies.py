"""ABAC-policy metadata reads using the pinned, introspected PoliciesAPI surface."""

from typing import TYPE_CHECKING

from app.adapters.databricks.common import CursorStore, boundary, enum_field, text_field, timestamp
from app.domain.enums import ObjectKind, SecurableType
from app.domain.models import AbacPolicy, AssetRef, AssetSummary
from app.errors import NotImplementedYet

if TYPE_CHECKING:
    from databricks.sdk.service.catalog import PoliciesAPI


UNAVAILABLE = "Unavailable from Databricks SDK response."


def _scope(value: object) -> AssetRef:
    raw_type = enum_field(value, "on_securable_type")
    raw_name = text_field(value, "on_securable_fullname")
    if raw_type is None or raw_name is None:
        raise ValueError("Databricks returned a policy without its scope.")
    normalized = raw_type.removeprefix("SECURABLE_TYPE_")
    try:
        securable_type = SecurableType(normalized)
        kind = ObjectKind(normalized.lower())
    except ValueError as exc:
        raise ValueError(f"Databricks returned unsupported policy scope '{raw_type}'.") from exc
    return AssetRef(
        securable_type=securable_type,
        full_name=raw_name,
        kind=kind,
        display_name=raw_name.rsplit(".", maxsplit=1)[-1],
    )


def _principals(value: object, field: str) -> tuple[str, ...]:
    raw = getattr(value, field, None)
    if raw is None:
        return ()
    if not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
        raise ValueError(f"Databricks returned invalid {field} on a policy.")
    return tuple(raw)


def _function_name(value: object) -> str:
    options = getattr(value, "row_filter", None) or getattr(value, "column_mask", None)
    if options is None:
        return UNAVAILABLE
    return text_field(options, "function_name") or UNAVAILABLE


def _policy(value: object) -> AbacPolicy:
    policy_id = text_field(value, "id")
    name = text_field(value, "name")
    raw_type = enum_field(value, "policy_type") or ""
    policy_type = {
        "POLICY_TYPE_ROW_FILTER": "row_filter",
        "POLICY_TYPE_COLUMN_MASK": "column_mask",
    }.get(raw_type)
    if policy_id is None or name is None or policy_type is None:
        raise ValueError("Databricks returned an unsupported or incomplete policy.")
    raw_matches = getattr(value, "match_columns", None) or []
    columns = tuple(
        text_field(item, "alias") or UNAVAILABLE for item in raw_matches if item is not None
    )
    return AbacPolicy(
        id=policy_id,
        name=name,
        policy_type=policy_type,  # type: ignore[arg-type]
        scope=_scope(value),
        when_condition=text_field(value, "when_condition") or UNAVAILABLE,
        to_principals=_principals(value, "to_principals"),
        except_principals=_principals(value, "except_principals"),
        function_full_name=_function_name(value),
        match_columns=columns,
        owner=text_field(value, "created_by"),
        created_at=timestamp(value, "created_at"),
        updated_at=timestamp(value, "updated_at"),
        allowed_actions=(),
    )


def _scope_type(name: str) -> str:
    count = len(name.split("."))
    if count == 1:
        return "CATALOG"
    if count == 2:
        return "SCHEMA"
    if count == 3:
        return "TABLE"
    raise NotImplementedYet("A policy scope must be a catalog, schema, or table name.")


class PoliciesAdapter:
    def __init__(self, policies: "PoliciesAPI", cursors: CursorStore, cursor_key: str) -> None:
        self.policies = policies
        self.cursors = cursors
        self.cursor_key = cursor_key

    @boundary
    def list_abac_policies(
        self, scope_full_name: str | None, page_size: int, page_token: str | None
    ) -> tuple[list[AbacPolicy], str | None]:
        if scope_full_name is None:
            raise NotImplementedYet(
                "Connected policy listing requires scope_full_name because the SDK list method "
                "requires an on-securable type and name."
            )
        scope_type = _scope_type(scope_full_name)
        values, token = self.cursors.page(
            lambda: iter(
                self.policies.list_policies(
                    scope_type,
                    scope_full_name,
                    include_inherited=True,
                    max_results=page_size,
                    page_token=None,
                )
            ),
            f"{self.cursor_key}:abac-policies:{scope_type}:{scope_full_name}",
            page_size,
            page_token,
        )
        return [_policy(value) for value in values], token

    def get_abac_policy(self, policy_id: str) -> AbacPolicy:
        raise NotImplementedYet(
            "The frozen policy-id route does not carry the scope and name required by the "
            "SDK get method."
        )

    def abac_policy_impact(
        self, policy_id: str, page_size: int
    ) -> tuple[list[AssetSummary], tuple[str, ...]]:
        raise NotImplementedYet()
