---
name: write-tech-spec
description: Template and conventions for writing technical specs. Used by the Architect agent.
---

# Writing a Technical Spec

## Stack (depends on app_type)

Read `app_type` from state.json. It selects one of two fixed stacks:

**`app_type = web` (default):**
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose
- CSS framework: set by Architect during codebase discovery (Tailwind CSS | Bootstrap | CSS Modules | detected from existing project)

**`app_type = electron`:**
- Shell: Electron + TypeScript, pnpm workspaces monorepo (`apps/desktop`, `packages/*`), ESM throughout
- Build: electron-vite (main/preload/renderer targets)
- Packaging: electron-builder (win/mac/linux) + electron-updater
- Tests: Vitest + @vitest/coverage-v8, jsdom for renderer
- Security: contextIsolation + sandbox on, nodeIntegration off, zod-validated IPC (see the `agentic-sdlc:electron-conventions` skill)
- There is **no** .NET backend, database, or docker-compose for electron runs. The `Backend architecture` and `Mandatory infrastructure components` sections below apply to `web` runs only.

## Backend architecture: Clean Architecture (mandatory)

The .NET backend MUST follow Clean Architecture with four projects. **Source-code
dependencies point only inward** — the domain layer depends on nothing.

| Layer | Project | Contains | May reference |
|---|---|---|---|
| **Domain** | `AppName.Domain` | Entities, value objects, domain enums/exceptions. Pure C# — no EF Core, no ASP.NET. | nothing |
| **Application** | `AppName.Application` | Use-case/service logic, DTOs, repository & gateway **interfaces**. No EF Core. | Domain |
| **Infrastructure** | `AppName.Infrastructure` | EF Core `DbContext`, migrations, repository implementations, external gateways. | Application (+ Domain) |
| **Api** | `AppName.Api` | Controllers, `Program.cs` DI composition root, `/health`. Controllers depend on Application interfaces, never on `DbContext`. | Application + Infrastructure |

Every backend TECH MUST declare which layer it belongs to via a `**Layer:**` field. A TECH's
`Depends on` must never cross a layer boundary outward (Domain must not depend on
Application/Infrastructure/Api; Application not on Infrastructure/Api; Infrastructure not on
Api). `TECH-HEALTH` is an **Api**-layer component.

Frontend components are not assigned a backend layer — omit `Layer` for UI-component TECHs (or
mark them `Layer: Frontend`).

## ID assignment rules
- IDs are TECH-001, TECH-002, ... in discovery order.
- IDs are **write-once** — never renumber or reuse.
- When revising: only add new IDs at the end.

## Traceability rules
- Every TECH must implement at least one REQ.
- Every REQ must be implemented by at least one TECH.

## Mandatory infrastructure components *(web runs only — skip for `app_type = electron`)*
Every **web** tech spec MUST include these regardless of user requirements (the DevOps Reviewer's smoke tests depend on them):

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
**Layer:** Domain | Application | Infrastructure | Api  *(backend TECHs only; omit or use `Frontend` for UI components)*
**Description:** <technical detail, including method signatures, data shapes, or behavior>
**Implements:** [REQ-001, REQ-003]
**Depends on:** [TECH-005]

### TECH-002: ...

## Deployment topology
<Concrete ports, environment variables, network names, service dependencies>
<Example: Backend on port 5000, Frontend on port 3000, PostgreSQL on port 5432>
<All environment variables required: DATABASE_URL, CORS_ORIGIN, etc.>

**Infra change:** none | required — <what changes: new service / port / env var / dependency>
<web brownfield: whether docker-compose.yml, .env.example, Dockerfile(s), or nginx.conf must change vs the existing setup. web greenfield: always `required` (the whole stack is new). For `app_type = electron`, this line describes packaging changes instead — new OS target, updater feed, or native dependency; greenfield electron is always `required` (packaging is new).>
```

## Quality checklist (self-check before finishing)
- [ ] Every REQ-ID from req-spec.md appears in at least one TECH's Implements list
- [ ] Every TECH has at least one REQ in its Implements list (or `[INFRA]` for infrastructure TECHs)
- [ ] Every backend TECH declares a valid `Layer` (Domain | Application | Infrastructure | Api) and no `Depends on` crosses a layer boundary outward
- [ ] **(web runs only) TECH-HEALTH (`/health` endpoint) is present** (Layer: Api). Electron runs omit it.
- [ ] Deployment topology includes all ports (label them `BACKEND_PORT`, `FRONTEND_PORT`, `DB_PORT`) and all required env vars
- [ ] Deployment topology includes the `**Infra change:**` line (`none`, or `required — <what>`)
- [ ] Stack section matches the fixed stack above
- [ ] Status is "draft"
- [ ] CSS framework is specified in the Stack section
- [ ] If brownfield: `## Existing system` section is present and all new TECHs align with it or document their deviation
