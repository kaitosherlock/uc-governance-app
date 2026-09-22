<#
.SYNOPSIS
    Run every verification gate for this project, in dependency order, and report honestly.

.DESCRIPTION
    Gate 1 is the contract validator and runs FIRST, because a drifted contract invalidates every
    result that follows. It needs --no-project: the project's pyproject pins Python 3.11, and uv
    would otherwise try to resolve the whole project environment just to lint a YAML file.

    Every gate runs even if an earlier one fails, so a single invocation reports all the damage
    rather than only the first problem. The exit code is non-zero if any gate failed.

.PARAMETER SkipFrontend
    Skip the frontend gates. Useful on a machine without node_modules installed.

.PARAMETER SkipBackend
    Skip the backend gates.

.PARAMETER SkipE2E
    Skip Gate 4, the end-to-end journey gate. Gate 4 starts the Vite dev server with MSW and
    drives a real Chromium, so it is the only gate that exercises the app as a user meets it.
    It is ON by default: a gate that must be asked for is not a gate.
#>
[CmdletBinding()]
param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipE2E
)

$root = Split-Path -Parent $PSScriptRoot
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-Check {
    param([string]$Name, [string]$Directory, [scriptblock]$Command)

    Write-Host ""
    Write-Host "--- $Name" -ForegroundColor Cyan
    Push-Location $Directory
    try {
        # Native tools write progress to stderr; under $ErrorActionPreference='Stop' that would
        # become a terminating error and kill the run. Keep it non-terminating here deliberately.
        $previous = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $Command 2>&1 | ForEach-Object { Write-Host $_ }
        $code = $LASTEXITCODE
        $ErrorActionPreference = $previous
    } finally {
        Pop-Location
    }

    $ok = ($code -eq 0)
    $results.Add([pscustomobject]@{ Name = $Name; Ok = $ok; ExitCode = $code })
    Write-Host ("    {0}  (exit {1})" -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $code) `
        -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
}

# Gate 1 — the contract. Always runs; everything downstream is meaningless if this fails.
Invoke-Check 'Gate 1  contract validation' $root {
    uv run --no-project --with pyyaml --with jsonschema python scripts/validate_contracts.py
}

if (-not $SkipBackend) {
    Invoke-Check 'Gate 2  ruff'   $root { uv run --frozen ruff check backend }
    Invoke-Check 'Gate 2  mypy'   $root { uv run --frozen mypy backend/app }
    Invoke-Check 'Gate 2  pytest' $root { uv run --frozen pytest backend/tests -q }
}

if (-not $SkipFrontend) {
    $frontend = Join-Path $root 'frontend'
    Invoke-Check 'Gate 3  tsc'    $frontend { npx tsc --noEmit }
    Invoke-Check 'Gate 3  eslint' $frontend { npx eslint . }
    Invoke-Check 'Gate 3  vitest' $frontend { npx vitest run }
    Invoke-Check 'Gate 3  build'  $frontend { npx vite build }

    if (-not $SkipE2E) {
        Invoke-Check 'Gate 4  e2e'    $frontend { npx playwright test --reporter=list }
    }
}

Write-Host ""
Write-Host "SUMMARY" -ForegroundColor Cyan
foreach ($r in $results) {
    Write-Host ("  {0,-26} {1}" -f $r.Name, $(if ($r.Ok) { 'PASS' } else { "FAIL (exit $($r.ExitCode))" })) `
        -ForegroundColor $(if ($r.Ok) { 'Green' } else { 'Red' })
}

$failed = @($results | Where-Object { -not $_.Ok })
if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host ("{0} of {1} checks failed." -f $failed.Count, $results.Count) -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host ("All {0} checks passed." -f $results.Count) -ForegroundColor Green
exit 0
