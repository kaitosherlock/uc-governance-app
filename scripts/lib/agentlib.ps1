# Shared helpers for dispatch.ps1 and resume.ps1.
# Windows PowerShell 5.1 compatible: no ternary, no ??, no &&.

function Get-AgentConfig {
    param([Parameter(Mandatory = $true)][string]$Root)
    $path = Join-Path $Root '.ai/agents.json'
    if (-not (Test-Path $path)) { throw "Missing agent configuration: $path" }
    return (Get-Content $path -Raw | ConvertFrom-Json)
}

function Write-Utf8NoBom {
    # Windows PowerShell 5.1's -Encoding utf8 emits a byte-order mark, which makes the file
    # unreadable to strict JSON parsers such as Python's json.load. Write JSON without one.
    param([string]$Path, [string]$Content)
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Save-AgentConfig {
    param([string]$Root, $Config)
    $path = Join-Path $Root '.ai/agents.json'
    Write-Utf8NoBom -Path $path -Content ($Config | ConvertTo-Json -Depth 12)
}

function Resolve-UnderRoot {
    param([string]$Root, [string]$PathValue)
    if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
    return (Join-Path $Root $PathValue)
}

function Invoke-Gate1 {
    # --no-project matters: the project's own pyproject.toml pins requires-python to 3.11, and uv
    # would then try to use a managed 3.11 interpreter that is not installed. The contract
    # validator is orchestrator tooling and must not depend on the application's Python pin.
    # The stderr guard matters for the same reason as in Invoke-AgentRun: under
    # $ErrorActionPreference = 'Stop', a native command's stderr becomes a terminating error.
    param([string]$Root)
    $script = Join-Path $Root 'scripts/validate_contracts.py'
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & uv run --no-project --quiet --with pyyaml --with jsonschema python $script 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    $text = ($out | Out-String)
    $passed = ($code -eq 0) -and ($text -match '(?m)^OK: \d+ checks passed')
    $summary = ''
    if ($out) { $summary = ($out | Where-Object { $_ -match '^(OK|FAILED)' } | Select-Object -Last 1) }
    if (-not $summary) { $summary = ($out | Select-Object -Last 1) }
    return [pscustomobject]@{ Passed = $passed; Output = $out; Summary = $summary }
}

function New-RunPaths {
    param([string]$Root, $Config, [string]$Stamp, [string]$Agent, [string]$TaskId)
    $logDir = Join-Path $Root $Config.dispatch_rules.log_dir
    $runDir = Join-Path (Join-Path $Root $Config.dispatch_rules.state_dir) 'runs'
    foreach ($d in @($logDir, $runDir)) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }
    return [pscustomobject]@{
        Log         = Join-Path $logDir "$Stamp-$Agent-$TaskId.log"
        Record      = Join-Path $runDir "$TaskId.json"
        LastMessage = Join-Path $logDir "$Stamp-$Agent-$TaskId.last.txt"
    }
}

function Write-RunRecord {
    param([string]$Path, [hashtable]$Record)
    $existing = @{}
    if (Test-Path $Path) {
        $obj = Get-Content $Path -Raw | ConvertFrom-Json
        foreach ($p in $obj.PSObject.Properties) { $existing[$p.Name] = $p.Value }
    }
    foreach ($k in $Record.Keys) { $existing[$k] = $Record[$k] }
    if ($existing.ContainsKey('history') -and $existing['history']) {
        $hist = @($existing['history'])
    } else {
        $hist = @()
    }
    $hist += ("{0} {1}" -f (Get-Date).ToUniversalTime().ToString('o'), $existing['status'])
    $existing['history'] = $hist
    Write-Utf8NoBom -Path $Path -Content ([pscustomobject]$existing | ConvertTo-Json -Depth 8)
}

function Read-RunRecord {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    return (Get-Content $Path -Raw | ConvertFrom-Json)
}

