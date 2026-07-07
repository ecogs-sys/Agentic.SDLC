---
name: stage-devops
description: Orchestrator handler for the DevOps stage (web runs) — DevOps Engineer → Reviewer loop with routing, then run/phase completion. Loaded by /advance-stage when current_stage = devops.
---

# Stage: DevOps *(web runs)*

Read `backend_src` and `frontend_src` from `state.src_paths`.

**Stage-entry summary** (print on entry):
> **Stage <n>/<n> — DevOps (final).** Containerizing the app
> (engineer → docker-compose build/up/smoke-test loop). No user gate until the
> completion announcement.

## DevOps loop (max 5 iterations — `stages.devops.iterations`)

Before the first invocation: `SDLC set-stage <run-dir> devops in_progress`
(ships with the draft commit).

a. Invoke `devops-engineer`. Pass: run-id, backend_src, frontend_src, the tech-spec
   path. Description: `"devops iter <i>"`. Banner: `▶ [devops] devops-engineer (iter <i>/5)`.

b. **Commit — draft/revision** (carries any pending reviewer state):
   ```bash
   SDLC commit-step --run <run-dir> "chore: DevOps Engineer draft" \
     <backend_src>/Dockerfile <frontend_src>/Dockerfile <frontend_src>/nginx.conf \
     docker-compose.yml .env.example README.md
   # revisions: "chore: DevOps Engineer revision — reviewer feedback (iter <n>)"
   ```

c. Invoke `devops-reviewer`. Pass: run-id, backend_src, frontend_src.
   Description: `"devops review iter <i>"`. Print the `✔`/`✖` banner with its decision.

d. Route on the reviewer's `**Routing decision:**` (no standalone outcome commits):
   - **DONE:**
     ```bash
     SDLC set-stage <run-dir> devops complete
     SDLC set-field <run-dir>/state.json current_stage complete
     SDLC commit-step --run <run-dir> "chore(<run-id>): run complete"
     ```
     Update the matching `phases[]` entry in `runs/<program-id>/program.json` to
     `"status": "complete"`:
     ```bash
     SDLC set-field runs/<program-id>/program.json phases.<idx>.status complete
     SDLC commit-step "docs(<program-id>): phase <phase_number> complete" runs/<program-id>/program.json
     ```
     Do NOT start the next phase automatically (that is `/agentic-sdlc:next-phase`).
     Announce completion (below).
   - **BACK_TO_DEVOPS:** `SDLC bump-iter <run-dir> devops`; if < 5 re-invoke
     `devops-engineer` with the issues (repeat from a); if = 5 → `SDLC set-stage
     <run-dir> devops escalated`, commit, escalation block.
   - **BACK_TO_DOTNET_ENGINEER <story-id>** / **BACK_TO_REACT_ENGINEER <story-id>:**
     1. `SDLC story-iter <run-dir> <story-id> fix_iterations reset` (fresh
        cross-loop entry — dev-phase counters do NOT apply).
     2. Re-run that story's Engineer → Reviewer loop (stage-development skill,
        step 3) with the failing context, using `fix_iterations` and the
        `fix(STORY-XXX)` commit message. If = 5: escalate.
     3. Once the reviewer passes: re-run the story's test loop (test engineer →
        test reviewer, `full_suite = true`). If all pass: re-invoke
        `devops-engineer` (repeat from a).
   - **HUMAN_REVIEW_REQUIRED:** commit state
     (`"chore: DevOps reviewer — awaiting human decision"`), present the ambiguity,
     wait, and use the user's decision as context for the next `devops-engineer`
     invocation.

## Completion announcement

Read `parent_branch` from `program.json` (the PR target). Announce:
> "Phase <phase_number> (run <run-id>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. To ship:
> 1. Open a pull request from `agentic-sdlc/<run-id>` → `<parent_branch>`
> 2. Review the generated code in `<backend_src>/` and `<frontend_src>/`
>
> To run the app locally now:
> 1. Copy `.env.example` to `.env` and fill in passwords
> 2. `docker compose up --build`
> 3. Open the frontend at the FRONTEND_PORT given in `tech-spec.md` (e.g. http://localhost:3000)"

Then the program-level next step:
- Last phase (`current_phase == phase_plan.phase_count`):
  > "All <phase_plan.phase_count> phase(s) of `<program-id>` are now delivered.
  > Once this final PR merges, the program is complete."
- Otherwise:
  > "Once this phase's PR is merged to `<parent_branch>`, run
  > `/agentic-sdlc:next-phase` to start Phase <current_phase + 1>."

## Brownfield note

In a brownfield run this stage is **conditional**: the driver runs it only if
`state.infra_change_required == true` (otherwise `SDLC set-stage <run-dir> devops
skipped`). When it runs, instruct the DevOps Engineer to **modify existing** infra
files (compose/.env/Dockerfile/nginx.conf) rather than regenerate them. On DONE, do
NOT perform the program.json/phase update or announcement — return to the
brownfield driver's completion.
