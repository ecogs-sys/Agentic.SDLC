---
description: Cancel the current in-progress phase of the active program and delete its run artifacts and branch. Completed phases and the program survive. This cannot be undone.
---

# /agentic-sdlc:cancel-run

You are the Agentic SDLC orchestrator.

## Your job
Cancel the current in-progress phase: confirm with the user, then delete that
phase's artifacts and branch. Completed phases and the program itself survive.

## Process

### Step 1 — Find the active program and current phase
Scan `runs/` for the active `runs/<program-id>/program.json`. If none, say: "No
active program to cancel." and stop.

Read `current_phase`, `parent_branch`, and the active phase entry from `phases[]`
(its `folder` = `<phase-folder>`). The phase branch is
`agentic-sdlc/<program-id>/<phase-folder>`. Read that phase's
`runs/<program-id>/<phase-folder>/state.json` for `current_stage`.

### Step 2 — Confirm
Say:
> "This will cancel Phase <current_phase> of program `<program-id>` (current stage:
> `<current_stage>`, branch: `agentic-sdlc/<program-id>/<phase-folder>`) and
> permanently delete:
> - `runs/<program-id>/<phase-folder>/` (this phase's SDLC artifacts)
> - Branch `agentic-sdlc/<program-id>/<phase-folder>` (this phase's code commits)
>
> Completed phases and the program survive. Type **'yes'** to confirm, or anything
> else to abort."

Wait for response. If not "yes" (case-insensitive): say "Cancellation aborted." and
stop.

### Step 3 — Clean up git branch and generated code
If the workspace is a git repository:

```bash
# Discard any uncommitted changes in the working tree
git checkout -- .
git clean -fd

# Switch back to the parent branch.
# Fall back to main, then master. Do NOT use `git checkout -` — that may land
# us back on the phase branch, after which `git branch -D` cannot delete it.
if git rev-parse --verify <parent_branch> >/dev/null 2>&1; then
  git checkout <parent_branch>
elif git rev-parse --verify main >/dev/null 2>&1; then
  git checkout main
elif git rev-parse --verify master >/dev/null 2>&1; then
  git checkout master
else
  echo "ERROR: no parent_branch in program.json and neither main nor master exists."
  echo "Manually checkout your default branch and re-run /agentic-sdlc:cancel-run, or"
  echo "delete branch agentic-sdlc/<program-id>/<phase-folder> yourself with: git branch -D agentic-sdlc/<program-id>/<phase-folder>"
  exit 1
fi

# Delete the phase branch (we are guaranteed to be on a different branch now)
git branch -D agentic-sdlc/<program-id>/<phase-folder>
```

If git is not available or the branch doesn't exist, skip git steps and continue.

After switching branches, the working tree will no longer contain any generated code (it was only on the phase branch). No manual deletion of `<backend_src>` or `<frontend_src>` is needed — git handles it.

### Step 4 — Delete the phase directory (if still present)
After the branch switch the working tree no longer contains the in-progress phase
folder. If `runs/<program-id>/<phase-folder>/` is still present (e.g. it was never
committed), delete it.

### Step 5 — Handle the program
- If the cancelled phase was **Phase 1** (no earlier phase ever merged), the
  program has no delivered phases. Its program-level files lived only on the
  deleted branch, so they are gone too. Say:
  > "Phase 1 of `<program-id>` cancelled. The program had no shipped phases and has
  > been removed. Use /agentic-sdlc:start-run to begin a new program."
- Otherwise (Phase ≥ 2), say:
  > "Phase <current_phase> of `<program-id>` cancelled. Phases 1..<current_phase-1>
  > remain shipped. Re-run /agentic-sdlc:next-phase to restart this phase, or
  > /agentic-sdlc:start-run for a new program."

## Note
Cancellation is clean when code was committed to the run branch — switching branches restores the original workspace state. If code was generated but not yet committed (mid-story), `git checkout -- .` discards those changes before the branch switch.
