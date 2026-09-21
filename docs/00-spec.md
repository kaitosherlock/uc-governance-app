# 00 — Authoritative specification (verbatim)

> This is the original build brief, copied without edits. It is the single source of truth.
> Every other document in this folder is derived from it. If a derived document conflicts with
> this file, this file wins.
>
> **Folder note:** the brief names `governance-app/` as the source root. That directory already
> exists at `C:\Users\admin\Downloads\governance-app` and contains an unrelated, earlier
> Streamlit-based build (Vietnamese UI, its own Git history, `src/ucgov`, `app/main.py`). Per §1 of
> the brief ("preserve it and clarify the collision rather than overwriting it"), **this project uses
> `uc-governance-app/` as the source root instead.** Read every occurrence of `governance-app/`
> below as `uc-governance-app/`. Do not read from, copy from, or modify the old folder.

---

# Build a Unity Catalog Governance Application from Scratch

You are acting as a senior full-stack engineer, Databricks platform engineer, security-conscious application architect, and product designer.

Build a complete, standalone **Unity Catalog Governance application** from scratch. Deliver working local source code, a polished English-language interface, a real backend integration layer, meaningful tests, and configuration for eventual deployment on **Databricks Apps**.

This is an implementation task. Do not stop after a plan, architecture proposal, static mockup, or documentation.

## 1. Authoritative scope and working rules

- Create the application under a local directory named **`governance-app/`** in the working workspace.
- This is a greenfield build. There is no existing application, Streamlit codebase, Cookbook integration, export script, or backend that must be retained.
- Inspect the working directory before writing. If `governance-app/` already contains unrelated work, preserve it and clarify the collision rather than overwriting it.
- **Git is not required.** Do not initialize a repository, require GitHub authentication, create commits, push code, or create pull requests. Provide ordinary local source files and reproducible run instructions.
- **All authored UI content must be in English:** navigation, labels, forms, tooltips, notifications, validation, empty states, error messages, dialogs, help text, and accessibility labels.
- Write project documentation and developer-facing explanations in English.
- Preserve actual object names, principal names, user-authored descriptions, and Databricks privilege identifiers without translating or rewriting them.
- Build for eventual Databricks Apps deployment, but do not deploy, create billable resources, change live grants, or mutate real workspace/account resources during development without explicit authorization.
- Do not require live credentials to complete independent local implementation, fixture-mode demonstrations, or tests.
- Continue meaningful local work when a live dependency is unavailable. State precisely what requires later configuration or live verification.
- Do not install additional skills or change global agent configuration as part of this application build. Use relevant existing skills when available.

## 2. Product goal and users

Build a professional work tool for **Data Stewards, Data Engineers, Access Administrators, Auditors, and Platform Administrators**.

The primary user journey is:

> Find a data asset → understand its metadata and visible access paths → preview a governance change → apply it when authorized → verify the result.

A user who is not a security specialist should understand:

- Which asset they are viewing and in which workspace/environment.
- Who has visible permissions, which permissions are direct or inherited, and where that information is incomplete.
- Which identity will execute an operation.
- What a proposed change does, what it may affect, and what remains unknown.
- Whether an operation succeeded, partially succeeded, failed, or has an unknown outcome.

Favor clear tasks and accurate decisions over decorative dashboards, SDK terminology, or invented metrics.

## 3. Technology freedom and evidence-based selection in 2026

There is **no prescribed frontend framework, backend framework, or programming language**. React, TypeScript, Vue, Svelte, Angular, Solid, Python, and other suitable technologies may be considered. Do not treat this list as exhaustive or as a mandate to combine them.

Select the stack that offers the best overall fit for this specific application: excellent visual quality, accessible interactions, rich data-heavy workflows, maintainability, reliable Databricks integration, and practical deployment on Databricks Apps.

Before choosing:

