# Error codes — meaning, backend trigger, UI treatment

| Code | HTTP | Backend emits when | UI shows |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | Request body/query fails schema or business validation (invalid privilege for type, system tag, reason too short). `errors[]` lists fields | Inline field errors + summary at top of form |
| `UNAUTHENTICATED` | 401 | No user token / no verifiable actor | Full-page "Sign-in required through Databricks" |
| `IDENTITY_MISMATCH` | 401 | Token identity disagrees with forwarded identity headers | Full-page error, support contact, correlation id |
| `FORBIDDEN_ROLE` | 403 | Actor's app role may not request this action | Inline: "Your role (Viewer) cannot request grants." + who can |
| `FORBIDDEN_SCOPE` | 403 | Target outside `managed_catalogs` or outside actor visibility | Inline: "This object is outside the managed scope of this application." |
| `MODE_READ_ONLY` | 403 | App in `connected_readonly` | Inline + mode badge already visible |
| `INSUFFICIENT_PRIVILEGES` | 403 | Execution identity lacks UC privilege (probe or upstream 403) | Inline: "The application's service principal does not hold MANAGE on `x`." + `next_steps` |
| `SOD_VIOLATION` | 403 | Requester = approver, or beneficiary = approver | Inline on approve button |
| `NOT_FOUND` | 404 | Object missing **or** not visible (indistinguishable) | "Not found or not visible to the application." Never "does not exist" |
| `PLAN_STALE` | 409 | Observed state changed since preview | Preview panel: "State changed — regenerate preview" |
| `PLAN_EXPIRED` | 409 | TTL passed | Same, "Preview expired" |
| `PLAN_TAMPERED` | 409 | HMAC mismatch | Generic conflict + correlation id; log |
| `PLAN_INVALIDATED` | 409 | Superseded by a newer plan | "A newer preview replaced this one" |
| `DUPLICATE_SUBMISSION` | 409 | Execute called while an operation for this plan is running | Show the existing operation |
| `RATE_LIMITED` | 429 | Upstream 429 | "Databricks is rate-limiting requests. Try again in a moment." (no auto-retry for mutations) |
| `INTERNAL_ERROR` | 500 | Unexpected exception | Generic + correlation id |
| `NOT_IMPLEMENTED` | 501 | Capability not built in this version | Control disabled beforehand; if reached, inline explanation |
| `UNSUPPORTED` | 501 | No documented supported mechanism | Same, with the recorded reason |
| `NOT_CONFIGURED` | 503 | Warehouse / durable store / account client missing | Inline with the exact missing resource and `next_steps` |
| `UPSTREAM_UNAVAILABLE` | 503 | Databricks/system table/Lakebase unreachable or 5xx | "Temporarily unavailable" + retry for **reads only** |
| `OUTCOME_UNKNOWN` | — | Only inside `TargetOutcome.error` after a post-submit timeout | "Outcome unknown — check current state" |
