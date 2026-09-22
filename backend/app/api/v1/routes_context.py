"""Implemented context, actor and capability discovery routes."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.v1.models import (
    AppMode,
    CapabilitiesResponse,
    Completeness,
    Context,
    ContextResponse,
    DataSource,
    ErrorResponse,
    Identity,
    IdentityResponse,
    Meta,
)
from app.auth.actor import current_identity
from app.authz.roles import Target, decide
from app.capabilities.registry import REGISTRY, probe
from app.config.settings import Mode, Settings
from app.correlation import correlation_id
from app.errors import ForbiddenRole

router = APIRouter(
    tags=["context"],
    responses={
        401: {"model": ErrorResponse, "description": "Unauthenticated or identity mismatch"},
        500: {"model": ErrorResponse, "description": "Internal error"},
    },
)
CurrentIdentity = Annotated[Identity, Depends(current_identity)]


def make_meta(settings: Settings) -> Meta:
    fixture = settings.mode == Mode.FIXTURE
    return Meta(
        source=DataSource.FIXTURE if fixture else DataSource.APPLICATION,
        observed_at=datetime.now(UTC),
        scope=None,
        completeness=Completeness.COMPLETE,
        limitations=["All data on this screen is synthetic."] if fixture else [],
        correlation_id=correlation_id.get(),
    )


def authorize_read(identity: Identity, action: str, settings: Settings) -> None:
    decision = decide(
        identity,
        action,
        Target(),
        managed_catalogs=settings.managed_catalogs,
        mode=settings.mode,
    )
    if not decision.allowed:
        raise ForbiddenRole(decision.reason)


@router.get(
    "/context",
    response_model=ContextResponse,
    operation_id="getContext",
    summary="Workspace, environment, mode, and configured resources",
)
async def get_context(request: Request, identity: CurrentIdentity) -> ContextResponse:
    settings: Settings = request.app.state.settings
    authorize_read(identity, "context.read", settings)
    data = Context(
        mode=AppMode(settings.mode.value),
        mode_label=(
            "Demo — synthetic data"
            if settings.mode == Mode.FIXTURE
            else "Read-only"
            if settings.mode == Mode.CONNECTED_READONLY
            else "Editing enabled"
        ),
        environment_label=settings.environment_label,
        workspace_host=(
            "https://demo.example.test"
            if settings.mode == Mode.FIXTURE
            else settings.workspace_host
        ),
        workspace_id=None if settings.mode == Mode.FIXTURE else settings.workspace_id,
        managed_catalogs=settings.managed_catalogs,
        support_contact=settings.support_contact or None,
        bootstrap_allowlist_active=False,  # Bootstrap role resolution is not implemented yet.
        warehouse_configured=settings.warehouse_configured,
        durable_store_configured=settings.durable_store_configured,
        account_client_configured=settings.account_client_configured,
    )
    return ContextResponse(success=True, data=data, meta=make_meta(settings))


@router.get(
    "/me",
    response_model=IdentityResponse,
    operation_id="getMe",
    summary="Authenticated actor and default execution identity",
)
async def get_me(request: Request, identity: CurrentIdentity) -> IdentityResponse:
    settings: Settings = request.app.state.settings
    authorize_read(identity, "identity.read", settings)
    return IdentityResponse(success=True, data=identity, meta=make_meta(settings))


@router.get(
    "/capabilities",
    response_model=CapabilitiesResponse,
    operation_id="listCapabilities",
    summary="Implementation coverage and runtime availability of every capability",
)
async def list_capabilities(request: Request, identity: CurrentIdentity) -> CapabilitiesResponse:
    settings: Settings = request.app.state.settings
    authorize_read(identity, "capabilities.read", settings)
    return CapabilitiesResponse(
        success=True,
        data=[probe(row, settings) for row in REGISTRY],
        meta=make_meta(settings),
    )
