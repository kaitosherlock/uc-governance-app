# Northwind Mutual — Unity Catalog Governance Demo Estate

Welcome to the **Northwind Mutual** governance demo estate. This directory contains a fully runnable, entirely synthetic Unity Catalog environment designed to demonstrate all major capabilities of the Unity Catalog Governance Application.

---

## 1. Purpose

The purpose of this demo estate is to populate an empty or newly created Databricks workspace with realistic, enterprise-grade governance assets:
- **Multi-layer Catalog and Schemas**: Medallion architecture (`raw`, `curated`, `analytics`, `security`, `reference`) plus a managed volume.
- **Delta Lake Innovations**: Liquid clustering, Change Data Feed (CDF), deletion vectors, and time travel.
- **Attribute-Based Access Control (ABAC)**: Centralized tag-governed masking and row-filtering policies.
- **Direct Controls Contrast**: Column masks applied directly at table level to contrast with ABAC.
- **Dynamic & Materialized Views**: Cell-level redaction using session primitives (`current_user()`, `is_account_group_member()`).
- **Lakeflow Declarative Pipeline**: Production pipeline with data-quality expectations demonstrating record, drop, and fail behaviors.
- **Governed Tags vs. Free-form Tags**: Rigorous tag policies across catalogs, schemas, tables, and columns.
- **Role-Based Grants & Personas**: Pre-configured entitlements for Admins, Stewards, Analysts, Auditors, and Support engineers.
- **Lakehouse Monitoring & Audit Lineage**: Queries for system tables and data health.

Every single data record in this estate is **100% synthetic**. Names, emails (`@example.test`), phones (`555-01xx`), SSNs (in the unissued `900-xx-xxxx` range), addresses, and claims are procedurally generated.

---

## 2. Prerequisites & Requirements

Before executing these scripts:
1. **Workspace Entitlements**: Unity Catalog metastore attached to your Databricks workspace.
2. **Compute**: A Databricks SQL Warehouse (Pro or Serverless recommended for ABAC, Row Filters, and Column Masks) or a cluster running Databricks Runtime (DBR) 14.3 LTS or higher.
3. **Privileges**:
   - `CREATE CATALOG` privilege on the metastore (or workspace admin privileges) to run `01_catalog_and_schemas.sql`.
   - Databricks Account Admin or Group Admin privileges to create the 5 demonstration groups via Databricks CLI (`02_groups.md`).

Read [00_prerequisites.md](00_prerequisites.md) for full details on personas and account-level permissions.

---

## 3. Exact Execution Order

Run the scripts in numerical sequence. All SQL scripts are idempotent (`CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`).

| Step | Script / Guide | Purpose | Est. Runtime |
|---|---|---|---|
| 0 | `00_prerequisites.md` | Pre-flight checks and privilege verification | Manual |
| 1 | `01_catalog_and_schemas.sql` | Creates `demo_governance` catalog, 5 schemas, and 1 volume | ~10s |
| 2 | `02_groups.md` | Databricks CLI commands to create demo groups & assign users | ~1-2m |
| 3 | `03_reference_data.sql` | Seed lookup tables (`regions`, `claim_status`, `diagnosis_codes`) | ~15s |
| 4 | `04_raw_data.sql` | Seed intentionally dirty landing tables with data defects | ~25s |
| 5 | `05_curated_data.sql` | Cleaned gold/silver tables with Liquid Clustering & CDF | ~30s |
| 6 | `06_tags_and_policies.sql` | Governed tags, tag policies, and multi-tier tag bindings | ~20s |
| 7 | `07_masking_functions.sql` | SQL UDFs for SSN, email, phone, DOB, and monetary amounts | ~15s |
| 8 | `08_row_filters.sql` | SQL UDFs for regional and status-based row filtering | ~15s |
| 9 | `09_abac_policies.sql` | Tag-based central governance policies for masking & row filters | ~20s |
| 10 | `10_apply_direct_controls.sql` | Direct column mask attachment (contrasts with ABAC) | ~10s |
| 11 | `11_views.sql` | Materialized view and dynamic redaction view | ~20s |
| 12 | `12_grants.sql` | Fine-grained privileges for groups and application Service Principal | ~20s |
| 13 | `13_monitoring_and_system_tables.sql` | Audit logging, column lineage, Lakehouse Monitoring | ~15s |
| Opt | `pipeline/` | Lakeflow Declarative Pipeline for data validation | ~3-5m |

Total execution time to provision the entire demo estate: **under 4 minutes** on a standard SQL warehouse.

---

## 4. Verification & Testing

Once loaded, refer to [VERIFY.md](VERIFY.md) for an in-depth walkthrough of the Governance Application. It provides step-by-step instructions on:
- Exploring catalog hierarchy and tags in the **Data Assets** tab.
- Auditing permissions and effective group access in the **Access** tab.
- Inspecting governed vs. free-form tag values in the **Tags** tab.
- Reviewing ABAC policies vs. direct table masks in the **Filters and Masks** tab.
- Logging in as different personas (`gov_demo_analysts`, `gov_demo_support_emea`, `gov_demo_auditors`) to verify cell-level masking and row-level filtering in real-time.

---

## 5. Teardown

To completely remove the demo estate without leaving any orphaned objects:
Run `99_teardown.sql`.

```sql
-- Drops demo_governance catalog and all encapsulated schemas, tables, views, volumes, and UDFs:
DROP CATALOG IF EXISTS demo_governance CASCADE;
```
For group removal instructions, see [02_groups.md](02_groups.md).
