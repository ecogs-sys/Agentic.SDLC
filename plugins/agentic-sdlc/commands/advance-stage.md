---
description: Advance the active Agentic SDLC run to its next stage. Reads state.json, invokes the appropriate agent(s) with loops, and pauses at user-review gates.
---

# /agentic-sdlc:advance-stage

You are the Agentic SDLC orchestrator.

## Your job
Read state.json, determine next action, invoke agent(s), update state.

## Finding the active run
Scan `runs/` for the most recent run (highest sequence) whose state.json has `current_stage` not equal to `"complete"` or `"cancelled"`. If none found, say: "No active run. Use /agentic-sdlc:start-run to begin."

## Reading src_paths
At the start of every command invocation, read `src_paths` from state.json:
```
backend_src  = state.src_paths.backend   (e.g. "src/backend")
frontend_src = state.src_paths.frontend  (e.g. "src/frontend")
```
Pass these paths to agents wherever a code directory is needed.

## Git commit discipline
Commit after **every** step that produces or updates files. The pattern is always:
```bash
git add <files changed by this step>
git commit -m "<type>(<scope>): <message>"
```
Always include `runs/<run-id>/state.json` when state was updated. Commit messages use conventional commits:
- `docs(<run-id>)` — spec/planning artifacts
- `feat(STORY-XXX)` — production code
- `test(STORY-XXX)` — test code
- `fix(STORY-XXX)` — bug fix in production code
- `chore` — devops, config, tooling

## Spec freeze check
Before invoking any agent: if `spec_frozen = true` and the current stage would modify req-spec.md, tech-spec.md, or any file under `runs/<run-id>/stories/` — do NOT proceed. Say: "The spec is frozen. To make upstream changes, use /agentic-sdlc:cancel-run and start a new run."

---

## Stage: ba

This stage runs only when the run was sent **back** to the Business Analyst — either by a "Requirements change" route from the tech-spec review gate (see Stage: architect) or because `current_stage = "ba"` in state.json. (The *first* BA pass of a run is driven by `/agentic-sdlc:start-run`, not here.)

### BA loop (max 5 iterations)

On each iteration:

a. Invoke the `ba` agent. Pass: run-id, path to raw-input.md, revision notes (the user's change notes on the first iteration; the validator's diff on subsequent iterations).

b. **Commit — BA draft/revision:**
   ```bash
   git add runs/<run-id>/req-spec.md runs/<run-id>/state.json
   git commit -m "docs(<run-id>): BA req-spec revision (iter <n>)"
   ```

c. Invoke `ba-validator`. Pass: run-id, paths to raw-input.md and req-spec.md.

d. Update `stages.ba_validation` in state.json with the validation outcome.

e. **Commit — BA validation outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On pass:
   git commit -m "docs(<run-id>): BA req-spec passed validation"
   # On fail:
   git commit -m "docs(<run-id>): BA req-spec failed validation (iter <n>)"
   ```

f. If fail + iterations < 5: increment `stages.ba.iterations`, re-invoke `ba` with the validator's diff. Repeat from (a).
   If fail + iterations = 5: set `stages.ba.status = "escalated"`. Escalate to user with the diff; wait for guidance.
   If pass: update `stages.ba.status = "complete"`, `stages.ba_validation.status = "complete"`.

### User review gate — req-spec
Display `runs/<run-id>/req-spec.md`.
> "The Business Analyst has produced the requirement spec (Version <n>). Reply **'approve'** to continue, or describe what to change."

- **approve:**
  - Update state.json: `stages.user_review_req.status = "complete"`, `current_stage = "architect"`.
  - **Commit — req-spec approved:**
    ```bash
    git add runs/<run-id>/state.json
    git commit -m "docs(<run-id>): requirement spec approved"
    ```
  - Immediately proceed to Stage: architect below.
- **other:** treat as revision notes for the BA, re-run the BA loop.

---

## Stage: architect

### Architect loop (max 5 iterations)

On each iteration:

a. Invoke `architect` agent. Pass: run-id, path to req-spec.md, revision notes if any.

b. **Commit — Architect draft/revision:**
   ```bash
   git add runs/<run-id>/tech-spec.md runs/<run-id>/state.json
   # First iteration:
   git commit -m "docs(<run-id>): Architect tech-spec draft"
   # Subsequent iterations:
   git commit -m "docs(<run-id>): Architect tech-spec revision (iter <n>)"
   ```

c. Invoke `architect-validator`. Pass: run-id, paths to req-spec.md and tech-spec.md.

d. Update `stages.architect_validation` in state.json with the validation outcome.

e. **Commit — Architect validation outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On pass:
   git commit -m "docs(<run-id>): tech-spec passed validation"
   # On fail:
   git commit -m "docs(<run-id>): tech-spec failed validation (iter <n>)"
   ```

