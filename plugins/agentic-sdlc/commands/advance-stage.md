---
description: Advance the active Agentic SDLC run to its next stage. Reads state.json, invokes the appropriate agent(s) with loops, and pauses at user-review gates.
---

# /agentic-sdlc:advance-stage

You are the Agentic SDLC orchestrator.

## Your job
Read state.json, determine next action, invoke agent(s), update state.

## Finding the active run

### Brownfield change runs
Before the program scan, check for an active brownfield run: any
`runs/change-*/state.json` with `mode == "brownfield"` and `current_stage !=
"complete"`. If one exists, it is the active run — skip the program/phase discovery
and use the **Brownfield driver** section below instead of the greenfield stages.
(Concurrency is already prevented by `/start-run`, so at most one active run of
either kind exists.)

1. Scan `runs/` for the most recent `runs/<program-id>/program.json` (highest
   sequence) whose program is not fully delivered. A program is **fully delivered**
   when `phase_plan.status == "frozen"` AND `current_phase == phase_plan.phase_count`
   AND the `phases[]` entry at `current_phase` has `status: "complete"`.
2. Read `current_phase` from program.json; the active phase folder is the matching
   `phases[]` entry's `folder` (e.g. `phase-02`).
3. The active run is `runs/<program-id>/<phase-folder>/`; its `state.json` drives
   this command exactly as before. The composite `run_id` in that state.json is
   `<program-id>/<phase-folder>`, so every `runs/<run-id>/…` path below resolves to
   `runs/<program-id>/<phase-folder>/…` unchanged.

If no program is found, say: "No active program. Use /agentic-sdlc:start-run to
begin." If a program is found but its active phase is already `complete`, say: "The
current phase is complete. Use /agentic-sdlc:next-phase to start the next phase, or
open its PR to ship it."

## Reading app_type and src_paths
At the start of every command invocation, read `app_type` (default `"web"` if absent — older runs) and `src_paths` from state.json.

For `app_type = electron`, `src_paths` has a single key: `electron` = the monorepo root (e.g. `.`). Pass it to the electron agents as `electron_root`. The backend/frontend keys below apply to `web` runs only.

For `app_type = web`, read `src_paths` from state.json:
```
backend_src  = state.src_paths.backend       (e.g. "src/backend")
backend_test = state.src_paths.backend_test   (e.g. "tests/backend"; default "tests/backend" if absent — older runs)
frontend_src = state.src_paths.frontend       (e.g. "src/frontend")
```
Pass these paths to agents wherever a code directory is needed. .NET test code lives under
`backend_test` (never under `backend_src`); React tests are co-located inside `frontend_src`.

## Brownfield programs (mode == "brownfield" with a program)
A brownfield **program** (created by `/start-run` when a new-feature is split into
multiple features) is found by the normal program scan, and its phases run the
**greenfield** stage sequence below — NOT the flat-run Brownfield driver (that driver
only handles `change-*` runs). When the active phase's `state.json` has
`mode == "brownfield"`:
- Read `codebase_context_path` and pass `codebase-context.md` + `mode = brownfield`
  to every agent (they follow the brownfield-mode skill: read the survey, work the
  delta, no scaffolding).
- In **Stage: development**, the test-reviewer runs the repo's full existing suite
  and compares to `state.test_baseline` — only NEW failures fail the gate;
  pre-existing failures are reported, not fixed.
- In the **final stage**, pick by `app_type`: web runs use **Stage: devops**, electron
  runs use **Stage: packaging**. Run that stage's loop only if
  `state.infra_change_required == true`; otherwise set the stage's status to
  `"skipped"` and proceed to the normal program completion (the `program.json`
  phase-complete update + announcement happen as usual — it IS a program).
- **The phase's tech-spec sets `infra_change_required`.** After the Architect stage,
  read the `**Infra change:**` line from the phase's `tech-spec.md` and set the
  phase's `state.infra_change_required` (`required …` → `true`, `none` → `false`).
  This overrides the program-level default, so a phase that introduces new infra runs
  its devops stage even if the program default was `false`.

## Git commit discipline
Commit after **every** step that produces or updates files. The pattern is always:
```bash
git add <files changed by this step>
git commit -m "<type>(<scope>): <message>"
```
Always include `runs/<run-id>/state.json` when state was updated. Commit messages use conventional commits:
- `docs(<run-id>)` — spec/planning artifacts
- `feat(STORY-XXX)` — production code
- `test(STORY-XXX)` — test code
- `fix(STORY-XXX)` — bug fix in production code
- `chore` — devops, config, tooling

## Stage-lifecycle & status discipline (applies to every stage below)

State is only useful if it reflects reality **while work is happening**, not just after
it finishes. `/agentic-sdlc:show-run-status` and any observer read these fields live, so a
stage that is running MUST report `in_progress` — never sit at `pending` until it jumps to
`complete`.

