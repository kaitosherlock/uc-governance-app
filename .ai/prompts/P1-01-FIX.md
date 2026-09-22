ROLE: Backend Coder for the Unity Catalog Governance application.

TASK: P1-01-FIX — connected mode currently rejects every real user. Fix the forwarded-identity
cross-check in `backend/app/auth/actor.py`.

## Evidence, observed on the deployed app, not inferred

The app is deployed to a real Databricks workspace in `connected_readonly` mode. In a browser
session that the platform has already authenticated — the SPA shell itself loads fine over the
Databricks Apps OAuth boundary — `GET /api/v1/context` returns:

    HTTP 401
    {"success":false,"code":"IDENTITY_MISMATCH",
     "message":"The forwarded identity does not match the verified user.",
     "correlation_id":"...","next_steps":[],"errors":[]}

So the platform authenticated the user and our own code rejected them. The envelope itself is
correct; the decision behind it is wrong.

## Root cause

`resolve_identity` in `backend/app/auth/actor.py` does:

    forwarded_user = request.headers.get("x-forwarded-user")
    ... or (forwarded_user is not None and forwarded_user != user.actor.id)
        -> raise IdentityMismatch()

`user.actor.id` is set in `SDKIdentityResolver.resolve` (backend/app/adapters/databricks/factory.py)
from `current_user.me().id`, which is the **Databricks SCIM user id**.

`docs/04-databricks-apps-constraints.md` line 64 records, from the Databricks HTTP-headers
documentation, that `X-Forwarded-User` carries the **IdP user identifier** — a value from the
identity provider, in a different identifier space from the Databricks SCIM id. Comparing the two
can essentially never succeed, so the check rejects every genuine user.

## What to change

1. In `backend/app/auth/actor.py`, stop comparing `X-Forwarded-User` to the SCIM id.

   Keep the security property that motivated the check. The binding decision in
   `docs/04-databricks-apps-constraints.md` implication 1 still stands and must not be weakened:
   the actor is established from the verified user token, and the forwarded headers are display
   hints that must not contradict it. What changes is only which values are comparable.

   - The email cross-check is correct and stays: `X-Forwarded-Email` against the verified
     `user_name`, casefolded.
   - Add `X-Forwarded-Preferred-Username` to the same check, casefolded, since per docs/04 it is
     the IdP username and is comparable to `user_name`.
   - `X-Forwarded-User` may be compared only against a field in the same identifier space. The SCIM
     user object exposes `external_id`, which is where an IdP identifier would appear if the
     workspace populates it. Compare against it **only when it is populated**, and treat an absent
     `external_id` as "not comparable", never as a mismatch. If you conclude after reading the SDK
     model that this comparison cannot be made soundly, drop it entirely and say so in your report
     with your reasoning — a check that cannot be evaluated correctly is worse than no check.

2. If you need `external_id`, surface it through `ResolvedUser` in
   `backend/app/adapters/databricks/factory.py` in the established style. Do not widen what the
   resolver returns beyond what this fix needs.

3. Never log or return an identity value on the mismatch path. The existing
   `logger.warning("Forwarded identity mismatch")` is deliberately value-free; keep it that way.
   If you add a diagnostic, it may record **which comparison** failed, never the compared values.

4. `IdentityMismatch` must still be raised when a comparable value genuinely disagrees. Do not turn
   this into an unconditional pass. A test must prove that a contradicting forwarded email is still
   rejected.

## Tests

Extend the existing auth tests under `backend/tests/`:

- a request whose forwarded email matches the verified user resolves successfully;
- a request whose forwarded email contradicts the verified user is still rejected with
  `IDENTITY_MISMATCH`;
- a request carrying `X-Forwarded-User` with a populated, non-matching `external_id` is rejected;
- a request carrying `X-Forwarded-User` while `external_id` is absent is **accepted**, because the
  values are not comparable — this is the regression test for the defect being fixed;
- casefolded comparison for both email and preferred username.

## Scope

Edit only `backend/app/auth/actor.py`, `backend/app/adapters/databricks/factory.py`,
`backend/tests/**`, your rows in tasks/TASK-BOARD.md, and an append to tasks/STATUS.md. Do not edit
shared/contracts/ — the contract is frozen and already correct here. Never run git.

## Verification honesty

If Ruff, Mypy or Pytest will not load in your sandbox, say so and do not claim a result you did not
observe. The orchestrator runs them outside the sandbox and will redeploy and re-verify against the
live workspace, which is the only place this defect reproduces.
