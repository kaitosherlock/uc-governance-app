"""Direct and effective grant reads; no connected write implementation."""

from typing import TYPE_CHECKING

from app.adapters.databricks.common import boundary, enum_field, items_field, text_field
from app.domain.enums import GrantSourceType, SecurableType
from app.domain.models import Grant, GrantSource
from app.errors import UpstreamUnavailable

if TYPE_CHECKING:
    from databricks.sdk.service.catalog import GrantsAPI


def map_source(value: object, stype: str, name: str) -> GrantSource:
    parent_type = enum_field(value, "inherited_from_type")
    parent_name = text_field(value, "inherited_from_name")
    if parent_type is None and parent_name is None:
        return GrantSource(
            type=GrantSourceType.DIRECT, securable_type=SecurableType(stype), full_name=name
        )
    if parent_type in ("CATALOG", "SCHEMA") and parent_name:
        return GrantSource(
            type=GrantSourceType.INHERITED,
            securable_type=SecurableType(parent_type),
            full_name=parent_name,
        )
    return GrantSource(type=GrantSourceType.UNKNOWN, securable_type=None, full_name=None)


@boundary
def map_grants(value: object, stype: str, name: str, effective: bool) -> list[Grant]:
    grants: list[Grant] = []
    for assignment in items_field(value, "privilege_assignments"):
        principal = text_field(assignment, "principal")
        if not principal:
            raise UpstreamUnavailable("Databricks returned a grant without a principal identifier.")
        for privilege in items_field(assignment, "privileges"):
            code = (
                enum_field(privilege, "privilege")
                if effective
                else enum_field(assignment_code(privilege), "code")
            )
            if code is None:
                raise UpstreamUnavailable("Databricks returned incomplete privilege metadata.")
            source = (
                map_source(privilege, stype, name)
                if effective
                else GrantSource(
                    type=GrantSourceType.DIRECT, securable_type=SecurableType(stype), full_name=name
                )
            )
            grants.append(
                Grant(
                    principal=principal,
                    principal_kind=None,
                    privilege=code,
                    source=source,
                    allowed_actions=(),
                )
            )
    return grants


class assignment_code:
    def __init__(self, code: object) -> None:
        self.code = code


class GrantsAdapter:
    def __init__(self, api: "GrantsAPI") -> None:
        self.api = api

    @boundary
    def direct_grants(
        self, securable_type: str, full_name: str, page_size: int, page_token: str | None
    ) -> tuple[list[Grant], str | None]:
        value = self.api.get(
            securable_type=securable_type,
            full_name=full_name,
            max_results=min(200, max(1, page_size)),
            page_token=page_token,
        )
        return map_grants(value, securable_type, full_name, False), value.next_page_token

    @boundary
    def effective_grants(
        self, securable_type: str, full_name: str, page_size: int, page_token: str | None
    ) -> tuple[list[Grant], str | None]:
        value = self.api.get_effective(
            securable_type=securable_type,
            full_name=full_name,
            max_results=min(200, max(1, page_size)),
            page_token=page_token,
        )
        return map_grants(value, securable_type, full_name, True), value.next_page_token
