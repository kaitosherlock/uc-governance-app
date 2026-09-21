import pytest
from app.config.settings import Mode, Settings, assert_mode_is_safe
from app.main import create_app
from pydantic import ValidationError


@pytest.mark.parametrize("name", ["DATABRICKS_APP_PORT", "DATABRICKS_CLIENT_ID"])
@pytest.mark.parametrize("value", ["", "synthetic"])
def test_fixture_guard_rejects_presence(
    monkeypatch: pytest.MonkeyPatch, name: str, value: str,
) -> None:
    monkeypatch.setenv(name, value)
    with pytest.raises(RuntimeError, match="Fixture mode cannot run in a deployed app"):
        create_app()


def test_missing_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("UCGOV_MODE")
    with pytest.raises(ValidationError, match="mode"):
        create_app()


def test_invalid_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UCGOV_MODE", "demo")
    with pytest.raises(ValidationError, match="fixture.*connected_readonly.*connected"):
        create_app()


def test_defaults_and_comma_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UCGOV_MANAGED_CATALOGS", " sales, hr, ,shared_ref ")
    settings = Settings()
    assert settings.managed_catalogs == ["sales", "hr", "shared_ref"]
    assert settings.plan_ttl_seconds == 600
    assert settings.sod_enabled is True
    monkeypatch.setenv("UCGOV_MANAGED_CATALOGS", "")
    assert Settings().managed_catalogs == []


def test_guard_allows_connected_and_local_fixture(monkeypatch: pytest.MonkeyPatch) -> None:
    assert_mode_is_safe(Settings(), {})
    monkeypatch.delenv("UCGOV_FIXTURE_ACTOR")
    assert_mode_is_safe(Settings(mode=Mode.CONNECTED), {"DATABRICKS_CLIENT_ID": ""})


def test_connected_cannot_select_fixture_actor() -> None:
    with pytest.raises(ValidationError, match="cannot be set in connected modes"):
        Settings(mode=Mode.CONNECTED)


def test_pg_and_hmac_never_appear_in_repr_or_dump(monkeypatch: pytest.MonkeyPatch) -> None:
    secrets = {
        "UCGOV_PLAN_HMAC_KEY": "synthetic-hmac-for-test",
        "PGHOST": "synthetic-pg-host",
        "PGPORT": "6543",
        "PGDATABASE": "synthetic-db",
        "PGUSER": "synthetic-user",
        "PGSSLMODE": "synthetic-tls-mode",
        "PGAPPNAME": "synthetic-pg-app",
        "PGPASSWORD": "synthetic-password-for-test",
    }
    for name, value in secrets.items():
        monkeypatch.setenv(name, value)
    settings = Settings()
    for value in secrets.values():
        assert value not in repr(settings)
        assert value not in settings.model_dump_json()
    assert settings.durable_store_configured


def test_account_id_alone_is_not_a_configured_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UCGOV_ACCOUNT_ID", "synthetic-account")
    assert not Settings().account_client_configured
