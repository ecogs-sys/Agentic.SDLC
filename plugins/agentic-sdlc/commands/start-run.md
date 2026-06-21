---
description: Start a new Agentic SDLC program. Collects the user's requirement, creates the program directory and branch, drives the Phase Planner → Validator loop and phase-plan gate, then creates the Phase 1 run and drives the BA → BA Validator loop and first user review gate.
---

# /agentic-sdlc:start-run

You are the Agentic SDLC orchestrator.

## Your job
Start a new program: collect the requirement, initialize the program, create the
git branch, split the requirement into phases (Phase Planner + Validator loop +
phase-plan gate), then create the Phase 1 run and drive the BA + validation loop
up to the requirement-spec review gate.

## Composite run IDs
Each phase is a normal run whose `run_id` is the composite `<program-id>/phase-0N`.
This makes every `runs/<run-id>/…` path resolve to `runs/<program-id>/phase-0N/…`,
so the BA, Architect, Tech Lead, and development agents need no changes.

## Process

### Step 0 — Refuse if a program is already active
Scan `runs/` for any active work. Two kinds block a new start:
- **Programs** — any `runs/<program-id>/program.json` that is not fully delivered
  (as defined next).
- **Change runs** — any `runs/change-*/state.json` whose `current_stage` is not
  `"complete"`.

A program is **active** unless it is fully delivered (`phase_plan.status ==
"frozen"` AND `current_phase == phase_plan.phase_count` AND the phase at
`current_phase` has status `complete`). If an active **change run** exists, do NOT
start a new one — say:

> "A brownfield change run is already active: `<run-id>` (tier `<tier>`, stage
> `<current_stage>`). Continue it with `/agentic-sdlc:advance-stage`, or cancel it
> with `/agentic-sdlc:cancel-run`. Concurrent runs are not supported."

Then stop. If an active **program** exists, do NOT start a new one — say:

> "A program is already active: `<program-id>` (phase `<current_phase>` of
> `<phase_count>`).
>
> - Continue the current phase with `/agentic-sdlc:advance-stage`.
> - Start the next phase (once the current one is merged) with
>   `/agentic-sdlc:next-phase`.
> - Or cancel the current phase with `/agentic-sdlc:cancel-run`.
>
> Concurrent programs are not supported."

Then stop. Do not modify any files.

### Step 1 — Generate a program ID
Format: `program-YYYY-MM-DD-NNN` (today's date, zero-padded sequence).
Check `runs/` for existing `program-*` directories to determine the next sequence
number. If none, use `001`.

### Step 2 — Collect the requirement
If the user didn't provide their requirement with the command, ask:
> "I will generate a runnable application with the following fixed stack: **.NET 8 Web API + React 18 + Vite + TypeScript + PostgreSQL + Docker Compose**. If you need a different stack (Vue, Angular, Python, MongoDB, etc.), this plugin won't fit — let me know and we can stop here.
>
> Please describe what you want to build. Be as detailed as you like."

Wait for their response. If they explicitly request an incompatible stack, stop the run with a clear message and do not create the run directory.

### Step 3 — Detect source paths
Inspect the workspace root to determine where generated code should go.

Check in order:
1. If `src/backend/` or `src/frontend/` exist → use `src/backend` and `src/frontend`
2. If `backend/` and `frontend/` exist at root → use `backend` and `frontend`
3. If `src/` exists but no backend/frontend subdirs → use `src/backend` and `src/frontend`
4. Otherwise (new workspace) → default to `src/backend` and `src/frontend`

Also derive the **.NET test path** (`backend_test`) — .NET test code lives in a separate
top-level `tests/` tree, **never under `src/`**. Default to `tests/backend`. If `<backend_src>`
follows the `src/<name>` pattern, mirror it as `tests/<name>` (e.g. `src/backend` → `tests/backend`,
plain `backend` → `tests/backend`). (React tests stay co-located inside `<frontend_src>` — no
separate test path.)

Announce the detected paths:
> "Source code will be generated into `<backend_src>/` (.NET source) and `<frontend_src>/` (React); .NET tests into `<backend_test>/`. React tests are co-located alongside their components. Reply with different paths if you'd like to change this, or press Enter to continue."

Wait for response:
- **Enter / empty / "ok" / "yes"**: proceed with detected paths.
- **Any other text**: treat as space-separated backend and frontend paths. Use those.

### Step 3b — Decide greenfield vs brownfield
Inspect the detected source paths for real, existing application code:
- **Backend has code** if Glob finds `<backend_src>/**/*.csproj` (or any `*.sln`).
- **Frontend has code** if Glob finds `<frontend_src>/**/package.json`.

- If **neither** side has code → **greenfield**. Continue with the existing flow
  (Step 4 onward: program init → Phase Planner → ...). Nothing else changes.
- If **either** side has code → **brownfield**. Announce and confirm:
  > "I detected existing code, so I'll run in **brownfield** mode (right-sized for a
  > bug fix / small change / new feature on this codebase). Reply **Enter** to
  > continue, or type `greenfield` to force a from-scratch build instead."
  - `greenfield` → fall through to the existing greenfield flow.
  - otherwise → go to **Step B1 (Brownfield flow)** below and do NOT run the
    greenfield Steps 4–10.

