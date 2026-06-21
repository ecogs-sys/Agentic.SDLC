---
description: Show the current status of the active Agentic SDLC run in a human-readable summary.
---

# /agentic-sdlc:show-run-status

You are the Agentic SDLC orchestrator.

## Your job
Read state.json and display a clear status summary.

## Process

1. Find the most recent `runs/<program-id>/program.json`. If none: say "No
   programs found. Use /agentic-sdlc:start-run to begin."
1b. Before the program scan, check for a brownfield run: the most recent
    `runs/change-*/state.json` with `mode == "brownfield"`. If one exists and it is
    not superseded by a newer active program, render the **Brownfield status**
    layout below and stop.
2. Read program.json: `phase_plan`, `current_phase`, `phase_count`
   (`phase_plan.phase_count`), `phases`, `src_paths`.
3. If `phases` is empty OR `current_phase == 0`, the program is still in the Phase
   Planner stage — no phase has been finalized. Skip the per-phase detail (steps 4–5
   and the PLANNING/DEVELOPMENT/DEVOPS/ARTIFACTS blocks); show the header, the
   `Phase plan` line, and a PHASE LADDER reading "Phase planning in progress (no
   phases finalized yet)". Otherwise, the active phase is the `phases[]` entry whose
   `phase` field equals `current_phase`; its run dir is
   `runs/<program-id>/<phase-folder>/` and its state.json drives the per-stage
   detail below.
4. For each artifact (req-spec.md, tech-spec.md, stories/index.md) **under the
   active phase dir**, check existence and read its `Version:` line. If the file
   exists but has no `Version:` line, report version as `?`.
5. Check existence of: `<backend_src>/` (from src_paths.backend), `<backend_test>/` (from src_paths.backend_test; default `tests/backend` if absent), `<frontend_src>/` (from src_paths.frontend), `docker-compose.yml` at workspace root.
6. Display:

```
═══════════════════════════════════════════
  Agentic SDLC — Run Status
═══════════════════════════════════════════
  Run ID:        <program-id>/<phase-folder>
  Branch:        <branch>
  Current stage: <current_stage>
  Spec frozen:   yes | no
  Backend src:   <src_paths.backend>
  Frontend src:  <src_paths.frontend>

  Program:       <program-id>
  Phase plan:    <phase_plan.status> (<phase_count> phase(s))

  PHASE LADDER
  ─────────────────────────────────────────
  <for each entry in program.json phases; or "Phase planning in progress
   (no phases finalized yet)" if phases is empty:>
  Phase 1 [phase-01] <title>   [pending | in_progress | complete]
  Phase 2 [phase-02] <title>   [in_progress]  ◀ active

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
  runs/<program-id>/<phase-folder>/raw-input.md    exists | missing
  runs/<program-id>/<phase-folder>/req-spec.md     exists (v<n>) | missing
  runs/<program-id>/<phase-folder>/tech-spec.md    exists (v<n>) | missing
  runs/<program-id>/<phase-folder>/stories/index.md  exists (v<n>) | missing
  <backend_src>/                exists | missing
  <backend_test>/               exists | missing
  <frontend_src>/               exists | missing
  docker-compose.yml            exists | missing
═══════════════════════════════════════════
```

Status legend: pending | in_progress | complete | escalated | cancelled

## Brownfield status layout

```
═══════════════════════════════════════════
  Agentic SDLC — Brownfield Change Status
═══════════════════════════════════════════
  Run ID:        <run-id>
  Mode:          brownfield
  Tier:          <tier>
  Branch:        <branch>
  Current stage: <current_stage>
  Spec frozen:   yes | no
  Infra change:  required | not required
  Backend src:   <src_paths.backend>
  Frontend src:  <src_paths.frontend>

  PIPELINE  (from state.pipeline, in order)
  ─────────────────────────────────────────
  <for each stage in pipeline: "<stage>  [<stages[stage].status or '-'>]"; mark ◀ active at current_stage>

  DEVELOPMENT  (if state.stories non-empty)
  ─────────────────────────────────────────
  <STORY-XXX [track] [status] per story>

  ARTIFACTS
  ─────────────────────────────────────────
  runs/<run-id>/raw-input.md           exists | missing
  runs/<run-id>/codebase-context.md    exists (v<n>) | missing
  runs/<run-id>/change-spec.md         exists (v<n>) | n/a (tier)
  runs/<run-id>/req-spec.md            exists (v<n>) | n/a (tier)
  runs/<run-id>/tech-spec.md           exists (v<n>) | n/a (tier)
  runs/<run-id>/stories/index.md       exists (v<n>) | n/a (tier)
═══════════════════════════════════════════
```

Status legend: pending | in_progress | complete | skipped | escalated | cancelled
