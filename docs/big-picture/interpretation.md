# Workflow evidence and diagram corrections

Reviewed 25 September 2026. Commands and stage handlers define orchestration; executable helper code defines what its checks actually perform. Agent definitions clarify review responsibilities. The README and hand sketch are secondary references. No workflow implementation was edited.

## Source map

All paths below are relative links into the actual workflow definitions.

| Diagram element | Source | Behavior represented |
| --- | --- | --- |
| Request, code detection, archetype, BA and Phase Planner | [start-run](../../plugins/agentic-sdlc/commands/start-run.md) | Program BA once, approved master requirements, phase split by requirement IDs, planner validation and human gate. |
| Existing-system survey, triage and route selection | [start-run, B3–B5 and BP1–BP5](../../plugins/agentic-sdlc/commands/start-run.md) | Surveyor/validator + triage; fixes/small changes use Fix Planner; single new feature uses BA/Architect/Tech Lead; split features become a phased program after deep survey. |
| Stage dispatch, freeze and serialization | [advance-stage](../../plugins/agentic-sdlc/commands/advance-stage.md) | Programs start each phase at Architect. Brownfield flat runs use the driver. Frozen specifications cannot be edited by upstream stages. |
| Creator/validator and human feedback loops | [validation-loop](../../plugins/agentic-sdlc/skills/validation-loop/SKILL.md) | Five-iteration caps, escalation to human guidance, artifact review after validation, revision on non-approval. |
| Technical design and requirements reopen | [stage-architect](../../plugins/agentic-sdlc/skills/stage-architect/SKILL.md) | Technical changes return to Architect; requirements changes reopen BA with scoped correction, validation and human reapproval. Shipped/frozen criteria are protected. |
| Stories and eval manifest generation | [stage-tech-lead](../../plugins/agentic-sdlc/skills/stage-tech-lead/SKILL.md) | Tech Lead/validator, human story approval, repository-unique story IDs, generated eval manifest. Story approval does not freeze the specification. |
| Eval review and freeze | [stage-evals](../../plugins/agentic-sdlc/skills/stage-evals/SKILL.md) | Pure human gate; local check-kind changes remain here; criterion edits return to the owning stage. Approval freezes specs and starts development. |
| Serial implementation, testing and eval checks | [stage-development](../../plugins/agentic-sdlc/skills/stage-development/SKILL.md) | One story's complete chain at a time; dependency waves then story ID; code/test revision routes; per-story coverage check; promotion and corpus replay before final verification. |
| Actual eval helper behavior | [evals.mjs](../../plugins/agentic-sdlc/scripts/evals.mjs) | `author`, `scan`, `run`, `promote`, `replay`, `retire`, `supersede`; test-tag coverage and retention, not test execution. |
| Eval conventions | [write-evals](../../plugins/agentic-sdlc/skills/write-evals/SKILL.md) | Acceptance criteria linked to tagged tests; permanent corpus and reviewed retirement/supersession. See implementation differences below. |
| Web final verification | [stage-devops](../../plugins/agentic-sdlc/skills/stage-devops/SKILL.md), [DevOps Reviewer](../../plugins/agentic-sdlc/agents/devops-reviewer.md) | Container build/start/smoke/tests/shutdown; config or story repair routing; ambiguity to human; completed branch handed off for PR. |
| Desktop/firmware final verification | [stage-packaging](../../plugins/agentic-sdlc/skills/stage-packaging/SKILL.md), [Embedded Packager Reviewer](../../plugins/agentic-sdlc/agents/embedded-packager-reviewer.md) | Electron unpacked build/smoke launch; firmware build/size/host tests, no flashing; packager or story repair routing. |
| Existing-system execution | [brownfield-driver](../../plugins/agentic-sdlc/skills/brownfield-driver/SKILL.md), [brownfield-mode](../../plugins/agentic-sdlc/skills/brownfield-mode/SKILL.md) | Fix-plan approval synthesizes stories; edit existing code; compare full tests with baseline; conditional DevOps/Packaging; single change-run PR. |
| Next phase and replan | [next-phase](../../plugins/agentic-sdlc/commands/next-phase.md) | Current phase must be complete, user confirms merge; optional remaining-phase replan with planner validation/approval; next phase begins at Architect. |
| Optional discovery | [brainstorm](../../plugins/agentic-sdlc/commands/brainstorm.md) | Idea Generator → Idea Critic → human selects/revises shortlist → Concept Detailer → summary → optional start-run handoff. Independent of the delivery stage machine. |

## Corrections to the sketch-based draft

