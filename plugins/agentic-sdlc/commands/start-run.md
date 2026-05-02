---
description: Start a new Agentic SDLC run. Collects the user's requirement, creates the run directory and state.json, writes raw-input.md, then drives the BA → BA Validator loop and first user review gate.
---

# /agentic-sdlc:start-run

You are the Agentic SDLC orchestrator.

## Your job
Start a new run: collect the requirement, initialize state, run the BA + validation loop, and present the requirement spec for user review.

## Process

### Step 1 — Generate a run ID
Format: `run-YYYY-MM-DD-NNN` (today's date, zero-padded sequence).
Check `runs/` for existing runs to determine the next sequence number. If none, use `001`.

### Step 2 — Collect the requirement
If the user didn't provide their requirement with the command, ask:
> "Please describe what you want to build. Be as detailed as you like."

Wait for their response.

### Step 3 — Create run directory and write raw-input.md
Create `runs/<run-id>/` directory.

Write `runs/<run-id>/raw-input.md`:
```markdown
# Raw Input
Run ID: <run-id>
Captured: <YYYY-MM-DD HH:MM>

<user's requirement verbatim — do not paraphrase or edit>
```

### Step 4 — Write initial state.json
Write `runs/<run-id>/state.json`:
```json
{
  "run_id": "<run-id>",
  "current_stage": "ba",
  "spec_frozen": false,
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

### Step 5 — BA loop (max 5 iterations)

**Iteration loop:**

a. Invoke the `ba` agent via the Task tool. Pass: run-id, path to raw-input.md, and any revision notes (empty on first iteration).

b. After BA completes, invoke `ba-validator` via Task tool. Pass: run-id, paths to raw-input.md and req-spec.md.

c. Read the validator's JSON response.

d. If `"status": "fail"`:
   - Increment `stages.ba.iterations` in state.json.
   - If iterations < 5: re-invoke `ba` agent with the validator's diff report as revision notes. Repeat from (b).
   - If iterations = 5: update `stages.ba.status = "escalated"` in state.json. Say to user:
     > "The BA agent failed validation 5 times. Here is the current diff report. You can provide guidance and I will try again, or use /agentic-sdlc:cancel-run to cancel."
     Display the diff. Wait for user guidance. If guidance provided, re-invoke BA. If user says cancel, stop.

e. If `"status": "pass"`:
   - Update state.json: `stages.ba.status = "complete"`, `stages.ba_validation.status = "complete"`.

### Step 6 — User review gate
Read and display `runs/<run-id>/req-spec.md` in full.

Say:
> "The Business Analyst has produced the following requirement spec (Version <n>). Please review it and reply **'approve'** to continue, or describe what needs to change."

Wait for response:
- **"approve"** (case-insensitive): update state.json `stages.user_review_req.status = "complete"`, `current_stage = "architect"`. Say: "Requirement spec approved. Run `/agentic-sdlc:advance-stage` to continue to the Architect stage."
- **Any other response**: treat as revision notes. Re-invoke `ba` agent with those notes. Repeat BA loop from Step 5. (User revision counts toward the 5-iteration limit.)

## Spec freeze
Do not set `spec_frozen` here. That happens after Tech Lead approval in /advance-stage.
