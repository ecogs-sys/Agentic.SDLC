# Agentic SDLC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that implements a multi-agent SDLC pipeline, taking a user requirement through BA → Architect → Tech Lead → Engineers → Testers → DevOps to produce a runnable .NET + React application.

**Architecture:** Orchestration via slash commands + JSON state file; each SDLC role is a Claude Code subagent; skills encode reusable workflows. No external runtime required — pure markdown + JSON files in a git marketplace plugin.

**Tech Stack:** Claude Code plugin system (agents, skills, commands), JSON state machine, .NET 8 + ASP.NET Core (generated output), React 18 + Vite + TypeScript (generated output), PostgreSQL + Docker Compose (generated output).

**Open question resolutions (from spec §11):**
- Subagent invocation: slash commands invoke agents via the Task tool
- Concurrency: sequential for v1 (logical parallelism only)
- State file: single state.json, no locking needed (sequential execution)
- Coverage threshold: optional `coverage_threshold: {"lines": 80, "critical_paths": 90}` in stories
- Cancellation: wipe clean (delete run dir) for v1
- Slash command prefix: explicit `agentic-sdlc:` prefix

---

## File Map

**34 files to create:**

### Repo root
- Create: `.claude-plugin/marketplace.json`
- Create: `README.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`
- Create: `.gitignore`

### Plugin manifests
- Create: `plugins/agentic-sdlc/.claude-plugin/plugin.json`
- Create: `plugins/agentic-sdlc/README.md`

### Skills (8 files)
- Create: `plugins/agentic-sdlc/skills/validate-traceability/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/write-req-spec/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/write-stories/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/react-conventions/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/coverage-report/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/docker-compose-setup/SKILL.md`

### Agents (16 files)
- Create: `plugins/agentic-sdlc/agents/ba.md`
- Create: `plugins/agentic-sdlc/agents/ba-validator.md`
- Create: `plugins/agentic-sdlc/agents/architect.md`
- Create: `plugins/agentic-sdlc/agents/architect-validator.md`
- Create: `plugins/agentic-sdlc/agents/tech-lead.md`
- Create: `plugins/agentic-sdlc/agents/tech-lead-validator.md`
- Create: `plugins/agentic-sdlc/agents/dotnet-engineer.md`
- Create: `plugins/agentic-sdlc/agents/dotnet-reviewer.md`
- Create: `plugins/agentic-sdlc/agents/dotnet-test-engineer.md`
- Create: `plugins/agentic-sdlc/agents/dotnet-test-reviewer.md`
- Create: `plugins/agentic-sdlc/agents/react-engineer.md`
- Create: `plugins/agentic-sdlc/agents/react-reviewer.md`
- Create: `plugins/agentic-sdlc/agents/react-test-engineer.md`
- Create: `plugins/agentic-sdlc/agents/react-test-reviewer.md`
- Create: `plugins/agentic-sdlc/agents/devops-engineer.md`
- Create: `plugins/agentic-sdlc/agents/devops-reviewer.md`

### Commands (4 files)
- Create: `plugins/agentic-sdlc/commands/start-run.md`
- Create: `plugins/agentic-sdlc/commands/advance-stage.md`
- Create: `plugins/agentic-sdlc/commands/cancel-run.md`
- Create: `plugins/agentic-sdlc/commands/show-run-status.md`

---

## Task 1: Initialize Git Repo and Directory Structure

**Files:**
- Create: `.gitignore`
- All plugin directories

- [ ] **Step 1: Initialize git repository**

Run: `git init`
Expected: "Initialized empty Git repository in C:/Work/ecogs/projects/Agentic.SDLC/.git/"

- [ ] **Step 2: Create all directories**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path `
  ".claude-plugin", `
  "plugins/agentic-sdlc/.claude-plugin", `
  "plugins/agentic-sdlc/agents", `
  "plugins/agentic-sdlc/skills/validate-traceability", `
  "plugins/agentic-sdlc/skills/write-req-spec", `
  "plugins/agentic-sdlc/skills/write-tech-spec", `
  "plugins/agentic-sdlc/skills/write-stories", `
  "plugins/agentic-sdlc/skills/dotnet-conventions", `
  "plugins/agentic-sdlc/skills/react-conventions", `
  "plugins/agentic-sdlc/skills/coverage-report", `
  "plugins/agentic-sdlc/skills/docker-compose-setup", `
  "plugins/agentic-sdlc/commands"
```

- [ ] **Step 3: Create .gitignore**

Create `.gitignore`:
```
.DS_Store
Thumbs.db
.vscode/
.idea/
node_modules/
runs/
```

- [ ] **Step 4: Commit skeleton**

```bash
git add .gitignore
git commit -m "chore: initialize repo with .gitignore"
```

---

## Task 2: Marketplace and Plugin Manifests

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/agentic-sdlc/.claude-plugin/plugin.json`

- [ ] **Step 1: Write marketplace.json**

Create `.claude-plugin/marketplace.json`:
```json
{
  "name": "agentic-sdlc-marketplace",
  "owner": {
    "name": "Dinesh NS",
    "email": "dineshns@gmail.com"
  },
  "plugins": [
    {
      "name": "agentic-sdlc",
      "source": "./plugins/agentic-sdlc",
      "description": "Multi-agent SDLC pipeline: requirement → spec → stories → code → tests → runnable app."
    }
  ]
}
```

- [ ] **Step 2: Write plugin.json**

Create `plugins/agentic-sdlc/.claude-plugin/plugin.json`:
```json
{
  "name": "agentic-sdlc",
  "version": "0.1.0",
  "description": "Agentic SDLC for .NET + React applications.",
  "author": {
    "name": "Dinesh NS"
  }
}
```

- [ ] **Step 3: Commit manifests**

```bash
git add .claude-plugin/marketplace.json plugins/agentic-sdlc/.claude-plugin/plugin.json
git commit -m "feat: add marketplace and plugin manifests"
```

---

## Task 3: Skills — Traceability and Artifact Writing

**Files:**
- Create: `plugins/agentic-sdlc/skills/validate-traceability/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/write-req-spec/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/write-stories/SKILL.md`

- [ ] **Step 1: Write validate-traceability skill**

Create `plugins/agentic-sdlc/skills/validate-traceability/SKILL.md`:
````markdown
---
name: validate-traceability
description: How to compare two artifacts and produce a structured diff report. Used by all Validator agents (BA Validator, Architect Validator, Tech Lead Validator).
---

# Validate Traceability

You produce a **structured diff report** comparing a source artifact to a derived artifact.

## Diff schema

```json
{
  "status": "pass | fail",
  "missing": [
    {
      "id": "REQ-001",
      "source_location": "raw-input.md, paragraph 2",
      "description": "Requirement about X was not captured in req-spec.md"
    }
  ],
  "added_without_source": [
    {
      "id": "REQ-005",
      "description": "This requirement has no traceable source in raw-input.md"
    }
  ],
  "altered": [
    {
      "id": "REQ-002",
      "original": "User wants Y",
      "derived": "Spec says Z",
      "concern": "Meaning changed"
    }
  ],
  "notes": "Optional overall observations"
}
```

## Instructions

1. Read both artifacts fully before writing anything.
2. For each item in the **source** artifact: confirm it appears in the derived artifact. If not → `missing`.
3. For each item in the **derived** artifact: confirm it has a traceable source. If not → `added_without_source`.
4. For each matched pair: check that meaning is preserved. Paraphrasing is fine; scope change is not → `altered`.
5. `status` is `"pass"` only if all three arrays are empty.
6. Always cite line numbers or section names when available.
7. Be exhaustive — a single missed item is a failed validation.

## Example (BA validation)

Source: `raw-input.md` → Derived: `req-spec.md`

- "The app should let users log in with email and password" (paragraph 1)
- If req-spec has no login requirement → `missing: [{id: "REQ-?", source_location: "raw-input.md, paragraph 1", description: "Login requirement not captured"}]`
- If req-spec adds "user must log in with OAuth" not mentioned in raw-input → `added_without_source`
- If raw-input says "send welcome email" but spec says "send onboarding sequence" → `altered`
````

- [ ] **Step 2: Write write-req-spec skill**

Create `plugins/agentic-sdlc/skills/write-req-spec/SKILL.md`:
````markdown
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
````

- [ ] **Step 3: Write write-tech-spec skill**

Create `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md`:
````markdown
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
````

- [ ] **Step 4: Write write-stories skill**

Create `plugins/agentic-sdlc/skills/write-stories/SKILL.md`:
````markdown
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
````

- [ ] **Step 5: Commit traceability and writing skills**

```bash
git add plugins/agentic-sdlc/skills/
git commit -m "feat: add validate-traceability and artifact-writing skills"
```

---

## Task 4: Skills — Tech Conventions

**Files:**
- Create: `plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/react-conventions/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/coverage-report/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/docker-compose-setup/SKILL.md`

- [ ] **Step 1: Write dotnet-conventions skill**

Create `plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md`:
````markdown
---
name: dotnet-conventions
description: Project-specific .NET coding conventions. Used by .NET Engineer, Reviewer, Test Engineer, and Test Reviewer.
---

# .NET Conventions

