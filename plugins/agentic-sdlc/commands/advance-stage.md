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
Before invoking any agent: if `spec_frozen = true` and the current stage would modify req-spec.md, tech-spec.md, or stories.md — do NOT proceed. Say: "The spec is frozen. To make upstream changes, use /agentic-sdlc:cancel-run and start a new run."

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
  - Say: "Technical spec approved. Run /advance-stage to continue to Tech Lead."
- **other:** treat as revision notes for architect, re-run loop.

---

## Stage: tech_lead

### Tech Lead loop (max 5 iterations)

On each iteration:

a. Invoke `tech-lead` agent. Pass: run-id, path to tech-spec.md, revision notes if any.

b. **Commit — Tech Lead draft/revision:**
   ```bash
   git add runs/<run-id>/stories.md runs/<run-id>/state.json
   # First iteration:
   git commit -m "docs(<run-id>): Tech Lead stories draft"
   # Subsequent iterations:
   git commit -m "docs(<run-id>): Tech Lead stories revision (iter <n>)"
   ```

c. Invoke `tech-lead-validator`. Pass: run-id, paths to tech-spec.md and stories.md.

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
Display `runs/<run-id>/stories.md`.
> "The Tech Lead has produced the stories (Version <n>). Reply **'approve'** to freeze the spec and begin development, or describe what to change."

- **approve:**
  1. `stages.user_review_stories.status = "complete"`, `current_stage = "development"`.
  2. **Set `spec_frozen = true`** in state.json.
  3. Parse stories.md: for each `## STORY-XXX: ` heading, extract story ID and its `**Track:**` field. Add to `state.stories`:
     ```json
     "STORY-001": { "track": "dotnet", "status": "pending", "reviewer_iterations": 0, "test_reviewer_iterations": 0 }
     ```
  4. **Commit — stories approved, spec frozen:**
     ```bash
     git add runs/<run-id>/state.json
     git commit -m "docs(<run-id>): stories approved — spec frozen"
     ```
  5. Say: "Stories approved. Spec is now **frozen**. Run /advance-stage to begin development."
- **other:** treat as revision notes for tech-lead, re-run loop.

---

## Stage: development

Read `backend_src` and `frontend_src` from `state.src_paths`.

Process stories in dependency order (stories with empty `Depends on` first). Use state.stories to track which are complete.

For each pending story:
1. Read the story content from stories.md.
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

h. `BACK_TO_ENGINEER`: increment reviewer_iterations. Re-invoke engineer with the failing test info. Repeat from Engineer → Reviewer loop step (a), using the fix commit message.

After all stories complete:
- Update `current_stage = "devops"` in state.json.
- **Commit — development complete:**
  ```bash
  git add runs/<run-id>/state.json
  git commit -m "docs(<run-id>): all stories complete"
  ```
- Say: "All stories complete. Run /advance-stage to begin DevOps phase."

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
     - Re-invoke dotnet-engineer for that story with the failing context (passing backend_src).
     - **Commit engineer fix** (see engineer commit pattern above).
     - Re-invoke dotnet-reviewer.
     - **Commit reviewer outcome.**
     - Re-invoke dotnet-test-engineer.
     - **Commit test engineer.**
     - Re-invoke dotnet-test-reviewer.
     - **Commit test reviewer outcome.**
     - If all pass: re-invoke devops-engineer.
   - `BACK_TO_REACT_ENGINEER <story-id>`: same flow for react track.
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
> 3. Open http://localhost:3000"
