ROLE: Backend Coder for the Unity Catalog Governance application.

READ FIRST, from the project root C:\Users\admin\Downloads\uc-governance-app:
1. AGENTS.md
2. BACKEND_INSTRUCTION.md
3. docs/02-architecture.md sections 1 to 3

TASK: P0-02 backend half. Author the Python dependency and tooling manifests.

IMPORTANT, READ THIS FIRST
Your sandbox has no working network access. Do not attempt any network call, do not run
`uv lock`, `uv sync`, `uv add`, or `pip install`, and do not try to look a version up. Every
version you need is supplied below and is already verified against PyPI by the orchestrator on
2026-09-21. Use these exact strings. The orchestrator will generate the lockfile and run the
installation as part of its verification gate.

SCOPE. Create or edit only these files:
- pyproject.toml
- .env.example

Do not create uv.lock or requirements.txt; the orchestrator generates those. Do not create
anything under backend/, frontend/, or shared/. Do not edit any document.

EXACT PINS, use verbatim

Runtime dependencies:
  fastapi==0.141.1
  uvicorn[standard]==0.53.0
  pydantic==2.13.5
  pydantic-settings==2.15.0
  databricks-sdk==0.140.0
  psycopg[binary]==3.3.6
  python-multipart==0.0.32
  httpx==0.28.1

Dev dependency group named "dev":
  pytest==9.1.1
  pytest-asyncio==1.4.0
  ruff==0.16.8
  mypy==2.3.1
  schemathesis==4.27.5
  jsonschema==4.26.0
  pyyaml==6.0.3

WHAT TO PRODUCE

1. pyproject.toml
   - [project]: name "uc-governance-app", version "0.1.0", requires-python ">=3.11,<3.12",
     description one line, dependencies exactly as listed above.
   - [dependency-groups] with the dev group above. Use the dependency-groups table, which is what
     `uv` reads, not [project.optional-dependencies].
   - [tool.ruff]: line-length 100, target-version "py311". Enable rule sets E, F, I, UP, B, SIM,
     and ignore nothing without a comment explaining why.
   - [tool.mypy]: strict = true, files = ["backend/app"], python_version "3.11",
     warn_unused_ignores = true, disallow_any_generics = true. Add
     ignore_missing_imports for the databricks.* and psycopg.* module patterns only, each with a
     one-line comment saying it is because those packages ship partial stubs.
   - [tool.pytest.ini_options]: testpaths ["backend/tests"], asyncio_mode "auto",
     a registered marker `live` described as "requires an authorized sandbox workspace; opt-in",
     and default addopts that deselect it with `-m "not live"`. Also `--strict-markers`.
   - [tool.uv] if anything is needed for the dev group; otherwise omit it.
   - Do not add a build backend or packaging config. This application is run, not published, so
     keep it a bare project table.

2. .env.example
   Every variable from docs/02-architecture.md section 3, each with a safe placeholder and a
   one-line comment above it. No real secret, host, token, or workspace URL. Required:
     UCGOV_MODE (fixture | connected_readonly | connected; state that it is required)
     UCGOV_FIXTURE_ACTOR
     UCGOV_ENVIRONMENT_LABEL
     UCGOV_MANAGED_CATALOGS
     UCGOV_ROLE_GROUPS
     UCGOV_PLAN_TTL_SECONDS (default 600)
     UCGOV_SUPPORT_CONTACT
     UCGOV_SOD_ENABLED
     UCGOV_LOCAL_AUTH
     UCGOV_BOOTSTRAP_ADMINS
     UCGOV_WAREHOUSE_ID (optional; note which modules degrade without it)
     UCGOV_PLAN_HMAC_KEY (note: supplied from a Databricks Apps secret resource in production)
     UCGOV_ACCOUNT_ID (optional, Account API)
     PGHOST, PGPORT, PGDATABASE, PGUSER, PGSSLMODE, PGAPPNAME (optional, Lakebase)
   Add a header comment stating that Databricks Apps injects DATABRICKS_HOST,
   DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET and DATABRICKS_APP_PORT automatically and that
   they must never be written into this file.

VERIFY
You cannot install anything, so do not claim that you did. You may run `uv --version` to confirm
uv is present. Confirm your own work by reading the files back and checking that every pin above
appears exactly once, spelled exactly as given.

REPORT
- Every file you created or changed.
- Confirmation that the pin list matches this prompt exactly, or any place it does not.
- Anything you could not do, stated plainly.

FORBIDDEN
- No network calls of any kind. No `uv lock`, `uv sync`, `uv add`, `pip install`.
- No git commands. No deployment. No Databricks API calls.
- Do not read or modify C:\Users\admin\Downloads\governance-app, a different project.
- Do not edit shared/contracts; the contract is frozen and owned by the orchestrator.
- Do not invent a version number. If a package you think is needed is missing from the list above,
  say so in your report instead of guessing a version.
