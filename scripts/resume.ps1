<#
.SYNOPSIS
    Resume work that was deferred because an agent ran out of tokens.

.DESCRIPTION
    Finds run records with status `quota_exhausted` (or `failed`, with -IncludeFailed), probes the
    agent with a tiny prompt to see whether quota is back, and if it is, resumes the SAME agent
    session so the task continues from where it stopped rather than restarting.

    Safe to run repeatedly. If quota is still gone, it reports that and changes nothing.

.EXAMPLE
    ./scripts/resume.ps1 -Status              # show what is pending, probe nothing
.EXAMPLE
    ./scripts/resume.ps1 -Agent backend       # probe the backend lane and resume its pending task
.EXAMPLE
    ./scripts/resume.ps1                      # probe both lanes and resume everything pending
#>
[CmdletBinding()]
param(
    [ValidateSet('backend', 'frontend')][string]$Agent,
    [string]$TaskId,
    [switch]$Status,
    [switch]$IncludeFailed,
    [int]$TimeoutMinutes = 45,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'lib/agentlib.ps1')

$config = Get-AgentConfig -Root $root
$runDir = Join-Path (Join-Path $root $config.dispatch_rules.state_dir) 'runs'

# ---- collect pending work -------------------------------------------------------------------
$wanted = @('quota_exhausted', 'timeout', 'resuming')
if ($IncludeFailed) { $wanted += 'failed' }

$pending = @()
if (Test-Path $runDir) {
    foreach ($f in (Get-ChildItem $runDir -Filter '*.json' | Sort-Object Name)) {
        $rec = Get-Content $f.FullName -Raw | ConvertFrom-Json
        if ($wanted -notcontains $rec.status) { continue }
        if ($Agent -and $rec.agent -ne $Agent) { continue }
        if ($TaskId -and $rec.task_id -ne $TaskId) { continue }
        $pending += [pscustomobject]@{ Record = $rec; Path = $f.FullName }
    }
}

