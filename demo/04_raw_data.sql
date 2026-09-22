-- ============================================================================
-- SCRIPT: 04_raw_data.sql
-- PURPOSE: Seeds intentionally dirty landing tables in `demo_governance.raw`.
--          These deliberate defects provide concrete targets for the Lakeflow /
--          DLT data-quality expectations (expect, expect_or_drop, expect_or_fail).
-- DEPENDS ON: `01_catalog_and_schemas.sql`.
-- RUNTIME: ~25 seconds.
-- IDEMPOTENT: Uses `CREATE OR REPLACE TABLE`. Safe to re-run.
-- ============================================================================

USE CATALOG demo_governance;
USE SCHEMA raw;

-- ============================================================================
-- 1. Table: raw.policyholders_raw
-- Contains intentional defects:
--   - NULL identifiers and full names
--   - Malformed emails (missing '@', missing domain)
--   - Impossible dates of birth (future year 2055, historic year 1805)
--   - Duplicate policyholder IDs
-- ============================================================================
CREATE OR REPLACE TABLE demo_governance.raw.policyholders_raw (
    raw_record_id BIGINT GENERATED ALWAYS AS IDENTITY,
    policyholder_id STRING COMMENT 'Synthetic policyholder ID (some duplicates present)',
    full_name STRING COMMENT 'Synthetic customer name (some NULLs present)',
    email STRING COMMENT 'Email address (some malformed without @ or domain)',
    phone STRING COMMENT 'Synthetic phone in 555-01xx range',
    ssn STRING COMMENT 'Synthetic SSN in unissued 900-xx-xxxx range',
    date_of_birth STRING COMMENT 'Raw DOB string (includes invalid/future/ancient dates)',
    address_line STRING COMMENT 'Synthetic street address',
    city STRING COMMENT 'Synthetic city',
    region STRING COMMENT 'Geographic region code',
    signup_date STRING COMMENT 'Raw signup timestamp string',
    status STRING COMMENT 'Account status string',
    ingested_at TIMESTAMP COMMENT 'Landing timestamp'
)
COMMENT 'Bronze landing table for policyholders with deliberate data quality anomalies'
TBLPROPERTIES (
    'delta.enableDeletionVectors' = 'true',
    'delta.enableChangeDataFeed' = 'true'
);

-- Generate 1,200 synthetic baseline rows
INSERT INTO demo_governance.raw.policyholders_raw (
    policyholder_id, full_name, email, phone, ssn, date_of_birth,
    address_line, city, region, signup_date, status, ingested_at
)
SELECT
    concat('POL-', lpad(cast(id as string), 6, '0')) AS policyholder_id,
    concat(
        CASE (id % 10)
            WHEN 0 THEN 'Alex' WHEN 1 THEN 'Jordan' WHEN 2 THEN 'Taylor'
            WHEN 3 THEN 'Morgan' WHEN 4 THEN 'Casey' WHEN 5 THEN 'Riley'
            WHEN 6 THEN 'Avery' WHEN 7 THEN 'Quinn' WHEN 8 THEN 'Logan' ELSE 'Sam'
        END,
        ' ',
        CASE ((id / 10) % 10)
            WHEN 0 THEN 'Campbell' WHEN 1 THEN 'Holloway' WHEN 2 THEN 'Mercer'
            WHEN 3 THEN 'Sinclair' WHEN 4 THEN 'Vance' WHEN 5 THEN 'Winslow'
            WHEN 6 THEN 'Fairchild' WHEN 7 THEN 'Prescott' WHEN 8 THEN 'Sterling' ELSE 'Winter'
        END
    ) AS full_name,
    concat('user.', cast(id as string), '@example.test') AS email,
    concat('+1-555-01', lpad(cast((id % 100) as string), 2, '0')) AS phone,
    concat('900-', lpad(cast((abs(hash(id * 13)) % 90 + 10) as string), 2, '0'), '-', lpad(cast((abs(hash(id * 37)) % 9000 + 1000) as string), 4, '0')) AS ssn,
    date_format(date_add('1950-01-01', cast((id * 17) % 20000 as int)), 'yyyy-MM-dd') AS date_of_birth,
    concat(cast((id * 123) % 9000 + 100 as string), ' Synthetic Way') AS address_line,
    CASE (id % 5)
        WHEN 0 THEN 'Metropolis' WHEN 1 THEN 'Gotham' WHEN 2 THEN 'Starling'
        WHEN 3 THEN 'Central City' ELSE 'Coast City'
    END AS city,
    CASE (id % 4)
        WHEN 0 THEN 'AMER' WHEN 1 THEN 'EMEA' WHEN 2 THEN 'APAC' ELSE 'AMER'
    END AS region,
    date_format(date_add('2022-01-01', cast((id * 7) % 1000 as int)), 'yyyy-MM-dd HH:mm:ss') AS signup_date,
    CASE WHEN (id % 8 = 0) THEN 'SUSPENDED' WHEN (id % 15 = 0) THEN 'PENDING' ELSE 'ACTIVE' END AS status,
    current_timestamp() AS ingested_at