- Removed the invented Evaluation agent and reviewer. Eval authoring is a helper operation followed by a human review gate.
- Made the specification-freeze point explicit: human approval of evals, after story/fix-plan approval.
- Distinguished program-level BA and Phase Planner from per-phase Architect and downstream delivery.
- Added code review, test authoring, test review, story eval coverage, corpus promotion/replay, final verification and PR handoff.
- Removed assumed routine human approvals after every agent pair. Human planning/eval gates, escalation decisions and PR shipping decisions are distinct.
- Replaced unrestricted cross-stage feedback with the defined pre-freeze ownership routes and post-freeze guard.
- Added the three application routes: .NET/React web, Electron desktop and ESP-IDF embedded.
- Added survey/triage, Fix Planner for bug fixes and small changes, single-feature changes and phased brownfield programs.
- Added merge-dependent phase continuation and optional replanning of remaining phases. Final verification does not deploy to production or merge PRs automatically.

## Gate and feedback details

| Trigger | Destination / next action |
| --- | --- |
| Planning validator failure | Same creator; repeat validation; escalate at five-iteration cap. |
| Human rejects a planning artifact | Owning creator/validator loop; user revisions count toward the cap. |
| Human requests technical-spec changes | Architect directly, or BA for a requirements correction; reapprove changed requirements and return through architecture. |
| Eval check-kind edit | Update kind locally, redisplay, stay at eval gate. |
| Eval criterion added, removed or reworded | Tech Lead or Fix Planner; Architect/BA if the run has those stages and the change belongs there. Regenerate manifest and re-review. |
| Frozen upstream artifact would change | Dispatcher blocks the edit and directs cancellation/new run. |
| Code review failure | Engineer → Code Reviewer. |
| Test-quality failure or missing criterion tag | Test Engineer → Test Reviewer → story coverage check. |
| Production bug found by test review | Owning Engineer → Code Reviewer → test loop again. |
| Corpus replay loses a test link | Repair regression; intentional behavior change uses reviewed retire/supersede, then replay. |
| Final infrastructure/packaging failure | DevOps Engineer / Packager and corresponding reviewer. |
| Final review finds a story bug | Owning story's code review and full test loop, then repeat final verification. |
| Five-iteration cap / final-review ambiguity | Human guidance; not an automatic approval. |

## Source inconsistencies and limits — recorded, not changed

1. **Eval promotion timing.** `write-evals` initially says promotion happens on merge. The explicit `stage-development` completion block promotes and replays before DevOps/Packaging and before the PR. The diagram follows the stage handler.
2. **Eval execution.** The stage-evals prose describes `assert` probes and `judge` rubrics. In `evals.mjs`, `run` treats non-test kinds as passing without executing them; `replay` selects only active `test` evals. For test evals, `run` checks binding presence and takes `--suite-green` from prior test execution. The diagram therefore claims coverage/link checking, not probe execution, AI judging, or independent rerunning of tests.
3. **BA reopen in phased programs.** `stage-evals` describes reopening run-local BA state, whereas normal program phases have a program-level master requirement spec and no phase-local BA stage. `stage-architect` explicitly handles that program-level reopen. The diagram shows the intended ownership route; it does not claim these two implementations are reconciled.
4. **New requirements versus replanning.** The Architect handler directs genuinely new requirements to `next-phase --replan`, but the next-phase command describes redistributing existing requirement IDs without modifying the master spec. The diagram labels replan as remaining-phase planning only; it does not invent a supported new-requirements path.
5. **Brownfield program completion.** The dispatcher explicitly says phased brownfield work uses normal program completion and conditional final verification. Final-stage brownfield notes broadly say to return to the brownfield driver, which only owns flat `change-*` runs. The diagram uses the dispatcher distinction; the overlapping wording remains in the source.
6. **Completed versus shipped.** State marks a run/phase complete before PR merge. The diagram labels that as a reviewable branch, with human PR review/merge still required. Next-phase asks for human confirmation of merge; it does not independently verify merge status.

## Supporting workflow controls

`show-run-status` exposes progress, `advance-stage` resumes/dispatches the active run, and `cancel-run` terminates a run through the workflow's cancellation procedure. These are controls around the lifecycle, not new delivery stages. `start-run` prevents concurrent active runs/programs. The optional brainstorm flow is independent and has no automatic branch or commit until a start-run handoff is selected.

The source snapshot is recorded in [workflow-source-hashes.json](workflow-source-hashes.json). All 86 captured plugin files were included in the read-only hash check; the map above identifies the definitions used to establish the diagram.
