# Agentic SDLC — Technical Specification

> A multi-agent software development lifecycle implemented as Claude Code subagents. The system takes a user requirement and produces a runnable application (.NET backend + React frontend) through a pipeline of specialised agents, with traceability and validation at every stage.

---

## 1. Overview

### 1.1 Purpose
Build a Claude Code-based agentic system that replaces the manual SDLC stages (BA → Architect → Tech Lead → Engineers → Testers → DevOps) with specialised subagents. Each stage produces a versioned artifact that traces back to the source requirement.

### 1.2 Core principles

1. **Requirement spec is the source of truth.** Every downstream artifact must trace back to it.
2. **Creator + Validator pattern.** Every agent that produces an artifact has a paired validator that loops until the output is correct, before any external (user) review.
3. **Spec freeze at story dispatch.** Once development begins, all upstream specs are immutable. To change anything upstream, the run is cancelled and restarted.
4. **Single-language tracks.** Development is split into parallel tracks per technology (.NET, React). Each track has its own engineer/reviewer/test pairs.
5. **Runnable definition of done.** A run is complete only when a fresh environment can clone the repo, run one command, and end up with a working app whose tests pass.

### 1.3 Lifecycle phases

```
Planning phase (bidirectional, user can iterate)
  User input
  → BA + BA Validator (loop)
  → User review (reject = back to BA)
  → Architect + Architect Validator (loop)
  → User review (reject = back to Architect)
  → Tech Lead + Tech Lead Validator (loop)
  → User review (reject = back to Tech Lead)

═══ SPEC FREEZE — point of no return ═══

Development phase (specs frozen, parallel)
  Story dispatch
  → .NET track:    Dev loop → Test loop (with coverage)
  → React track:   Dev loop → Test loop (with coverage)
  Production bug found in test loop → back to Engineer

DevOps phase
  → DevOps Engineer + DevOps Reviewer (loop)
  Cross-track bug → back to relevant track's Engineer
  → Runnable application
```

---

## 2. Implementation approach

### 2.1 Why Claude Code subagents

Each role in the lifecycle is implemented as a **custom Claude Code subagent** defined as a markdown file with YAML frontmatter, distributed inside the plugin's `agents/` directory. Subagents give us:

- **Isolated context windows** — the .NET Engineer doesn't pollute the React Engineer's context, and validators get a clean read of the artifact they're checking.
- **Scoped tool permissions** — the BA agent only needs Read/Write for spec files, while the .NET Engineer needs Bash for running `dotnet` commands.
- **Independent system prompts** — each agent has a focused role definition.
- **Composability** — the main Claude Code session orchestrates by delegating to subagents in sequence.

### 2.2 Why skills

Skills (markdown files at `skills/<name>/SKILL.md` inside the plugin) encode **reusable workflows that any agent might need**. Things like:
- How to write a requirement spec in the project's standard format
- How to validate one artifact against another (the diff-report format)
- How to write idiomatic .NET code for this project
- How to write idiomatic React code for this project
- How to set up coverage reporting

Skills are the right tool for "how to do X correctly in this project" knowledge that several agents might need to reference. They support progressive disclosure — only the YAML frontmatter is loaded into context until an agent decides the skill is relevant and reads the body.

### 2.3 Distribution model: Claude Code plugin in a git marketplace

This system is distributed as a **Claude Code plugin** hosted in a git repository configured as a marketplace. End users install it with:

```
/plugin marketplace add <github-org>/<repo-name>
/plugin install agentic-sdlc@<marketplace-name>
```

After install, users get the slash commands, subagents, and skills available in any project they open in Claude Code. The plugin files are managed by Claude Code's plugin cache; they are not copied into the user's project.

**What the user's project needs:** only a `runs/` directory at the workspace root, which the plugin's slash commands create on first run.

### 2.4 Repository structure (this repo — the marketplace)

