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

#### Brownfield change run case
First check for an active brownfield run: `runs/change-*/state.json` with
`current_stage != "complete"`. If one exists, cancel IT (do not touch programs):
- Read `parent_branch` and `branch` from its state.json.
- Confirm:
  > "This will cancel brownfield change `<run-id>` (tier `<tier>`, stage
  > `<current_stage>`) and permanently delete `runs/<run-id>/` and branch
  > `agentic-sdlc/<run-id>`. Any generated code on that branch is discarded. Type
  > **'yes'** to confirm, or anything else to abort."
- On "yes": run the same git cleanup as Step 3 with `<cancel-branch> =
  agentic-sdlc/<run-id>` and `<parent_branch>` from state.json, then delete
  `runs/<run-id>/` if still present. Say: "Brownfield change `<run-id>` cancelled.
  Use /agentic-sdlc:start-run to begin again."
- Then stop (skip the program logic below).

If no active change run exists, continue with the program logic below.

Scan `runs/` for the most recent program that is not fully delivered
(`runs/<program-id>/program.json`). If none, say: "No active program to cancel."
and stop.

Read `current_phase`, `parent_branch`, and `phases`. Then determine which case
applies:

- **Planning-stage case** — if `phases` is empty OR `current_phase == 0`, the
  program is still in the Phase Planner stage (the phase plan was never approved),
  so no phase folder exists yet. The only branch to clean up is
  `agentic-sdlc/<program-id>/phase-01` (created by `/start-run` before planning).
  Skip to Step 2 (planning-stage path).
- **Phase case** — otherwise, read the active phase entry from `phases[]` (its
  `folder` = `<phase-folder>`). The phase branch is
  `agentic-sdlc/<program-id>/<phase-folder>`. Read that phase's
  `runs/<program-id>/<phase-folder>/state.json` for `current_stage`. Use the
  phase path below.

### Step 2 — Confirm

**Planning-stage path** — say:
> "This program is still in phase planning (no phase plan approved yet). This will
> cancel program `<program-id>` entirely and permanently delete:
> - `runs/<program-id>/` (the whole program directory)
> - Branch `agentic-sdlc/<program-id>/phase-01`
>
> Type **'yes'** to confirm, or anything else to abort."

**Phase path** — say:
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

Below, `<cancel-branch>` means `agentic-sdlc/<program-id>/phase-01` for the
planning-stage path, or `agentic-sdlc/<program-id>/<phase-folder>` for the phase
path.

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
  echo "delete branch <cancel-branch> yourself with: git branch -D <cancel-branch>"
  exit 1
fi

# Delete the phase branch (we are guaranteed to be on a different branch now)
git branch -D <cancel-branch>
```

If git is not available or the branch doesn't exist, skip git steps and continue.

After switching branches, the working tree will no longer contain any generated code (it was only on the phase branch). No manual deletion of `<backend_src>` or `<frontend_src>` is needed — git handles it.

### Step 4 — Delete the phase directory (if still present)
After the branch switch the working tree no longer contains the in-progress phase
folder. If `runs/<program-id>/<phase-folder>/` is still present (e.g. it was never
committed), delete it.

### Step 5 — Handle the program
- **Planning-stage path:** delete `runs/<program-id>/` if still present (its files
  lived only on the deleted `phase-01` branch, so after the branch switch they are
  gone too). Say:
  > "Program `<program-id>` cancelled (it was still in phase planning and had no
  > shipped phases). Use /agentic-sdlc:start-run to begin a new program."
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
Cancellation is clean when code was committed to the phase branch — switching branches restores the original workspace state. If code was generated but not yet committed (mid-story), `git checkout -- .` discards those changes before the branch switch.
