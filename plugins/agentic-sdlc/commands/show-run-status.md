---
description: Show the current status of the active Agentic SDLC run in a human-readable summary.
---

# /agentic-sdlc:show-run-status

You are the Agentic SDLC orchestrator.

## Your job
Read state.json and display a clear status summary.

## Process

1. First apply step 1b below (brownfield check). If there is no active brownfield
   change run, find the most recent `runs/<program-id>/program.json`. If neither a
   brownfield run nor a program exists: say "No programs found. Use
   /agentic-sdlc:start-run to begin."
1b. Before the program scan, check for a brownfield run: the most recent
    `runs/change-*/state.json` with `mode == "brownfield"`. If one exists and it is
    not superseded by a newer active program, render the **Brownfield status**
    layout below and stop.
2. Read program.json: `phase_plan`, `current_phase`, `phase_count`
   (`phase_plan.phase_count`), `phases`, `app_type` (default `web` if absent),
   `src_paths`.
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
5. Check existence of the archetype's code paths (by `app_type`, default `web`):
   - **web:** `<backend_src>/` (src_paths.backend), `<backend_test>/` (src_paths.backend_test; default `tests/backend` if absent), `<frontend_src>/` (src_paths.frontend), and `docker-compose.yml` at workspace root.
   - **electron:** the monorepo root `<electron_root>/` (src_paths.electron), `<electron_root>/apps/desktop/`, and `<electron_root>/electron-builder.yml`.
6. Display:

```
═══════════════════════════════════════════
  Agentic SDLC — Run Status
═══════════════════════════════════════════
  Run ID:        <program-id>/<phase-folder>
  Branch:        <branch>
  Current stage: <current_stage>
  Spec frozen:   yes | no
  App type:      <web | electron>
  <web archetype:>
  Backend src:   <src_paths.backend>
  Frontend src:  <src_paths.frontend>
  <electron archetype:>
  Electron root: <src_paths.electron>

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

  DEVELOPMENT PHASE            [<stages.development.status>]
  ─────────────────────────────────────────
  <for each story in state.stories, in wave then story-ID order. Append rework
   counters only when non-zero, e.g. "(rev 2, test 1, fix 1)" from
   reviewer_iterations / test_reviewer_iterations / fix_iterations:>
  STORY-001 [dotnet] [pending | in_progress | complete]
  STORY-002 [react]  [in_progress] (rev 2)   ◀ active

  FINAL PHASE  (web archetype)
  ─────────────────────────────────────────
  DevOps                   [<stages.devops.status>] iter: <n>
  FINAL PHASE  (electron archetype)
  ─────────────────────────────────────────
  Packager                 [<stages.packaging.status>] iter: <n>

  ARTIFACTS
  ─────────────────────────────────────────
  runs/<program-id>/<phase-folder>/raw-input.md    exists | missing
  runs/<program-id>/<phase-folder>/req-spec.md     exists (v<n>) | missing
  runs/<program-id>/<phase-folder>/tech-spec.md    exists (v<n>) | missing
  runs/<program-id>/<phase-folder>/stories/index.md  exists (v<n>) | missing
  <web archetype:>
  <backend_src>/                exists | missing
  <backend_test>/               exists | missing
  <frontend_src>/               exists | missing
  docker-compose.yml            exists | missing
  <electron archetype:>
  <electron_root>/apps/desktop/          exists | missing
  <electron_root>/electron-builder.yml   exists | missing
═══════════════════════════════════════════
```

Status legend: pending | in_progress | complete | escalated | skipped | cancelled

**Highlight anything that needs the user.** After rendering, scan every stage and story status:
- Append **` ◀ NEEDS ATTENTION`** to any line whose status is `escalated` (a 5-iteration cap
  was hit and the run is waiting on the user).
- Mark the line matching `current_stage` (and the single in-progress story) with **` ◀ active`**.
- If any stage is `escalated`, add a one-line banner under the header:
  `⚠ <stage> escalated after 5 iterations — provide guidance or /agentic-sdlc:cancel-run.`

An `escalated` or long-stalled `in_progress` stage is the signal that the run is not
progressing on its own — surface it, don't bury it in the ladder.

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
  App type:      <web | electron>
  Infra change:  required | not required
  <web archetype:>
  Backend src:   <src_paths.backend>
  Frontend src:  <src_paths.frontend>
  <electron archetype:>
  Electron root: <src_paths.electron>

  PIPELINE  (from state.pipeline, in order — electron runs end in `packaging`, web runs in `devops`)
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

Apply the same highlighting as the greenfield layout: `◀ NEEDS ATTENTION` on any `escalated`
stage/story, `◀ active` on the `current_stage` and in-progress story, and the `⚠ …escalated…`
banner under the header when any stage is escalated.
