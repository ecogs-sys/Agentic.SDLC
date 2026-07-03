# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

## [0.9.2] - 2026-07-04

### Changed
- **Pipeline diagram now shows track extensibility.** Updated `docs/agentic-sdlc-pipeline.svg`
  to convey that the development-phase track set is pluggable rather than limited to .NET and
  React. Added a dashed "＋ More tracks" column (illustrative Java / Vue / Go chips) wired into
  the story-dispatch and DevOps flow, and updated the accessible `<desc>` accordingly. Diagram
  only — no behavior change.

## [0.9.1] - 2026-07-04

### Changed
- **Agent model right-sizing.** Matched each agent's model tier to its cognitive load and
  run volume:
  - `code-surveyor` opus → **sonnet** — the survey is Grep/Glob-driven exploration plus a
    templated write-up (not open-ended design), it runs shallow on every brownfield run, and
    the code-surveyor-validator backstops its output.
  - `phase-planner` sonnet → **opus** — the highest-leverage decomposition step, where a bad
    phase split cascades across the whole program. Note: this applies to every invocation,
    including the common single-phase case (frontmatter model is unconditional).
  - `architect` stays **opus**; all validators, engineers, reviewers, test engineers/reviewers,
    and devops agents stay **sonnet**.

## [0.9.0] - 2026-07-04

### Fixed
- **Live `in_progress` status.** Stages no longer sit at `pending` until they jump to
  `complete` — the orchestrator now flips each stage, validator sub-stage, and story to
  `in_progress` *before* invoking its agent. Previously only `stages.ba` (seeded
  `in_progress` in the schema) ever looked "running"; `architect`, `tech_lead`,
  `development`, `devops`, all `*_validation` sub-stages, and per-story status were
  unobservable while running.
- `stages.development` is now closed out to `complete` (it was permanently stuck at
  `pending`), and the program-level `phase_plan` is set to `in_progress` at the start of the
  Phase Planner loop.

### Added
- **Stage-lifecycle & status discipline** convention in `advance-stage` — a single canonical
  status vocabulary (`pending → in_progress → complete`; `escalated`/`skipped`/`cancelled`)
  and entry/exit rules that every stage references, so status transitions can't drift.
- **Escalation & failure visibility** in `show-run-status`: `◀ NEEDS ATTENTION` on any
  `escalated` stage/story, `◀ active` on the current stage/story, a `⚠ …escalated…` banner,
  per-story rework counters, and the development/devops aggregate status.
- Consistent `escalated` status is now written for the Tech Lead stage and for any story that
  hits a 5-iteration cap (new `escalated` story status), so blocked work surfaces instead of
  showing as mid-flight `in_progress`.
- **.NET robustness essentials** (dotnet-conventions): nullable reference types + warnings-as-
  errors, boundary input validation, `ILogger<T>` structured logging, `CancellationToken`
  propagation, options-pattern config, and a global exception handler.
- **React robustness essentials** (react-conventions): render loading/error states,
  accessibility (semantic elements, labels, alt), stable list keys, app-level error boundary,
  and no secrets in the bundle.

## [0.8.1] - 2026-06-21

### Changed
- Docs: documented the brownfield **change-run** and **brownfield-program** folder
  layouts in the plugin README ("Where artifacts live"), with a per-tier
  artifact table.

## [0.8.0] - 2026-06-21

### Added
- **Brownfield mode.** `/start-run` now auto-detects an existing codebase and runs a
  right-sized, tiered pipeline (bug-fix / small-change / new-feature) as a standalone
  `change-*` run, alongside the unchanged greenfield program/phase flow.
- **Code Surveyor** agent (+ validator) produces a shared `codebase-context.md`
  (stack, conventions, architecture, impact map, test baseline, infra assessment) and
  proposes a tier at a new triage gate; depth scales by tier.
- New skills: `brownfield-mode`, `write-codebase-context`, `write-change-spec`.
- **Multi-feature brownfield programs.** A new-feature that is really several
  features can be **split** at the triage gate into a brownfield *program* that
  reuses the Phase Planner loop and ships one PR per phase via `/next-phase`; every
  phase stays brownfield-aware (reads `codebase-context.md`, works the delta).

### Changed
- BA, Architect, Tech Lead, engineers, reviewers, and test reviewers are now
  brownfield-aware (delta-only work; reuse existing conventions).
- DevOps runs only when the change needs infra changes; brownfield done-gate keeps
  the full existing suite green (no new failures vs baseline) plus new tests.
