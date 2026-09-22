"""Local declarations only; no network probing or inferred Databricks support."""

from dataclasses import dataclass
from datetime import UTC, datetime

from app.api.v1.models import Capability, CapabilityRequirement, CapabilityStatusValue
from app.config.settings import Settings
from app.errors import NotConfigured, NotImplementedYet


@dataclass(frozen=True)
class Declaration:
    capability: str
    domain: str
    requires: tuple[CapabilityRequirement, ...] = ()
    status: CapabilityStatusValue = CapabilityStatusValue.NOT_IMPLEMENTED
    reason: str | None = None


SQL = (CapabilityRequirement.SQL_WAREHOUSE,)
STORE = (CapabilityRequirement.DURABLE_STORE,)
ACCOUNT = (CapabilityRequirement.ACCOUNT_CLIENT,)
AVAILABLE = CapabilityStatusValue.AVAILABLE
REGISTRY = (
    Declaration("context.read", "6", status=AVAILABLE),
    Declaration("identity.read", "8", status=AVAILABLE),
    Declaration("capabilities.read", "5", status=AVAILABLE),
    Declaration("authz.group_resolution", "8"),
    Declaration("assets.read", "7.1", status=AVAILABLE),
    Declaration("assets.edit_metadata", "7.1", status=AVAILABLE),
    Declaration("assets.delete", "7.1"),
    Declaration("grants.read", "7.2", status=AVAILABLE),
    Declaration("grants.update", "7.2", status=AVAILABLE),
    Declaration("ownership.transfer", "7.2", status=AVAILABLE),
    Declaration("principals.search", "7.2", status=AVAILABLE),
    Declaration("privileges.read", "7.2", status=AVAILABLE),
    Declaration("tags.read", "7.3", status=AVAILABLE),
    Declaration("tags.update", "7.3", status=AVAILABLE),
    Declaration("tag_policies.read", "7.3", status=AVAILABLE),
    Declaration("tag_policies.update", "7.3"),
    Declaration("classification.read", "7.3"),
    Declaration("abac_policies.read", "7.4"),
    Declaration("abac_policies.update", "7.4"),
    Declaration("filters.read", "7.5"),
    Declaration("filters.update", "7.5", SQL),
    Declaration("dynamic_views.update", "7.5", SQL),
    Declaration("storage_credentials.read", "7.6"),
    Declaration("storage_credentials.update", "7.6"),
    Declaration("service_credentials.read", "7.6"),
    Declaration("service_credentials.update", "7.6"),
    Declaration("external_locations.read", "7.6"),
    Declaration("external_locations.update", "7.6"),
    Declaration("bindings.read", "7.6"),
    Declaration("bindings.update", "7.6"),
    Declaration("connections.read", "7.7"),
    Declaration("connections.update", "7.7"),
    Declaration("foreign_catalogs.read", "7.7"),
    Declaration("sharing.read", "7.8"),
    Declaration("sharing.update", "7.8"),
    Declaration("clean_rooms.read", "7.8"),
    Declaration("marketplace.read", "7.8"),
    Declaration("lineage.read", "7.9", SQL),
    Declaration("activity.app", "7.10", STORE),
    Declaration("activity.databricks_audit", "7.10", SQL),
    Declaration("findings.read", "7.10"),
    Declaration("quality.read", "7.11"),
    Declaration("quality.create", "7.11"),
    Declaration("quality.refresh", "7.11"),
    Declaration("models.read", "7.11"),
    Declaration("model_versions.read", "7.11"),
    Declaration("functions.read", "7.11"),
    Declaration("serving_endpoints.read", "7.11"),
    Declaration("access_requests.native", "7.12"),
    Declaration("access_requests.app", "7.12", STORE),
    Declaration("approvals.update", "7.12", STORE),
    Declaration("access_reviews.update", "7.12", STORE),
    Declaration("time_bound_access.update", "7.12", STORE),
    Declaration("admin.metastores", "7.1", ACCOUNT),
    # The lifecycle and these four concrete kinds are available in fixture mode.
    Declaration("plans.lifecycle_core", "9", status=AVAILABLE),
    Declaration("plans.read", "9", status=AVAILABLE),
    Declaration("operations.read", "9", status=AVAILABLE),
    Declaration("plans.create", "9", status=AVAILABLE),
    Declaration("plans.execute", "9", status=AVAILABLE),
    Declaration("operations.reconcile", "9", status=AVAILABLE),
)


def probe(declaration: Declaration, settings: Settings) -> Capability:
    configured = {
        CapabilityRequirement.SQL_WAREHOUSE: settings.warehouse_configured,
        CapabilityRequirement.DURABLE_STORE: settings.durable_store_configured,
        CapabilityRequirement.ACCOUNT_CLIENT: settings.account_client_configured,
        # A scope cannot be established from configuration alone.
        CapabilityRequirement.USER_TOKEN_SCOPE: False,
    }
    missing = [
        requirement.value for requirement in declaration.requires if not configured[requirement]
    ]
    status = declaration.status
    reason = (
        None
        if status == AVAILABLE
        else declaration.reason or "This capability is not implemented in this version."
    )
    if missing:
        status = CapabilityStatusValue.NOT_CONFIGURED
        reason = "Missing requirement: " + ", ".join(missing) + "."
        if declaration.status == CapabilityStatusValue.NOT_IMPLEMENTED:
            reason += " Implementation is also pending."
    return Capability(
        capability=declaration.capability,
        domain=declaration.domain,
        status=status,
        reason=reason,
        requires=list(declaration.requires),
        checked_at=datetime.now(UTC),
    )


def require_available(capability_id: str, settings: Settings) -> None:
    declaration = next((row for row in REGISTRY if row.capability == capability_id), None)
    if declaration is None or declaration.status == CapabilityStatusValue.NOT_IMPLEMENTED:
        raise NotImplementedYet()
    capability = probe(declaration, settings)
    if capability.status == CapabilityStatusValue.NOT_CONFIGURED:
        raise NotConfigured(capability.reason)
