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

### Step 2b — Protect standalone-command output before touching git (MANDATORY)

`cleanup-branch` runs `git checkout -- .` **and `git clean -fd`**. `git clean -fd`
deletes **untracked files and directories**, and the standalone commands write
untracked output that has nothing to do with the phase being cancelled:

| Directory | Written by | What it costs to lose |
|---|---|---|
| `reverse-spec/` | `/agentic-sdlc:reverse-spec`, `/agentic-sdlc:redesign`, `/agentic-sdlc:gap-analysis` | one full specification pass by the most capable model **per module**, plus every evidence file, decision record and impact report |
| `brainstorms/` | `/agentic-sdlc:brainstorm` | a full generation + critique + deep-dive session |

Neither is gitignored, neither is auto-committed, and neither belongs to the phase.
So **before running any git command**, check for them:

```bash
git status --porcelain --untracked-files=all -- reverse-spec/ brainstorms/
```

If that prints anything, stop and ask — do **not** proceed on the main confirmation:

> ⚠ **Uncommitted standalone output would be destroyed.**
>
> Cancelling runs `git clean -fd`, which deletes untracked files. These are not part
> of Phase <n> and are not recoverable:
>
> - `reverse-spec/<rev-id>/` — <n> module specs, <m> requirements, <k> evidence files
> - `brainstorms/<id>/` — <n> concepts
>
> Reply **'commit'** to commit them first (recommended — then cancel safely),
> **'keep'** to abort the cancellation and deal with them yourself, or
> **'discard'** if you genuinely want them gone.

- **commit** → `git add reverse-spec/ brainstorms/` and commit with
  `docs: preserve reverse-spec/brainstorm output before cancelling <phase>`, then
  continue to Step 3. A commit on the phase branch is **not** enough on its own —
  the branch is about to be deleted — so commit, then **cherry-pick or re-commit onto
  `<parent_branch>` after the branch switch in Step 3** and confirm it survived.
- **keep** → say "Cancellation aborted — nothing was changed." and stop.
- **discard** → continue, and name in your final message exactly what was deleted.

Never skip this check because the user already typed "yes" at Step 2. That
confirmation named the phase directory and the phase branch; it did not name
`reverse-spec/`, and a user who surveyed a legacy system last week has no reason to
expect cancelling a phase to delete it.

### Step 3 — Clean up git branch and generated code
If the workspace is a git repository, run the helper — it discards uncommitted
changes **and removes untracked files (`git clean -fd`)**, switches to
`<parent_branch>` (falling back to `main`, then `master`), then deletes the phase
branch:

```bash
SDLC() { node "${CLAUDE_PLUGIN_ROOT}/scripts/sdlc.mjs" "$@"; }
SDLC cleanup-branch <cancel-branch> <parent_branch>
```

The helper never uses `git checkout -` (which could land back on the phase branch
and block its deletion). If no `<parent_branch>` is known and neither `main` nor
`master` exists, it exits non-zero with instructions to checkout the default
branch manually and delete `<cancel-branch>` yourself with `git branch -D`.

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

**`cleanup-branch` is wider than the phase.** It also runs `git clean -fd`, which
deletes every untracked file in the workspace — not only generated code. That is
correct for the phase's own output and wrong for anything else, which is why Step 2b
exists and is not optional. Anything written by a standalone command
(`reverse-spec/`, `brainstorms/`) must be committed or consciously discarded first.

**Eval artifacts need no special handling.** The run-specific manifest
(`runs/<run-id>/evals/manifest.json`) lives in the deleted run directory. Any
permanent-corpus evals this run promoted (`evals/EVAL-*.json`, `evals/registry.json`)
were committed only on the cancelled branch, so the branch switch/discard removes
them along with the code they proved — correct, since that code is gone too. A
previously **merged** run's corpus lives on `master` and is untouched.
