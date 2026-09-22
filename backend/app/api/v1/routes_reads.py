"""Frozen v1 discovery paths; services own authorization and state restrictions."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.api import mappers
from app.api.v1 import models as w
from app.api.v1.routes_context import CurrentIdentity
from app.config.settings import Mode
from app.container import Container
from app.correlation import correlation_id
from app.domain.enums import GrantSourceType, ObjectKind, PrincipalKind, SecurableType
from app.domain.models import AssetSummary
from app.domain.names import parts, target_parts
from app.domain.privileges import catalogue
from app.domain.reads import ReadService
from app.fixtures_data.scenarios import check_scenario

router = APIRouter(tags=["assets"])


def responses(*statuses: int) -> dict[int | str, dict[str, object]]:
    return {status: {"model": w.ErrorResponse} for status in statuses}


def service(request: Request, identity: CurrentIdentity) -> ReadService:
    container: Container = request.app.state.container
    if container.settings.mode == Mode.FIXTURE:
        check_scenario(request.headers.get("x-fixture-scenario", "success"))
    return ReadService(
        container.readers_for(request.state.read_access_token), identity, container.settings
    )


Service = Annotated[ReadService, Depends(service)]
PageSize = Annotated[int, Query(ge=1, le=200)]
QueryText = Annotated[str | None, Query(max_length=200)]


def meta(
    request: Request,
    svc: ReadService,
    catalog: str | None = None,
    schema: str | None = None,
    *,
    limitations: list[str] | None = None,
    next_token: str | None = None,
    partial: bool = False,
) -> w.Meta:
    fixture = svc.settings.mode == Mode.FIXTURE
    notes = list(limitations or [])
    if fixture:
        notes.insert(0, "All data is synthetic.")
        partial = partial or request.headers.get("x-fixture-scenario") == "partial"
        if request.headers.get("x-fixture-scenario") == "partial":
            notes.append("The synthetic scenario simulates incomplete visibility.")
    else:
        partial = True
        notes.append("Results are limited to the executing identity and the selected scope.")
    return w.Meta(
        source=w.DataSource.FIXTURE if fixture else w.DataSource.UNITY_CATALOG_API,
        observed_at=datetime.now(UTC),
        scope=w.Scope(catalog=catalog, schema=schema),
        completeness=w.Completeness.TRUNCATED
        if next_token
        else w.Completeness.PARTIAL_VISIBILITY
        if partial
        else w.Completeness.COMPLETE,
        limitations=notes,
        correlation_id=correlation_id.get(),
    )


def asset_list(
    request: Request,
    svc: ReadService,
    values: list[AssetSummary],
    token: str | None,
    page_size: int,
    catalog: str | None,
    schema: str | None,
    q: str | None,
    kind: list[ObjectKind] | None = None,
    owner: str | None = None,
) -> w.AssetListResponse:
    notes = (
        ["Search and filters apply to this bounded page of object names only."]
        if q or kind or owner
        else []
    )
    result = [
        v
        for v in values
        if (q is None or q.casefold() in v.display_name.casefold())
        and (not kind or v.kind in kind)
        and (owner is None or v.owner == owner)
    ]
    return w.AssetListResponse(
        success=True,
        data=[mappers.map_AssetSummary(svc.summary(v)) for v in result],
        meta=meta(request, svc, catalog, schema, limitations=notes, next_token=token),
        page=w.Page(page_size=page_size, next_page_token=token),
    )


@router.get(
    "/catalogs",
    response_model=w.AssetListResponse,
    operation_id="listCatalogs",
    responses=responses(401, 403, 429, 500, 503),
)
def list_catalogs(
    request: Request,
    svc: Service,
    page_size: PageSize = 50,
    page_token: str | None = None,
    q: QueryText = None,
) -> w.AssetListResponse:
    svc.authorize("catalogs.read")
    values, token = svc.readers.catalogs.list_catalogs(page_size, page_token)
    managed = svc.settings.managed_catalogs
    values = [v for v in values if not managed or parts(v.full_name)[0] in managed]
    return asset_list(request, svc, values, token, page_size, None, None, q)


@router.get(
    "/catalogs/{catalog}/schemas",
    response_model=w.AssetListResponse,
    operation_id="listSchemas",
    responses=responses(401, 403, 404, 429, 500, 503),
)
def list_schemas(
    catalog: str,
    request: Request,
    svc: Service,
    page_size: PageSize = 50,
    page_token: str | None = None,
    q: QueryText = None,
) -> w.AssetListResponse:
    canonical = target_parts("CATALOG", catalog)[0]
    svc.authorize("schemas.read", canonical)
    values, token = svc.readers.schemas.list_schemas(catalog, page_size, page_token)
    return asset_list(request, svc, values, token, page_size, canonical, None, q)


@router.get(
    "/schemas/{catalog}/{schema}/objects",
    response_model=w.AssetListResponse,
    operation_id="listSchemaObjects",
    responses=responses(401, 403, 404, 429, 500, 503),
)
def list_objects(
    catalog: str,
    schema: str,
    request: Request,
    svc: Service,
    page_size: PageSize = 50,
    page_token: str | None = None,
    q: QueryText = None,
    kind: Annotated[list[ObjectKind] | None, Query()] = None,
    owner: str | None = None,
) -> w.AssetListResponse:
    canonical = target_parts("CATALOG", catalog)[0]
    target_parts("CATALOG", schema)
    svc.authorize("assets.read", canonical)
    values, token = svc.readers.objects.list_objects(catalog, schema, page_size, page_token)
    return asset_list(request, svc, values, token, page_size, canonical, schema, q, kind, owner)


@router.get(
    "/assets/{securable_type}/{full_name}",
    response_model=w.AssetDetailResponse,
    operation_id="getAsset",
    responses=responses(400, 401, 403, 404, 500, 503),
)
def get_asset(
    securable_type: SecurableType, full_name: str, request: Request, svc: Service
) -> w.AssetDetailResponse:
    value = svc.detail(securable_type, full_name)
    bits = target_parts(securable_type, full_name)
    notes = (
        []
        if svc.settings.mode == Mode.FIXTURE
        else [
            "Tags, storage locations, view definitions and non-allowlisted properties were not "
            "loaded. Attachment provenance may be unknown."
        ]
    )
    return w.AssetDetailResponse(
        success=True,
        data=mappers.map_AssetDetail(value),
        meta=meta(request, svc, bits[0], bits[1] if len(bits) > 1 else None, limitations=notes),
    )


@router.get(
    "/assets/{securable_type}/{full_name}/dependencies",
    response_model=w.DependenciesResponse,
    operation_id="getAssetDependencies",
    responses=responses(401, 403, 404, 500, 501, 503),
)
def get_dependencies(
    securable_type: SecurableType, full_name: str, request: Request, svc: Service
) -> w.DependenciesResponse:
    svc.detail(securable_type, full_name)
    value = svc.readers.dependencies.dependencies(securable_type, full_name)
    # A configured catalog boundary applies to dependent names too.
    known = [
        d
        for d in value.known
        if not svc.settings.managed_catalogs
        or parts(d.full_name)[0] in svc.settings.managed_catalogs
    ]
    return w.DependenciesResponse(
        success=True,
        data=w.DependenciesData(
            known=[mappers.map_Dependency(d) for d in known], disclaimer=value.disclaimer
        ),
        meta=meta(
            request,
            svc,
            svc.catalog_for(securable_type, full_name),
            limitations=[value.disclaimer],
            partial=True,
        ),
    )


@router.get(
    "/assets/{securable_type}/{full_name}/grants",
    response_model=w.GrantsResponse,
    operation_id="getGrants",
    responses=responses(401, 403, 404, 429, 500, 503),
)
def get_grants(
    securable_type: SecurableType,
    full_name: str,
    request: Request,
    svc: Service,
    principal: str | None = None,
    privilege: str | None = None,
    source: GrantSourceType | None = None,
) -> w.GrantsResponse:
    value, limitations, truncated = svc.grants(
        securable_type, full_name, principal, privilege, source
    )
    if svc.settings.mode != Mode.FIXTURE:
        limitations.insert(0, "Showing grants visible to the application's service principal.")
    bits = target_parts(securable_type, full_name)
    return w.GrantsResponse(
        success=True,
        data=mappers.map_GrantsData(value),
        meta=meta(
            request,
            svc,
            bits[0],
            bits[1] if len(bits) > 1 else None,
            limitations=limitations,
            next_token="truncated" if truncated else None,
            partial=True,
        ),
    )


@router.get(
    "/assets/{securable_type}/{full_name}/tags",
    response_model=w.TagsResponse,
    operation_id="getTags",
    responses=responses(401, 403, 404, 500, 501, 503),
)
def get_tags(
    securable_type: SecurableType, full_name: str, request: Request, svc: Service
) -> w.TagsResponse:
    target, tags, column_tags = svc.tags(securable_type, full_name)
    bits = target_parts(securable_type, full_name)
    return w.TagsResponse(
        success=True,
        data=w.TagsData(
            target=mappers.map_AssetRef(target),
            tags=[mappers.map_Tag(tag) for tag in tags],
            column_tags={
                column: [mappers.map_Tag(tag) for tag in values]
                for column, values in column_tags.items()
            },
        ),
        meta=meta(request, svc, bits[0], bits[1] if len(bits) > 1 else None),
    )


@router.get(
    "/tag-policies",
    response_model=w.TagPolicyListResponse,
    operation_id="listTagPolicies",
    responses=responses(401, 403, 500, 501, 503),
)
def list_tag_policies(
    request: Request,
    svc: Service,
    page_size: PageSize = 50,
    page_token: str | None = None,
) -> w.TagPolicyListResponse:
    values, token = svc.tag_policies(page_size, page_token)
    return w.TagPolicyListResponse(
        success=True,
        data=[mappers.map_TagPolicy(value) for value in values],
        meta=meta(
            request,
            svc,
            limitations=["Governed tag assignment authority could not be determined."],
            next_token=token,
        ),
        page=w.Page(page_size=page_size, next_page_token=token),
    )


@router.get(
    "/abac-policies",
    response_model=w.AbacPolicyListResponse,
    operation_id="listAbacPolicies",
    responses=responses(401, 403, 500, 501, 503),
)
def list_abac_policies(
    request: Request,
    svc: Service,
    scope_full_name: str | None = None,
    page_size: PageSize = 50,
    page_token: str | None = None,
) -> w.AbacPolicyListResponse:
    values, token = svc.abac_policies(scope_full_name, page_size, page_token)
    return w.AbacPolicyListResponse(
        success=True,
        data=[mappers.map_AbacPolicy(value) for value in values],
        meta=meta(
            request,
            svc,
            limitations=[
                "Policy fields unavailable from the source are labelled unavailable; no defaults "
                "are inferred.",
                "Listing reflects only policies available through this application's "
                "visible scope.",
            ],
            next_token=token,
            partial=scope_full_name is None,
        ),
        page=w.Page(page_size=page_size, next_page_token=token),
    )


@router.get(
    "/abac-policies/{policy_id}/impact",
    response_model=w.PolicyImpactResponse,
    operation_id="previewAbacPolicyImpact",
    responses=responses(401, 403, 404, 500, 501),
)
def preview_abac_policy_impact(
    policy_id: str, request: Request, svc: Service, page_size: PageSize = 50
) -> w.PolicyImpactResponse:
    policy, values, unknown = svc.abac_policy_impact(policy_id, page_size)
    disclaimer = "Potentially affected within your visible scope. Not evaluated by Databricks."
    return w.PolicyImpactResponse(
        success=True,
        data=w.PolicyImpactData(
            potentially_affected=[mappers.map_AssetSummary(svc.summary(value)) for value in values],
            disclaimer=disclaimer,
        ),
        meta=meta(
            request,
            svc,
            policy.scope.full_name.split(".")[0],
            limitations=list(unknown),
            partial=True,
        ),
    )


@router.get(
    "/abac-policies/{policy_id}",
    response_model=w.AbacPolicyResponse,
    operation_id="getAbacPolicy",
    responses=responses(401, 403, 404, 500, 501),
)
def get_abac_policy(
    policy_id: str, request: Request, svc: Service
) -> w.AbacPolicyResponse:
    value = svc.abac_policy(policy_id)
    return w.AbacPolicyResponse(
        success=True,
        data=mappers.map_AbacPolicy(value),
        meta=meta(
            request,
            svc,
            value.scope.full_name.split(".")[0],
            limitations=[
                "This metadata describes a policy definition; it is not a Databricks evaluation."
            ],
        ),
    )


@router.get(
    "/privileges",
    response_model=w.PrivilegeListResponse,
    operation_id="listPrivileges",
    responses=responses(400, 401, 500),
)
def list_privileges(
    securable_type: SecurableType, request: Request, svc: Service
) -> w.PrivilegeListResponse:
    svc.authorize("privileges.read")
    return w.PrivilegeListResponse(
        success=True,
        data=[
            mappers.map_Privilege(p) for p in catalogue(svc.readers.privilege_codes, securable_type)
        ],
        meta=meta(
            request,
            svc,
            limitations=[
                "Privilege codes follow SDK 0.140.0. Applicability is a versioned catalogue; "
                "runtime grant authority is not inferred."
            ],
        ),
    )


@router.get(
    "/principals/search",
    response_model=w.PrincipalListResponse,
    operation_id="searchPrincipals",
    responses=responses(400, 401, 403, 429, 500, 503),
)
def search_principals(
    request: Request,
    svc: Service,
    q: Annotated[str, Query(min_length=2, max_length=200)],
    kind: Annotated[list[PrincipalKind] | None, Query()] = None,
    page_size: PageSize = 50,
) -> w.PrincipalListResponse:
    svc.authorize("principals.read")
    values, token = svc.readers.principals.search_principals(
        q, tuple(k.value for k in kind or []), page_size, None
    )
    notes = [
        "Group memberships were not loaded. Account directory access is not implied by "
        "workspace SCIM results."
    ]
    if token:
        notes.append(
            "More principals may match. Refine the search; this endpoint does not accept a "
            "continuation token."
        )
    return w.PrincipalListResponse(
        success=True,
        data=[mappers.map_Principal(p) for p in values],
        meta=meta(request, svc, limitations=notes, next_token=token),
        page=w.Page(page_size=page_size, next_page_token=None),
    )