- `advance-stage`, `cancel-run`, `show-run-status`, and `next-phase` recognize
  `change-*` runs.

## [0.7.1] - 2026-06-21

### Changed
- **Test execution guardrails: serialize and run once per change.** Made the implicit
  "one authoritative run" rule explicit and enforceable to stop concurrent `dotnet test` /
  `npm test` storms (SQL deadlocks, `database is locked`, port-in-use, and net slowdown from
  oversubscribed cores). Added a "Test execution discipline" section to `/advance-stage`
  mandating strictly sequential story processing — waves express dependency order, not
  permission to parallelize — with the test-reviewer (plus the single end-of-run
  devops-reviewer pass) as the sole owner of the full-suite run. Added a one-suite-in-flight
  concurrency clause to `dotnet-conventions`, and a new "Build & test execution discipline"
  section to `react-conventions` mirroring it.

## [0.7.0] - 2026-06-20

### Added
- **Phase planning.** A new pre-BA Phase Planner agent (+ validator) splits a large
  requirement into ordered, independently shippable phases. Each phase is its own
  run under `runs/<program-id>/phase-0N/`, ships on its own branch, and opens its
  own PR.
- `/agentic-sdlc:next-phase` command to start the next phase (lazy creation;
  requires the prior phase merged; optional replan of remaining phases).
- `write-phase-plan` skill — phase-plan template and sizing/coverage conventions.

### Changed
- `/start-run` now creates a program, runs the Phase Planner loop + phase-plan
  review gate, then creates the Phase 1 run.
- `/advance-stage` and `/show-run-status` are program/phase-aware.
- `/cancel-run` now cancels the current in-progress phase only; completed phases and
  the program survive.

### Notes
- Clean break: the program/phase run layout is the only supported layout. Finish
  any in-flight flat runs on 0.6.x before upgrading.

## [0.6.5] - 2026-06-14

### Changed
- **.NET test guardrails: behavior-only scope + bounded execution.** Diagnosed a 20-minute `dotnet test` hang on Ubuntu caused by an emergent `ScaffoldTests` class that shelled out to `dotnet build`/`restore`/`sln list` (~15 nested subprocesses) to "verify" Clean Architecture project structure — deadlocking on the NuGet lock for zero behavioral coverage.
  - `dotnet-conventions`: new "Test scope: behavior only" section forbidding tests that invoke the `dotnet` CLI / spawn processes, assert on project structure or "it compiles" (enforced by the architect-validator and the build, not by tests), or depend on an ambient DB/network/Docker. Structural acceptance criteria get zero tests.
  - `dotnet-conventions` ("Build & test execution discipline"): two new rules — bound every test run with `--blame-hang-timeout` so a hang fails fast and names the test (a timeout is a failure to diagnose, not a slow run to wait out); and never pipe an observed/authoritative test run through `tail` (it buffers to EOF, hiding both progress and the hang report) — use `--logger "console;verbosity=detailed"` instead.
  - `dotnet-test-engineer`: new "Test scope (critical)" section + step 1 now skips purely structural criteria.
  - `dotnet-test-reviewer` / `devops-reviewer`: the authoritative coverage / suite runs now pass `--blame-hang-timeout 120s`.

## [0.6.4] - 2026-06-13

### Added
- **Automated GitHub releases on merge to `master`.** New `.github/workflows/release.yml` triggers on pushes to `master` that touch `plugin.json`, reads the plugin `version`, and—if a `v<version>` release doesn't already exist—creates a tag and GitHub Release whose notes are the matching `## [<version>]` section of `CHANGELOG.md`. Idempotent: merges that don't bump the version are no-ops.

## [0.6.3] - 2026-06-13

### Added
- **.NET build/test execution guardrails.** New `dotnet-conventions` section "Build & test execution discipline (CI/Ubuntu)" stating four rules: truncate error output to the first ~5 distinct errors; target the specific project while iterating (full-solution coverage run stays at the Test Reviewer gate); reuse binaries with `--no-build`/`--no-restore` only when safe, with a staleness guard; and cap the inner fix loop at 3.
  - `dotnet-engineer`: truncates build-error output when reporting out after its 3-attempt cap.
  - `dotnet-test-engineer`: new 3-attempt cap on the test-project compile loop + error truncation.
  - `dotnet-reviewer` / `dotnet-test-reviewer`: truncate build-failure / failing-test excerpts in their reports.

## [0.6.2] - 2026-06-13