**Status vocabulary** (the only allowed values): `pending` → `in_progress` → `complete`.
Terminal alternatives: `escalated` (hit the 5-iteration cap, awaiting the user), `skipped`
(stage deliberately not run, e.g. brownfield devops when no infra change), `cancelled`.

**The entry rule — set `in_progress` BEFORE invoking the agent.** At the start of every
stage, loop, validator call, and story, flip the relevant status to `in_progress` *before*
the first agent invocation, then fold that write into the state commit you already make for
that step (do **not** add a separate commit). Concretely, at each point:

| When you begin… | Set to `in_progress` before invoking |
|---|---|
| a creator stage (`ba`, `architect`, `tech_lead`, `development`, `devops`, `change_spec`, `survey`) | `stages.<stage>.status` |
| a validator call | `stages.<stage>_validation.status` |
| a story's engineer→reviewer chain | `state.stories[<id>].status` |

**The exit rule.** On the stage's success set its status (and its validation sub-stage) to
`complete`; at the 5-cap set `escalated`; when a stage is deliberately not run set `skipped`.
Never leave a finished stage at `in_progress` or a started stage at `pending`. In particular,
`stages.development` gets `in_progress` when the first story starts and `complete` when the
last story is done — it is not left at `pending` just because `current_stage` moved on.

If a stage is already `in_progress` (e.g. re-entered after a cross-loop reset), leave it —
only transition `pending → in_progress` and `in_progress → complete/escalated`.

## Test execution discipline

The suite is verified **once per change**, never re-run concurrently. Concurrent agents share one
source tree, build output, test project, and backing store (DB, ports) — so two `dotnet test` /
`npm test` runs at once cause SQL deadlocks, `database is locked`, port-in-use, and net *slowdown*,
never a speedup. Enforce:

- **Serialize the development stage.** Drive **one story at a time** through its full
  engineer → reviewer → test-engineer → test-reviewer chain before starting the next story. **Waves
  express dependency order, not permission to parallelize** — within a wave, process stories in
  story-ID order, one at a time. Never invoke two development/test agents concurrently.
- **One authoritative full-suite run per change**, owned by the **test-reviewer** (plus the single
  end-of-run devops-reviewer pass). Engineers and reviewers build/compile only; the test-engineer
  uses focused `--filter` / `npm test -- --run <path>` runs. No other agent runs the full suite.
- **At most one suite run in flight.** An agent never launches a test run while another is still
  active against the same project/DB. See the dotnet-conventions / react-conventions
  "Build & test execution discipline" sections.

## Spec freeze check
Before invoking any agent: if `spec_frozen = true` and the current stage would modify req-spec.md, tech-spec.md, or any file under `runs/<run-id>/stories/` — do NOT proceed. Say: "The spec is frozen. To make upstream changes, use /agentic-sdlc:cancel-run and start a new run."

## User-review gate convention
At **every** user-review gate, before asking the user to approve: (1) tell them the
exact artifact path under review — e.g. "Reviewing **`runs/<run-id>/req-spec.md`**";
(2) show the file's full contents; (3) then ask for approval. Never ask for approval
without naming the path and showing the file.

---

## Brownfield driver (mode == "brownfield")

Drive the run by its `pipeline` array instead of the fixed greenfield sequence.

1. Read `mode`, `tier`, `pipeline`, `current_stage`, `infra_change_required`,
   `app_type` (default `"web"` if absent), `src_paths`, and `test_baseline` from
   state.json. For `app_type = electron`, `src_paths` has a single `electron` key
   (the monorepo root) — pass it to the electron agents as `electron_root`, and the
   pipeline's final stage is `packaging` rather than `devops`.
2. Run the handler for `current_stage` (table below). Always pass `mode =
   brownfield`, the run-id, and `runs/<run-id>/codebase-context.md` to every agent
   so they follow the brownfield-mode skill.
3. On a stage's completion, set `current_stage` to the **next** entry in `pipeline`;
   commit state. If the next entry is a `user_review_*` gate, run that gate (pause
   for the user) before continuing. If `current_stage` was the last entry, the run
   is complete (handler `devops` finalizes — see below).
4. Reuse the existing greenfield loop bodies for shared stages — same agents,
   commit discipline, 5-iteration caps, and escalation. The only differences are
   listed per handler.

| pipeline stage | handler |
|---|---|
| `change_spec` / `change_spec_validation` / `user_review_change_spec` | NEW — Brownfield change-spec handler (below) |
| `ba` / `ba_validation` / `user_review_req` | reuse Stage: ba (brownfield notes below) |
| `architect` / `architect_validation` / `user_review_tech` | reuse Stage: architect |
| `tech_lead` / `tech_lead_validation` / `user_review_stories` | reuse Stage: tech_lead |
| `development` | reuse Stage: development (brownfield notes below) |
| `devops` | reuse Stage: devops, gated by `infra_change_required` (below) — web runs |
| `packaging` | reuse Stage: packaging, gated by `infra_change_required` (below) — electron runs |