function Build-Invocation {
    param($Spec, $Config, [string]$Model, [string]$Effort, [string]$Root,
          [string]$LastMessageFile, [string]$SessionId)

    if ($SessionId) {
        $template = $Spec.session_resume_template
        if ([string]::IsNullOrWhiteSpace($template)) { throw "Agent has no session_resume_template." }
        if ($SessionId -eq 'LAST') {
            # Replace the id placeholder with the agent's own "most recent session" flag.
            $template = $template.Replace('{session}', $Spec.session_resume_last_flag)
        } else {
            $template = $template.Replace('{session}', $SessionId)
        }
    } else {
        $template = $Spec.command_template
        if ([string]::IsNullOrWhiteSpace($template)) { throw "Agent has no command_template." }
    }

    # `{lastmsg}` is a FLAG VALUE in the templates (`--output-last-message {lastmsg}`). Rendering it
    # as an empty string leaves the flag dangling and codex exits 2 with "a value is required".
    # Callers that do not care about the last message (the quota probe) get a throwaway temp path.
    if ([string]::IsNullOrWhiteSpace($LastMessageFile)) {
        $LastMessageFile = Join-Path ([System.IO.Path]::GetTempPath()) ("agentrun-lastmsg-" + [guid]::NewGuid().ToString('N') + ".txt")
    }
    $lastMsg = $LastMessageFile
    $rendered = $template.Replace('{model}', $Model).Replace('{effort}', $Effort).Replace('{root}', $Root).Replace('{lastmsg}', $lastMsg)

    # Split on whitespace, but keep a quoted segment glued to whatever it is attached to, so
    # `--config key="value"` stays one token instead of splitting at the `=`. Surrounding quotes
    # are then stripped because the argument is passed directly, not through a shell.
    $parts = [System.Text.RegularExpressions.Regex]::Matches($rendered, '(?:"[^"]*"|[^\s"])+') |
             ForEach-Object { $_.Value.Replace('"', '') }
    $exe = $parts[0]
    $argv = @()
    if ($parts.Length -gt 1) { $argv = @($parts[1..($parts.Length - 1)]) }

    foreach ($forbidden in $Config.dispatch_rules.forbidden_flags) {
        if ($argv -contains $forbidden) {
            throw "Forbidden flag '$forbidden' in command template: $($Config.dispatch_rules.forbidden_flags_reason)"
        }
    }

    $mode = $Spec.prompt_mode
    if (-not $mode) { $mode = 'flag' }
    return [pscustomobject]@{
        Exe = $exe; Args = $argv; PromptMode = $mode; PromptFlag = $Spec.prompt_flag
        LastMessageFile = $LastMessageFile
    }
}

function Invoke-AgentRun {
    param($Invocation, [string]$Prompt, [string]$LogFile, [string]$Header, [int]$TimeoutMinutes)

    $header = @"
=== AGENT RUN $((Get-Date).ToUniversalTime().ToString('o')) ===
$Header
command: $($Invocation.Exe) $($Invocation.Args -join ' ')
--- PROMPT ---
$Prompt
--- OUTPUT ---
"@
    Set-Content -Path $LogFile -Value $header -Encoding utf8

    $argv = @($Invocation.Args)
    $promptPath = $null
    if ($Invocation.PromptMode -eq 'flag') {
        # Separate flag and value, e.g. --prompt "text".
        $argv += @($Invocation.PromptFlag, $Prompt)
    } elseif ($Invocation.PromptMode -eq 'flag_attached') {
        # Value glued to the flag as one argument, e.g. --print=text. Required by agy, whose
        # --print otherwise consumes the following flag as its prompt.
        $argv += @("$($Invocation.PromptFlag)$Prompt")
    } elseif ($Invocation.PromptMode -eq 'file_pointer') {
        # Windows PowerShell 5.1 re-splits a long multi-line native argument on whitespace, so a
        # prompt passed on the command line loses its shape and any token that looks like a flag,
        # for example --noEmit, is handed to the CLI as a flag. Avoid the command line entirely:
        # write the prompt to a file and pass a single whitespace-free pointer token.
        $promptPath = [System.IO.Path]::Combine(
            [System.IO.Path]::GetDirectoryName($LogFile),
            [System.IO.Path]::GetFileNameWithoutExtension($LogFile) + '.prompt.md')
        Write-Utf8NoBom -Path $promptPath -Content $Prompt
        $argv += @("$($Invocation.PromptFlag)READ-THIS-FILE-AND-FOLLOW-IT-EXACTLY:$promptPath")
        $promptPath = $null   # not stdin, so do not pipe it
    } else {
        $promptPath = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $promptPath -Value $Prompt -Encoding utf8
    }

    # Run in a background job for two reasons. First, a real timeout: a hung agent must not hang
    # the orchestrator. Second, isolation of $ErrorActionPreference: these CLIs write progress to
    # stderr, and in Windows PowerShell 5.1 a native command's stderr under
    # $ErrorActionPreference = 'Stop' becomes a terminating NativeCommandError even when the exe
    # succeeds. The job sets 'Continue' so stderr is captured as text instead of killing the run.
    $started = Get-Date
    $timedOut = $false
    $text = ''
    $exit = -1

    $job = Start-Job -ScriptBlock {
        param($exe, $argv, $promptPath, $cwd)
        $ErrorActionPreference = 'Continue'
        Set-Location $cwd
        if ($promptPath) {
            $captured = Get-Content $promptPath -Raw | & $exe @argv 2>&1
        } else {
            $captured = & $exe @argv 2>&1
        }
        [pscustomobject]@{ Text = ($captured | Out-String); Exit = $LASTEXITCODE }
    } -ArgumentList $Invocation.Exe, $argv, $promptPath, (Get-Location).Path

    $seconds = [Math]::Max(60, $TimeoutMinutes * 60)
    if (Wait-Job -Job $job -Timeout $seconds) {
        $payload = Receive-Job -Job $job
        if ($payload) {
            $text = $payload.Text
            if ($null -ne $payload.Exit) { $exit = [int]$payload.Exit }
        }
    } else {
        $timedOut = $true
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        $partial = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($partial) { $text = ($partial | Out-String) }
        $text = "ORCHESTRATOR: killed after $TimeoutMinutes minute(s) without completing.`n" + $text
        $exit = 124
    }
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    if ($promptPath -and (Test-Path $promptPath)) { Remove-Item $promptPath -Force }

    Add-Content -Path $LogFile -Value $text -Encoding utf8

    $lastMsg = ''
    if ($Invocation.LastMessageFile -and (Test-Path $Invocation.LastMessageFile)) {
        $lastMsg = Get-Content $Invocation.LastMessageFile -Raw
        Add-Content -Path $LogFile -Value "--- LAST MESSAGE ---`n$lastMsg" -Encoding utf8
    }
    Add-Content -Path $LogFile -Value "--- EXIT $exit ---" -Encoding utf8

    return [pscustomobject]@{
        Output      = $text
        LastMessage = $lastMsg
        ExitCode    = $exit
        TimedOut    = $timedOut
        Seconds     = [int]((Get-Date) - $started).TotalSeconds
    }
}