1. Verify current official Databricks Apps runtime, build, networking, authentication, resource, and deployment constraints for the target cloud where known.
2. Compare a small shortlist of credible stacks. Do not spend the entire task researching frameworks.
3. Consult current community evidence available in **2026**, alongside official framework/component-library documentation and release status.
4. Distinguish a survey's publication date from its collection year. A 2025 survey published in 2026 is not a 2026 respondent survey.
5. Consider developer satisfaction, adoption, maintenance activity, accessibility, data-table/form ecosystem, bundle/runtime cost, and production stability. Explain relevant biases; popularity alone is not quality.
6. Evaluate visual suitability through real component examples and the design you can deliver. Do not claim a framework is objectively the "prettiest" based on a popularity ranking.
7. Record the decision, rejected alternatives, source links, dates, and dependency versions in `docs/technology-decision.md`.

Use stable, supported dependencies unless a required capability justifies a documented preview dependency. Pin reproducible versions and include applicable lockfiles.

Choose one coherent frontend framework and component foundation. Add specialized libraries only for demonstrated needs such as tables, forms, charts, or lineage visualization. Avoid competing design systems and unnecessary animation libraries.

Node.js is a runtime, not a visual design system. Streamlit is neither required nor prohibited; choose it only if it can satisfy the same UX and presentation requirements. Next.js, React, TypeScript, Tailwind CSS, and shadcn/ui are options, not obligations. Do not introduce SSR, a separate API service, or multiple production processes without a concrete need.

Backend language selection must follow verified official SDK coverage and authentication support. Python with `databricks-sdk` is a strong candidate, but is not mandatory. Verify any alternative package's official provenance, maintenance, API coverage, and supported authorization before selecting it. Do not assume an npm package is official or equivalent merely because its name includes Databricks.

If the strongest frontend and backend choices use different languages, a clean split is acceptable. Prefer the simplest deployable architecture that meets the requirements.

If current browsing is unavailable, document the evidence gap and make a provisional conservative choice. Do not invent 2026 rankings or claim current verification.

## 4. Integration boundary and deployment constraints

- Keep credentials and privileged governance operations on the backend.
- Use the verified official Databricks SDK for governance integrations. Supported SQL operations may use the SDK's documented SQL Statement Execution interface.
- Do not implement governance integrations using guessed endpoints, private APIs, browser automation, raw undocumented requests, or cloud credential workarounds.
- If a capability has no documented supported path through the selected official SDK or supported SQL execution, exclude its live implementation and record the reason. Do not create a pretend endpoint or successful no-op.
- Assess material SDK gaps before selecting the backend language so a poor choice does not unnecessarily exclude major capabilities.
- Keep Unity Catalog-native features, related Databricks services, and application-owned workflows explicitly separate.
- Treat a SQL Warehouse as optional for SDK-only metadata/grants features. Disable only the modules that genuinely require SQL when no warehouse is configured.
- Do not introduce an external governance platform, database, message broker, or paid service.
- Durable production workflow storage must use an appropriate Databricks resource, selected according to documented transaction, concurrency, and access requirements.
- Necessary documented database drivers for that storage are distinct from governance API integrations; explain and isolate them.
- Prepare valid build/start configuration for Databricks Apps using current official requirements. Do not assume development servers or local filesystem persistence are suitable for production.
- Do not create or start cloud resources, compute, warehouses, monitors, scans, or scheduled jobs without authorization.

## 5. Discovery and capability matrix

Before implementing governance operations, inspect the local environment and verify official SDK/documentation coverage. If target workspace details are unavailable, record them as unknown and continue with local development.

Create `docs/capability-matrix.md` covering every domain in this prompt. Each relevant operation must include:

- Feature/domain and operation.
- Supported securable types.
- SDK method or documented SQL mechanism.
- Workspace API versus Account API.
- Execution identity and required privileges.
- OAuth scopes where user authorization applies.
- Known cloud, region, compute, runtime, and version prerequisites.
- GA/Preview status when officially documented.
- Implementation coverage: implemented, read-only, unsupported, blocked, or not implemented.
- Required resources/configuration.
- Documentation link and verification date.
- Local test evidence and separate live verification status.

Keep implementation coverage separate from runtime availability. Backend capability responses should distinguish at least:

- Available
- Not configured
- Insufficient permissions
- Unsupported in this environment, only when supported by evidence
- Not implemented
- Temporarily unavailable
- Unknown / not verified

Do not infer that an administrator has every feature. A permission error or an empty response does not establish that a capability is unsupported.

