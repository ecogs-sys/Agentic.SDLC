---
name: brownfield-driver
description: Orchestrator driver for flat brownfield change runs (change-*) — drives the run by its tier pipeline array, reusing the greenfield stage skills with brownfield deltas. Loaded by /advance-stage when the active run has mode = brownfield.
---

# Brownfield driver (`change-*` runs)

Drive the run by its `pipeline` array instead of the fixed greenfield sequence.
(Brownfield **programs** — `program.json` with `mode: "brownfield"` — are NOT
driven here; they run the normal greenfield stage sequence with brownfield-aware
agents. See the dispatcher.)

1. Read `mode`, `tier`, `pipeline`, `current_stage`, `infra_change_required`,
   `app_type` (default `"web"`), `src_paths`, and `test_baseline` from state.json.
   For `app_type = electron`, `src_paths` has a single `electron` key (the monorepo
   root) — pass it to the electron agents as `electron_root`; the pipeline's final
   stage is `packaging` rather than `devops`.
2. Run the handler for `current_stage` (table below). Always pass `mode =
   brownfield`, the run-id, and the `runs/<run-id>/codebase-context.md` path to
   every agent so they follow the brownfield-mode skill.
3. On a stage's completion, set `current_stage` to the **next** `pipeline` entry
   (`SDLC set-field <run-dir>/state.json current_stage <next>`); commit. If the
   next entry is a `user_review_*` gate, run that gate (pause for the user) before
   continuing. If `current_stage` was the last entry, finalize (see **Completion**).
4. Reuse the greenfield stage skills for shared stages — same agents, commit
   discipline, 5-iteration caps, and escalation. Differences are listed below.

| pipeline stage | handler |
|---|---|
| `fix_plan` / `fix_plan_validation` / `user_review_fix_plan` | Fix-plan handler (below) |
| `ba` / `ba_validation` / `user_review_req` | `agentic-sdlc:stage-ba` skill |
| `architect` / `architect_validation` / `user_review_tech` | `agentic-sdlc:stage-architect` skill |
| `tech_lead` / `tech_lead_validation` / `user_review_stories` | `agentic-sdlc:stage-tech-lead` skill |
| `development` | `agentic-sdlc:stage-development` skill |
| `devops` (web) / `packaging` (electron) | `agentic-sdlc:stage-devops` / `stage-packaging` skill, gated by `infra_change_required` |

## Fix-plan handler (bug_fix + small_change tiers)

The `agentic-sdlc:validation-loop` protocol with:

| Parameter | Value |
|---|---|
| CREATOR / VALIDATOR | `fix-planner` (following the **write-fix-plan** skill) / `fix-plan-validator` |
| ARTIFACT | `runs/<run-id>/fix-plan.md` |
| INPUTS | `runs/<run-id>/raw-input.md`, `runs/<run-id>/codebase-context.md`, `mode = brownfield` |
| STAGE / VALIDATION_STAGE | `fix_plan` / `fix_plan_validation` |
| MSG | `fix-plan` |

The validator compares request+impact-map → fix-plan per the
validate-traceability schema (evidence citations, no assumptions, story
coverage — see the fix-plan-validator agent). **user_review_fix_plan gate:**
apply the gate convention on **`runs/<run-id>/fix-plan.md`**. On "approve":
set `spec_frozen = true`; write `runs/<run-id>/stories/STORY-00N.md` files
plus `index.md` from the plan's `## Stories` section (write-stories format);
populate `state.stories`; commit; advance the pipeline. Any other reply =
revision notes, re-run the loop.

## Notes for reused stage skills

- **The driver owns transitions and completion.** The greenfield stage skills end
  with greenfield tails — program.json updates, "proceed to Stage: X", phase
  announcements. IGNORE those tails: when a handler's work is done, return here,
  advance `current_stage` to the next `pipeline` entry, and at the end use
  **Completion** below. Change runs have no `program.json` — never read or write
  it; `parent_branch` comes from `state.json`.
- **Spec-input substitution.** Wherever a reused handler expects
  `runs/<run-id>/tech-spec.md`, substitute the spec the tier actually has:
  - **new_feature** → `tech-spec.md` exists (Architect ran) — use it.
  - **bug_fix / small_change** → `fix-plan.md` + `codebase-context.md` (no
    tech-spec.md).
- **ba / architect / tech_lead:** pass `codebase-context.md` and `mode =
  brownfield`. The BA writes a normal `req-spec.md` (new_feature tier only). After
  the **architect** stage (new_feature tier), the tech-spec's `**Infra change:**`
  line sets `state.infra_change_required` — it overrides the surveyor's assessment.
- **tech_lead stories gate (new_feature only):** on approve, set
  `spec_frozen = true` and populate `state.stories` exactly as greenfield.
  (bug_fix/small_change never reach `tech_lead` — their stories come from the
  fix-plan gate instead.)
- **development:** stories always exist by development time (fix-plan gate for
  bug_fix/small_change, tech_lead gate for new_feature); engineers edit in
  place (no scaffold); the test reviewer always runs the FULL existing suite
  (`full_suite = true`) and compares to `test_baseline` — only NEW failures
  fail the gate; pre-existing failures are reported, not fixed.
- **devops / packaging (conditional):** at the final pipeline entry, if
  `infra_change_required == false`, `SDLC set-stage <run-dir> <devops|packaging>
  skipped` and go to **Completion**. If `true`, run the stage skill's loop but
  instruct the engineer/packager to **modify existing** config in place; on the
  reviewer's `DONE`, skip the program.json/announcement tail — come here.

## Completion

When the last pipeline stage finishes:
```bash
SDLC set-field <run-dir>/state.json current_stage complete
SDLC commit-step --run <run-dir> "chore(<run-id>): change run complete"
```
Announce:
> "Brownfield change `<run-id>` (tier <tier>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. Open a PR from
> `agentic-sdlc/<run-id>` → `<parent_branch>`. The full existing test suite is green
> (no new failures vs the baseline) and new tests cover the change."

If there were pre-existing baseline failures, list them so the user knows they
predate this change.
