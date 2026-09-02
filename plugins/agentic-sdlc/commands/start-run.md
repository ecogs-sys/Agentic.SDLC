---
description: Start a new Agentic SDLC program. Collects the user's requirement, creates the program directory and branch, drives the program-level BA → Validator loop and requirement-spec gate (once, producing the master req-spec.md), then the Phase Planner → Validator loop and phase-plan gate (splitting that spec into phases by REQ-ID), then creates the Phase 1 run and hands off to advance-stage for the Architect loop and first user review gate.
---

# /agentic-sdlc:start-run

You are the Agentic SDLC orchestrator.

## Your job
Start a new program: collect the requirement, initialize the program, create the
git branch, analyze it into a master requirement spec (BA + Validator loop +
requirement-spec gate, run once), split that spec into phases by REQ-ID (Phase
Planner + Validator loop + phase-plan gate), then create the Phase 1 run and hand
off to `agentic-sdlc:advance-stage` (which drives the Architect loop and
everything after — BA does not run per phase).

## Helper script
State updates, commits, and progress logging go through the helper:
```bash
SDLC() { node "${CLAUDE_PLUGIN_ROOT}/scripts/sdlc.mjs" "$@"; }
```

## Composite run IDs
Each phase is a normal run whose `run_id` is the composite `<program-id>/phase-0N`.
This makes every `runs/<run-id>/…` path resolve to `runs/<program-id>/phase-0N/…`,
so the Tech Lead and development agents need no changes. The BA runs once at the
program root (`runs/<program-id>/req-spec.md`), not per phase; the Architect reads
that master spec via `state.master_req_spec_path`, scoped to `state.req_ids`
(see the Phase 1 state.json schema below).

## User-review gate convention
Follow the gate convention in the `agentic-sdlc:validation-loop` skill: at every
gate, (1) name the exact artifact path under review; (2) show the file's full
contents on first review — or the diff + validator notes on a re-review after
revisions; (3) then ask for approval.

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
> "I will generate a runnable application. Greenfield runs support three fixed archetypes: **web** (.NET 8 Web API + React 18 + Vite + TypeScript + PostgreSQL + Docker Compose), **electron** (TypeScript + Electron + electron-vite + electron-builder desktop app), or **embedded** (C/C++ ESP-IDF firmware for ESP32 — no .NET/React/database). You'll pick which after describing the requirement. If you need something outside all three (Vue web app, Python backend, native mobile, Arduino-framework firmware, etc.), this plugin won't fit — let me know and we can stop here.
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
- **Embedded (ESP-IDF) has code** if Glob finds an `idf_component.yml`, a
  `CMakeLists.txt` containing `idf_component_register`, or a root `sdkconfig`
  anywhere in the workspace. Without this check an existing ESP-IDF project would
  be misclassified as greenfield (it has neither a `.csproj` nor a `package.json`).

- If **none** of the above has code → **greenfield**. Continue with the existing flow
  (Step 4 onward: program init → Phase Planner → ...). Nothing else changes.
- If **any** of the above has code → **brownfield**. Announce and confirm:
  > "I detected existing code, so I'll run in **brownfield** mode (right-sized for a
  > bug fix / small change / new feature on this codebase). Reply **Enter** to
  > continue, or type `greenfield` to force a from-scratch build instead."
  - `greenfield` → fall through to the existing greenfield flow.
  - otherwise → go to **Step B1 (Brownfield flow)** below and do NOT run the
    greenfield Steps 4–9.

### Step 3c — Choose the application archetype (greenfield only)
Greenfield runs build one of three archetypes. Ask:
> "What kind of application is this?
> - **web** (default) — .NET 8 Web API + React 18 + PostgreSQL, shipped with docker-compose.
> - **electron** — a cross-platform Electron desktop app (TypeScript pnpm monorepo, electron-vite, electron-builder). No .NET backend or database.
> - **embedded** — ESP32 firmware in C/C++ with ESP-IDF. No .NET backend, database, or Electron shell. Tests run on ESP-IDF's Linux host target; nothing gets flashed to a physical device automatically.
>
> Reply **web** (or Enter), **electron**, or **embedded**."