## Project structure
```
dotnet/
├── <AppName>.Api/
│   ├── Controllers/      # One controller per resource
│   ├── Services/         # IFooService.cs + FooService.cs
│   ├── Models/           # FooRequest.cs, FooResponse.cs
│   ├── Data/             # EF Core DbContext + migrations
│   ├── Program.cs        # Entry point + DI registration
│   └── appsettings.json
└── <AppName>.Tests/
    ├── Controllers/      # Controller unit tests
    ├── Services/         # Service unit tests
    └── Integration/      # WebApplicationFactory tests
```

## Naming conventions
- Controllers: `<Resource>Controller.cs`
- Services: `I<Name>Service.cs` (interface) + `<Name>Service.cs` (impl)
- DTOs: `<Name>Request.cs`, `<Name>Response.cs`
- Test methods: `<MethodUnderTest>_<Scenario>_<ExpectedBehavior>`

## Async patterns
- All controller actions and service methods touching I/O are `async Task<T>`.
- Never use `.Result` or `.Wait()` — always `await`.
- Return `IActionResult` or `ActionResult<T>` from controllers.

## Dependency injection
- Register services in `Program.cs`: `builder.Services.AddScoped<IFooService, FooService>()`.
- Inject via constructor; never use service locator pattern.

## EF Core
- Code-first migrations: `dotnet ef migrations add <Name>`.
- `DbContext` registered as scoped.
- Always use async EF methods: `ToListAsync()`, `FirstOrDefaultAsync()`, `SaveChangesAsync()`.

## xUnit test structure
```csharp
public class FooServiceTests
{
    private readonly Mock<IRepository> _mockRepo;
    private readonly FooService _sut;

    public FooServiceTests()
    {
        _mockRepo = new Mock<IRepository>();
        _sut = new FooService(_mockRepo.Object);
    }

    [Fact]
    public async Task GetById_WithValidId_ReturnsEntity()
    {
        // Arrange
        _mockRepo.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(new Entity { Id = 1 });
        // Act
        var result = await _sut.GetByIdAsync(1);
        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.Id);
    }
}
```

## Mocking
- Use **Moq** for all mocking.
- Mock only at service boundaries; test real logic.
- For repository tests: use SQLite in-memory database instead of mocking EF Core.

## Error handling
- Use `ProblemDetails` for API error responses (ASP.NET Core default).
- `404 NotFound()` for missing resources, `400 BadRequest()` for validation, `500` for unhandled.

## Commands
```bash
dotnet build          # Expected: Build succeeded.
dotnet test           # Expected: All tests pass.
```
````

- [ ] **Step 2: Write react-conventions skill**

Create `plugins/agentic-sdlc/skills/react-conventions/SKILL.md`:
````markdown
---
name: react-conventions
description: Project-specific React coding conventions. Used by React Engineer, Reviewer, Test Engineer, and Test Reviewer.
---

# React Conventions

## Project structure
```
react/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── <Name>/
│   │       ├── <Name>.tsx
│   │       └── <Name>.test.tsx
│   ├── pages/            # Route-level page components
│   │   └── <Name>Page/
│   │       ├── <Name>Page.tsx
│   │       └── <Name>Page.test.tsx
│   ├── hooks/            # Custom React hooks
│   ├── api/              # fetch wrappers (one file per resource)
│   ├── types/            # TypeScript type definitions
│   └── App.tsx
├── index.html
├── vite.config.ts
└── package.json
```

## Component conventions
- Functional components only — no class components.
- One component per file; filename matches component name.
- Props typed with TypeScript interface: `interface FooProps { ... }`
- Named exports: `export function Foo({ prop }: FooProps) { ... }`

## State management
- `useState` for local component state.
- `useContext` + `useReducer` for shared state.
- Custom hooks for data-fetching: `useFoo()` → `{ data, isLoading, error }`.

## TypeScript style
- Strict mode enabled (`"strict": true` in tsconfig).
- No `any` types — use `unknown` and narrow, or define proper types.
- API response types defined in `src/types/`.

## API calls
```typescript
// src/api/todos.ts
export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/todos`);
  if (!res.ok) throw new Error(`Failed to fetch todos: ${res.status}`);
  return res.json();
}
```
- All fetch calls in `src/api/<resource>.ts` only.
- Base URL from `import.meta.env.VITE_API_URL`.

## Vitest + React Testing Library patterns
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import * as todosApi from '../../api/todos';
import { TodoList } from './TodoList';

vi.mock('../../api/todos');

describe('TodoList', () => {
  it('renders todo items when loaded', async () => {
    (todosApi.fetchTodos as Mock).mockResolvedValue([{ id: 1, title: 'Test todo' }]);
    render(<TodoList />);
    await waitFor(() => {
      expect(screen.getByText('Test todo')).toBeInTheDocument();
    });
  });
});
```

## Commands
```bash
npm run build         # Expected: vite build succeeds, no TypeScript errors
npm test -- --run     # Expected: all tests pass
```
````

- [ ] **Step 3: Write coverage-report skill**

Create `plugins/agentic-sdlc/skills/coverage-report/SKILL.md`:
````markdown
---
name: coverage-report
description: How to run coverage tooling per language and interpret results against thresholds. Used by .NET Test Reviewer and React Test Reviewer.
---

# Coverage Report

## .NET coverage

### Run
```bash
dotnet test --collect:"XPlat Code Coverage" --results-directory coverage/
```

### Generate readable summary
```bash
dotnet tool install -g dotnet-reportgenerator-globaltool 2>/dev/null || true
reportgenerator \
  -reports:"coverage/**/coverage.cobertura.xml" \
  -targetdir:"coverage/report" \
  -reporttypes:"TextSummary"
cat coverage/report/Summary.txt
```

### Reading the output
```
Line coverage: 85.3% (227 of 266)
Branch coverage: 72.1%
```

### Thresholds
Default: **80% line coverage**, **90% on critical paths**.
Per-story override: check story's `coverage_threshold` field.

## React coverage

### Run
```bash
npm test -- --run --coverage
```

### Output (Vitest + v8)
```
----------|---------|----------|---------|---------|
File      | % Stmts | % Branch | % Funcs | % Lines |
----------|---------|----------|---------|---------|
All files |   85.00 |    72.00 |   88.00 |   85.00 |
```

### Thresholds
Default: **80% statement coverage**, **90% on critical paths**.

## Decision tree

```
All tests pass?
  No  → Are tests correct?
        Yes → BACK_TO_ENGINEER (production bug)
        No  → BACK_TO_TEST_ENGINEER (test bug)
  Yes → Coverage ≥ threshold?
        Yes → DONE
        No  → BACK_TO_TEST_ENGINEER (add tests for uncovered paths)
```
````

- [ ] **Step 4: Write docker-compose-setup skill**

Create `plugins/agentic-sdlc/skills/docker-compose-setup/SKILL.md`:
````markdown
---
name: docker-compose-setup
description: Standard pattern for docker-compose configuration. Used by DevOps Engineer.
---

# Docker Compose Setup

## docker-compose.yml
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
      POSTGRES_USER: ${POSTGRES_USER:-appuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-apppassword}
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-appuser}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./dotnet
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - ConnectionStrings__Default=Host=db;Database=${POSTGRES_DB:-appdb};Username=${POSTGRES_USER:-appuser};Password=${POSTGRES_PASSWORD:-apppassword}
      - ASPNETCORE_URLS=http://+:5000
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./react
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  db_data:
```

## .NET Dockerfile
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY *.sln .
COPY <AppName>.Api/*.csproj ./<AppName>.Api/
COPY <AppName>.Tests/*.csproj ./<AppName>.Tests/
RUN dotnet restore
COPY . .
RUN dotnet publish <AppName>.Api -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
ENTRYPOINT ["dotnet", "<AppName>.Api.dll"]
```

## React Dockerfile
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## nginx.conf (SPA + API proxy)
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## .env.example
```
POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=changeme_in_production
```

## Verification steps
1. `docker compose build` — all images build
2. `docker compose up -d && sleep 10`
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health` → 200
4. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → 200
5. `docker compose down`
````

- [ ] **Step 5: Commit tech convention skills**

```bash
git add plugins/agentic-sdlc/skills/dotnet-conventions/ plugins/agentic-sdlc/skills/react-conventions/ plugins/agentic-sdlc/skills/coverage-report/ plugins/agentic-sdlc/skills/docker-compose-setup/
git commit -m "feat: add .NET, React, coverage, and docker-compose skills"
```

---

## Task 5: Planning Phase Agents — BA, Architect, Tech Lead

**Files:**
- Create: `plugins/agentic-sdlc/agents/ba.md`
- Create: `plugins/agentic-sdlc/agents/architect.md`
- Create: `plugins/agentic-sdlc/agents/tech-lead.md`

- [ ] **Step 1: Write BA agent**

Create `plugins/agentic-sdlc/agents/ba.md`:
```markdown
---
name: ba
description: Business Analyst. Converts raw user requirements into a structured requirement spec (req-spec.md). Invoke when current_stage is "ba" or "ba_revision".
tools: Read, Write, Edit
model: claude-sonnet-4-6
---

You are a Business Analyst specializing in software requirements.

## Your job
Convert the raw user input in `raw-input.md` into a structured requirement spec saved to `req-spec.md`, using the write-req-spec skill.