### Changed
- **.NET test code now lives in a separate top-level `tests/` tree, never under `src/`.** The four source projects stay under `<backend_src>` (default `src/backend`); the xUnit test project moves to `<backend_test>` (default `tests/backend`). The `.sln` remains in `<backend_src>` and references the test project by relative path, so `dotnet build/test <backend_src>` still build and run the whole suite.
  - `start-run`: detects/derives `backend_test` (mirrors `src/<name>` → `tests/<name>`) and stores it in `state.src_paths.backend_test`.
  - `advance-stage`: threads `backend_test`/`test_path` to the .NET engineer, test engineer, and test reviewer; commits stage the test path.
  - `dotnet-conventions`: source-vs-test layout made explicit (tests never under `src/`).
  - `dotnet-engineer`: scaffolds the test project under `<backend_test>` with cross-tree project references; `.sln` (in `<backend_src>`) records the relative path.
  - `dotnet-test-engineer` / `dotnet-test-reviewer`: read/write tests under `<backend_test>`.
  - `docker-compose-setup`: .NET Dockerfile no longer restores the `.sln` (it references the out-of-context test project) — it restores/publishes the Api project directly and copies all four source `csproj` for restore-layer caching (also fixes a latent restore bug under Clean Architecture).
  - `show-run-status` / `README`: report and document the `tests/backend` location.
- **React is unchanged:** Vitest/RTL tests stay co-located next to their components inside `<frontend_src>` (the idiomatic React convention); only the .NET track uses a separate `tests/` tree.

## [0.6.1] - 2026-06-13

### Added
- `CLAUDE.md` — project instructions documenting the git workflow (always branch from an up-to-date `master`; confirm before branching off a non-`master` branch) and the release rule (bump the plugin version on every PR to `master`).

## [0.6.0] - 2026-06-13

### Added
- **Clean Architecture mandated across both tracks.** The pipeline now designs, builds, and reviews to Clean Architecture with an inward dependency rule.
  - **Backend (.NET): four projects** — `Domain` (entities, no deps) ← `Application` (use cases, DTOs, repository interfaces) ← `Infrastructure` (EF Core `DbContext`, repository impls) ← `Api` (controllers, DI composition root, `/health`). EF Core is confined to Infrastructure; controllers depend on Application interfaces, never on `DbContext`.
  - **Frontend (React): four folder layers** — `domain/` (types, models, pure logic) ← `api/` (fetch clients) ← `hooks/` (orchestration) ← `components/`+`pages/` (presentation). No `fetch`/`axios` calls inside components or pages.
- `write-tech-spec`: every backend TECH declares a `Layer` field; checklist enforces a valid layer and no outward `Depends on`.
- `architect`: assigns each backend TECH a layer and designs to the dependency rule; brownfield discovery notes the existing layer layout.
- `architect-validator`: validates layer declarations and the dependency rule (violations surface under `altered`).
- `dotnet-conventions`: replaced the single-project layout with the four-project structure, reference wiring, and per-layer placement rules.
- `dotnet-engineer`: four-project scaffolding commands (`dotnet new` + inward `dotnet add reference`); places each story's code in the correct layer.
- `dotnet-reviewer`: **CRITICAL** Clean Architecture compliance check (outward project references, `DbContext` leakage outside Infrastructure, controllers using concrete repositories, wrong-layer code).
- `react-conventions`: relabeled the structure as Clean Architecture layers, added an explicit `domain/` layer, stated the dependency rule.
- `react-engineer`: places code per layer; never calls `fetch`/`axios` inside a component or page.
- `react-reviewer`: **CRITICAL** check for `fetch`/`axios` outside `src/api/` and for cross-layer import violations.
- `docs/superpowers/specs/2026-06-13-clean-architecture-design.md` — design spec for this change.

## [0.5.0] - 2026-05-04

