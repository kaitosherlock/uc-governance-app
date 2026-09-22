"""Resolve actor from verified user identity; forwarded email alone authenticates nothing."""

import logging

from fastapi import Request

from app.api.v1.models import ActorKind, Executor, Identity
from app.auth.protocols import UserIdentityResolver
from app.config.settings import Mode, Settings
from app.errors import IdentityMismatch, NotImplementedYet, Unauthenticated

logger = logging.getLogger(__name__)


async def resolve_identity(
    request: Request,
    settings: Settings,
    resolver: UserIdentityResolver | None,
) -> Identity:
    if settings.mode == Mode.FIXTURE:
        if resolver is None:
            raise Unauthenticated("Fixture identity resolver is not configured.")
        user = await resolver.resolve(settings.fixture_actor or "")
        executor = Executor(
            kind="service_principal",
            display="synthetic-governance-app@example.test",
            reason="Governance changes execute only against synthetic in-memory fixture state.",
        )
    else:
        access_token = request.headers.get("x-forwarded-access-token", "").strip()
        if not access_token:
            raise Unauthenticated()
        if resolver is None:
            raise NotImplementedYet("Connected user identity verification is not implemented yet.")
        user = await resolver.resolve(access_token)
        if user.actor.verified_by != "user_token" or user.actor.kind != ActorKind.USER:
            raise Unauthenticated("A verified user-token identity is required.")
        email = request.headers.get("x-forwarded-email")
        preferred_username = request.headers.get("x-forwarded-preferred-username")
        forwarded_user = request.headers.get("x-forwarded-user")
        if (
            (
                email is not None
                and (user.email is None or email.casefold() != user.email.casefold())
            )
            or (
                preferred_username is not None
                and (user.email is None or preferred_username.casefold() != user.email.casefold())
            )
            or (
                forwarded_user is not None
                and user.external_id
                and forwarded_user != user.external_id
            )
        ):
            logger.warning("Forwarded identity mismatch")
            raise IdentityMismatch()
        executor = Executor(
            kind="user",
            display=user.actor.display,
            reason="These read endpoints use the authenticated user's identity.",
        )
    return Identity(actor=user.actor, executor=executor)


async def current_identity(request: Request) -> Identity:
    identity = await resolve_identity(
        request,
        request.app.state.settings,
        request.app.state.identity_resolver,
    )
    # Only auth reads forwarded credentials. Reader construction performs no live calls.
    request.state.read_access_token = (
        ""
        if request.app.state.settings.mode == Mode.FIXTURE
        else request.headers.get("x-forwarded-access-token", "").strip()
    )
    return identity