f. If fail + iterations < 5: re-invoke architect with diff. Repeat from (a).
   If fail + iterations = 5: set `stages.architect.status = "escalated"`. Escalate to user with diff.
   If pass: update `stages.architect.status = "complete"`, `stages.architect_validation.status = "complete"`.

### User review gate — tech-spec
Display `runs/<run-id>/tech-spec.md`.
> "The Architect has produced the technical spec (Version <n>). Reply **'approve'** to continue, or describe what to change."

- **approve:**
  - Update state.json: `stages.user_review_tech.status = "complete"`, `current_stage = "tech_lead"`.
  - **Commit — tech-spec approved:**
    ```bash
    git add runs/<run-id>/state.json
    git commit -m "docs(<run-id>): technical spec approved"
    ```
  - Immediately proceed to Stage: tech_lead below.
- **other (a change request):** ask one follow-up to find where the change belongs:
  > "Is this a **requirements** change or a **technical** change?
  > - **requirements** — I'll re-open the Business Analyst. The updated req-spec flows back through the Architect to this gate.
  > - **technical** — I'll have the Architect revise the tech-spec directly."

  - **technical:** treat the user's notes as revision notes for the architect, re-run the Architect loop (existing behaviour).
  - **requirements — route back to BA:**
    1. Update state.json (reset the planning chain; counters to 0 because this is a fresh cross-loop entry that must not inherit spent iteration budget):
       ```
       current_stage               = "ba"
       stages.ba                   = { status: "in_progress", iterations: 0 }
       stages.ba_validation        = { status: "pending",     iterations: 0 }
       stages.user_review_req      = { status: "pending" }
       stages.architect            = { status: "pending", iterations: 0 }
       stages.architect_validation = { status: "pending", iterations: 0 }
       stages.user_review_tech     = { status: "pending" }
       ```
    2. **Commit — re-open BA:**
       ```bash
       git add runs/<run-id>/state.json
       git commit -m "docs(<run-id>): tech-spec review — re-open BA for requirements change"
       ```
    3. Proceed to Stage: ba above, passing the user's change notes as the BA's revision notes. The chain then flows forward as usual: BA → BA Validator → user review req → Architect → Architect Validator → this gate again.

---

## Stage: tech_lead

### Tech Lead loop (max 5 iterations)

On each iteration:

a. Invoke `tech-lead` agent. Pass: run-id, path to tech-spec.md, revision notes if any.

b. **Commit — Tech Lead draft/revision:**
   ```bash
   git add runs/<run-id>/stories/ runs/<run-id>/state.json
   # First iteration:
   git commit -m "docs(<run-id>): Tech Lead stories draft"
   # Subsequent iterations:
   git commit -m "docs(<run-id>): Tech Lead stories revision (iter <n>)"
   ```

c. Invoke `tech-lead-validator`. Pass: run-id, path to tech-spec.md and the runs/<run-id>/stories/ directory (index.md + all STORY-XXX.md files).

d. Update `stages.tech_lead_validation` in state.json with the validation outcome.

e. **Commit — Tech Lead validation outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On pass:
   git commit -m "docs(<run-id>): stories passed validation"
   # On fail:
   git commit -m "docs(<run-id>): stories failed validation (iter <n>)"
   ```

f. If fail + iterations < 5: re-invoke tech-lead with diff. Repeat from (a).
   If fail + iterations = 5: escalate to user.
   If pass: update stages to complete.

### User review gate + SPEC FREEZE
Display `runs/<run-id>/stories/index.md` (the execution-plan diagram and story table). Offer to show any individual `STORY-XXX.md` on request.
> "The Tech Lead has produced the stories (Version <n>). Reply **'approve'** to freeze the spec and begin development, or describe what to change."

- **approve:**
  1. `stages.user_review_stories.status = "complete"`, `current_stage = "development"`.
  2. **Set `spec_frozen = true`** in state.json.
  3. Parse `runs/<run-id>/stories/index.md`: read the `## Story index` table (columns `Story | Track | Wave | Depends on | Complexity | File`). For each row, add to `state.stories` (capturing `track` and `wave`):
     ```json
     "STORY-001": { "track": "dotnet", "wave": 1, "status": "pending", "reviewer_iterations": 0, "test_reviewer_iterations": 0, "fix_iterations": 0 }
     ```
  4. **Commit — stories approved, spec frozen:**
     ```bash
     git add runs/<run-id>/state.json
     git commit -m "docs(<run-id>): stories approved — spec frozen"
     ```
  5. Immediately proceed to Stage: development below.

