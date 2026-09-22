PREPENDED BY THE ORCHESTRATOR — read this before the task below.

**Read files one at a time. Never read in parallel or in a batch, and never run a shell command.**
No `ls`, `npx`, `npm`, `databricks`, and no file-existence check. Each one ends your turn immediately
with nothing written. You are authoring files only. The orchestrator and the user run everything.

You are creating a **brand-new directory, `demo/`**, which does not exist yet. Nothing under it
exists, so write every file fresh. Do not read or modify anything outside `demo/`.

Context you need without exploring: this repository contains a Unity Catalog **governance
application**. It reads catalogs, schemas, tables, grants, tags, ABAC policies, row filters and
column masks, and it drives changes through a preview-and-confirm plan lifecycle. The user has a
real Databricks workspace with almost nothing in it, so the application currently has nothing to
show. Your job is to produce a self-contained demo estate that gives it something real to govern.

---

ROLE: Data / Governance Engineer.

TASK: DEMO-01 — build a complete, runnable, **entirely synthetic** Databricks governance demo:
fake data, a pipeline with data-quality expectations, groups, tags and tag policies, ABAC policies,
column masks, row filters, dynamic views, and grants.

## Absolute rules

1. **Every value is fake.** No real person, company, address, email, or identifier. Use obviously
   synthetic values: `example.test` domains, `555-01xx` phone numbers, SSNs in the reserved
   `900-xx-xxxx` range that can never be issued, names from a clearly invented set. Nothing you
   write may resemble a real record.
2. **Idempotent.** Every script can be run twice with the same result. Use `CREATE ... IF NOT
   EXISTS`, `CREATE OR REPLACE`, and guard anything that cannot be expressed that way.
3. **Reversible.** A teardown script removes everything the demo created, in dependency order, and
   nothing else.
4. **Isolated.** Everything lives in one catalog, `demo_governance`. The demo must never touch an
   existing catalog, schema, table, group or policy.
5. **Honest about uncertainty.** Databricks SQL for ABAC policies, governed tags and tag policies is
   comparatively new and its syntax varies by release. Where you are **not certain** of exact
   syntax, write your best version AND add a clearly marked comment saying what you are unsure of
   and what the user should check in their workspace's documentation. Do **not** present a guess as
   settled fact. A script that says "verify this clause on your runtime" is far more useful than one
   that fails at line 200 with no warning.

## The estate to build

### Domain

A fictional insurer, **Northwind Mutual**. It gives you natural PII, financial and health-adjacent
columns, which is what makes masking and ABAC worth demonstrating.

### Catalog and schemas — `demo_governance`

| Schema | Purpose |
|---|---|
| `raw` | landing tables, deliberately dirty so expectations have something to catch |
| `curated` | cleaned, conformed |
| `analytics` | aggregates, materialized views, dynamic views |
| `security` | the UDFs used by masks and row filters |
| `reference` | small lookup tables |

Also create a **managed volume** under `raw` — volumes are a Unity Catalog object the governance
application can list, so the demo should include one.

### Data

Enough rows to be interesting but fast to create: low thousands, generated in SQL rather than loaded
from files so there is nothing to download.

- `raw.policyholders_raw` — deliberately contains nulls, malformed emails, impossible dates of
  birth, and duplicate ids, so the pipeline expectations have real defects to act on.
- `raw.claims_raw` — negative amounts, future dates, unknown status codes.
- `raw.payments_raw` — orphan claim references.
- `curated.policyholders` — `policyholder_id`, `full_name`, `email`, `phone`, `ssn`, `date_of_birth`,
  `address_line`, `city`, `region`, `signup_date`, `status`.
- `curated.claims` — `claim_id`, `policyholder_id`, `claim_amount`, `diagnosis_code`, `region`,
  `submitted_at`, `status`.
- `curated.payments` — `payment_id`, `claim_id`, `amount`, `method`, `paid_at`.
- `reference.regions`, `reference.claim_status`, `reference.diagnosis_codes`.
- `analytics.claims_by_region` — a **materialized view**.
- `analytics.claims_public` — a **dynamic view** that redacts using `current_user()` and
  `is_account_group_member()`.

Use Delta features the application and Databricks are known for, and comment why each is there:
**liquid clustering**, **change data feed**, **deletion vectors**, and a **time travel** example
query.

### Groups

Five groups, all prefixed `gov_demo_` so they are unmistakably demo objects:

`gov_demo_admins`, `gov_demo_stewards`, `gov_demo_analysts`, `gov_demo_auditors`,
`gov_demo_support_emea`.

Groups cannot be created in SQL. Provide the `databricks` CLI commands in a separate file, note that
account-level groups need account admin, and explain how to assign the user's own account to a group
so they can see each persona's view.

### Tags and tag policies

Governed tags with constrained allowed values, because the governance application shows the
difference between a governed tag and a free-form one:

| Tag | Allowed values |
|---|---|
| `classification` | `public`, `internal`, `confidential`, `restricted` |
| `pii_type` | `ssn`, `email`, `phone`, `dob`, `address`, `none` |
| `data_domain` | `claims`, `policy`, `payment`, `reference` |
| `retention` | `30d`, `1y`, `7y` |