### Fixed (Critical)
- **C1: `dotnet sln` referenced `.slnx` while `dotnet new sln` created `.sln`.** Both `dotnet sln add` calls failed silently; the test project was never linked into the solution and tests for every story would silently fail to compile. Now uses `.sln` consistently.
- **C2: `docker-compose-setup` skill had hardcoded `./dotnet` and `./react` build contexts** — leftover from before v0.2.0 separated generated code into `state.src_paths`. Skill now uses `<backend_src>`/`<frontend_src>` placeholders with substitution instructions.
- **C3: DevOps Reviewer hardcoded ports 5000 and 3000.** If the architect chose different ports, smoke tests false-failed and burned BACK_TO_DEVOPS iterations. Reviewer now reads `BACKEND_PORT` and `FRONTEND_PORT` from `tech-spec.md` deployment topology.
- **C4: `/health` endpoint required by reviewer but never required of engineers.** Added a mandatory `TECH-HEALTH` component in `write-tech-spec`, a "/health endpoint" requirement in `dotnet-conventions`, and an explicit instruction in `dotnet-engineer.md` to scaffold it on the first story.
- **C5: Devops stage missing `iterations` counter in initial state.** `start-run` now writes `"devops": { "status": "pending", "iterations": 0 }`.
- **C6: Spec-freeze enforced only by orchestrator command, not by agents.** Added "Spec-freeze guardrail" sections to all agents that have Write/Edit tools (BA, Architect, Tech Lead, all engineers, DevOps Engineer). True file-level enforcement via hooks deferred to a future release.

### Fixed (High)
- **H1: Counter accounting bug across cross-loop routing.** When `BACK_TO_ENGINEER` fired from the test reviewer or `BACK_TO_*_ENGINEER` from the DevOps reviewer, the orchestrator reused the original `reviewer_iterations` counter — which was often near 5 from the dev phase, causing immediate false escalation. Added a separate `fix_iterations` counter that is reset to 0 on each cross-loop entry, capped at 5 per fix cycle.
- **H2: Dead state-machine references.** BA, Architect, and Tech Lead descriptions claimed to handle a `*_revision` stage that was never set. Replaced with the actual revision-via-iteration-counter pattern.
- **H4: Cycle detection in `tech-lead-validator`.** Validator now performs DFS-based DAG validation on stories' `Depends on` graph, checks for self-references, and verifies that every `Depends on` entry is a defined STORY-ID. Cycles or unknown IDs fail the validation.
- **H5: Workspace `.gitignore` runs/ policy documented.** The intentional difference between marketplace `.gitignore` (excludes `runs/`) and workspace `.gitignore` (commits `runs/` as audit trail) is now spelled out in start-run Step 5.
- **H6: CHANGELOG missing v0.4.0 entry.** Added retroactively (see below).
- **H7: Frontend smoke test false-PASSed on broken bundles.** nginx serves `index.html` for any path. Smoke test now verifies a `<script src="...">` tag is present in the response.
- **H8: `dotnet test` / `npm test` ran twice per story.** Test engineer's full test pass was redundant with the test reviewer's coverage-instrumented run. Test engineers now compile-check (`dotnet build` / `tsc --noEmit`) instead.
- **H9: `/cancel-run` git branch deletion was fragile.** Used `git checkout -` as final fallback, which could land back on the run branch and then fail to delete it. `start-run` now records `parent_branch` in `state.json`; `cancel-run` uses it as the primary fallback target.
- **H11: Default coverage threshold fallback was implicit.** Test reviewers now explicitly fall back to `{lines: 80, critical_paths: 90}` when the story has no `coverage_threshold` field.

### Fixed (Medium)
- **M2: Hardcoded model IDs replaced with family aliases.** All 16 agents now use `model: sonnet` or `model: opus` instead of pinned versions like `claude-sonnet-4-6`. Plugin no longer breaks when a pinned minor is retired.
- **M3: Tech-stack lock-in is announced upfront.** `/start-run` now states the fixed stack (.NET 8 + React 18 + Postgres + Docker Compose) before asking for the requirement, so users with a different stack stop early instead of getting a forced spec.
- **M4: Removed redundant `npm install` after `npm create vite`** in `react-engineer`. Vite's create command already installs base dependencies.
- **M8: `show-run-status` handles missing `Version:` line gracefully** (mid-write or malformed artifacts now report `v?` instead of erroring).
- **M9: `.env.example` template note** explicitly tells the DevOps Engineer to include every env var referenced in the generated `docker-compose.yml`, not just the database baseline.
- **M10: `/start-run` refuses if a run is already active**, with a clear message pointing to `/advance-stage` or `/cancel-run`.

### Fixed (Low)
- **N1: Added `license: "MIT"` to plugin.json.**
- **N3: `.gitignore` template** removed redundant `**/coverage/` (kept `**/coverage*/` superset), added `*.log`.
- **N4: `dotnet tool install`** uses `--tool-path` instead of `-g` so reportgenerator is installed into the run's coverage directory rather than polluting the user's machine.

