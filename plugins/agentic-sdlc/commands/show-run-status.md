---
description: Show the current status of the active Agentic SDLC run in a human-readable summary.
---

# /agentic-sdlc:show-run-status

You are the Agentic SDLC orchestrator.

## Your job
Read state.json and display a clear status summary.

## Process

1. Find the most recent run in `runs/` (any status including complete).
2. If no runs exist: say "No runs found. Use /agentic-sdlc:start-run to begin."
3. Read `runs/<run-id>/state.json`.
4. For each artifact (req-spec.md, tech-spec.md, stories.md), check if it exists. If it does, read its `Version:` line.
5. Check existence of: `runs/<run-id>/dotnet/`, `runs/<run-id>/react/`, `runs/<run-id>/docker-compose.yml`.
6. Display:

```
═══════════════════════════════════════════
  Agentic SDLC — Run Status
═══════════════════════════════════════════
  Run ID:        <run-id>
  Current stage: <current_stage>
  Spec frozen:   yes | no

  PLANNING PHASE
  ─────────────────────────────────────────
  BA                       [<status>] iter: <n>
  BA Validation            [<status>] iter: <n>
  User Review (Req Spec)   [<status>]
  Architect                [<status>] iter: <n>
  Architect Validation     [<status>] iter: <n>
  User Review (Tech Spec)  [<status>]
  Tech Lead                [<status>] iter: <n>
  Tech Lead Validation     [<status>] iter: <n>
  User Review (Stories)    [<status>]

  DEVELOPMENT PHASE
  ─────────────────────────────────────────
  <for each story in state.stories:>
  STORY-001 [dotnet] [pending | in_progress | complete]
  STORY-002 [react]  [pending | in_progress | complete]

  DEVOPS PHASE
  ─────────────────────────────────────────
  DevOps                   [<status>]

  ARTIFACTS
  ─────────────────────────────────────────
  raw-input.md       exists | missing
  req-spec.md        exists (v<n>) | missing
  tech-spec.md       exists (v<n>) | missing
  stories.md         exists (v<n>) | missing
  dotnet/            exists | missing
  react/             exists | missing
  docker-compose.yml exists | missing
═══════════════════════════════════════════
```

Status legend: pending | in_progress | complete | escalated | cancelled
