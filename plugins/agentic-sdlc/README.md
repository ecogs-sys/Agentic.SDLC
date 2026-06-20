# Agentic SDLC Plugin

A multi-agent SDLC pipeline for Claude Code. Takes a plain-language requirement and produces a runnable .NET + React application through a pipeline of specialized AI agents.

## What it does

Each stage of the SDLC is handled by a specialized AI agent with a paired validator that loops until the output is correct (up to 5 iterations) before any human review.

| Stage | Agent | Validator |
|---|---|---|
| Phase planning | Phase Planner | Phase Planner Validator |
| Requirements | Business Analyst | BA Validator |
| Architecture | Architect | Architect Validator |
| Story breakdown | Tech Lead | Tech Lead Validator |
| .NET backend | .NET Engineer + Reviewer | .NET Test Engineer + Reviewer |
| React frontend | React Engineer + Reviewer | React Test Engineer + Reviewer |
| Containerization | DevOps Engineer | DevOps Reviewer |

## Workflow diagram

```mermaid
flowchart TD
    Start(["🚀 /start-run — user provides requirement"])
    Start --> PP

    subgraph PHASE ["⓪ Phase Planning"]
        PP["🤖 Phase Planner<br/>writes phase-plan.md"] --> PPV["🔍 Phase Planner Validator"]
        PPV -- "fail / iter < 5<br/>re-run with report" --> PP
        PPV -- "fail / iter = 5" --> ESC0["⚠️ Escalate to User"]
        ESC0 -- "user guidance" --> PP
    end

    PPV -- pass --> RG0{{"👤 User Review Gate<br/>phase-plan.md"}}
    RG0 -- "request changes" --> PP
    RG0 -- "approve · freeze plan" --> BA

    subgraph REQ ["① Requirements"]
        BA["🤖 BA Agent<br/>writes req-spec.md"] --> BAV["🔍 BA Validator"]
        BAV -- "fail / iter < 5<br/>re-run with diff" --> BA
        BAV -- "fail / iter = 5" --> ESC1["⚠️ Escalate to User"]
        ESC1 -- "user guidance" --> BA
    end

    BAV -- pass --> RG1{{"👤 User Review Gate<br/>req-spec.md"}}
    RG1 -- "request changes" --> BA
    RG1 -- "approve" --> ADV1(["▶ /advance-stage"])

    ADV1 --> ARC

    subgraph ARCH ["② Architecture"]
        ARC["🤖 Architect<br/>writes tech-spec.md"] --> ARCV["🔍 Architect Validator"]
        ARCV -- "fail / iter < 5<br/>re-run with diff" --> ARC
        ARCV -- "fail / iter = 5" --> ESC2["⚠️ Escalate to User"]
        ESC2 -- "user guidance" --> ARC
    end

    ARCV -- pass --> RG2{{"👤 User Review Gate<br/>tech-spec.md"}}
    RG2 -- "request changes" --> ARC
    RG2 -- "approve" --> ADV2(["▶ /advance-stage"])

    ADV2 --> TL

    subgraph PLAN ["③ Story Breakdown"]
        TL["🤖 Tech Lead<br/>writes stories/ (index + per-story)"] --> TLV["🔍 Tech Lead Validator"]
        TLV -- "fail / iter < 5<br/>re-run with diff" --> TL
        TLV -- "fail / iter = 5" --> ESC3["⚠️ Escalate to User"]
        ESC3 -- "user guidance" --> TL
    end

    TLV -- pass --> RG3{{"👤 User Review Gate<br/>stories/index.md"}}
    RG3 -- "request changes" --> TL
    RG3 -- "approve · 🔒 SPEC FREEZE" --> ADV3(["▶ /advance-stage"])

    ADV3 --> NEXT

    subgraph DEV ["④ Development — stories processed wave-by-wave"]
        NEXT["📋 Next pending story"] --> TRACK{"Track?"}

        subgraph DOTNET [".NET Track"]
            DNE["🤖 .NET Engineer<br/>implements story"] --> DNR["🔍 .NET Reviewer"]
            DNR -- "FAIL / iter < 5<br/>revise" --> DNE
            DNR -- PASS --> DNTE["🤖 .NET Test Engineer<br/>writes tests"]
            DNTE --> DNTR["🔍 .NET Test Reviewer<br/>coverage check"]
            DNTR -- BACK_TO_TEST_ENGINEER --> DNTE
            DNTR -- BACK_TO_ENGINEER --> DNE
        end

        subgraph REACT ["React Track"]
            RE["🤖 React Engineer<br/>implements story"] --> RR["🔍 React Reviewer"]
            RR -- "FAIL / iter < 5<br/>revise" --> RE
            RR -- PASS --> RTE["🤖 React Test Engineer<br/>writes tests"]
            RTE --> RTR["🔍 React Test Reviewer<br/>coverage check"]
            RTR -- BACK_TO_TEST_ENGINEER --> RTE
            RTR -- BACK_TO_ENGINEER --> RE
        end

        TRACK -- ".NET" --> DNE
        TRACK -- "React" --> RE
        DNTR -- "DONE · git commit" --> ALLDONE{"All stories<br/>complete?"}
        RTR -- "DONE · git commit" --> ALLDONE
        ALLDONE -- No --> NEXT
    end

    ALLDONE -- Yes --> ADV4(["▶ /advance-stage"])

    ADV4 --> DVE

    subgraph DEVOPS ["⑤ DevOps"]
        DVE["🤖 DevOps Engineer<br/>Dockerfile · docker-compose.yml<br/>.env.example · nginx.conf"] --> DVR["🔍 DevOps Reviewer<br/>docker build & smoke tests"]
        DVR -- "BACK_TO_DEVOPS<br/>iter < 5" --> DVE
        DVR -- "BACK_TO_DOTNET_ENGINEER" --> DNEF["🤖 .NET Engineer (fix)"]
        DVR -- "BACK_TO_REACT_ENGINEER" --> REF["🤖 React Engineer (fix)"]
        DVR -- "HUMAN_REVIEW_REQUIRED" --> HU["👤 User Decision<br/>API contract ambiguity"]
        DNEF --> DVE
        REF --> DVE
        HU --> DVE
        DVR -- "iter = 5" --> ESC5["⚠️ Escalate to User"]
        ESC5 -- "user guidance" --> DVE
    end

    DVR -- DONE --> COMPLETE(["🎉 Run Complete!<br/>Open PR: agentic-sdlc/run-id → default branch"])

    COMPLETE -. "/next-phase (if more phases)" .-> PP
```