function Test-QuotaExhausted {
    # Returns the matched pattern (truthy) or $null.
    #
    # Three things had to be learned the hard way, all on 2026-09-22, and all of them are load
    # bearing. Do not simplify this function without re-reading them.
    #
    # 1. A run that exited 0 delivered its work, so a quota-looking word in successful output is a
    #    false positive. This project implements a RATE_LIMITED error code and tests HTTP 429, so
    #    its own source legitimately contains the vocabulary.
    #
    # 2. agy can report a quota failure in its JSON result while still exiting 0. Trusting the exit
    #    code alone produced a FALSE NEGATIVE: the task was recorded as completed and the unfinished
    #    work would have been silently dropped instead of resumed. So an explicit failure status in
    #    the agent's own structured output overrides exit 0.
    #
    # 3. But those structured markers are agy's, and applying them to every lane produced a FALSE
    #    POSITIVE: a codex run read tasks/STATUS.md, whose log entries describe earlier quota
    #    events and mention AGY_ERROR, the marker matched somewhere in the middle of the
    #    transcript, the exit-0 guard was bypassed, and a completed task on a healthy lane was
    #    parked as deferred. The markers are therefore scoped to the lane that emits them, and the
    #    pattern scan is limited to the TAIL of the output, because a real exhaustion aborts the
    #    run and says so at the end, while a file the agent merely read appears in the middle.
    param(
        [string]$Text,
        $Config,
        [int]$ExitCode = 1,
        # The lane's CLI, e.g. 'agy' or 'codex'. Structured failure markers are only honoured for
        # the CLI that actually emits them.
        [string]$Cli = ''
    )
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }

    $declaresFailure = $false
    if ($Cli -eq 'agy') {
        $declaresFailure = ($Text -match '"status"\s*:\s*"(ERROR|RESOURCE_EXHAUSTED|FAILED)"') -or
                           ($Text -match 'AGY_ERROR')
    }
    if ($Config.quota_detection.require_nonzero_exit -and $ExitCode -eq 0 -and -not $declaresFailure) {
        return $null
    }

    # Only the tail. An aborted run's reason is the last thing printed; project files the agent read
    # are not.
    $tailChars = 4000
    $tail = if ($Text.Length -gt $tailChars) { $Text.Substring($Text.Length - $tailChars) } else { $Text }

    foreach ($pattern in $Config.quota_detection.patterns) {
        if ($tail -imatch $pattern) { return $pattern }
    }
    return $null
}