Assign them at catalog, schema, table **and column** level, so the application has all four to
display. Include at least one free-form tag as a contrast.

### Column masks — in `security`

Write the UDFs and attach them. Each must be readable and obviously safe:

- `mask_ssn` — full mask for everyone except `gov_demo_stewards` and `gov_demo_admins`, who see the
  last four digits only. Nobody sees the whole value.
- `mask_email` — domain only, e.g. `****@example.test`.
- `mask_phone` — last two digits only.
- `mask_dob` — year only.
- `mask_amount` — exact for `gov_demo_auditors`, rounded to the nearest thousand for analysts, null
  for everyone else.

Use `is_account_group_member()` — it is the Databricks-specific primitive this whole demo turns on.

### Row filters — in `security`

- `filter_region` — `gov_demo_support_emea` sees only `EMEA` rows; admins and auditors see
  everything.
- `filter_active_only` — analysts see only `active` policyholders.
- `filter_claim_threshold` — analysts see claims under 10,000; auditors see all.

### ABAC policies

This is the centrepiece. Write policies that apply controls **by tag rather than by table**, which
is the whole point of ABAC:

1. Any column tagged `pii_type = ssn` is masked by `mask_ssn`, everywhere in the catalog.
2. Any column tagged `classification = restricted` is masked for anyone outside
   `gov_demo_admins`.
3. Any table tagged `data_domain = claims` gets the `filter_region` row filter for
   `gov_demo_support_emea`.

Then add **one table with a directly attached mask**, not via policy, so the application can
demonstrate the distinction between a centrally applied ABAC control and a directly attached one.
Comment that this contrast is deliberate.

### The pipeline, with expectations

A **Lakeflow Declarative Pipeline** (the product formerly called Delta Live Tables) in Python under
`demo/pipeline/`, plus the JSON or YAML settings needed to create it.

It must demonstrate all three expectation behaviours explicitly, because that tri-state is the
distinctive part:

- `@dlt.expect` — record and allow through;
- `@dlt.expect_or_drop` — drop the offending row;
- `@dlt.expect_or_fail` — stop the pipeline.

Cover: a streaming table from `raw`, a materialized view in `analytics`, at least six named
expectations across validity, completeness and referential integrity, and a comment on where the
resulting quality metrics can be seen.

### Grants

Grant each group what its persona should have, and grant the **governance application's service
principal** what it needs to read this estate. Include a clearly marked placeholder for the service
principal name with an explanation of where to find it, since it differs per deployment.

### Other Databricks surfaces to include, briefly

A short file each, or clearly separated sections, with a runnable query and a sentence on what it
demonstrates: **system tables** for audit and lineage, **lineage** being captured automatically by
the pipeline, **Lakehouse Monitoring** on one table, and **predictive optimization**. Where a feature
needs an entitlement the user may not have, say so instead of letting the script fail.

## Deliverables — file layout

```
demo/
  README.md                     purpose, prerequisites, exact run order, expected runtime, teardown
  00_prerequisites.md           what the user must have, and which steps need account admin
  01_catalog_and_schemas.sql
  02_groups.md                  CLI commands, because groups cannot be created in SQL
  03_reference_data.sql
  04_raw_data.sql               deliberately dirty
  05_curated_data.sql
  06_tags_and_policies.sql      governed tags, tag policies, assignments
  07_masking_functions.sql
  08_row_filters.sql
  09_abac_policies.sql
  10_apply_direct_controls.sql  the deliberate non-ABAC contrast
  11_views.sql                  materialized view and dynamic view
  12_grants.sql
  13_monitoring_and_system_tables.sql
  99_teardown.sql
  pipeline/
    northwind_pipeline.py
    pipeline_settings.json
  VERIFY.md                     what to look at in the governance app once this is loaded
```

`VERIFY.md` is the payoff and must be concrete: for each area of the governance application — Data
Assets, Access, Tags, Policies, Filters and masks — say which demo object to open and what the user
should expect to see, including which personas see masked versus unmasked values. That is what turns
this from a pile of SQL into a test you can actually run.

## Style

Every file opens with a comment saying what it creates, what it depends on, and roughly how long it
takes. Prefer clarity over cleverness: this is read by a person deciding whether to run it against
their workspace. Where a statement is destructive or slow, say so above it.

## Scope

Create files under `demo/` only. **Do not** edit `tasks/STATUS.md` or `tasks/TASK-BOARD.md` — the
orchestrator records this task itself, and another agent is editing those files right now. Do not
touch `frontend/`, `backend/`, `shared/contracts/`, `scripts/`, `docs/` or `.ai/`. Never run git.

## Report

List every file created. State plainly **every place you were unsure of Databricks syntax** and what
you did about it. Say which features you included and which you deliberately left out and why. Do not
claim you ran or validated anything — you cannot, and the user will run this against a real
workspace, so an overconfident script is worse than a cautious one.
