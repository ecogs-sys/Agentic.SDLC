# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

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
