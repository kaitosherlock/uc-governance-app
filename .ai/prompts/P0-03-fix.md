GATE 2 REJECTION for task P0-03. Two defects. Fix exactly these and change nothing else.

Good news first, so you know the scope: `uv run --frozen pytest backend/tests -q` reports
**137 passed**. Your tests and application code work. Only lint and typecheck fail.

DEFECT 1, mypy, one error

```
backend\app\main.py:33: error: Missing named argument "mode" for "Settings"  [call-arg]
```

`Settings` declares `mode` as required, which is correct and must stay required, because
`docs/02-architecture.md` section 3 says startup fails when `UCGOV_MODE` is missing. The bug is the
call site: `main.py` constructs `Settings()` with no arguments, so mypy cannot know the value will
come from the environment.

Fix it without weakening the requirement. Add a module-level loader in
`backend/app/config/settings.py` such as:

```python
def load_settings() -> Settings:
    """Build Settings from the environment. Fails loudly when UCGOV_MODE is absent."""
    return Settings()  # type: ignore[call-arg]  # pydantic-settings fills fields from the environment
```

with that narrowly scoped ignore and that explanatory comment on the single line that needs it,
then have `main.py` call `load_settings()` instead of `Settings()`. Do not add
`# type: ignore` anywhere else, do not give `mode` a default, and do not relax mypy strictness in
`pyproject.toml`, which you must not edit at all.

DEFECT 2, ruff, eight errors, all `I001` unsorted import blocks

```
backend\tests\api\test_errors.py:1:1: I001
backend\tests\api\test_identity.py:1:1: I001
backend\tests\api\test_static.py:1:1: I001
backend\tests\contract\test_scaffold_contract.py:3:1: I001
backend\tests\unit\test_authz.py:1:1: I001
backend\tests\unit\test_capabilities.py:1:1: I001
backend\tests\unit\test_redaction.py:1:1: I001
backend\tests\unit\test_settings_guard.py:1:1: I001
```

Sort the import block in each of those eight files into ruff's isort order: future, standard
library, third party, first party, local, each group separated by a blank line and alphabetised
within the group. You may run `uv run --frozen ruff check backend --fix` to do it mechanically,
then re-run the check to confirm.

VERIFY, and paste the real output of each
- `uv run --frozen ruff check backend`
- `uv run --frozen mypy backend/app`
- `uv run --frozen pytest backend/tests -q`

All three must be clean. If `pytest` drops below 137 passed you have broken something; fix it
before reporting.

SCOPE. Edit only `backend/app/config/settings.py`, `backend/app/main.py`, and the eight test files
named above. Do not edit `pyproject.toml`, `shared/contracts/`, `frontend/`, `docs/`, `scripts/`,
or `.ai/`. Do not weaken any lint or type setting.

REPORT the exact changes per file and the real output of the three commands. Then append one line
to `tasks/STATUS.md` and update your row in `tasks/TASK-BOARD.md`.

Remember: no network, no installs, no git. Use `uv run --frozen` for everything.