### Brownfield change-spec handler (small_change tier)
Identical shape to the BA loop, but the artifact is `change-spec.md`. Per the stage-lifecycle
rule, set `stages.change_spec.status = "in_progress"` before the first invocation and
`stages.change_spec_validation.status = "in_progress"` when you invoke the validator in (c).
a. Invoke `ba`. Pass: run-id, `runs/<run-id>/raw-input.md`,
   `runs/<run-id>/codebase-context.md`, `mode = brownfield`, and the instruction to
   follow the **write-change-spec** skill and write `runs/<run-id>/change-spec.md`.
b. Commit `runs/<run-id>/change-spec.md` + state (`docs(<run-id>): change-spec
   draft/revision (iter <n>)`).
c. Invoke `ba-validator`. Pass: run-id, raw-input.md, change-spec.md,
   codebase-context.md. (Validator compares request+impact-map → change-spec per the
   validate-traceability schema.) Update `stages.change_spec_validation`; commit.
d. fail/pass loop and 5-cap exactly as the BA loop.
e. **user_review_change_spec gate:** state the path **`runs/<run-id>/change-spec.md`**
   and display its full contents; "approve" → mark complete, advance; other → revision
   notes, re-run the change-spec loop.

### Brownfield notes for reused stages
- **The driver owns transitions and completion.** The reused greenfield handlers
  end with greenfield-specific tails — they update `runs/<program-id>/program.json`,
  say "proceed to Stage: X", and emit the phase-completion announcement. In
  brownfield mode IGNORE those tails: when a handler's work is done, return to this
  driver, advance `current_stage` to the next `pipeline` entry, and at the end use
  **Brownfield completion** below. Brownfield runs have no `program.json` — never
  read or write it; `parent_branch` comes from `state.json`.
- **Spec-input substitution.** Brownfield tiers may not produce a `tech-spec.md`.
  Wherever a reused handler (tech_lead, development engineers, devops) expects
  `runs/<run-id>/tech-spec.md`, substitute the spec the tier actually has:
  - **new_feature** → `tech-spec.md` exists (Architect ran) — use it.
  - **small_change** → use `runs/<run-id>/change-spec.md` + `codebase-context.md`
    (no tech-spec.md is produced).
  - **bug_fix** → use the synthesized story + `codebase-context.md` (no req/tech/
    change spec).
- **ba / architect / tech_lead:** pass `codebase-context.md` and `mode =
  brownfield`. The BA writes a normal `req-spec.md` (new_feature tier only). All
  follow the brownfield-mode skill (delta only). After the **architect** stage
  (new_feature tier), read the tech-spec's `**Infra change:**` line and set
  `state.infra_change_required` accordingly — it overrides the surveyor's initial
  assessment.
- **tech_lead user_review_stories gate (small_change + new_feature):** on approve,
  set `spec_frozen = true` and populate `state.stories` exactly as greenfield.
- **development:** identical to greenfield Stage: development, with these
  differences: stories already exist (bug_fix synthesized them at the triage gate);
  engineers run in brownfield mode (edit in place, no scaffold); the **test reviewer
  runs the full existing suite and compares to `test_baseline`** — only NEW failures
  fail the gate; pre-existing failures are reported, not fixed.
- **devops (conditional — web runs):** when `development` finishes, do NOT follow its
  greenfield "proceed to Stage: devops" tail — return to the driver and advance to the
  `devops` pipeline entry. There, if `infra_change_required == false`, set
  `stages.devops.status = "skipped"` and go to **Brownfield completion**. If `true`,
  run the existing DevOps loop but instruct the DevOps Engineer to **modify
  existing** infra files (compose/.env/Dockerfile) rather than regenerate them,
  following brownfield-mode; on the reviewer's `DONE`, do NOT perform the greenfield
  `program.json`/phase update or announcement — go to **Brownfield completion**.
- **packaging (conditional — electron runs):** identical shape for `app_type =
  electron`, whose final pipeline entry is `packaging` (not `devops`). Return to the
  driver and advance to the `packaging` entry. If `infra_change_required == false`, set
  `stages.packaging.status = "skipped"` and go to **Brownfield completion**. If `true`,
  run the **Stage: packaging** loop but instruct the `electron-packager` to **modify
  existing** packaging config (electron-builder.yml / updater / icons) rather than
  regenerate it, following brownfield-mode; on the reviewer's `DONE`, do NOT perform
  the greenfield `program.json`/phase update or announcement — go to **Brownfield
  completion**.

### Brownfield completion
When the last pipeline stage finishes: set `current_stage = "complete"`, commit
`chore(<run-id>): change run complete`. Announce:
> "Brownfield change `<run-id>` (tier <tier>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. Open a PR from
> `agentic-sdlc/<run-id>` → `<parent_branch>`. The full existing test suite is green
> (no new failures vs the baseline) and new tests cover the change."
If there were pre-existing baseline failures, list them so the user knows they
predate this change.

