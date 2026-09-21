from unittest.mock import AsyncMock

import pytest
from app.api.v1.models import Actor, ActorKind, AppRole
from app.auth.protocols import ResolvedUser
from app.errors import Unauthenticated
from app.main import create_app
from fastapi.testclient import TestClient


def connected_app(monkeypatch: pytest.MonkeyPatch, mode: str = "connected"):
    monkeypatch.setenv("UCGOV_MODE", mode)
    monkeypatch.delenv("UCGOV_FIXTURE_ACTOR")
    return create_app()


@pytest.mark.parametrize("mode", ["connected", "connected_readonly"])
@pytest.mark.parametrize("path", ["me", "context", "capabilities"])
def test_connected_missing_token(monkeypatch: pytest.MonkeyPatch, mode: str, path: str) -> None:
    with TestClient(connected_app(monkeypatch, mode)) as client:
        response = client.get(f"/api/v1/{path}")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def test_spoofed_email_does_not_authenticate(monkeypatch: pytest.MonkeyPatch) -> None:
    app = connected_app(monkeypatch)
    resolver = AsyncMock()
    app.state.identity_resolver = resolver
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/me", headers={"X-Forwarded-Email": "spoof@example.test"},
        )
    assert response.status_code == 401
    resolver.resolve.assert_not_called()


def test_no_service_principal_fallback_on_failed_user_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = connected_app(monkeypatch)
    # Presence of app credentials must not change the user-token failure path.
    monkeypatch.setenv("DATABRICKS_CLIENT_ID", "synthetic-app-id")
    monkeypatch.setenv("DATABRICKS_CLIENT_SECRET", "synthetic-app-secret")
    resolver = AsyncMock()
    resolver.resolve.side_effect = Unauthenticated()
    app.state.identity_resolver = resolver
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/me", headers={"x-forwarded-access-token": "synthetic-user-token"},
        )
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"
    resolver.resolve.assert_awaited_once_with("synthetic-user-token")
    assert "fixture" not in response.text


def test_connected_resolver_is_explicitly_unimplemented(monkeypatch: pytest.MonkeyPatch) -> None:
    app = connected_app(monkeypatch)
    assert app.state.identity_resolver is None
    with TestClient(app) as client:
        response = client.get("/api/v1/me", headers={"x-forwarded-access-token": "synthetic-token"})
    assert response.status_code == 501
    assert response.json()["code"] == "NOT_IMPLEMENTED"


@pytest.mark.parametrize(("headers", "expected"), [
    ({"X-Forwarded-Email": "alice@example.test"}, 200),
    ({"X-Forwarded-Email": "spoof@example.test"}, 401),
    ({"X-Forwarded-User": "wrong-user-id"}, 401),
])
def test_forwarded_headers_cross_checked(
    monkeypatch: pytest.MonkeyPatch, headers: dict[str, str], expected: int,
) -> None:
    app = connected_app(monkeypatch)
    resolver = AsyncMock()
    resolver.resolve.return_value = ResolvedUser(
        actor=Actor(id="synthetic-user-id", display="Alice", kind=ActorKind.USER,
                    roles=[AppRole.VIEWER], verified_by="user_token"),
        email="alice@example.test",
    )
    app.state.identity_resolver = resolver
    with TestClient(app) as client:
        response = client.get("/api/v1/me", headers={
            "x-forwarded-access-token": "synthetic-token", **headers,
        })
    assert response.status_code == expected
    if expected == 401:
        assert response.json()["code"] == "IDENTITY_MISMATCH"


def test_fixture_identity_rejected_in_connected_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.fixtures_data.identities import FixtureIdentityResolver

    app = connected_app(monkeypatch)
    app.state.identity_resolver = FixtureIdentityResolver()
    with TestClient(app) as client:
        response = client.get("/api/v1/me", headers={"x-forwarded-access-token": "alice.steward"})
    assert response.status_code == 401


def test_unknown_fixture_selector_is_not_authenticated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UCGOV_FIXTURE_ACTOR", "unlisted.user")
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/me")
    assert response.status_code == 401
