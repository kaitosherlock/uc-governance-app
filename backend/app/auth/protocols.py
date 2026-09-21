"""P1-01 supplies the user-scoped current_user.me() adapter."""

from dataclasses import dataclass
from typing import Protocol

from app.api.v1.models import Actor


@dataclass(frozen=True)
class ResolvedUser:
    actor: Actor
    email: str | None


class UserIdentityResolver(Protocol):
    async def resolve(self, access_token: str) -> ResolvedUser:
        """Verify with the user's token, or raise; never retry as an app principal."""
        ...