## 6. Architecture and backend contracts

Use clear modules for configuration, authentication, authorization, capability discovery, SDK adapters, domain services, workflow persistence, audit, and API/UI adapters. Do not create unnecessary microservices.

Backend responses should expose:

- Stable asset identifiers, display names, and fully qualified paths.
- `allowed_actions` and reasons for unavailable actions. These are UI hints; every mutation must reauthorize server-side.
- Operation status and per-target outcomes.
- Stable error codes, safe English messages, actionable next steps, and correlation IDs.
- Data source, observation time, scope, and completeness limitations.
- Pagination, search, filtering, and sorting consistent with actual API capabilities.

Never expose raw SDK exceptions, tokens, secrets, or sensitive responses. Do not convert failures into HTTP 200 success envelopes. Model partial success and unknown outcomes explicitly.

Avoid eager full-workspace loading. Use bounded traversal, pagination, query limits, and identity-scoped caching. Debounce search and cancel stale read requests where appropriate. Do not imply workspace-wide search when only a selected scope has been searched.

## 7. Governance domains

Implement the following domains wherever a documented supported integration exists. Coverage must be honest; unknown or unsupported operations must not be represented as working controls.

### 7.1 Assets and metadata

Cover metastore, catalog, schema, table, view, materialized view, streaming table, volume, function, registered model, and model version where supported.

- List, search, paginate, and display details.
- Show owner, descriptions, tags, properties, asset type, managed/external status, and available governance metadata.
- Edit asset/column descriptions, supported properties, and ownership through official mechanisms.
- Create, update, delete, or restore only where the specific object type and integration support it. Do not impose uniform CRUD on all assets.
- Identify pipeline-managed or externally managed assets and respect editing restrictions.
- Before destructive changes, show known dependencies and explain metadata, physical-data, and related-asset effects accurately for that object type.
- Never default to force or cascade. Missing dependency information is not proof that deletion is safe.
- Put metastore assignment/configuration in a separate platform-administration area with appropriate Account API controls.
- Do not query table rows or file contents merely to display metadata.

### 7.2 Privileges, ownership, and access explanation

- Display direct and inherited grants with their source.
- Implement grant, revoke, and ownership transfer within actual authorization boundaries.
- Maintain a documented privilege catalogue by securable type and supported version; avoid an arbitrary small hard-coded list.
- Correctly distinguish BROWSE, USE_CATALOG, USE_SCHEMA, MANAGE, ALL_PRIVILEGES, and object-specific privileges.
- Do not treat ALL_PRIVILEGES as every administrative privilege or equate workspace, account, and metastore administrators.
- Search users, account groups, and service principals where permitted. Distinguish workspace-local groups and validate UC principal eligibility.
- Explain group-derived access only when trustworthy membership data is available; otherwise disclose the gap.
- Do not equate visible grants with a complete effective-access calculation. Parent privileges, group membership, ownership, workspace bindings, policies, and other constraints may matter.
- Send grant/revoke deltas; do not replace whole ACLs unintentionally.
- Provide batch preview and per-object results without representing partial completion as total success.

### 7.3 Tags, governed tags, and classification

- Read, assign, edit, and remove tags only for supported assets/columns.
- Manage governed tags, allowed values, and tag privileges where supported.
- Distinguish free-form, governed, and system-controlled tags. Respect system-tag restrictions.
- Check asset permissions and governed-tag permissions.
- Explain possible ABAC consequences of tag changes.
- Integrate supported Data Classification configuration, status, and results, including scan scope, observation time, and coverage limitations.
- Do not automatically scan datasets, enable auto-tagging, or trigger compute costs.
- Do not return sensitive sample values by default.
- A PII tag does not prove masking or access restriction is active.

### 7.4 ABAC policies

- List, inspect, create, update, and delete policies only through supported mechanisms.
- Show scope, tag predicates, included/excluded principals, and referenced functions.
- Validate supported signatures, scopes, privileges, and documented policy restrictions/conflicts.
- Identify potentially affected assets within the caller's visible scope; separate verified impact from unknown impact.
- Preview how access could expand or narrow.
- Do not present an application-built simulator as equivalent to Databricks policy evaluation.
- Claim policy execution testing only when it actually ran with suitable compute, an authorized identity, and appropriate test data.