---

## Stage: ba

> Greenfield only. Brownfield runs are driven by the **Brownfield driver** section
> above and never fall through to these fixed greenfield stages.

This stage runs only when the run was sent **back** to the Business Analyst — either by a "Requirements change" route from the tech-spec review gate (see Stage: architect) or because `current_stage = "ba"` in state.json. (The *first* BA pass of a run is driven by `/agentic-sdlc:start-run`, not here.)

### BA loop (max 5 iterations)

Per the stage-lifecycle rule, set `stages.ba.status = "in_progress"` before the first
invocation (if not already), and set `stages.ba_validation.status = "in_progress"` when you
invoke the validator in step (c).

On each iteration:

a. Invoke the `ba` agent. Pass: run-id, path to raw-input.md, revision notes (the user's change notes on the first iteration; the validator's diff on subsequent iterations).

b. **Commit — BA draft/revision:**
   ```bash
   git add runs/<run-id>/req-spec.md runs/<run-id>/state.json
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

f. If fail + iterations < 5: increment `stages.ba.iterations`, re-invoke `ba` with the validator's diff. Repeat from (a).
   If fail + iterations = 5: set `stages.ba.status = "escalated"`. Escalate to user with the diff; wait for guidance.
   If pass: update `stages.ba.status = "complete"`, `stages.ba_validation.status = "complete"`.

### User review gate — req-spec
State the path **`runs/<run-id>/req-spec.md`** to the user, then display its full contents.
> "The Business Analyst has produced the requirement spec (Version <n>). Reply **'approve'** to continue, or describe what to change."

- **approve:**
  - Update state.json: `stages.user_review_req.status = "complete"`, `current_stage = "architect"`.
  - **Commit — req-spec approved:**
    ```bash
    git add runs/<run-id>/state.json
    git commit -m "docs(<run-id>): requirement spec approved"
    ```
  - Immediately proceed to Stage: architect below.
- **other:** treat as revision notes for the BA, re-run the BA loop.

---

## Stage: architect

### Architect loop (max 5 iterations)

Per the stage-lifecycle rule, set `stages.architect.status = "in_progress"` before the first
invocation, and set `stages.architect_validation.status = "in_progress"` when you invoke the
validator in step (c).

On each iteration:

a. Invoke `architect` agent. Pass: run-id, path to req-spec.md, revision notes if any.

b. **Commit — Architect draft/revision:**
   ```bash
   git add runs/<run-id>/tech-spec.md runs/<run-id>/state.json
   # First iteration:
   git commit -m "docs(<run-id>): Architect tech-spec draft"
   # Subsequent iterations:
   git commit -m "docs(<run-id>): Architect tech-spec revision (iter <n>)"
   ```

c. Invoke `architect-validator`. Pass: run-id, paths to req-spec.md and tech-spec.md.

d. Update `stages.architect_validation` in state.json with the validation outcome.

e. **Commit — Architect validation outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On pass:
   git commit -m "docs(<run-id>): tech-spec passed validation"
   # On fail:
   git commit -m "docs(<run-id>): tech-spec failed validation (iter <n>)"
   ```

f. If fail + iterations < 5: re-invoke architect with diff. Repeat from (a).
   If fail + iterations = 5: set `stages.architect.status = "escalated"`. Escalate to user with diff.
   If pass: update `stages.architect.status = "complete"`, `stages.architect_validation.status = "complete"`.

### User review gate — tech-spec
State the path **`runs/<run-id>/tech-spec.md`** to the user, then display its full contents.
> "The Architect has produced the technical spec (Version <n>). Reply **'approve'** to continue, or describe what to change."

- **approve:**
  - Update state.json: `stages.user_review_tech.status = "complete"`, `current_stage = "tech_lead"`.
  - **Commit — tech-spec approved:**
    ```bash
    git add runs/<run-id>/state.json
    git commit -m "docs(<run-id>): technical spec approved"
    ```
  - Immediately proceed to Stage: tech_lead below.
- **other (a change request):** ask one follow-up to find where the change belongs:
  > "Is this a **requirements** change or a **technical** change?
  > - **requirements** — I'll re-open the Business Analyst. The updated req-spec flows back through the Architect to this gate.
  > - **technical** — I'll have the Architect revise the tech-spec directly."

  - **technical:** treat the user's notes as revision notes for the architect, re-run the Architect loop (existing behaviour).
  - **requirements — route back to BA:**
    1. Update state.json (reset the planning chain; counters to 0 because this is a fresh cross-loop entry that must not inherit spent iteration budget):
       ```
       current_stage               = "ba"
       stages.ba                   = { status: "in_progress", iterations: 0 }
       stages.ba_validation        = { status: "pending",     iterations: 0 }
       stages.user_review_req      = { status: "pending" }
       stages.architect            = { status: "pending", iterations: 0 }
       stages.architect_validation = { status: "pending", iterations: 0 }
       stages.user_review_tech     = { status: "pending" }
       ```
    2. **Commit — re-open BA:**
       ```bash
       git add runs/<run-id>/state.json
       git commit -m "docs(<run-id>): tech-spec review — re-open BA for requirements change"
       ```
    3. Proceed to Stage: ba above, passing the user's change notes as the BA's revision notes. The chain then flows forward as usual: BA → BA Validator → user review req → Architect → Architect Validator → this gate again.