FROM (SELECT explode(sequence(1, 1200)) AS id);

-- Inject deliberate anomalies for DLT expectations to detect
INSERT INTO demo_governance.raw.policyholders_raw (
    policyholder_id, full_name, email, phone, ssn, date_of_birth,
    address_line, city, region, signup_date, status, ingested_at
) VALUES
    -- Defect 1: Malformed email missing '@'
    ('POL-000042', 'Bad Email User', 'missing_at_symbol.example.test', '+1-555-0142', '900-11-2222', '1985-04-12', '101 Glitch Ave', 'Metropolis', 'AMER', '2023-01-10 10:00:00', 'ACTIVE', current_timestamp()),
    -- Defect 2: Malformed email with trailing garbage
    ('POL-000043', 'Broken Domain User', 'user@invalid_domain_format', '+1-555-0143', '900-11-3333', '1990-07-20', '102 Error Rd', 'Gotham', 'EMEA', '2023-02-15 11:30:00', 'ACTIVE', current_timestamp()),
    -- Defect 3: Impossible future date of birth
    ('POL-000044', 'Future Traveler', 'future.traveler@example.test', '+1-555-0144', '900-11-4444', '2055-11-30', '103 Paradox Ln', 'Starling', 'AMER', '2023-03-01 09:15:00', 'ACTIVE', current_timestamp()),
    -- Defect 4: Impossible historic date of birth (ancient)
    ('POL-000045', 'Ancient Individual', 'ancient.one@example.test', '+1-555-0145', '900-11-5555', '1805-02-14', '104 Epoch St', 'Central City', 'APAC', '2023-03-05 14:00:00', 'ACTIVE', current_timestamp()),
    -- Defect 5: NULL email address (violates completeness expectation)
    ('POL-000046', 'Anonymous NoEmail', NULL, '+1-555-0146', '900-11-6666', '1982-09-09', '105 Dark Way', 'Coast City', 'EMEA', '2023-03-12 16:45:00', 'ACTIVE', current_timestamp()),
    -- Defect 6: NULL policyholder_id (critical defect for expect_or_fail)
    (NULL, 'Ghost Identity', 'ghost.identity@example.test', '+1-555-0147', '900-11-7777', '1979-05-18', '0 Void St', 'Metropolis', 'AMER', '2023-03-20 08:00:00', 'PENDING', current_timestamp()),
    -- Defect 7: Duplicate ID entry for POL-000100
    ('POL-000100', 'Duplicate Shadow', 'duplicate.shadow@example.test', '+1-555-0148', '900-11-8888', '1991-03-25', '999 Duplicate Blvd', 'Gotham', 'AMER', '2023-04-01 12:00:00', 'ACTIVE', current_timestamp());