```
<your-repo>/                                  # The git repo users install from
├── .claude-plugin/
│   └── marketplace.json                      # Marketplace manifest
├── plugins/
│   └── agentic-sdlc/                         # The single plugin
│       ├── .claude-plugin/
│       │   └── plugin.json                   # Plugin manifest (name, version, etc.)
│       ├── agents/                           # Subagent definitions
│       │   ├── ba.md
│       │   ├── ba-validator.md
│       │   ├── architect.md
│       │   ├── architect-validator.md
│       │   ├── tech-lead.md
│       │   ├── tech-lead-validator.md
│       │   ├── dotnet-engineer.md
│       │   ├── dotnet-reviewer.md
│       │   ├── dotnet-test-engineer.md
│       │   ├── dotnet-test-reviewer.md
│       │   ├── react-engineer.md
│       │   ├── react-reviewer.md
│       │   ├── react-test-engineer.md
│       │   ├── react-test-reviewer.md
│       │   ├── devops-engineer.md
│       │   └── devops-reviewer.md
│       ├── skills/                           # Reusable workflows
│       │   ├── write-req-spec/SKILL.md
│       │   ├── write-tech-spec/SKILL.md
│       │   ├── write-stories/SKILL.md
│       │   ├── validate-traceability/SKILL.md
│       │   ├── dotnet-conventions/SKILL.md
│       │   ├── react-conventions/SKILL.md
│       │   ├── coverage-report/SKILL.md
│       │   └── docker-compose-setup/SKILL.md
│       ├── commands/                         # Slash commands
│       │   ├── start-run.md
│       │   ├── advance-stage.md
│       │   ├── cancel-run.md
│       │   └── show-run-status.md
│       └── README.md                         # Plugin user-facing docs
├── README.md                                 # Repo top-level docs (install steps)
├── CHANGELOG.md
└── LICENSE
```

**Key files:**

`.claude-plugin/marketplace.json` (at repo root):
```json
{
  "name": "agentic-sdlc-marketplace",
  "owner": { "name": "<your name>", "email": "<your email>" },
  "plugins": [
    {
      "name": "agentic-sdlc",
      "source": "./plugins/agentic-sdlc",
      "description": "Multi-agent SDLC pipeline: requirement → spec → stories → code → tests → runnable app."
    }
  ]
}
```

`plugins/agentic-sdlc/.claude-plugin/plugin.json`:
```json
{
  "name": "agentic-sdlc",
  "version": "0.1.0",
  "description": "Agentic SDLC for .NET + React applications.",
  "author": { "name": "<your name>" }
}
```

### 2.5 User project structure (created at runtime)

When a user runs `/start-run` in their workspace, the plugin creates:

```
<user-workspace>/
└── runs/                                     # Created by plugin on first run
    └── <run-id>/
        ├── state.json                        # Run state machine
        ├── raw-input.md                      # Original user requirement
        ├── req-spec.md
        ├── tech-spec.md
        ├── stories.md
        ├── dotnet/                           # .NET project (built during dev phase)
        ├── react/                            # React project (built during dev phase)
        └── docker-compose.yml                # Built during DevOps phase
```

### 2.6 Orchestration model

**Approach: orchestration via slash commands + state file, not a custom binary.**

- A `runs/<run-id>/state.json` file tracks the current stage of each run.
- The main Claude Code session is the orchestrator. It reads `state.json`, delegates to the appropriate subagent, and updates state on completion.
- Slash commands (`/start-run`, `/advance-stage`, `/cancel-run`, `/show-run-status`) drive the flow.
- This keeps the system as plain markdown + JSON files. No external runtime required.

### 2.7 Plugin namespacing

