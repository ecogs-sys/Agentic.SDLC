---
name: write-req-spec
description: Template and conventions for writing requirement specs. Used by the BA agent.
---

# Writing a Requirement Spec

## ID assignment rules
- IDs are REQ-001, REQ-002, ... in the order requirements are discovered.
- IDs are **write-once** — once assigned, never renumber or reuse.
- When revising: only add new IDs at the end; never change existing IDs.

## What belongs in a requirement spec
- Plain-language descriptions of what the user wants
- Observable behavior and acceptance criteria
- Constraints the user stated (performance, accessibility, legal, etc.)

## What does NOT belong
- Technology choices (no "use React", "use .NET", "PostgreSQL", etc.)
- Implementation approaches (no "via REST API", "using a database", etc.)
- Non-functional requirements the user did not state

## Format

```markdown
# Requirement spec
Run ID: <run-id>
Status: draft | approved
Version: <n>

## Overview
<one-paragraph summary of the full requirement in plain language>

## Requirements
### REQ-001: <short name (3–6 words)>
**Description:** <1–3 sentences, plain language, no technical terms>
**Acceptance criteria:**
- <observable outcome that proves this is done, written as "user can..." or "system does...">
- <second criterion>
**Source:** raw-input.md, paragraph <n>

### REQ-002: ...
```

## Quality checklist (self-check before finishing)
- [ ] Every paragraph of raw-input.md is covered
- [ ] Every REQ has ≥2 acceptance criteria
- [ ] No technology or framework names appear anywhere
- [ ] No REQ is a duplicate of another
- [ ] Status is "draft"
