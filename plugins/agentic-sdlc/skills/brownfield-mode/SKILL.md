---
name: brownfield-mode
description: Shared rules for working against an existing codebase (brownfield change runs). Followed by every creator and reviewer agent when mode = brownfield.
---

# Brownfield Mode

You are modifying an **existing** system, not building from scratch. These rules
apply whenever your context says `mode = brownfield` — a `change-*` run **or** a
brownfield program phase (`<program-id>/phase-0N`). They are additive to your normal
process.

## Always start from the survey
1. Read `runs/<run-id>/codebase-context.md` fully before anything else. It is the
   shared source of truth for the existing system: stack, conventions, architecture
   map, the impact map (files/areas this change touches), the test baseline, and the
   proposed tier.
2. Reuse the conventions it documents — DI pattern, layering, naming, folder
   structure, styling, and test framework. Match the surrounding code; do not
   introduce a new style.

## Work the delta, not the whole system
- Describe and implement only what **changes** relative to the existing system.
- Never re-scaffold, re-specify, or re-document code that already exists. If a
  layer/solution/project is already present, build inside it.
- When you must deviate from an existing pattern, say so explicitly and explain why
  (one sentence) in the artifact you produce.

## Traceability is scoped to the change
- Trace your work to the change request and the impacted code identified in the
  impact map — not to whole-system coverage.
- Validators in brownfield compare: request → fix-plan/tech-spec/stories →
  (existing + new code). Untouched existing behavior is out of scope for
  traceability.

## Do not break existing behavior
- The done-gate requires the repo's **full existing test suite** to stay green:
  no *new* failures versus the baseline in `codebase-context.md`. Pre-existing
  failures are surfaced to the user, never hidden or "fixed" opportunistically.
- Add tests that cover the change itself.
