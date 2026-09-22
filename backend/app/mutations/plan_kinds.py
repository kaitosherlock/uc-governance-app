"""Concrete, fixture-backed plan kinds for the mutation lifecycle.

The engine owns timing, authorization, HMAC binding, stale checks, and operation
state.  This module only turns a kind-specific request into honest reads/writes.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

from app.adapters.protocols import (
    METADATA_COMMENT_UNSET,
    AssetReader,
    GrantReader,
    GrantWriter,
    PrincipalReader,
    TagReader,
)
from app.api import mappers
from app.api.v1 import models as w
from app.domain.enums import ActionName, GrantSourceType, TagKind
from app.domain.models import AllowedAction, AssetDetail, Grant, Tag, TagPolicy
from app.domain.names import access_route, parts
from app.domain.privileges import APPLICABILITY
from app.domain.reads import ReadPolicy
from app.errors import NotImplementedYet, ValidationFailed
from app.mutations.core import MutationWriteResult, PlanKindHandler, Preview


class MutationAdapter(AssetReader, GrantReader, GrantWriter, PrincipalReader, TagReader, Protocol):
    """Reads and writes needed by the four registered plan kinds."""

    def transfer_ownership(self, securable_type: str, full_name: str, new_owner: str) -> None: ...

    def update_metadata(
        self,
        securable_type: str,
        full_name: str,
        comment: str | None | object,
        properties: dict[str, str] | None,
        column_comments: dict[str, str | None] | None,
    ) -> None: ...

    def update_tags(
        self,
        securable_type: str,
        full_name: str,
        column: str | None,
        assign: tuple[Tag, ...],
        remove: tuple[str, ...],
    ) -> None: ...


def _field_error(field: str, code: str, message: str) -> ValidationFailed:
    return ValidationFailed(message, errors=[w.FieldError(field=field, code=code, message=message)])


def _string(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise _field_error(field, "INVALID", f"{field} must be a non-empty string.")
    return value


def _json(value: object) -> str:
    """Quote every user-controlled statement-preview value as a JSON literal."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _statement(method: str, target: w.AssetRef, **arguments: object) -> str:
    values = [
        f"securable_type={_json(target.securable_type.value)}",
        f"full_name={_json(target.full_name)}",
    ]
    values.extend(f"{name}={_json(value)}" for name, value in arguments.items())
    return f"{method}({', '.join(values)})"


@dataclass(frozen=True)
class _GrantChanges:
    principal: str
    privileges: tuple[str, ...]


@dataclass(frozen=True)
class _TagChange:
    key: str
    value: str | None
    has_value: bool


@dataclass(frozen=True)
class _TagChanges:
    column: str | None
    tags: tuple[_TagChange, ...]


class RegisteredPlanKind(PlanKindHandler):
    """Registration guard for connected deployments without a write adapter yet.

    MutationEngine authorizes after resolving a handler, so this lets its
    connected_readonly guard return MODE_READ_ONLY instead of NOT_IMPLEMENTED.
    """

    def __init__(self, kind: w.PlanKind) -> None:
        self.kind = kind

    def preview(self, request: w.PlanCreateRequest) -> Preview:
        raise NotImplementedYet("A connected write adapter is not configured for this plan kind.")

    def observe(self, target: w.AssetRef) -> object:
        raise NotImplementedYet()

    def apply(self, target: w.AssetRef, changes: dict[str, object]) -> MutationWriteResult:
        raise NotImplementedYet()

    def verify(self, target: w.AssetRef, changes: dict[str, object]) -> bool | None:
        raise NotImplementedYet()


