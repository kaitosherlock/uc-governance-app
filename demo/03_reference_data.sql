-- ============================================================================
-- SCRIPT: 03_reference_data.sql
-- PURPOSE: Seeds authoritative reference lookups in `demo_governance.reference`.
-- DEPENDS ON: `01_catalog_and_schemas.sql`.
-- RUNTIME: ~15 seconds.
-- IDEMPOTENT: Uses `CREATE OR REPLACE TABLE`. Safe to re-run.
-- ============================================================================

USE CATALOG demo_governance;
USE SCHEMA reference;

-- ============================================================================
-- 1. Table: reference.regions
-- Demonstrates: Delta Deletion Vectors for fast metadata-level point updates
-- without rewriting Parquet data files.
-- ============================================================================
CREATE OR REPLACE TABLE demo_governance.reference.regions (
    region_code STRING NOT NULL COMMENT 'Unique ISO/Operational region code',
    region_name STRING NOT NULL COMMENT 'Descriptive region territory name',
    regulatory_framework STRING NOT NULL COMMENT 'Primary privacy framework (e.g. GDPR, CCPA, APPI)',
    is_active BOOLEAN NOT NULL COMMENT 'Whether territory is actively underwriting policies'
)
COMMENT 'Geographical underwriting territories and associated regulatory compliance frameworks'
TBLPROPERTIES (
    'delta.enableDeletionVectors' = 'true',
    'delta.enableChangeDataFeed' = 'true'
);

INSERT INTO demo_governance.reference.regions VALUES
    ('EMEA', 'Europe, Middle East and Africa', 'GDPR', true),
    ('AMER', 'Americas Underwriting Zone', 'CCPA_NAIC', true),
    ('APAC', 'Asia-Pacific Regional Market', 'APPI_PDPA', true),
    ('LATAM', 'Latin America Regional Market', 'LGPD', false);


-- ============================================================================
-- 2. Table: reference.claim_status
-- Demonstrates: Clean status definitions used to validate claims lifecycle
-- ============================================================================
CREATE OR REPLACE TABLE demo_governance.reference.claim_status (
    status_code STRING NOT NULL COMMENT 'Standard claim status code',
    status_label STRING NOT NULL COMMENT 'Human-readable lifecycle status label',
    is_terminal BOOLEAN NOT NULL COMMENT 'True if no further workflow state changes allowed',
    display_order INT NOT NULL COMMENT 'Workflow sequence ordering'
)
COMMENT 'Authoritative insurance claim lifecycle state machine definitions'
TBLPROPERTIES (
    'delta.enableDeletionVectors' = 'true'
);

INSERT INTO demo_governance.reference.claim_status VALUES
    ('SUBMITTED',    'Claim Received & Awaiting Intake', false, 1),
    ('UNDER_REVIEW', 'Under Active Adjudication Review',  false, 2),
    ('APPROVED',     'Adjudicated and Approved for Pay', false, 3),
    ('REJECTED',     'Adjudicated and Denied Coverage',  true,  4),
    ('PAID',         'Disbursement Confirmed Complete',   true,  5);


-- ============================================================================
-- 3. Table: reference.diagnosis_codes
-- Demonstrates: Synthetic ICD/procedure codes with Liquid Clustering for fast
-- range and equality lookups.
-- ============================================================================
CREATE OR REPLACE TABLE demo_governance.reference.diagnosis_codes (
    diagnosis_code STRING NOT NULL COMMENT 'Synthetic diagnosis code identifier',
    category STRING NOT NULL COMMENT 'Clinical / loss event category',
    description STRING NOT NULL COMMENT 'Synthetic procedure or diagnosis description',
    risk_tier STRING NOT NULL COMMENT 'Underwriting risk classification tier (LOW, MEDIUM, HIGH, CRITICAL)',
    max_reimbursement DECIMAL(12, 2) NOT NULL COMMENT 'Standard coverage ceiling under baseline policy'
)
CLUSTER BY (category, risk_tier)
COMMENT 'Synthetic diagnosis and loss event codes for underwriting adjudication'
TBLPROPERTIES (
    'delta.enableDeletionVectors' = 'true',
    'delta.enableChangeDataFeed' = 'true'
);

INSERT INTO demo_governance.reference.diagnosis_codes VALUES
    ('DX-NW-101', 'Outpatient Care', 'Synthetic preventative annual wellness screening', 'LOW', 750.00),
    ('DX-NW-102', 'Outpatient Care', 'Synthetic minor diagnostic imaging and laboratory panel', 'LOW', 1200.00),
    ('DX-NW-201', 'Emergency Care', 'Synthetic acute urgent care intervention and stabilization', 'MEDIUM', 3500.00),
    ('DX-NW-202', 'Emergency Care', 'Synthetic trauma evaluation and emergency triage', 'HIGH', 15000.00),
    ('DX-NW-301', 'Inpatient Surgery', 'Synthetic orthopedic reconstructive procedure', 'HIGH', 28500.00),
    ('DX-NW-302', 'Inpatient Surgery', 'Synthetic major cardiovascular restorative surgery', 'CRITICAL', 75000.00),
    ('DX-NW-401', 'Specialty Therapy', 'Synthetic physical rehabilitation program (12-week course)', 'MEDIUM', 4200.00);

-- Confirm row counts
SELECT 'regions' AS table_name, count(*) AS row_count FROM demo_governance.reference.regions
UNION ALL
SELECT 'claim_status' AS table_name, count(*) AS row_count FROM demo_governance.reference.claim_status
UNION ALL
SELECT 'diagnosis_codes' AS table_name, count(*) AS row_count FROM demo_governance.reference.diagnosis_codes;
