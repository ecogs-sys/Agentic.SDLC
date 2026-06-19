# Phase Planning — Design Spec

**Date:** 2026-06-20
**Status:** Approved (design); pending implementation plan
**Plugin:** agentic-sdlc (target version 0.7.0)

## Problem

The Agentic SDLC pipeline takes one plain-language requirement through a single
run (BA → Architect → Tech Lead → Development → DevOps → one PR). When a feature
is too big, there is no mechanism to cut it into **independently deliverable
slices**. The existing Tech Lead "waves" only order stories by dependency *within
one delivery*; they do not produce separately shippable increments.

This design adds a pre-BA **Phase Planner** stage that splits a large requirement
into ordered, independently shippable **phases**, each of which becomes its own
full run with its own PR.

## Decisions (anchoring)

1. **Each phase = its own full run.** A phase goes through the entire
   BA → Architect → Tech Lead → Development → DevOps pipeline and ships its own
   PR. Phase separation converts one big requirement into N scoped runs.
2. **New agent + validator.** A dedicated `phase-planner` agent (paired with a
   `phase-planner-validator`) owns the split, matching the project's
   Creator+Validator core principle. It runs as a new stage *before* the BA.
3. **Lazy run creation, strictly sequential.** The phase plan is frozen up front,
   but only the Phase 1 run is created immediately. Later phase-runs are spawned
   on demand once the prior phase ships. Later phases build on earlier shipped
   code.
4. **Always runs, single-phase passthrough.** Every `/start-run` begins with the
   Phase Planner. A small feature yields a 1-phase plan and the run proceeds
   exactly as today. The phase plan always exists as an artifact.
5. **Clean break — no legacy support.** The new program/phase layout is the only
   supported layout. There is no flat-run fallback. Old in-flight runs should be
   finished on the prior plugin version.

## Concepts & artifacts

- **Program** — the top-level container for one big requirement.
- **Phase run** — an ordinary run, scoped to one phase, nested inside the program.

All of a phase's SDLC artifacts (req-spec, tech-spec, stories, state) live inside
that phase's folder. Folder/ID scheme is zero-padded: `phase-01`, `phase-02`, …

```
runs/
└── program-2026-06-20-001/          ← the big requirement
    ├── program.json                 ← program state: phases[], current_phase
    ├── original-input.md            ← full requirement, verbatim
    ├── phase-plan.md                ← Phase Planner output (frozen after approval)
    │
    ├── phase-01/                     ← a full run, scoped to Phase 1
    │   ├── state.json                ← per-phase state machine (today's schema + program link)
    │   ├── raw-input.md              ← Phase 1 scope (extracted from phase-plan)
    │   ├── req-spec.md               ← BA output
    │   ├── tech-spec.md              ← Architect output
    │   └── stories/                  ← Tech Lead output (index.md + STORY-XXX.md)
    │
    └── phase-02/                     ← created lazily, after Phase 1 ships
        ├── state.json
        ├── raw-input.md              ← Phase 2 scope + "Phase 1 already shipped" context
        ├── req-spec.md
        ├── tech-spec.md
        └── stories/
```

**Key trick:** the Phase Planner converts one big `original-input.md` into N
scoped `raw-input.md` files. Because each `raw-input.md` is a normal phase scope,
**the BA stage and everything downstream are unchanged** — phasing is invisible
to the BA, Architect, Tech Lead, Engineers, and DevOps agents.

## Stage: Phase Planner (new, pre-BA)

Runs at the very start of `/start-run`, before the BA. Follows the
Creator+Validator + loop + user-gate pattern used by every other planning stage.

### `phase-planner` agent (tools: Read, Write, Edit)
- Reads `original-input.md`.
- Judges scope and emits `phase-plan.md`. For each phase: number, title, the
  scope/requirements it covers, the rationale for the cut, its dependency on
  prior phases, and an "independently shippable" justification.
- Small feature → emits a **1-phase plan** (the passthrough case).
- Each phase entry maps explicitly to the requirements it pulls from
  `original-input.md`, so the validator can check coverage.

### `phase-planner-validator` agent (tools: Read)
- Validates `phase-plan.md` against `original-input.md` using the existing
  `validate-traceability` skill.
- Checks:
  - **Coverage:** every requirement in the input is assigned to **exactly one**
    phase (no loss, no duplication).
  - **Ordering:** phases are ordered so each is buildable on its predecessors.
  - **Deliverability:** each phase is independently shippable.
- Loops up to 5×, with the same escalation-to-user pattern as the other
  validators.

### `write-phase-plan` skill (new)
Template + conventions for `phase-plan.md`, mirroring `write-req-spec` /
`write-stories`. Gives the agent a consistent output format and the validator a
contract to check against.

### User review gate — phase-plan
> "The Phase Planner proposes **N phases**. Reply **'approve'** to freeze the
> plan and begin Phase 1, or describe what to change."