### 7.5 Row filters, column masks, and dynamic views

- Inspect and manage supported filters/masks and show functions, input columns, types, ownership, and dependencies.
- Validate object, data-type, and compute compatibility.
- Explain exposure risks when a filter/mask is removed or weakened.
- Distinguish centrally applied ABAC from directly attached controls.
- Manage supported dynamic views without unintentionally overwriting their definitions.
- Use only authorized identities and test data for execution checks. Never impersonate users by substituting email headers.
- Permit metadata/policy management without SELECT only where the real permission model allows it.

### 7.6 Storage, credentials, and workspace isolation

Cover storage credentials, service credentials, external locations, and workspace bindings where supported.

- Show safe metadata, ownership, grants, and nonsecret configuration.
- Provide controlled create/update/delete and native validation where available.
- Manage supported bindings and access modes.
- Preview potentially disrupted access before unbinding a workspace.
- Distinguish Unity Catalog privileges from cloud IAM/RBAC.
- A successful connectivity check is not a comprehensive security certification.
- Never return secrets, temporary credentials, or tokens in responses, logs, exports, or browser state.
- Do not use temporary credentials to bypass UC controls.
- Validate connection targets according to documented connector requirements; prevent arbitrary client-controlled backend hosts and SSRF.

### 7.7 Federation and connections

- Manage supported connections, foreign catalogs, and associated permissions.
- Show source type, ownership, status, and known dependencies.
- Protect secrets and never return stored credentials to the client.
- Explain affected foreign catalogs before changing or deleting a connection.
- Track capabilities per connector rather than promising universal support.
- Distinguish UC-visible metadata and privileges from source-system authorization and policies.

### 7.8 Data sharing

- Manage supported shares, recipients, providers, shared assets, and permissions.
- Distinguish sharing modes and their authentication requirements.
- Validate asset support and applicable policy restrictions before sharing.
- Do not assume filters, masks, or ABAC are preserved across all sharing modes.
- Explicitly flag external organizational exposure when it can be established from available evidence.
- Do not expose recipient tokens or activation secrets in routine listings. If a supported secret-creation flow cannot meet the application's secret-handling rules, leave that operation unavailable and explain the supported administrative alternative.
- Integrate supported Clean Rooms or Marketplace governance metadata as related Databricks modules, separate from core UC permissions.

### 7.9 Lineage and impact analysis

- Show table/column upstream and downstream lineage where supported.
- Use official SDK-accessible sources or documented system tables through supported SQL execution.
- Support external metadata/lineage management only where a supported mechanism exists.
- Bound traversal depth, node count, observation window, and pagination.
- Respect metadata visibility; do not leak hidden asset names.
- State collection coverage, time window, and latency.
- No returned lineage does not mean no dependencies. Impact analysis is decision support, not a guarantee of all downstream consumers.

### 7.10 Audit, monitoring, and governance findings

- Query authorized native audit sources/system tables with bounded filters for time, actor, execution identity, action, target, and outcome.
- Separate Databricks audit records from application activity history.
- Record authenticated actor and execution identity separately, especially for service-principal operations.
- Store correlation/request IDs and Databricks operation IDs when available.
- State whether app/audit event correlation is verified, partial, or unavailable; do not invent exact matches.
- Include source, freshness, scope, and completeness in reports.
- Support configurable findings for missing ownership/descriptions, broad grants, external sharing, sensitive assets, and policy coverage when evidence exists.
- Treat findings as review signals, not automatic compliance violations. Do not automatically remediate grants from findings.

### 7.11 Data quality and AI asset governance

- Integrate supported Data Quality Monitoring/profiling configuration, status, refresh history, and results.
- Distinguish metadata constraints, enforced constraints, and quality metrics.
- Show resource/compute requirements before creating or refreshing monitors.
- Govern supported UC functions and model/model-version metadata, grants, ownership, tags, and lineage.
- Check dependencies before modifying/deleting policy functions.
- Separate UC model permissions from Model Serving endpoint permissions.
- Integrate AI Gateway/serving only through their supported APIs and identify them as related services rather than UC grants.
- Do not expose arbitrary Python, SQL, or UDF execution under an administrative identity.

