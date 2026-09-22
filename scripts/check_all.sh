#!/usr/bin/env bash
# Run every verification gate for this project, in dependency order, and report honestly.
#
# Gate 1 is the contract validator and runs FIRST, because a drifted contract invalidates every
# result that follows. It needs --no-project: the project's pyproject pins Python 3.11, and uv
# would otherwise resolve the whole project environment just to lint a YAML file.
#
# Every gate runs even if an earlier one fails, so one invocation reports all the damage rather
# than only the first problem. Exits non-zero if any gate failed.
#
# Gate 4 is the end-to-end journey gate. It starts the Vite dev server with MSW and drives a
# real Chromium, so it is the only gate that exercises the app as a user meets it. It is ON by
# default: a gate that must be asked for is not a gate.
#
# Usage: scripts/check_all.sh [--skip-backend] [--skip-frontend] [--skip-e2e]

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_BACKEND=0
SKIP_FRONTEND=0
SKIP_E2E=0

for arg in "$@"; do
  case "$arg" in
    --skip-backend)  SKIP_BACKEND=1 ;;
    --skip-frontend) SKIP_FRONTEND=1 ;;
    --skip-e2e)      SKIP_E2E=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

NAMES=()
CODES=()

check() {
  local name="$1" dir="$2"; shift 2
  printf '\n--- %s\n' "$name"
  ( cd "$dir" && "$@" )
  local code=$?
  NAMES+=("$name")
  CODES+=("$code")
  if [ "$code" -eq 0 ]; then printf '    PASS  (exit 0)\n'; else printf '    FAIL  (exit %s)\n' "$code"; fi
}

check 'Gate 1  contract validation' "$ROOT" \
  uv run --no-project --with pyyaml --with jsonschema python scripts/validate_contracts.py

if [ "$SKIP_BACKEND" -eq 0 ]; then
  check 'Gate 2  ruff'   "$ROOT" uv run --frozen ruff check backend
  check 'Gate 2  mypy'   "$ROOT" uv run --frozen mypy backend/app
  check 'Gate 2  pytest' "$ROOT" uv run --frozen pytest backend/tests -q
fi

if [ "$SKIP_FRONTEND" -eq 0 ]; then
  check 'Gate 3  tsc'    "$ROOT/frontend" npx tsc --noEmit
  check 'Gate 3  eslint' "$ROOT/frontend" npx eslint .
  check 'Gate 3  vitest' "$ROOT/frontend" npx vitest run
  check 'Gate 3  build'  "$ROOT/frontend" npx vite build
fi

if [ "$SKIP_E2E" -eq 0 ] && [ "$SKIP_FRONTEND" -eq 0 ]; then
  check 'Gate 4  e2e'    "$ROOT/frontend" npx playwright test --reporter=list
fi

printf '\nSUMMARY\n'
failed=0
for i in "${!NAMES[@]}"; do
  if [ "${CODES[$i]}" -eq 0 ]; then
    printf '  %-26s PASS\n' "${NAMES[$i]}"
  else
    printf '  %-26s FAIL (exit %s)\n' "${NAMES[$i]}" "${CODES[$i]}"
    failed=$((failed + 1))
  fi
done

if [ "$failed" -gt 0 ]; then
  printf '\n%s of %s checks failed.\n' "$failed" "${#NAMES[@]}"
  exit 1
fi
printf '\nAll %s checks passed.\n' "${#NAMES[@]}"
