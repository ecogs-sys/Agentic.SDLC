---
description: Start the next phase of the active Agentic SDLC program. Requires the current phase to be complete and its PR merged. Optionally replans remaining phases, then creates the next phase run and drives it through the BA → BA Validator loop and requirement-spec gate.
---

# /agentic-sdlc:next-phase

You are the Agentic SDLC orchestrator.

## Your job
Spawn the next phase of the active program: confirm the current phase is shipped,
optionally replan remaining phases, branch the next phase from updated master, and
drive it up to the requirement-spec review gate.

## Process

### Step 1 — Find the active program and current phase
If the active run is a brownfield change run (`runs/change-*/state.json` with
`current_stage != "complete"`), say:
> "`/agentic-sdlc:next-phase` is for greenfield programs. Brownfield changes aren't
> phased — continue this change with `/agentic-sdlc:advance-stage`, or start a new
> change with `/agentic-sdlc:start-run`."
and stop.

Scan `runs/` for the most recent program that is not fully delivered
(`runs/<program-id>/program.json`). If none, say:
"No active program. Use /agentic-sdlc:start-run to begin." and stop.

Read `current_phase`, `phase_count` (i.e. `phase_plan.phase_count`), `phases`,
`parent_branch`, and `src_paths`.

- If the phase at `current_phase` is not `complete`, say:
  > "Phase <current_phase> is not complete yet. Finish it with
  > `/agentic-sdlc:advance-stage` before starting the next phase."
  and stop.
- If `current_phase == phase_count`, say:
  > "All <phase_count> phases of `<program-id>` are delivered. The program is
  > complete."
  and stop.

### Step 2 — Require the current phase merged
Say:
> "Phase <current_phase> is complete. Before starting Phase <current_phase + 1>,
> its PR must be merged to `<parent_branch>` so the next phase builds on shipped
> code. Have you merged it? Reply **'yes'** to continue, or anything else to wait."

Wait. If not "yes" (case-insensitive): say "Holding. Re-run /agentic-sdlc:next-phase
once Phase <current_phase> is merged." and stop.

### Step 3 — Update parent branch
```bash
git checkout <parent_branch>
git pull
```
This brings in the merged code from the prior phase plus the program-level files
(program.json, phase-plan.md) which travelled to <parent_branch> with that merge.

### Step 4 — Determine the next phase and create its branch
Let `N = current_phase + 1`. Read the Phase N entry from `phases[]` (folder
`phase-0N`, title). Branch from the updated parent **now**, before any commits, so
that everything below (including a replan) lands on the phase branch rather than on
`<parent_branch>`:
```bash
git checkout -b agentic-sdlc/<program-id>/phase-0N
```

### Step 5 — Offer a replan of remaining phases
Say:
> "Optionally, I can re-open the Phase Planner to revise the **remaining** phases
> (Phases <current_phase + 1>..<phase_count>) using what Phase <current_phase>
> shipped. Phases 1..<current_phase> stay frozen. Reply **'replan'** to revise, or
> **'keep'** to use the existing plan."

- **"replan"**:
  1. Invoke `phase-planner`. Pass: program-id, original-input.md, the frozen
     already-shipped phases (1..current_phase) with a one-line summary of each, and
     a note that only phases > current_phase may change. Set
     `phase_plan.status = "in_progress"` and `phase_plan.iterations = 0` at the
     start of the replan; on the user's approval it returns to `"frozen"`.
  2. Commit the revision (lands on the phase branch created in Step 4):
     ```bash
     git add runs/<program-id>/phase-plan.md runs/<program-id>/program.json
     git commit -m "docs(<program-id>): phase plan replan (after phase <current_phase>)"
     ```
  3. Invoke `phase-planner-validator`; loop up to 5 iterations exactly as in
     start-run Step 7. On pass, display the revised remaining phases and ask the
     user to **approve**. On **approve**, update `phase_count`
     (`phase_plan.phase_count`) and the not-yet-started `phases[]` entries, then
     continue to Step 6. On **any other response**, treat it as revision notes and
     re-invoke `phase-planner` (repeat the replan loop).
- **"keep"**: proceed with the existing plan.
- **anything else**: treat as `keep` — proceed with the existing plan.

### Step 6 — Create the Phase N run
1. Create `runs/<program-id>/phase-0N/`.
2. Write `runs/<program-id>/phase-0N/raw-input.md` — Phase N's scope plus a short
   "already shipped" context block:
   ```markdown
   # Raw Input
   Run ID: <program-id>/phase-0N
   Phase: N of <phase_count>
   Captured: <YYYY-MM-DD HH:MM>

   ## Already shipped (context — do not re-build)
   Phases 1..N-1 are already implemented and merged. Treat them as an existing
   system you are extending, not greenfield:
   <one or two sentences per shipped phase: its title and what it delivered,
   taken from phase-plan.md>

   ## This phase
   <Phase N goal + scope, copied from phase-plan.md Phase N>
   ```
3. Write `runs/<program-id>/phase-0N/state.json` using the same schema as the
   Phase 1 state.json in start-run, with `run_id = "<program-id>/phase-0N"`,
   `phase_number = N`, `branch = "agentic-sdlc/<program-id>/phase-0N"`,
   `current_stage = "ba"`, `spec_frozen = false`, and the program's `src_paths`.
   **If `program.json` `mode == "brownfield"`,** also copy `mode: "brownfield"`,
   `codebase_context_path`, `infra_change_required`, and `test_baseline` from
   `program.json` into the phase `state.json` so the phase runs brownfield-aware (its
   agents read `codebase-context.md` and work the delta against the existing system).
4. Set `program.json` `current_phase = N` and the Phase N `phases[]` entry
   `status = "in_progress"`.
5. **Commit — Phase N started:**
   ```bash
   git add runs/<program-id>/program.json runs/<program-id>/phase-0N/
   git commit -m "docs(<program-id>): Phase N started"
   ```

### Step 7 — Drive the BA loop
Invoke the `agentic-sdlc:advance-stage` skill and follow its instructions. It will
discover the active phase (Phase N) and run the BA → BA Validator loop and the
requirement-spec gate, then continue the pipeline as normal.