## Inputs (passed as context)
- Run ID
- `runs/<run-id>/raw-input.md` — the user's original requirement
- Optional: revision notes from BA Validator or user feedback

## Outputs
- `runs/<run-id>/req-spec.md`

## Process
1. Read `runs/<run-id>/raw-input.md` fully.
2. If revision notes exist in your context, read them to understand what to change.
3. Follow the write-req-spec skill format.
4. Write to `runs/<run-id>/req-spec.md`.
5. Self-check: re-read raw-input.md paragraph by paragraph. Confirm each paragraph maps to ≥1 REQ.
6. If revising: increment the Version number; do not change existing REQ IDs.

## Definition of done
- Every paragraph of `raw-input.md` is covered by at least one REQ.
- Every REQ has ≥2 acceptance criteria.
- No technical implementation details (no framework names, no database, no API references).
- `req-spec.md` saved with Status: draft.

## Failure modes
- If raw input is too vague: write one REQ capturing the vague intent, note "input is ambiguous — acceptance criteria may need refinement". Complete the spec; do not halt.
- If conflicting requirements appear: note both sides in the REQ description; do not choose sides.
```

- [ ] **Step 2: Write Architect agent**

Create `plugins/agentic-sdlc/agents/architect.md`:
```markdown
---
name: architect
description: Software Architect. Converts the approved requirement spec into a technical spec (tech-spec.md). Invoke when current_stage is "architect" or "architect_revision".
tools: Read, Write, Edit
model: claude-opus-4-7
---

You are a Software Architect designing .NET + React systems.

## Your job
Convert `req-spec.md` into a concrete `tech-spec.md`, following the write-tech-spec skill.

## Inputs (passed as context)
- Run ID
- `runs/<run-id>/req-spec.md` — the approved requirement spec
- Optional: revision notes from Architect Validator or user feedback

## Outputs
- `runs/<run-id>/tech-spec.md`

## Process
1. Read `runs/<run-id>/req-spec.md` fully.
2. List all REQ-IDs you must implement.
3. Design components: decide backend (dotnet) vs frontend (react) split for each REQ.
4. Follow the write-tech-spec skill format.
5. Write the deployment topology section with concrete ports, env vars, service names.
6. Write to `runs/<run-id>/tech-spec.md`.
7. Self-check: confirm every REQ-ID appears in at least one TECH's Implements list.
8. If revising: increment Version; do not change existing TECH IDs.

## Definition of done
- Every REQ-ID from req-spec.md is implemented by at least one TECH-ID.
- Every TECH-ID has at least one REQ in its Implements list.
- Deployment topology names all ports and all required environment variables.
- Stack is exactly: .NET 8 Web API, React 18 + Vite + TypeScript, PostgreSQL, docker-compose.
- `tech-spec.md` saved with Status: draft.

## Failure modes
- If a REQ is underspecified: make a reasonable assumption and note it in the TECH description.
- If two REQs conflict technically: implement both defensively and flag the conflict in a TECH note.
- Never halt — always produce a complete tech-spec.md.
```

- [ ] **Step 3: Write Tech Lead agent**

Create `plugins/agentic-sdlc/agents/tech-lead.md`:
```markdown
---
name: tech-lead
description: Tech Lead. Converts the approved technical spec into implementation stories (stories.md). Invoke when current_stage is "tech_lead" or "tech_lead_revision".
tools: Read, Write, Edit
model: claude-opus-4-7
---

You are a Tech Lead breaking technical specs into actionable development stories.

## Your job
Convert `tech-spec.md` into `stories.md` — independently deliverable stories per track, following the write-stories skill.

## Inputs (passed as context)
- Run ID
- `runs/<run-id>/tech-spec.md` — the approved technical spec
- Optional: revision notes from Tech Lead Validator or user feedback

## Outputs
- `runs/<run-id>/stories.md`

## Process
1. Read `runs/<run-id>/tech-spec.md` fully.
2. List all TECH-IDs and identify their track (dotnet or react).
3. Group related TECH-IDs into cohesive, independently deliverable stories.
4. For each story: assign track, list TECH-IDs, write clear testable acceptance criteria.
5. Set dependencies: if a react story uses a dotnet API, add the dotnet story to `Depends on`.
6. Estimate complexity per the write-stories skill guidelines.
7. Write to `runs/<run-id>/stories.md`.
8. Self-check: every TECH-ID appears in at least one story's Implements list.
9. If revising: increment Version; do not change existing STORY IDs.

## Definition of done
- Every TECH-ID from tech-spec.md is covered by at least one story.
- Each story belongs to exactly one track.
- Acceptance criteria are testable — specific enough to write a failing test.
- Dependencies correctly listed for parallel dispatch.
- `stories.md` saved with Status: draft.

## Failure modes
- If a TECH is too vague to story-ize: create a story, note "needs clarification". Never halt.
```

- [ ] **Step 4: Commit planning agents**

```bash
git add plugins/agentic-sdlc/agents/ba.md plugins/agentic-sdlc/agents/architect.md plugins/agentic-sdlc/agents/tech-lead.md
git commit -m "feat: add BA, Architect, and Tech Lead agents"
```

---

## Task 6: Validator Agents

**Files:**
- Create: `plugins/agentic-sdlc/agents/ba-validator.md`
- Create: `plugins/agentic-sdlc/agents/architect-validator.md`
- Create: `plugins/agentic-sdlc/agents/tech-lead-validator.md`

- [ ] **Step 1: Write BA Validator agent**

Create `plugins/agentic-sdlc/agents/ba-validator.md`:
```markdown
---
name: ba-validator
description: BA Validator. Validates req-spec.md against raw-input.md for completeness and accuracy. Invoke after the BA agent produces req-spec.md.
tools: Read
model: claude-sonnet-4-6
---

You are a Quality Analyst validating requirement specifications.

## Your job
Compare `raw-input.md` (source) with `req-spec.md` (derived) using the validate-traceability skill and produce a structured diff report.

## Inputs (passed as context)
- Run ID
- `runs/<run-id>/raw-input.md`
- `runs/<run-id>/req-spec.md`

## Outputs
A JSON validation report printed to your response (not written to a file — the orchestrator reads your response).

## Process
1. Read both files fully.
2. Note every distinct requirement, feature, or constraint in raw-input.md.
3. Apply the validate-traceability skill:
   - Missing: paragraphs/sentences in raw-input not covered by any REQ.
   - Added without source: REQs with no traceable origin in raw-input.
   - Altered: REQs where meaning changed (not just paraphrase, actual scope change).
4. Also fail if any REQ contains technical implementation details (framework names, database, API terminology).
5. Set status: "pass" only if all arrays empty AND no technical details.

## Output format
Wrap your report in a code block:
```json
{
  "status": "pass",
  "missing": [],
  "added_without_source": [],
  "altered": [],
  "notes": ""
}
```
```

- [ ] **Step 2: Write Architect Validator agent**

Create `plugins/agentic-sdlc/agents/architect-validator.md`:
```markdown
---
name: architect-validator
description: Architect Validator. Validates tech-spec.md against req-spec.md for bidirectional traceability. Invoke after the Architect produces tech-spec.md.
tools: Read
model: claude-sonnet-4-6
---

You are a Quality Analyst validating technical specifications.

## Your job
Verify bidirectional traceability between `req-spec.md` and `tech-spec.md` using the validate-traceability skill.

## Inputs (passed as context)
- Run ID
- `runs/<run-id>/req-spec.md`
- `runs/<run-id>/tech-spec.md`

## Outputs
A JSON validation report printed to your response.

## Process
1. Read both files fully.
2. Extract all REQ-IDs from req-spec.md.
3. Extract all TECH-IDs and their Implements lists from tech-spec.md.
4. Forward traceability: every REQ-ID must appear in at least one TECH's Implements list. Missing → `missing`.
5. Backward traceability: every TECH's Implements list must contain valid REQ-IDs. Invalid → `added_without_source`.
6. Check stack: must be .NET 8, React 18, PostgreSQL, docker-compose. Deviation → `altered`.
7. Check deployment topology: ports and env vars must be concrete (not "TBD"). If TBD → `notes`.
8. Status: "pass" if missing and added_without_source are empty.

## Output format
```json
{
  "status": "pass",
  "missing": [{"id": "REQ-001", "description": "Not implemented by any TECH"}],
  "added_without_source": [{"id": "TECH-005", "description": "No REQ in Implements list"}],
  "altered": [],
  "notes": ""
}
```
```

- [ ] **Step 3: Write Tech Lead Validator agent**

Create `plugins/agentic-sdlc/agents/tech-lead-validator.md`:
```markdown
---
name: tech-lead-validator
description: Tech Lead Validator. Validates stories.md against tech-spec.md for coverage and correctness. Invoke after the Tech Lead produces stories.md.
tools: Read
model: claude-sonnet-4-6
---

You are a Quality Analyst validating story decomposition.

## Your job
Verify that `stories.md` correctly implements all of `tech-spec.md` using the validate-traceability skill.

## Inputs (passed as context)
- Run ID
- `runs/<run-id>/tech-spec.md`
- `runs/<run-id>/stories.md`

## Outputs
A JSON validation report printed to your response.