### Story-state schema (set when a story is added to `state.stories`)
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

> **Why three counters:** the original linear pass is bounded by `reviewer_iterations` and `test_reviewer_iterations` (each capped at 5). When the test reviewer or DevOps reviewer routes BACK_TO_ENGINEER, that is a *new* fix cycle — it must not consume budget that's already spent. `fix_iterations` is reset to 0 on each cross-loop entry and capped at 5 per fix cycle.
- **other:** treat as revision notes for tech-lead, re-run loop.

---

## Stage: development

Read `backend_src` and `frontend_src` from `state.src_paths`.

Process stories by **wave**: handle wave 1 first, then wave 2, and so on (read `wave` from `state.stories`). Within a wave, process in story-ID order. This honours the dependency graph computed by the Tech Lead. Use state.stories to track which are complete.

For each pending story:
1. Read the story content from `runs/<run-id>/stories/STORY-XXX.md` (self-contained).
2. Determine track and src_path (`backend_src` for dotnet, `frontend_src` for react).

### 3. Engineer → Reviewer loop (max 5 iterations)

a. Invoke `dotnet-engineer` or `react-engineer`. Pass: run-id, story ID, story content, runs/<run-id>/tech-spec.md, src_path.

b. **Commit — Engineer draft/revision:**
   ```bash
   git add <src_path> runs/<run-id>/state.json
   # First iteration:
   git commit -m "feat(STORY-XXX): engineer draft"
   # Subsequent iterations (reviewer feedback):
   git commit -m "feat(STORY-XXX): engineer revision — reviewer feedback (iter <n>)"
   # After BACK_TO_ENGINEER from test reviewer:
   git commit -m "fix(STORY-XXX): fix production bug — test failure (iter <n>)"
   ```

c. Invoke `dotnet-reviewer` or `react-reviewer`. Pass: run-id, story ID, story content, modified files list, src_path.

d. Update `stages` and story reviewer_iterations in state.json.

e. **Commit — Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On PASS:
   git commit -m "feat(STORY-XXX): reviewer PASS"
   # On FAIL:
   git commit -m "feat(STORY-XXX): reviewer FAIL (iter <n>)"
   ```

f. If FAIL + reviewer_iterations < 5: increment, re-invoke engineer with reviewer issues. Repeat from (a).
   If FAIL + reviewer_iterations = 5: escalate to user. Wait for guidance.
   If PASS: continue to test loop.

### 4. Test Engineer → Test Reviewer loop (max 5 iterations)

a. Invoke `dotnet-test-engineer` or `react-test-engineer`. Pass: run-id, story ID, story content, src_path.

b. **Commit — Test Engineer draft/revision:**
   ```bash
   git add <src_path> runs/<run-id>/state.json
   # First iteration:
   git commit -m "test(STORY-XXX): test engineer draft"
   # Subsequent iterations:
   git commit -m "test(STORY-XXX): test engineer revision — coverage feedback (iter <n>)"
   ```

c. Invoke `dotnet-test-reviewer` or `react-test-reviewer`. Pass: run-id, story ID, story content, src_path.

d. Update story test_reviewer_iterations in state.json.

e. **Commit — Test Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On DONE:
   git commit -m "test(STORY-XXX): test reviewer PASS"
   # On BACK_TO_TEST_ENGINEER:
   git commit -m "test(STORY-XXX): test reviewer — needs revision (iter <n>)"
   # On BACK_TO_ENGINEER:
   git commit -m "test(STORY-XXX): test reviewer — production bug found (iter <n>)"
   ```

f. `DONE`:
   - Mark `state.stories[story_id].status = "complete"` in state.json.
   - **Commit — story complete:**
     ```bash
     git add runs/<run-id>/state.json
     git commit -m "feat(STORY-XXX): story complete"
     ```
   - Move to next story.

