---
name: stage-tech-lead
description: Orchestrator handler for the Tech Lead stage — runs the Tech Lead → Validator loop and the stories user gate, then seeds state.stories, authors the eval manifest, and hands off to the eval review gate (where the spec freezes). Loaded by /advance-stage when current_stage = tech_lead.
---

# Stage: Tech Lead

Follow the `agentic-sdlc:validation-loop` protocol with:

| Parameter | Value |
|---|---|
| CREATOR / VALIDATOR | `tech-lead` / `tech-lead-validator` |
| ARTIFACT | `runs/<run-id>/stories/` (index.md + all STORY-XXX.md) |
| INPUTS | `runs/<run-id>/tech-spec.md` — or the tier's substitute spec in brownfield (+ `codebase-context.md`, `mode = brownfield`) |
| STAGE / VALIDATION_STAGE | `tech_lead` / `tech_lead_validation` |
| MSG | `Tech Lead stories` |

Pass the run's `app_type` to the tech-lead (it drives track assignment).

**Stage-entry summary** (print on entry):
> **Stage <k>/<n> — Tech Lead.** Splitting the tech-spec into stories
> (Tech Lead → validator loop, then your review gate). On approval the evals are
> authored and you get one last gate — the eval review — where the spec freezes.

## User review gate — stories

Name **`runs/<run-id>/stories/index.md`**, then display it (the execution-plan
diagram and story table) — full on first review, diff + validator notes on
re-review. Offer to show any individual `STORY-XXX.md` (name its path) on request.

> "The Tech Lead has produced the stories (Version <n>). Reply **'approve'** to
> author the evals and move to the eval review gate, or describe what to change."

- **approve:**
  1. Parse `runs/<run-id>/stories/index.md`: read the `## Story index` table
     (columns `Story | Track | Wave | Depends on | Complexity | File`). For each
     row add to `state.stories` (capturing `track` and `wave`) — see the schema
     below. Then:
     ```bash
     SDLC set-stage <run-dir> user_review_stories complete
     SDLC set-field <run-dir>/state.json current_stage user_review_evals
     SDLC set-field <run-dir>/state.json stories.STORY-001 '{"track":"dotnet","wave":1,"status":"pending","reviewer_iterations":0,"test_reviewer_iterations":0,"fix_iterations":0}'
     # …one set-field per story…
     ```
     Do **not** set `spec_frozen` here — the eval review gate is now the spec-freeze
     point (a substantial change there re-opens these stages, which freeze would block).
  2. **Author the run's eval manifest** from the acceptance criteria — one stub per
     `STORY-XXX/AC-n` (see the `agentic-sdlc:write-evals` skill):
     ```bash
     EVALS author <run-dir>                 # reads <run-dir>/stories/, writes <run-dir>/evals/manifest.json
     SDLC set-field <run-dir>/state.json stages.evals '{"status":"in_progress"}'
     SDLC commit-step --run <run-dir> "docs(<run-id>): stories approved — evals authored" <run-dir>/evals
     ```
  3. Immediately invoke the `agentic-sdlc:stage-evals` skill (the eval review gate).
     (Brownfield driver: return to the driver instead — it advances the pipeline to
     `user_review_evals`. Author the eval manifest exactly as above.)
- **other:** treat as revision notes for the tech-lead; re-run the loop.

## Story-state schema

```json
"STORY-001": {
  "track": "dotnet",
  "wave": 1,
  "status": "pending",
  "reviewer_iterations": 0,        // engineer↔reviewer cycles in the original dev pass
  "test_reviewer_iterations": 0,   // test-engineer↔test-reviewer cycles
  "fix_iterations": 0              // re-entry cycles from BACK_TO_ENGINEER (test or devops)
}
```

> **Why three counters:** the original linear pass is bounded by
> `reviewer_iterations` and `test_reviewer_iterations` (each capped at 5). When the
> test reviewer or DevOps reviewer routes BACK_TO_ENGINEER, that is a *new* fix
> cycle — it must not consume budget that's already spent. `fix_iterations` is reset
> to 0 on each cross-loop entry and capped at 5 per fix cycle.

> **Story status values & escalation:** a story's `status` is `pending →
> in_progress → complete`, plus `escalated`. Whenever any of a story's loops hits
> its 5-iteration cap, run `SDLC story-status <run-dir> <id> escalated`, commit, and
> emit the escalation block (validation-loop skill) before waiting — so
> `show-run-status` flags the blocked story. On the user's fix guidance, set it back
> to `in_progress` and resume.
