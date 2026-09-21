# Handoff protocol for two agents without Git

Antigravity and Codex work in the same folder at different times or at the same time. There is no
version control, so these rules prevent lost work.

## Ownership

See `AGENTS.md` §3. Summary: **Codex = backend + platform config + capability matrix + runbook.
Antigravity = frontend + design + screenshots + browser/a11y review.** Shared docs and `tasks/`
are edited by both with a `STATUS.md` line.

## The contract file

`shared/contracts/api-spec.yaml` is the artifact that crosses the boundary, and it is **frozen at
v1.0.0 and owned by the orchestrator**. Neither coding agent edits it. The backend proves
conformance with `backend/tests/contract/`; the frontend imports `shared/contracts/types.ts`
directly. `backend/openapi.json` is an output of the backend used only by the parity test.

An agent that believes the contract is wrong stops and writes a `BLOCKED` line in `STATUS.md`. The
orchestrator decides, edits the YAML and `types.ts` together, re-runs Gate 1, and writes
`CONTRACT <version> — <what changed>`. Additive changes only inside v1.

## Claiming work

A task belongs to whoever set `Status: in_progress` first in `TASK-BOARD.md`. If both agents
appear on the same task, the later one yields and picks another. Never edit a file in the other
agent's ownership area while their task on it is `in_progress`.

## Status log format (`tasks/STATUS.md`)

```
YYYY-MM-DD HH:MM <agent> START|DONE|BLOCKED|CONTRACT|NOTE <TASK-ID or —> — one line
```

Newest at the bottom. Never rewrite past lines.

## Session start checklist (both agents)

1. Read the last 30 lines of `STATUS.md`.
2. Look for `BLOCKED` lines addressed to you and `CONTRACT` lines newer than your last session.
3. Run the check script for your area to confirm the tree is green before changing anything. If it
   is red because of the other agent's area, log `NOTE` and continue in your own area.

## Session end checklist

1. No task left `in_progress` without a `NOTE` describing exact partial state and next step.
2. Checks green for your area, or the failure pasted into `STATUS.md`.
3. Screenshots and test outputs saved to their folders.

## Blockers

Write the blocker as a question the other agent or the user can answer in one line, e.g.
`BLOCKED P2-01 — need backend to expose tag `source` field (governed|free_form|system) on /assets/{…}/tags`.
Then take the next unblocked task; do not idle.

## Things neither agent does

Git, deploy, live Databricks calls, resource creation, editing `..\governance-app\`, installing
global tools, translating identifiers, marking untested capabilities as implemented.
