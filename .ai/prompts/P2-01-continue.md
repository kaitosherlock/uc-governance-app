ROLE: Backend Coder for the Unity Catalog Governance application.

TASK: P2-01 — Tags. **Finish an interrupted run.** Your previous attempt was killed part-way through
by an orchestration fault on my side, not by anything you did: two orchestrator sessions were
driving this repository at once, and when one ended it took your process with it. No session id was
captured, so this is a fresh start — but **all of your work is still on disk**. Read it before
writing anything.

## What is already there, from your interrupted run

```
backend/app/adapters/databricks/tags.py      (new)
backend/app/adapters/protocols.py            (modified)
backend/app/adapters/fixtures/readers.py     (modified)
backend/app/api/mappers.py                   (modified)
backend/app/api/v1/models.py                 (modified)
backend/app/api/v1/routes_reads.py           (modified — two new routes)
backend/app/domain/models.py                 (modified)
backend/app/domain/reads.py                  (modified)
backend/app/fixtures_data/dataset.py         (modified)
backend/app/mutations/plan_kinds.py          (modified — tag plan kinds registered)
backend/app/mutations/core.py                (modified)
backend/tests/api/test_tags.py               (new)
backend/tests/unit/test_plan_kinds.py        (modified)
backend/tests/api/test_plans.py              (modified)
```

The orchestrator ran the gates outside your sandbox. `mypy` passes. **395 of 397 tests pass.** Four
things are outstanding.

## 1. Two new routes have no authorization decision — fix the routes, not the test

```
FAILED backend/tests/api/test_security_surface.py::test_route_manifest_requires_a_decision_for_every_v1_route
  Extra items in the left set: 'listTagPolicies', 'getTags'
```

This is the manifest guard doing exactly what it was built for in P1-09: it fails when a v1 route
exists without an authorization decision, so a route cannot ship unguarded. You added `getTags` and
`listTagPolicies` without registering their decisions.

**Add the authorization decisions for both routes.** Decide deliberately which roles may read tags
and tag policies, and make the scope check behave like the other read routes — a denial outside the
caller's scope must be `FORBIDDEN_SCOPE`, not `FORBIDDEN_ROLE`, as fixed in P1-09.

Do **not** make this pass by adding the two operation ids to the test's expected set without a
decision behind them. That would disarm the guard permanently.

## 2. A test now fails because a plan kind it assumed unregistered is registered

```
FAILED backend/tests/api/test_plans.py::test_remaining_unregistered_plan_kind_returns_not_implemented
  assert 201 == 501
```

That test picks a `PlanKind` that no one has implemented and asserts `NOT_IMPLEMENTED`. You
registered the tag kinds, so its chosen kind is now live. Point it at a kind that is still genuinely
unregistered, and prefer a form that will not rot: derive the kind from the registry at runtime, so
the test keeps asserting "whatever is still unimplemented returns 501" as later phases register
more. If that is not practical, pick a kind from a much later phase and say which.

## 3. Ruff, six errors, all in the new test files

```
I001  backend/tests/api/test_plans.py:3:1          import block un-sorted
E501  backend/tests/api/test_plans.py:44:101       line too long (105 > 100)
E501  backend/tests/api/test_tags.py:20:101        line too long (115 > 100)
E501  backend/tests/api/test_tags.py:23:101        line too long (108 > 100)
I001  backend/tests/unit/test_plan_kinds.py:3:1    import block un-sorted
E501  backend/tests/unit/test_plan_kinds.py:220:101 line too long (107 > 100)
```

Tidying you did not reach before being interrupted.

## 4. Finish and confirm the task itself

Re-read `.ai/prompts/P2-01.md`, which is the original brief, and complete anything you had not
reached. In particular confirm, by reading your own code:

- system tags are rejected rather than silently skipped;
- governed tags go through the tag-policies surface where one is confirmed to exist, and are
  reported honestly where it is not;
- the two tag plan kinds go through the full lifecycle, and still return `MODE_READ_ONLY` under
  `connected_readonly`;
- the capability registry reflects exactly what is now real and nothing more;
- identifiers in `statement_preview` are quoted so a crafted tag key or value cannot alter the
  statement.

## Scope

Only `backend/app/**`, `backend/tests/**`, the `docs/capability-matrix.md` rows for tags, your rows
in `tasks/TASK-BOARD.md`, and an append to `tasks/STATUS.md`. Do not edit `shared/contracts/`,
`frontend/`, `scripts/`, `.ai/` or `app.yaml`. Never run git.

**Do not touch `backend/app/adapters/databricks/common.py`.** A separate task changed it to make
permission errors actionable, and that work is complete and must not be disturbed.

## Verification honesty

Your sandbox denies reading `jsonschema_specifications` package data, so a full
`pytest backend/tests` collection will fail for you. Run what you can, report exactly what you
observed, and claim nothing else. The orchestrator runs `./scripts/check_all.sh` outside the sandbox
and sends failures back into this session.
