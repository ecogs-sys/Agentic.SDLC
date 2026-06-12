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
- CSS framework: set by Architect during codebase discovery (Tailwind CSS | Bootstrap | CSS Modules | detected from existing project)

## ID assignment rules
- IDs are TECH-001, TECH-002, ... in discovery order.
- IDs are **write-once** — never renumber or reuse.
- When revising: only add new IDs at the end.

## Traceability rules
- Every TECH must implement at least one REQ.
- Every REQ must be implemented by at least one TECH.

## Mandatory infrastructure components
Every tech spec MUST include these regardless of user requirements (the DevOps Reviewer's smoke tests depend on them):

- **TECH-HEALTH:** Backend `/health` endpoint returning HTTP 200 with a small JSON body (e.g. `{"status":"ok"}`). This is what `docker compose up`'s readiness check and the DevOps reviewer's smoke test hit. Mark it `Implements: [INFRA]` (no REQ traceback needed — it is infrastructure, not feature).

You may add other infrastructure TECHs (e.g. CORS configuration) as needed by the topology section.

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
- CSS framework: <Tailwind CSS | Bootstrap | CSS Modules | detected: X>

## Existing system *(brownfield only — omit entirely for greenfield)*
- Backend patterns: <service layer approach, middleware, auth, naming conventions>
- Frontend patterns: <component folder structure, state management>
- Database patterns: <table naming, migration approach, notable constraints>
- Decisions preserved: <list of existing patterns new TECHs must not break>
- Intentional deviations: <list of changes from existing patterns, each with justification>

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
- [ ] Every TECH has at least one REQ in its Implements list (or `[INFRA]` for infrastructure TECHs)
- [ ] **TECH-HEALTH (`/health` endpoint) is present**
- [ ] Deployment topology includes all ports (label them `BACKEND_PORT`, `FRONTEND_PORT`, `DB_PORT`) and all required env vars
- [ ] Stack section matches the fixed stack above
- [ ] Status is "draft"
- [ ] CSS framework is specified in the Stack section
- [ ] If brownfield: `## Existing system` section is present and all new TECHs align with it or document their deviation
