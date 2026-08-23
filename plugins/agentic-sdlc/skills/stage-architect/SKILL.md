---
name: stage-architect
description: Orchestrator handler for the Architect stage — runs the Architect → Architect Validator loop and the tech-spec user gate (with requirements-vs-technical routing). Loaded by /advance-stage when current_stage = architect.
---

# Stage: Architect

Follow the `agentic-sdlc:validation-loop` protocol with:

| Parameter | Value |
|---|---|
| CREATOR / VALIDATOR | `architect` / `architect-validator` |
| ARTIFACT | `runs/<run-id>/tech-spec.md` |
| INPUTS | `state.req_ids` + `state.master_req_spec_path` for a phase run, or `runs/<run-id>/req-spec.md` directly for a flat run (+ `codebase-context.md` and `mode = brownfield` when brownfield) — see the `architect` agent's REQ-ID scoping |
| STAGE / VALIDATION_STAGE | `architect` / `architect_validation` |
| MSG | `Architect tech-spec` |

**Stage-entry summary** (print on entry):
> **Stage <k>/<n> — Architect.** Designing `tech-spec.md` from the approved
> req-spec (Architect → validator loop, then your review gate). Remaining gates:
> stories → (end of run).

**Brownfield / infra flag:** after the loop passes, read the `**Infra change:**`
line from `tech-spec.md` and set the flag (`required …` → `true`, `none` → `false`):
```bash
SDLC set-field <run-dir>/state.json infra_change_required <true|false>
```
This overrides any earlier survey/program default.

## User review gate — tech-spec

Apply the gate convention: name **`runs/<run-id>/tech-spec.md`**, show full
contents (first review) or diff + validator notes (re-review).

> "The Architect has produced the technical spec (Version <n>). Reply
> **'approve'** to continue, or describe what to change."

- **approve:**
  ```bash
  SDLC set-stage <run-dir> user_review_tech complete
  SDLC set-field <run-dir>/state.json current_stage tech_lead
  SDLC commit-step --run <run-dir> "docs(<run-id>): technical spec approved"
  ```
  Immediately invoke the `agentic-sdlc:stage-tech-lead` skill.
  (Brownfield driver: return to the driver instead.)
- **other (a change request):** ask one follow-up to find where the change belongs:
  > "Is this a **requirements** change or a **technical** change?
  > - **requirements** — I'll re-open the Business Analyst. The updated req-spec flows back through the Architect to this gate.
  > - **technical** — I'll have the Architect revise the tech-spec directly."

  - **technical:** treat the notes as revision notes for the architect; re-run the loop.
  - **requirements — route back to BA (mid-phase reopen):** the master req-spec
    lives at the **program** level (`runs/<program-id>/req-spec.md`), not in this
    phase's run dir — BA does not run per phase, so there is no `stages.ba` to
    reset here. Follow the `ba` agent's Mid-phase reopen section:

    1. **Guardrail check (keyed off spec-freeze, not `in_progress`).** The
       REQ-IDs you may touch are `state.req_ids` (this phase) plus any REQ-ID
       belonging to a `pending` (not-yet-started) phase in `program.json`'s
       `phases[]`. Refuse and escalate to the user if the notes would touch a
       REQ-ID belonging to a phase that is already `complete`, or if
       `state.spec_frozen = true` for this phase (the eval gate already froze
       it) — those have shipped or locked their acceptance criteria and must
       not be silently rewritten. In practice, since this gate only ever flags
       REQ-IDs the Architect itself read (i.e. `state.req_ids`), this check
       passes trivially unless the phase has since been frozen out from under
       an in-flight run.
    2. **No new REQ-IDs.** This path only corrects existing REQ-IDs. If the
       notes describe a genuinely new requirement, tell the user to use
       `/agentic-sdlc:next-phase --replan` instead — do not add a REQ-ID here.
    3. Reopen the program-level req-spec:
       ```bash
       SDLC set-field runs/<program-id>/program.json req_spec.status in_progress
       SDLC set-field runs/<program-id>/program.json req_spec.iterations 0
       ```
       Invoke `ba` in **revision mode** (per the `agentic-sdlc:artifact-slicing`
       skill), scoped to the flagged REQ-IDs within `state.req_ids`, against
       `runs/<program-id>/req-spec.md`. Commit:
       ```bash
       SDLC commit-step "docs(<program-id>): BA req-spec reopened from Phase <phase_number> Architect" runs/<program-id>/req-spec.md runs/<program-id>/program.json
       ```
    4. Invoke `ba-validator` in delta mode against the git diff since the last
       validated commit. Loop (max 5 iterations, same fail/escalate mechanics
       as the program-level BA loop in start-run Step 7) until it passes.
    5. On pass: `SDLC set-field runs/<program-id>/program.json req_spec.status frozen`,
       then a lightweight **re-approval gate** — name
       **`runs/<program-id>/req-spec.md`**, show `git diff` since the
       last-approved commit (not the full file), and ask the user to approve.
       - **approve:** commit
         (`"docs(<program-id>): requirement spec re-approved (Phase <phase_number> reopen)"`),
         then re-invoke `architect` in **revision mode**, passing the flagged
         REQ-IDs as its revision notes (only the TECH blocks citing those
         REQ-IDs need re-deriving) — do NOT reset `stages.architect`'s
         iteration counter; this continues the same Architect → Validator
         loop. Repeat from the top of this stage's loop; return to this gate
         when it passes again.
       - **other:** treat as further revision notes for `ba`; repeat from step 3.
