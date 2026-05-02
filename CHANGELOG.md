# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

## [0.1.0] - 2026-05-03

### Added
- Initial release of the agentic-sdlc plugin.
- 16 subagents: BA, BA Validator, Architect, Architect Validator, Tech Lead, Tech Lead Validator, .NET Engineer/Reviewer/Test Engineer/Test Reviewer, React Engineer/Reviewer/Test Engineer/Test Reviewer, DevOps Engineer/Reviewer.
- 8 skills: validate-traceability, write-req-spec, write-tech-spec, write-stories, dotnet-conventions, react-conventions, coverage-report, docker-compose-setup.
- 4 slash commands: start-run, advance-stage, cancel-run, show-run-status.
- Creator + Validator pattern with up to 5-iteration loops and user escalation.
- Spec freeze enforcement after Tech Lead approval.
- Cross-track bug routing from DevOps Reviewer to the correct Engineer.
