# Clean Architecture across the Agentic SDLC pipeline

Date: 2026-06-13
Status: approved (pending spec review)

## Goal

Make **Clean Architecture** the mandated structure for code the pipeline produces, on
**both** the .NET backend track and the React frontend track. The architect designs to it,
the engineers build to it, and the reviewers enforce it.

This is a documentation/prompt change to the `agentic-sdlc` plugin's agents and skills. No
runtime/orchestration code changes.

## Core invariant (both tracks)

**The dependency rule: source-code dependencies point only inward.** Inner layers know
nothing about outer layers. The domain layer depends on nothing.

## Backend (.NET) — full 4-project Clean Architecture

Greenfield scaffold (per run), under `src/backend` (or configured `backend_src`):

```
src/backend/
  AppName.Domain/          # entities, value objects, domain enums/exceptions — ZERO project refs
  AppName.Application/      # use-case services, DTOs, repository & gateway INTERFACES → refs Domain
  AppName.Infrastructure/   # EF Core DbContext, repository impls, external gateways → refs Application
  AppName.Api/             # controllers, Program.cs DI composition root, /health → refs Application + Infrastructure
  AppName.Tests/           # → refs the project(s) under test
  AppName.sln
```

Layer rules:
- **Domain** references nothing. Pure C# — no EF Core, no ASP.NET, no framework types.
- **Application** references **only** Domain. Defines interfaces (`IFooRepository`,
  `IFooService`) and DTOs; contains use-case/service logic. No EF Core.
- **Infrastructure** references Application (and transitively Domain). Implements the
  Application interfaces. **EF Core / `DbContext` / migrations live here and only here.**
- **Api** is the composition root: references Application + Infrastructure, wires DI in
  `Program.cs`, hosts controllers and the `/health` endpoint. Controllers depend on
  Application interfaces — never on `DbContext` or Infrastructure types directly.

Violations (e.g. `DbContext` in Api, Domain referencing Application, controller using a
concrete repository) are **CRITICAL** review failures.

### Files changed (backend)

1. **`skills/write-tech-spec/SKILL.md`** — add a "Backend architecture: Clean Architecture"
   section defining the 4 layers + dependency rule. Require each backend TECH to declare a
   `**Layer:**` field (Domain | Application | Infrastructure | Api). Add a checklist item.
   Note TECH-HEALTH is an Api-layer component.
2. **`agents/architect.md`** — codebase discovery records the existing layer layout
   (brownfield). Design TECHs to the 4-layer split and dependency rule; assign every backend
   TECH a layer. Add to Definition of Done.
3. **`agents/architect-validator.md`** — add a check that every backend TECH declares a valid
   `Layer`, and that no TECH's `Depends on` crosses a layer boundary outward (Domain must not
   depend on Application/Infrastructure/Api, Application not on Infrastructure/Api,
   Infrastructure not on Api). Report violations under `altered` and set status accordingly.
4. **`skills/dotnet-conventions/SKILL.md`** — replace the single-project structure with the
   4-project structure; document the dependency rule, the `dotnet add reference` wiring, and
   where each concern lives (`/health` + DI in Api, `DbContext` + repos in Infrastructure,
   interfaces + services + DTOs in Application, entities in Domain).
5. **`agents/dotnet-engineer.md`** — replace scaffolding commands with the 4-project
   `dotnet new` + reference wiring. Instruct placing each story's code in the correct layer.
6. **`agents/dotnet-reviewer.md`** — add a **CRITICAL** "Clean Architecture compliance" check:
   correct layer placement and no dependency-rule violations.

## Frontend (React) — 4 folder layers

The React track already separates `api/`, `hooks/`, `types/`, `components/`. This formalizes
that as Clean Architecture and states the dependency rule explicitly.

```
src/frontend/src/
  domain/      # types, models, pure logic — no React, no fetch (formalizes today's types/)
  api/         # API clients, fetch wrappers, mappers → may use domain
  hooks/       # use-cases / orchestration (useCreateTodo) → uses api + domain
  components/   # presentation — consume hooks, render. NO direct fetch/axios.
  pages/       # route-level composition of components + hooks
```

Dependency rule: `components`/`pages` → `hooks` → `api` → `domain`; `domain` depends on
nothing. `types/` is accepted as the domain layer in brownfield projects.

The hard, enforceable invariant: **no `fetch`/`axios`/HTTP calls inside components or pages** —
they go through `hooks` which call `api`. This is already partly enforced; we elevate it to an
explicit CRITICAL rule.

### Files changed (frontend)

7. **`skills/react-conventions/SKILL.md`** — relabel the project structure as Clean
   Architecture layers; add a `domain/` layer (formalizing `types/`); state the inward
   dependency rule; reinforce "fetch only in `api/`, orchestration in `hooks/`, no fetch in
   components".
8. **`agents/react-engineer.md`** — note the layered structure in the conventions step and
   place each story's code in the correct layer (types→domain, fetch→api, orchestration→hooks,
   render→components/pages).
9. **`agents/react-reviewer.md`** — add an explicit **CRITICAL** check: any `fetch(`/`axios`/
   `XMLHttpRequest` call inside a component or page file (i.e. outside `src/api/`) is a
   dependency-rule violation. (Complements the existing component-decomposition checks.)

## Out of scope

- React track architecture remains folder-based (no separate build projects) — matches
  frontend norms.
- No changes to the BA, Tech Lead, DevOps, or test-engineer/test-reviewer agent files. The
  test agents inherit the new structure automatically because they follow the conventions
  skills (test project references the layers under test).
- No orchestration/state-machine changes.

## Testing / verification

This change is prompt/instruction content. Verification = review the edited agent and skill
files for internal consistency and that the dependency rule is stated consistently across
architect → engineer → reviewer for each track. No automated test suite covers agent prose.
```
