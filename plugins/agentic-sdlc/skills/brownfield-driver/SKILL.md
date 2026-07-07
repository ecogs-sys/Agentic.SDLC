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
| `change_spec` / `change_spec_validation` / `user_review_change_spec` | Change-spec handler (below) |
| `ba` / `ba_validation` / `user_review_req` | `agentic-sdlc:stage-ba` skill |
| `architect` / `architect_validation` / `user_review_tech` | `agentic-sdlc:stage-architect` skill |
| `tech_lead` / `tech_lead_validation` / `user_review_stories` | `agentic-sdlc:stage-tech-lead` skill |
| `development` | `agentic-sdlc:stage-development` skill |
| `devops` (web) / `packaging` (electron) | `agentic-sdlc:stage-devops` / `stage-packaging` skill, gated by `infra_change_required` |

## Change-spec handler (small_change tier)

The `agentic-sdlc:validation-loop` protocol with:

| Parameter | Value |
|---|---|
| CREATOR / VALIDATOR | `ba` (following the **write-change-spec** skill) / `ba-validator` |
| ARTIFACT | `runs/<run-id>/change-spec.md` |
| INPUTS | `runs/<run-id>/raw-input.md`, `runs/<run-id>/codebase-context.md`, `mode = brownfield` |
| STAGE / VALIDATION_STAGE | `change_spec` / `change_spec_validation` |
| MSG | `change-spec` |

The validator compares request+impact-map → change-spec per the
validate-traceability schema. **user_review_change_spec gate:** apply the gate
convention on **`runs/<run-id>/change-spec.md`**; "approve" → mark complete,
advance the pipeline; other → revision notes, re-run the loop.

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
  - **small_change** → `change-spec.md` + `codebase-context.md` (no tech-spec.md).
  - **bug_fix** → the synthesized story + `codebase-context.md` (no req/tech/change spec).
- **ba / architect / tech_lead:** pass `codebase-context.md` and `mode =
  brownfield`. The BA writes a normal `req-spec.md` (new_feature tier only). After
  the **architect** stage (new_feature tier), the tech-spec's `**Infra change:**`
  line sets `state.infra_change_required` — it overrides the surveyor's assessment.
- **tech_lead stories gate (small_change + new_feature):** on approve, set
  `spec_frozen = true` and populate `state.stories` exactly as greenfield.
- **development:** stories may already exist (bug_fix synthesized them at triage);
  engineers edit in place (no scaffold); the test reviewer always runs the FULL
  existing suite (`full_suite = true`) and compares to `test_baseline` — only NEW
  failures fail the gate; pre-existing failures are reported, not fixed.
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
