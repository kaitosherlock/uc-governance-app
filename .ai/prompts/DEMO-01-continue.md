CONTINUE task DEMO-01. Your previous turn ended when the frontend lane ran out of model quota, not
because anything was wrong with the work. Quota is back. Pick up exactly where you stopped.

**Read files one at a time. Never read in parallel or in a batch, and never run a shell command.**
No `ls`, no `cat`, no file-existence check, no `databricks` CLI, no `python`. Each one ends your
turn immediately with nothing written. The orchestrator runs every check.

## What already exists under `demo/`, so you never need to look

These six files are **written and complete**. Do not recreate, re-open or rewrite them unless a
later file genuinely contradicts one, in which case fix the later file:

```
demo/README.md                    5222 bytes
demo/00_prerequisites.md          3528 bytes
demo/01_catalog_and_schemas.sql   2317 bytes
demo/02_groups.md                 4809 bytes
demo/03_reference_data.sql        5137 bytes
demo/04_raw_data.sql             12503 bytes
```

Nothing else exists under `demo/`. There is no `demo/pipeline/` directory yet.

Before writing anything new, read `demo/01_catalog_and_schemas.sql`, then `demo/03_reference_data.sql`,
then `demo/04_raw_data.sql` — **one at a time, in that order** — so the object names, column names and
types in everything you write from here match what those three actually create. Names invented from
memory that disagree with 01/03/04 are the single most likely way this task fails.

## What is left to write, in this order

```
demo/05_curated_data.sql
demo/06_tags_and_policies.sql            governed tags, tag policies, assignments
demo/07_masking_functions.sql
demo/08_row_filters.sql
demo/09_abac_policies.sql
demo/10_apply_direct_controls.sql        the deliberate non-ABAC contrast
demo/11_views.sql                        materialized view and dynamic view
demo/12_grants.sql
demo/13_monitoring_and_system_tables.sql
demo/99_teardown.sql
demo/pipeline/northwind_pipeline.py
demo/VERIFY.md
```

Write them in that order and finish each file before starting the next, so that if quota runs out
again the boundary is a complete file rather than a half-written one.

`99_teardown.sql` must drop everything 01 through 12 created, in dependency order, and must be safe
to run when only some of those scripts have been applied.

`VERIFY.md` is the payoff: for each area of the governance application, say concretely what to open
and what should be visible once this demo is loaded.

## The five rules from the original task still hold

1. **Every value is fake.** No real person, company, address, email or identifier.
2. **Idempotent.** Every script can run twice with the same result.
3. **Reversible.** `99_teardown.sql` removes everything, in dependency order.
4. **Isolated.** Everything lives in the `demo_governance` catalog and must never touch another.
5. **Honest about uncertainty.** Where the Databricks SQL surface for ABAC policies, governed tags
   or tag policies is not something you can confirm, say so in a comment in the file itself rather
   than presenting an invented statement as fact. A demo script that claims a syntax works when it
   does not is worse than one that flags the step as needing verification.

## Scope

Create files under `demo/` only. **Do not** edit `tasks/STATUS.md` or `tasks/TASK-BOARD.md` — the
orchestrator owns those for this task. Do not touch `frontend/`, `backend/`, `shared/`, `scripts/`
or `.ai/`. Never run git. Do not claim you ran any command.

## Report

List every file you created, in order, and name any step where you were not able to confirm the
Databricks SQL surface and said so in the file.
