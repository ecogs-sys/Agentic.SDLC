---
name: stage-ba
description: Orchestrator handler for the BA stage on a flat brownfield change-run (bug_fix/small_change/non-split new_feature) — runs the BA → BA Validator loop and the requirement-spec user gate. Loaded by /advance-stage when current_stage = ba. Not used by program/phase runs — there, the BA runs once at the program level (see start-run.md Steps 7-8) and a mid-phase reopen is handled inline by the stage-architect skill, not this one.
---

# Stage: BA

Runs when `current_stage = "ba"` on a **flat brownfield `change-*` run** — the
`new_feature` (non-split) pipeline's BA stage. This never runs for a program/phase
run: there, the BA runs once at the program level before the Phase Planner (see
`start-run.md` Steps 7–8), and a mid-phase requirements fix is a reopen of that
program-level req-spec, handled inline by the `agentic-sdlc:stage-architect` skill.
Follow the `agentic-sdlc:validation-loop` protocol with:

| Parameter | Value |
|---|---|
| CREATOR / VALIDATOR | `ba` / `ba-validator` |
| ARTIFACT | `runs/<run-id>/req-spec.md` |
| INPUTS | `runs/<run-id>/raw-input.md` (+ `codebase-context.md` and `mode = brownfield` when brownfield) |
| STAGE / VALIDATION_STAGE | `ba` / `ba_validation` |
| MSG | `BA req-spec` |

**Stage-entry summary** (print on entry):
> **Stage <k>/<n> — BA.** Converting the raw requirement into `req-spec.md`
> (BA → validator loop, then your review gate). Remaining gates after this one:
> tech-spec → stories → (end of run).

## User review gate — req-spec

Apply the gate convention (validation-loop skill): name
**`runs/<run-id>/req-spec.md`**, show full contents (first review) or the diff +
validator notes (re-review).

> "The Business Analyst has produced the requirement spec (Version <n>). Reply
> **'approve'** to continue, or describe what to change."

- **approve:**
  ```bash
  SDLC set-stage <run-dir> user_review_req complete
  SDLC set-field <run-dir>/state.json current_stage architect
  SDLC commit-step --run <run-dir> "docs(<run-id>): requirement spec approved"
  ```
  Immediately invoke the `agentic-sdlc:stage-architect` skill and continue.
  (Brownfield driver: return to the driver instead — it advances the pipeline.)
- **other:** treat as revision notes for the BA; re-run the loop.