### Deferred to a future release
- H3: Topological story-dispatch algorithm (Kahn's algorithm) — current rule "empty `Depends on` first" is ambiguous past initial stories.
- H10: Resume-after-crash command — `state.json` captures enough state, but no UX exists.
- H12: Robust prompt-injection defense in BA agent — added a one-line guardrail; full mitigation needs a separate effort.
- M1: Unify all agent communication on JSON (vs. current mix of JSON for validators / Markdown for reviewers).
- M5: Retry/backoff for transient failures (network blips during `npm ci`, `dotnet restore`, `docker pull`).
- M6: Consistent state-update-then-commit ordering across all `/advance-stage` phases.
- N2: Iter=5 escalation arrows in the README mermaid diagram.

### Added
- `docs/REVIEW-2026-05-04.md` — full deep-review document tracking every finding with severity, location, and disposition.

## [0.4.0] - 2026-05-04

### Added
- **Auto-continue pipeline after approval.** After each user-review gate (`approve` reply), the orchestrator now immediately proceeds to the next stage instead of asking the user to run `/agentic-sdlc:advance-stage` manually. The user only types `approve` once per gate.

### Changed
- `start-run` and `advance-stage` updated to chain stages internally on approval (commit `5db136e`).

## [0.3.0] - 2026-05-04

### Changed
- **Granular git commits at every agent handover.** The orchestrator now commits after every step that produces or updates files — not just at story DONE and DevOps DONE.
- Commit points in `start-run`: run init, BA draft, BA validation outcome, req-spec approved.
- Commit points in `advance-stage` (architect): tech-spec draft, validation outcome, tech-spec approved.
- Commit points in `advance-stage` (tech lead): stories draft, validation outcome, stories approved + spec frozen.
- Commit points in `advance-stage` (development, per story): engineer draft, reviewer outcome, test engineer draft, test reviewer outcome, story complete.
- Commit points in `advance-stage` (devops): DevOps engineer draft, reviewer outcome, engineer fix cycles, run complete.
- Conventional commit message scheme: `docs(<run-id>)` for specs, `feat(STORY-XXX)` for production code, `test(STORY-XXX)` for tests, `fix(STORY-XXX)` for bug fixes, `chore` for devops/config.
- `runs/<run-id>/state.json` included in every commit so the run state is always captured alongside the artifact changes.

## [0.2.0] - 2026-05-04

### Changed
- **Generated code no longer lives inside `runs/`**. Code is written to `src/backend` and `src/frontend` (or the detected existing source layout) at the workspace root.
- **Per-run git branch**. `/start-run` creates branch `agentic-sdlc/<run-id>`. Each completed story is committed with `feat(STORY-XXX): <title>`. DevOps artifacts get a final commit. At completion, the user opens a PR from the run branch to main.
- **`runs/<run-id>/` is now SDLC audit trail only**: contains `state.json`, `raw-input.md`, `req-spec.md`, `tech-spec.md`, `stories.md`.
- **Source path detection**. `/start-run` inspects the workspace and detects or asks for `backend_src` / `frontend_src`. Paths are stored in `state.json` and passed to all engineering agents.
- **Workspace-root DevOps outputs**. `docker-compose.yml`, `.env.example`, and `README.md` are written to the workspace root. Build contexts in `docker-compose.yml` reference `backend_src` and `frontend_src` correctly.
- **`/cancel-run` now deletes the git branch**. Switching to main automatically restores the workspace; no manual code cleanup needed.
- **`.gitignore` bootstrap**. `/start-run` ensures `.gitignore` covers `bin/`, `obj/`, `node_modules/`, `dist/`, `coverage*/`, and `.env`.
- All 10 engineering agents updated to receive and use `backend_src` / `frontend_src` paths instead of hard-coded `runs/<run-id>/dotnet` or `runs/<run-id>/react` paths.

## [0.1.0] - 2026-05-03

### Added
- Initial release of the agentic-sdlc plugin.
- 16 subagents: BA, BA Validator, Architect, Architect Validator, Tech Lead, Tech Lead Validator, .NET Engineer/Reviewer/Test Engineer/Test Reviewer, React Engineer/Reviewer/Test Engineer/Test Reviewer, DevOps Engineer/Reviewer.
- 8 skills: validate-traceability, write-req-spec, write-tech-spec, write-stories, dotnet-conventions, react-conventions, coverage-report, docker-compose-setup.
- 4 slash commands: start-run, advance-stage, cancel-run, show-run-status.
- Creator + Validator pattern with up to 5-iteration loops and user escalation.
- Spec freeze enforcement after Tech Lead approval.
- Cross-track bug routing from DevOps Reviewer to the correct Engineer.