---

## Stage: tech_lead

### Tech Lead loop (max 5 iterations)

Per the stage-lifecycle rule, set `stages.tech_lead.status = "in_progress"` before the first
invocation, and set `stages.tech_lead_validation.status = "in_progress"` when you invoke the
validator in step (c).

On each iteration:

a. Invoke `tech-lead` agent. Pass: run-id, path to tech-spec.md, revision notes if any.

b. **Commit — Tech Lead draft/revision:**
   ```bash
   git add runs/<run-id>/stories/ runs/<run-id>/state.json
   # First iteration:
   git commit -m "docs(<run-id>): Tech Lead stories draft"
   # Subsequent iterations:
   git commit -m "docs(<run-id>): Tech Lead stories revision (iter <n>)"
   ```

c. Invoke `tech-lead-validator`. Pass: run-id, path to tech-spec.md and the runs/<run-id>/stories/ directory (index.md + all STORY-XXX.md files).

d. Update `stages.tech_lead_validation` in state.json with the validation outcome.

e. **Commit — Tech Lead validation outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On pass:
   git commit -m "docs(<run-id>): stories passed validation"
   # On fail:
   git commit -m "docs(<run-id>): stories failed validation (iter <n>)"
   ```

f. If fail + iterations < 5: re-invoke tech-lead with diff. Repeat from (a).
   If fail + iterations = 5: set `stages.tech_lead.status = "escalated"`, commit, then
   escalate to user with the diff and wait for guidance.
   If pass: update `stages.tech_lead.status = "complete"`, `stages.tech_lead_validation.status = "complete"`.

### User review gate + SPEC FREEZE
State the path **`runs/<run-id>/stories/index.md`** to the user, then display it (the execution-plan diagram and story table). Offer to show any individual `STORY-XXX.md` (name its path) on request.
> "The Tech Lead has produced the stories (Version <n>). Reply **'approve'** to freeze the spec and begin development, or describe what to change."

- **approve:**
  1. `stages.user_review_stories.status = "complete"`, `current_stage = "development"`.
  2. **Set `spec_frozen = true`** in state.json.
  3. Parse `runs/<run-id>/stories/index.md`: read the `## Story index` table (columns `Story | Track | Wave | Depends on | Complexity | File`). For each row, add to `state.stories` (capturing `track` and `wave`):
     ```json
     "STORY-001": { "track": "dotnet", "wave": 1, "status": "pending", "reviewer_iterations": 0, "test_reviewer_iterations": 0, "fix_iterations": 0 }
     ```
  4. **Commit — stories approved, spec frozen:**
     ```bash
     git add runs/<run-id>/state.json
     git commit -m "docs(<run-id>): stories approved — spec frozen"
     ```
  5. Immediately proceed to Stage: development below.

### Story-state schema (set when a story is added to `state.stories`)
```json
"STORY-001": {
  "track": "dotnet",
  "wave": 1,
  "status": "pending",
  "reviewer_iterations": 0,        // engineer↔reviewer cycles in the original dev pass
  "test_reviewer_iterations": 0,   // test-engineer↔test-reviewer cycles
  "fix_iterations": 0              // re-entry cycles from BACK_TO_ENGINEER (test or devops)
}
```

> **Why three counters:** the original linear pass is bounded by `reviewer_iterations` and `test_reviewer_iterations` (each capped at 5). When the test reviewer or DevOps reviewer routes BACK_TO_ENGINEER, that is a *new* fix cycle — it must not consume budget that's already spent. `fix_iterations` is reset to 0 on each cross-loop entry and capped at 5 per fix cycle.

