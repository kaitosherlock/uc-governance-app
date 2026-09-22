"""Synthetic inventory: three catalogs, twelve schemas, sixty schema objects."""

from dataclasses import replace
from datetime import UTC, datetime

from app.domain.enums import (
    AttachmentSource,
    DependencyKind,
    GrantSourceType,
    ManagedStatus,
    ObjectKind,
    PrincipalKind,
    PrincipalScope,
    SecurableType,
    TagKind,
)
from app.domain.models import (
    AbacPolicy,
    AssetDetail,
    AssetRef,
    Column,
    ColumnMaskRef,
    Dependency,
    Grant,
    GrantSource,
    Principal,
    RowFilterRef,
    Tag,
    TagPolicy,
)

OBSERVED = datetime(2026, 9, 20, 23, 10, 44, tzinfo=UTC)
SCHEMAS = {
    "sales": ("crm", "finance", "reporting", "operations"),
    "hr": ("people", "payroll", "recruiting", "analytics"),
    "shared_ref": ("geography", "calendar", "governance", "ml"),
}


def asset(name: str, kind: str, owner: str, comment: str | None) -> AssetDetail:
    bits = name.split(".")
    stype = {
        "table": "TABLE",
        "view": "TABLE",
        "materialized_view": "TABLE",
        "streaming_table": "TABLE",
        "model_version": "REGISTERED_MODEL",
    }.get(kind, kind.upper())
    parent = None
    if len(bits) > 1:
        pkind = "catalog" if len(bits) == 2 else "schema"
        parent = AssetRef(
            securable_type=SecurableType(pkind.upper()),
            full_name=".".join(bits[:-1]),
            kind=ObjectKind(pkind),
            display_name=bits[-2],
        )
    tabular = stype == "TABLE"
    return AssetDetail(
        securable_type=SecurableType(stype),
        full_name=name,
        kind=ObjectKind(kind),
        display_name=bits[-1],
        owner=owner,
        comment=comment,
        updated_at=OBSERVED,
        managed=ManagedStatus.MANAGED if tabular else ManagedStatus.UNKNOWN,
        pipeline_managed=kind in ("materialized_view", "streaming_table") if tabular else None,
        allowed_actions=(),
        properties={},
        tags=(),
        columns=(
            Column(
                name="id",
                type_text="BIGINT",
                nullable=False,
                comment="Synthetic record ID.",
                position=0,
                tags=(),
                mask=None,
            ),
        )
        if tabular
        else (),
        row_filter=None,
        view_definition=None,
        storage_location=None,
        table_type=("MANAGED" if kind == "table" else kind.upper()) if tabular else None,
        data_source_format="DELTA" if tabular else None,
        created_at=OBSERVED,
        created_by="alice.steward@example.test",
        parent=parent,
        raw={},
    )


def build_assets() -> dict[tuple[str, str], AssetDetail]:
    values: list[AssetDetail] = []
    for catalog, schemas in SCHEMAS.items():
        owner = "data-eng-owners" if catalog == "sales" else f"{catalog}-owners"
        values.append(asset(catalog, "catalog", owner, f"Synthetic {catalog} data products."))
        for schema in schemas:
            values.append(asset(f"{catalog}.{schema}", "schema", owner, f"{schema.title()} data."))
            entries = [
                ("records", "table"),
                ("events", "table"),
                ("summary", "view"),
                ("raw_exports", "volume"),
                ("normalize_id", "function"),
            ]
            if (catalog, schema) == ("sales", "crm"):
                entries = [
                    ("orders", "table"),
                    ("customers", "table"),
                    ("orders_for_analysts", "view"),
                    ("orders_daily_mv", "materialized_view"),
                    ("raw_exports", "volume"),
                    ("orders_stream", "streaming_table"),
                ]
            if (catalog, schema) == ("shared_ref", "governance"):
                entries.append(("mask_email", "function"))
            if (catalog, schema) == ("shared_ref", "ml"):
                entries[-1] = ("demand_forecast", "registered_model")
            for name, kind in entries:
                obj = asset(
                    f"{catalog}.{schema}.{name}",
                    kind,
                    owner,
                    f"Synthetic {name.replace('_', ' ')} metadata.",
                )
                if kind == "volume":
                    obj = replace(obj, managed=ManagedStatus.EXTERNAL)
                values.append(obj)
    result = {(a.securable_type.value, a.full_name): a for a in values}
    orders = result["TABLE", "sales.crm.orders"]
    result["TABLE", orders.full_name] = replace(
        orders,
        comment="One row per customer order. Source: CRM nightly export.",
        row_filter=RowFilterRef(
            function_full_name="shared_ref.governance.normalize_id",
            input_columns=("id",),
            attached_via=AttachmentSource.ABAC_POLICY,
            policy_id="fixture-policy-sales-sensitive-rows",
        ),
        columns=(
            replace(
                orders.columns[0],
                tags=(
                    Tag(key="pii", value="identifier", kind=TagKind.GOVERNED, allowed_actions=()),
                ),
            ),
        ),
        tags=(
            Tag(key="data_domain", value="sales", kind=TagKind.FREE_FORM, allowed_actions=()),
            Tag(key="sensitivity", value="internal", kind=TagKind.GOVERNED, allowed_actions=()),
            Tag(
                key="system.classification",
                value="identifier",
                kind=TagKind.SYSTEM,
                allowed_actions=(),
            ),
        ),
    )
    customers = result["TABLE", "sales.crm.customers"]
    result["TABLE", customers.full_name] = replace(
        customers,
        row_filter=RowFilterRef(
            function_full_name="shared_ref.governance.normalize_id",
            input_columns=("id",),
            attached_via=AttachmentSource.DIRECT,
        ),
        columns=(
            *customers.columns,
            Column(
                name="email",
                type_text="STRING",
                nullable=True,
                comment="Synthetic contact address.",
                position=1,
                tags=(),
                mask=ColumnMaskRef(
                    column="email",
                    function_full_name="shared_ref.governance.mask_email",
                    using_columns=(),
                    attached_via=AttachmentSource.DIRECT,
                ),
            ),
        ),
    )
    dynamic_view = result["TABLE", "sales.crm.orders_for_analysts"]
    result["TABLE", dynamic_view.full_name] = replace(
        dynamic_view,
        view_definition=(
            "SELECT id\n"
            "FROM sales.crm.orders\n"
            "WHERE is_account_group_member('analysts')"
        ),
        raw={
            "dynamic_view": "dynamic",
            "view_dependencies_status": "available",
            "view_dependencies": [{"kind": "table", "full_name": "sales.crm.orders"}],
        },
    )
    ordinary_view = result["TABLE", "sales.finance.summary"]
    result["TABLE", ordinary_view.full_name] = replace(
        ordinary_view,
        view_definition="SELECT id FROM sales.finance.records",
        raw={
            "dynamic_view": "ordinary",
            "view_dependencies_status": "available",
            "view_dependencies": [
                {"kind": "table", "full_name": "sales.finance.records"}
            ],
        },
    )
    model = result["REGISTERED_MODEL", "shared_ref.ml.demand_forecast"]
    result["REGISTERED_MODEL", model.full_name] = replace(model, raw={"versions": [1, 2]})
    return result


