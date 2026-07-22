---
name: validation-loop
description: The generic creator → validator loop protocol (max 5 iterations) used by every planning stage (Phase Planner, BA, Architect, Tech Lead, Fix Planner). Stage skills invoke this protocol with their own parameters.
---

# Validation Loop Protocol

Every planning stage runs the same loop. A stage skill supplies these **parameters**:

| Parameter | Meaning |
|---|---|
| `CREATOR` | creator agent (e.g. `ba`) |
| `VALIDATOR` | validator agent (e.g. `ba-validator`) |
| `ARTIFACT` | artifact path(s) the creator writes (e.g. `runs/<run-id>/req-spec.md`) |
| `INPUTS` | paths passed to the creator (e.g. raw-input.md; + codebase-context.md when brownfield) |
| `STAGE` / `VALIDATION_STAGE` | state keys (e.g. `ba` / `ba_validation`) |
| `MSG` | commit-message noun (e.g. `BA req-spec`) |

`SDLC` below means `node "${CLAUDE_PLUGIN_ROOT}/scripts/sdlc.mjs"` and `<run-dir>` is
`runs/<run-id>` resolved. Iterations live in `stages.<STAGE>.iterations`.

## The loop (max 5 iterations)

Before the first invocation (skip if already `in_progress`):
```bash
SDLC set-stage <run-dir> <STAGE> in_progress
```

On each iteration:

a. **Progress banner**, then invoke `CREATOR`:
   ```
   ▶ [<STAGE> <k>/<n>] <CREATOR> (iter <i>/5)
   ```
   Pass: run-id, the `INPUTS` **paths** (agents read them; do not paste file contents),
   and revision notes (user notes on a user-triggered rerun; the validator's diff on
   later iterations). Set the Agent tool `description` to `"<STAGE> <CREATOR> iter <i>"`.
   On re-invocations, state **revision mode** explicitly and pass only the validator's
   diff JSON (or the user's notes) — the creator follows its **Revision mode** section
   (Grep the flagged ID headings, Read only those blocks plus the cited source
   sections, fix with Edit; it does not re-read the inputs or rewrite the artifact).

b. **Commit the draft/revision** (includes any prior not-yet-committed state changes,
   e.g. a previous FAIL outcome — validation outcomes never get standalone commits):
   ```bash
   SDLC commit-step --run <run-dir> "docs(<run-id>): <MSG> draft" <ARTIFACT>
   # revisions: "docs(<run-id>): <MSG> revision (iter <n>)"
   ```

c. `SDLC set-stage <run-dir> <VALIDATION_STAGE> in_progress` (first time), banner
   `▶ … <VALIDATOR>`, then invoke `VALIDATOR` with the source + derived artifact paths.
   **First validation of the loop (and the first retry after an escalation): full
   validation.** On iterations 2+, invoke the validator in **delta mode** instead:
   pass the previous diff report plus the output of
   `git diff <validated_commit> -- <ARTIFACT>` (validators cannot run git — paste the
   diff text), where the SHA comes from `stages.<VALIDATION_STAGE>.validated_commit`.
   The validator follows the validate-traceability skill's **Delta re-validation**
   section. If the SHA is missing or the diff is empty, fall back to full validation.
   After every validator invocation, record what it saw:
   ```bash
   SDLC set-field <run-dir>/state.json stages.<VALIDATION_STAGE>.validated_commit "$(git rev-parse --short HEAD)"
   ```
   (this state change ships with the next commit — validation outcomes never get
   standalone commits).
   Record its outcome in `stages.<VALIDATION_STAGE>` (via `SDLC set-field` as needed).

d. Route on the validator's `status`:
   - **fail, iterations < 5:** `SDLC bump-iter <run-dir> <STAGE>`, print
     `✖ [<STAGE>] validation FAIL (iter <i>/5) — <one-line reason>`, re-invoke
     `CREATOR` with the validator's diff. Repeat from (a). (The FAIL state update
     ships inside the next revision-draft commit — step b.)
   - **fail, iterations = 5:** `SDLC set-stage <run-dir> <STAGE> escalated`, then
     `SDLC commit-step --run <run-dir> "docs(<run-id>): <MSG> escalated"`, then emit
     the **escalation block** (below) and wait for the user. On guidance, set the
     stage back to `in_progress` and re-invoke `CREATOR` (counter does NOT reset).
   - **pass:** `SDLC set-stage <run-dir> <STAGE> complete` and
     `SDLC set-stage <run-dir> <VALIDATION_STAGE> complete`, print
     `✔ [<STAGE>] validation PASS`. Do **not** commit yet — the pass state ships
     with the gate-approval commit. Proceed to the stage skill's user-review gate.

## Escalation block (used at every 5-cap, stages and stories alike)

> ⛔ **ESCALATION — <stage/story>: <loop name> hit its 5-iteration cap.**
>
> <the last validator/reviewer report>
>
> The run is paused; nothing is running. Reply with guidance and I will retry,
> or use `/agentic-sdlc:cancel-run` to cancel.

## User-review gate convention (applies at every gate)

1. Name the exact artifact path under review — e.g. "Reviewing **`runs/<run-id>/req-spec.md`**".
2. **First review of the artifact:** display its full contents.
   **Re-review after revisions:** display the validator's notes plus
   `git diff <last-reviewed-commit> -- <artifact>` instead of the full file, and
   offer the full file on request. (The user reviews the change, not a re-read.)
3. Ask for approval, stating what happens next. On **approve**, fold the gate status
   updates into one `SDLC commit-step` (this also carries the pending validation-pass
   state from (d)). Any other reply = revision notes → re-run the loop (user
   revisions count toward the 5-iteration cap). The re-run uses revision mode for
   the creator and delta mode for the validator, scoped to the git diff since
   `validated_commit` (no prior flagged IDs — the touched blocks are the scope).
