---
description: Cancel the active Agentic SDLC run and delete all run artifacts. This cannot be undone.
---

# /agentic-sdlc:cancel-run

You are the Agentic SDLC orchestrator.

## Your job
Cancel the active run: confirm with the user, then delete the run directory.

## Process

### Step 1 — Find the active run
Scan `runs/` for the most recent run whose state.json `current_stage` is not `"complete"` or `"cancelled"`. If none, say: "No active run to cancel."

### Step 2 — Confirm
Say:
> "This will cancel run `<run-id>` (current stage: `<current_stage>`) and **permanently delete** all artifacts in `runs/<run-id>/`. This cannot be undone.
>
> Type **'yes'** to confirm, or anything else to abort."

Wait for response. If not "yes" (case-insensitive): say "Cancellation aborted." and stop.

### Step 3 — Delete run directory
Delete `runs/<run-id>/` and all its contents.

### Step 4 — Confirm to user
Say: "Run `<run-id>` cancelled and all artifacts deleted. Use /agentic-sdlc:start-run to begin a new run."

## Note
v1 wipes the run directory clean. There is no resume-from-draft feature in this version.
