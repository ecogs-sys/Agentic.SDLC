# Agentic SDLC Plugin

A multi-agent SDLC pipeline for Claude Code. Takes a plain-language requirement and produces a runnable .NET + React application through a pipeline of specialized AI agents.

## What it does

Each stage of the SDLC is handled by a specialized AI agent with a paired validator that loops until the output is correct (up to 5 iterations) before any human review.

| Stage | Agent | Validator |
|---|---|---|
| Requirements | Business Analyst | BA Validator |
| Architecture | Architect | Architect Validator |
| Story breakdown | Tech Lead | Tech Lead Validator |
| .NET backend | .NET Engineer + Reviewer | .NET Test Engineer + Reviewer |
| React frontend | React Engineer + Reviewer | React Test Engineer + Reviewer |
| Containerization | DevOps Engineer | DevOps Reviewer |

## Core principles

1. **Requirement spec is the source of truth.** Every artifact traces back to it.
2. **Creator + Validator pattern.** Every agent that produces an artifact has a paired validator.
3. **Spec freeze at story dispatch.** Once development begins, upstream specs are immutable.
4. **Single-language tracks.** .NET and React develop in parallel (logically).
5. **Runnable definition of done.** Complete only when `docker compose up` produces a working app.

## Install

```
/plugin marketplace add <github-org>/<repo-name>
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

## Quick start

```
/agentic-sdlc:start-run
```

Paste your requirement when prompted. Then:

```
/agentic-sdlc:advance-stage
```

Repeat `/advance-stage` after each approval. You'll be asked to review and approve at three gates (requirement spec, technical spec, stories).

## Pipeline order

```
/start-run          → BA → BA Validator (loop) → [user review req spec]
/advance-stage      → Architect → Architect Validator (loop) → [user review tech spec]
/advance-stage      → Tech Lead → Tech Lead Validator (loop) → [user review stories]
                    ══ SPEC FREEZE ══
/advance-stage      → .NET stories (Engineer → Reviewer → Test Engineer → Test Reviewer)
                    → React stories (Engineer → Reviewer → Test Engineer → Test Reviewer)
/advance-stage      → DevOps Engineer → DevOps Reviewer → done
```

## Spec freeze rule

After you approve the stories, `req-spec.md`, `tech-spec.md`, and `stories.md` are **frozen**. No agent can modify them. To make upstream changes: `/agentic-sdlc:cancel-run` and start a new run.

## Where artifacts live

```
<your-workspace>/
└── runs/
    └── run-YYYY-MM-DD-001/
        ├── state.json          ← run state machine
        ├── raw-input.md        ← your original requirement (verbatim)
        ├── req-spec.md         ← BA output
        ├── tech-spec.md        ← Architect output
        ├── stories.md          ← Tech Lead output
        ├── dotnet/             ← .NET project
        ├── react/              ← React project
        ├── docker-compose.yml
        └── .env.example
```

## Other commands

| Command | Purpose |
|---|---|
| `/agentic-sdlc:show-run-status` | Show current stage and artifact status |
| `/agentic-sdlc:cancel-run` | Cancel and clean up the current run |

## Troubleshooting

**Coverage threshold failures:** The test reviewer sends the test engineer back to add more tests. After 5 iterations, you're prompted for guidance.

**DevOps build failures:** The DevOps reviewer routes back to the correct agent. Docker config issues go to the DevOps Engineer; code bugs go to the relevant track's Engineer.

**Spec ambiguity:** If the DevOps reviewer finds an API contract mismatch, it escalates to you rather than auto-routing.
