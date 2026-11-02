# Agentic SDLC Marketplace

A Claude Code plugin marketplace containing the **agentic-sdlc** plugin — a multi-agent SDLC pipeline that takes a plain-language requirement and produces a runnable application. Three application archetypes are supported: **web** (.NET 8 + React 18 + PostgreSQL), **electron** (TypeScript Electron desktop app), and **embedded** (C/C++ ESP-IDF firmware for ESP32). The pipeline supports both **greenfield** builds (from scratch, driven by a multi-phase program plan) and **brownfield changes** (bug fixes, small changes, and new features on an existing codebase, auto-detected at `/start-run`).

It can also work **backwards from existing code** — surveying legacy repositories in any language or era and recovering what they do for the business, so a rebuild starts from a specification nobody had to hand-write. See [Modernizing a legacy system](#modernizing-a-legacy-system) below.

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

## Modernizing a legacy system

Everything above starts from a requirement **you write**. These three commands start
from **code you already have** — a monolith in production for fifteen years, its
background services, its database scripts. Any language or era: COBOL, VB6, Delphi,
Java EE, PHP, Perl, .NET Framework.

They run independently of the pipeline's state machine — no branch, no automatic
commit — and write to `reverse-spec/<rev-id>/`.

```mermaid
flowchart LR
  CODE["Legacy repos<br/>(read-only)"] --> RS["/reverse-spec<br/>what it does"]
  RS --> GA["/gap-analysis<br/>what's missing"]
  RS --> RD["/redesign<br/>what should change"]
  GA --> RD
  RD --> SR["/start-run<br/>rebuild"]
  GA --> SR
  RS --> SR
```

| Command | Question it answers | Output |
|---|---|---|
| `/agentic-sdlc:reverse-spec` | What does this system **do**? | Non-technical, diagram-bearing `req-spec.md` per module, plus cited evidence |
| `/agentic-sdlc:gap-analysis` | What did we **miss**, what's **absent**, what **changes** at cutover? | Coverage audit, `GAP-NNN` candidates, cutover delta |
| `/agentic-sdlc:redesign` | How should this work **differently**? | `DEC-NNN` decisions, amended specs, impact reports |

### How it fits together

1. **Survey.** `/reverse-spec` takes a census (detecting stacks by marker file across
   ~13 ecosystems, not just the three modern ones), maps external integrations across
   repos, then proposes a **module decomposition for you to confirm or redraw**. Module
   size decides how much code one specification pass can actually read, so that gate is
   both the correctness check and the cost control. Each module then gets a
   rule-complete requirement spec plus an `evidence.md` of `file:line` citations,
   confidence levels, and open questions.

2. **Check for holes.** `/gap-analysis` audits what the survey failed to specify —
   "we never specified that part" is how a rebuild silently drops behavior — and
   separately hunts capabilities the system *lacks*, which every other agent is blind
   to because they all reason about what is present.

3. **Decide what to improve.** `/redesign` answers questions about the legacy system
   from its real code, then maps the full blast radius of a proposed change: which
   requirements, modules, background jobs and partner feeds it would touch. That blast
   radius is usually the reason nobody ever fixed the thing.

4. **Rebuild.** The specs seed a program and the normal pipeline takes over. The
   Business Analyst is skipped — the output is already in requirement-spec format, so
   re-deriving it would renumber every ID and sever the links back to the legacy code.

### Three rules that make the output trustworthy

- **Never invent a rule.** Everything recovered is cited, with a confidence level. A
  fabricated business rule is worse than an admitted gap, because the pipeline will
  faithfully build it. Low-confidence rules are surfaced for you to confirm.
- **Never invent a gap.** Every missing capability must cite a signal from *this*
  system — a hard rejection with no path through, a visible manual workaround, an
  asymmetry, half-built code, or something you told it. "Systems like this usually have
  X" is rejected outright.
- **Divergence is always attributed.** When you choose to change behavior, the
  requirement is marked with its decision id and the legacy citation is *demoted* to a
  superseded baseline rather than deleted — so nobody later confuses "this is what the
  old system did" with "this is what we decided instead", and cutover can explain the
  difference.

In all three, agents answer, analyse and execute; **the human decides**. A decision
with no owner is not a decision.

### Built for a team

One person surveys, a colleague revises a module, an architect reads the evidence
months later — and nobody has the legacy code at the same path. So no artifact
hardcodes a location: each repo gets a symbolic root recorded once with its
fingerprint, branch, HEAD and clean/dirty state, and citations read
`SRC1:Billing/Calc.vb:412`. Opening someone else's run resolves those roots against
your machine, checks you are on the same revision (narrowed to the files the run
actually cites), and **asks you to confirm a location when a path or branch is
missing**. It never switches branches or pulls for you.

```
reverse-spec/rev-2026-11-01-001/
  system-inventory.md     module-map.md         ← survey + your confirmed decomposition
  modules/MOD-01-*/       req-spec.md  evidence.md
  coverage-audit.md       capability-gaps.md    ← gap analysis
  decisions.md            impact-DEC-001.md     ← redesign
  cutover-delta.md                              ← for support, ops and partners
  summary.md
```

Per-command detail, agent roster and model choices are in the
[plugin README](plugins/agentic-sdlc/README.md#reverse-engineering-specs-from-legacy-code-independent-of-runs).

## Install

```
/plugin marketplace add ecogs-sys/Agentic.SDLC
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

See [`plugins/agentic-sdlc/README.md`](plugins/agentic-sdlc/README.md) for usage.

**Upgrading.** Commands, agents and skills are resolved from the *installed* copy, so a
session started before an upgrade still sees the old roster — a new command will not
appear and a new agent cannot be invoked. After pulling a new version, re-run
`/plugin install agentic-sdlc@agentic-sdlc-marketplace` and start a fresh session
before testing. Worth checking first if a command you expect is missing.

## Repository structure

```
.claude-plugin/
  marketplace.json           ← marketplace manifest
plugins/
  agentic-sdlc/
    .claude-plugin/
      plugin.json            ← plugin manifest (name, version)
    agents/                  ← 52 subagent definitions
    skills/                  ← 38 reusable skill files
    commands/                ← 9 slash commands
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
