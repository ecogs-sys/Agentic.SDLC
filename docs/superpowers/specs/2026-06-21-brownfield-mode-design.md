# Brownfield Mode — Design

Date: 2026-06-21
Status: approved (design); pending implementation plan
Topic: Add brownfield support (bug fixes, small changes, new features on an existing codebase) to the Agentic.SDLC plugin, while greenfield continues to work unchanged.

## Problem

The current pipeline is heavyweight and greenfield-shaped. It always runs
Phase Planner → BA → Architect → Tech Lead → (full development with from-scratch
scaffold) → DevOps, with four user-review gates and validator loops. Two
assumptions are baked in that brownfield breaks:

1. **No existing-code awareness.** The BA treats `raw-input.md` as the only source
   of truth and writes specs from scratch; the Architect and Tech Lead do the
   same; the .NET engineer only scaffolds when `<backend_src>` is empty; DevOps
   always generates Dockerfiles/compose that a brownfield repo already has.
2. **No right-sizing.** A one-line bug fix pays for Phase Planner + four gates +
   DevOps, the same as a greenfield app.

Brownfield needs both: existing-code awareness baked into every agent, and a
pipeline that is right-sized to the change.

## Decisions (from brainstorming)

- **Tiered pipeline** by change type: bug-fix → minimal, small-change → light,
  new-feature → full.
- **`/start-run` auto-detects** greenfield (empty repo) vs brownfield (existing
  code), then triages the tier. No new entry command.
- **Code Surveyor** agent produces a shared `codebase-context.md`; its depth
  scales by tier (shallow for bug-fix, deep for new-feature).
- **Regression safety:** the repo's full existing test suite must stay green AND
  new tests cover the change. The done-gate blocks on any *new* red; pre-existing
  red is surfaced to the user, never hidden or auto-fixed.
- **DevOps stage is conditional:** runs only when the change needs infra changes
  (new service, env var, port, dependency); otherwise skipped.
- **Implementation approach: data-driven pipeline profiles (Approach A).**
  `state.json` carries `mode`, `tier`, and an ordered `pipeline`. `advance-stage`
  walks that profile for brownfield runs. Greenfield logic is untouched; agents
  become mode-aware through one shared addendum rather than being duplicated.

## Architecture overview

```
/start-run
  ├─ detect src paths (existing)
  ├─ detect greenfield vs brownfield   ← NEW
  │     greenfield → existing program/phase flow (unchanged)
  │     brownfield → brownfield flow (below)
  │
  └─ brownfield flow
        ├─ Surveyor pass 1 (shallow recon): impact map + test baseline + proposed tier
        ├─ TRIAGE GATE: user confirms / bumps / lowers tier
        ├─ select pipeline profile for confirmed tier
        ├─ (if new-feature) Surveyor pass 2 (deep): full architecture map
        └─ advance-stage drives the profile to completion
```

## 1. Detection & triage (front of `/start-run`)

A detection step runs after source-path detection, before phase planning:

- **Greenfield** if detected `backend_src`/`frontend_src` contain no real source
  (no `.sln`/`.csproj`, no `package.json`). → existing flow, untouched.
- **Brownfield** if either side already contains real source. → brownfield flow.
- The user may override the verdict (`treat as greenfield` / `treat as
  brownfield`).

**Triage is the Surveyor's first pass.** Depth depends on tier, but classifying
the tier needs some code reading — so the Surveyor always runs a **shallow recon
first**:

1. Read the request and scan the repo.
2. Emit an **impact map** (likely-affected files/modules/areas).
3. Capture a **test baseline** — run the existing suite once and record which
   tests are already green/red.
4. **Propose a tier** with rationale.

At the **triage gate** the user confirms, bumps, or lowers the tier. Changing the
tier re-selects the pipeline profile. If the confirmed tier is `new-feature`, the
Surveyor runs a **second deep pass** that augments `codebase-context.md` with a
full architecture map.

## 2. Tier profiles

Common to all tiers: Surveyor runs first and produces `codebase-context.md`;
regression = full suite stays green + new tests; DevOps conditional.

| Tier | Stages | Gates |
|---|---|---|
| **bug-fix** (minimal) | survey(shallow) → development (scoped; TDD — a failing test reproduces the bug first) → devops? | 1 (triage) |
| **small-change** (light) | survey(medium) → change-spec (BA-lite + validator) → stories (Tech Lead + validator) → development → devops? | 3 (triage, change-spec, stories) |
| **new-feature** (full) | survey(deep) → BA + validator → Architect + validator → Tech Lead + validator → development → devops? | 4 (triage, req, tech, stories) |

