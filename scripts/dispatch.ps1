<#
.SYNOPSIS
    Dispatch one scoped task to a CLI coding agent, with quota-aware deferral and resume support.

.DESCRIPTION
    Reads .ai/agents.json. Runs Gate 1 (contract validation) first and refuses to dispatch if it
    fails. Writes a durable run record to .ai/state/runs/<TaskId>.json and a transcript to
    .ai/logs/.

    Quota handling: if the agent's output matches a quota signature from agents.json, the run is
    recorded as `quota_exhausted` (NOT failed), the agent's quota state is flipped in
    agents.json, the session id is saved, and the script exits 75 (EX_TEMPFAIL). Run
    scripts/resume.ps1 later to continue the same session from where it stopped.

.EXAMPLE
    ./scripts/dispatch.ps1 -Agent backend -Tier tier_reasoning -TaskId P0-03 -PromptFile .ai/prompts/P0-03.md

.EXAMPLE
    ./scripts/dispatch.ps1 -Agent frontend -Tier tier_standard -TaskId P0-04 -PromptFile .ai/prompts/P0-04.md -DryRun
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet('backend', 'frontend')][string]$Agent,
    [Parameter(Mandatory = $true)][ValidateSet('tier_reasoning', 'tier_standard', 'tier_utility')][string]$Tier,
    [Parameter(Mandatory = $true)][string]$TaskId,
    [string]$Prompt,
    [string]$PromptFile,
    [ValidateSet('low', 'medium', 'high')][string]$Effort,
    [int]$TimeoutMinutes = 45,
    [switch]$DryRun,
    [switch]$SkipGate1,
    # Continue the task's existing agent session instead of starting a new one. Use this to send a
    # gate rejection back to the agent that wrote the code, so it keeps the context of its own work.
    [switch]$Continue
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'lib/agentlib.ps1')

$config = Get-AgentConfig -Root $root
$spec = $config.agents.$Agent
if ($null -eq $spec) { throw "Unknown agent '$Agent' in .ai/agents.json" }

# ---- gate: agent must be installed, configured, and not out of quota -----------------------
if ($spec.status -ne 'READY') {
    Write-Host "BLOCKED: agent '$Agent' has status '$($spec.status)'." -ForegroundColor Red
    Write-Host "  CLI expected : $($spec.cli)"
    if ($spec.install_hint) { Write-Host "  Reason       : $($spec.install_hint)" }
    throw "Refusing to dispatch to an agent that is not READY."
}
if ($spec.quota.state -eq 'exhausted') {
    Write-Host "DEFERRED: agent '$Agent' is marked out of quota since $($spec.quota.exhausted_at)." -ForegroundColor Yellow
    Write-Host "  Run ./scripts/resume.ps1 -Agent $Agent   to probe and continue pending work." -ForegroundColor Yellow
    exit 75
}

$cli = Get-Command $spec.cli -ErrorAction SilentlyContinue
if ($null -eq $cli) { throw "Agent '$Agent' is READY but '$($spec.cli)' is not on PATH. Update .ai/agents.json." }

$model = $spec.models.$Tier
if ([string]::IsNullOrWhiteSpace($model)) { throw "No model bound for tier '$Tier' on agent '$Agent'." }

# Keep this out of the $Effort parameter: it carries a ValidateSet, and assigning a missing value
# back into it throws. Some lanes (agy) encode effort in the model id and define no effort_values.
$effortValue = $Effort
if (-not $effortValue -and $spec.effort_values) { $effortValue = $spec.effort_values.$Tier }
if (-not $effortValue) { $effortValue = 'medium' }

# ---- gate 1: contract must be valid ---------------------------------------------------------
if (-not $SkipGate1) {
    Write-Host 'Gate 1: validating the contract...' -ForegroundColor Cyan
    $gate1 = Invoke-Gate1 -Root $root
    if (-not $gate1.Passed) {
        $gate1.Output | Write-Host
        throw 'Gate 1 failed. The contract is invalid; no dispatch is allowed.'
    }
    Write-Host "  $($gate1.Summary)" -ForegroundColor Green
}

# ---- prompt ---------------------------------------------------------------------------------
if ($PromptFile) {
    $resolved = Resolve-UnderRoot -Root $root -PathValue $PromptFile
    if (-not (Test-Path $resolved)) { throw "Prompt file not found: $resolved" }
    $Prompt = Get-Content $resolved -Raw
}
if ([string]::IsNullOrWhiteSpace($Prompt)) { throw 'Provide -Prompt or -PromptFile.' }

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$paths = New-RunPaths -Root $root -Config $config -Stamp $stamp -Agent $Agent -TaskId $TaskId

Write-Host ''
Write-Host "DISPATCH  task=$TaskId  agent=$Agent  cli=$($spec.cli)  tier=$Tier  model=$model  effort=$effortValue" -ForegroundColor Yellow
Write-Host "  scope   : $($spec.owns -join ', ')"
Write-Host "  log     : $($paths.Log)"
Write-Host "  record  : $($paths.Record)"

$sessionToResume = $null
if ($Continue) {
    $prior = Read-RunRecord -Path $paths.Record
    if ($null -eq $prior) { throw "-Continue was requested but there is no run record at $($paths.Record)." }
    $sessionToResume = $prior.session_id
    if (-not $sessionToResume) { $sessionToResume = 'LAST' }
    Write-Host "  continue: session $sessionToResume (attempt $([int]$prior.attempt + 1))" -ForegroundColor Cyan
}

$invocation = Build-Invocation -Spec $spec -Config $config -Model $model -Effort $effortValue `
    -Root $root -LastMessageFile $paths.LastMessage -SessionId $sessionToResume

if ($DryRun) {
    Write-Host ''
    Write-Host '--- DRY RUN, nothing executed ---' -ForegroundColor DarkYellow
    Write-Host "$($invocation.Exe) $($invocation.Args -join ' ')"
    if ($invocation.PromptMode -eq 'stdin') { Write-Host "  <prompt of $($Prompt.Length) chars piped on stdin>" }
    else { Write-Host "  $($spec.prompt_flag) <prompt of $($Prompt.Length) chars>" }
    return
}

$attemptNo = 1
$priorSession = $null
if ($Continue) {
    $prior = Read-RunRecord -Path $paths.Record
    if ($prior) {
        if ($prior.attempt) { $attemptNo = [int]$prior.attempt + 1 }
        $priorSession = $prior.session_id
    }
}
Write-RunRecord -Path $paths.Record -Record @{
    task_id = $TaskId; agent = $Agent; tier = $Tier; model = $model; effort = $effortValue
    status = 'dispatched'; attempt = $attemptNo; prompt_file = $PromptFile; prompt_chars = $Prompt.Length
    started_at = (Get-Date).ToUniversalTime().ToString('o'); log = $paths.Log; session_id = $priorSession
}

$result = Invoke-AgentRun -Invocation $invocation -Prompt $Prompt -LogFile $paths.Log `
    -Header "task=$TaskId agent=$Agent cli=$($spec.cli) tier=$Tier model=$model effort=$effortValue stamp=$stamp" `
    -TimeoutMinutes $TimeoutMinutes

$sessionId = Get-SessionId -Text $result.Output
$quotaPattern = Test-QuotaExhausted -Text $result.Output -Config $config -ExitCode $result.ExitCode

Complete-Run -Root $root -Config $config -Agent $Agent -RecordPath $paths.Record `
    -Result $result -SessionId $sessionId -QuotaPattern $quotaPattern -TaskId $TaskId

if ($quotaPattern) { exit 75 }
exit $result.ExitCode