class FixturePlanKindHandler(PlanKindHandler):
    """One handler implementation, parameterized by one of the four plan kinds."""

    def __init__(
        self, kind: w.PlanKind, adapter: MutationAdapter, privilege_codes: tuple[str, ...]
    ) -> None:
        self.kind = kind
        self.adapter = adapter
        self.privilege_codes = frozenset(privilege_codes)

    def _asset(self, target: w.PlanTarget | w.AssetRef) -> tuple[w.AssetRef, AssetDetail]:
        asset = self.adapter.get_asset(target.securable_type.value, target.full_name)
        return mappers.map_AssetRef(asset), asset

    def _principal(self, name: str, field: str) -> None:
        values, _ = self.adapter.search_principals(name, (), 200, None)
        value = next((principal for principal in values if principal.name == name), None)
        if value is None:
            raise _field_error(field, "NOT_FOUND", f"Principal '{name}' was not found.")
        if not value.uc_eligible:
            raise _field_error(
                field,
                "NOT_UC_ELIGIBLE",
                (
                    f"Principal '{name}' is not eligible for Unity Catalog grants because it is "
                    "workspace-local."
                ),
            )

    def _grant_changes(self, changes: dict[str, object], stype: str) -> _GrantChanges:
        if set(changes) != {"principal", "privileges"}:
            raise _field_error(
                "changes",
                "INVALID",
                "Grant and revoke changes require only principal and privileges.",
            )
        principal = _string(changes.get("principal"), "changes.principal")
        raw_privileges = changes.get("privileges")
        if (
            not isinstance(raw_privileges, list)
            or not 1 <= len(raw_privileges) <= 20
            or any(not isinstance(value, str) or not value for value in raw_privileges)
        ):
            raise _field_error(
                "changes.privileges", "INVALID", "privileges must contain 1 to 20 codes."
            )
        privileges = tuple(dict.fromkeys(raw_privileges))
        for privilege in privileges:
            if privilege not in self.privilege_codes or stype not in APPLICABILITY.get(
                privilege, ()
            ):
                raise _field_error(
                    "changes.privileges",
                    "INVALID_FOR_SECURABLE_TYPE",
                    f"Privilege '{privilege}' is not valid for securable type '{stype}'.",
                )
        self._principal(principal, "changes.principal")
        return _GrantChanges(principal=principal, privileges=privileges)

    def _metadata_changes(
        self, changes: dict[str, object], asset: AssetDetail
    ) -> tuple[str | None | object, dict[str, str] | None, dict[str, str | None] | None]:
        allowed = {"comment", "properties", "column_comments"}
        if not changes or not set(changes).issubset(allowed):
            raise _field_error(
                "changes",
                "INVALID",
                "Metadata changes must contain comment, properties, or column_comments.",
            )
        comment: str | None | object = METADATA_COMMENT_UNSET
        if "comment" in changes:
            raw_comment = changes["comment"]
            if raw_comment is not None and (
                not isinstance(raw_comment, str) or len(raw_comment) > 4000
            ):
                raise _field_error(
                    "changes.comment",
                    "INVALID",
                    "comment must be null or a string up to 4000 characters.",
                )
            comment = raw_comment
        properties: dict[str, str] | None = None
        if "properties" in changes:
            raw_properties = changes["properties"]
            if not isinstance(raw_properties, dict) or any(
                not isinstance(key, str) or not isinstance(value, str)
                for key, value in raw_properties.items()
            ):
                raise _field_error(
                    "changes.properties", "INVALID", "properties must map strings to strings."
                )
            properties = dict(raw_properties)
        column_comments: dict[str, str | None] | None = None
        if "column_comments" in changes:
            raw_columns = changes["column_comments"]
            if not isinstance(raw_columns, dict) or any(
                not isinstance(key, str) or (value is not None and not isinstance(value, str))
                for key, value in raw_columns.items()
            ):
                raise _field_error(
                    "changes.column_comments",
                    "INVALID",
                    "column_comments must map names to strings or null.",
                )
            known_columns = {column.name for column in asset.columns}
            unknown = next((name for name in raw_columns if name not in known_columns), None)
            if unknown is not None:
                raise _field_error(
                    "changes.column_comments",
                    "NOT_FOUND",
                    f"Column '{unknown}' does not exist on '{asset.full_name}'.",
                )
            column_comments = dict(raw_columns)
        return comment, properties, column_comments

    def _ownership_changes(self, changes: dict[str, object]) -> str:
        if set(changes) != {"new_owner"}:
            raise _field_error("changes", "INVALID", "Ownership changes require only new_owner.")
        owner = _string(changes.get("new_owner"), "changes.new_owner")
        self._principal(owner, "changes.new_owner")
        return owner

    def _tag_changes(self, changes: dict[str, object], asset: AssetDetail) -> _TagChanges:
        if not changes or not set(changes).issubset({"column", "tags"}) or "tags" not in changes:
            raise _field_error(
                "changes", "INVALID", "Tag changes require tags and optional column."
            )
        column = changes.get("column")
        if column is not None and (not isinstance(column, str) or not column.strip()):
            raise _field_error(
                "changes.column", "INVALID", "column must be null or a non-empty string."
            )
        if column is not None and not any(item.name == column for item in asset.columns):
            raise _field_error(
                "changes.column",
                "NOT_FOUND",
                f"Column '{column}' does not exist on '{asset.full_name}'.",
            )
        raw_tags = changes.get("tags")
        if not isinstance(raw_tags, list) or not raw_tags:
            raise _field_error("changes.tags", "INVALID", "tags must contain at least one tag.")
        parsed: list[_TagChange] = []
        for index, raw in enumerate(raw_tags):
            field = f"changes.tags[{index}]"
            if not isinstance(raw, dict) or set(raw) - {"key", "value"} or "key" not in raw:
                raise _field_error(
                    field, "INVALID", "Each tag must contain key and optional value."
                )
            key = _string(raw.get("key"), f"{field}.key")
            value = raw.get("value")
            if value is not None and not isinstance(value, str):
                raise _field_error(f"{field}.value", "INVALID", "value must be a string or null.")
            parsed.append(_TagChange(key=key, value=value, has_value="value" in raw))
        if len({item.key for item in parsed}) != len(parsed):
            raise _field_error(
                "changes.tags", "DUPLICATE", "Each tag key may appear only once per plan."
            )
        return _TagChanges(column=column, tags=tuple(parsed))

    @staticmethod
    def _tags_at(asset: AssetDetail, column: str | None) -> tuple[Tag, ...]:
        if column is None:
            return asset.tags
        value = next(item for item in asset.columns if item.name == column)
        return value.tags

    def _policies(self) -> dict[str, TagPolicy]:
        values, token = self.adapter.list_tag_policies(200, None)
        if token:
            raise _field_error(
                "changes.tags", "UNKNOWN", "The tag-policy listing is incomplete; retry later."
            )
        return {value.key: value for value in values}

    @staticmethod
    def _tag_kind(current: Tag | None, policy: TagPolicy | None) -> TagKind:
        if current is not None:
            return current.kind
        return TagKind.GOVERNED if policy is not None else TagKind.FREE_FORM

    def _validate_tag_change(
        self,
        change: _TagChange,
        current: Tag | None,
        policy: TagPolicy | None,
    ) -> TagKind:
        kind = self._tag_kind(current, policy)
        candidate = current or Tag(
            key=change.key, value=change.value, kind=kind, allowed_actions=()
        )
        actions = tuple(
            AllowedAction(action=action, allowed=True)
            for action in (ActionName.ASSIGN_TAG, ActionName.REMOVE_TAG)
        )
        evaluated = ReadPolicy.tag(candidate, actions)
        action_name = (
            ActionName.ASSIGN_TAG if self.kind == w.PlanKind.ASSIGN_TAGS else ActionName.REMOVE_TAG
        )
        action = next(item for item in evaluated.allowed_actions if item.action == action_name)
        if not action.allowed:
            raise _field_error(
                "changes.tags", action.reason_code or "INVALID", action.reason or "Tag rejected."
            )
        if (
            self.kind == w.PlanKind.ASSIGN_TAGS
            and kind == TagKind.GOVERNED
            and policy
            and policy.allowed_values is not None
            and change.value not in policy.allowed_values
        ):
            permitted = ", ".join(repr(value) for value in policy.allowed_values)
            raise _field_error(
                "changes.tags",
                "INVALID_VALUE",
                (
                    f"Tag '{change.key}' value {change.value!r} is not permitted; "
                    f"allowed values: [{permitted}]."
                ),
            )
        return kind

    @staticmethod
    def _tag_impact(key: str, verb: str) -> str:
        return (
            f"Row filters, column masks or ABAC policies keyed on tag '{key}' may begin or cease "
            f"to apply after this {verb}; the app has not evaluated them."
        )

    @staticmethod
    def _metadata_matches(
        asset: AssetDetail,
        comment: str | None | object,
        properties: dict[str, str] | None,
        column_comments: dict[str, str | None] | None,
    ) -> bool:
        columns = {column.name: column.comment for column in asset.columns}
        return (
            (comment is METADATA_COMMENT_UNSET or comment == asset.comment)
            and (
                properties is None
                or all(asset.properties.get(key) == value for key, value in properties.items())
            )
            and (
                column_comments is None
                or all(columns.get(key) == value for key, value in column_comments.items())
            )
        )

    def _state(self, target: w.AssetRef) -> object:
        asset = self.adapter.get_asset(target.securable_type.value, target.full_name)
        direct, _ = self.adapter.direct_grants(
            target.securable_type.value, target.full_name, 200, None
        )
        effective, _ = self.adapter.effective_grants(
            target.securable_type.value, target.full_name, 200, None
        )
        return {
            "asset": {
                "owner": asset.owner,
                "comment": asset.comment,
                "properties": asset.properties,
                "columns": {column.name: column.comment for column in asset.columns},
                "tags": [(tag.key, tag.value, tag.kind.value) for tag in asset.tags],
                "column_tags": {
                    column.name: [(tag.key, tag.value, tag.kind.value) for tag in column.tags]
                    for column in asset.columns
                    if column.tags
                },
            },
            "direct": self._grants_state(direct),
            "effective": self._grants_state(effective),
        }

    @staticmethod
    def _grants_state(values: list[Grant]) -> list[dict[str, str | None]]:
        return sorted(
            [
                {
                    "principal": value.principal,
                    "privilege": value.privilege,
                    "source": value.source.type.value,
                    "source_name": value.source.full_name,
                }
                for value in values
            ],
            key=lambda value: (
                str(value["principal"]),
                str(value["privilege"]),
                str(value["source"]),
            ),
        )

    def _direct(self, target: w.AssetRef, principal: str) -> list[Grant]:
        values, _ = self.adapter.direct_grants(
            target.securable_type.value, target.full_name, 200, None
        )
        return [value for value in values if value.principal == principal]

    def _effective(self, target: w.AssetRef, principal: str) -> list[Grant]:
        values, _ = self.adapter.effective_grants(
            target.securable_type.value, target.full_name, 200, None
        )
        return [value for value in values if value.principal == principal]

    def _prerequisites(self, target: w.AssetRef, changes: _GrantChanges) -> tuple[str, ...]:
        target_parts = parts(target.full_name)
        if len(target_parts) < 2:
            return ()
        effective = self._effective(target, changes.principal)
        existing = {value.privilege for value in effective}
        required: list[tuple[str, str]] = []
        if len(target_parts) == 3:
            required = [
                ("USE_CATALOG", target_parts[0]),
                ("USE_SCHEMA", ".".join(target_parts[:2])),
            ]
        elif len(target_parts) == 2:
            required = [("USE_CATALOG", target_parts[0])]
        missing = [
            code for code, _ in required if code not in existing and code not in changes.privileges
        ]
        if not missing:
            return ()
        rendered = " and ".join(f"{code} on {name}" for code, name in required if code in missing)
        return (
            f"`{changes.principal}` also needs {rendered} to use this grant. "
            "Those privileges are not included in this change.",
        )

    @staticmethod
    def _inheritance(target: w.AssetRef) -> str | None:
        if target.securable_type.value == "CATALOG":
            return "A direct catalog privilege may be inherited by child securables."
        if target.securable_type.value == "SCHEMA":
            return "A direct schema privilege may be inherited by child securables."
        return None

    def preview(self, request: w.PlanCreateRequest) -> Preview:
        targets: list[w.AssetRef] = []
        normalized: list[w.NormalizedChange] = []
        observed: list[object] = []
        known: list[str] = []
        unknown = [
            "Group membership and other access paths are not fully determined; visible grants "
            "are not a complete effective-access calculation."
        ]
        prerequisites: list[str] = []
        inheritance: str | None = None
        for requested in request.targets:
            target, asset = self._asset(requested)
            targets.append(target)
            observed.append(self._state(target))
            if self.kind in (w.PlanKind.GRANT, w.PlanKind.REVOKE):
                changes = self._grant_changes(request.changes, target.securable_type.value)
                direct = {value.privilege for value in self._direct(target, changes.principal)}
                if self.kind == w.PlanKind.REVOKE:
                    inherited = [
                        value
                        for value in self._effective(target, changes.principal)
                        if value.privilege in changes.privileges
                        and value.source.type == GrantSourceType.INHERITED
                    ]
                    if inherited:
                        source = inherited[0].source
                        route = (
                            access_route(source.full_name)
                            if source.full_name
                            else "the source object"
                        )
                        raise _field_error(
                            "targets",
                            "INHERITED_FROM_PARENT",
                            f"Privilege '{inherited[0].privilege}' is inherited from "
                            f"'{source.full_name}'. Revoke it at {route}.",
                        )
                changed = [
                    privilege
                    for privilege in changes.privileges
                    if (privilege not in direct) == (self.kind == w.PlanKind.GRANT)
                ]
                noops = [privilege for privilege in changes.privileges if privilege not in changed]
                verb = "Grant" if self.kind == w.PlanKind.GRANT else "Revoke"
                if changed:
                    normalized.append(
                        w.NormalizedChange(
                            target=target,
                            description=(
                                f"{verb} {', '.join(changed)} "
                                f"{'to' if verb == 'Grant' else 'from'} "
                                f"`{changes.principal}` on `{target.full_name}`."
                            ),
                            statement_preview=_statement(
                                "grants.update",
                                target,
                                principal=changes.principal,
                                **({"add": changed} if verb == "Grant" else {"remove": changed}),
                            ),
                        )
                    )
                    known.append(
                        f"{'Adds' if verb == 'Grant' else 'Removes'} direct "
                        f"{', '.join(changed)} privilege(s) on `{target.full_name}` "
                        f"for `{changes.principal}`."
                    )
                if noops:
                    normalized.append(
                        w.NormalizedChange(
                            target=target,
                            description=(
                                f"No change: `{changes.principal}` "
                                f"{'already holds' if verb == 'Grant' else 'does not hold'} "
                                f"direct {', '.join(noops)} on `{target.full_name}`."
                            ),
                            statement_preview=(
                                "No request will be sent for this direct-grant no-op."
                            ),
                        )
                    )
                prerequisites.extend(
                    self._prerequisites(target, changes) if verb == "Grant" else ()
                )
                inheritance = inheritance or self._inheritance(target)
                unknown.append(
                    f"Whether `{changes.principal}` retains or receives this access through "
                    "another group or parent grant cannot be determined."
                )
            elif self.kind == w.PlanKind.TRANSFER_OWNERSHIP:
                new_owner = self._ownership_changes(request.changes)
                no_op = asset.owner == new_owner
                normalized.append(
                    w.NormalizedChange(
                        target=target,
                        description=(
                            f"No change: `{new_owner}` already owns `{target.full_name}`."
                            if no_op
                            else f"Transfer ownership of `{target.full_name}` to `{new_owner}`."
                        ),
                        statement_preview=(
                            "No request will be sent for this ownership no-op."
                            if no_op
                            else _statement(
                                "assets.transfer_ownership", target, new_owner=new_owner
                            )
                        ),
                    )
                )
                known.append(
                    f"Current owner `{asset.owner or 'Unknown'}` will lose ownership of "
                    f"`{target.full_name}`."
                )
                unknown.append(
                    "Downstream effects of the ownership change cannot be fully determined."
                )
            elif self.kind == w.PlanKind.EDIT_METADATA:
                comment, properties, column_comments = self._metadata_changes(
                    request.changes, asset
                )
                no_op = self._metadata_matches(asset, comment, properties, column_comments)
                normalized.append(
                    w.NormalizedChange(
                        target=target,
                        description=(
                            f"No change: metadata on `{target.full_name}` already matches "
                            "the requested values."
                            if no_op
                            else f"Update metadata on `{target.full_name}`."
                        ),
                        statement_preview=(
                            "No request will be sent for this metadata no-op."
                            if no_op
                            else _statement(
                                "assets.update_metadata", target, changes=request.changes
                            )
                        ),
                    )
                )
                known.append(f"Updates only the requested metadata fields on `{target.full_name}`.")
                unknown.append(
                    "Effects of metadata changes on external documentation consumers are not known."
                )
            elif self.kind in (w.PlanKind.ASSIGN_TAGS, w.PlanKind.REMOVE_TAGS):
                tag_changes = self._tag_changes(request.changes, asset)
                current = {tag.key: tag for tag in self._tags_at(asset, tag_changes.column)}
                policies = self._policies()
                verb = "assign" if self.kind == w.PlanKind.ASSIGN_TAGS else "remove"
                location = (
                    f"column `{tag_changes.column}` on `{target.full_name}`"
                    if tag_changes.column is not None
                    else f"`{target.full_name}`"
                )
                for change in tag_changes.tags:
                    old = current.get(change.key)
                    kind = self._validate_tag_change(change, old, policies.get(change.key))
                    if self.kind == w.PlanKind.ASSIGN_TAGS:
                        no_op = old is not None and old.value == change.value
                        description = (
                            (
                                f"No change: tag `{change.key}` already has value "
                                f"{change.value!r} on {location}."
                            )
                            if no_op
                            else (
                                (
                                    f"Replace tag `{change.key}` value {old.value!r} with "
                                    f"{change.value!r} on {location}."
                                )
                                if old is not None
                                else (
                                    f"Assign tag `{change.key}` value {change.value!r} "
                                    f"on {location}."
                                )
                            )
                        )
                        statement = (
                            "No request will be sent for this tag no-op."
                            if no_op
                            else _statement(
                                "entity_tag_assignments.update"
                                if old is not None
                                else "entity_tag_assignments.create",
                                target,
                                column=tag_changes.column,
                                tag_key=change.key,
                                tag_value=change.value,
                                kind=kind.value,
                            )
                        )
                    else:
                        no_op = old is None
                        description = (
                            f"No change: tag `{change.key}` is not present on {location}."
                            if no_op
                            else f"Remove tag `{change.key}` from {location}."
                        )
                        statement = (
                            "No request will be sent for this tag no-op."
                            if no_op
                            else _statement(
                                "entity_tag_assignments.delete",
                                target,
                                column=tag_changes.column,
                                tag_key=change.key,
                            )
                        )
                    normalized.append(
                        w.NormalizedChange(
                            target=target, description=description, statement_preview=statement
                        )
                    )
                    unknown.append(self._tag_impact(change.key, verb))
                    if kind == TagKind.GOVERNED and self.kind == w.PlanKind.ASSIGN_TAGS:
                        prerequisites.append(
                            "Governed tag assignment authority could not be determined; fixture "
                            "execution simulates the requested change only."
                        )
            else:
                raise NotImplementedYet()
        return Preview(
            targets=tuple(targets),
            normalized_changes=tuple(normalized),
            observed_states=tuple(observed),
            impact=w.Impact(known=known, unknown=unknown),
            prerequisite_notes=tuple(dict.fromkeys(prerequisites)),
            inheritance_note=inheritance,
            requires_typed_confirmation=self.kind == w.PlanKind.TRANSFER_OWNERSHIP,
            typed_confirmation_value=targets[0].full_name
            if self.kind == w.PlanKind.TRANSFER_OWNERSHIP
            else None,
        )

    def observe(self, target: w.AssetRef) -> object:
        return self._state(target)

    def apply(self, target: w.AssetRef, changes: dict[str, object]) -> MutationWriteResult:
        if self.kind in (w.PlanKind.GRANT, w.PlanKind.REVOKE):
            delta = self._grant_changes(changes, target.securable_type.value)
            direct = {value.privilege for value in self._direct(target, delta.principal)}
            selected = tuple(
                privilege
                for privilege in delta.privileges
                if (privilege not in direct) == (self.kind == w.PlanKind.GRANT)
            )
            if not selected:
                return MutationWriteResult(
                    status="applied",
                    summary=(
                        "No write was necessary; the direct grant is already in the requested "
                        "state."
                    ),
                )
            self.adapter.update_grants(
                target.securable_type.value,
                target.full_name,
                delta.principal,
                selected if self.kind == w.PlanKind.GRANT else (),
                selected if self.kind == w.PlanKind.REVOKE else (),
            )
            return MutationWriteResult(status="applied", summary="Direct privilege delta was sent.")
        if self.kind == w.PlanKind.TRANSFER_OWNERSHIP:
            owner = self._ownership_changes(changes)
            if self.adapter.get_asset(target.securable_type.value, target.full_name).owner != owner:
                self.adapter.transfer_ownership(
                    target.securable_type.value, target.full_name, owner
                )
            return MutationWriteResult(status="applied", summary="Ownership change was sent.")
        if self.kind == w.PlanKind.EDIT_METADATA:
            asset = self.adapter.get_asset(target.securable_type.value, target.full_name)
            comment, properties, column_comments = self._metadata_changes(changes, asset)
            if self._metadata_matches(asset, comment, properties, column_comments):
                return MutationWriteResult(
                    status="applied", summary="No write was necessary; metadata already matches."
                )
            self.adapter.update_metadata(
                target.securable_type.value, target.full_name, comment, properties, column_comments
            )
            return MutationWriteResult(status="applied", summary="Metadata update was sent.")
        if self.kind in (w.PlanKind.ASSIGN_TAGS, w.PlanKind.REMOVE_TAGS):
            asset = self.adapter.get_asset(target.securable_type.value, target.full_name)
            tag_delta = self._tag_changes(changes, asset)
            current = {tag.key: tag for tag in self._tags_at(asset, tag_delta.column)}
            policies = self._policies()
            selected_assign: list[Tag] = []
            selected_remove: list[str] = []
            for change in tag_delta.tags:
                old = current.get(change.key)
                kind = self._validate_tag_change(change, old, policies.get(change.key))
                if self.kind == w.PlanKind.ASSIGN_TAGS:
                    if old is None or old.value != change.value:
                        selected_assign.append(
                            Tag(key=change.key, value=change.value, kind=kind, allowed_actions=())
                        )
                elif old is not None:
                    selected_remove.append(change.key)
            if not selected_assign and not selected_remove:
                return MutationWriteResult(
                    status="applied", summary="No write was necessary; tags already match."
                )
            self.adapter.update_tags(
                target.securable_type.value,
                target.full_name,
                tag_delta.column,
                tuple(selected_assign),
                tuple(selected_remove),
            )
            return MutationWriteResult(status="applied", summary="Tag changes were sent.")
        raise NotImplementedYet()

    def verify(self, target: w.AssetRef, changes: dict[str, object]) -> bool | None:
        if self.kind in (w.PlanKind.GRANT, w.PlanKind.REVOKE):
            delta = self._grant_changes(changes, target.securable_type.value)
            direct = {value.privilege for value in self._direct(target, delta.principal)}
            return all(
                (privilege in direct) == (self.kind == w.PlanKind.GRANT)
                for privilege in delta.privileges
            )
        if self.kind == w.PlanKind.TRANSFER_OWNERSHIP:
            return self.adapter.get_asset(
                target.securable_type.value, target.full_name
            ).owner == self._ownership_changes(changes)
        if self.kind == w.PlanKind.EDIT_METADATA:
            asset = self.adapter.get_asset(target.securable_type.value, target.full_name)
            comment, properties, column_comments = self._metadata_changes(changes, asset)
            return self._metadata_matches(asset, comment, properties, column_comments)
        if self.kind in (w.PlanKind.ASSIGN_TAGS, w.PlanKind.REMOVE_TAGS):
            asset = self.adapter.get_asset(target.securable_type.value, target.full_name)
            tag_delta = self._tag_changes(changes, asset)
            current = {tag.key: tag for tag in self._tags_at(asset, tag_delta.column)}
            if self.kind == w.PlanKind.ASSIGN_TAGS:
                return all(
                    (
                        current.get(change.key) is not None
                        and current[change.key].value == change.value
                    )
                    for change in tag_delta.tags
                )
            return all(change.key not in current for change in tag_delta.tags)
        return None


def register_fixture_plan_kinds(
    adapter: MutationAdapter, privilege_codes: tuple[str, ...]
) -> tuple[FixturePlanKindHandler, ...]:
    return tuple(
        FixturePlanKindHandler(kind, adapter, privilege_codes)
        for kind in (
            w.PlanKind.GRANT,
            w.PlanKind.REVOKE,
            w.PlanKind.TRANSFER_OWNERSHIP,
            w.PlanKind.EDIT_METADATA,
            w.PlanKind.ASSIGN_TAGS,
            w.PlanKind.REMOVE_TAGS,
        )
    )


def register_connected_readonly_plan_kinds() -> tuple[RegisteredPlanKind, ...]:
    return tuple(
        RegisteredPlanKind(kind)
        for kind in (
            w.PlanKind.GRANT,
            w.PlanKind.REVOKE,
            w.PlanKind.TRANSFER_OWNERSHIP,
            w.PlanKind.EDIT_METADATA,
            w.PlanKind.ASSIGN_TAGS,
            w.PlanKind.REMOVE_TAGS,
        )
    )
