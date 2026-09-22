CONTINUE task P0-05. Your previous turn ended after 41 seconds because you tried to read several
files in parallel, which needs the `command` permission and is auto-denied here. Nothing was
written.

**Read one file at a time. Never in parallel, never in a batch, never a shell command.** If you
reach for a batch read again this turn dies again.

To minimise reading, here are the contract facts you need, verbatim. Do not go and re-read
`shared/contracts/types.ts` for these.

Envelope, from types.ts:
```ts
interface SuccessResponse<T> { success: true; data: T; meta: Meta }
interface PagedResponse<T> extends SuccessResponse<T[]> { page: Page }
interface ErrorResponse {
  success: false; code: ErrorCode; message: string; correlation_id: string;
  next_steps?: string[]; errors?: FieldError[];
}
interface Meta { source: DataSource; observed_at: string;
  scope?: { catalog: string|null; schema: string|null } | null;
  completeness: Completeness; limitations: string[]; correlation_id: string }
interface Page { page_size: number; next_page_token: string | null }
```

`ErrorCode` has 21 members: VALIDATION_FAILED, UNAUTHENTICATED, IDENTITY_MISMATCH, FORBIDDEN_ROLE,
FORBIDDEN_SCOPE, MODE_READ_ONLY, INSUFFICIENT_PRIVILEGES, SOD_VIOLATION, NOT_FOUND, PLAN_STALE,
PLAN_EXPIRED, PLAN_TAMPERED, PLAN_INVALIDATED, DUPLICATE_SUBMISSION, RATE_LIMITED, INTERNAL_ERROR,
NOT_IMPLEMENTED, UNSUPPORTED, NOT_CONFIGURED, UPSTREAM_UNAVAILABLE, OUTCOME_UNKNOWN.

`ERROR_HTTP_STATUS` maps each to its status: 400 VALIDATION_FAILED; 401 UNAUTHENTICATED and
IDENTITY_MISMATCH; 403 FORBIDDEN_ROLE, FORBIDDEN_SCOPE, MODE_READ_ONLY, INSUFFICIENT_PRIVILEGES,
SOD_VIOLATION; 404 NOT_FOUND; 409 PLAN_STALE, PLAN_EXPIRED, PLAN_TAMPERED, PLAN_INVALIDATED,
DUPLICATE_SUBMISSION; 429 RATE_LIMITED; 500 INTERNAL_ERROR; 501 NOT_IMPLEMENTED and UNSUPPORTED;
503 NOT_CONFIGURED and UPSTREAM_UNAVAILABLE. OUTCOME_UNKNOWN has no status; it appears only inside
an Operation.

`API_PATHS` is an exported const object of path templates; the three you need hooks for are
`context: '/context'`, `me: '/me'`, `capabilities: '/capabilities'`. Paths with `{full_name}` must
have that segment URL-encoded as a single segment so `sales.crm.orders` stays one segment.

Example files you may import directly, each already valid against the contract:
```
shared/contracts/examples/ContextResponse.fixture.json
shared/contracts/examples/IdentityResponse.steward.json
shared/contracts/examples/AssetListResponse.list-schema-objects.json
shared/contracts/examples/GrantsResponse.orders-table.json
shared/contracts/examples/PlanResponse.grant-preview.json
shared/contracts/examples/OperationResponse.unknown-outcome.json
shared/contracts/examples/ErrorResponse.forbidden-role.json
shared/contracts/examples/ErrorResponse.not-configured.json
shared/contracts/examples/ErrorResponse.validation-failed.json
```

Now do the work described in `.ai/prompts/P0-05.md`, which you already read: create
`frontend/src/api/client.ts`, `frontend/src/api/errors.ts`, `frontend/src/api/queries.ts`,
`frontend/src/mocks/handlers.ts`, `frontend/src/mocks/browser.ts`, `frontend/src/mocks/enable.ts`,
add `QueryClientProvider` to `frontend/src/app/providers.tsx`, call the MSW enabler from
`frontend/src/main.tsx`, wire `ContextBar` in `frontend/src/app/AppShell.tsx` to the real hooks,
add the strings you need to `frontend/src/lib/strings.ts`, and write the three test files.

Write the files now, one read at a time, then report what you created.