function Get-SessionId {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    # codex prints `session id: <uuid>`; agy labels its conversation id similarly. Prefer a
    # labelled id, then fall back to the first bare UUID in the output.
    $uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
    $labelled = [regex]"(?im)(?:session|thread|conversation)[ _-]*(?:id)?[\s:=`"',]*($uuid)"
    $m = $labelled.Match($Text)
    if ($m.Success) { return $m.Groups[1].Value }
    $bare = [regex]$uuid
    $m2 = $bare.Match($Text)
    if ($m2.Success) { return $m2.Value }
    return $null
}

function Set-AgentQuotaState {
    # Read-modify-write against the file on disk, not against the caller's snapshot. Two lanes can
    # run concurrently, and writing a whole stale snapshot back silently reverted unrelated edits
    # made while a dispatch was in flight. Only the quota fields are touched here.
    param([string]$Root, $Config, [string]$Agent, [string]$State)
    $fresh = Get-AgentConfig -Root $Root
    $fresh.agents.$Agent.quota.state = $State
    if ($State -eq 'exhausted') {
        $fresh.agents.$Agent.quota.exhausted_at = (Get-Date).ToUniversalTime().ToString('o')
    } else {
        $fresh.agents.$Agent.quota.last_ok_at = (Get-Date).ToUniversalTime().ToString('o')
        $fresh.agents.$Agent.quota.exhausted_at = $null
    }
    Save-AgentConfig -Root $Root -Config $fresh
}

function Complete-Run {
    param([string]$Root, $Config, [string]$Agent, [string]$RecordPath, $Result,
          [string]$SessionId, [string]$QuotaPattern, [string]$TaskId)

    $QuotaHit = -not [string]::IsNullOrEmpty($QuotaPattern)
    $status = 'completed'
    if ($QuotaHit) { $status = 'quota_exhausted' }
    elseif ($Result.TimedOut) { $status = 'timeout' }
    elseif ($Result.ExitCode -ne 0) { $status = 'failed' }

    $prev = Read-RunRecord -Path $RecordPath
    $attempt = 1
    if ($prev -and $prev.attempt) { $attempt = [int]$prev.attempt }
    $keepSession = $SessionId
    if (-not $keepSession -and $prev) { $keepSession = $prev.session_id }

    Write-RunRecord -Path $RecordPath -Record @{
        status = $status; exit_code = $Result.ExitCode; seconds = $Result.Seconds
        session_id = $keepSession; attempt = $attempt
        finished_at = (Get-Date).ToUniversalTime().ToString('o')
        quota_pattern = $QuotaPattern
        last_message_excerpt = (Get-Excerpt -Text $Result.LastMessage)
    }

    Write-Host ''
    if ($QuotaHit) {
        Set-AgentQuotaState -Root $Root -Config $Config -Agent $Agent -State 'exhausted'
        Write-Host "QUOTA EXHAUSTED on agent '$Agent'. Task $TaskId is DEFERRED, not failed." -ForegroundColor Yellow
        Write-Host "  matched : $QuotaPattern"
        $sessionShown = $keepSession
        if (-not $sessionShown) { $sessionShown = 'not captured; resume will continue the most recent session' }
        Write-Host "  session : $sessionShown"
        Write-Host "  resume  : ./scripts/resume.ps1 -Agent $Agent" -ForegroundColor Yellow
        Write-Host "  Do not mark $TaskId done or failed. Do not re-dispatch from scratch." -ForegroundColor Yellow
    } elseif ($Result.ExitCode -ne 0) {
        Set-AgentQuotaState -Root $Root -Config $Config -Agent $Agent -State 'ok'
        Write-Host "Agent exited with code $($Result.ExitCode) after $($Result.Seconds)s. Review the log before advancing the gate." -ForegroundColor Red
    } else {
        Set-AgentQuotaState -Root $Root -Config $Config -Agent $Agent -State 'ok'
        $gate = '3'
        if ($Agent -eq 'backend') { $gate = '2' }
        Write-Host "Agent finished in $($Result.Seconds)s. Next: Gate $gate checks, then the Gate 4 diff review." -ForegroundColor Green
    }
    Write-Host 'Remember to update .ai/HANDOVER.md and tasks/STATUS.md.'
}

function Get-Excerpt {
    param([string]$Text, [int]$Max = 1200)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    $t = $Text.Trim()
    if ($t.Length -le $Max) { return $t }
    return $t.Substring(0, $Max) + ' ...[truncated]'
}
