ROLE: Backend Coder for the Unity Catalog Governance application.

TASK: P1-ERR-backend — make `INSUFFICIENT_PRIVILEGES` and its neighbours actionable.

## What happened, observed on the deployed app

The app runs in `connected_readonly` against a real workspace. A signed-in user browsing Data Assets
got:

```
HTTP 403
{"success":false,"code":"INSUFFICIENT_PRIVILEGES",
 "message":"The executing identity cannot read this resource.",
 "correlation_id":"94012433-...","next_steps":[],"errors":[]}
```

The real cause was that the Databricks App had only the default OAuth user scopes
(`iam.access-control:read`, `iam.current-user:read`) and needed `catalog.catalogs`,
`catalog.schemas` and `catalog.tables`. Working that out took CLI archaeology: reading
`effective_user_api_scopes`, listing catalogs with a different identity to prove the user *did* have
access, and checking which executor the adapter uses.

**Every one of those facts was available to the application.** It knew which securable it was
reading, which executor it used, and that the call returned 403. It said none of it.

`shared/contracts/error-codes.md` line 11 already requires better:

> `INSUFFICIENT_PRIVILEGES` | 403 | Execution identity lacks UC privilege (probe or upstream 403) |
> Inline: "The application's service principal does not hold MANAGE on `x`." + `next_steps`

So the contract asks for a message naming the missing privilege and the object, plus `next_steps`.
The implementation returns a fixed sentence and an empty list.

## What to change

1. When an upstream 403 is translated in `backend/app/adapters/databricks/common.py`, carry through
   what is known: **which executor** was used (the signed-in user, or the application's service
   principal, and name it), **which securable** was being read, and **which operation**. Build a
   message that states the specific failure rather than a generic one.

2. Populate `next_steps` with what would actually resolve it, chosen from what the application can
   determine. At minimum distinguish these two cases, because their fixes are completely different:
   - the executor was the **user** and the failure is consistent with a missing OAuth scope on the
     app: say that the app's user authorization may not include the scope needed for this securable
     type, and name it;
   - the executor was the **service principal**: say which UC privilege it would need on which
     object, and that a metastore or catalog admin must grant it.

   Do not fabricate certainty. If the application cannot distinguish the two, say what it does know
   and list both possibilities. An honest "it is one of these two, here is how to tell them apart"
   is far more useful than a sentence that fits every failure equally.

3. Do the same review for the other codes whose `error-codes.md` row promises `next_steps` and where
   the implementation currently returns none. Fix the ones you can support with real information.
   Leave `next_steps` empty where the application genuinely has nothing useful to say, rather than
   padding it with advice that might be wrong.

4. Never put an identity value, token, host or raw SDK exception into a message or `next_steps`. The
   securable's name is fine; credentials and internal paths are not.

## Tests

- A translated upstream 403 produces a message naming the securable and the executor, and a
  non-empty `next_steps`.
- The user-executor and service-principal-executor cases produce **different** next steps.
- No `next_steps` entry contains a token, a host or a stack frame.
- The envelope still matches the frozen contract exactly, and the code and status are unchanged.

## Scope

Only `backend/app/**` and `backend/tests/**`, plus your rows in `tasks/TASK-BOARD.md` and an append
to `tasks/STATUS.md`. Do not edit `shared/contracts/` — the contract already specifies the right
behaviour, this is an implementation gap. Do not edit `frontend/`, `docs/`, `scripts/`, `.ai/` or
`app.yaml`. Never run git.

## Verification honesty

If Ruff, Mypy or Pytest will not load in your sandbox, say so and claim nothing you did not observe.
The orchestrator runs them outside the sandbox.
