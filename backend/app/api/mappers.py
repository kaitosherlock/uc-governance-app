"""Explicit domain-to-wire mapping."""

from app.api.v1 import models as w
from app.domain import models as d


def map_AllowedAction(value: d.AllowedAction) -> w.AllowedAction:
    return w.AllowedAction(
        action=value.action,
        allowed=value.allowed,
        reason_code=value.reason_code,
        reason=value.reason,
        navigate_to=value.navigate_to,
    )


def map_AssetRef(value: d.AssetRef) -> w.AssetRef:
    return w.AssetRef(
        securable_type=value.securable_type,
        full_name=value.full_name,
        kind=value.kind,
        display_name=value.display_name,
    )


def map_AssetSummary(value: d.AssetSummary) -> w.AssetSummary:
    return w.AssetSummary(
        securable_type=value.securable_type,
        full_name=value.full_name,
        kind=value.kind,
        display_name=value.display_name,
        owner=value.owner,
        comment=value.comment,
        updated_at=value.updated_at,
        managed=value.managed,
        pipeline_managed=value.pipeline_managed,
        allowed_actions=[map_AllowedAction(x) for x in value.allowed_actions],
    )


def map_Tag(value: d.Tag) -> w.Tag:
    return w.Tag(
        key=value.key,
        value=value.value,
        kind=value.kind,
        allowed_actions=[map_AllowedAction(x) for x in value.allowed_actions],
    )


def map_TagPolicy(value: d.TagPolicy) -> w.TagPolicy:
    return w.TagPolicy(
        key=value.key,
        description=value.description,
        allowed_values=list(value.allowed_values) if value.allowed_values is not None else None,
        allowed_actions=[map_AllowedAction(x) for x in value.allowed_actions],
    )


def map_AbacPolicy(value: d.AbacPolicy) -> w.AbacPolicy:
    return w.AbacPolicy(
        id=value.id,
        name=value.name,
        policy_type=w.AbacPolicyType(value.policy_type),
        scope=map_AssetRef(value.scope),
        when_condition=value.when_condition,
        to_principals=list(value.to_principals),
        except_principals=list(value.except_principals),
        function_full_name=value.function_full_name,
        match_columns=list(value.match_columns),
        owner=value.owner,
        created_at=value.created_at,
        updated_at=value.updated_at,
        allowed_actions=[map_AllowedAction(x) for x in value.allowed_actions],
    )


def map_RowFilterRef(value: d.RowFilterRef) -> w.RowFilterRef:
    return w.RowFilterRef(
        function_full_name=value.function_full_name,
        input_columns=list(value.input_columns),
        attached_via=value.attached_via,
        policy_id=value.policy_id,
    )


def map_ColumnMaskRef(value: d.ColumnMaskRef) -> w.ColumnMaskRef:
    return w.ColumnMaskRef(
        column=value.column,
        function_full_name=value.function_full_name,
        using_columns=list(value.using_columns),
        attached_via=value.attached_via,
        policy_id=value.policy_id,
    )


def map_Column(value: d.Column) -> w.Column:
    return w.Column(
        name=value.name,
        type_text=value.type_text,
        nullable=value.nullable,
        comment=value.comment,
        position=value.position,
        tags=[map_Tag(x) for x in value.tags],
        mask=map_ColumnMaskRef(value.mask) if value.mask is not None else None,
    )


def map_AssetDetail(value: d.AssetDetail) -> w.AssetDetail:
    return w.AssetDetail(
        securable_type=value.securable_type,
        full_name=value.full_name,
        kind=value.kind,
        display_name=value.display_name,
        owner=value.owner,
        comment=value.comment,
        updated_at=value.updated_at,
        managed=value.managed,
        pipeline_managed=value.pipeline_managed,
        allowed_actions=[map_AllowedAction(x) for x in value.allowed_actions],
        properties=value.properties,
        tags=[map_Tag(x) for x in value.tags],
        columns=[map_Column(x) for x in value.columns],
        row_filter=map_RowFilterRef(value.row_filter) if value.row_filter is not None else None,
        view_definition=value.view_definition,
        storage_location=value.storage_location,
        table_type=value.table_type,
        data_source_format=value.data_source_format,
        created_at=value.created_at,
        created_by=value.created_by,
        parent=map_AssetRef(value.parent) if value.parent is not None else None,
        raw=value.raw,
    )


def map_Dependency(value: d.Dependency) -> w.Dependency:
    return w.Dependency(
        kind=value.kind,
        full_name=value.full_name,
        source=w.DataSource(value.source),
        verified=value.verified,
    )


def map_Principal(value: d.Principal) -> w.Principal:
    return w.Principal(
        name=value.name,
        display=value.display,
        kind=value.kind,
        scope=value.scope,
        uc_eligible=value.uc_eligible,
        id=value.id,
    )


def map_Privilege(value: d.Privilege) -> w.Privilege:
    return w.Privilege(
        code=value.code,
        label=value.label,
        description=value.description,
        category=value.category,
        securable_types=list(value.securable_types),
        prerequisites=list(value.prerequisites),
    )


def map_GrantSource(value: d.GrantSource) -> w.GrantSource:
    return w.GrantSource(
        type=value.type,
        securable_type=value.securable_type,
        full_name=value.full_name,
    )


def map_Grant(value: d.Grant) -> w.Grant:
    return w.Grant(
        principal=value.principal,
        principal_kind=value.principal_kind,
        privilege=value.privilege,
        source=map_GrantSource(value.source),
        allowed_actions=[map_AllowedAction(x) for x in value.allowed_actions],
    )


def map_GrantsData(value: d.GrantsData) -> w.GrantsData:
    return w.GrantsData(
        target=map_AssetRef(value.target),
        owner=value.owner,
        direct=[map_Grant(x) for x in value.direct],
        inherited=[map_Grant(x) for x in value.inherited],
        group_membership_loaded=value.group_membership_loaded,
    )


def map_DependenciesData(value: d.DependenciesData) -> w.DependenciesData:
    return w.DependenciesData(
        known=[map_Dependency(x) for x in value.known],
        disclaimer=value.disclaimer,
    )
