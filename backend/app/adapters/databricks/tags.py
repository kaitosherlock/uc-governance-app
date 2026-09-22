"""Entity-tag and governed-tag reads, with isolated SDK write shapes for future connected mode."""

from typing import TYPE_CHECKING

from app.adapters.databricks.common import (
    CursorStore,
    boundary,
    enum_field,
    items_field,
    text_field,
)
from app.domain.enums import TagKind
from app.domain.models import Tag, TagPolicy

if TYPE_CHECKING:
    from databricks.sdk.service.catalog import EntityTagAssignmentsAPI
    from databricks.sdk.service.tags import TagPoliciesAPI


def _tag(value: object) -> Tag:
    key = text_field(value, "tag_key")
    if not key:
        raise ValueError("Databricks returned a tag without a key.")
    source = enum_field(value, "source_type") or ""
    kind = (
        TagKind.SYSTEM
        if "SYSTEM" in source
        else TagKind.GOVERNED
        if "GOVERNED" in source
        else TagKind.FREE_FORM
    )
    return Tag(
        key=key,
        value=text_field(value, "tag_value"),
        kind=kind,
        allowed_actions=(),
    )


def _policy(value: object) -> TagPolicy:
    key = text_field(value, "tag_key")
    if not key:
        raise ValueError("Databricks returned a tag policy without a key.")
    raw_values = getattr(value, "values", None)
    allowed_values = (
        None
        if raw_values is None
        else tuple(text_field(item, "name") for item in items_field(value, "values"))
    )
    if allowed_values is not None and any(item is None for item in allowed_values):
        raise ValueError("Databricks returned an invalid governed tag value.")
    return TagPolicy(
        key=key,
        description=text_field(value, "description"),
        allowed_values=allowed_values,  # type: ignore[arg-type]
        allowed_actions=(),
    )


class TagsAdapter:
    def __init__(
        self,
        assignments: "EntityTagAssignmentsAPI",
        policies: "TagPoliciesAPI",
        cursors: CursorStore,
        cursor_key: str,
    ) -> None:
        self.assignments = assignments
        self.policies = policies
        self.cursors = cursors
        self.cursor_key = cursor_key

    @boundary
    def tags(
        self, securable_type: str, full_name: str
    ) -> tuple[tuple[Tag, ...], dict[str, tuple[Tag, ...]]]:
        values = self.assignments.list(
            entity_type=securable_type,
            entity_name=full_name,
            max_results=200,
            page_token=None,
        )
        return tuple(_tag(value) for value in values), {}

    @boundary
    def list_tag_policies(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[TagPolicy], str | None]:
        values, token = self.cursors.page(
            lambda: iter(self.policies.list_tag_policies()),
            f"{self.cursor_key}:tag-policies",
            page_size,
            page_token,
        )
        return [_policy(value) for value in values], token

    @boundary
    def assign_tag(
        self, entity_type: str, entity_name: str, tag_key: str, tag_value: str | None
    ) -> None:
        # This adapter is deliberately not registered in connected_readonly mode.
        from databricks.sdk.service.catalog import EntityTagAssignment

        current = self.assignments.get(entity_type, entity_name, tag_key)
        assignment = EntityTagAssignment(
            entity_type=entity_type,
            entity_name=entity_name,
            tag_key=tag_key,
            tag_value=tag_value,
        )
        if current is None:
            self.assignments.create(assignment)
        else:
            self.assignments.update(entity_type, entity_name, tag_key, assignment, "tag_value")

    @boundary
    def remove_tag(self, entity_type: str, entity_name: str, tag_key: str) -> None:
        # This adapter is deliberately not registered in connected_readonly mode.
        self.assignments.delete(entity_type, entity_name, tag_key)
