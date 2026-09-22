-- ============================================================================
-- SCRIPT: 01_catalog_and_schemas.sql
-- PURPOSE: Provisions the isolated demo catalog `demo_governance`, 5 medallion
--          and governance schemas, and 1 managed volume.
-- DEPENDS ON: Metastore `CREATE CATALOG` privilege or Workspace Admin rights.
-- RUNTIME: ~10 seconds.
-- IDEMPOTENT: Uses `IF NOT EXISTS` constructs. Safe to re-run.
-- ============================================================================

-- 1. Create the isolated top-level catalog
CREATE CATALOG IF NOT EXISTS demo_governance
COMMENT 'Northwind Mutual synthetic insurance governance demo estate';

-- Set current catalog context
USE CATALOG demo_governance;

-- 2. Create the Medallion and Governance Schemas
-- Schema: raw (Bronze landing tables, deliberately dirty data for pipeline expectations)
CREATE SCHEMA IF NOT EXISTS demo_governance.raw
COMMENT 'Landing zone for raw policy, claims, and payment records with data defects';

-- Schema: curated (Silver/Gold clean, conformed, liquid-clustered enterprise entities)
CREATE SCHEMA IF NOT EXISTS demo_governance.curated
COMMENT 'Cleaned, conformed entities with business validation and liquid clustering';

-- Schema: analytics (Aggregated metrics, dynamic redaction views, materialized views)
CREATE SCHEMA IF NOT EXISTS demo_governance.analytics
COMMENT 'Analytical aggregates, dynamic security views, and reporting models';

-- Schema: security (Storage for row filter and column mask UDF functions)
CREATE SCHEMA IF NOT EXISTS demo_governance.security
COMMENT 'Central security repository containing fine-grained masking and filtering UDFs';

-- Schema: reference (Standard code lookups: regions, status codes, diagnosis codes)
CREATE SCHEMA IF NOT EXISTS demo_governance.reference
COMMENT 'Authoritative reference lookups and cross-domain classification codes';

-- 3. Create a Managed Volume under raw
-- Volumes represent Unity Catalog objects for non-tabular file assets.
-- This demonstrates the Governance App ability to inventory both tables and volumes.
CREATE VOLUME IF NOT EXISTS demo_governance.raw.landing_volume
COMMENT 'Managed volume for ingesting raw file arrivals (CSV/JSON claims archives)';

-- Display created schemas to verify execution
SHOW SCHEMAS IN demo_governance;