- **electron:** set `app_type = "electron"`. The generated code lives in an Electron
  monorepo, so `src_paths` uses a single root: `{ "electron": "<electron_root>" }`
  where `<electron_root>` defaults to the workspace root (`.`). Skip the .NET/React
  path detection from Step 3 — announce: "This Electron app will be generated into
  `<electron_root>/` (apps/desktop + packages/*). Reply with a different root or press
  Enter to continue."
- **embedded:** set `app_type = "embedded"`. The generated code lives in a single
  ESP-IDF project, so `src_paths` uses a single root: `{ "embedded":
  "<embedded_root>" }` where `<embedded_root>` defaults to the workspace root (`.`).
  Skip the .NET/React path detection from Step 3 — announce: "This ESP-IDF firmware
  project will be generated into `<embedded_root>/` (main/ + components/). Reply
  with a different root or press Enter to continue."
- **web / Enter (default):** set `app_type = "web"` and keep the `src_paths`
  (backend/backend_test/frontend) detected in Step 3.

Carry `app_type` and the chosen `src_paths` into `program.json` (Step 6) and each
phase `state.json` (Step 8).

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

**Note on `runs/`:** the workspace `.gitignore` does NOT exclude `runs/`. SDLC artifacts (req-spec, tech-spec, stories, state.json, progress.log) are committed to the run branch as the audit trail. The marketplace repo's own `.gitignore` excludes `runs/` because that's a separate concern (don't pollute the marketplace with users' run artifacts). This is intentional, not an oversight.

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

# ESP-IDF build artifacts
**/build/
managed_components/
sdkconfig.old

# Test coverage
**/coverage*/

# Logs (run progress logs are NOT excluded — they live under runs/)
*.log
!runs/**/progress.log

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
  "app_type": "<web | electron | embedded>",
  "src_paths": { "...": "web: {backend, backend_test, frontend}; electron: {electron: <electron_root>}; embedded: {embedded: <embedded_root>}" },
  "req_spec": { "status": "pending", "iterations": 0 },
  "phase_plan": { "status": "pending", "phase_count": 0, "iterations": 0 },
  "current_phase": 0,
  "phases": []
}
```

**Commit — program initialized:**
```bash
SDLC commit-step "chore(<program-id>): initialize program" .gitignore runs/<program-id>/original-input.md runs/<program-id>/program.json
```

### Step 7 — Program-level BA loop (max 5 iterations)

This is the `agentic-sdlc:validation-loop` protocol applied at the **program**
level, run **once** — before the Phase Planner splits the result into phases.
State lives in `program.json` (`req_spec.status` is a lifecycle field: pending
→ in_progress → frozen → escalated — do NOT store the validator's pass/fail in
it; iterations live in `req_spec.iterations`).

Before the first iteration set `req_spec.status = "in_progress"`
(`SDLC set-field runs/<program-id>/program.json req_spec.status in_progress` —
ships with the first draft commit) and leave it `in_progress` for the whole loop.

**On each iteration:**

a. Banner `▶ [req-spec] ba (iter <i>/5)`; invoke the `ba` agent (description:
   `"req-spec iter <i>"`). Pass: program-id, the path to
   `runs/<program-id>/original-input.md`, revision notes (empty on first iteration).

b. **Commit — draft/revision:**
   ```bash
   SDLC commit-step "docs(<program-id>): BA req-spec draft" runs/<program-id>/req-spec.md runs/<program-id>/program.json
   # revisions: "docs(<program-id>): BA req-spec revision (iter <n>)"
   ```

c. Invoke `ba-validator`. Pass: program-id, paths to original-input.md and
   req-spec.md. Print the `✔`/`✖` banner with its status.

d. Route (validation outcomes get no standalone commit — the state ships with the
   next commit):
   - **fail, iterations < 5:** `SDLC set-field runs/<program-id>/program.json
     req_spec.iterations <n+1>`, re-invoke `ba` with the validator's report as
     revision notes. Repeat from (a).
   - **fail, iterations = 5:** set `req_spec.status = "escalated"`, commit
     (`"docs(<program-id>): req-spec escalated"`), emit the escalation block
     (validation-loop skill), and wait. On guidance, re-invoke `ba` (the
     counter does not reset). If the user cancels, stop.
   - **pass:** proceed to Step 8.

### Step 8 — User review gate: requirement spec

Apply the gate convention on **`runs/<program-id>/req-spec.md`** (full contents
on first review; diff + validator notes on a re-review).

Say:
> "The Business Analyst has produced the master requirement spec (Version <n>).
> Reply **'approve'** to freeze it and continue to phase planning, or describe
> what to change."

Wait for response:
- **"approve"** (case-insensitive):
  1. Set `program.json` `req_spec.status = "frozen"`.
  2. **Commit — requirement spec approved:**
     ```bash
     SDLC commit-step "docs(<program-id>): requirement spec approved" runs/<program-id>/program.json
     ```
  3. Proceed to Step 9.
- **Any other response**: treat as revision notes. Increment `req_spec.iterations`,
  then re-invoke `ba` with those notes. Repeat from Step 7. (User revision counts
  toward the 5-iteration limit.)

### Step 9 — Phase Planner loop (max 5 iterations)

This is the `agentic-sdlc:validation-loop` protocol applied at the **program**
level: state lives in `program.json` (`phase_plan.status` is a lifecycle field:
pending → in_progress → frozen → escalated — do NOT store the validator's
pass/fail in it; iterations live in `phase_plan.iterations`).

Before the first iteration set `phase_plan.status = "in_progress"`
(`SDLC set-field runs/<program-id>/program.json phase_plan.status in_progress` —
ships with the first draft commit) and leave it `in_progress` for the whole loop.

**On each iteration:**

a. Banner `▶ [phase-plan] phase-planner (iter <i>/5)`; invoke the `phase-planner`
   agent (description: `"phase plan iter <i>"`). Pass: program-id, the path to
   `runs/<program-id>/req-spec.md` (the approved master req-spec), revision notes (empty on first iteration).

b. **Commit — draft/revision:**
   ```bash
   SDLC commit-step "docs(<program-id>): phase plan draft" runs/<program-id>/phase-plan.md runs/<program-id>/program.json
   # revisions: "docs(<program-id>): phase plan revision (iter <n>)"
   ```

c. Invoke `phase-planner-validator`. Pass: program-id, paths to req-spec.md
   and phase-plan.md. Print the `✔`/`✖` banner with its status.

d. Route (validation outcomes get no standalone commit — the state ships with the
   next commit):
   - **fail, iterations < 5:** `SDLC set-field runs/<program-id>/program.json
     phase_plan.iterations <n+1>`, re-invoke `phase-planner` with the validator's
     report as revision notes. Repeat from (a).
   - **fail, iterations = 5:** set `phase_plan.status = "escalated"`, commit
     (`"docs(<program-id>): phase plan escalated"`), emit the escalation block
     (validation-loop skill), and wait. On guidance, re-invoke `phase-planner`
     (the counter does not reset). If the user cancels, stop.
   - **pass:** proceed to Step 10.

### Step 10 — User review gate: phase plan
Apply the gate convention on **`runs/<program-id>/phase-plan.md`** (full contents
on first review; diff + validator notes on a re-review).

Say:
> "The Phase Planner proposes **<N> phase(s)** (Version <n>). Reply **'approve'**
> to freeze the plan and begin Phase 1, or describe what to change."

Wait for response:
- **"approve"** (case-insensitive):
  1. Set `program.json` `phase_plan.status = "frozen"`, `phase_plan.phase_count =
     <N>`, `current_phase = 1`, and populate `phases` from the plan's `## Phase
     index` table — one entry per phase, `req_ids` and `app_type` parsed
     mechanically from the table's `REQ-IDs`/`Stack` columns (never
     hand-typed). `src_paths` is looked up for that `app_type`: the program's
     own `src_paths` if it matches (the normal single-archetype case), or —
     for a brownfield program whose `codebase-context.md` lists multiple
     `Detected stacks` — that archetype's own `src_paths` entry from the
     survey:
     ```json
     { "phase": 1, "folder": "phase-01", "title": "<phase 1 title>", "status": "in_progress", "req_ids": ["REQ-001", "REQ-002"], "app_type": "web", "src_paths": { "backend": "...", "backend_test": "...", "frontend": "..." } }
     ```
     (Phases 2..N get `"status": "pending"` and `"folder": "phase-0N"`.)
  2. Create `runs/<program-id>/phase-01/`.
  3. Write `runs/<program-id>/phase-01/state.json` (see schema below), taking
     `app_type`/`src_paths` from the Phase 1 `phases[]` entry just populated
     (not from `program.json`'s top-level `app_type` — for a single-archetype
     program these are the same value anyway). There is no `raw-input.md` for
     a phase — the BA already ran once at the program level; the Architect
     reads its assigned REQ-ID blocks directly from the master `req-spec.md`
     (see `master_req_spec_path` below).
  4. **Commit — phase plan frozen, Phase 1 created:**
     ```bash
     SDLC commit-step "docs(<program-id>): phase plan frozen — Phase 1 started" runs/<program-id>/program.json runs/<program-id>/phase-01/
     ```
  5. Proceed to Step 11 (hand off).
- **Any other response**: treat as revision notes. Increment
  `phase_plan.iterations`, then re-invoke `phase-planner` with those notes. Repeat
  from Step 9. (User revision counts toward the 5-iteration limit.)

### Phase 1 state.json schema
```json
{
  "run_id": "<program-id>/phase-01",
  "program_id": "<program-id>",
  "phase_number": 1,
  "phase_plan_path": "runs/<program-id>/phase-plan.md",
  "master_req_spec_path": "runs/<program-id>/req-spec.md",
  "req_ids": ["REQ-001", "REQ-002"],
  "branch": "agentic-sdlc/<program-id>/phase-01",
  "parent_branch": "<PARENT_BRANCH>",
  "current_stage": "architect",
  "spec_frozen": false,
  "app_type": "<web | electron | embedded>",
  "src_paths": { "...": "web: {backend, backend_test, frontend}; electron: {electron: <electron_root>}; embedded: {embedded: <embedded_root>}" },
  "stages": {
    "architect": { "status": "in_progress", "iterations": 0 },
    "architect_validation": { "status": "pending", "iterations": 0 },
    "user_review_tech": { "status": "pending" },
    "tech_lead": { "status": "pending", "iterations": 0 },
    "tech_lead_validation": { "status": "pending", "iterations": 0 },
    "user_review_stories": { "status": "pending" },
    "user_review_evals": { "status": "pending" },
    "development": { "status": "pending" },
    "devops": { "status": "pending", "iterations": 0 },
    "packaging": { "status": "pending", "iterations": 0 }
  },
  "stories": {}
}
```
There is no `ba` / `ba_validation` / `user_review_req` entry in a phase's
`stages` map — the BA runs once at the program level (Steps 7–8), not per
phase. `req_ids` and `master_req_spec_path` are write-once, copied from
`program.json` at phase-creation time. `app_type` and `src_paths` are also
write-once per phase, but copied from that **phase's own** `phases[]` entry
(its `Stack`, from the phase plan) — not blindly from `program.json`'s
top-level `app_type`. For the ordinary single-archetype program these are
identical; they diverge only for a brownfield program whose phases span more
than one `Detected stacks` archetype (see write-phase-plan's Stack section).

### Step 11 — Hand off to advance-stage
Immediately invoke the `agentic-sdlc:advance-stage` skill and follow its
instructions — it discovers the Phase 1 run (`current_stage = "architect"`) and
drives the Architect → Architect Validator loop, the tech-spec gate, and
everything after (BA already ran once at the program level in Steps 7–8). Do
NOT tell the user to run any command — continue the pipeline without pausing.

## Spec freeze
Do not set `spec_frozen` here. That happens at the eval review gate
(`user_review_evals`) in /advance-stage, after the stories are approved and the evals
are authored.

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
    "app_type": "web",
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
  SDLC commit-step --run runs/<run-id> "chore(<run-id>): initialize brownfield change run" .gitignore runs/<run-id>/raw-input.md
  ```

