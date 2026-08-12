---
name: stage-evals
description: Orchestrator handler for the eval review gate — a human review of the run's authored eval manifest before development, with in-place check-kind edits and upstream routing for substantial changes. This is the SPEC-FREEZE point. Loaded by /advance-stage when current_stage = user_review_evals.
---

# Stage: Eval review gate

Runs when `current_stage = "user_review_evals"` — after the stories (greenfield /
brownfield new_feature) or fix-plan (brownfield bug_fix / small_change) gate has
authored the run's eval manifest (`runs/<run-id>/evals/manifest.json`), and before
development. This is a pure **human review gate** — no creator/validator loop — over
what the run authored as its definition of correctness. Each eval is one frozen
`STORY-XXX/AC-n` acceptance criterion bound to a machine-checkable verification; these
evals are later promoted into the permanent `evals/` corpus and replayed as a
regression gate forever, so this is the human's sign-off on that commitment.

**This gate is the SPEC-FREEZE point.** `spec_frozen` is NOT set upstream — it is set
here on approval, because a substantial change at this gate must be able to re-open the
stories / fix-plan / architect / BA stages (blocked once the spec is frozen).

**Stage-entry summary** (print on entry):
> **Eval review gate.** Review the machine-checkable evals authored from the frozen
> acceptance criteria — the run's definition of correctness (promoted to the permanent
> corpus and replayed forever). Approving here freezes the spec and begins development.

## Display

Show the authored manifest human-readably:
```bash
EVALS report <run-dir>          # one line per eval: id — [kind] — n test(s) — criterion
```
- **First review:** the full list. Group by story if long. Note that nothing is bound
  yet (tests are tagged and derived during development) — this review is about *which*
  criteria are checked and *how* (`check.kind`), not test results.
- **Re-review (after a local kind change):** re-run `EVALS report` and call out what
  changed since the last display.
Offer to open `runs/<run-id>/evals/manifest.json` (name the path) on request.

Explain the three `check.kind` values so the reviewer can judge them:
- **`test`** (default) — proven by ≥1 tagged test. The deterministic, cheap-to-replay path.
- **`assert`** — a runnable probe, for a criterion no test covers (don't double-cover).
- **`judge`** — a persisted rubric, the fallback for irreducibly semantic criteria.

## Gate prompt

> "The run has authored <N> evals from the frozen acceptance criteria (above). Reply
> **'approve'** to freeze the spec and begin development. To reclassify how a criterion
> is checked, say e.g. **'set STORY-003/AC-4 to judge'**. To add, remove, or reword a
> criterion, describe the change — I'll route it back to the stage that owns it."

### approve

```bash
SDLC set-field <run-dir>/state.json spec_frozen true
SDLC set-stage <run-dir> user_review_evals complete
SDLC set-field <run-dir>/state.json current_stage development
SDLC commit-step --run <run-dir> "docs(<run-id>): evals approved — spec frozen" <run-dir>/evals
```
Then immediately invoke the `agentic-sdlc:stage-development` skill and continue.
(Brownfield driver: return to the driver instead — it advances the pipeline.)

### change a check kind (local edit — no round-trip)

The only in-place mutation allowed (the manifest otherwise stays machine-derived from
the acceptance criteria). For each requested reclassification:
```bash
EVALS set-kind <run-dir> STORY-XXX/AC-n <test|assert|judge>
```
Then commit and re-display, staying at the gate:
```bash
SDLC commit-step --run <run-dir> "docs(<run-id>): eval STORY-XXX/AC-n → <kind>" <run-dir>/evals
```
Re-run **Display** and re-issue the **Gate prompt**.

### substantial change (add / remove / reword a criterion) — route to source

A criterion's existence or meaning is owned by the acceptance-criteria source, not the
manifest. Ask one follow-up to locate the change, offering only the targets this run
actually has (read `tier` and which planning stages were seeded):

> "Does this change belong in the **stories** (add/remove/reword an acceptance
> criterion), the **technical** design, or the **requirements** themselves?"

Reset the relevant chain to a fresh cross-loop entry (counters to 0 — a re-entry must
not inherit spent iteration budget), mirroring the tech-spec gate's routing
(`agentic-sdlc:stage-architect`). Always reset the eval gate itself back to `pending`.

- **stories** →
  - **greenfield / brownfield new_feature — re-open Tech Lead:**
    ```bash
    SDLC set-field <run-dir>/state.json current_stage tech_lead
    SDLC set-field <run-dir>/state.json stages.tech_lead '{"status":"in_progress","iterations":0}'
    SDLC set-field <run-dir>/state.json stages.tech_lead_validation '{"status":"pending","iterations":0}'
    SDLC set-field <run-dir>/state.json stages.user_review_stories '{"status":"pending"}'
    SDLC set-field <run-dir>/state.json stages.user_review_evals '{"status":"pending"}'
    SDLC commit-step --run <run-dir> "docs(<run-id>): eval gate — re-open Tech Lead for a criterion change"
    ```
    Invoke `agentic-sdlc:stage-tech-lead` with the change notes as revision notes.
  - **brownfield bug_fix / small_change — re-open the fix-plan** (stories come from the
    fix plan, not a tech-lead): reset `fix_plan` / `fix_plan_validation` /
    `user_review_fix_plan` / `user_review_evals` the same way, set
    `current_stage = fix_plan`, commit, and return to the brownfield driver (it owns the
    fix-plan handler).
- **technical** → re-open the **Architect** (reset `architect`, `architect_validation`,
  `user_review_tech`, plus the tech-lead chain and `user_review_evals`), set
  `current_stage = architect`, commit, invoke `agentic-sdlc:stage-architect` with the
  notes. Not available for bug_fix / small_change (no architect stage).
- **requirements** → re-open the **BA** (reset the whole planning chain — `ba`,
  `ba_validation`, `user_review_req`, `architect`, `architect_validation`,
  `user_review_tech`, `tech_lead`, `tech_lead_validation`, `user_review_stories`,
  `user_review_evals`), set `current_stage = ba`, commit, invoke `agentic-sdlc:stage-ba`
  with the notes. Not available for bug_fix / small_change.

In every routed case the chain flows forward as usual, re-authors the manifest at the
(stories / fix-plan) gate, and returns to this gate for review.
