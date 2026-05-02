---
name: write-tech-spec
description: Template and conventions for writing technical specs. Used by the Architect agent.
---

# Writing a Technical Spec

## Stack (fixed for all runs)
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose

## ID assignment rules
- IDs are TECH-001, TECH-002, ... in discovery order.
- IDs are **write-once** — never renumber or reuse.
- When revising: only add new IDs at the end.

## Traceability rules
- Every TECH must implement at least one REQ.
- Every REQ must be implemented by at least one TECH.

## Format

```markdown
# Technical spec
Run ID: <run-id>
Status: draft | approved
Version: <n>

## Architecture overview
<2–4 sentences: how backend, frontend, and database are connected>

## Stack
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose

## Components
### TECH-001: <component name>
**Type:** API endpoint | UI component | service | data model | database table | ...
**Description:** <technical detail, including method signatures, data shapes, or behavior>
**Implements:** [REQ-001, REQ-003]
**Depends on:** [TECH-005]

### TECH-002: ...

## Deployment topology
<Concrete ports, environment variables, network names, service dependencies>
<Example: Backend on port 5000, Frontend on port 3000, PostgreSQL on port 5432>
<All environment variables required: DATABASE_URL, CORS_ORIGIN, etc.>
```

## Quality checklist (self-check before finishing)
- [ ] Every REQ-ID from req-spec.md appears in at least one TECH's Implements list
- [ ] Every TECH has at least one REQ in its Implements list
- [ ] Deployment topology includes all ports and all required env vars
- [ ] Stack section matches the fixed stack above exactly
- [ ] Status is "draft"
