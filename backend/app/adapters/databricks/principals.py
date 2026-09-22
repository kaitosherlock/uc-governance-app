"""Bounded SCIM searches, with explicit local/account/unknown scope."""

import json
from itertools import chain
from typing import TYPE_CHECKING

from app.adapters.databricks.common import CursorStore, boundary, text_field
from app.domain.enums import PrincipalKind, PrincipalScope
from app.domain.models import Principal
from app.errors import UpstreamUnavailable

if TYPE_CHECKING:
    from databricks.sdk.service.iam import GroupsAPI, ServicePrincipalsAPI, UsersAPI


@boundary
def map_principal(value: object, kind: PrincipalKind) -> Principal:
    name = (
        text_field(value, "user_name")
        if kind == PrincipalKind.USER
        else text_field(value, "application_id")
        if kind == PrincipalKind.SERVICE_PRINCIPAL
        else text_field(value, "display_name")
    )
    if name is None:
        raise UpstreamUnavailable("Databricks returned incomplete principal metadata.")
    resource_type = text_field(getattr(value, "meta", None), "resource_type")
    scope = {"WorkspaceGroup": PrincipalScope.WORKSPACE_LOCAL, "Group": PrincipalScope.ACCOUNT}.get(
        resource_type or "", PrincipalScope.UNKNOWN
    )
    # Unknown groups cannot be offered for UC grants without eligibility evidence.
    eligible = kind != PrincipalKind.GROUP or scope == PrincipalScope.ACCOUNT
    return Principal(
        name=name,
        display=text_field(value, "display_name") or name,
        kind=kind,
        scope=scope,
        uc_eligible=eligible,
        id=text_field(value, "id"),
    )


class PrincipalsAdapter:
    def __init__(
        self,
        users: "UsersAPI",
        groups: "GroupsAPI",
        service_principals: "ServicePrincipalsAPI",
        cursors: CursorStore,
        identity_key: str,
    ) -> None:
        self.users, self.groups, self.service_principals = users, groups, service_principals
        self.cursors, self.identity_key = cursors, identity_key

    @boundary
    def search_principals(
        self, query: str, kinds: tuple[str, ...], page_size: int, page_token: str | None
    ) -> tuple[list[Principal], str | None]:
        count = max(1, min(page_size, 200))
        literal = json.dumps(query)
        selected = kinds or tuple(p.value for p in PrincipalKind)
        # Lists are lazy; errors raised during iteration are caught by the cursor boundary.
        iterators = []
        if "user" in selected:
            iterators.append(
                map_principal(v, PrincipalKind.USER)
                for v in self.users.list(
                    filter=f"userName co {literal}",
                    count=count,
                    attributes="id,userName,displayName",
                )
            )
        if "group" in selected:
            iterators.append(
                map_principal(v, PrincipalKind.GROUP)
                for v in self.groups.list(
                    filter=f"displayName co {literal}",
                    count=count,
                    attributes="id,displayName,meta",
                )
            )
        if "service_principal" in selected:
            iterators.append(
                map_principal(v, PrincipalKind.SERVICE_PRINCIPAL)
                for v in self.service_principals.list(
                    filter=f"displayName co {literal} or applicationId co {literal}",
                    count=count,
                    attributes="id,displayName,applicationId",
                )
            )
        values, token = self.cursors.page(
            lambda: chain.from_iterable(iterators),
            f"{self.identity_key}:principals:{query}:{selected}",
            count,
            page_token,
        )
        return [v for v in values if isinstance(v, Principal)], token
