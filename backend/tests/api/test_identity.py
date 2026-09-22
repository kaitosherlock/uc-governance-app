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
            "/api/v1/me",
            headers={"X-Forwarded-Email": "spoof@example.test"},
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
            "/api/v1/me",
            headers={"x-forwarded-access-token": "synthetic-user-token"},
        )
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"
    resolver.resolve.assert_awaited_once_with("synthetic-user-token")
    assert "fixture" not in response.text


def test_connected_resolver_is_lazy_and_user_scoped(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.adapters.databricks.factory import SDKIdentityResolver

    app = connected_app(monkeypatch)
    assert isinstance(app.state.identity_resolver, SDKIdentityResolver)
    resolver = AsyncMock()
    resolver.resolve.side_effect = Unauthenticated()
    app.state.identity_resolver = resolver
    with TestClient(app) as client:
        response = client.get("/api/v1/me", headers={"x-forwarded-access-token": "synthetic-token"})
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def verified_user(external_id: str | None = None) -> ResolvedUser:
    return ResolvedUser(
        actor=Actor(
            id="synthetic-user-id",
            display="Alice",
            kind=ActorKind.USER,
            roles=[AppRole.VIEWER],
            verified_by="user_token",
        ),
        email="alice@example.test",
        external_id=external_id,
    )


def request_with_forwarded_headers(
    monkeypatch: pytest.MonkeyPatch,
    headers: dict[str, str],
    external_id: str | None = None,
) -> tuple[int, str | None]:
    app = connected_app(monkeypatch)
    resolver = AsyncMock()
    resolver.resolve.return_value = verified_user(external_id)
    app.state.identity_resolver = resolver
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/me",
            headers={
                "x-forwarded-access-token": "synthetic-token",
                **headers,
            },
        )
    return response.status_code, response.json().get("code")


def test_matching_forwarded_email_resolves_successfully(monkeypatch: pytest.MonkeyPatch) -> None:
    assert request_with_forwarded_headers(
        monkeypatch, {"X-Forwarded-Email": "alice@example.test"}
    ) == (200, None)


def test_contradicting_forwarded_email_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    assert request_with_forwarded_headers(
        monkeypatch, {"X-Forwarded-Email": "spoof@example.test"}
    ) == (401, "IDENTITY_MISMATCH")


def test_forwarded_user_rejects_non_matching_external_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert request_with_forwarded_headers(
        monkeypatch,
        {"X-Forwarded-User": "different-idp-user"},
        external_id="idp-user",
    ) == (401, "IDENTITY_MISMATCH")


def test_forwarded_user_without_external_id_is_not_compared(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert request_with_forwarded_headers(
        monkeypatch, {"X-Forwarded-User": "idp-user"}
    ) == (200, None)


def test_forwarded_email_and_preferred_username_are_casefolded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert request_with_forwarded_headers(
        monkeypatch,
        {
            "X-Forwarded-Email": "ALICE@EXAMPLE.TEST",
            "X-Forwarded-Preferred-Username": "ALICE@EXAMPLE.TEST",
        },
    ) == (200, None)


def test_contradicting_preferred_username_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    assert request_with_forwarded_headers(
        monkeypatch, {"X-Forwarded-Preferred-Username": "spoof@example.test"}
    ) == (401, "IDENTITY_MISMATCH")


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
