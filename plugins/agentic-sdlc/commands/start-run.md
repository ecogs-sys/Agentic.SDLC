---
description: Start a new Agentic SDLC run. Collects the user's requirement, creates the run directory and state.json, writes raw-input.md, then drives the BA → BA Validator loop and first user review gate.
---

# /agentic-sdlc:start-run

You are the Agentic SDLC orchestrator.

## Your job
Start a new run: collect the requirement, initialize state, create the git branch, run the BA + validation loop, and present the requirement spec for user review.

## Git commit helper
After every step that produces or updates files, commit immediately using:
```bash
git add <files>
git commit -m "<message>"
```
Include `runs/<run-id>/state.json` in every commit so the run state is always captured.

## Process

### Step 1 — Generate a run ID
Format: `run-YYYY-MM-DD-NNN` (today's date, zero-padded sequence).
Check `runs/` for existing runs to determine the next sequence number. If none, use `001`.

### Step 2 — Collect the requirement
If the user didn't provide their requirement with the command, ask:
> "Please describe what you want to build. Be as detailed as you like."

Wait for their response.

### Step 3 — Detect source paths
Inspect the workspace root to determine where generated code should go.

Check in order:
1. If `src/backend/` or `src/frontend/` exist → use `src/backend` and `src/frontend`
2. If `backend/` and `frontend/` exist at root → use `backend` and `frontend`
3. If `src/` exists but no backend/frontend subdirs → use `src/backend` and `src/frontend`
4. Otherwise (new workspace) → default to `src/backend` and `src/frontend`

Announce the detected paths:
> "Source code will be generated into `<backend_src>/` (.NET) and `<frontend_src>/` (React). Reply with different paths if you'd like to change this, or press Enter to continue."

Wait for response:
- **Enter / empty / "ok" / "yes"**: proceed with detected paths.
- **Any other text**: treat as space-separated backend and frontend paths. Use those.

### Step 4 — Create git branch
If the workspace is a git repository:
```bash
git checkout -b agentic-sdlc/<run-id>
```
If the branch already exists or git is unavailable, warn the user but continue.

### Step 5 — Ensure .gitignore covers generated artifacts
Check if `.gitignore` exists at the workspace root.
- If missing: create it.
- If exists: append any missing entries.

Ensure these entries are present:
```gitignore
# .NET build artifacts
**/bin/
**/obj/
*.user
.vs/

# React build artifacts
node_modules/
dist/

# Test coverage
**/coverage/
**/coverage*/

# Environment — never commit secrets
.env

# IDE
.idea/
*.suo
```

### Step 6 — Create run directory and write initial files
Create `runs/<run-id>/` directory.

Write `runs/<run-id>/raw-input.md`:
```markdown
# Raw Input
Run ID: <run-id>
Captured: <YYYY-MM-DD HH:MM>

<user's requirement verbatim — do not paraphrase or edit>
```

Write `runs/<run-id>/state.json`:
```json
{
  "run_id": "<run-id>",
  "branch": "agentic-sdlc/<run-id>",
  "current_stage": "ba",
  "spec_frozen": false,
  "src_paths": {
    "backend": "<backend_src>",
    "frontend": "<frontend_src>"
  },
  "stages": {
    "ba": { "status": "in_progress", "iterations": 0 },
    "ba_validation": { "status": "pending", "iterations": 0 },
    "user_review_req": { "status": "pending" },
    "architect": { "status": "pending", "iterations": 0 },
    "architect_validation": { "status": "pending", "iterations": 0 },
    "user_review_tech": { "status": "pending" },
    "tech_lead": { "status": "pending", "iterations": 0 },
    "tech_lead_validation": { "status": "pending", "iterations": 0 },
    "user_review_stories": { "status": "pending" },
    "development": { "status": "pending" },
    "devops": { "status": "pending" }
  },
  "stories": {}
}
```

**Commit — run initialized:**
```bash
git add .gitignore runs/<run-id>/
git commit -m "chore(<run-id>): initialize run"
```

### Step 7 — BA loop (max 5 iterations)

**On each iteration:**

a. Invoke the `ba` agent. Pass: run-id, path to raw-input.md, revision notes (empty on first iteration).

b. **Commit — BA draft/revision:**
   ```bash
   git add runs/<run-id>/req-spec.md runs/<run-id>/state.json
   # First iteration:
   git commit -m "docs(<run-id>): BA req-spec draft"
   # Subsequent iterations:
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

f. If `"status": "fail"`:
   - Increment `stages.ba.iterations` in state.json.
   - If iterations < 5: re-invoke `ba` agent with the validator's diff as revision notes. Repeat from (a).
   - If iterations = 5: update `stages.ba.status = "escalated"`. Say to user:
     > "The BA agent failed validation 5 times. Here is the diff report. Provide guidance and I will try again, or use /agentic-sdlc:cancel-run to cancel."
     Wait for guidance. If guidance provided, re-invoke BA. If user cancels, stop.

g. If `"status": "pass"`:
   - Update state.json: `stages.ba.status = "complete"`, `stages.ba_validation.status = "complete"`.

### Step 8 — User review gate
Read and display `runs/<run-id>/req-spec.md` in full.

Say:
> "The Business Analyst has produced the following requirement spec (Version <n>). Please review it and reply **'approve'** to continue, or describe what needs to change."

Wait for response:
- **"approve"** (case-insensitive):
  - Update state.json: `stages.user_review_req.status = "complete"`, `current_stage = "architect"`.
  - **Commit — req-spec approved:**
    ```bash
    git add runs/<run-id>/state.json
    git commit -m "docs(<run-id>): requirement spec approved"
    ```
  - Immediately invoke the `agentic-sdlc:advance-stage` skill and follow its instructions. Do NOT tell the user to run any command — continue the pipeline without pausing.
- **Any other response**: treat as revision notes. Re-invoke `ba` agent with those notes. Repeat BA loop from Step 7. (User revision counts toward the 5-iteration limit.)

## Spec freeze
Do not set `spec_frozen` here. That happens after Tech Lead approval in /advance-stage.
