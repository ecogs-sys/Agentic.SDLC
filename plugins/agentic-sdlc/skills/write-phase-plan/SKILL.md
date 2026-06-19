---
name: write-phase-plan
description: Template and conventions for splitting a large requirement into independently deliverable phases. Used by the Phase Planner agent.
---

# Writing a Phase Plan

A phase plan splits one large requirement into ordered, independently shippable
**phases**. Each phase later becomes its own full SDLC run (BA → Architect →
Tech Lead → Development → DevOps) and ships its own PR.

## Sizing — how many phases?

Default to the **fewest** phases that satisfy the rules below. Most requirements
are **one phase** — only split when the requirement is genuinely large.

Split into multiple phases when ANY of these hold:
- The requirement contains clearly separable feature areas that a user could
  benefit from independently (e.g. "core CRUD" vs "reporting dashboard" vs
  "admin tooling").
- A natural MVP exists that delivers value before later enrichments.
- The requirement is large enough that one run would produce an unreviewably
  large change set.

Keep it ONE phase when:
- The features are tightly interdependent and cannot ship separately.
- The whole thing is small enough to deliver and review in one pass.

When in doubt, prefer fewer phases. A single-phase plan is a valid, common output.

## Phase rules (the validator enforces these)

- **Coverage:** every requirement/feature/constraint in `original-input.md` is
  assigned to **exactly one** phase — no requirement lost, none duplicated across
  phases.
- **Ordering:** phases are numbered so each phase depends only on earlier phases.
  Phase N may build on Phases 1..N-1 but never on Phase N+1.
- **Deliverability:** each phase is independently shippable — it produces a
  coherent, usable increment on its own.

## ID assignment rules

- Phases are numbered Phase 1, Phase 2, … in delivery order.
- Folder names are zero-padded: `phase-01`, `phase-02`, …
- Numbering is **write-once** for already-shipped phases; a replan may only revise
  phases that have not yet started.

## Format

```markdown
# Phase plan
Program ID: <program-id>
Status: draft | frozen
Version: <n>

## Overview
<one paragraph: the full requirement in plain language, and whether it is being
delivered as a single phase or split into N phases — and why.>

## Phases

### Phase 1: <short title (2–5 words)>
**Goal:** <one sentence — the user-facing value this phase delivers.>
**Scope — requirements covered:** <list the features/requirements from
original-input.md this phase includes. Reference them by paragraph or feature
name so coverage is checkable.>
**Depends on:** none
**Independently shippable because:** <why this phase is usable on its own.>
**Deferred to later phases:** <what is intentionally left out, and which phase
will pick it up.>

### Phase 2: <short title>
**Goal:** ...
**Scope — requirements covered:** ...
**Depends on:** Phase 1
**Independently shippable because:** ...
**Deferred to later phases:** ...
```

## Quality checklist (self-check before finishing)
- [ ] Every requirement in `original-input.md` is assigned to exactly one phase.
- [ ] No requirement appears in two phases.
- [ ] Phases are ordered so each depends only on earlier phases.
- [ ] Each phase has a clear "independently shippable" justification.
- [ ] A single-phase plan was used unless the sizing rules justify splitting.
- [ ] Status is "draft".