### Step B3 — Surveyor shallow recon (triage) + validator loop (max 5)
This is the `agentic-sdlc:validation-loop` protocol with CREATOR = `code-surveyor`
(depth = `shallow`), VALIDATOR = `code-surveyor-validator`, ARTIFACT =
`runs/<run-id>/codebase-context.md`, STAGE/VALIDATION_STAGE = `survey` /
`survey_validation`, MSG = `codebase survey (recon)`. Pass the surveyor: run-id,
the request, src paths, depth, plus validator notes on later iterations.

On **pass**: `SDLC set-stage runs/<run-id> survey complete`, copy
`infra_change_required` and the baseline into state (`test_baseline.captured =
true`, `preexisting_failures` from the survey) via `SDLC set-field`, commit,
continue to B4.

### Step B4 — Triage gate
State the path **`runs/<run-id>/codebase-context.md`** to the user, then display its
`## Impact map`, `## Test baseline`, and `## Proposed tier` sections. Say:
> "Survey complete. Proposed tier: **<tier>** — <one-line rationale>. Reply
> **'approve'** to proceed at this tier, or name a different tier (`bug_fix`,
> `small_change`, `new_feature`)."

Resolve the confirmed `tier`:
- `approve` → use the proposed tier.
- a tier name → use that tier.
- anything else → treat as revision notes for the surveyor; re-run B3.

