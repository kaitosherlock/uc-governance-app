import pytest
from app.api.v1.models import Actor, ActorKind, AppRole, ErrorCode, Executor, Identity
from app.authz.roles import Target, decide, roles_for_groups
from app.config.settings import Mode


def identity(role: AppRole) -> Identity:
    return Identity(
        actor=Actor(id="synthetic-user", display="user@example.test", kind=ActorKind.USER,
                    roles=[role], verified_by="fixture"),
        executor=Executor(kind="user", display="user@example.test", reason="Unit test."),
    )


@pytest.mark.parametrize("action", ["grant", "revoke", "approve", "execute", "plans.create"])
def test_viewer_denied_mutation(action: str) -> None:
    result = decide(identity(AppRole.VIEWER), action, Target("sales"))
    assert not result.allowed
    assert result.reason_code == ErrorCode.FORBIDDEN_ROLE


@pytest.mark.parametrize("role", list(AppRole))
def test_scope_denial_for_every_role(role: AppRole) -> None:
    result = decide(identity(role), "assets.read", Target("hr"), managed_catalogs=["sales"])
    assert not result.allowed
    assert result.reason_code == ErrorCode.FORBIDDEN_SCOPE


@pytest.mark.parametrize(("role", "action", "allowed"), [
    (AppRole.VIEWER, "assets.read", True),
    (AppRole.STEWARD, "edit_metadata", True),
    (AppRole.STEWARD, "transfer_ownership", True),
    (AppRole.STEWARD, "grant", False),
    (AppRole.ACCESS_ADMIN, "grant", True),
    (AppRole.ACCESS_ADMIN, "approve", True),
    (AppRole.ACCESS_ADMIN, "update_binding", False),
    (AppRole.AUDITOR, "export", True),
    (AppRole.AUDITOR, "edit_metadata", False),
    (AppRole.PLATFORM_ADMIN, "update_binding", True),
    (AppRole.PLATFORM_ADMIN, "bypass_sod", False),
    (AppRole.PLATFORM_ADMIN, "unregistered.read", False),
])
def test_role_table(role: AppRole, action: str, allowed: bool) -> None:
    assert decide(identity(role), action, Target("sales")).allowed is allowed


def test_readonly_denies_platform_admin_mutation() -> None:
    result = decide(
        identity(AppRole.PLATFORM_ADMIN), "grant", Target(), mode=Mode.CONNECTED_READONLY,
    )
    assert result.reason_code == ErrorCode.MODE_READ_ONLY


def test_group_mapping_requires_verified_membership() -> None:
    mapping = {"platform_admin": ["synthetic-platform"], "steward": ["synthetic-stewards"]}
    assert roles_for_groups(None, mapping) == [AppRole.VIEWER]
    assert roles_for_groups([], mapping) == [AppRole.VIEWER]
    assert roles_for_groups(["synthetic-stewards"], mapping) == [AppRole.STEWARD]