On approve:
1. Freeze `phase-plan.md`.
2. Write `program.json`.
3. Scaffold `phase-01/raw-input.md` from Phase 1's scope.
4. Fall straight into the existing BA loop.

For a 1-phase plan this gate is trivially fast but is still shown ("always runs").

## Stage transition: `/next-phase` (new command, lazy spawn)

When a phase run reaches `complete` (its PR is open/merged), the next phase does
not yet exist. `/agentic-sdlc:next-phase` creates it:

1. Find the active program; confirm the current phase is `complete`.
2. **Replan opportunity** (the payoff of lazy creation): offer to re-open the
   Phase Planner for the *remaining* phases only, feeding in what was learned and
   shipped in earlier phases. Phases 1..N stay frozen; only N+1..end can be
   revised, re-validated, and re-approved at the gate. User can decline → plan
   unchanged.
3. Scaffold `phase-0{N+1}/raw-input.md` = that phase's scope **plus a short
   "already shipped in phases 1..N" context block**, so the BA/Architect treat
   prior phases as an existing system rather than greenfield.
4. Update `program.json` (`current_phase = N+1`), then drop into the normal BA
   loop for the new phase. From there `/advance-stage` works exactly as today.

If the current phase is the **last** one, `/next-phase` reports the program is
fully delivered.

**Rules:**
- Only *future* phases are ever editable; shipped phases are immutable.
- `/advance-stage` operates *within* the active phase only and never auto-jumps
  phases. Crossing a phase boundary is always the deliberate `/next-phase` step.

## State schemas

### `program.json`
```json
{
  "program_id": "program-2026-06-20-001",
  "phase_plan": { "status": "frozen", "phase_count": 3 },
  "current_phase": 2,
  "phases": [
    { "phase": 1, "folder": "phase-01", "title": "MVP",       "status": "complete" },
    { "phase": 2, "folder": "phase-02", "title": "Reporting", "status": "in_progress" },
    { "phase": 3, "folder": "phase-03", "title": "Admin",     "status": "pending" }
  ]
}
```

### Per-phase `state.json`
Today's schema, plus a link back to the program: `program_id`, `phase_number`,
`phase_plan_path`. Everything else (stages, stories, `spec_frozen`) is unchanged
— that is what keeps the dev/devops machinery untouched.

## Orchestrator changes (the real surface area)

- **`start-run`** — prepend the Phase Planner loop + gate; create the program and
  `phase-01/`; then continue into the existing BA loop.
- **`advance-stage`** — re-root all artifact paths from `runs/<run-id>/…` to
  `runs/<program-id>/<phase-folder>/…`; change "find active run" to "find active
  program → active phase folder." Stage logic otherwise unchanged.
- **`show-run-status`** — program-aware; show the phase ladder (which phases are
  complete / in-progress / pending) and the active phase's stage status.
- **`cancel-run`** — **current phase only.** Delete the in-progress phase's folder
  and set that phase back to `pending` in `program.json`. Completed phases and the
  program survive. Edge case: cancelling the sole phase of a single-phase program
  leaves an empty program — report this and offer to remove the empty program too.

## Backward compatibility

None by design. Clean break: the orchestrator assumes the program/phase layout
and contains no flat-run fallback. Old flat `runs/run-…/` runs are not supported
on this version; finish them on the prior plugin version.

## Inventory

**New files**
- `agents/phase-planner.md`
- `agents/phase-planner-validator.md`
- `skills/write-phase-plan/SKILL.md`
- `commands/next-phase.md`

**Modified files**
- `commands/start-run.md`
- `commands/advance-stage.md`
- `commands/show-run-status.md`
- `commands/cancel-run.md`
- `plugins/agentic-sdlc/README.md` — new stage in the table, mermaid workflow
  diagram, pipeline order, layout
- `plugins/agentic-sdlc/.claude-plugin/plugin.json` — version bump `0.6.5 → 0.7.0`
- `CHANGELOG.md` — matching entry
- **Root `README.md`** — references the hand-authored pipeline SVG (below)
- **`docs/agentic-sdlc-pipeline.svg`** — add the Phase Planner + Validator band
  *above* the BA. This SVG is hand-laid-out with absolute coordinates
  (`viewBox 0 0 706.94 1860`) **and a precomputed text-gap `<mask>` of pixel-exact
  rects**. Inserting a top band requires shifting every element down by one
  stage-height, growing the `viewBox`/`mask` canvas height, and recomputing the
  mask rects. Treat as its own dedicated implementation step; verify by rendering
  the SVG, not just by diffing. The Phase Planner band also documents the
  program → phase relationship (one big requirement fans out to N sequential
  phase-runs).

**Resulting totals:** 17 agents, 9 skills, 5 commands.

## Out of scope (YAGNI)

- Parallel phase execution (phases are strictly sequential).
- Cross-phase automatic dependency analysis beyond ordering in the plan.
- Migrating/identifying legacy flat runs.
- Whole-program cancel (cancel is per current phase only).