Write-Host 'RESUME QUEUE' -ForegroundColor Cyan
foreach ($a in @('backend', 'frontend')) {
    $q = $config.agents.$a.quota
    Write-Host ("  {0,-9} cli={1,-6} status={2,-8} quota={3}" -f $a, $config.agents.$a.cli, $config.agents.$a.status, $q.state)
}
if ($pending.Count -eq 0) {
    Write-Host '  nothing pending' -ForegroundColor Green
    if ($Status) { return }
    return
}
foreach ($p in $pending) {
    $sid = $p.Record.session_id
    if (-not $sid) { $sid = '(no session captured, will use most recent)' }
    Write-Host ("  {0,-8} agent={1,-9} tier={2,-15} status={3,-16} session={4}" -f `
        $p.Record.task_id, $p.Record.agent, $p.Record.tier, $p.Record.status, $sid) -ForegroundColor Yellow
}
if ($Status) { return }

# ---- probe each affected lane ---------------------------------------------------------------
$lanes = ($pending | ForEach-Object { $_.Record.agent } | Sort-Object -Unique)
$available = @{}
foreach ($lane in $lanes) {
    $spec = $config.agents.$lane
    Write-Host ''
    Write-Host "Probing '$lane' quota via $($spec.cli)..." -ForegroundColor Cyan
    if ($DryRun) { Write-Host '  DRY RUN: probe skipped'; $available[$lane] = $false; continue }

    $probeInv = Build-Invocation -Spec $spec -Config $config -Model $spec.models.tier_utility `
        -Effort 'low' -Root $root -LastMessageFile ''
    $probe = Invoke-AgentRun -Invocation $probeInv `
        -Prompt 'Reply with the single word READY. Do not read or modify any file.' `
        -LogFile (Join-Path (Join-Path $root $config.dispatch_rules.log_dir) ("probe-$lane-" + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + '.log')) `
        -Header "quota probe for $lane" -TimeoutMinutes 5

    if (Test-QuotaExhausted -Text $probe.Output -Config $config -ExitCode $probe.ExitCode) {
        Write-Host "  still out of quota. Nothing resumed for '$lane'." -ForegroundColor Yellow
        Set-AgentQuotaState -Root $root -Config $config -Agent $lane -State 'exhausted'
        $available[$lane] = $false
    } elseif ($probe.ExitCode -ne 0) {
        Write-Host "  probe failed with exit $($probe.ExitCode). Not resuming; inspect the probe log." -ForegroundColor Red
        $available[$lane] = $false
    } else {
        Write-Host '  quota is back.' -ForegroundColor Green
        Set-AgentQuotaState -Root $root -Config $config -Agent $lane -State 'ok'
        $available[$lane] = $true
    }
}

# ---- gate 1 before resuming any real work ---------------------------------------------------
if (($available.Values | Where-Object { $_ }).Count -eq 0) { return }
Write-Host ''
Write-Host 'Gate 1: validating the contract...' -ForegroundColor Cyan
$gate1 = Invoke-Gate1 -Root $root
if (-not $gate1.Passed) {
    $gate1.Output | Write-Host
    throw 'Gate 1 failed. Not resuming any task.'
}
Write-Host "  $($gate1.Summary)" -ForegroundColor Green

# ---- resume ---------------------------------------------------------------------------------
$config = Get-AgentConfig -Root $root
foreach ($p in $pending) {
    $rec = $p.Record
    if (-not $available[$rec.agent]) { continue }

    $spec = $config.agents.($rec.agent)
    $session = $rec.session_id
    if (-not $session) { $session = 'LAST' }

    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    $paths = New-RunPaths -Root $root -Config $config -Stamp $stamp -Agent $rec.agent -TaskId $rec.task_id

    $continuation = @"
CONTINUE task $($rec.task_id). Your previous run on this task was cut short because the account ran
out of tokens; it was not cancelled and nothing about the task has changed.

Do this now:
1. Re-read your instruction file and re-check which files you had already written.
2. Work out what is still missing for the task's acceptance criteria.
3. Finish only the remaining work. Do not redo files that are already correct.
4. Re-run the verification commands from your instruction file and report their real output.
5. Report exactly which files you changed in this continuation.

The API contract in shared/contracts/ is unchanged and remains immutable.
"@

    Write-Host ''
    Write-Host "RESUME  task=$($rec.task_id)  agent=$($rec.agent)  session=$session  attempt=$([int]$rec.attempt + 1)" -ForegroundColor Yellow

    $inv = Build-Invocation -Spec $spec -Config $config -Model $spec.models.($rec.tier) `
        -Effort $rec.effort -Root $root -LastMessageFile $paths.LastMessage -SessionId $session

    if ($DryRun) {
        Write-Host "  DRY RUN: $($inv.Exe) $($inv.Args -join ' ')"
        continue
    }

    Write-RunRecord -Path $p.Path -Record @{
        status = 'resuming'; attempt = ([int]$rec.attempt + 1)
        resumed_at = (Get-Date).ToUniversalTime().ToString('o'); log = $paths.Log
    }

    $result = Invoke-AgentRun -Invocation $inv -Prompt $continuation -LogFile $paths.Log `
        -Header "RESUME task=$($rec.task_id) agent=$($rec.agent) session=$session" -TimeoutMinutes $TimeoutMinutes

    $sid = Get-SessionId -Text $result.Output
    if (-not $sid) { $sid = $rec.session_id }
    $quotaPattern = Test-QuotaExhausted -Text $result.Output -Config $config -ExitCode $result.ExitCode

    Complete-Run -Root $root -Config $config -Agent $rec.agent -RecordPath $p.Path `
        -Result $result -SessionId $sid -QuotaPattern $quotaPattern -TaskId $rec.task_id

    if ($quotaPattern) {
        Write-Host "  '$($rec.agent)' ran out again. Remaining tasks in this queue are left pending." -ForegroundColor Yellow
        $available[$rec.agent] = $false
    }
}
