---
name: write-phase-plan
description: Template and conventions for splitting a large requirement into independently deliverable phases, driven by REQ-IDs from the program's master req-spec.md. Used by the Phase Planner agent.
---

# Writing a Phase Plan

A phase plan splits the program's master `req-spec.md` — already analyzed by
the program-level BA into REQ-IDs — into ordered, independently shippable
**phases**. Each phase later becomes its own full SDLC run (Architect → Tech
Lead → Development → DevOps; BA does not run per phase — it already ran once
at the program level) and ships its own PR.

Phases are cut along **REQ-ID** boundaries, not prose. The input is
`req-spec.md`, never `original-input.md` directly.

## Sizing — how many phases?

Default to the **fewest** phases that satisfy the rules below. Most programs
are **one phase** — only split when the REQ set is genuinely large.

Split into multiple phases when ANY of these hold:
- The REQ-IDs contain clearly separable feature areas that a user could
  benefit from independently (e.g. "core CRUD" REQs vs "reporting dashboard"
  REQs vs "admin tooling" REQs).
- A natural MVP subset of REQ-IDs exists that delivers value before later
  enrichments.
- The REQ set is large enough that implementing it as one run would produce an
  unreviewably large change set.

Keep it ONE phase when:
- The REQ-IDs are tightly interdependent and cannot ship separately.
- The whole set is small enough to deliver and review in one pass.

When in doubt, prefer fewer phases. A single-phase plan is a valid, common output.

## Phase rules (the validator enforces these)

- **Coverage:** every REQ-ID in `req-spec.md` is assigned to **exactly one**
  phase — no REQ-ID lost, none duplicated across phases.
- **Ordering:** phases are numbered so each phase depends only on earlier
  phases. Phase N may build on Phases 1..N-1 but never on Phase N+1.
- **Deliverability:** each phase is independently shippable — the REQ-IDs it
  bundles produce a coherent, usable increment on their own.
- **Archetype homogeneity:** every REQ-ID assigned to a phase must belong to
  the same `Stack` (see below). A phase never mixes archetypes.

## Stack (archetype per phase)

Most programs build a single archetype end to end — greenfield runs always do
(one archetype is chosen before the Phase Planner ever runs), and most
brownfield programs touch only one existing stack. In that normal case every
phase's `Stack` is simply the program's one archetype — set it and move on.

A brownfield program whose `codebase-context.md` lists **more than one**
`Detected stacks` entry (see write-codebase-context) is the exception: the
workspace genuinely contains more than one archetype (e.g. a web app plus a
separate firmware tree it talks to over a frozen wire protocol). When that's
the case:
- Read each REQ-ID's own wording against the detected stacks' descriptions
  (paths, frameworks, domain vocabulary) and decide which single archetype it
  belongs to — a REQ about an on-device timer/badge/sensor is `embedded`; a
  REQ about an API endpoint, page, or desktop-shell screen is `web` or
  `electron`.
- Group REQ-IDs into phases such that **no phase spans two archetypes** — this
  takes priority over the sizing rules above (favor more, smaller,
  single-archetype phases over fewer mixed ones). A "core CRUD" phase and a
  "device firmware" phase, for instance, are two phases even if they'd
  otherwise ship together.
- If a REQ genuinely cannot be satisfied without changes in two archetypes at
  once (rare — most cross-cutting behavior can be pushed to one side, as a
  server-side workaround or a device-side one), do not force it into a single
  phase: say so in that REQ's phase section under **Deferred to later
  phases**, and leave a `## Open questions` note flagging it for the user —
  this plan format does not support a mixed-archetype phase.

## ID assignment rules

- Phases are numbered Phase 1, Phase 2, … in delivery order.
- Folder names are zero-padded: `phase-01`, `phase-02`, …
- Numbering is **write-once** for already-shipped phases; a replan may only revise
  phases that have not yet started.
- REQ-IDs are never reassigned once a phase starts — see Plan-freeze guardrail.

## Format

The orchestrator parses the `## Phase index` table, so its columns are fixed
and in this exact order: `Phase | Title | REQ-IDs | Stack | Depends on |
Folder`. This is how `program.json`'s `phases[].req_ids` and `phases[].app_type`
get populated — never hand-typed into `program.json` directly.

````markdown
# Phase plan
Program ID: <program-id>
Status: draft | frozen
Version: <n>

## Overview
<one paragraph: the full req-spec in plain language, and whether it is being
delivered as a single phase or split into N phases — and why. If the program
spans more than one archetype (see write-codebase-context's `Detected
stacks`), say so here and name which phases carry which Stack.>

## Phase index
| Phase | Title | REQ-IDs | Stack | Depends on | Folder |
|-------|-------|---------|-------|-----------|--------|
| 1 | Core CRUD | REQ-001, REQ-002, REQ-005 | web | — | phase-01 |
| 2 | Reporting | REQ-003, REQ-004 | web | Phase 1 | phase-02 |

## Phases

### Phase 1: <short title (2–5 words)>
**Goal:** <one sentence — the user-facing value this phase delivers.>
**REQ-IDs:** REQ-001, REQ-002, REQ-005
**Stack:** web | electron | embedded
**Depends on:** none
**Independently shippable because:** <why this phase is usable on its own.>
**Deferred to later phases:** <which REQ-IDs are intentionally left out, and
which phase will pick them up.>

### Phase 2: <short title>
**Goal:** ...
**REQ-IDs:** REQ-003, REQ-004
**Stack:** web
**Depends on:** Phase 1
**Independently shippable because:** ...
**Deferred to later phases:** ...
````

Use `—` in the `Depends on` column for phases with no dependencies. The
`## Phase index` table's `REQ-IDs`/`Stack`/`Depends on` columns must match each
phase section's `**REQ-IDs:**`/`**Stack:**`/`**Depends on:**` fields exactly.

**`Stack` is always populated**, even for the ordinary single-archetype case —
every phase gets the program's one archetype. It only *varies* across phases
when `codebase-context.md` declared more than one `Detected stacks` entry (see
the Stack section above).

For the last (or only) phase, set **Deferred to later phases:** to "none".

## Quality checklist (self-check before finishing)
- [ ] Every REQ-ID in `req-spec.md` is assigned to exactly one phase
- [ ] No REQ-ID appears in two phases
- [ ] Phases are ordered so each depends only on earlier phases
- [ ] Each phase has a clear "independently shippable" justification
- [ ] A single-phase plan was used unless the sizing rules justify splitting
- [ ] The `## Phase index` table matches the `## Phases` sections exactly (REQ-IDs, Stack, Depends on)
- [ ] Every phase's `Stack` is one of `codebase-context.md`'s `Detected stacks`
      (brownfield) or the program's single chosen archetype (greenfield)
- [ ] No phase mixes REQ-IDs from more than one archetype
- [ ] Status is "draft"