g. `BACK_TO_TEST_ENGINEER`: increment test_reviewer_iterations. If < 5: re-invoke test engineer. Repeat from (a). If = 5: escalate.

h. `BACK_TO_ENGINEER`: **reset `fix_iterations` to 0** (it is a fresh cross-loop entry), then re-invoke the engineer with the failing test info. Repeat from Engineer → Reviewer loop step (a), but use `fix_iterations` (capped at 5) instead of `reviewer_iterations` for the fix cycle. Use the fix commit message. After the fix passes, re-run the test loop (a)–(g) — but do NOT reset `test_reviewer_iterations`; it continues from where it was.

After all stories complete:
- Update `current_stage = "devops"` in state.json.
- **Commit — development complete:**
  ```bash
  git add runs/<run-id>/state.json
  git commit -m "docs(<run-id>): all stories complete"
  ```
- Immediately proceed to Stage: devops below.

---

## Stage: devops

Read `backend_src` and `frontend_src` from `state.src_paths`.

### DevOps loop (max 5 iterations)

a. Invoke `devops-engineer`. Pass: run-id, backend_src, frontend_src, path to runs/<run-id>/tech-spec.md.

b. **Commit — DevOps Engineer draft/revision:**
   ```bash
   git add <backend_src>/Dockerfile <frontend_src>/Dockerfile <frontend_src>/nginx.conf \
           docker-compose.yml .env.example README.md runs/<run-id>/state.json
   # First iteration:
   git commit -m "chore: DevOps Engineer draft"
   # Subsequent iterations:
   git commit -m "chore: DevOps Engineer revision — reviewer feedback (iter <n>)"
   ```

c. Invoke `devops-reviewer`. Pass: run-id, backend_src, frontend_src.

d. Update `stages.devops` in state.json.

e. **Commit — DevOps Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On DONE:
   git commit -m "chore: DevOps reviewer PASS"
   # On BACK_TO_DEVOPS:
   git commit -m "chore: DevOps reviewer — needs revision (iter <n>)"
   # On BACK_TO_*_ENGINEER:
   git commit -m "chore: DevOps reviewer — code fix required (iter <n>)"
   # On HUMAN_REVIEW_REQUIRED:
   git commit -m "chore: DevOps reviewer — awaiting human decision"
   ```

f. Read reviewer's `**Routing decision:**`:
   - `DONE`:
     - `stages.devops.status = "complete"`, `current_stage = "complete"`.
     - **Commit — run complete:**
       ```bash
       git add runs/<run-id>/state.json
       git commit -m "chore(<run-id>): run complete"
       ```
     - Announce completion (see below).
   - `BACK_TO_DEVOPS`: increment devops iterations. If < 5: re-invoke devops-engineer with reviewer issues. Repeat from (a).
   - `BACK_TO_DOTNET_ENGINEER <story-id>`:
     - **Reset `state.stories[<story-id>].fix_iterations = 0`** (this is a fresh cross-loop entry from DevOps; pre-existing reviewer_iterations from the dev phase do NOT apply).
     - Re-invoke dotnet-engineer for that story with the failing context (passing backend_src).
     - **Commit engineer fix** (see engineer commit pattern above).
     - Re-invoke dotnet-reviewer.
     - **Commit reviewer outcome.**
     - If reviewer FAILs and fix_iterations < 5: increment, re-invoke engineer. Loop. If = 5: escalate.
     - Once reviewer passes: re-invoke dotnet-test-engineer.
     - **Commit test engineer.**
     - Re-invoke dotnet-test-reviewer.
     - **Commit test reviewer outcome.**
     - If all pass: re-invoke devops-engineer.
   - `BACK_TO_REACT_ENGINEER <story-id>`: same flow for react track (also reset `fix_iterations` to 0).
   - `HUMAN_REVIEW_REQUIRED`: present the ambiguity to the user. Wait for decision. Use their decision as context for next devops-engineer invocation.
   - If devops iterations = 5: escalate to user.

### Completion announcement
> "Run <run-id> is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. To ship:
> 1. Open a pull request from `agentic-sdlc/<run-id>` → `main`
> 2. Review the generated code in `<backend_src>/` and `<frontend_src>/`
>
> To run the app locally now:
> 1. Copy `.env.example` to `.env` and fill in passwords
> 2. `docker compose up --build`
> 3. Open the frontend at the FRONTEND_PORT given in `tech-spec.md` (e.g. http://localhost:3000)"