**Resolve `app_type` from the survey.** Read `Proposed app_type` from
`runs/<run-id>/codebase-context.md`'s Stack section and set `state.app_type`
(`web`, `electron`, or `embedded`). This flat pipeline is single-archetype even
when `Detected stacks` lists more than one — if the request genuinely needs
both, tell the user this codebase has multiple archetypes and the change would
be cleaner split into a program (Step B4's `new_feature` → `split` path) so
each archetype gets its own phase; otherwise proceed with the one archetype the
request actually touches. For an `electron` or `embedded` app_type, also
collapse `state.src_paths` to a single project root: `{ "electron": "<monorepo
root, default '.'>" }` or `{ "embedded": "<project root, default '.'>" }`
respectively (the code is edited in place, so this is the existing repo root).

Then set `state.tier`, set `state.pipeline` to the confirmed tier's profile, mark
`survey`/`survey_validation`/`user_review_triage` complete, and initialize a
`stages` entry (`status: "pending"`, `iterations: 0` where applicable) for every
remaining pipeline stage. Set `current_stage` to the first remaining stage. **For
`app_type = electron` or `app_type = embedded`, replace the profile's trailing
`"devops"` entry with `"packaging"`** (the non-web done-gate) before seeding
stages, so the final stage is `packaging`. (If the user picks the new_feature
**split** option below, this flat pipeline is discarded when the run is converted
to a program — see Brownfield program flow.)

**Tier profiles (the `pipeline` array):**
```text
bug_fix      = ["survey","survey_validation","user_review_triage",
                "fix_plan","fix_plan_validation","user_review_fix_plan",
                "user_review_evals","development","devops"]
small_change = ["survey","survey_validation","user_review_triage",
                "fix_plan","fix_plan_validation","user_review_fix_plan",
                "user_review_evals","development","devops"]
new_feature  = ["survey","survey_validation","user_review_triage",
                "ba","ba_validation","user_review_req",
                "architect","architect_validation","user_review_tech",
                "tech_lead","tech_lead_validation","user_review_stories",
                "user_review_evals","development","devops"]
```

Tier-specific finalization at the gate:
- **bug_fix / small_change:** no extra work here — stories come from the
  approved fix plan, not from triage. `spec_frozen` is set at the
  `user_review_evals` gate (the eval review, after the fix-plan gate authors the evals).
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

- **Commit:**
  ```bash
  SDLC commit-step --run runs/<run-id> "docs(<run-id>): tier <tier> confirmed — pipeline set" runs/<run-id>/codebase-context.md runs/<run-id>/stories/
  ```

### Step B5 — Hand off to advance-stage
Immediately invoke the `agentic-sdlc:advance-stage` skill and follow its
instructions (it will detect the brownfield run and load the brownfield-driver
skill). Do NOT ask the user to run a command — continue without pausing.

---

## Brownfield program flow (multi-feature new-feature)

Entered from Step B4 when the user chose **split**. Converts the provisional
`change-*` run into a brownfield **program** and runs the program-level BA and
Phase Planner, so each feature ships as its own phase PR. The program reuses the
greenfield program/phase machinery; brownfield-awareness comes from the
`mode: "brownfield"` flag carried on `program.json` and every phase `state.json`.

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
   `app_type`, `infra_change_required`, and `test_baseline` from the change run's
   `state.json` **before** deleting it in step 6, and copy them in). `app_type`/
   `src_paths` here stay the **default** archetype (the one the flat change-run
   was scoped to before it split) — used only as the fallback for a phase whose
   own `Stack` isn't otherwise resolvable; each phase's `phases[]` entry carries
   its own `app_type`/`src_paths` once the Phase Planner runs (Step BP3/BP4), and
   those win when the two differ (a multi-stack codebase):
   ```json
   {
     "program_id": "<program-id>",
     "mode": "brownfield",
     "app_type": "<web | electron | embedded — from the change run's state.json>",
     "parent_branch": "<PARENT_BRANCH>",
     "codebase_context_path": "runs/<program-id>/codebase-context.md",
     "infra_change_required": false,
     "test_baseline": { "captured": true, "preexisting_failures": [] },
     "src_paths": "<from the change run's state.json — web: {backend, backend_test, frontend}; electron: {electron: <root>}; embedded: {embedded: <root>}>",
     "req_spec": { "status": "pending", "iterations": 0 },
     "phase_plan": { "status": "pending", "phase_count": 0, "iterations": 0 },
     "current_phase": 0,
     "phases": []
   }
   ```
   If `codebase-context.md`'s `Detected stacks` lists more than one archetype,
   the Phase Planner (Step BP3) is what actually routes REQ-IDs to each one —
   this step does not need to enumerate them in `program.json`; they live in
   `codebase-context.md` and, once frozen, in each phase's own `phases[]` entry.