> **Story status values & escalation:** a story's `status` is `pending → in_progress →
> complete`, plus `escalated`. Whenever any of a story's loops hits its 5-iteration cap
> (`reviewer_iterations`, `test_reviewer_iterations`, or `fix_iterations`), set
> `state.stories[<id>].status = "escalated"`, commit, and escalate to the user before
> waiting — so `show-run-status` flags the blocked story instead of showing it mid-flight as
> `in_progress`. On the user's fix guidance, set it back to `in_progress` and resume.
- **other:** treat as revision notes for tech-lead, re-run loop.

---

## Stage: development

Read `backend_src`, `backend_test`, and `frontend_src` from `state.src_paths`.

**Stage status:** the moment you begin the first story, set `stages.development.status =
"in_progress"` (fold into that story's first state commit). When the last story is complete,
set `stages.development.status = "complete"` (see the completion block below). Do not leave
this stage at `pending` while stories are being built.

Process stories by **wave**: handle wave 1 first, then wave 2, and so on (read `wave` from `state.stories`). Within a wave, process in story-ID order. This honours the dependency graph computed by the Tech Lead. Use state.stories to track which are complete.

For each pending story:
1. Read the story content from `runs/<run-id>/stories/STORY-XXX.md` (self-contained).
   Then **set `state.stories[<story-id>].status = "in_progress"`** before invoking its
   engineer (fold into the engineer-draft commit in the Engineer→Reviewer loop). This makes
   the currently-building story observable in `show-run-status` instead of jumping
   pending→complete.
2. Determine track and paths from `app_type`:
   - **web run** — the story's track is `dotnet` or `react`:
     - **dotnet track:** `src_path = backend_src`, `test_path = backend_test`.
     - **react track:** `src_path = frontend_src`, `test_path = frontend_src` (tests are co-located).
   - **electron run** — every story's track is `electron`:
     - `src_path = test_path = electron_root` (pass it to the agents as `electron_root`; tests are co-located).

### 3. Engineer → Reviewer loop (max 5 iterations)

a. Invoke the engineer for the story's track: `dotnet-engineer`, `react-engineer`, or (electron runs) `electron-engineer`. Pass: run-id, story ID, story content, runs/<run-id>/tech-spec.md, and the paths — `src_path` (and `test_path`/`backend_test` for the dotnet track; for electron pass `electron_root`).

b. **Commit — Engineer draft/revision** (include `<test_path>` too — the dotnet scaffold creates the test project under it):
   ```bash
   git add <src_path> <test_path> runs/<run-id>/state.json
   # First iteration:
   git commit -m "feat(STORY-XXX): engineer draft"
   # Subsequent iterations (reviewer feedback):
   git commit -m "feat(STORY-XXX): engineer revision — reviewer feedback (iter <n>)"
   # After BACK_TO_ENGINEER from test reviewer:
   git commit -m "fix(STORY-XXX): fix production bug — test failure (iter <n>)"
   ```

c. Invoke the reviewer for the story's track: `dotnet-reviewer`, `react-reviewer`, or `electron-reviewer`. Pass: run-id, story ID, story content, modified files list, src_path (electron: `electron_root`).

d. Update `stages` and story reviewer_iterations in state.json.

e. **Commit — Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On PASS:
   git commit -m "feat(STORY-XXX): reviewer PASS"
   # On FAIL:
   git commit -m "feat(STORY-XXX): reviewer FAIL (iter <n>)"
   ```

f. If FAIL + reviewer_iterations < 5: increment, re-invoke engineer with reviewer issues. Repeat from (a).
   If FAIL + reviewer_iterations = 5: escalate to user. Wait for guidance.
   If PASS: continue to test loop.

### 4. Test Engineer → Test Reviewer loop (max 5 iterations)

a. Invoke the test engineer for the story's track: `dotnet-test-engineer`, `react-test-engineer`, or `electron-test-engineer`. Pass: run-id, story ID, story content, src_path, test_path (dotnet: `test_path = backend_test`; electron: `electron_root`).

b. **Commit — Test Engineer draft/revision:**
   ```bash
   git add <test_path> runs/<run-id>/state.json
   # First iteration:
   git commit -m "test(STORY-XXX): test engineer draft"
   # Subsequent iterations:
   git commit -m "test(STORY-XXX): test engineer revision — coverage feedback (iter <n>)"
   ```

c. Invoke the test reviewer for the story's track: `dotnet-test-reviewer`, `react-test-reviewer`, or `electron-test-reviewer`. Pass: run-id, story ID, story content, src_path, test_path (electron: `electron_root`).

d. Update story test_reviewer_iterations in state.json.