### Step 4 — Create git branch
If the workspace is a git repository, first capture the current branch (this is the parent branch we'll return to on cancel):
```bash
PARENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git checkout -b agentic-sdlc/<program-id>/phase-01
```
Record `PARENT_BRANCH` — it goes into `program.json` (Step 6) and each phase `state.json` (Step 8). If the branch already exists or git is unavailable, warn the user but continue.

### Step 5 — Ensure .gitignore covers generated artifacts
Check if `.gitignore` exists at the workspace root.
- If missing: create it.
- If exists: append any missing entries.

**Note on `runs/`:** the workspace `.gitignore` does NOT exclude `runs/`. SDLC artifacts (req-spec, tech-spec, stories, state.json) are committed to the run branch as the audit trail. The marketplace repo's own `.gitignore` excludes `runs/` because that's a separate concern (don't pollute the marketplace with users' run artifacts). This is intentional, not an oversight.

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
**/coverage*/

# Logs
*.log

# Environment — never commit secrets
.env

# IDE
.idea/
*.suo
```

### Step 6 — Create the program directory and original-input
Create `runs/<program-id>/`.

Write `runs/<program-id>/original-input.md`:
```markdown
# Original Input
Program ID: <program-id>
Captured: <YYYY-MM-DD HH:MM>

<user's requirement verbatim — do not paraphrase or edit>
```

Write `runs/<program-id>/program.json`:
```json
{
  "program_id": "<program-id>",
  "parent_branch": "<PARENT_BRANCH>",
  "src_paths": {
    "backend": "<backend_src>",
    "backend_test": "<backend_test>",
    "frontend": "<frontend_src>"
  },
  "phase_plan": { "status": "pending", "phase_count": 0, "iterations": 0 },
  "current_phase": 0,
  "phases": []
}
```

**Commit — program initialized:**
```bash
git add .gitignore runs/<program-id>/original-input.md runs/<program-id>/program.json
git commit -m "chore(<program-id>): initialize program"
```

### Step 7 — Phase Planner loop (max 5 iterations)

**On each iteration:**

a. Invoke the `phase-planner` agent. Pass: program-id, path to
   `runs/<program-id>/original-input.md`, revision notes (empty on first iteration).

b. **Commit — Phase Planner draft/revision:**
   ```bash
   git add runs/<program-id>/phase-plan.md runs/<program-id>/program.json
   # First iteration:
   git commit -m "docs(<program-id>): phase plan draft"
   # Subsequent iterations:
   git commit -m "docs(<program-id>): phase plan revision (iter <n>)"
   ```

c. Invoke `phase-planner-validator`. Pass: program-id, paths to original-input.md
   and phase-plan.md.

d. Keep `program.json` `phase_plan.status = "in_progress"` while the loop runs. Do
   NOT store the validator's pass/fail in `phase_plan.status` (that field tracks plan
   lifecycle: pending → in_progress → frozen → escalated).

e. **Commit — Phase Planner validation outcome:**
   ```bash
   git add runs/<program-id>/program.json
   # On pass:
   git commit -m "docs(<program-id>): phase plan passed validation"
   # On fail:
   git commit -m "docs(<program-id>): phase plan failed validation (iter <n>)"
   ```

f. If `"status": "fail"`:
   - Increment `program.json` `phase_plan.iterations`.
   - If `phase_plan.iterations` < 5: re-invoke `phase-planner` with the validator's
     report as revision notes. Repeat from (a).
   - If `phase_plan.iterations` = 5: set `program.json` `phase_plan.status =
     "escalated"` and say to the user:
     > "The Phase Planner failed validation 5 times. Here is the report. Provide
     > guidance and I will try again, or use /agentic-sdlc:cancel-run to cancel."
     Wait for guidance. If guidance is provided, re-invoke `phase-planner` with it
     (the counter does not reset). If the user cancels, stop.

g. If `"status": "pass"`: proceed to Step 8.

### Step 8 — User review gate: phase plan
Read and display `runs/<program-id>/phase-plan.md` in full.

Say:
> "The Phase Planner proposes **<N> phase(s)** (Version <n>). Reply **'approve'**
> to freeze the plan and begin Phase 1, or describe what to change."

Wait for response:
- **"approve"** (case-insensitive):
  1. Set `program.json` `phase_plan.status = "frozen"`, `phase_plan.phase_count =
     <N>`, `current_phase = 1`, and populate `phases` from the plan — one entry per
     phase:
     ```json
     { "phase": 1, "folder": "phase-01", "title": "<phase 1 title>", "status": "in_progress" }
     ```
     (Phases 2..N get `"status": "pending"` and `"folder": "phase-0N"`.)
  2. Create `runs/<program-id>/phase-01/`.
  3. Write `runs/<program-id>/phase-01/raw-input.md` containing **only Phase 1's
     scope**, extracted from the phase plan:
     ```markdown
     # Raw Input
     Run ID: <program-id>/phase-01
     Phase: 1 of <N>
     Captured: <YYYY-MM-DD HH:MM>

     <Phase 1 goal + scope, copied from phase-plan.md Phase 1>
     ```
  4. Write `runs/<program-id>/phase-01/state.json` (see schema below).
  5. **Commit — phase plan frozen, Phase 1 created:**
     ```bash
     git add runs/<program-id>/program.json runs/<program-id>/phase-01/
     git commit -m "docs(<program-id>): phase plan frozen — Phase 1 started"
     ```
  6. Proceed to Step 9 (BA loop).
- **Any other response**: treat as revision notes. Increment `program.json`
  `phase_plan.iterations`, then re-invoke `phase-planner` with those notes. Repeat
  from Step 7. (User revision counts toward the 5-iteration limit.)

### Phase 1 state.json schema
```json
{
  "run_id": "<program-id>/phase-01",
  "program_id": "<program-id>",
  "phase_number": 1,
  "phase_plan_path": "runs/<program-id>/phase-plan.md",
  "branch": "agentic-sdlc/<program-id>/phase-01",
  "parent_branch": "<PARENT_BRANCH>",
  "current_stage": "ba",
  "spec_frozen": false,
  "src_paths": {
    "backend": "<backend_src>",
    "backend_test": "<backend_test>",
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
    "devops": { "status": "pending", "iterations": 0 }
  },
  "stories": {}
}
```

### Step 9 — BA loop (max 5 iterations)

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

### Step 10 — User review gate
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
- **Any other response**: treat as revision notes. Re-invoke `ba` agent with those notes. Repeat BA loop from Step 9. (User revision counts toward the 5-iteration limit.)

## Spec freeze
Do not set `spec_frozen` here. That happens after Tech Lead approval in /advance-stage.

---

## Brownfield flow

Entered from Step 3b when existing code is detected and the user did not force
greenfield. A brownfield change is a standalone run — it does NOT use the
program/phase model.

### Step B1 — Create the change id and branch
- `run_id = change-YYYY-MM-DD-NNN` (today's date; scan `runs/change-*` for the next
  zero-padded sequence, else `001`).
- Capture the parent branch and create the run branch:
  ```bash
  PARENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  git checkout -b agentic-sdlc/<run-id>
  ```
- Ensure `.gitignore` covers generated artifacts exactly as in the greenfield Step 5
  (reuse that list).

### Step B2 — Create the run directory and capture the request
- Create `runs/<run-id>/`.
- Write `runs/<run-id>/raw-input.md`:
  ```markdown
  # Raw Input
  Run ID: <run-id>
  Mode: brownfield
  Captured: <YYYY-MM-DD HH:MM>

  <user's change request verbatim>
  ```
- Write `runs/<run-id>/state.json` with the **pre-triage** shape:
  ```json
  {
    "run_id": "<run-id>",
    "mode": "brownfield",
    "tier": null,
    "parent_branch": "<PARENT_BRANCH>",
    "branch": "agentic-sdlc/<run-id>",
    "src_paths": { "backend": "<backend_src>", "backend_test": "<backend_test>", "frontend": "<frontend_src>" },
    "codebase_context_path": "runs/<run-id>/codebase-context.md",
    "infra_change_required": false,
    "test_baseline": { "captured": false, "preexisting_failures": [] },
    "spec_frozen": false,
    "current_stage": "survey",
    "pipeline": [],
    "stages": { "survey": { "status": "in_progress", "iterations": 0 }, "survey_validation": { "status": "pending", "iterations": 0 }, "user_review_triage": { "status": "pending" } },
    "stories": {}
  }
  ```
- **Commit:**
  ```bash
  git add .gitignore runs/<run-id>/raw-input.md runs/<run-id>/state.json
  git commit -m "chore(<run-id>): initialize brownfield change run"
  ```

### Step B3 — Surveyor shallow recon (triage) + validator loop (max 5)
On each iteration:
a. Invoke `code-surveyor`. Pass: run-id, the request, src paths, depth = `shallow`,
   plus validator notes on later iterations.
b. **Commit:** `git add runs/<run-id>/codebase-context.md runs/<run-id>/state.json`
   then `git commit -m "docs(<run-id>): codebase survey (recon)"`.
c. Invoke `code-surveyor-validator`. Pass: run-id, request, codebase-context.md.
   Update `stages.survey_validation`. Commit the state change.
d. On `fail` + iterations < 5: increment `stages.survey.iterations`, re-invoke with
   the report. On `fail` + iterations = 5: set `stages.survey.status = "escalated"`,
   escalate to the user, wait for guidance. On `pass`: set `stages.survey.status =
   "complete"`, also copy `infra_change_required` and the baseline into state
   (`test_baseline.captured = true`, `preexisting_failures` from the survey), commit,
   continue to B4.

### Step B4 — Triage gate
Display the `## Impact map`, `## Test baseline`, and `## Proposed tier` from
`codebase-context.md`. Say:
> "Survey complete. Proposed tier: **<tier>** — <one-line rationale>. Reply
> **'approve'** to proceed at this tier, or name a different tier (`bug_fix`,
> `small_change`, `new_feature`)."

Resolve the confirmed `tier`:
- `approve` → use the proposed tier.
- a tier name → use that tier.
- anything else → treat as revision notes for the surveyor; re-run B3.

Then set `state.tier`, set `state.pipeline` to the confirmed tier's profile, mark
`survey`/`survey_validation`/`user_review_triage` complete, and initialize a
`stages` entry (`status: "pending"`, `iterations: 0` where applicable) for every
remaining pipeline stage. Set `current_stage` to the first remaining stage. (If the
user picks the new_feature **split** option below, this flat pipeline is discarded
when the run is converted to a program — see Brownfield program flow.)

**Tier profiles (the `pipeline` array):**
```text
bug_fix      = ["survey","survey_validation","user_review_triage",
                "development","devops"]
small_change = ["survey","survey_validation","user_review_triage",
                "change_spec","change_spec_validation","user_review_change_spec",
                "tech_lead","tech_lead_validation","user_review_stories",
                "development","devops"]
new_feature  = ["survey","survey_validation","user_review_triage",
                "ba","ba_validation","user_review_req",
                "architect","architect_validation","user_review_tech",
                "tech_lead","tech_lead_validation","user_review_stories",
                "development","devops"]
```

Tier-specific finalization at the gate:
- **bug_fix:** there is no later spec gate, so freeze the diagnosis now — set
  `spec_frozen = true`. Synthesize the change brief into stories: for each affected
  track in the impact map, write `runs/<run-id>/stories/STORY-001.md`
  (and `STORY-002.md` if both tracks) with the request as description, the impact
  map's files under an `Implements`/`Touches` note, and acceptance criteria derived
  from the request; set `track` and `wave: 1`. Populate `state.stories` accordingly.
- **new_feature:** re-survey at depth = `deep` (one `code-surveyor` call, then
  commit) so the architecture map is filled. Then decide single vs. multi-feature:
  > "This is a new feature. Is it **one** feature, or **several** features to add
  > together? (If the survey flagged multiple distinct features, say so here.) Reply
  > **single** for one combined change run (one PR), or **split** to plan it as
  > ordered phases that each ship as their own PR."
  - **single** (default) → continue with the flat change-run new_feature pipeline
    below.
  - **split** → do NOT set a flat pipeline. Convert this run to a brownfield program
    and run the Phase Planner — go to **Brownfield program flow** below and stop the
    flat change-run path here.
- **small_change:** no extra work here.

- **Commit:**
  ```bash
  git add runs/<run-id>/state.json runs/<run-id>/codebase-context.md runs/<run-id>/stories/
  git commit -m "docs(<run-id>): tier <tier> confirmed — pipeline set"
  ```

### Step B5 — Hand off to advance-stage
Immediately invoke the `agentic-sdlc:advance-stage` skill and follow its
instructions (it will detect the brownfield run and drive the pipeline). Do NOT ask
the user to run a command — continue without pausing.

---

## Brownfield program flow (multi-feature new-feature)

Entered from Step B4 when the user chose **split**. Converts the provisional
`change-*` run into a brownfield **program** and runs the Phase Planner, so each
feature ships as its own phase PR. The program reuses the greenfield program/phase
machinery; brownfield-awareness comes from the `mode: "brownfield"` flag carried on
`program.json` and every phase `state.json`.

### Step BP1 — Convert the change run into a program
1. Generate a program id `program-YYYY-MM-DD-NNN` (scan `runs/` for `program-*`).
2. Create `runs/<program-id>/`. Move `codebase-context.md` there:
   `runs/<change-run-id>/codebase-context.md` → `runs/<program-id>/codebase-context.md`.
3. Write `runs/<program-id>/original-input.md` in the standard greenfield
   `original-input.md` format (see Step 6 — `# Original Input` / `Program ID:` /
   `Captured:` header), with the change request body copied verbatim from the change
   run's `raw-input.md`.
4. Rename the branch:
   ```bash
   git branch -m agentic-sdlc/<change-run-id> agentic-sdlc/<program-id>/phase-01
   ```
5. Write `runs/<program-id>/program.json` (brownfield program — read `parent_branch`,
   `infra_change_required`, and `test_baseline` from the change run's `state.json`
   **before** deleting it in step 6, and copy them in):
   ```json
   {
     "program_id": "<program-id>",
     "mode": "brownfield",
     "parent_branch": "<PARENT_BRANCH>",
     "codebase_context_path": "runs/<program-id>/codebase-context.md",
     "infra_change_required": false,
     "test_baseline": { "captured": true, "preexisting_failures": [] },
     "src_paths": { "backend": "<backend_src>", "backend_test": "<backend_test>", "frontend": "<frontend_src>" },
     "phase_plan": { "status": "pending", "phase_count": 0, "iterations": 0 },
     "current_phase": 0,
     "phases": []
   }
   ```
6. Delete the migrated `runs/<change-run-id>/` directory (the flat run is superseded).
7. **Commit:**
   ```bash
   git add -A
   git commit -m "chore(<program-id>): convert brownfield change to program"
   ```

### Step BP2 — Phase Planner loop, then phase-plan gate
Run the greenfield **Step 7 (Phase Planner loop)** and **Step 8 (phase-plan gate)**
exactly as written, with these brownfield deltas:
- Pass `runs/<program-id>/codebase-context.md` and `mode = brownfield` to the
  `phase-planner`. The planner plans phases as features **added to the existing
  system** — it must not re-plan existing functionality. (The
  `phase-planner-validator` runs unchanged — it checks plan ↔ original-input
  coverage.)
- The requirement source is `runs/<program-id>/original-input.md` (already written).

### Step BP3 — Create the Phase 1 run (brownfield)
At Step 8's "approve" branch, create `runs/<program-id>/phase-01/state.json` with the
**Phase 1 state.json schema** (above), plus these brownfield fields:
`"mode": "brownfield"`, `"codebase_context_path":
"runs/<program-id>/codebase-context.md"`, `"infra_change_required": <from
program.json>`, and `"test_baseline": <from program.json>`. There is **no**
survey/triage stage in the phase — the program-level survey already ran;
`current_stage = "ba"`.

### Step BP4 — BA loop + hand off
Run the greenfield **Step 9 (BA loop)** and **Step 10 (req-spec gate)** exactly as
written (the BA reads `codebase-context.md` and writes a normal `req-spec.md` in
brownfield mode). On approval, hand off to `agentic-sdlc:advance-stage`, which finds
the program via the normal program scan and drives each phase's brownfield-aware
greenfield sequence. Subsequent phases are started with `/agentic-sdlc:next-phase`
after each phase's PR merges.