6. Delete the migrated `runs/<change-run-id>/` directory (the flat run is superseded).
7. **Commit** (this migration renames a directory and moves files, so stage
   everything with `--all`):
   ```bash
   SDLC commit-step --all "chore(<program-id>): convert brownfield change to program"
   ```

### Step BP2 — Program-level brownfield BA loop, then requirement-spec gate
Run the greenfield **Step 7 (Program-level BA loop)** and **Step 8 (requirement
spec gate)** exactly as written, with these brownfield deltas:
- Pass both `runs/<program-id>/original-input.md` **and**
  `runs/<program-id>/codebase-context.md`, plus `mode = brownfield`, to the `ba`
  agent. Per the `agentic-sdlc:brownfield-mode` skill, it specifies the delta
  only — requirements **added to the existing system** — and writes the master
  `runs/<program-id>/req-spec.md`. (The `ba-validator` runs unchanged — it
  checks req-spec ↔ original-input coverage.)
- This replaces the pre-v1.0 behavior of feeding `codebase-context.md` straight
  to the Phase Planner with no BA pass.

### Step BP3 — Phase Planner loop, then phase-plan gate
Run the greenfield **Step 9 (Phase Planner loop)** and **Step 10 (phase-plan
gate)** exactly as written, with these brownfield deltas:
- Pass `runs/<program-id>/codebase-context.md` and `mode = brownfield` to the
  `phase-planner` **in addition to** `runs/<program-id>/req-spec.md` (the
  approved master req-spec from Step BP2) — the codebase context prevents the
  planner from re-planning existing functionality; the REQ-IDs to split come
  from `req-spec.md`, not from `codebase-context.md` directly.