### 7.12 Access requests, approvals, and access reviews

- Prefer native access-request capabilities where available, verifying whether the API supports destination configuration, submission, approval, execution, or only some of these.
- Do not infer a complete workflow from a notification-destination API.
- Clearly label custom approval/review workflows as application-owned.
- Model requester, beneficiary principal, asset, privileges, reason, authorized approver, evidence, and status.
- Verify approval authority for the specific asset/scope; a generic Approver role is insufficient.
- Enforce separation of duties when enabled, including prevention of self-approval.
- Separate Approved, Applying, Applied, Failed, and Unknown outcomes. Approval is not proof that a grant succeeded.
- Persist review scope, evidence, decisions, and execution results.
- Offer time-bound access only when durable persistence and an authorized scheduler are available; do not assume native GRANT expiry.
- Expiry cleanup must preserve legitimate access from overlapping requests or subsequent administrator changes.
- Do not send email, Slack, or Teams messages unless the channel is configured and sending is authorized.

## 8. Authentication and authorization

- Define server-side policy for every backend action: who may request it, execution identity, allowed scope, and required underlying privileges.
- Use supported user authorization for user-scoped operations and explicitly delegated service-principal authorization for application/admin workflows.
- Never silently fall back from failed user authorization to a more privileged service principal.
- Verify end-user identity through documented Databricks Apps authentication/trust boundaries. Do not trust browser-supplied actor IDs, emails, or spoofable headers.
- Define an explicit local authentication strategy that cannot accidentally enable fixture identities in production.
- Implement appropriate role/scope mappings for Viewer, Steward, Access Administrator, Auditor, and Platform Administrator. Application roles do not create UC privileges.
- Do not rely on an email allowlist as the complete production authorization model.
- Prevent escalation through modified principal, target ID, catalog, workspace, action, or policy fields.
- Configure Account API clients separately; do not assume the application service principal has account-administrator privileges.
- Scope tokens, credentials, sessions, and caches by identity, workspace, and relevant authorization context.
- Recheck authorization on every mutation. Disabled or hidden buttons are not security controls.
- Apply session, CSRF, CORS, and request-origin controls appropriate to the chosen architecture.
- Keep secrets out of client bundles, fixtures, screenshots, logs, exports, and error details.

## 9. Unified mutation lifecycle

All privileged changes must use this lifecycle:

> Validate → Authorize → Build plan → Preview → Confirm/Approve → Revalidate → Execute → Verify → Audit

- Bind each plan to the authenticated actor, execution identity, workspace, targets, normalized changes, relevant current state, and expiry.
- Prevent client tampering through server-owned or integrity-protected plans.
- Editing important fields invalidates the prior preview and creates a new plan.
- Preview is read-only and never changes permissions or resources.
- Recheck state, authorization, and applicable policy immediately before execution.
- Use durable operation tracking and supported idempotency controls for duplicate-risk workflows.
- Do not promise exactly-once execution if the underlying API cannot provide it.
- A timeout after submission may mean Unknown, not Failed. Reconcile before retrying.
- Do not automatically retry ambiguous mutations in the UI or generic middleware.
- State when multi-object changes are non-atomic and report individual outcomes.
- Compensation is a new authorized, revalidated operation, not a blind restoration of an old ACL snapshot.
- Do not automatically replay pending mutations after restart.
- Read back supported state to verify results. Distinguish accepted/submitted from verified applied.

Use a concise preview/confirmation flow for ordinary permission changes. Apply stronger confirmation, such as typing the target name, for destructive, broad, or high-impact changes. Do not add confirmation dialogs to read-only actions.

## 10. SQL, persistence, and background execution

