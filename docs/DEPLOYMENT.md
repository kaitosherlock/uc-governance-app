# Deploying the Unity Catalog Governance app

This is the operational guide: what must be true before you deploy, how to deploy, and — the part
that actually bites — what must be done **after** deploying before the app can show any real data.

> **If your app is deployed but shows no catalogs, skip to [§5](#5-after-deploy-the-two-authorization-gaps).**
> That is the expected state of a fresh deployment and it needs two separate authorization steps
> that deployment itself cannot perform.

---

## 1. What "working" means for this app

The app has three independent layers, and they fail independently. Diagnosing anything means
knowing which layer is broken.

| Layer | Question it answers | How to check |
|---|---|---|
| **Platform** | Is the app process running? | `databricks apps get <name>` → `app_status.state` is `RUNNING` |
| **Identity** | Does the app know who you are? | `GET /api/v1/me` returns 200 with your email |
| **Data access** | May the app read Unity Catalog on your behalf? | `GET /api/v1/catalogs` returns 200 |

A brand-new deployment normally passes the first two and fails the third. That is not a bug — it is
two authorization grants that have not been made yet.

---

## 2. Prerequisites, before you deploy

### 2.1 The workspace

- **Unity Catalog enabled**, with at least one catalog you can see.
- **Databricks Apps available in the workspace.** This is not universal. Some workspaces are barred
  from Apps at the platform level and return
  `Workspace <id> has been banned and cannot access Databricks Apps` for every Apps command,
  including `apps list`. If you see that, the workspace cannot host this app and no configuration
  will change it — use a different workspace.
- **A free app slot.** Workspaces cap the number of apps (3 on the tier this was developed against).
  `databricks apps list` shows what exists. Deleting an app to free a slot is asynchronous and takes
  roughly 30 seconds before a create will succeed.

### 2.2 Your workstation

| Tool | Version | Why |
|---|---|---|
| Databricks CLI | current | sync and deploy |
| Python | 3.11 | matches the Apps runtime; the project pins it |
| `uv` | current | dependency resolution and the backend gates |
| Node | 22 | frontend build |

Authenticate the CLI against the target workspace and confirm it works before anything else:

```bash
databricks auth login --host https://<your-workspace-host>
databricks current-user me
```

### 2.3 The repository state

Everything must be green **before** you build a deployment bundle. One command runs every gate:

```bash
./scripts/check_all.sh
```

Nine checks: contract validation, ruff, mypy, pytest, tsc, eslint, vitest, the production build, and
the Playwright end-to-end journeys. Do not deploy a tree that fails any of them.

---

## 3. Configuration that must be decided before deploying

All of it lives in `app.yaml`. The ones that matter:

| Variable | Required | Notes |
|---|---|---|
| `UCGOV_MODE` | yes | `connected_readonly` for a first deployment. Every mutation returns `MODE_READ_ONLY`, so the app cannot change anything in your workspace. `fixture` is **impossible** here by design: the app refuses to start in fixture mode when `DATABRICKS_APP_PORT` or `DATABRICKS_CLIENT_ID` is present, so a deployed app can never serve synthetic data as if it were real. |
| `UCGOV_PLAN_HMAC_KEY` | yes in connected modes | At least 32 characters. The app **refuses to start** without it, so mutation plans can never be unsigned. See the warning in `app.yaml` about supplying it as a literal. |
| `UCGOV_ENVIRONMENT_LABEL` | yes | Shown in the interface. Configured, never guessed from a host name. |
| `UCGOV_MANAGED_CATALOGS` | no | Comma-separated allowlist. Empty means every catalog the executing identity can already see. Narrow this before enabling write mode. |
| `UCGOV_PLAN_TTL_SECONDS` | no | Plan preview lifetime, default 600. |
| `UCGOV_WAREHOUSE_ID` | no | Needed for lineage, audit system tables, tags via SQL, and row filters. Without it those features report `not_configured` rather than pretending to work. |
| Lakebase / Postgres | no | Needed for access requests, approvals, reviews and time-bound access. Without it those degrade to `not_configured`. |

`DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` are injected by the
platform. **Never put them in `app.yaml`.**

---

## 4. Deploying

The bundle is deliberately small: the manifest, the pinned requirements, the backend package, and a
freshly built frontend. Nothing else — no `.venv`, no `node_modules`, no caches.

```bash
# 1. Build the frontend. The backend serves it from frontend/dist at /.
cd frontend && npm ci && npm run build && cd ..

# 2. Assemble a clean bundle (a staging directory outside the repo is fine):
#      app.yaml
#      requirements.txt
#      backend/app/**
#      frontend/dist/**
#    Strip __pycache__ and .map files.

# 3. Sync and deploy. Run these from PowerShell on Windows —
#    Git Bash rewrites the /Workspace path and the command fails.
databricks sync <bundle-dir> /Workspace/Users/<you>/uc-governance-app --full
databricks apps deploy <app-name> --source-code-path /Workspace/Users/<you>/uc-governance-app
```

Expect `"state": "SUCCEEDED"` and `App started successfully`.

**If the app reports `STOPPED`** with *"App compute was stopped due to workspace or account status"*,
start it — starting also deploys the synced bundle:

```bash
databricks apps start <app-name>
```

**Verify the deploy landed** by checking the build log at `https://<app-url>/logz`. It lists every
file updated and the exact uvicorn command. If you do not see your recent files there, you deployed
an older bundle.

---

## 5. After deploy: the two authorization gaps

This is where a working deployment still shows nothing, and it is **by design** — the app reads
Unity Catalog under two different identities, and each needs its own grant.

| Endpoint group | Executes as | Needs |
|---|---|---|
| Catalogs, schemas, tables | **The signed-in user**, via the forwarded token | OAuth user scopes on the app (§5.1) **and** your own UC privileges |
| Grants, principals, functions, models | **The app's service principal** | UC privileges granted to that service principal (§5.2) |

That split is deliberate. Reading catalogs as *you* means Unity Catalog row filters and column masks
apply and you see only what you are entitled to see. Grants are not in the user-authorization scope
list at all, so they must run as the app.

### 5.1 Grant the app its OAuth user scopes, then re-consent

Check what the app currently has:

```bash
databricks apps get <app-name> --output json | grep effective_user_api_scopes -A 8
```

A fresh app has only the defaults, `iam.access-control:read` and `iam.current-user:read`, which are
enough for `/me` and nothing else. Add the catalog read scopes:

```bash
# Note: do NOT list the two defaults here — they are implicit and are rejected as invalid.
cat > scopes.json <<'EOF'
{"name":"<app-name>","user_api_scopes":["catalog.catalogs","catalog.schemas","catalog.tables"]}
EOF
databricks apps update <app-name> --json @scopes.json
```

Then **restart the app** so the change takes effect:

```bash
databricks apps stop <app-name> && databricks apps start <app-name>
```

**Then re-authorize as the user.** This is the step people miss. Your browser session holds an OAuth
grant that was issued with the *old* scope list, and Databricks does not silently upgrade it. Until
you re-consent, the forwarded token still carries the old scopes and Unity Catalog reads keep
returning 403 even though the app is configured correctly.

Remove the app's authorization from your Databricks user settings and open the app again to accept
the new consent screen. If you cannot find it, opening the app in a private window or a different
browser profile will force a fresh consent, which is a quick way to confirm this is the cause.

### 5.2 Grant the service principal its Unity Catalog privileges

Find the service principal name — it is created automatically with the app:

```bash
databricks apps get <app-name> --output json | grep service_principal_name
```

It looks like `app-xxxxxx <app-name>`. It starts with **no** Unity Catalog privileges, so the Access
tab will be empty even after §5.1 succeeds.

Grant it what you want it to see. Minimum for browsing and reading grants:

```sql
GRANT USE CATALOG ON CATALOG <catalog> TO `<service-principal-name>`;
GRANT USE SCHEMA  ON SCHEMA  <catalog>.<schema> TO `<service-principal-name>`;
```

To read who has access to an object, it also needs privilege-management visibility on that object,
which in Unity Catalog means `MANAGE` (or ownership). Grant that deliberately and narrowly —
`MANAGE` lets the holder change permissions, so scope it to the objects this app is meant to govern
and set `UCGOV_MANAGED_CATALOGS` to match.

---

## 6. Verifying a deployment

Run these in the browser console **on the app's own origin**, so the platform's forwarded
authentication applies. A workspace PAT will **not** work against an app URL — the Apps proxy
rejects it with an empty 401, which looks alarming and means nothing.

```js
for (const p of ['/api/v1/context','/api/v1/me','/api/v1/capabilities','/api/v1/catalogs']) {
  const r = await fetch(p, {headers:{Accept:'application/json'}});
  console.log(p, r.status, (await r.text()).slice(0,200));
}
```

| Result | Meaning |
|---|---|
| `/context` and `/me` 200, `/catalogs` 200 | Fully working. |
| `/context` and `/me` 200, `/catalogs` 403 `INSUFFICIENT_PRIVILEGES` | Normal for a fresh deploy. Do §5.1, including the re-consent. |
| `/catalogs` 200 but the Access tab is empty | §5.1 is done; the service principal still needs §5.2. |
| `/me` 401 `IDENTITY_MISMATCH` | The forwarded identity disagrees with the token-verified user. Should not occur on current builds; report it with the correlation id. |
| Everything 401 with an **empty body** | You are calling from outside the browser session. The Apps proxy rejected you before reaching the app. |
| `/capabilities` shows features as `not_configured` | Expected. Those need a warehouse or Lakebase; see §3. |

`/api/v1/capabilities` is the honest inventory: it reports every capability as `available`,
`not_implemented`, `not_configured` or `unsupported`, and it never claims something works that does
not.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Workspace <id> has been banned and cannot access Databricks Apps` | Platform-level restriction on the workspace | Use a different workspace; nothing in this repo can work around it |
| `Cannot deploy app as it is not in RUNNING state` | App is stopped | `databricks apps start <name>` — it deploys the synced bundle too |
| App will not start, logs mention `UCGOV_PLAN_HMAC_KEY` | Key missing or under 32 characters in a connected mode | Set it in `app.yaml`. This guard is deliberate: the app must never run with unsigned plans |
| `Error: error decoding JSON ... invalid character 'ï'` | PowerShell 5.1 wrote a UTF-8 **BOM** into the JSON file | Write it with `[System.IO.File]::WriteAllText($p,$json,(New-Object System.Text.UTF8Encoding($false)))` |
| `Path (C:/Program Files/Git/Workspace/...) doesn't start with '/'` | Git Bash rewrote the `/Workspace` path | Run `databricks sync` from PowerShell |
| `The specified scope iam.access-control:read is not a valid scope` | The two defaults are implicit | List only the scopes you are adding |
| Everything worked, then stopped after a scope change | The OAuth grant predates the change | Re-consent, §5.1 |

---

## 8. What a correct deployment looks like when it is not fully authorized

This matters: **an unauthorized deployment is not a broken one.** The app is built to be honest
rather than to appear complete. With no grants it will:

- render the shell, the mode badge, the environment chip, the workspace host and your identity;
- show a mapped, specific error where data would be — not a blank page and not fabricated data;
- report every unavailable capability as `not_configured` or `not_implemented` in
  `/api/v1/capabilities`;
- never display "Nobody has access", "Secure" or "Compliant", because it cannot know those things.

If you want to see the full interface without granting anything, run it locally in fixture mode,
which serves a synthetic dataset and is clearly labelled as such in the interface:

```bash
UCGOV_MODE=fixture uv run --frozen uvicorn app.main:create_app --factory --app-dir backend --port 8000
```
