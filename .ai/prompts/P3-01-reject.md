CONTINUE task P3-01. The feature work is good and I am not asking you to change it. One gate fails,
and it is a guard doing its job rather than a defect in what you built.

What passed, measured outside your sandbox: `ruff` clean, `mypy` clean, `pytest` **436 passed** (up
from 430, so your 7 new tests run), and every frontend and e2e gate is unaffected. I read
`backend/tests/api/test_storage.py` rather than trusting the report, and
`test_sdk_shaped_cloud_identity_extras_never_reach_serialized_response` is built the right way: it
plants `client_secret`, `unknown_credential_blob` and `encryption_details.access_token` on an
SDK-shaped object and asserts the secret string appears nowhere in the serialized response. That test
would actually fail if a secret leaked, which is the whole point. Keep it exactly as it is.

## The one failure

```
backend/tests/api/test_security_surface.py::test_route_manifest_requires_a_decision_for_every_v1_route
AssertionError: assert route_operations(app) == ALL_OPERATIONS
  Extra items in the left set:
  'listStorageCredentials'
  'listExternalLocations'
```

You added two v1 routes and did not register an authorization expectation for them. The module
docstring states the rule:

> The manifest is deliberately complete: adding a contract route requires an explicit
> authorization expectation here before this test can pass.

So this is the P1-09 guard working as designed. It is the only thing standing between this project
and a route shipping with nobody having decided who may call it.

**Fix it by registering the decision. Never by loosening the manifest.** Do not delete the
assertion, do not subtract your operations from `ALL_OPERATIONS`, and do not filter them out of
`route_operations`. Any of those would make the guard stop guarding.

## What to add

`READ_CALLS` at `backend/tests/api/test_security_surface.py:19` maps each read operationId to the
`(method, path)` that exercises it. Add both of yours with paths that actually resolve against the
fixture data you shipped.

Registering them there is not bookkeeping — it enrolls both routes in two adversarial tests
automatically, so look at what each will now demand of your code:

1. `test_each_role_can_use_every_exposed_read_route` (line 103) runs every entry as all four actors
   in `ACTORS` — `victor.viewer`, `alice.steward`, `audrey.auditor`, `pat.platform` — and requires
   **200 for every one of them**.

2. `test_unauthenticated_requests_are_rejected_in_connected_mode` (around line 355) runs every entry
   in connected mode with no authentication and requires **401 `UNAUTHENTICATED`**.

Test 1 is a real design decision, not a formality, so make it deliberately. Every other read in this
application is readable by all four roles, and the contract is explicit that these responses carry
no secret material, so "all four roles may list storage credentials and external locations" is
consistent and defensible. If you believe one of these should instead be restricted — a viewer
arguably has no business enumerating the storage credentials of a workspace — then **say so in your
report and do not force a 200**: that would be a genuine finding about the role table, and the right
answer is to raise it rather than to bend either the code or the test until they agree.

State in your report which way you went and why.

## While you are there

Confirm that `backend/openapi.json`, which you regenerated, contains both new operations and nothing
else that was not there before. It is a committed artifact and a stray diff in it is hard to spot
later.

## Scope, unchanged

Only `backend/app/**`, `backend/tests/**`, the 7.6 rows of `docs/capability-matrix.md`, your rows in
`tasks/TASK-BOARD.md`, and an append to `tasks/STATUS.md`. Do not edit `shared/contracts/`,
`frontend/`, `scripts/`, `.ai/` or `app.yaml`. Never run git.

## Verification honesty

Your sandbox still cannot read `jsonschema_specifications` package data or reach the network, so a
full `pytest backend/tests` collection will fail for you. Run what you can, report exactly what you
observed, and claim nothing else. The orchestrator runs `./scripts/check_all.sh` outside the sandbox.
