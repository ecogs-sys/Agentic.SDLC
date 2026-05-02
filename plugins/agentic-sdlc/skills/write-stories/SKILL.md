---
name: write-stories
description: Template and conventions for writing stories. Used by the Tech Lead agent.
---

# Writing Stories

## ID assignment rules
- IDs are STORY-001, STORY-002, ... in definition order.
- IDs are **write-once** — never renumber or reuse.
- When revising: only add new IDs at the end.

## Track assignment
- `dotnet` track: backend API endpoints, services, data models, DB migrations.
- `react` track: UI components, pages, state management, API calls from the frontend.
- One story belongs to exactly one track. If a feature needs both frontend and backend, create two stories (one per track) with the react story depending on the dotnet story.

## Traceability rules
- Every TECH-ID from the tech spec must be covered by at least one story.
- Each story's `Implements` field lists the TECH-IDs it delivers.

## Format

```markdown
# Stories
Run ID: <run-id>
Status: draft | approved
Version: <n>

## STORY-001: <short name (3–6 words)>
**Track:** dotnet | react
**Implements:** [TECH-001, TECH-002]
**Description:** <what to build — concrete, actionable, enough for an engineer to work without asking questions>
**Acceptance criteria:**
- <specific, testable criterion (e.g., "GET /api/todos returns 200 with JSON array")>
- <second criterion>
**Depends on:** []
**Estimated complexity:** S | M | L
**Coverage threshold:** {"lines": 80, "critical_paths": 90}

## STORY-002: ...
```

## Complexity guidelines
- **S (Small):** Single endpoint or component, no new data model, < 1 hour.
- **M (Medium):** 2–5 endpoints or a full CRUD flow, 1–3 hours.
- **L (Large):** New subsystem, complex state, cross-cutting concern, > 3 hours.

## Quality checklist (self-check before finishing)
- [ ] Every TECH-ID from tech-spec.md appears in at least one story's Implements list
- [ ] Each story belongs to exactly one track (dotnet or react)
- [ ] Acceptance criteria are specific enough to write a failing test for
- [ ] Dependencies are listed so parallel dispatch is possible
- [ ] Status is "draft"