e. **Commit — Test Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On DONE:
   git commit -m "test(STORY-XXX): test reviewer PASS"
   # On BACK_TO_TEST_ENGINEER:
   git commit -m "test(STORY-XXX): test reviewer — needs revision (iter <n>)"
   # On BACK_TO_ENGINEER:
   git commit -m "test(STORY-XXX): test reviewer — production bug found (iter <n>)"
   ```

f. `DONE`:
   - Mark `state.stories[story_id].status = "complete"` in state.json.
   - **Commit — story complete:**
     ```bash
     git add runs/<run-id>/state.json
     git commit -m "feat(STORY-XXX): story complete"
     ```
   - Move to next story.

g. `BACK_TO_TEST_ENGINEER`: increment test_reviewer_iterations. If < 5: re-invoke test engineer. Repeat from (a). If = 5: escalate.

h. `BACK_TO_ENGINEER`: **reset `fix_iterations` to 0** (it is a fresh cross-loop entry), then re-invoke the engineer with the failing test info. Repeat from Engineer → Reviewer loop step (a), but use `fix_iterations` (capped at 5) instead of `reviewer_iterations` for the fix cycle. Use the fix commit message. After the fix passes, re-run the test loop (a)–(g) — but do NOT reset `test_reviewer_iterations`; it continues from where it was.

After all stories complete:
- Set `stages.development.status = "complete"` in state.json. Choose the final stage by `app_type`:
  - **web:** set `current_stage = "devops"` and set `stages.packaging.status = "skipped"`.
  - **electron:** set `current_stage = "packaging"` and set `stages.devops.status = "skipped"`.
- **Commit — development complete:**
  ```bash
  git add runs/<run-id>/state.json
  git commit -m "docs(<run-id>): all stories complete"
  ```
- Immediately proceed to the chosen final stage: **Stage: devops** (web) or **Stage: packaging** (electron) below.

---

## Stage: packaging  *(electron runs only)*

Runs instead of DevOps when `app_type = electron`. Read `electron_root` from `src_paths.electron`.

### Packaging loop (max 5 iterations)

Per the stage-lifecycle rule, set `stages.packaging.status = "in_progress"` before the first `electron-packager` invocation (fold into the packager-draft commit).

a. Invoke `electron-packager`. Pass: run-id, `electron_root`, path to runs/<run-id>/tech-spec.md.

b. **Commit — Packager draft/revision:**
   ```bash
   git add <electron_root> runs/<run-id>/state.json
   # First iteration:
   git commit -m "chore: electron packager draft"
   # Subsequent iterations:
   git commit -m "chore: electron packager revision — reviewer feedback (iter <n>)"
   ```

c. Invoke `electron-packager-reviewer`. Pass: run-id, `electron_root`, path to runs/<run-id>/tech-spec.md.

d. Update `stages.packaging` in state.json.

e. **Commit — Packager Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On DONE:
   git commit -m "chore: electron packager reviewer PASS"
   # On BACK_TO_PACKAGER:
   git commit -m "chore: electron packager reviewer — needs revision (iter <n>)"
   # On BACK_TO_ELECTRON_ENGINEER:
   git commit -m "chore: electron packager reviewer — code fix required (iter <n>)"
   # On HUMAN_REVIEW_REQUIRED:
   git commit -m "chore: electron packager reviewer — awaiting human decision"
   ```

f. Read the reviewer's `**Routing decision:**`:
   - `DONE`:
     - `stages.packaging.status = "complete"`, `current_stage = "complete"`.
     - **Commit — run complete:**
       ```bash
       git add runs/<run-id>/state.json
       git commit -m "chore(<run-id>): run complete"
       ```
     - Update the matching `phases[]` entry in `runs/<program-id>/program.json` to `"status": "complete"` and commit:
       ```bash
       git add runs/<program-id>/program.json
       git commit -m "docs(<program-id>): phase <phase_number> complete"
       ```
     - Do NOT start the next phase automatically. Announce completion (see the Electron completion announcement below).
   - `BACK_TO_PACKAGER`: increment packaging iterations. If < 5: re-invoke electron-packager with reviewer issues. Repeat from (a).
   - `BACK_TO_ELECTRON_ENGINEER <story-id>`:
     - **Reset `state.stories[<story-id>].fix_iterations = 0`** (fresh cross-loop entry from packaging).
     - Re-invoke `electron-engineer` for that story with the failing context (passing `electron_root`); commit the engineer fix (feat/fix commit pattern).
     - Re-invoke `electron-reviewer`; commit the outcome. If it FAILs and fix_iterations < 5: increment, re-invoke engineer; loop. If = 5: escalate.
     - Once the reviewer passes: re-invoke `electron-test-engineer`, commit; then `electron-test-reviewer`, commit. If all pass: re-invoke `electron-packager`.
   - `HUMAN_REVIEW_REQUIRED`: present the ambiguity to the user, wait for the decision, and use it as context for the next electron-packager invocation.
   - If packaging iterations = 5: set `stages.packaging.status = "escalated"`, commit, escalate to the user.