Slash commands and agents from a plugin are namespaced. Users invoke them as `/agentic-sdlc:start-run` (or whatever short form Claude Code resolves automatically when there's no conflict). All subagent and skill names should be descriptive enough to avoid collisions with other installed plugins — e.g. `dotnet-engineer` is fine because it's specific; `engineer` would be too generic.

---

## 3. Artifact schemas

All artifacts use stable IDs for traceability. IDs are write-once — once assigned, never change.

### 3.1 Raw input (`raw-input.md`)
The user's original requirement, preserved verbatim. Used by the BA Validator to check that the BA didn't drop or alter anything.

### 3.2 Requirement spec (`req-spec.md`)

```markdown
# Requirement spec
Run ID: <run-id>
Status: draft | approved
Version: <n>

## Overview
<one-paragraph summary>

## Requirements
### REQ-001: <short name>
**Description:** <plain language, no technical content>
**Acceptance criteria:**
- <criterion 1>
- <criterion 2>
**Source:** raw-input.md, paragraph <n>

### REQ-002: ...
```

**Rules:**
- Every REQ has a stable ID.
- Every REQ cites which part of `raw-input.md` it came from.
- No technical implementation details.

### 3.3 Technical spec (`tech-spec.md`)

```markdown
# Technical spec
Run ID: <run-id>
Status: draft | approved
Version: <n>

## Architecture overview
<high-level description>

## Stack
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose

## Components
### TECH-001: <component name>
**Type:** API endpoint | UI component | service | data model | ...
**Description:** <technical detail>
**Implements:** [REQ-001, REQ-003]
**Depends on:** [TECH-005]

### TECH-002: ...

## Deployment topology
<how the components are wired together — ports, env vars, networks>
```

**Rules:**
- Every TECH must implement at least one REQ.
- Every REQ must be implemented by at least one TECH.
- Stack and topology are decided here so DevOps has something concrete to execute against.

### 3.4 Stories (`stories.md`)

```markdown
# Stories
Run ID: <run-id>
Status: draft | approved
Version: <n>

## STORY-001: <short name>
**Track:** dotnet | react
**Implements:** [TECH-001, TECH-002]
**Description:** <what to build>
**Acceptance criteria:**
- <test that proves it works>
**Depends on:** []
**Estimated complexity:** S | M | L

## STORY-002: ...
```

**Rules:**
- Each story belongs to exactly one track.
- Every TECH must be covered by at least one story.
- Stories list their dependencies so the dispatcher can run independent stories in parallel.

### 3.5 Run state (`state.json`)

```json
{
  "run_id": "run-2026-05-02-001",
  "current_stage": "architect",
  "spec_frozen": false,
  "stages": {
    "ba": { "status": "complete", "iterations": 2 },
    "ba_validation": { "status": "complete", "iterations": 1 },
    "user_review_req": { "status": "complete" },
    "architect": { "status": "in_progress", "iterations": 1 },
    "architect_validation": { "status": "pending" },
    "...": {}
  },
  "stories": {
    "STORY-001": { "track": "dotnet", "status": "pending" },
    "STORY-002": { "track": "react", "status": "pending" }
  }
}
```

The orchestrator reads this file to decide what to do next, and updates it after each stage completes.

---

## 4. Subagent specifications

Each subagent is defined in `.claude/agents/<name>.md` with YAML frontmatter and a system prompt body. The format below applies to every agent.

### 4.1 General subagent format

```markdown
---
name: <agent-name>
description: <when this agent should be invoked — be pushy/specific so it triggers reliably>
tools: <comma-separated tool list>
model: sonnet | opus | haiku
---

You are <role description>.

## Your job
<single-sentence purpose>

## Inputs
<what files/artifacts you read>

## Outputs
<what files/artifacts you produce>

## Process
<step-by-step instructions>

## Definition of done
<binary success criteria the agent self-checks before finishing>

## Failure modes
<what to do when stuck — typically: report obstacle, do not invent>
```

### 4.2 Planning phase agents

#### 4.2.1 Business Analyst (`ba.md`)
- **Inputs:** `raw-input.md`, plus optional revision notes from previous iteration.
- **Outputs:** `req-spec.md`.
- **Tools:** Read, Write, Edit.
- **Model:** sonnet (good at language work, fast).
- **Key rule:** No technical content. Pure requirements.
- **Definition of done:** Every paragraph of `raw-input.md` is covered by at least one REQ; every REQ has acceptance criteria; no implementation details mentioned.

#### 4.2.2 BA Validator (`ba-validator.md`)
- **Inputs:** `raw-input.md`, `req-spec.md`.
- **Outputs:** Validation report (pass/fail + diff if fail).
- **Tools:** Read.
- **Model:** sonnet.
- **Key rule:** Compare structured spec against unstructured input; flag missing, added, or altered content.
- **Definition of done:** Either signs off, or returns a structured diff: `{missing: [...], added_without_source: [...], altered: [...]}`.

#### 4.2.3 Architect (`architect.md`)
- **Inputs:** `req-spec.md`, plus optional revision notes.
- **Outputs:** `tech-spec.md`.
- **Tools:** Read, Write, Edit.
- **Model:** opus (architecture decisions benefit from stronger reasoning).
- **Definition of done:** Every REQ-ID is implemented by at least one TECH-ID; deployment topology is concrete enough for DevOps to execute against.

#### 4.2.4 Architect Validator (`architect-validator.md`)
- **Inputs:** `req-spec.md`, `tech-spec.md`.
- **Outputs:** Validation report.
- **Tools:** Read.
- **Model:** sonnet.
- **Key rule:** Bidirectional traceability — no orphan REQs, no unjustified TECHs.

#### 4.2.5 Tech Lead (`tech-lead.md`)
- **Inputs:** `tech-spec.md`, plus optional revision notes.
- **Outputs:** `stories.md`.
- **Tools:** Read, Write, Edit.
- **Model:** opus (story breakdown needs strong technical judgment).
- **Definition of done:** Every TECH-ID is covered by at least one story; stories are independently deliverable where dependencies allow; each story has clear acceptance criteria.

#### 4.2.6 Tech Lead Validator (`tech-lead-validator.md`)
- **Inputs:** `tech-spec.md`, `stories.md`.
- **Outputs:** Validation report.
- **Tools:** Read.
- **Model:** sonnet.

### 4.3 Development phase agents

#### 4.3.1 .NET Engineer (`dotnet-engineer.md`)
- **Inputs:** A specific story, the tech spec, the existing `dotnet/` project state.
- **Outputs:** Modified files in `dotnet/`.
- **Tools:** Read, Write, Edit, Bash, Grep, Glob.
- **Model:** sonnet.
- **Key rule:** Implement only what the story asks for. Do not modify other tracks.
- **Definition of done:** `dotnet build` succeeds; story's acceptance criteria can be verified manually.

#### 4.3.2 .NET Reviewer (`dotnet-reviewer.md`)
- **Inputs:** The same story + the modified files.
- **Outputs:** Review report (pass/fail + specific issues).
- **Tools:** Read, Bash (for `dotnet build`, linters).
- **Model:** sonnet.
- **Checks:** Build passes, code matches story scope, follows .NET conventions skill, no obvious bugs.

#### 4.3.3 .NET Test Engineer (`dotnet-test-engineer.md`)
- **Inputs:** The story + the implemented production code.
- **Outputs:** Test files in `dotnet/<project>.Tests/`.
- **Tools:** Read, Write, Edit, Bash.
- **Model:** sonnet.
- **Definition of done:** `dotnet test` passes; tests cover the story's acceptance criteria.

#### 4.3.4 .NET Test Reviewer (`dotnet-test-reviewer.md`)
- **Inputs:** The story, the production code, the test code.
- **Outputs:** Review report including coverage analysis.
- **Tools:** Read, Bash (`dotnet test --collect:"XPlat Code Coverage"`).
- **Model:** sonnet.
- **Checks:** Tests pass, coverage meets threshold (default 80% lines, 90% on critical paths defined per story), tests cover acceptance criteria, tests are not trivially passing.
- **Output decisions:**
  - Tests pass + coverage met → done.
  - Tests fail because tests are wrong → back to Test Engineer.
  - Tests fail because production code is wrong → back to .NET Engineer.

#### 4.3.5 React agents (mirror of .NET set)
React Engineer, Reviewer, Test Engineer, Test Reviewer — same shape, but using `npm`/`vite`/`vitest` and React conventions skill.

### 4.4 DevOps phase agents

#### 4.4.1 DevOps Engineer (`devops-engineer.md`)
- **Inputs:** Completed `dotnet/` and `react/` projects, the tech spec's deployment topology section.
- **Outputs:** `Dockerfile`s, `docker-compose.yml`, `.env.example`, run scripts, README boot instructions.
- **Tools:** Read, Write, Edit, Bash.
- **Model:** sonnet.
- **Definition of done:** Single command (`docker compose up`) boots the full stack; frontend can reach backend; all unit tests run as part of CI script.

#### 4.4.2 DevOps Reviewer (`devops-reviewer.md`)
- **Inputs:** Everything in the run directory.
- **Outputs:** Build/run/test report.
- **Tools:** Read, Bash (with permission to spin up Docker containers).
- **Model:** sonnet.
- **Process:** Run in a clean working directory. Execute `docker compose build`, `docker compose up`, smoke endpoint check, `docker compose down`, run tests.
- **Output decisions:**
  - All green → done.
  - DevOps config issue → back to DevOps Engineer.
  - .NET runtime bug → back to .NET Engineer (cross-track edge).
  - React runtime bug → back to React Engineer (cross-track edge).
  - Tech spec ambiguity (e.g. API contract mismatch with no clear "right" side) → flag for human; do not auto-route.

---

## 5. Skills

Skills encode reusable workflows. Each lives at `.claude/skills/<name>/SKILL.md`.

### 5.1 `validate-traceability`
**Used by:** All Validator agents.
**Purpose:** How to compare two artifacts and produce a structured diff report.
**Contents:** The diff schema (`{missing, added_without_source, altered}`), examples of each type, instructions to be exhaustive (cite line numbers).

### 5.2 `write-req-spec`, `write-tech-spec`, `write-stories`
**Used by:** BA, Architect, Tech Lead respectively.
**Purpose:** Templates and conventions for writing each artifact, including ID assignment rules.

### 5.3 `dotnet-conventions`
**Used by:** .NET Engineer, .NET Reviewer, .NET Test Engineer, .NET Test Reviewer.
**Purpose:** Project-specific .NET style: naming, async patterns, DI setup, EF Core migration approach, xUnit test structure, mocking with Moq.
**Why a skill:** Multiple agents need the same conventions; updating once propagates to all.

### 5.4 `react-conventions`
**Used by:** React Engineer, React Reviewer, React Test Engineer, React Test Reviewer.
**Purpose:** Component structure, state management approach, TypeScript style, Vitest + React Testing Library patterns.

### 5.5 `coverage-report`
**Used by:** Both Test Reviewers.
**Purpose:** How to run coverage tooling per language and interpret the results against the threshold.

### 5.6 `docker-compose-setup`
**Used by:** DevOps Engineer.
**Purpose:** Standard pattern for the project's docker-compose: service naming, volume conventions, env var handling, health checks.

---

## 6. Slash commands

### 6.1 `/start-run`
- Asks user for the requirement input.
- Creates `runs/<run-id>/`.
- Writes `raw-input.md` and initial `state.json`.
- Delegates to BA agent.

### 6.2 `/advance-stage`
- Reads `state.json`.
- Determines next agent based on current stage and stage status.
- Delegates to that agent.
- Updates `state.json` on completion.
- Pauses at user-review gates and prompts the user.

### 6.3 `/cancel-run`
- Marks the run as cancelled in `state.json`.
- Optionally archives the run directory.

### 6.4 `/show-run-status`
- Pretty-prints the current state for the user.

---

## 7. Loop semantics

### 7.1 Agent ↔ Validator loops (planning phase)
- Max iterations: 5.
- On iteration 5 failing, escalate to user with the validator's diff report.
- The user can either provide guidance or cancel the run.

### 7.2 Engineer ↔ Reviewer loops (dev phase)
- Max iterations: 5.
- On iteration 5 failing, escalate to user with both agents' last reports.

### 7.3 Test Engineer ↔ Test Reviewer loops
- Max iterations: 5.
- Coverage threshold is configurable per story (default 80/90).

### 7.4 Cross-track bug routing
- Detected by a Test Reviewer or DevOps Reviewer.
- The reviewer must clearly state: "production bug in <track>, see <test name> failing because <reason>".
- The orchestrator (main Claude Code session) reads the report, places the relevant story back on the affected Engineer's queue, and adds the failing test as additional context.

### 7.5 Spec freeze enforcement
- After Tech Lead user-review approval, `state.spec_frozen = true`.
- Once frozen, any agent attempting to modify `req-spec.md`, `tech-spec.md`, or `stories.md` must fail with a clear error.
- Changes require `/cancel-run` and a new run.

---

## 8. Plugin documentation

### 8.1 Plugin README (`plugins/agentic-sdlc/README.md`)

Should contain:
- One-paragraph overview of what the plugin does.
- Compressed version of section 1 (principles + lifecycle phases).
- Quick start: `/plugin marketplace add ...` then `/plugin install ...` then `/agentic-sdlc:start-run`.
- The pipeline order and which agent runs when.
- The "spec frozen" rule and how cancellation works.
- Where artifacts live in the user's workspace (`runs/<run-id>/`).
- Troubleshooting (common issues, e.g. coverage threshold misses).

### 8.2 Repo top-level README

Should contain:
- What the marketplace is.
- Install instructions.
- Link to plugin README.
- Contributor notes (how to test plugin changes locally).

### 8.3 No CLAUDE.md needed in this repo

The plugin's instructions to Claude live inside the agent definitions, skills, and slash command files — that's the whole point of the plugin format. A root `CLAUDE.md` would only be useful for contributors hacking on the plugin itself.

---

## 9. Plugin development workflow

The implementer needs to know how to test the plugin during development without publishing it.

### 9.1 Local testing

From inside the marketplace repo:
```
claude
/plugin marketplace add .
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

This loads the marketplace from the current directory. After making changes:
```
/plugin uninstall agentic-sdlc@agentic-sdlc-marketplace
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

(Or use whatever live-reload mechanism Claude Code's current docs recommend — check `https://code.claude.com/docs/en/plugin-marketplaces` at implementation time.)

### 9.2 Publishing

Push the repo to GitHub. Users install with:
```
/plugin marketplace add <github-org>/<repo-name>
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

### 9.3 Versioning

Bump the `version` field in `plugins/agentic-sdlc/.claude-plugin/plugin.json` on every change. Tag git releases matching the version (`v0.1.0`, `v0.2.0`). Maintain `CHANGELOG.md` at the repo root.

---

## 10. Implementation plan (suggested order)

Build incrementally — get a single end-to-end "happy path" working before adding loops and validators.

**Milestone 0: Plugin skeleton.**
- Repo structure per section 2.4.
- `marketplace.json` and `plugin.json` manifests.
- A no-op `/start-run` that just creates a `runs/<run-id>/` directory and writes a stub `state.json`.
- Verify the plugin installs locally and the slash command works.

**Milestone 1: Linear planning phase.**
- BA, Architect, Tech Lead subagents (no validators yet, no user-review gates).
- Run end-to-end: input → req spec → tech spec → stories.

**Milestone 2: Validators.**
- Add BA Validator, Architect Validator, Tech Lead Validator.
- Add the loops (max 5 iterations, escalate after).

**Milestone 3: User-review gates and spec freeze.**
- `/advance-stage` pauses and prompts user.
- Spec freeze on Tech Lead approval.

**Milestone 4: One dev track end-to-end.**
- .NET Engineer + Reviewer loop only (no tests yet).
- Story dispatcher reads `stories.md` and loops over .NET stories.

**Milestone 5: Test loop for .NET.**
- .NET Test Engineer + Test Reviewer.
- Coverage check.
- Production-bug back-edge.

**Milestone 6: React track.**
- Mirror of .NET set.
- Parallel dispatch (orchestrator runs both tracks).

**Milestone 7: DevOps phase.**
- DevOps Engineer + Reviewer.
- Docker compose generation.
- Cross-track bug routing.

**Milestone 8: Polish & publish.**
- Error messages on freeze violation.
- Run archival.
- Better status reporting.
- Tag v0.1.0 and push to GitHub.

---

## 11. Open questions for the implementer

These are deliberate gaps left for Claude Code to either resolve during implementation or flag back:

1. **Subagent invocation pattern.** Does the orchestrator invoke subagents directly via the Task tool, or via a slash command that internally delegates? Pick the more idiomatic Claude Code pattern at implementation time.
2. **Concurrency.** When dispatching .NET and React tracks in parallel, can two subagents truly run concurrently in Claude Code, or is it interleaved? If interleaved, the spec still works but the parallelism is logical, not real.
3. **State file concurrency.** If two tracks update `state.json` concurrently, we need a lock or per-track state files. Pick the simpler option.
4. **Coverage threshold storage.** Per-story override is mentioned but not yet schema'd — add an optional `coverage_threshold` field to STORY if needed.
5. **Cancellation cleanup.** Does cancel-and-restart preserve previous artifacts as starting drafts (per the design discussion), or wipe clean? Default to wipe clean for v1; add resume-from-draft later.
6. **Plugin file paths.** Plugins are loaded from a cache directory, not in-place. If any agent or skill needs to reference files relative to the plugin's location, verify the path resolution against current Claude Code docs (see `https://code.claude.com/docs/en/plugin-marketplaces` "Plugin caching and file resolution").
7. **Slash command namespacing.** Verify whether commands need explicit `agentic-sdlc:` prefix or if Claude Code auto-resolves when there's no conflict. Check current docs.

---

## 12. Acceptance criteria for the system itself

The implementation is complete when:

1. The plugin installs cleanly from the git repo via `/plugin marketplace add` followed by `/plugin install agentic-sdlc@<marketplace-name>`.
2. A user can run `/agentic-sdlc:start-run`, paste a paragraph-long requirement, and end up with a runnable application produced by the agent pipeline.
3. Every agent specified in section 4 exists as a working subagent file inside the plugin.
4. Every skill specified in section 5 exists inside the plugin.
5. All loops have iteration caps and escalation paths.
6. Spec freeze is enforced — attempting to modify a frozen artifact produces a clear error.
7. The `/agentic-sdlc:show-run-status` command produces a human-readable summary at any point.
8. A test run with a deliberately incomplete requirement triggers the BA Validator loop and visibly iterates.
9. A test run with a production bug surfaced by the test loop demonstrates the back-edge routing to the correct Engineer.
