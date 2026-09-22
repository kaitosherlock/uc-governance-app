# 00 — Prerequisites and Environment Setup

Before running the Northwind Mutual governance demo scripts, verify that your Databricks workspace and identity meet the following requirements.

---

## 1. Unity Catalog Metastore Requirements

- **Unity Catalog Enabled**: The target workspace must be assigned to an active Unity Catalog metastore.
- **Catalog Creation Privilege**: The user or service principal executing `01_catalog_and_schemas.sql` must have:
  ```sql
  -- Metastore-level privilege:
  GRANT CREATE CATALOG ON METASTORE TO `your.email@domain.com`;
  ```
  *(Or the user must be a Metastore Admin or Workspace Admin).*

- **Compute Runtime**:
  - **Recommended**: Databricks SQL Serverless or Pro Warehouse (channel: Current or Preview).
  - **Alternative**: An All-Purpose or Jobs Compute cluster running **Databricks Runtime (DBR) 14.3 LTS or higher** with Unity Catalog single-user or shared access mode.
  - *Note on Row Filters & Column Masks*: Fine-grained access control policies and UDF masks require Serverless SQL, Pro SQL, or Shared Access Mode compute. Single-user clusters without UC fine-grained access control cannot evaluate row filters and column masks for users other than the single assigned owner.

---

## 2. Identity & Access Management (Groups)

The demo utilizes 5 dedicated demonstration groups:
1. `gov_demo_admins` — Platform & Governance administrators.
2. `gov_demo_stewards` — Data stewards with metadata editing and unmasked preview rights.
3. `gov_demo_analysts` — Business analysts with restricted access and masked PII.
4. `gov_demo_auditors` — Compliance auditors with full financial visibility but restricted operational access.
5. `gov_demo_support_emea` — Regional support staff constrained to EMEA territory records via row filters.

### Account Admin vs. Workspace Admin:
- **Account-Level Groups (Best Practice)**: If your organization syncs identities via SCIM or manages groups at the account level (`accounts.cloud.databricks.com`), an **Account Admin** must create the groups or run the Databricks CLI commands shown in [02_groups.md](02_groups.md).
- **Workspace-Level Fallback**: If you do not have Account Admin privileges, a **Workspace Admin** can create workspace-local groups via the Workspace Settings UI (**Identity and access > Groups**) with the exact names above. Note that `is_account_group_member()` works for groups synchronized to the account or assigned to the workspace.

---

## 3. Governance Application Service Principal

The UC Governance Application interacts with Databricks using a dedicated Service Principal (or current user session).
To permit the application to scan and manage `demo_governance`:
1. Navigate to **Workspace Settings > Identity and access > Service principals**.
2. Identify the Service Principal used by your deployment (e.g., `uc-governance-app-sp` or an Application Client ID UUID such as `00000000-0000-0000-0000-000000000000`).
3. You will replace the placeholder `<app_service_principal_id_or_name>` in `12_grants.sql` with this identifier.

---

## 4. Safety & Isolation Guarantee

- All tables, views, schemas, volumes, and functions are created strictly inside the `demo_governance` catalog.
- No existing catalogs (`main`, `samples`, `hive_metastore`, etc.) are read or modified.
- No external cloud storage buckets are overwritten; the managed volume and managed tables use Unity Catalog's default metastore storage location.
- Complete cleanup is achievable at any time by running `99_teardown.sql`.