### Electron completion announcement
Read `parent_branch` from `program.json`. Announce:
> "Phase <phase_number> (run <run-id>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. To ship:
> 1. Open a pull request from `agentic-sdlc/<run-id>` → `<parent_branch>`
> 2. Review the generated Electron app in `<electron_root>/` (apps/desktop + packages/*)
>
> To run the app locally now:
> 1. `cd <electron_root> && pnpm install`
> 2. `pnpm dev` to launch in development, or `pnpm package` to build distributables"

Then add the same program-level next-step note used by the web completion announcement
(last phase → "all phases delivered"; otherwise → "run /agentic-sdlc:next-phase").

### Brownfield note
When `mode = brownfield` and `app_type = electron`, the packaging stage is
**conditional** exactly like devops: run it only if `state.infra_change_required ==
true` (e.g. a new OS target, updater feed, or native dependency); otherwise set
`stages.packaging.status = "skipped"` and go straight to completion. Instruct the
packager to MODIFY existing packaging config rather than regenerate it.

---

## Stage: devops

Read `backend_src` and `frontend_src` from `state.src_paths`.

### DevOps loop (max 5 iterations)

Per the stage-lifecycle rule, set `stages.devops.status = "in_progress"` before the first
`devops-engineer` invocation (fold into the DevOps-draft commit).

a. Invoke `devops-engineer`. Pass: run-id, backend_src, frontend_src, path to runs/<run-id>/tech-spec.md.

b. **Commit — DevOps Engineer draft/revision:**
   ```bash
   git add <backend_src>/Dockerfile <frontend_src>/Dockerfile <frontend_src>/nginx.conf \
           docker-compose.yml .env.example README.md runs/<run-id>/state.json
   # First iteration:
   git commit -m "chore: DevOps Engineer draft"
   # Subsequent iterations:
   git commit -m "chore: DevOps Engineer revision — reviewer feedback (iter <n>)"
   ```

c. Invoke `devops-reviewer`. Pass: run-id, backend_src, frontend_src.

d. Update `stages.devops` in state.json.

e. **Commit — DevOps Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On DONE:
   git commit -m "chore: DevOps reviewer PASS"
   # On BACK_TO_DEVOPS:
   git commit -m "chore: DevOps reviewer — needs revision (iter <n>)"
   # On BACK_TO_*_ENGINEER:
   git commit -m "chore: DevOps reviewer — code fix required (iter <n>)"
   # On HUMAN_REVIEW_REQUIRED:
   git commit -m "chore: DevOps reviewer — awaiting human decision"
   ```

f. Read reviewer's `**Routing decision:**`:
   - `DONE`:
     - `stages.devops.status = "complete"`, `current_stage = "complete"`.
     - **Commit — run complete:**
       ```bash
       git add runs/<run-id>/state.json
       git commit -m "chore(<run-id>): run complete"
       ```
     - Update the matching `phases[]` entry in `runs/<program-id>/program.json` to
       `"status": "complete"` and commit:
       ```bash
       git add runs/<program-id>/program.json
       git commit -m "docs(<program-id>): phase <phase_number> complete"
       ```
     - Do NOT start the next phase automatically. Crossing a phase boundary is the
       deliberate `/agentic-sdlc:next-phase` step.
     - Announce completion (see below).
   - `BACK_TO_DEVOPS`: increment devops iterations. If < 5: re-invoke devops-engineer with reviewer issues. Repeat from (a).
   - `BACK_TO_DOTNET_ENGINEER <story-id>`:
     - **Reset `state.stories[<story-id>].fix_iterations = 0`** (this is a fresh cross-loop entry from DevOps; pre-existing reviewer_iterations from the dev phase do NOT apply).
     - Re-invoke dotnet-engineer for that story with the failing context (passing backend_src).
     - **Commit engineer fix** (see engineer commit pattern above).
     - Re-invoke dotnet-reviewer.
     - **Commit reviewer outcome.**
     - If reviewer FAILs and fix_iterations < 5: increment, re-invoke engineer. Loop. If = 5: escalate.
     - Once reviewer passes: re-invoke dotnet-test-engineer.
     - **Commit test engineer.**
     - Re-invoke dotnet-test-reviewer.
     - **Commit test reviewer outcome.**
     - If all pass: re-invoke devops-engineer.
   - `BACK_TO_REACT_ENGINEER <story-id>`: same flow for react track (also reset `fix_iterations` to 0).
   - `HUMAN_REVIEW_REQUIRED`: present the ambiguity to the user. Wait for decision. Use their decision as context for next devops-engineer invocation.
   - If devops iterations = 5: escalate to user.

### Completion announcement
Read `parent_branch` from `program.json` (the branch the program was started from —
the PR target). Announce:
> "Phase <phase_number> (run <run-id>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. To ship:
> 1. Open a pull request from `agentic-sdlc/<run-id>` → `<parent_branch>`
> 2. Review the generated code in `<backend_src>/` and `<frontend_src>/`
>
> To run the app locally now:
> 1. Copy `.env.example` to `.env` and fill in passwords
> 2. `docker compose up --build`
> 3. Open the frontend at the FRONTEND_PORT given in `tech-spec.md` (e.g. http://localhost:3000)"

Then add the program-level next step:
- If this was the **last** phase (`current_phase == phase_plan.phase_count`):
  > "All <phase_plan.phase_count> phase(s) of `<program-id>` are now delivered. Once
  > this final PR merges, the program is complete."
- Otherwise (more phases remain):
  > "Once this phase's PR is merged to `<parent_branch>`, run
  > `/agentic-sdlc:next-phase` to start Phase <current_phase + 1>."