- **bug-fix** skips BA/Architect/Tech Lead entirely. The triage output + the
  user's request become a single synthesized story for the development stage.
- **small-change** skips the Architect; technical decisions fold into the Tech
  Lead's stories, which reference existing patterns documented in
  `codebase-context.md`.
- **new-feature** keeps the full creator chain, but every creator runs in
  **brownfield mode** (specs describe the *delta* against the existing system).
- **Multi-feature new-feature → brownfield program (phase planning).** When a
  new-feature request is really *several* features added at once, it can start from
  the **Phase Planner loop** and ship per-phase PRs. See §2a.

## 2a. Brownfield programs (multi-feature new-feature)

A flat `change-*` run ships one PR. When a new-feature is several features, the user
can instead run it as a **brownfield program** that reuses the existing greenfield
program/phase machinery — one PR per phase via `/next-phase`.

- **Trigger.** At the triage gate, when the confirmed tier is `new-feature`, the
  Surveyor flags whether it sees multiple distinct features. The user chooses
  **single** (flat change run, §3) or **split** (brownfield program).
- **Composition.** A brownfield program is an ordinary greenfield program with two
  differences: `program.json` carries `mode: "brownfield"` and a program-level
  `codebase_context_path`, and **every phase's `state.json` carries `mode:
  "brownfield"`**. Because the creator/reviewer agents are already brownfield-aware
  (they read `codebase-context.md` and work the delta when `mode == brownfield`), the
  greenfield per-phase sequence (BA → Architect → Tech Lead → development → devops)
  becomes brownfield-aware with no separate driver.
- **Survey once.** The deep Code Surveyor runs once at program creation, writing the
  program-level `codebase-context.md` shared by all phases. Later phases also get the
  greenfield "already shipped (do not re-build)" context for prior phases.
- **Conditional devops + regression** apply per phase exactly as in §5 (devops runs
  only when `infra_change_required`; the done-gate keeps the full existing suite
  green vs. the baseline).
- **Phase Planner is brownfield-aware:** it reads `codebase-context.md` and plans
  phases as features *added to the existing system*.
- **Reconciliation:** the survey/triage runs in the provisional `change-*` run; on
  **split**, that run is converted to a program (branch renamed to
  `agentic-sdlc/<program-id>/phase-01`, `codebase-context.md` moved to the program
  dir) before the Phase Planner loop. Single-feature flow is unchanged.

## 3. State / run model

A brownfield change is a **standalone run**, separate from the greenfield
program/phase machinery (which stays exactly as-is).

- `run_id` = `change-YYYY-MM-DD-NNN`
- directory `runs/change-YYYY-MM-DD-NNN/`
- branch `agentic-sdlc/change-YYYY-MM-DD-NNN`
- `parent_branch` recorded as today (the branch the run was started from)

`state.json` additions for brownfield runs:

```json
{
  "run_id": "change-2026-06-21-001",
  "mode": "brownfield",
  "tier": "small_change",
  "parent_branch": "<branch>",
  "branch": "agentic-sdlc/change-2026-06-21-001",
  "src_paths": { "backend": "...", "backend_test": "...", "frontend": "..." },
  "codebase_context_path": "runs/change-2026-06-21-001/codebase-context.md",
  "infra_change_required": false,
  "test_baseline": { "captured": true, "preexisting_failures": [] },
  "pipeline": [
    "survey", "user_review_triage",
    "change_spec", "change_spec_validation", "user_review_change_spec",
    "tech_lead", "tech_lead_validation", "user_review_stories",
    "development", "devops"
  ],
  "current_stage": "survey",
  "spec_frozen": false,
  "stages": { "...": "only the stages present in this tier's profile" },
  "stories": {}
}
```

The `pipeline` array IS the tier profile — an ordered list of stage keys with the
gates interleaved. The three tiers are three predefined arrays.

`advance-stage` gains one branch at the top: **if `mode == "brownfield"`, drive
by the `pipeline` profile** (walk it in order, run the handler for
`current_stage`, advance to the next stage in the array); otherwise run the
existing greenfield logic. Stage handlers are **reused** wherever they already
exist (`tech_lead`, `development`, `devops`, and the user-review gate pattern).
New handlers: `survey`, the `user_review_triage` gate, and `change_spec` (BA-lite).

Cross-command effects:

- `start-run` refuses to start if an active **program** OR an active **change
  run** exists (concurrency stays unsupported across both models).
- `cancel-run` and `show-run-status` learn to recognize and report `change-*`
  runs (profile-driven status display).
- `next-phase` refuses on brownfield runs — they are not phased.

## 4. Agent mode-awareness — one shared addendum

A new skill **`brownfield-mode`** holds the shared rules; every creator agent
follows it when `mode == "brownfield"`:

- Read `codebase-context.md` first; reuse the conventions and patterns it
  documents.
- Describe the **delta** against the existing system, not a from-scratch design.
- Engineers **edit existing files in place, never scaffold**; match surrounding
  code. (The .NET engineer's existing "check what already exists" step is
  extended so it never re-scaffolds when source is present.)
- Validators: traceability is *request → change-spec → (existing + new code)* —
  the delta — not whole-system coverage.

Each affected agent file (BA, Architect, Tech Lead, .NET/React Engineers,
Reviewers, Test Reviewers) gets a short "## Brownfield mode" section pointing to
the `brownfield-mode` skill, gated on `mode == "brownfield"` in its context.

## 5. Regression & DevOps mechanics

- **Test baseline.** The Surveyor runs the existing suite once at the start and
  records the green/red baseline in `state.test_baseline`. The brownfield
  done-gate = **no *new* failures** (pre-existing red is surfaced to the user,
  never hidden or auto-fixed) **+ new tests green**. Test reviewers run the
  **full existing suite** in brownfield (not just the change's tests).
- **DevOps conditional.** The Surveyor sets an initial `infra_change_required` with a
  rationale. For new-feature, the Architect records a machine-readable
  `**Infra change:**` line in `tech-spec.md`'s Deployment topology
  (`none` | `required — <what>`); the orchestrator reads it after the Architect stage
  and updates `infra_change_required`, overriding the survey's initial value. The `devops` handler in
  `advance-stage` runs the DevOps Engineer/Reviewer only when the flag is true;
  otherwise it marks devops skipped and completes the run.

## 6. New / changed artifacts

**New agents**
- `code-surveyor` — produces `codebase-context.md` (impact map, conventions,
  architecture map, test baseline, infra-change assessment, proposed tier).
- `code-surveyor-validator` — included for consistency with the creator+validator
  pattern, even though the survey is read-only analysis.

**New skills**
- `brownfield-mode` — shared mode-awareness addendum (Section 4).
- `write-codebase-context` — template/conventions for the Surveyor's artifact.
- `write-change-spec` — BA-lite template for the small-change tier's change-spec.

**Changed**
- `start-run` — greenfield/brownfield detection, triage gate, brownfield branch.
- `advance-stage` — profile-driven brownfield branch + new `survey` /
  `user_review_triage` / `change_spec` handlers + conditional devops.
- `cancel-run`, `show-run-status` — recognize `change-*` runs.
- `next-phase` — refuse on brownfield runs.
- BA, Architect, Tech Lead, .NET/React Engineers, Reviewers, Test Reviewers —
  add the "## Brownfield mode" pointer.
- `plugins/agentic-sdlc/.claude-plugin/plugin.json` — version bump;
  `CHANGELOG.md` — matching entry (per project release rules).

**Documentation — done as the final implementation step, after the pipeline works**
- `docs/agentic-sdlc-pipeline.svg` — update the pipeline diagram to show the
  brownfield branch (detection → triage gate → tier profiles → conditional
  DevOps) alongside the existing greenfield flow.
- `README.md` (root) — refresh prose and the embedded SVG reference for
  brownfield support.
- `plugins/agentic-sdlc/README.md` — update the stage/agent tables, the mermaid
  workflow diagram, the "What it does" / pipeline-order sections, and add a
  brownfield section covering tiers, the Surveyor, and detection.

## Open items resolved during brainstorming

- **Surveyor validator:** included (creator+validator parity).
- **Triage gate on bug-fix:** kept — the user confirms the diagnosis/tier before
  any code changes, even on the minimal tier.

## Out of scope

- Phasing of very large brownfield features.
- Non-.NET/React stacks (the fixed stack assumption is unchanged).
- Changing the greenfield flow's behavior.
