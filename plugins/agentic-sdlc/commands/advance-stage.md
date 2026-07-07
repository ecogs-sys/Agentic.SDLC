---
description: Advance the active Agentic SDLC run to its next stage. Reads state.json, loads the current stage's handler skill on demand, invokes the appropriate agent(s) with loops, and pauses at user-review gates.
---

# /agentic-sdlc:advance-stage

You are the Agentic SDLC orchestrator. This command is a **dispatcher**: find the
active run, then invoke the handler skill for its `current_stage` — do not load
stage handlers you are not about to run.

## Helper script

All state.json updates, iteration counters, commits, and progress logging go
through the helper (never hand-edit state.json or hand-write the git sequences):
```bash
SDLC() { node "${CLAUDE_PLUGIN_ROOT}/scripts/sdlc.mjs" "$@"; }
```
Below and in every stage skill, `SDLC <cmd> …` means that invocation and
`<run-dir>` means `runs/<run-id>` resolved to a real path. Every helper call also
appends to `<run-dir>/progress.log` — the run's live activity feed.

## Finding the active run

### Brownfield change runs
First check for an active brownfield run: any `runs/change-*/state.json` with
`mode == "brownfield"` and `current_stage != "complete"`. If one exists, it is the
active run — skip program discovery and invoke the **`agentic-sdlc:brownfield-driver`**
skill to drive it. (Concurrency is prevented by `/start-run`, so at most one
active run of either kind exists.)

### Programs
1. Scan `runs/` for the most recent `runs/<program-id>/program.json` (highest
   sequence) whose program is not fully delivered. A program is **fully delivered**
   when `phase_plan.status == "frozen"` AND `current_phase == phase_plan.phase_count`
   AND the `phases[]` entry at `current_phase` has `status: "complete"`.
2. Read `current_phase`; the active phase folder is the matching `phases[]` entry's
   `folder` (e.g. `phase-02`). The active run is `runs/<program-id>/<phase-folder>/`;
   its `state.json` drives this command. The composite `run_id` is
   `<program-id>/<phase-folder>`, so every `runs/<run-id>/…` path resolves to
   `runs/<program-id>/<phase-folder>/…`.

If no program is found: "No active program. Use /agentic-sdlc:start-run to begin."
If the active phase is already `complete`: "The current phase is complete. Use
/agentic-sdlc:next-phase to start the next phase, or open its PR to ship it."

**Brownfield programs** (`program.json` has `mode: "brownfield"`): found by the
normal program scan; their phases run the **greenfield** stage sequence below — NOT
the brownfield driver (that only handles `change-*` runs). Pass
`codebase-context.md` + `mode = brownfield` to every agent; in development the test
reviewer compares to `state.test_baseline`; the final stage (devops/packaging by
`app_type`) runs only if `state.infra_change_required == true`, else set it
`skipped` and do the normal program completion. The phase's tech-spec sets
`infra_change_required` (see the stage-architect skill).

## Reading app_type and src_paths

At the start of every invocation, read `app_type` (default `"web"` if absent) and
`src_paths` from state.json.
- **web:** `backend_src = src_paths.backend`, `backend_test = src_paths.backend_test`
  (default `tests/backend` if absent), `frontend_src = src_paths.frontend`. .NET
  test code lives under `backend_test` (never under `backend_src`); React tests are
  co-located inside `frontend_src`.
- **electron:** `src_paths.electron` is the monorepo root — pass it to electron
  agents as `electron_root`. The final stage is `packaging`, not `devops`.

## Dispatch table

Invoke exactly one handler skill for the run's `current_stage`:

| current_stage | handler skill |
|---|---|
| `ba` | `agentic-sdlc:stage-ba` |
| `architect` | `agentic-sdlc:stage-architect` |
| `tech_lead` | `agentic-sdlc:stage-tech-lead` |
| `development` | `agentic-sdlc:stage-development` |
| `devops` | `agentic-sdlc:stage-devops` |
| `packaging` | `agentic-sdlc:stage-packaging` |
| any brownfield `change-*` stage | `agentic-sdlc:brownfield-driver` |

When a stage completes and hands off to the next (e.g. req-spec approved →
architect), invoke the next stage's skill and continue in the same session — do
NOT tell the user to re-run a command.

## Shared disciplines (apply in every stage skill)

- **Spec freeze check.** Before invoking any agent: if `spec_frozen = true` and the
  stage would modify req-spec.md, tech-spec.md, or `runs/<run-id>/stories/` — stop:
  "The spec is frozen. To make upstream changes, use /agentic-sdlc:cancel-run and
  start a new run."
- **Status lifecycle.** Allowed values: `pending → in_progress → complete`, plus
  `escalated` / `skipped` / `cancelled`. Set `in_progress` via `SDLC set-stage`
  **before** invoking a stage's first agent (fold the write into that step's
  commit); set the terminal status on exit. Never leave a running stage at
  `pending` or a finished one at `in_progress`. If already `in_progress` (re-entry
  after a cross-loop reset), leave it.
- **Commit discipline.** Commit via `SDLC commit-step --run <run-dir> "<msg>"
  <paths…>` after every step that produces or updates files (state.json +
  progress.log are staged automatically). Conventional commits: `docs(<run-id>)`
  specs/planning, `feat(STORY-XXX)` production code, `test(STORY-XXX)` tests,
  `fix(STORY-XXX)` bug fixes, `chore` devops/config. Validator/reviewer outcomes do
  NOT get standalone commits — their state update ships with the next commit.
- **Test execution.** The suite is verified once per change, never concurrently:
  one story at a time through its full chain; engineers/reviewers build only; the
  test-reviewer owns the coverage run (scoped per story; full suite on the last
  story of each wave, on brownfield runs, and at the final devops/packaging gate);
  at most one build/test run in flight.
- **Progress visibility.** Print a one-line banner before (`▶`) and after
  (`✔`/`✖`) every agent invocation — stage position, story position, iteration
  (format in the stage skills). Print each skill's stage-entry summary when a stage
  begins. Put the run position in every Agent-tool `description` (e.g.
  `"STORY-003 engineer iter 2"`). At every 5-cap, emit the escalation block
  (validation-loop skill) so the user always knows the run is blocked on them.
- **User-review gates.** Follow the gate convention in the
  `agentic-sdlc:validation-loop` skill: always name the artifact path; full
  contents on first review, diff + validator notes on re-review.