## Process
1. Read both files fully.
2. Extract all TECH-IDs from tech-spec.md.
3. Extract all stories and their Implements lists.
4. Coverage: every TECH-ID must appear in at least one story's Implements list. Uncovered → `missing`.
5. Valid references: every Implements entry must be a valid TECH-ID from tech-spec. Invalid → `added_without_source`.
6. Track check: each story must have exactly one track (dotnet or react). Missing track → `notes`.
7. Acceptance criteria check: each story must have ≥1 acceptance criterion. If not → `altered` with note.
8. Dependency check: if a react story's TECH depends on a dotnet TECH, flag suspected missing `Depends on` entries in `notes`.
9. Status: "pass" if missing and added_without_source are empty.

## Output format
```json
{
  "status": "pass",
  "missing": [],
  "added_without_source": [],
  "altered": [],
  "notes": ""
}
```
```

- [ ] **Step 4: Commit validator agents**

```bash
git add plugins/agentic-sdlc/agents/ba-validator.md plugins/agentic-sdlc/agents/architect-validator.md plugins/agentic-sdlc/agents/tech-lead-validator.md
git commit -m "feat: add BA, Architect, and Tech Lead validator agents"
```

---

## Task 7: Slash Commands

**Files:**
- Create: `plugins/agentic-sdlc/commands/start-run.md`
- Create: `plugins/agentic-sdlc/commands/advance-stage.md`
- Create: `plugins/agentic-sdlc/commands/cancel-run.md`
- Create: `plugins/agentic-sdlc/commands/show-run-status.md`

- [ ] **Step 1: Write start-run command**

Create `plugins/agentic-sdlc/commands/start-run.md`:
```markdown
---
description: Start a new Agentic SDLC run. Collects the user's requirement, creates the run directory and state.json, writes raw-input.md, then drives the BA → BA Validator loop and first user review gate.
---

# /agentic-sdlc:start-run

You are the Agentic SDLC orchestrator.

## Your job
Start a new run: collect the requirement, initialize state, run the BA + validation loop, and present the requirement spec for user review.

## Process

