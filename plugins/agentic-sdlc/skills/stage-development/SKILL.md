---
name: stage-development
description: Orchestrator handler for the development stage — drives each story serially through engineer → reviewer → test-engineer → test-reviewer with iteration caps and routing. Loaded by /advance-stage when current_stage = development.
---

# Stage: Development

Read the archetype's source paths from `state.src_paths` (by `app_type`): web runs
read `backend_src`, `backend_test`, `frontend_src`; electron runs read `electron`
as `electron_root`.

**Stage-entry summary** (print on entry):
> **Stage <k>/<n> — development.** <S> stories in <W> waves (<counts per track>).
> Each story runs engineer → review → tests → test review, one story at a time.
> Next user gate: after <devops | packaging> (end of run).

**Stage status:** the moment you begin the first story:
```bash
SDLC set-stage <run-dir> development in_progress
```
(ships with that story's first commit). When the last story completes, set it
`complete` (see the completion block).

**Serialization (test discipline):** drive **one story at a time** through its full
chain before starting the next. Waves express dependency order, not permission to
parallelize — within a wave, process stories in story-ID order. Never invoke two
development/test agents concurrently; at most one build/test run in flight.

Process stories by **wave** (from `state.stories`), story-ID order within a wave.

For each pending story:

1. `SDLC story-status <run-dir> <story-id> in_progress` (ships with the engineer-draft
   commit). Print the story banner:
   `▶ [development <k>/<n>] STORY-XXX (<i>/<S>, wave <w>) — <track>-engineer (iter 1/5)`
2. Determine track and paths from `app_type`:
   - **web run** — story track is `dotnet` or `react`:
     - dotnet: `src_path = backend_src`, `test_path = backend_test`.
     - react: `src_path = frontend_src`, `test_path = frontend_src` (co-located).
   - **electron run** — every story's track is `electron`:
     - `src_path = test_path = electron_root` (pass as `electron_root`).

## 3. Engineer → Reviewer loop (max 5 iterations — `reviewer_iterations`)

a. Invoke the track's engineer (`dotnet-engineer` / `react-engineer` /
   `electron-engineer`). Pass **paths, not contents**: run-id, story ID, the story
   file path `runs/<run-id>/stories/STORY-XXX.md`, the tech-spec path (instructing:
   read only the sections the story's Implements list names), and `src_path` /
   `test_path` (electron: `electron_root`). Agent description: `"STORY-XXX engineer iter <i>"`.

b. **Commit — engineer draft/revision** (include `<test_path>` — the dotnet scaffold
   creates the test project under it; this commit also carries any pending
   reviewer-FAIL state from the previous iteration):
   ```bash
   SDLC commit-step --run <run-dir> "feat(STORY-XXX): engineer draft" <src_path> <test_path>
   # reviewer feedback: "feat(STORY-XXX): engineer revision — reviewer feedback (iter <n>)"
   # after BACK_TO_ENGINEER: "fix(STORY-XXX): fix production bug — test failure (iter <n>)"
   ```

c. Invoke the track's reviewer (`dotnet-reviewer` / `react-reviewer` /
   `electron-reviewer`). Pass: run-id, story ID, story file path, modified-files
   list, src_path (electron: `electron_root`). Description: `"STORY-XXX review iter <i>"`.
   Print `✔`/`✖` banner with the verdict:
   `✖ [development] STORY-XXX — reviewer: FAIL (iter <i>/5) — <n> CRITICAL`.

d. Route (reviewer outcomes get no standalone commit — the state ships with the
   next commit):
   - **FAIL, `reviewer_iterations` < 5:** `SDLC story-iter <run-dir> STORY-XXX
     reviewer_iterations bump`, re-invoke the engineer with the reviewer's issues.
     Repeat from (a).
   - **FAIL, = 5:** `SDLC story-status <run-dir> STORY-XXX escalated`, `SDLC
     commit-step --run <run-dir> "feat(STORY-XXX): reviewer loop escalated"`, emit
     the escalation block (validation-loop skill), wait for guidance.
   - **PASS:** continue to the test loop.

## 4. Test Engineer → Test Reviewer loop (max 5 iterations — `test_reviewer_iterations`)

a. Invoke the track's test engineer (`dotnet-test-engineer` / `react-test-engineer`
   / `electron-test-engineer`). Pass: run-id, story ID, story file path, src_path,
   test_path (electron: `electron_root`). Description: `"STORY-XXX tests iter <i>"`.

b. **Commit — test engineer draft/revision** (also carries the pending reviewer-PASS
   state):
   ```bash
   SDLC commit-step --run <run-dir> "test(STORY-XXX): test engineer draft" <test_path>
   # revisions: "test(STORY-XXX): test engineer revision — coverage feedback (iter <n>)"
   ```

c. Invoke the track's test reviewer. Pass: run-id, story ID, story file path,
   src_path, test_path (electron: `electron_root`), **and the `full_suite` flag**:
   - `full_suite = true` when this story is the **last story of its wave** (highest
     story-ID in the wave), **or** the run is brownfield (the baseline comparison
     needs the whole suite).
   - `full_suite = false` otherwise — the reviewer runs only this story's test
     scope with coverage. Cross-story regressions are still caught by the wave-end
     full-suite runs and the end-of-run devops/packaging verification.

d. Route on the reviewer's decision (no standalone outcome commit):
   - **DONE:** `SDLC story-status <run-dir> STORY-XXX complete`, then
     `SDLC commit-step --run <run-dir> "feat(STORY-XXX): story complete"`.
     Print `✔ [development] STORY-XXX complete (<i>/<S>)`. Next story.
   - **BACK_TO_TEST_ENGINEER:** `SDLC story-iter <run-dir> STORY-XXX
     test_reviewer_iterations bump`. If < 5: re-invoke the test engineer with the
     issues; repeat from (a). If = 5: escalate (story `escalated`, commit,
     escalation block).
   - **BACK_TO_ENGINEER:** `SDLC story-iter <run-dir> STORY-XXX fix_iterations
     reset` (fresh cross-loop entry), then re-run the Engineer → Reviewer loop from
     step 3(a) with the failing-test info, using `fix_iterations` (capped at 5)
     instead of `reviewer_iterations`, and the `fix(STORY-XXX)` commit message.
     After the fix passes review, re-run this test loop — do NOT reset
     `test_reviewer_iterations`; it continues from where it was.

## Completion

After all stories complete:
```bash
SDLC set-stage <run-dir> development complete
# web:
SDLC set-field <run-dir>/state.json current_stage devops
SDLC set-stage <run-dir> packaging skipped
# electron:
SDLC set-field <run-dir>/state.json current_stage packaging
SDLC set-stage <run-dir> devops skipped
SDLC commit-step --run <run-dir> "docs(<run-id>): all stories complete"
```
Immediately invoke the final stage's skill by `app_type`:
`agentic-sdlc:stage-devops` (web) or `agentic-sdlc:stage-packaging` (electron).
(Brownfield driver: return to the driver instead — it owns the transition and the
`infra_change_required` gate.)

## Brownfield notes

Stories may already exist (bug_fix synthesized them at triage). Engineers run in
brownfield mode (edit in place, no scaffold). The test reviewer always gets
`full_suite = true` and compares to `state.test_baseline` — only NEW failures fail
the gate; pre-existing failures are reported, not fixed.
