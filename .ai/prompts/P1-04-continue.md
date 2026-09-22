CONTINUE task P1-04. You ran out of quota mid-task; this is a deferral, not a rejection. The
orchestrator ran the gates outside your sandbox on the tree you left. Here is what is true.

## What you landed, verified by the orchestrator

- `backend/app/mutations/core.py` and `__init__.py`, `backend/app/api/v1/routes_plans.py`,
  `backend/tests/unit/test_mutation_core.py`, `backend/tests/api/test_plans.py`, plus edits to
  `models.py`, `settings.py`, `container.py`, `errors.py`, `main.py`, `.env.example` and the
  regenerated `backend/openapi.json`.
- `uv run --frozen mypy backend/app` — **Success, no issues in 55 source files.**
- `uv run --frozen pytest backend/tests -q` — **351 passed**, up from 342.
- All nine acceptance cases I asked for have a test: tampered token, expired plan, stale observed
  state, partial multi-target outcomes, ambiguous execution reported `unknown` rather than failed,
  reconcile resolving an unknown, duplicate execute not replaying, preview performing no write, and
  an unregistered kind returning `NOT_IMPLEMENTED`.
- HTTP 202 is correctly reserved for the ambiguous case.
- The HMAC key is a `SecretStr` with `repr=False` and `exclude=True`, with a development default in
  fixture mode and a fail-closed minimum of 32 characters in connected modes. Good.

So the engine is substantially right. Three things remain.

## 1. One lint error, the only failing gate

```
E501 Line too long (105 > 100)
  --> backend/app/api/v1/routes_plans.py:82:101
   |
82 |     responses={202: {"model": w.OperationResponse}, **responses(400, 401, 403, 404, 409, 429, 500, 503)},
```

Wrap it however the surrounding code already wraps long argument lists.

## 2. The capability registry was not updated

Item 11 of the original task. `backend/app/capabilities/` has no diff. Now that the plan lifecycle
exists, the entries it makes real must say so, and the ones still absent must stay honest. Concretely:
reading and creating plans and reading operations are now backed by real code, while every concrete
plan kind is still unregistered until P1-05, and this deployment runs `connected_readonly` where
mutations return `MODE_READ_ONLY`. Make the registry reflect exactly that. Do not mark a capability
available because the route exists; mark it available only if a real request would do the real work.

## 3. Finish anything you know is incomplete

You marked the P1-04 row `in_progress` yourself. If that was only because you ran out mid-run, say
so and set it to `done` with the evidence above. If there is something in the original task you did
not reach — the audit record at every lifecycle boundary, the authorize-at-build-AND-at-revalidate
pair, idempotency, or anything else — finish it now and name it in your report.

## Context you should know, because it changed under you

`app.yaml` now carries `UCGOV_PLAN_HMAC_KEY` as a literal value, by the user's explicit decision,
and that file is in a public repository. The orchestrator has documented in `app.yaml` that this
defeats the tamper-evidence property for anyone who reads the repo, and that it must move to a
secret resource before write mode is enabled. **Do not change that decision and do not weaken the
32-character fail-closed check** — the check is what keeps the app from ever running unsigned.

## Scope, unchanged

Only `backend/app/**`, `backend/tests/**`, `.env.example`, your rows in `tasks/TASK-BOARD.md`, and an
append to `tasks/STATUS.md`. Do not edit `shared/contracts/`, `frontend/`, `docs/`, `scripts/`,
`.ai/` or `app.yaml`. Never run git.

## Verification honesty

If Ruff, Mypy or Pytest will not load in your sandbox, say so and claim nothing you did not observe.
The orchestrator re-runs all of them.
