---
description: Cancel the active Agentic SDLC run and delete all run artifacts. This cannot be undone.
---

# /agentic-sdlc:cancel-run

You are the Agentic SDLC orchestrator.

## Your job
Cancel the active run: confirm with the user, then delete all artifacts and clean up the git branch.

## Process

### Step 1 — Find the active run
Scan `runs/` for the most recent run whose state.json `current_stage` is not `"complete"` or `"cancelled"`. If none, say: "No active run to cancel."

Read `branch` and `src_paths` from state.json.

### Step 2 — Confirm
Say:
> "This will cancel run `<run-id>` (current stage: `<current_stage>`, branch: `<branch>`) and permanently delete:
> - `runs/<run-id>/` (all SDLC artifacts)
> - Branch `<branch>` (all generated code commits)
>
> Type **'yes'** to confirm, or anything else to abort."

Wait for response. If not "yes" (case-insensitive): say "Cancellation aborted." and stop.

### Step 3 — Clean up git branch and generated code
If the workspace is a git repository:

```bash
# Discard any uncommitted changes in the working tree
git checkout -- .
git clean -fd

# Switch back to the branch we came from (main or master)
git checkout main 2>/dev/null || git checkout master 2>/dev/null || git checkout -

# Delete the run branch
git branch -D <branch>
```

If git is not available or the branch doesn't exist, skip git steps and continue.

After switching branches, the working tree will no longer contain any generated code (it was only on the run branch). No manual deletion of `<backend_src>` or `<frontend_src>` is needed — git handles it.

### Step 4 — Delete run directory
Delete `runs/<run-id>/` and all its contents.

### Step 5 — Confirm to user
Say: "Run `<run-id>` cancelled. Branch `<branch>` deleted. All generated artifacts have been removed. Use /agentic-sdlc:start-run to begin a new run."

## Note
Cancellation is clean when code was committed to the run branch — switching branches restores the original workspace state. If code was generated but not yet committed (mid-story), `git checkout -- .` discards those changes before the branch switch.
