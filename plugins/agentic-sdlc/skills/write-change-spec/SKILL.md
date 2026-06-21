---
name: write-change-spec
description: BA-lite template for a brownfield change spec (the delta against the existing system). Used by the BA agent in the small-change tier.
---

# Writing a Change Spec

A change spec is a lightweight requirement spec for a brownfield **small change**.
It captures the delta only — current vs desired behavior — and points at the
impacted code from `codebase-context.md`. It is NOT a from-scratch req-spec.

## ID assignment rules
- IDs are CHG-001, CHG-002, ... in discovery order. Write-once; never renumber.
- When revising, add new IDs at the end; never change existing IDs.

## What belongs
- Plain-language description of what should change and the observable result.
- Current behavior (so reviewers/testers know the baseline) and desired behavior.
- The existing files/areas the change touches (from the impact map).

## What does NOT belong
- Re-specification of existing, unchanged behavior.
- Technology choices or implementation steps (those live in the existing code +
  the stories the Tech Lead writes next).

## Format

```markdown
# Change Spec
Run ID: <run-id>
Status: draft | approved
Version: <n>

## Change summary
<one paragraph: what changes and why, plain language>

## Changes
### CHG-001: <short name (3–6 words)>
**Current behavior:** <how it works today, or "n/a — new behavior">
**Desired behavior:** <how it should work after the change>
**Acceptance criteria:**
- <observable outcome proving it is done>
- <second criterion>
**Touches:** <files/areas from codebase-context.md impact map>

### CHG-002: ...

## Out of scope
<existing behavior that must stay unchanged>
```

## Quality checklist (self-check before finishing)
- [ ] Every CHG has both Current and Desired behavior
- [ ] Every CHG has ≥2 acceptance criteria
- [ ] Every CHG cites at least one path/area from the impact map
- [ ] Out of scope names the behavior that must NOT regress
- [ ] Status is "draft"