- Execute only controlled SQL templates for specific supported operations.
- Bind values and validate/quote identifiers according to supported syntax. Never concatenate unchecked input.
- Do not provide a privileged SQL console.
- Bound execution time, result rows, response size, and query cost.
- Poll/cancel statements using supported interfaces. A client timeout or cancellation request does not prove rollback.
- Select a Databricks durable store, such as a suitable Lakebase or Delta/SQL pattern, only after verifying current availability and transactional requirements.
- Persist application audit, approvals, operations requiring reconciliation, access reviews, and scheduled revocation state durably.
- Do not use local SQLite, app filesystem, browser storage, or session state as production workflow truth.
- Local fixtures and ephemeral in-memory state are acceptable only for clearly identified fixture mode and tests.
- Without configured durable storage, disable dependent production mutation/workflow features instead of pretending they are safe. Keep independent read-only features available.
- Background tasks requiring continuity must use an appropriate Databricks-native scheduling/execution mechanism outside the app process lifecycle.
- Prepare configuration/migrations/jobs as source artifacts; do not provision or activate them without authorization.

## 11. English-language UX and visual design

### 11.1 Design before implementation

Define a concise product brief, information architecture, primary task flows, and visual direction before substantial UI coding. Use available design skills appropriately; do not force React-specific guidance onto another framework.

Create a coherent token system for color, typography, spacing, density, radii, elevation, focus, and motion. Deliver a polished work application with deliberate hierarchy and typography, not a landing page dressed as an admin tool.

Prioritize a desktop/laptop governance workflow while making core tasks usable on narrower screens. Support long object paths, large permission tables, constrained data visibility, and dense administrative forms.

Use visual evidence from the rendered application to refine quality. Community framework preference does not replace browser inspection.

### 11.2 Navigation and asset discovery

- Open on a useful asset search/browse experience with a direct route to access information.
- Group navigation around tasks such as **Data Assets**, **Access Management**, **Policies**, and **Activity**. Place advanced platform configuration separately.
- Keep navigation proportionate to implemented and available capabilities; avoid dozens of empty destination pages.
- Provide Catalog / Schema / Object breadcrumbs and preserve scope across tabs/routes.
- Show asset name, type, owner, and description prominently. Put JSON, SDK details, and diagnostic IDs in expandable details.
- Search supported names/types and filter by owner only where data is available.
- Disambiguate duplicate names with fully qualified paths; provide copy-name and refresh actions.
- Preserve safe filters and selection when navigating back.
- Distinguish no results, insufficient visibility, unavailable configuration, and loading errors.

### 11.3 Workspace and identity context

- Show the configured workspace and environment label, such as DEV/UAT/PROD. Never infer environment from naming alone.
- Clearly distinguish **Demo**, **Read-only**, and **Editing enabled** modes.
- Separate the signed-in actor from the API execution identity.
- Use plain English, for example: "You are requesting this change. It will be executed by the application's service principal."
- Show the managed catalog/scope boundary.
- Identify production consistently using text and visual treatment, not color alone.
- Keep token, host, and technical connection setup out of everyday permission-management forms.

### 11.4 Access table and grant flow

- Include principal, principal type when known, privilege, source, and permitted actions.
- Use clear source labels: **Direct**, **Inherited from schema**, **Inherited from catalog**, or a documented unknown state.
- Support principal search, privilege filters, and source filters.
- Pair understandable labels with exact codes, such as **Read data — SELECT**. Explain common prerequisites inline.
- Do not label an empty response "Nobody has access." Explain visibility limitations.
- Use a short flow: **Choose principal and permissions → Preview → Apply**.
- Preserve the selected asset and avoid repeated entry.
- Use real principal search when supported; otherwise accept a validated identifier with clear guidance, never a fake directory.
- Offer only valid privileges for the asset and identify existing direct grants.
- Explain USE_CATALOG/USE_SCHEMA dependencies without silently granting them.
- Require a concise change reason and invalidate stale previews when relevant inputs change.

### 11.5 Preview and revoke flow

Preview must explain:

- Which privilege is being granted or revoked.
- Which principal and fully qualified target are involved.
- The exact direct change to be sent.
- Potential inheritance to current/future descendants where applicable.
- Execution identity and known scope/impact limitations.

Do not invent affected-object counts. Use **Unknown** or **Not fully determined** when needed.

