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
4. For each artifact (req-spec.md, tech-spec.md, stories/index.md), check if it exists. If it does, read its `Version:` line. **If the file exists but has no `Version:` line (mid-write or malformed), report version as `?`.**
5. Check existence of: `<backend_src>/` (from state.src_paths.backend), `<frontend_src>/` (from state.src_paths.frontend), `docker-compose.yml` at workspace root.
6. Display:

```
═══════════════════════════════════════════
  Agentic SDLC — Run Status
═══════════════════════════════════════════
  Run ID:        <run-id>
  Branch:        <branch>
  Current stage: <current_stage>
  Spec frozen:   yes | no
  Backend src:   <src_paths.backend>
  Frontend src:  <src_paths.frontend>

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
  runs/<run-id>/raw-input.md    exists | missing
  runs/<run-id>/req-spec.md     exists (v<n>) | missing
  runs/<run-id>/tech-spec.md    exists (v<n>) | missing
  runs/<run-id>/stories/index.md  exists (v<n>) | missing
  <backend_src>/                exists | missing
  <frontend_src>/               exists | missing
  docker-compose.yml            exists | missing
═══════════════════════════════════════════
```

Status legend: pending | in_progress | complete | escalated | cancelled
