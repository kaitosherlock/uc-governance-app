"""All read protocols plus isolated grant deltas for the future plan executor."""

from dataclasses import replace
from typing import TypeVar

from app.domain.enums import GrantSourceType, SecurableType
from app.domain.models import (
    AssetDetail,
    AssetSummary,
    DependenciesData,
    Grant,
    GrantSource,
    Principal,
)
from app.errors import NotFound, ValidationFailed
from app.fixtures_data.dataset import DEPENDENCIES, build_assets, build_grants, build_principals

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
