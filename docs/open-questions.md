# Open questions

Agents append questions here when a Databricks behavior cannot be verified. Each entry has a
status; the user or a later verification pass answers it. Unanswered questions keep the related
capability at `unknown` with its control disabled.

| # | Question | Raised by | Date | Affects | Status |
|---|---|---|---|---|---|
| Q1 | Target cloud for deployment (AWS / Azure / GCP)? Docs were read from the AWS set. | planning | 2026-09-21 | docs/04, app.yaml resources, region availability for Lakebase | open — ask user |
| Q2 | Is a Lakebase instance available/authorized in the target workspace? If not, approvals/reviews/time-bound access stay `not_configured` in connected mode. | planning | 2026-09-21 | Phase 5 | open — ask user |
| Q3 | Is a SQL warehouse available for the app SP (Can use)? Without it: lineage, audit, tags-via-SQL, filters/masks, dynamic views are `not_configured`. | planning | 2026-09-21 | Phases 2, 4 | open — ask user |
| Q4 | Will an account-level service principal (account admin) be configured for metastore administration? If not, `admin/metastores` is `not_configured`. | planning | 2026-09-21 | §7.1 metastore admin | open — ask user |
| Q5 | Exact SDK call and token lifetime for Lakebase OAuth database credentials on the pinned SDK. | planning | 2026-09-21 | P5-02 | open — verify in P0-01/P0-08 |
| Q6 | GA/Preview status and SDK presence of: ABAC policies API, tag policies (governed tags), entity tag assignments, RFA (request for access), Data Classification, external lineage/metadata. | planning | 2026-09-21 | P0-08, Phases 2, 4, 5 | open — verify in P0-01/P0-08 |
| Q7 | Databricks Apps request timeout / idle shutdown / WebSocket support (limitations page 404 at AWS URL tried). | planning | 2026-09-21 | long-running operation UX (polling assumed) | open — verify in P0-01 |
| Q8 | Will a sandbox workspace be authorized later for opt-in read-only integration tests? | planning | 2026-09-21 | live-verification column of capability matrix | open — ask user |
| Q9 | `codex` CLI is not installed and its account is out of tokens. User requires the backend role to stay on codex; rerouting to `agy` declined. | orchestrator | 2026-09-21 | the entire backend lane | **BLOCKING** — user installs codex and restores quota |
| Q10 | `CLAUDE.md` disables the `agy-right-hand` skill, but the user asked for Antigravity CLI orchestration. Direct `agy` binary use is assumed approved by the `start project` message. | orchestrator | 2026-09-21 | whether any CLI dispatch happens at all | assumed approved — user may override |
| Q11 | Where does `agy` read `permissions.allow` from? Its headless mode auto-denies the `command` permission and names a `settings.json`, but `.agent/settings.json`, `.agy/settings.json`, and `~/.agy/settings.json` all failed with several rule spellings. Without it the frontend agent cannot run npm or tsc. | orchestrator | 2026-09-21 | frontend agent cannot self-verify; orchestrator runs all frontend commands instead | **open** — needs the correct path from the user or agy's docs. `--dangerously-skip-permissions` is refused as too broad |
| Q12 | Can `codex` be given working network access? `sandbox_workspace_write.network_access=true` makes the host reachable but PowerShell's HTTP client then fails TLS, so package resolution still fails. Untested whether `uv`, which handles its own TLS, would succeed. | orchestrator | 2026-09-21 | backend agent cannot lock dependencies; orchestrator does it | **open** — workaround in place, orchestrator supplies exact pins |
