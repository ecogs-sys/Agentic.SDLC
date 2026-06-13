# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

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