-- ============================================================================
-- 2. Table: raw.claims_raw
-- Contains intentional defects:
--   - Negative claim amounts (financial impossibility)
--   - Future submission timestamps
--   - Unrecognized claim status codes
-- ============================================================================
CREATE OR REPLACE TABLE demo_governance.raw.claims_raw (
    raw_claim_id BIGINT GENERATED ALWAYS AS IDENTITY,
    claim_id STRING COMMENT 'Synthetic claim ID',
    policyholder_id STRING COMMENT 'Foreign key to policyholder',
    claim_amount STRING COMMENT 'Raw claim amount string (includes negative and non-numeric entries)',
    diagnosis_code STRING COMMENT 'Reference diagnosis code',
    region STRING COMMENT 'Regional jurisdiction',
    submitted_at STRING COMMENT 'Raw submission timestamp (includes future timestamps)',
    status STRING COMMENT 'Lifecycle status (includes invalid codes)',
    ingested_at TIMESTAMP COMMENT 'Landing timestamp'
)
COMMENT 'Bronze landing table for insurance claims with intentional monetary and temporal defects'
TBLPROPERTIES (
    'delta.enableDeletionVectors' = 'true',
    'delta.enableChangeDataFeed' = 'true'
);

-- Generate 2,500 baseline synthetic claim rows
INSERT INTO demo_governance.raw.claims_raw (
    claim_id, policyholder_id, claim_amount, diagnosis_code, region, submitted_at, status, ingested_at
)
SELECT
    concat('CLM-', lpad(cast(id as string), 7, '0')) AS claim_id,
    concat('POL-', lpad(cast(((id * 7) % 1200 + 1) as string), 6, '0')) AS policyholder_id,
    cast(round(((abs(hash(id * 23)) % 450000) / 10.0 + 150.0), 2) as string) AS claim_amount,
    CASE (id % 7)
        WHEN 0 THEN 'DX-NW-101' WHEN 1 THEN 'DX-NW-102' WHEN 2 THEN 'DX-NW-201'
        WHEN 3 THEN 'DX-NW-202' WHEN 4 THEN 'DX-NW-301' WHEN 5 THEN 'DX-NW-302'
        ELSE 'DX-NW-401'
    END AS diagnosis_code,
    CASE (id % 3) WHEN 0 THEN 'EMEA' WHEN 1 THEN 'AMER' ELSE 'APAC' END AS region,
    date_format(date_add('2023-01-01', cast((id * 3) % 500 as int)), 'yyyy-MM-dd HH:mm:ss') AS submitted_at,
    CASE (id % 5)
        WHEN 0 THEN 'SUBMITTED' WHEN 1 THEN 'UNDER_REVIEW' WHEN 2 THEN 'APPROVED'
        WHEN 3 THEN 'PAID' ELSE 'REJECTED'
    END AS status,
    current_timestamp() AS ingested_at
FROM (SELECT explode(sequence(1, 2500)) AS id);

-- Inject deliberate anomalies into claims_raw
INSERT INTO demo_governance.raw.claims_raw (
    claim_id, policyholder_id, claim_amount, diagnosis_code, region, submitted_at, status, ingested_at
) VALUES
    -- Defect 1: Negative claim amount (-1500.00)
    ('CLM-9000001', 'POL-000010', '-1500.00', 'DX-NW-101', 'AMER', '2023-08-01 10:00:00', 'SUBMITTED', current_timestamp()),
    -- Defect 2: Highly negative claim amount (-87450.50)
    ('CLM-9000002', 'POL-000011', '-87450.50', 'DX-NW-302', 'EMEA', '2023-08-02 11:30:00', 'UNDER_REVIEW', current_timestamp()),
    -- Defect 3: Future submission timestamp (2099-12-31)
    ('CLM-9000003', 'POL-000012', '4500.00', 'DX-NW-201', 'APAC', '2099-12-31 23:59:59', 'SUBMITTED', current_timestamp()),
    -- Defect 4: Invalid/unrecognized status code ('GHOST_PROCESSING')
    ('CLM-9000004', 'POL-000013', '2100.00', 'DX-NW-102', 'AMER', '2023-08-05 14:20:00', 'GHOST_PROCESSING', current_timestamp()),
    -- Defect 5: Unrecognized diagnosis code ('INVALID-DX-999')
    ('CLM-9000005', 'POL-000014', '7800.00', 'INVALID-DX-999', 'EMEA', '2023-08-06 09:00:00', 'SUBMITTED', current_timestamp());


