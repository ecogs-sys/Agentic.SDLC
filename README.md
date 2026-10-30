# Agentic SDLC Marketplace

A Claude Code plugin marketplace containing the **agentic-sdlc** plugin — a multi-agent SDLC pipeline that takes a plain-language requirement and produces a runnable application. Three application archetypes are supported: **web** (.NET 8 + React 18 + PostgreSQL), **electron** (TypeScript Electron desktop app), and **embedded** (C/C++ ESP-IDF firmware for ESP32). The pipeline supports both **greenfield** builds (from scratch, driven by a multi-phase program plan) and **brownfield changes** (bug fixes, small changes, and new features on an existing codebase, auto-detected at `/start-run`).

## Workflow big picture

The repository workflow is the source of truth for these diagrams. The original sketch informed only the visual style: circular loops, agent icons, human icons and curved arrows. Workflow files were read, not modified.

### Diagrams

| View | SVG | PNG |
| --- | --- | --- |
| Complete program lifecycle | [Program workflow](docs/big-picture/workflow.svg) | [Preview](docs/big-picture/workflow.png) |
| Existing-system entry routes | [Brownfield workflow](docs/big-picture/brownfield-workflow.svg) | [Preview](docs/big-picture/brownfield-workflow.png) |

[Open both pages in draw.io](docs/big-picture/workflow.drawio). [Mermaid logical model](docs/big-picture/workflow.mmd) includes the branches and feedback routes. [Source mapping and corrections](docs/big-picture/interpretation.md) records the evidence and ambiguities.

![Program workflow](docs/big-picture/workflow.svg)

![Existing-system routes](docs/big-picture/brownfield-workflow.svg)

### Read the main diagram

1. Capture the request and detect whether application code already exists. Existing systems first go through survey and human triage; use the companion view to choose the route.
2. For programs, the Business Analyst and Phase Planner run once, each with an AI validator and human approval. Every phase begins with Architect, then Technical Lead, with validation and approval of their artifacts.
3. Generate the eval manifest from approved story criteria. Human eval approval freezes the specification. This is a human gate, not an Evaluation-agent loop.
4. Follow continuation **A**: process one story at a time through Engineer → Code Reviewer → Test Engineer → Test Reviewer → automated criterion coverage check. Review failures return to the responsible agent. Complete all stories, then promote and replay the permanent eval corpus.
5. Follow continuation **B**: web uses DevOps; Electron and embedded use Packaging. For existing systems, this stage runs only if infrastructure or packaging changes are required.
6. A completed run produces a reviewable branch. The human opens/reviews/merges its PR. The next program phase starts only after merge confirmation, with optional replanning of remaining phases. There is no automatic next phase or production deployment.

Solid arrows show progress. Circular arrows show creator/reviewer revision. Orange dashed arrows show requested changes. Numbered stages and A/B continuation markers connect sections without long crossing lines. The companion diagram abbreviates some repeated validation/approval loops with explicit labels.

### Scope and fidelity

The views cover program setup, planning, eval approval, development, final verification, PR handoff, phase continuation, and all three brownfield tiers. Optional brainstorming and operational commands are documented in the source notes. Internal state writes, commit commands, prompts and retry-counter bookkeeping remain in the workflow definitions.

The current eval helper checks test-tag completeness and corpus link retention. It does not execute tests itself, and it does not execute `assert` probes or `judge` rubrics. Test execution is owned by test reviewers and final verification reviewers. See the source notes for discrepancies between the workflow prose and helper implementation.

### Editing and regeneration

Use **SVG for sharing** and the **two-page draw.io file for visual layout edits**. Draw.io text is editable; each icon and curved arrow is a movable/scalable vector image. Editing the internal artwork or curvature requires the Python source or a vector editor. Mermaid is a logical companion rather than a copy of the infographic layout.

The generator uses only the Python standard library:

```powershell
python docs/big-picture/generate_diagram.py
```

[generate_diagram.py](docs/big-picture/generate_diagram.py) provides drawing primitives and [diagram_layout.py](docs/big-picture/diagram_layout.py) defines the layouts. Regeneration overwrites both SVGs and `workflow.drawio`; it does not overwrite PNG previews. Use [render-previews.ps1](docs/big-picture/render-previews.ps1) to refresh those using installed Chrome or Edge. Manual draw.io edits should instead be exported from draw.io.

[workflow-source-hashes.json](docs/big-picture/workflow-source-hashes.json) records the plugin file hashes captured during this review, so the diagram can be checked against the source snapshot. Review date: **25 September 2026**.

## Pipeline overview

![Agentic SDLC pipeline with phase planning, an accumulating eval layer, and DevOps phase](docs/agentic-sdlc-pipeline.svg)

## The eval layer — where evals come from and who uses them

An **eval** is a machine-checkable link between one acceptance criterion and the test
that proves it. The pipeline builds evals as it works and keeps them **forever**, so
the suite of guarantees grows with every feature and catches regressions on every
later run. If you read one picture, read this one:

![How evals are generated, reviewed and consumed: authored after the stories are approved, reviewed and approved by you at a human spec-freeze gate, tests tagged by criterion, gated per story, promoted into a permanent corpus, and replayed as a regression gate](docs/evals-lifecycle.svg)

- **Generated** (green) at two points: after the stories are approved, one eval is
  authored per acceptance criterion and **you review them at a human gate** (the
  spec-freeze point — approve, reclassify how a criterion is checked, or route a
  change back upstream); then each passing story is **promoted** into a permanent
  `evals/` corpus (`EVAL-0001`, `EVAL-0002`, …).
- **Consumed** (blue) by two gates: the per-story **eval gate** blocks a story until
  every criterion has a passing tagged test, and **every later run** replays the
  whole corpus so a previously shipped criterion that lost its test fails the run.
- **Zero duplication:** evals don't re-implement tests — the **Test Engineer** tags
  each test with its criterion id (xUnit `[Trait]` / Vitest title token) and the
  corpus is *derived* from those tags. See the `write-evals` skill for details.

## Install

```
/plugin marketplace add ecogs-sys/Agentic.SDLC
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

See [`plugins/agentic-sdlc/README.md`](plugins/agentic-sdlc/README.md) for usage.

## Repository structure

```
.claude-plugin/
  marketplace.json           ← marketplace manifest
plugins/
  agentic-sdlc/
    .claude-plugin/
      plugin.json            ← plugin manifest (name, version)
    agents/                  ← 37 subagent definitions
    skills/                  ← 33 reusable skill files
    commands/                ← 6 slash commands
    README.md                ← plugin user documentation
CHANGELOG.md
LICENSE
```

## Local development (testing without publishing)

```
/plugin marketplace add .
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

After making changes:
```
/plugin uninstall agentic-sdlc@agentic-sdlc-marketplace
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

## Contributing

1. Edit files in `plugins/agentic-sdlc/`.
2. Bump `version` in `plugins/agentic-sdlc/.claude-plugin/plugin.json`.
3. Add an entry to `CHANGELOG.md`.
4. Commit and tag the release (`v0.x.0`).
5. Push to GitHub.