- Label revoke actions precisely, such as **Revoke SELECT**.
- Do not offer direct revocation of inherited privileges on a child. Offer **View permissions at source** where navigation is authorized.
- Explain that removing one grant may not remove access through groups or other sources.
- Read back actual results after changes.
- Say "Direct SELECT grant revoked" rather than "User can no longer access data" unless that broader conclusion is verified.
- Do not offer Undo unless a safe backend compensation flow exists.

### 11.6 States, feedback, and accessibility

- Provide localized loading indicators, stable layouts, and relevant empty-state next steps.
- Prevent duplicate submissions while a mutation is pending.
- Keep important results visible in the page; do not rely solely on transient toasts.
- Success messages identify the principal, privilege, target, and verified outcome.
- Distinguish forbidden, missing configuration, missing object, rate limit, and connectivity failures.
- For ambiguous mutation timeouts, show **Outcome unknown** and offer safe reconciliation/refresh before retry.
- Do not expose stack traces, secrets, or sensitive raw responses.
- Explain read-only restrictions and configured support contacts where available.
- Never claim **Secure**, **Compliant**, or **PII Protected** without evidence supporting that specific claim.
- Label ephemeral history **Activity in this session**; do not present it as complete audit history.
- Use semantic controls, associated labels, visible focus, keyboard navigation, accessible errors, and non-color status indicators.
- Test dialog focus management, table navigation, long names, zoom, narrow screens, and reduced motion.
- Target WCAG 2.2 AA for relevant UI behavior while documenting test coverage and remaining manual checks; do not claim conformance from an automated scan alone.
- Avoid excessive cards, tabs, modals, decorative motion, and empty charts.

## 12. Local fixture mode and connected mode

Provide a useful local development mode that works without a Databricks account.

- Fixture mode must be unmistakably labeled **Demo — synthetic data** throughout the application.
- Use coherent synthetic assets, identities, direct/inherited grants, and representative outcomes to exercise the workflows.
- Simulated changes must remain isolated to fixture state and never call live mutation APIs.
- Provide representative success, partial-success, forbidden, stale-plan, missing-configuration, and unknown-outcome scenarios.
- Production/connected mode must never silently fall back to fixtures when an API fails.
- A missing credential or resource in connected mode produces an honest configuration/degraded state.
- Unsupported live features must not appear enabled merely because a fixture exists.
- Fixture mode must be an explicit configuration choice and must not become a production authentication bypass.

## 13. Implementation sequence

Proceed in this order, keeping functional UI integration alongside each backend slice:

1. Verify platform/SDK capabilities, choose the stack, and define the product and design system.
2. Scaffold the application, configuration, fixture mode, authentication boundaries, authorization, capabilities, and error contracts.
3. Deliver asset discovery and metadata with direct/inherited grant explanation and preview/apply infrastructure.
4. Implement supported tags, policies, row filters, masks, and ownership flows.
5. Implement supported storage, bindings, federation, and sharing modules.
6. Implement supported lineage, audit, quality, and AI asset governance.
7. Implement native or explicitly application-owned requests, approvals, and reviews with the required persistence.
8. Complete UI integration, browser review, tests, deployment configuration, and handoff documentation.

Phases establish order, not permission to stop after the first attractive screen. Account for every domain in the capability matrix. Complete all feasible supported work and report precise blockers for the remainder.

Do not create empty service methods, placeholder endpoints, or controls that return success without executing their intended behavior. A disabled unsupported capability with an accurate explanation is preferable to a fake implementation.

## 14. Testing and acceptance criteria

Use meaningful tests appropriate to the chosen stack. At minimum cover:

- Object-level authorization, scope boundaries, and principal validation.
- Viewer denial on direct backend mutation calls.
- No identity fallback, spoofing, or privilege escalation.
- Direct versus inherited grants, ownership, and incomplete group data.
- Supported tag, policy, filter, and mask validation.
- SQL injection, SSRF, secret redaction, and session/origin protections.
- Pagination, throttling, identity-scoped caching, and metadata visibility.
- Stale/expired/tampered plans, concurrent changes, duplicate submission, and replay.
- Partial success, ambiguous timeout, reconciliation, and restart behavior.
- Approval authority and separation of duties.
- Read-only/degraded behavior when resources or capabilities are missing.
- SDK adapter contract tests against the pinned SDK's real interface shapes; distinguish mocked contracts from live API evidence.
- UI search/select, breadcrumbs, grant preview/apply, revoke, inherited-source navigation, errors, and unknown outcomes.
- English authored UI, keyboard operation, responsive layouts, and accessible form/dialog states.
- Clean dependency installation, type checks where applicable, linting, production build, and local start.

