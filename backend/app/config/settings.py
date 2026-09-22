"""Explicit modes and secret-safe environment configuration."""

from collections.abc import Mapping
from enum import StrEnum
from typing import Annotated

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Mode(StrEnum):
    FIXTURE = "fixture"
    CONNECTED_READONLY = "connected_readonly"
    CONNECTED = "connected"


CommaList = Annotated[list[str], NoDecode]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="UCGOV_", hide_input_in_errors=True, populate_by_name=True, extra="ignore"
    )

    mode: Mode
    fixture_actor: str | None = None
    environment_label: str = "DEV"
    managed_catalogs: CommaList = Field(default_factory=list)
    role_groups: dict[str, list[str]] = Field(default_factory=dict)
    plan_ttl_seconds: int = Field(default=600, gt=0)
    support_contact: str | None = None
    sod_enabled: bool = True
    local_auth: str = ""
    bootstrap_admins: CommaList = Field(default_factory=list)
    warehouse_id: str = ""
    plan_hmac_key: SecretStr = Field(default=SecretStr(""), repr=False, exclude=True)
    account_id: str = ""
    workspace_host: str = Field(default="", validation_alias="DATABRICKS_HOST")
    workspace_id: str | None = Field(default=None, validation_alias="DATABRICKS_WORKSPACE_ID")
    pg_host: SecretStr = Field(
        default=SecretStr(""), validation_alias="PGHOST", repr=False, exclude=True
    )
    pg_port: SecretStr = Field(
        default=SecretStr("5432"), validation_alias="PGPORT", repr=False, exclude=True
    )
    pg_database: SecretStr = Field(
        default=SecretStr(""), validation_alias="PGDATABASE", repr=False, exclude=True
    )
    pg_user: SecretStr = Field(
        default=SecretStr(""), validation_alias="PGUSER", repr=False, exclude=True
    )
    pg_sslmode: SecretStr = Field(
        default=SecretStr("verify-full"), validation_alias="PGSSLMODE", repr=False, exclude=True
    )
    pg_appname: SecretStr = Field(
        default=SecretStr("uc-governance-app"),
        validation_alias="PGAPPNAME",
        repr=False,
        exclude=True,
    )
    pg_password: SecretStr = Field(
        default=SecretStr(""), validation_alias="PGPASSWORD", repr=False, exclude=True
    )

    @field_validator("managed_catalogs", "bootstrap_admins", mode="before")
    @classmethod
    def parse_comma_list(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def validate_mode_configuration(self) -> "Settings":
        if self.mode != Mode.FIXTURE and self.fixture_actor:
            raise ValueError("UCGOV_FIXTURE_ACTOR cannot be set in connected modes.")
        if self.bootstrap_admins and self.mode != Mode.CONNECTED_READONLY:
            raise ValueError("Bootstrap admins are allowed only in connected_readonly mode.")
        return self

    @property
    def warehouse_configured(self) -> bool:
        return bool(self.warehouse_id.strip())

    @property
    def durable_store_configured(self) -> bool:
        return all(
            value.get_secret_value().strip()
            for value in (
                self.pg_host,
                self.pg_database,
                self.pg_user,
            )
        )

    @property
    def account_client_configured(self) -> bool:
        # No Account client is constructed in P0-03; an account id alone is insufficient.
        return False


def load_settings() -> Settings:
    """Build Settings from the environment. Fails loudly when UCGOV_MODE is absent."""
    return Settings()  # type: ignore[call-arg]  # pydantic-settings fills fields from the environment


def assert_mode_is_safe(settings: Settings, env: Mapping[str, str]) -> None:
    if settings.mode == Mode.FIXTURE and (
        "DATABRICKS_APP_PORT" in env or "DATABRICKS_CLIENT_ID" in env
    ):
        raise RuntimeError("Fixture mode cannot run in a deployed app.")