-- ============================================================================
-- 3. Table: raw.payments_raw
-- Contains intentional defects:
--   - Orphan claim IDs (claims that do not exist in claims_raw)
--   - Negative disbursement amounts
-- ============================================================================
CREATE OR REPLACE TABLE demo_governance.raw.payments_raw (
    raw_payment_id BIGINT GENERATED ALWAYS AS IDENTITY,
    payment_id STRING COMMENT 'Synthetic disbursement identifier',
    claim_id STRING COMMENT 'Foreign key to claim (some orphan references present)',
    amount STRING COMMENT 'Disbursement monetary amount',
    method STRING COMMENT 'Disbursement transfer rail',
    paid_at STRING COMMENT 'Disbursement timestamp',
    ingested_at TIMESTAMP COMMENT 'Landing timestamp'
)
COMMENT 'Bronze landing table for claim disbursements with intentional referential integrity flaws'
TBLPROPERTIES (
    'delta.enableDeletionVectors' = 'true',
    'delta.enableChangeDataFeed' = 'true'
);

-- Generate 1,800 baseline synthetic payment rows
INSERT INTO demo_governance.raw.payments_raw (
    payment_id, claim_id, amount, method, paid_at, ingested_at
)
SELECT
    concat('PAY-', lpad(cast(id as string), 7, '0')) AS payment_id,
    concat('CLM-', lpad(cast(id as string), 7, '0')) AS claim_id,
    cast(round(((abs(hash(id * 29)) % 300000) / 10.0 + 100.0), 2) as string) AS amount,
    CASE (id % 4)
        WHEN 0 THEN 'ACH_DIRECT' WHEN 1 THEN 'WIRE_TRANSFER' WHEN 2 THEN 'CORPORATE_CHECK' ELSE 'SEPA_CREDIT'
    END AS method,
    date_format(date_add('2023-01-10', cast((id * 3) % 480 as int)), 'yyyy-MM-dd HH:mm:ss') AS paid_at,
    current_timestamp() AS ingested_at
FROM (SELECT explode(sequence(1, 1800)) AS id);

-- Inject deliberate referential integrity defects (orphan claims)
INSERT INTO demo_governance.raw.payments_raw (
    payment_id, claim_id, amount, method, paid_at, ingested_at
) VALUES
    -- Defect 1: Orphan claim ID CLM-9999991 not present in claims_raw
    ('PAY-9900001', 'CLM-9999991', '1250.00', 'ACH_DIRECT', '2023-08-10 10:00:00', current_timestamp()),
    -- Defect 2: Orphan claim ID CLM-9999992 not present in claims_raw
    ('PAY-9900002', 'CLM-9999992', '45000.00', 'WIRE_TRANSFER', '2023-08-11 11:30:00', current_timestamp()),
    -- Defect 3: Negative disbursement amount (-500.00)
    ('PAY-9900003', 'CLM-0000005', '-500.00', 'ACH_DIRECT', '2023-08-12 14:00:00', current_timestamp());

-- Verification summary
SELECT 'policyholders_raw' AS table_name, count(*) AS total_rows FROM demo_governance.raw.policyholders_raw
UNION ALL
SELECT 'claims_raw' AS table_name, count(*) AS total_rows FROM demo_governance.raw.claims_raw
UNION ALL
SELECT 'payments_raw' AS table_name, count(*) AS total_rows FROM demo_governance.raw.payments_raw;