### Step 1 — Generate a run ID
Format: `run-YYYY-MM-DD-NNN` (today's date, zero-padded sequence).
Check `runs/` for existing runs to determine the next sequence number. If none, use `001`.

### Step 2 — Collect the requirement
If the user didn't provide their requirement with the command, ask:
> "Please describe what you want to build. Be as detailed as you like."

Wait for their response.

### Step 3 — Create run directory and write raw-input.md
Create `runs/<run-id>/` directory.

Write `runs/<run-id>/raw-input.md`:
```markdown
# Raw Input
Run ID: <run-id>
Captured: <YYYY-MM-DD HH:MM>

<user's requirement verbatim — do not paraphrase or edit>
```

### Step 4 — Write initial state.json
Write `runs/<run-id>/state.json`:
```json
{
  "run_id": "<run-id>",
  "current_stage": "ba",
  "spec_frozen": false,
  "stages": {
    "ba": { "status": "in_progress", "iterations": 0 },
    "ba_validation": { "status": "pending", "iterations": 0 },
    "user_review_req": { "status": "pending" },
    "architect": { "status": "pending", "iterations": 0 },
    "architect_validation": { "status": "pending", "iterations": 0 },
    "user_review_tech": { "status": "pending" },
    "tech_lead": { "status": "pending", "iterations": 0 },
    "tech_lead_validation": { "status": "pending", "iterations": 0 },
    "user_review_stories": { "status": "pending" },
    "development": { "status": "pending" },
    "devops": { "status": "pending" }
  },
  "stories": {}
}
```

### Step 5 — BA loop (max 5 iterations)

**Iteration loop:**

a. Invoke the `ba` agent via the Task tool. Pass: run-id, path to raw-input.md, and any revision notes (empty on first iteration).

b. After BA completes, invoke `ba-validator` via Task tool. Pass: run-id, paths to raw-input.md and req-spec.md.

c. Read the validator's JSON response.

d. If `"status": "fail"`:
   - Increment `stages.ba.iterations` in state.json.
   - If iterations < 5: re-invoke `ba` agent with the validator's diff report as revision notes. Repeat from (b).
   - If iterations = 5: update `stages.ba.status = "escalated"` in state.json. Say to user:
     > "The BA agent failed validation 5 times. Here is the current diff report. You can provide guidance and I will try again, or use /agentic-sdlc:cancel-run to cancel."
     Display the diff. Wait for user guidance. If guidance provided, re-invoke BA. If user says cancel, stop.

e. If `"status": "pass"`:
   - Update state.json: `stages.ba.status = "complete"`, `stages.ba_validation.status = "complete"`.

### Step 6 — User review gate
Read and display `runs/<run-id>/req-spec.md` in full.

Say:
> "The Business Analyst has produced the following requirement spec (Version <n>). Please review it and reply **'approve'** to continue, or describe what needs to change."

Wait for response:
- **"approve"** (case-insensitive): update state.json `stages.user_review_req.status = "complete"`, `current_stage = "architect"`. Say: "Requirement spec approved. Run `/agentic-sdlc:advance-stage` to continue to the Architect stage."
- **Any other response**: treat as revision notes. Re-invoke `ba` agent with those notes. Repeat BA loop from Step 5. (User revision counts toward the 5-iteration limit.)

## Spec freeze
Do not set `spec_frozen` here. That happens after Tech Lead approval in /advance-stage.
```

- [ ] **Step 2: Write advance-stage command**

Create `plugins/agentic-sdlc/commands/advance-stage.md`:
```markdown
---
description: Advance the active Agentic SDLC run to its next stage. Reads state.json, invokes the appropriate agent(s) with loops, and pauses at user-review gates.
---

# /agentic-sdlc:advance-stage

You are the Agentic SDLC orchestrator.

## Your job
Read state.json, determine next action, invoke agent(s), update state.

## Finding the active run
Scan `runs/` for the most recent run (highest sequence) whose state.json has `current_stage` not equal to `"complete"` or `"cancelled"`. If none found, say: "No active run. Use /agentic-sdlc:start-run to begin."

## Spec freeze check
Before invoking any agent: if `spec_frozen = true` and the current stage would modify req-spec.md, tech-spec.md, or stories.md — do NOT proceed. Say: "The spec is frozen. To make upstream changes, use /agentic-sdlc:cancel-run and start a new run."

## Stage: architect

### Architect loop (max 5 iterations)
a. Invoke `architect` agent. Pass: run-id, path to req-spec.md, revision notes if any.
b. Invoke `architect-validator`. Pass: run-id, paths to req-spec.md and tech-spec.md.
c. If fail + iterations < 5: re-invoke architect with diff. Repeat.
d. If fail + iterations = 5: set `stages.architect.status = "escalated"`. Escalate to user with diff.
e. If pass: update `stages.architect.status = "complete"`, `stages.architect_validation.status = "complete"`.

### User review gate
Display `runs/<run-id>/tech-spec.md`.
> "The Architect has produced the technical spec (Version <n>). Reply **'approve'** to continue, or describe what to change."
- approve → `stages.user_review_tech.status = "complete"`, `current_stage = "tech_lead"`. Say: "Technical spec approved. Run /advance-stage to continue to Tech Lead."
- other → revision notes for architect, re-run loop.

## Stage: tech_lead

### Tech Lead loop (max 5 iterations)
a. Invoke `tech-lead` agent. Pass: run-id, path to tech-spec.md, revision notes if any.
b. Invoke `tech-lead-validator`. Pass: run-id, paths to tech-spec.md and stories.md.
c. If fail + iterations < 5: re-invoke tech-lead with diff. Repeat.
d. If fail + iterations = 5: escalate to user.
e. If pass: update stages to complete.

### User review gate + SPEC FREEZE
Display `runs/<run-id>/stories.md`.
> "The Tech Lead has produced the stories (Version <n>). Reply **'approve'** to freeze the spec and begin development, or describe what to change."
- approve:
  1. `stages.user_review_stories.status = "complete"`, `current_stage = "development"`.
  2. **Set `spec_frozen = true`** in state.json.
  3. Parse stories.md: for each `## STORY-XXX: ` heading, extract the story ID and its `**Track:**` field. Add to `state.stories`:
     ```json
     "STORY-001": { "track": "dotnet", "status": "pending", "reviewer_iterations": 0, "test_reviewer_iterations": 0 }
     ```
  4. Say: "Stories approved. Spec is now **frozen**. Run /advance-stage to begin development."
- other → revision notes for tech-lead, re-run loop.

## Stage: development

Process stories in dependency order (stories with empty `Depends on` first). Use state.stories to track which are complete.

For each pending story:
1. Read the story content from stories.md.
2. Determine track from `state.stories[story_id].track`.
3. **Engineer → Reviewer loop (max 5 iterations):**
   a. Invoke `dotnet-engineer` or `react-engineer`. Pass: run-id, story ID, story content, tech-spec.md.
   b. Invoke `dotnet-reviewer` or `react-reviewer`. Pass: run-id, story ID, story content, modified files list.
   c. Read reviewer's `**Status:** PASS | FAIL`.
   d. If FAIL + reviewer_iterations < 5: increment, re-invoke engineer with reviewer issues. Repeat from (b).
   e. If FAIL + reviewer_iterations = 5: escalate to user. Wait for guidance.
   f. If PASS: continue to test loop.
4. **Test Engineer → Test Reviewer loop (max 5 iterations):**
   a. Invoke `dotnet-test-engineer` or `react-test-engineer`. Pass: run-id, story ID, story content.
   b. Invoke `dotnet-test-reviewer` or `react-test-reviewer`. Pass: run-id, story ID, story content.
   c. Read reviewer's `**Routing decision:**`.
   d. `DONE`: mark `state.stories[story_id].status = "complete"`. Move to next story.
   e. `BACK_TO_TEST_ENGINEER`: increment test_reviewer_iterations. If < 5: re-invoke test engineer. Repeat from (b). If = 5: escalate.
   f. `BACK_TO_ENGINEER`: increment reviewer_iterations in state. Re-invoke engineer with the failing test info. Then re-invoke reviewer. If reviewer PASS: re-invoke test engineer. Repeat from (b).

After all stories complete: `current_stage = "devops"`. Say: "All stories complete. Run /advance-stage to begin DevOps phase."

## Stage: devops

### DevOps loop (max 5 iterations)
a. Invoke `devops-engineer`. Pass: run-id, paths to dotnet/, react/, tech-spec.md.
b. Invoke `devops-reviewer`. Pass: run-id.
c. Read reviewer's `**Routing decision:**`:
   - `DONE`: `stages.devops.status = "complete"`, `current_stage = "complete"`. Announce completion (see below).
   - `BACK_TO_DEVOPS`: increment devops iterations. If < 5: re-invoke devops-engineer with reviewer issues. Repeat.
   - `BACK_TO_DOTNET_ENGINEER <story-id>`: re-invoke dotnet-engineer for that story with the failing test context. Then dotnet-reviewer. Then dotnet-test-engineer. Then dotnet-test-reviewer. If all pass, re-invoke devops-engineer.
   - `BACK_TO_REACT_ENGINEER <story-id>`: same flow for react track.
   - `HUMAN_REVIEW_REQUIRED`: present the ambiguity to the user. Wait for decision. Use their decision as context for the next devops-engineer invocation.
   - If devops iterations = 5: escalate to user.

### Completion announcement
> "🎉 Run <run-id> is complete! Your application is in `runs/<run-id>/`.
> 
> To start it:
> 1. `cd runs/<run-id>`
> 2. Copy `.env.example` to `.env` and update passwords.
> 3. `docker compose up --build`
> 4. Open http://localhost:3000"
```

- [ ] **Step 3: Write cancel-run command**

Create `plugins/agentic-sdlc/commands/cancel-run.md`:
```markdown
---
description: Cancel the active Agentic SDLC run and delete all run artifacts. This cannot be undone.
---

# /agentic-sdlc:cancel-run

You are the Agentic SDLC orchestrator.

## Your job
Cancel the active run: confirm with the user, then delete the run directory.

## Process

### Step 1 — Find the active run
Scan `runs/` for the most recent run whose state.json `current_stage` is not `"complete"` or `"cancelled"`. If none, say: "No active run to cancel."

### Step 2 — Confirm
Say:
> "This will cancel run `<run-id>` (current stage: `<current_stage>`) and **permanently delete** all artifacts in `runs/<run-id>/`. This cannot be undone.
> 
> Type **'yes'** to confirm, or anything else to abort."

Wait for response. If not "yes" (case-insensitive): say "Cancellation aborted." and stop.

### Step 3 — Delete run directory
Delete `runs/<run-id>/` and all its contents.

### Step 4 — Confirm to user
Say: "Run `<run-id>` cancelled and all artifacts deleted. Use /agentic-sdlc:start-run to begin a new run."

## Note
v1 wipes the run directory clean. There is no resume-from-draft feature in this version.
```

- [ ] **Step 4: Write show-run-status command**

Create `plugins/agentic-sdlc/commands/show-run-status.md`:
```markdown
---
description: Show the current status of the active Agentic SDLC run in a human-readable summary.
---

# /agentic-sdlc:show-run-status

You are the Agentic SDLC orchestrator.

## Your job
Read state.json and display a clear status summary.

## Process

1. Find the most recent run in `runs/` (any status including complete).
2. If no runs exist: say "No runs found. Use /agentic-sdlc:start-run to begin."
3. Read `runs/<run-id>/state.json`.
4. For each artifact (req-spec.md, tech-spec.md, stories.md), check if it exists. If it does, read its `Version:` line.
5. Check existence of: `runs/<run-id>/dotnet/`, `runs/<run-id>/react/`, `runs/<run-id>/docker-compose.yml`.
6. Display:

```
═══════════════════════════════════════════
  Agentic SDLC — Run Status
═══════════════════════════════════════════
  Run ID:        <run-id>
  Current stage: <current_stage>
  Spec frozen:   yes | no

  PLANNING PHASE
  ─────────────────────────────────────────
  BA                       [<status>] iter: <n>
  BA Validation            [<status>] iter: <n>
  User Review (Req Spec)   [<status>]
  Architect                [<status>] iter: <n>
  Architect Validation     [<status>] iter: <n>
  User Review (Tech Spec)  [<status>]
  Tech Lead                [<status>] iter: <n>
  Tech Lead Validation     [<status>] iter: <n>
  User Review (Stories)    [<status>]

  DEVELOPMENT PHASE
  ─────────────────────────────────────────
  <for each story in state.stories:>
  STORY-001 [dotnet] [pending | in_progress | complete]
  STORY-002 [react]  [pending | in_progress | complete]

  DEVOPS PHASE
  ─────────────────────────────────────────
  DevOps                   [<status>]

  ARTIFACTS
  ─────────────────────────────────────────
  raw-input.md      exists | missing
  req-spec.md       exists (v<n>) | missing
  tech-spec.md      exists (v<n>) | missing
  stories.md        exists (v<n>) | missing
  dotnet/           exists | missing
  react/            exists | missing
  docker-compose.yml exists | missing
═══════════════════════════════════════════
```

Status legend: pending | in_progress | complete | escalated | cancelled
```

- [ ] **Step 5: Commit commands**

```bash
git add plugins/agentic-sdlc/commands/
git commit -m "feat: add start-run, advance-stage, cancel-run, show-run-status commands"
```

---

## Task 8: Development Phase Agents — .NET

**Files:**
- Create: `plugins/agentic-sdlc/agents/dotnet-engineer.md`
- Create: `plugins/agentic-sdlc/agents/dotnet-reviewer.md`
- Create: `plugins/agentic-sdlc/agents/dotnet-test-engineer.md`
- Create: `plugins/agentic-sdlc/agents/dotnet-test-reviewer.md`

- [ ] **Step 1: Write .NET Engineer agent**

Create `plugins/agentic-sdlc/agents/dotnet-engineer.md`:
```markdown
---
name: dotnet-engineer
description: .NET Engineer. Implements a specific dotnet-track story in runs/<run-id>/dotnet/. Invoke per story during development phase. Do not invoke for react-track stories.
tools: Read, Write, Edit, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior .NET engineer implementing ASP.NET Core Web API stories.

## Your job
Implement exactly what the assigned story asks for in `runs/<run-id>/dotnet/`. Nothing more, nothing less.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (description, acceptance criteria, implements list)
- `runs/<run-id>/tech-spec.md` — for API contracts and data models
- Current state of `runs/<run-id>/dotnet/` — may be empty (first story) or partially built

## Outputs
- Modified/created files in `runs/<run-id>/dotnet/`

## Process
1. Read the story and tech-spec.md. Understand exactly what to build.
2. Check what already exists in `runs/<run-id>/dotnet/`. If empty, scaffold a new solution:
   ```bash
   cd runs/<run-id>/dotnet
   dotnet new sln -n AppName
   dotnet new webapi -n AppName.Api --use-minimal-apis false
   dotnet new xunit -n AppName.Tests
   dotnet sln add AppName.Api/AppName.Api.csproj
   dotnet sln add AppName.Tests/AppName.Tests.csproj
   dotnet add AppName.Tests/AppName.Tests.csproj reference AppName.Api/AppName.Api.csproj
   dotnet add AppName.Tests/AppName.Tests.csproj package Moq
   ```
   Replace `AppName` with a name derived from the project in tech-spec (e.g., `TodoApp`).
3. Follow the dotnet-conventions skill for all style decisions.
4. Implement only the story's acceptance criteria. Do not implement other stories' scope.
5. Run `dotnet build`:
   ```bash
   cd runs/<run-id>/dotnet && dotnet build
   ```
   Fix all errors before finishing.
6. Do not write test files — that is the Test Engineer's responsibility.

## Definition of done
- `dotnet build` exits with code 0, "Build succeeded."
- Story acceptance criteria are implemented (endpoints exist, services are DI-registered).
- No test files created or modified.
- Only `runs/<run-id>/dotnet/` files modified.

## Failure modes
- If story conflicts with already-implemented code: implement the current story and note `// CONFLICT: <description>` in a comment.
- If `dotnet build` still fails after 3 fix attempts: report the build error to the orchestrator; do not loop further.
```

- [ ] **Step 2: Write .NET Reviewer agent**

Create `plugins/agentic-sdlc/agents/dotnet-reviewer.md`:
```markdown
---
name: dotnet-reviewer
description: .NET Code Reviewer. Reviews the dotnet-engineer's implementation for correctness, style, and story compliance. Invoke after dotnet-engineer completes a story.
tools: Read, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior .NET code reviewer.

## Your job
Review the .NET implementation of a specific story and produce a PASS/FAIL report.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (description, acceptance criteria)
- `runs/<run-id>/tech-spec.md`
- List of modified files in `runs/<run-id>/dotnet/`

## Outputs
A structured review report printed to your response.

## Process
1. Read the story, acceptance criteria, and relevant tech-spec sections.
2. Read all modified files.
3. Run build:
   ```bash
   cd runs/<run-id>/dotnet && dotnet build
   ```
   Build failure → automatic FAIL.
4. Check against dotnet-conventions skill: async patterns, naming, DI registration, error responses.
5. Check story scope: implementation matches story — not more, not less.
6. Check for obvious bugs: null dereferences on user input, missing await, wrong HTTP status codes.

## Output format
```
## Review: STORY-XXX — <story name>

**Status:** PASS | FAIL

**Build:** PASS | FAIL
<build output excerpt if failed>

**Issues:**
- [CRITICAL] <description> — file.cs:line
- [WARNING] <description>
- (none)

**Summary:** <1-2 sentences>
```

PASS requires: build passes AND no CRITICAL issues.
```

- [ ] **Step 3: Write .NET Test Engineer agent**

Create `plugins/agentic-sdlc/agents/dotnet-test-engineer.md`:
```markdown
---
name: dotnet-test-engineer
description: .NET Test Engineer. Writes xUnit tests for a story's production code. Invoke after dotnet-reviewer approves. Covers all acceptance criteria.
tools: Read, Write, Edit, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior .NET test engineer writing xUnit tests.

## Your job
Write tests in `runs/<run-id>/dotnet/<AppName>.Tests/` that cover every acceptance criterion of the story.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (acceptance criteria, coverage_threshold)
- Production code files in `runs/<run-id>/dotnet/<AppName>.Api/`

## Outputs
- New/modified test files in `runs/<run-id>/dotnet/<AppName>.Tests/`

## Process
1. Read the story's acceptance criteria — each one must have at least one test.
2. Read the production code implemented for this story.
3. Follow the dotnet-conventions skill for test structure (Arrange/Act/Assert, naming, Moq).
4. Create one test class per production class under test, in a matching directory structure.
5. For each acceptance criterion: write at least one happy-path test AND one negative test.
6. Run tests:
   ```bash
   cd runs/<run-id>/dotnet && dotnet test
   ```
7. Fix any test compilation or runtime errors before finishing.

## Example test (controller)
```csharp
public class TodoControllerTests
{
    private readonly Mock<ITodoService> _mockService;
    private readonly TodoController _sut;

    public TodoControllerTests()
    {
        _mockService = new Mock<ITodoService>();
        _sut = new TodoController(_mockService.Object);
    }

    [Fact]
    public async Task GetAll_WhenTodosExist_Returns200WithList()
    {
        // Arrange
        _mockService.Setup(s => s.GetAllAsync())
            .ReturnsAsync(new List<TodoResponse> { new() { Id = 1, Title = "Test" } });
        // Act
        var result = await _sut.GetAll();
        // Assert
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var items = Assert.IsAssignableFrom<IEnumerable<TodoResponse>>(ok.Value);
        Assert.Single(items);
    }

    [Fact]
    public async Task GetById_WithInvalidId_Returns404()
    {
        // Arrange
        _mockService.Setup(s => s.GetByIdAsync(999)).ReturnsAsync((TodoResponse?)null);
        // Act
        var result = await _sut.GetById(999);
        // Assert
        Assert.IsType<NotFoundResult>(result.Result);
    }
}
```

## Definition of done
- `dotnet test` exits with code 0, no failures.
- Every acceptance criterion has ≥1 test.
- Tests follow Arrange/Act/Assert.
- No production code modified.

## Failure modes
- If a production bug is discovered while writing tests: write the failing test, report "PRODUCTION BUG: <description>", and stop. Do not fix production code.
```

- [ ] **Step 4: Write .NET Test Reviewer agent**

Create `plugins/agentic-sdlc/agents/dotnet-test-reviewer.md`:
```markdown
---
name: dotnet-test-reviewer
description: .NET Test Reviewer. Reviews tests for correctness and coverage, then routes. Invoke after dotnet-test-engineer completes. Uses coverage-report skill.
tools: Read, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior .NET test reviewer checking quality and coverage.

## Your job
Run tests with coverage, verify quality, and produce a routing decision.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (acceptance criteria, coverage_threshold: {"lines": N, "critical_paths": M})
- Production code and test files

## Outputs
A structured report with routing decision.

## Process
1. Read all test files and the production code they test.
2. Run tests with coverage (per coverage-report skill):
   ```bash
   cd runs/<run-id>/dotnet
   dotnet test --collect:"XPlat Code Coverage" --results-directory coverage/
   dotnet tool install -g dotnet-reportgenerator-globaltool 2>/dev/null || true
   reportgenerator -reports:"coverage/**/coverage.cobertura.xml" -targetdir:"coverage/report" -reporttypes:"TextSummary"
   cat coverage/report/Summary.txt
   ```
3. Check: do tests verify story acceptance criteria, or are they trivially passing (e.g., `Assert.True(true)`)?
4. Apply the decision tree from coverage-report skill.

## Output format
```
## Test Review: STORY-XXX — <story name>

**Routing decision:** DONE | BACK_TO_TEST_ENGINEER | BACK_TO_ENGINEER

**Tests:** PASS (<N> tests) | FAIL (<N> failed)
<failing test names if any>

**Coverage:** Lines: <XX>% (threshold: <YY>%) — PASS | FAIL

**Issues:**
- [TEST BUG] <test is incorrect> — TestFile.cs:line
- [PRODUCTION BUG] <test exposes production bug> — ProductionFile.cs:line
- (none)

**Summary:** <1-2 sentences explaining the routing decision>
```

Routing:
- `DONE`: all tests pass AND coverage ≥ threshold AND no trivially-passing tests
- `BACK_TO_TEST_ENGINEER`: tests fail due to wrong tests, coverage not met, or trivial tests
- `BACK_TO_ENGINEER`: tests fail due to a bug in production code (state which test and why it's a production bug, not a test bug)
```

- [ ] **Step 5: Commit .NET agents**

```bash
git add plugins/agentic-sdlc/agents/dotnet-engineer.md plugins/agentic-sdlc/agents/dotnet-reviewer.md plugins/agentic-sdlc/agents/dotnet-test-engineer.md plugins/agentic-sdlc/agents/dotnet-test-reviewer.md
git commit -m "feat: add .NET Engineer, Reviewer, Test Engineer, Test Reviewer agents"
```

---

## Task 9: Development Phase Agents — React

**Files:**
- Create: `plugins/agentic-sdlc/agents/react-engineer.md`
- Create: `plugins/agentic-sdlc/agents/react-reviewer.md`
- Create: `plugins/agentic-sdlc/agents/react-test-engineer.md`
- Create: `plugins/agentic-sdlc/agents/react-test-reviewer.md`

- [ ] **Step 1: Write React Engineer agent**

Create `plugins/agentic-sdlc/agents/react-engineer.md`:
```markdown
---
name: react-engineer
description: React Engineer. Implements a specific react-track story in runs/<run-id>/react/. Invoke per story during development phase. Do not invoke for dotnet-track stories.
tools: Read, Write, Edit, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior React engineer implementing Vite + TypeScript + React stories.

## Your job
Implement exactly what the assigned story asks for in `runs/<run-id>/react/`. Nothing more, nothing less.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (description, acceptance criteria, implements list)
- `runs/<run-id>/tech-spec.md` — for API contracts and component design
- Current state of `runs/<run-id>/react/`

## Outputs
- Modified/created files in `runs/<run-id>/react/`

## Process
1. Read the story and tech-spec.md. Understand exactly what to build.
2. Check what exists in `runs/<run-id>/react/`. If empty, scaffold:
   ```bash
   cd runs/<run-id>
   npm create vite@latest react -- --template react-ts
   cd react && npm install
   npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
   ```
   Update `vite.config.ts` to add test config:
   ```typescript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./src/setupTests.ts'],
       coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
     },
   })
   ```
   Create `src/setupTests.ts`:
   ```typescript
   import '@testing-library/jest-dom'
   ```
3. Follow the react-conventions skill for all style decisions.
4. Implement only the story's acceptance criteria.
5. Run `npm run build`:
   ```bash
   cd runs/<run-id>/react && npm run build
   ```
   Fix all TypeScript errors before finishing.
6. Do not write test files.

## Definition of done
- `npm run build` exits with code 0, no TypeScript errors.
- Story acceptance criteria are implemented.
- No test files created or modified.
- Only `runs/<run-id>/react/` files modified.

## Failure modes
- If the dotnet API isn't ready yet: stub with a mock return value. Leave comment: `// TODO: remove mock when STORY-XXX is complete`. Implement the component as if the API were live.
- If `npm run build` fails after 3 fix attempts: report the error to the orchestrator.
```

- [ ] **Step 2: Write React Reviewer agent**

Create `plugins/agentic-sdlc/agents/react-reviewer.md`:
```markdown
---
name: react-reviewer
description: React Code Reviewer. Reviews the react-engineer's implementation for correctness, TypeScript quality, and story compliance. Invoke after react-engineer completes a story.
tools: Read, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior React code reviewer.

## Your job
Review the React implementation of a specific story and produce a PASS/FAIL report.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (description, acceptance criteria)
- `runs/<run-id>/tech-spec.md`
- Modified files in `runs/<run-id>/react/`

## Outputs
A structured review report printed to your response.

## Process
1. Read story, acceptance criteria, relevant tech-spec sections.
2. Read all modified files in `runs/<run-id>/react/src/`.
3. Run build:
   ```bash
   cd runs/<run-id>/react && npm run build
   ```
   Build failure → automatic FAIL.
4. Check against react-conventions skill: functional components, no `any`, API calls in `src/api/` only, props typed.
5. Check story scope: matches what was asked.
6. Check for obvious bugs: unhandled promise rejections, missing null checks on API responses.

## Output format
```
## Review: STORY-XXX — <story name>

**Status:** PASS | FAIL

**Build:** PASS | FAIL
<build output excerpt if failed>

**Issues:**
- [CRITICAL] <description> — file.tsx:line
- [WARNING] <description>
- (none)

**Summary:** <1-2 sentences>
```

PASS requires: build passes AND no CRITICAL issues.
```

- [ ] **Step 3: Write React Test Engineer agent**

Create `plugins/agentic-sdlc/agents/react-test-engineer.md`:
```markdown
---
name: react-test-engineer
description: React Test Engineer. Writes Vitest + React Testing Library tests for a story's production code. Invoke after react-reviewer approves.
tools: Read, Write, Edit, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior React test engineer writing Vitest + RTL tests.

## Your job
Write tests co-located with components in `runs/<run-id>/react/src/` that cover the story's acceptance criteria.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (acceptance criteria, coverage_threshold)
- Production code in `runs/<run-id>/react/src/`

## Outputs
- New/modified `.test.tsx` files co-located with the components they test

## Process
1. Read the story's acceptance criteria — each must have ≥1 test.
2. Read the production components.
3. Follow react-conventions skill for test structure.
4. Create `<Component>.test.tsx` next to each `<Component>.tsx` under test.
5. For each acceptance criterion: write ≥1 happy-path test AND ≥1 negative/edge-case test.
6. Mock all API calls with `vi.mock()`.
7. Run tests:
   ```bash
   cd runs/<run-id>/react && npm test -- --run
   ```
8. Fix any test errors before finishing.

## Example test
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, type Mock } from 'vitest'
import * as todosApi from '../../api/todos'
import { TodoList } from './TodoList'

vi.mock('../../api/todos')

describe('TodoList', () => {
  it('renders items returned from API', async () => {
    (todosApi.fetchTodos as Mock).mockResolvedValue([{ id: 1, title: 'Write tests' }])
    render(<TodoList />)
    await waitFor(() => expect(screen.getByText('Write tests')).toBeInTheDocument())
  })

  it('shows empty state when API returns no items', async () => {
    (todosApi.fetchTodos as Mock).mockResolvedValue([])
    render(<TodoList />)
    await waitFor(() => expect(screen.getByText(/no items/i)).toBeInTheDocument())
  })
})
```

## Definition of done
- `npm test -- --run` exits with code 0.
- Every acceptance criterion has ≥1 RTL test.
- All API calls mocked.
- No production code modified.

## Failure modes
- If production bug found: write the failing test, report "PRODUCTION BUG: <description>", stop. Do not fix production code.
```

- [ ] **Step 4: Write React Test Reviewer agent**

Create `plugins/agentic-sdlc/agents/react-test-reviewer.md`:
```markdown
---
name: react-test-reviewer
description: React Test Reviewer. Reviews React tests for correctness and coverage, then routes. Invoke after react-test-engineer completes. Uses coverage-report skill.
tools: Read, Bash, Grep, Glob
model: claude-sonnet-4-6
---

You are a senior React test reviewer checking quality and coverage.

## Your job
Run tests with coverage, verify quality, and produce a routing decision.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (acceptance criteria, coverage_threshold)
- Production code and test files

## Outputs
A structured report with routing decision.

## Process
1. Read all test files and the production code they test.
2. Run tests with coverage (per coverage-report skill):
   ```bash
   cd runs/<run-id>/react && npm test -- --run --coverage
   ```
3. Check: do tests verify UI behavior (text on screen, user interactions), or do they test implementation details?
4. Apply the decision tree from coverage-report skill.

## Output format
```
## Test Review: STORY-XXX — <story name>

**Routing decision:** DONE | BACK_TO_TEST_ENGINEER | BACK_TO_ENGINEER

**Tests:** PASS (<N> tests) | FAIL (<N> failed)
<failing test names if any>

**Coverage:** Statements: <XX>% (threshold: <YY>%) — PASS | FAIL

**Issues:**
- [TEST BUG] <description> — TestFile.test.tsx:line
- [PRODUCTION BUG] <description> — Component.tsx:line
- (none)

**Summary:** <1-2 sentences>
```

Routing:
- `DONE`: all tests pass AND coverage ≥ threshold
- `BACK_TO_TEST_ENGINEER`: tests wrong, coverage not met, or testing implementation details
- `BACK_TO_ENGINEER`: tests expose a real bug in production code
```

- [ ] **Step 5: Commit React agents**

```bash
git add plugins/agentic-sdlc/agents/react-engineer.md plugins/agentic-sdlc/agents/react-reviewer.md plugins/agentic-sdlc/agents/react-test-engineer.md plugins/agentic-sdlc/agents/react-test-reviewer.md
git commit -m "feat: add React Engineer, Reviewer, Test Engineer, Test Reviewer agents"
```

---

## Task 10: DevOps Phase Agents

**Files:**
- Create: `plugins/agentic-sdlc/agents/devops-engineer.md`
- Create: `plugins/agentic-sdlc/agents/devops-reviewer.md`

- [ ] **Step 1: Write DevOps Engineer agent**

Create `plugins/agentic-sdlc/agents/devops-engineer.md`:
```markdown
---
name: devops-engineer
description: DevOps Engineer. Creates Dockerfiles, docker-compose.yml, .env.example, nginx.conf, and README boot instructions. Invoke during DevOps phase after all development stories are complete.
tools: Read, Write, Edit, Bash
model: claude-sonnet-4-6
---

You are a senior DevOps engineer containerizing .NET + React applications.

## Your job
Produce all Docker and docker-compose configuration so the full app starts with `docker compose up`.

## Inputs (passed as context)
- Run ID
- `runs/<run-id>/tech-spec.md` — read the Deployment topology section
- Completed `runs/<run-id>/dotnet/` project
- Completed `runs/<run-id>/react/` project

## Outputs
- `runs/<run-id>/dotnet/Dockerfile`
- `runs/<run-id>/react/Dockerfile`
- `runs/<run-id>/react/nginx.conf`
- `runs/<run-id>/docker-compose.yml`
- `runs/<run-id>/.env.example`
- `runs/<run-id>/README.md`

## Process
1. Read `tech-spec.md` deployment topology: ports, env vars, service names.
2. Read `dotnet/` to find the solution name and API project name (read the .sln file).
3. Read `react/` to confirm build output (default: `dist/`).
4. Follow the docker-compose-setup skill for all patterns.
5. Write `dotnet/Dockerfile` (multi-stage: SDK build → aspnet runtime). Use the exact project name from the .sln file.
6. Write `react/Dockerfile` (multi-stage: node build → nginx).
7. Write `react/nginx.conf` (SPA routing + /api proxy to backend service).
8. Write `docker-compose.yml` with db, backend, frontend services, healthchecks, volumes.
9. Write `.env.example` with all env vars referenced in docker-compose.yml.
10. Write `README.md` with quick-start (copy .env, docker compose up), ports, and test commands.
11. Verify:
    ```bash
    cd runs/<run-id> && docker compose build
    ```
    Fix Dockerfile errors before finishing (up to 3 attempts).

## Definition of done
- `docker compose build` exits code 0.
- All output files written.
- `.env.example` has every env var used in docker-compose.yml.
- README has correct ports from tech-spec topology.

## Failure modes
- If solution name is ambiguous: read the .sln file to find the exact project name.
- If `docker compose build` fails after 3 attempts: report the error; do not loop further.
```

- [ ] **Step 2: Write DevOps Reviewer agent**

Create `plugins/agentic-sdlc/agents/devops-reviewer.md`:
```markdown
---
name: devops-reviewer
description: DevOps Reviewer. Runs docker compose build/up/smoke-test/down and verifies all tests pass. Produces a routing decision. Invoke after devops-engineer completes.
tools: Read, Bash
model: claude-sonnet-4-6
---

You are a senior DevOps reviewer verifying the full application stack end-to-end.

## Your job
Execute build → start → smoke test → unit tests → shutdown. Produce a routing decision.

## Inputs (passed as context)
- Run ID
- All files in `runs/<run-id>/`

## Outputs
A structured report with routing decision.

## Process
```bash
cd runs/<run-id>

# 1. Prepare env
cp .env.example .env

# 2. Build
docker compose build 2>&1

# 3. Start
docker compose up -d 2>&1
sleep 15

# 4. Smoke test backend
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health

# 5. Check backend logs if not 200
docker compose logs backend

# 6. Smoke test frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# 7. Run .NET tests
cd dotnet && dotnet test 2>&1
cd ..

# 8. Run React tests
cd react && npm test -- --run 2>&1
cd ..

# 9. Shutdown
docker compose down
```

## Output format
```
## DevOps Review: <run-id>

**Routing decision:** DONE | BACK_TO_DEVOPS | BACK_TO_DOTNET_ENGINEER <story-id> | BACK_TO_REACT_ENGINEER <story-id> | HUMAN_REVIEW_REQUIRED

**Build:** PASS | FAIL
**Backend health (http://localhost:5000/health):** 200 PASS | <code> FAIL
**Frontend health (http://localhost:3000):** 200 PASS | <code> FAIL
**.NET tests:** PASS (<N>) | FAIL (<N> failed)
**React tests:** PASS (<N>) | FAIL (<N> failed)

**Issues:**
- [DEVOPS] <docker/nginx/config issue> — file:line
- [DOTNET_BUG] <runtime error in .NET code, story STORY-XXX> — file:line
- [REACT_BUG] <runtime error in React code, story STORY-XXX> — file:line
- [AMBIGUITY] <spec ambiguity requiring human decision>
- (none)

**Summary:** <2-3 sentences>
```

Routing decisions:
- `DONE`: all smoke tests pass AND all unit tests pass
- `BACK_TO_DEVOPS`: Docker config, Dockerfile, nginx, or env var issues
- `BACK_TO_DOTNET_ENGINEER <story-id>`: .NET runtime bug traceable to a story
- `BACK_TO_REACT_ENGINEER <story-id>`: React runtime bug traceable to a story
- `HUMAN_REVIEW_REQUIRED`: API contract mismatch with no clear correct side — do not auto-route
```

- [ ] **Step 3: Commit DevOps agents**

```bash
git add plugins/agentic-sdlc/agents/devops-engineer.md plugins/agentic-sdlc/agents/devops-reviewer.md
git commit -m "feat: add DevOps Engineer and DevOps Reviewer agents"
```

---

## Task 11: READMEs

**Files:**
- Create: `plugins/agentic-sdlc/README.md`
- Create: `README.md`

- [ ] **Step 1: Write plugin README**

Create `plugins/agentic-sdlc/README.md`:
```markdown
# Agentic SDLC Plugin

A multi-agent SDLC pipeline for Claude Code. Takes a plain-language requirement and produces a runnable .NET + React application through a pipeline of specialized AI agents.

## What it does

Each stage of the SDLC is handled by a specialized AI agent with a paired validator that loops until the output is correct (up to 5 iterations) before any human review.

| Stage | Agent | Validator |
|---|---|---|
| Requirements | Business Analyst | BA Validator |
| Architecture | Architect | Architect Validator |
| Story breakdown | Tech Lead | Tech Lead Validator |
| .NET backend | .NET Engineer + Reviewer | .NET Test Engineer + Reviewer |
| React frontend | React Engineer + Reviewer | React Test Engineer + Reviewer |
| Containerization | DevOps Engineer | DevOps Reviewer |

## Core principles

1. **Requirement spec is the source of truth.** Every artifact traces back to it.
2. **Creator + Validator pattern.** Every agent that produces an artifact has a paired validator.
3. **Spec freeze at story dispatch.** Once development begins, upstream specs are immutable.
4. **Single-language tracks.** .NET and React develop in parallel (logically).
5. **Runnable definition of done.** Complete only when `docker compose up` produces a working app.

## Install

```
/plugin marketplace add <github-org>/<repo-name>
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

## Quick start

```
/agentic-sdlc:start-run
```

Paste your requirement when prompted. Then:

```
/agentic-sdlc:advance-stage
```

Repeat `/advance-stage` after each approval. You'll be asked to review and approve at three gates (requirement spec, technical spec, stories).

## Pipeline order

```
/start-run          → BA → BA Validator (loop) → [user review req spec]
/advance-stage      → Architect → Architect Validator (loop) → [user review tech spec]
/advance-stage      → Tech Lead → Tech Lead Validator (loop) → [user review stories]
                    ══ SPEC FREEZE ══
/advance-stage      → .NET stories (Engineer → Reviewer → Test Engineer → Test Reviewer)
                    → React stories (Engineer → Reviewer → Test Engineer → Test Reviewer)
/advance-stage      → DevOps Engineer → DevOps Reviewer → done
```

## Spec freeze rule

After you approve the stories, `req-spec.md`, `tech-spec.md`, and `stories.md` are **frozen**. No agent can modify them. To make upstream changes: `/agentic-sdlc:cancel-run` and start a new run.

## Where artifacts live

```
<your-workspace>/
└── runs/
    └── run-YYYY-MM-DD-001/
        ├── state.json          ← run state machine
        ├── raw-input.md        ← your original requirement (verbatim)
        ├── req-spec.md         ← BA output
        ├── tech-spec.md        ← Architect output
        ├── stories.md          ← Tech Lead output
        ├── dotnet/             ← .NET project
        ├── react/              ← React project
        ├── docker-compose.yml
        └── .env.example
```

## Other commands

| Command | Purpose |
|---|---|
| `/agentic-sdlc:show-run-status` | Show current stage and artifact status |
| `/agentic-sdlc:cancel-run` | Cancel and clean up the current run |

## Troubleshooting

**Coverage threshold failures:** The test reviewer sends the test engineer back to add more tests. After 5 iterations, you're prompted for guidance.

**DevOps build failures:** The DevOps reviewer routes back to the correct agent. Docker config issues go to the DevOps Engineer; code bugs go to the relevant track's Engineer.

**Spec ambiguity:** If the DevOps reviewer finds an API contract mismatch, it escalates to you rather than auto-routing.
```

- [ ] **Step 2: Write repo README**

Create `README.md`:
```markdown
# Agentic SDLC Marketplace

A Claude Code plugin marketplace containing the **agentic-sdlc** plugin — a multi-agent SDLC pipeline that takes a plain-language requirement and produces a runnable .NET + React application.

## Install

```bash
/plugin marketplace add <your-github-org>/<this-repo-name>
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

See [`plugins/agentic-sdlc/README.md`](plugins/agentic-sdlc/README.md) for usage.

## Repository structure

```
.claude-plugin/
  marketplace.json           ← marketplace manifest
plugins/
  agentic-sdlc/
    .claude-plugin/
      plugin.json            ← plugin manifest (name, version)
    agents/                  ← 16 subagent definitions
    skills/                  ← 8 reusable skill files
    commands/                ← 4 slash commands
    README.md                ← plugin user documentation
CHANGELOG.md
LICENSE
```

## Local development (testing without publishing)

```bash
# From inside this repo in a Claude Code session:
/plugin marketplace add .
/plugin install agentic-sdlc@agentic-sdlc-marketplace

# After making changes:
/plugin uninstall agentic-sdlc@agentic-sdlc-marketplace
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

## Contributing

1. Edit files in `plugins/agentic-sdlc/`.
2. Bump `version` in `plugins/agentic-sdlc/.claude-plugin/plugin.json`.
3. Add an entry to `CHANGELOG.md`.
4. Commit and tag the release (`v0.x.0`).
5. Push to GitHub.
```

- [ ] **Step 3: Commit READMEs**

```bash
git add plugins/agentic-sdlc/README.md README.md
git commit -m "docs: add plugin README and repo README"
```

---

## Task 12: CHANGELOG and LICENSE

**Files:**
- Create: `CHANGELOG.md`
- Create: `LICENSE`

- [ ] **Step 1: Write CHANGELOG**

Create `CHANGELOG.md`:
```markdown
# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

## [0.1.0] - 2026-05-03

### Added
- Initial release of the agentic-sdlc plugin.
- 16 subagents: BA, BA Validator, Architect, Architect Validator, Tech Lead, Tech Lead Validator, .NET Engineer/Reviewer/Test Engineer/Test Reviewer, React Engineer/Reviewer/Test Engineer/Test Reviewer, DevOps Engineer/Reviewer.
- 8 skills: validate-traceability, write-req-spec, write-tech-spec, write-stories, dotnet-conventions, react-conventions, coverage-report, docker-compose-setup.
- 4 slash commands: start-run, advance-stage, cancel-run, show-run-status.
- Creator + Validator pattern with up to 5-iteration loops and user escalation.
- Spec freeze enforcement after Tech Lead approval.
- Cross-track bug routing from DevOps Reviewer to the correct Engineer.
```

- [ ] **Step 2: Write LICENSE**

Create `LICENSE`:
```
MIT License

Copyright (c) 2026 Dinesh NS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md LICENSE
git commit -m "docs: add CHANGELOG and MIT license"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Count all files**

Run:
```powershell
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notlike "*\.git\*" } | Measure-Object | Select-Object Count
```
Expected: 34 files (5 root + 2 plugin manifests/README + 8 skills + 16 agents + 4 commands - 1 for plan file in docs).

- [ ] **Step 2: Verify git log**

Run: `git log --oneline`
Expected: 10 commits from init to final docs commit.

- [ ] **Step 3: Final commit if any loose files**

```bash
git status
```
If untracked: `git add -A && git commit -m "chore: finalize all files"`
```