- Pass `runs/<program-id>/codebase-context.md` to the `phase-planner-validator`
  too, so it can check each phase's `Stack` against `Detected stacks` (see
  phase-planner-validator's Inputs).

### Step BP4 — Create the Phase 1 run (brownfield)
At Step BP3's "approve" branch, create `runs/<program-id>/phase-01/state.json` with the
**Phase 1 state.json schema** (above — `req_ids` and `master_req_spec_path`
included), copying `app_type` and `src_paths` from the Phase 1 `phases[]` entry
Step BP3 (reusing Step 10) just populated from the phase plan's `Stack`
column — **not** from `program.json`'s top-level `app_type`. For a
single-stack codebase these are the same value; they diverge only when
`codebase-context.md` listed more than one `Detected stacks` entry and the
Phase Planner routed Phase 1 to one of them. Plus these brownfield fields:
`"mode": "brownfield"`,
`"codebase_context_path": "runs/<program-id>/codebase-context.md"`,
`"infra_change_required": <from program.json>`, and `"test_baseline": <from
program.json>`. There is **no** survey/triage stage in the phase — the program-level
survey already ran; `current_stage = "architect"`. (Carrying `app_type` here — and via
`/agentic-sdlc:next-phase` for later phases — keeps an electron or embedded
phase on its single track and the packaging done-gate, whether or not other
phases in the same program are a different archetype.)

### Step BP5 — Hand off
Invoke the `agentic-sdlc:advance-stage` skill — it finds the program via the normal
program scan and drives each phase's brownfield-aware greenfield sequence (starting
at `architect`, since the BA already ran once at the program level in Step BP2).
Subsequent phases are started with `/agentic-sdlc:next-phase` after each phase's
PR merges.
