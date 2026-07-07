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
| INPUTS | `runs/<run-id>/req-spec.md` (+ `codebase-context.md` and `mode = brownfield` when brownfield) |
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
  - **requirements — route back to BA:** reset the planning chain (counters to 0 —
    a fresh cross-loop entry must not inherit spent iteration budget):
    ```bash
    SDLC set-field <run-dir>/state.json current_stage ba
    SDLC set-field <run-dir>/state.json stages.ba '{"status":"in_progress","iterations":0}'
    SDLC set-field <run-dir>/state.json stages.ba_validation '{"status":"pending","iterations":0}'
    SDLC set-field <run-dir>/state.json stages.user_review_req '{"status":"pending"}'
    SDLC set-field <run-dir>/state.json stages.architect '{"status":"pending","iterations":0}'
    SDLC set-field <run-dir>/state.json stages.architect_validation '{"status":"pending","iterations":0}'
    SDLC set-field <run-dir>/state.json stages.user_review_tech '{"status":"pending"}'
    SDLC commit-step --run <run-dir> "docs(<run-id>): tech-spec review — re-open BA for requirements change"
    ```
    Invoke the `agentic-sdlc:stage-ba` skill, passing the user's change notes as the
    BA's revision notes. The chain then flows forward as usual: BA → validator →
    req gate → Architect → validator → this gate again.
