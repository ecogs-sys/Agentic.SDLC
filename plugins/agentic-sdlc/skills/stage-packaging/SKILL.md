---
name: stage-packaging
description: Orchestrator handler for the Packaging stage (electron and embedded runs) — Packager → Reviewer loop with routing, then run/phase completion. Loaded by /advance-stage when current_stage = packaging.
---

# Stage: Packaging *(electron and embedded runs)*

Runs instead of DevOps when `app_type = electron` or `app_type = embedded`. Branch
every step below by `app_type`:
- **electron:** read `electron_root` from `src_paths.electron`; agents are
  `electron-packager` / `electron-packager-reviewer`.
- **embedded:** read `embedded_root` from `src_paths.embedded`; agents are
  `embedded-packager` / `embedded-packager-reviewer`.

**Stage-entry summary** (print on entry):
> **Stage <n>/<n> — Packaging (final).** <electron: Configuring electron-builder +
> updater + icons, then an unpacked build and smoke-launch. | embedded: Finalizing
> sdkconfig/partitions, then a build and artifact-size check.> No user gate until
> the completion announcement.

## Packaging loop (max 5 iterations — `stages.packaging.iterations`)

Before the first invocation: `SDLC set-stage <run-dir> packaging in_progress`
(ships with the draft commit).

a. Invoke the track's packager (`electron-packager` / `embedded-packager`). Pass:
   run-id, `electron_root` or `embedded_root`, the tech-spec path. Description:
   `"packaging iter <i>"`. Banner: `▶ [packaging] <track>-packager (iter <i>/5)`.

b. **Commit — draft/revision:**
   ```bash
   SDLC commit-step --run <run-dir> "chore: <track> packager draft" <electron_root | embedded_root>
   # revisions: "chore: <track> packager revision — reviewer feedback (iter <n>)"
   ```

c. Invoke the track's packager reviewer (`electron-packager-reviewer` /
   `embedded-packager-reviewer`). Pass: run-id, `electron_root` or `embedded_root`,
   the tech-spec path. Description: `"packaging review iter <i>"`. Print the
   `✔`/`✖` banner.

d. Route on the reviewer's `**Routing decision:**` (no standalone outcome commits):
   - **DONE:**
     ```bash
     SDLC set-stage <run-dir> packaging complete
     SDLC set-field <run-dir>/state.json current_stage complete
     SDLC commit-step --run <run-dir> "chore(<run-id>): run complete"
     SDLC set-field runs/<program-id>/program.json phases.<idx>.status complete
     SDLC commit-step "docs(<program-id>): phase <phase_number> complete" runs/<program-id>/program.json
     ```
     Do NOT start the next phase automatically. Announce completion (below).
   - **BACK_TO_PACKAGER:** `SDLC bump-iter <run-dir> packaging`; if < 5 re-invoke
     the track's packager with the issues; if = 5 → `escalated`, commit, escalation
     block.
   - **`BACK_TO_ELECTRON_ENGINEER <story-id>` / `BACK_TO_EMBEDDED_ENGINEER
     <story-id>`:**
     1. `SDLC story-iter <run-dir> <story-id> fix_iterations reset` (fresh
        cross-loop entry from packaging).
     2. Re-run that story's Engineer → Reviewer loop (stage-development skill,
        step 3) with the failing context (passing `electron_root` or
        `embedded_root`), using `fix_iterations` and the `fix(STORY-XXX)` commit
        pattern. If = 5: escalate.
     3. Once the reviewer passes: re-run the story's test loop
        (`full_suite = true`). If all pass: re-invoke the track's packager.
   - **HUMAN_REVIEW_REQUIRED:** commit state
     (`"chore: <track> packager reviewer — awaiting human decision"`), present the
     ambiguity, wait, and use the decision as context for the next packager invocation.

## Completion announcement

Read `parent_branch` from `program.json`. Announce, branched by `app_type`:

**electron:**
> "Phase <phase_number> (run <run-id>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. To ship:
> 1. Open a pull request from `agentic-sdlc/<run-id>` → `<parent_branch>`
> 2. Review the generated Electron app in `<electron_root>/` (apps/desktop + packages/*)
>
> To run the app locally now:
> 1. `cd <electron_root> && pnpm install`
> 2. `pnpm dev` to launch in development, or `pnpm package` to build distributables"

**embedded:**
> "Phase <phase_number> (run <run-id>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. To ship:
> 1. Open a pull request from `agentic-sdlc/<run-id>` → `<parent_branch>`
> 2. Review the generated firmware in `<embedded_root>/` (main/ + components/*)
>
> The firmware has been build-verified only — nothing was flashed to a device. To
> flash and monitor it yourself:
> 1. `cd <embedded_root>`
> 2. `idf.py -p <PORT> flash monitor`"

Then add the same program-level next-step note used by the DevOps completion
(last phase → "all phases delivered"; otherwise → "run /agentic-sdlc:next-phase").

## Brownfield note

When `mode = brownfield` and `app_type` is `electron` or `embedded`, this stage is
**conditional** exactly like devops: run it only if `state.infra_change_required ==
true` (e.g. a new OS target, updater feed, or native dependency for electron; a
new target chip, partition table layout, or OTA enablement for embedded);
otherwise `SDLC set-stage <run-dir> packaging skipped` and go to the driver's
completion. Instruct the packager to MODIFY existing packaging config rather than
regenerate it. On DONE, no program.json update or announcement — return to the
brownfield driver's completion.