## Core principles

1. **Requirement spec is the source of truth.** Every artifact traces back to it.
2. **Creator + Validator pattern.** Every agent that produces an artifact has a paired validator.
3. **Spec freeze at story dispatch.** Once development begins, upstream specs are immutable.
4. **Single-language tracks.** .NET and React develop in parallel (logically).
5. **Runnable definition of done.** Complete only when `docker compose up` produces a working app.

## Install

```
/plugin marketplace add ecogs-sys/Agentic.SDLC
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

Repeat `/advance-stage` after each approval. You'll be asked to review and approve at four gates (phase plan, requirement spec, technical spec, stories).

## Pipeline order

```
/start-run          → Phase Planner → Validator (loop) → [user review phase plan]
                    → freeze plan → create Phase 1 run → detect src paths
                    → git branch agentic-sdlc/<program-id>/phase-01
                    → BA → BA Validator (loop) → [user review req spec]
/advance-stage      → Architect → Architect Validator (loop) → [user review tech spec]
/advance-stage      → Tech Lead → Tech Lead Validator (loop) → [user review stories]
                    ══ SPEC FREEZE ══
/advance-stage      → .NET stories (Engineer → Reviewer → Test Engineer → Test Reviewer → git commit)
                    → React stories (Engineer → Reviewer → Test Engineer → Test Reviewer → git commit)
/advance-stage      → DevOps Engineer → DevOps Reviewer → git commit → open PR
```

## Spec freeze rule

After you approve the stories, `req-spec.md`, `tech-spec.md`, and everything under `runs/<run-id>/stories/` are **frozen**. No agent can modify them. To make upstream changes: `/agentic-sdlc:cancel-run` and start a new run.

## Phases

A large requirement is split by the Phase Planner into ordered, independently
shippable phases. Each phase is its own run under `runs/<program-id>/phase-0N/`,
ships on its own branch `agentic-sdlc/<program-id>/phase-0N`, and opens its own PR.
Phases are strictly sequential: after a phase's PR is merged, run
`/agentic-sdlc:next-phase` to start the next one (which branches from the updated
default branch and builds on the shipped code). A small requirement yields a
single-phase plan and behaves like one ordinary run.

## Where artifacts live

Each run operates on its own git branch (`agentic-sdlc/<run-id>`). SDLC artifacts stay in `runs/`, generated code goes into your source tree.

```
<your-workspace>/                       ← workspace root (git repo)
├── runs/
│   └── program-YYYY-MM-DD-001/         ← one big requirement
│       ├── program.json                ← program state machine (phases, current_phase)
│       ├── original-input.md           ← full requirement, verbatim
│       ├── phase-plan.md               ← Phase Planner output (frozen)
│       └── phase-01/                   ← a full run, scoped to Phase 1
│           ├── state.json              ← per-phase state machine
│           ├── raw-input.md            ← this phase's scope
│           ├── req-spec.md             ← BA output
│           ├── tech-spec.md            ← Architect output
│           └── stories/                ← Tech Lead output (index.md + STORY-N.md)
│
├── src/backend/                        ← generated .NET source (default)
│   ├── AppName.sln
│   ├── AppName.Domain/
│   ├── AppName.Application/
│   ├── AppName.Infrastructure/
│   └── AppName.Api/
├── tests/backend/                      ← generated .NET tests (default — never under src/)
│   └── AppName.Tests/
├── src/frontend/                       ← generated React project (default)
│   └── src/                            ← React tests are co-located (*.test.tsx)
│
├── docker-compose.yml                  ← DevOps output (workspace root)
├── .env.example
└── README.md
```

Source paths are detected from your existing repo layout at `/start-run` time and stored in `state.json`. If you already have a `backend/` and `frontend/` at the root, or a different `src/` layout, the plugin uses those paths instead.

At the end of each phase, open a PR from `agentic-sdlc/<run-id>` → your default branch (the branch you started the run from, recorded as `parent_branch`) to ship the generated code through your normal review process.

## Other commands

| Command | Purpose |
|---|---|
| `/agentic-sdlc:show-run-status` | Show current stage and artifact status |
| `/agentic-sdlc:cancel-run` | Cancel and clean up the current run |
| `/agentic-sdlc:next-phase` | Start the next phase once the current one is merged |

## Troubleshooting

**Coverage threshold failures:** The test reviewer sends the test engineer back to add more tests. After 5 iterations, you're prompted for guidance.

**DevOps build failures:** The DevOps reviewer routes back to the correct agent. Docker config issues go to the DevOps Engineer; code bugs go to the relevant track's Engineer.

**Spec ambiguity:** If the DevOps reviewer finds an API contract mismatch, it escalates to you rather than auto-routing.
