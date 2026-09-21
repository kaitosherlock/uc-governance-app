# shared/contracts — the locked API & data contract

| File | Role | Owner |
|---|---|---|
| `api-spec.yaml` | **Canonical.** OpenAPI 3.0.3. Every path, payload, enum, error code. | Architect (changes via the process below) |
| `types.ts` | Hand-maintained TypeScript mirror of the schemas + `API_PATHS`. Imported by the frontend as `@contracts/types`. | Architect; Frontend Coder may propose |
| `examples/*.json` | Sample payloads that validate against `api-spec.yaml`. Used by MSW handlers and by backend snapshot tests. | Both coders may add; must validate |
| `error-codes.md` | Human explanation of each `ErrorCode`, when the backend emits it, what the UI shows. | Architect |

## Invariants (both coders are tested against these)

1. Success = `{ success: true, data, meta, page? }`. Error = `{ success: false, code, message, correlation_id, next_steps?, errors? }`. Never an error body with HTTP 200.
2. `meta.limitations` is always an array (possibly empty) and the UI always renders it under the data it describes.
3. `allowed_actions` is a hint. Backend re-authorizes every mutation. Frontend never enables a control whose `allowed` is false, and always shows `reason`.
4. All writes go through `POST /plans` → `POST /plans/{id}/execute`. There are no other mutation endpoints except `POST /access-requests` and `POST /access-requests/{id}/decision`, which themselves create plans.
5. HTTP 202 on execute means `Operation.status === 'unknown'`. The UI shows "Outcome unknown" and offers reconcile; it never auto-retries.
6. Timestamps are ISO 8601 UTC with `Z`. Nullable fields are explicit `null`, never omitted when `required`.
7. Names (`full_name`, `principal`, `privilege`, tag keys/values, comments) are verbatim. No casing changes, no translation.

## Change process

- **Additive** (new optional field, new enum value at the end, new endpoint): edit `api-spec.yaml` and `types.ts` in one edit, add/update an example, write `CONTRACT 1.x.0 — <what>` in `tasks/STATUS.md`. Frontend must tolerate unknown enum values by rendering them verbatim with an "Unknown" badge.
- **Breaking** (rename, remove, type change, required-ness change): not allowed inside v1 without both coders acknowledging in `STATUS.md`. Bump `info.version` major, keep the old path alive for one phase.
- Nobody edits generated artifacts by hand. Nobody declares an API type outside this folder.

## Validation

Gate 1 of the orchestration pipeline. No network, no Databricks:

```bash
uv run --with pyyaml --with jsonschema python scripts/validate_contracts.py
```

15 checks: refs resolve, no stray keys inside schema objects, no `$ref` with siblings, every
example validates, every operation declares JSON schemas with `ErrorResponse` on 4xx/5xx, 30 enums
match `types.ts`, and `error-codes.md` documents every code. Last run: **OK, 15 checks passed**
(`docs/test-results/contract-validation.txt`).

Second opinion, needs network:

```bash
npx --yes @redocly/cli@latest lint shared/contracts/api-spec.yaml
```

Last run: **0 errors**, 1 accepted warning (`info-license-strict` wants a license URL; none exists,
so none was invented).

Backend conformance, added in Phase 0:

```bash
uv run pytest backend/tests/contract -q     # path parity, schemathesis, example validation
```

Example file naming: `examples/<SchemaName>.<scenario>.json` where `<SchemaName>` is an **exact**
key of `components.schemas`, e.g. `PlanResponse.grant-preview.json`. The validator fails on any
other name.

## Two traps this contract already hit

Both were found by linting and are now guarded by `scripts/validate_contracts.py`:

1. **Unquoted descriptions with commas.** `{ type: string, description: Exact code, e.g. SELECT }`
   parses as three keys, silently truncating the description. Always quote a description that
   contains a comma, or use block style.
2. **`$ref` with siblings.** `{ $ref: '#/...', nullable: true }` — OpenAPI 3.0 ignores the sibling,
   so the field is not actually nullable. Use `nullable: true` + `type:` + `allOf: [ $ref ]`.
