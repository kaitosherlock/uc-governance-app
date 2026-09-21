"""A closed identity list, never consulted in connected modes."""

from app.api.v1.models import Actor, ActorKind, AppRole
from app.auth.protocols import ResolvedUser
from app.errors import Unauthenticated

IDENTITIES: dict[str, tuple[str, list[AppRole]]] = {
    "alice.steward": ("u-1001", [AppRole.STEWARD, AppRole.ACCESS_ADMIN]),
    "victor.viewer": ("u-1002", [AppRole.VIEWER]),
    "audrey.auditor": ("u-1003", [AppRole.AUDITOR]),
    "pat.platform": ("u-1004", [AppRole.PLATFORM_ADMIN]),
}


class FixtureIdentityResolver:
    async def resolve(self, access_token: str) -> ResolvedUser:
        # In fixture mode only, the protocol input is a fixture selector, never a token.
        entry = IDENTITIES.get(access_token)
        if entry is None:
            raise Unauthenticated("Select a configured synthetic fixture identity.")
        user_id, roles = entry
        email = access_token + "@example.test"
        return ResolvedUser(
            actor=Actor(
                id=user_id, display=email, kind=ActorKind.USER,
                roles=list(roles), verified_by="fixture",
            ),
            email=email,
        )