def build_tag_policies() -> tuple[TagPolicy, ...]:
    return (
        TagPolicy(
            key="sensitivity",
            description="Approved data-sensitivity label.",
            allowed_values=("public", "internal", "confidential"),
            allowed_actions=(),
        ),
        TagPolicy(
            key="pii",
            description="Open set maintained by the classification program.",
            allowed_values=None,
            allowed_actions=(),
        ),
        TagPolicy(
            key="retention",
            description="No values are currently approved.",
            allowed_values=(),
            allowed_actions=(),
        ),
    )


def build_abac_policies() -> tuple[AbacPolicy, ...]:
    return (
        AbacPolicy(
            id="fixture-policy-sales-sensitive-rows",
            name="filter_sensitive_sales_rows",
            policy_type="row_filter",
            scope=AssetRef(
                securable_type=SecurableType.CATALOG,
                full_name="sales",
                kind=ObjectKind.CATALOG,
                display_name="sales",
            ),
            when_condition="has_tag_value('sensitivity', 'internal')",
            to_principals=("analysts",),
            except_principals=("data-eng-owners",),
            function_full_name="shared_ref.governance.normalize_id",
            match_columns=("id",),
            owner="data-eng-owners",
            created_at=OBSERVED,
            updated_at=OBSERVED,
            allowed_actions=(),
        ),
    )


def build_principals() -> tuple[Principal, ...]:
    users = [
        "alice.steward",
        "victor.viewer",
        "audrey.auditor",
        "pat.platform",
        "ben.engineer",
        "cara.analyst",
        "dan.finance",
        "eve.hr",
        "frank.ops",
        "gina.sales",
        "hugo.owner",
        "iris.reviewer",
        "jules.scientist",
        "kai.reader",
    ]
    groups = [
        "analysts",
        "data-eng-owners",
        "sales-readers",
        "account users",
        "hr-owners",
        "shared_ref-owners",
        "auditors",
        "local-project-team",
    ]
    items = [(x + "@example.test", PrincipalKind.USER) for x in users]
    items += [(x, PrincipalKind.GROUP) for x in groups]
    items += [
        (x, PrincipalKind.SERVICE_PRINCIPAL)
        for x in ("svc-etl-nightly", "svc-quality", "svc-models")
    ]
    return tuple(
        Principal(
            name=name,
            display=name,
            kind=kind,
            scope=PrincipalScope.WORKSPACE_LOCAL
            if name == "local-project-team"
            else PrincipalScope.ACCOUNT,
            uc_eligible=name != "local-project-team",
            id=f"synthetic-{i:02}",
        )
        for i, (name, kind) in enumerate(items)
    )


def build_grants() -> dict[tuple[str, str], list[Grant]]:
    result: dict[tuple[str, str], list[Grant]] = {}
    for stype, name, principal, kind, code in (
        ("TABLE", "sales.crm.orders", "analysts", "group", "SELECT"),
        ("TABLE", "sales.crm.orders", "svc-etl-nightly", "service_principal", "MODIFY"),
        ("SCHEMA", "sales.crm", "sales-readers", "group", "SELECT"),
        ("CATALOG", "sales", "account users", "group", "USE_CATALOG"),
    ):
        result.setdefault((stype, name), []).append(
            Grant(
                principal=principal,
                principal_kind=PrincipalKind(kind),
                privilege=code,
                source=GrantSource(
                    type=GrantSourceType.DIRECT, securable_type=SecurableType(stype), full_name=name
                ),
                allowed_actions=(),
            )
        )
    return result


DEPENDENCIES = {
    "sales.crm.orders": (
        Dependency(
            kind=DependencyKind.MATERIALIZED_VIEW,
            full_name="sales.crm.orders_daily_mv",
            source="fixture",
            verified=True,
        ),
    ),
    "sales.crm.orders_for_analysts": (
        Dependency(
            kind=DependencyKind.DOWNSTREAM_TABLE,
            full_name="sales.crm.orders",
            source="fixture",
            verified=True,
        ),
    ),
    "sales.finance.summary": (
        Dependency(
            kind=DependencyKind.DOWNSTREAM_TABLE,
            full_name="sales.finance.records",
            source="fixture",
            verified=True,
        ),
    ),
}