Use opt-in integration tests against an explicitly authorized sandbox. Do not run mutation tests against a production workspace. Do not use mock tests to claim real Databricks integration has been verified.

Acceptance criteria:

1. A new user can find a table, understand visible permission sources, and complete a grant preview without reading source code.
2. Direct and inherited permissions are clearly distinguishable.
3. Actor and execution identity are clearly distinguishable.
4. A Viewer cannot mutate state even by calling backend endpoints directly.
5. Stale previews and duplicate submissions cannot silently apply unintended changes.
6. Real, fixture, read-only, unsupported, and unknown states are explicit.
7. The chosen stack runs locally and has a documented Databricks Apps deployment path.
8. The rendered UI is visually reviewed at desktop and narrow viewport sizes and has no known critical layout or interaction failures.
9. Every requested domain has an honest implementation and verification status.

## 15. Deliverables

Deliver everything locally under `governance-app/`, including:

- Complete application source with separated integration/domain/UI concerns.
- Reproducible dependency manifests and lockfiles.
- A README with exact prerequisites, install, fixture-mode run, connected-mode configuration, test, build, and deployment-preparation commands.
- Safe example configuration without credentials.
- Current Databricks Apps build/start configuration and resource prerequisites.
- Durable storage schemas/migrations and scheduler definitions where required, without applying them to live resources.
- `docs/technology-decision.md` with dated official and community evidence.
- `docs/capability-matrix.md` covering all requested domains and live-verification gaps.
- Authentication, role/permission, execution-identity, and resource-access matrices.
- API/service contracts and mutation-state documentation.
- An operations runbook for setup, rotation, troubleshooting, reconciliation, recovery, and known limitations.
- Meaningful automated tests and their actual results.
- Screenshots of the rendered application at representative viewport sizes, including important workflow and error states. Label fixture screenshots as synthetic.

Avoid prescribing a directory structure that conflicts with the selected framework; retain `governance-app/` as the source root and keep it understandable.

## 16. Final handoff report

Provide a concise English report with:

1. **Built:** major implemented user journeys and governance modules.
2. **Technology choice:** chosen stack, why it fits, and links to the recorded evidence.
3. **Run locally:** source path and exact commands, including fixture mode.
4. **Verified:** actual build/test/browser checks and whether evidence is synthetic, mocked, or live.
5. **Not yet live-verified:** required workspace configuration, identities, privileges, resources, or sandbox tests.
6. **Unavailable or blocked:** exact unsupported operations and reasons, separated from unimplemented work.
7. **Deployment preparation:** supplied configuration and remaining authorized deployment steps.
8. **Artifacts:** paths to documentation, screenshots, and test results.

Do not claim complete Unity Catalog governance coverage when modules are missing, mocked, unsupported, or unverified. Do not claim the app was deployed or tested on Databricks unless that actually occurred.

Build the working application, connect the UI to real backend adapters, and complete all independent local work. Do not stop at recommendations. Do not initialize Git, commit, push, deploy, or modify live Databricks resources as part of this request.

## Research starting points

Recheck these sources at implementation time. They are starting points, not proof that any specific workspace supports a feature.

- [Databricks Apps documentation](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/): choose the matching cloud documentation when known.
- [Databricks Apps best practices](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices).
- [Official Databricks app development documentation](https://developers.databricks.com/docs/apps/development).
- [Databricks SDK for Python](https://github.com/databricks/databricks-sdk-py): one candidate to assess, not a required backend language.
- [State of JavaScript 2025 — Front-end Frameworks](https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/): dated community evidence available in 2026, not an objective visual-quality ranking.

Use current official documentation for the selected framework, component system, SDK, and every governance operation. Record newer relevant community research if available rather than treating these starting points as a fixed ranking.
