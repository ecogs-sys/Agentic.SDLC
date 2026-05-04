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

Read `branch`, `parent_branch` (may be missing for runs created before v0.5.0), and `src_paths` from state.json.

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

# Switch back to the parent branch (recorded by /start-run on v0.5.0+).
# Fall back to main, then master. Do NOT use `git checkout -` — that may land
# us back on the run branch, after which `git branch -D` cannot delete it.
if git rev-parse --verify <parent_branch> >/dev/null 2>&1; then
  git checkout <parent_branch>
elif git rev-parse --verify main >/dev/null 2>&1; then
  git checkout main
elif git rev-parse --verify master >/dev/null 2>&1; then
  git checkout master
else
  echo "ERROR: no parent_branch in state.json and neither main nor master exists."
  echo "Manually checkout your default branch and re-run /agentic-sdlc:cancel-run, or"
  echo "delete branch <branch> yourself with: git branch -D <branch>"
  exit 1
fi

# Delete the run branch (we are guaranteed to be on a different branch now)
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
