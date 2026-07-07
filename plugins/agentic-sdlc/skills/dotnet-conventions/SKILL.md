---
name: dotnet-conventions
description: Project-specific .NET coding conventions (architecture, naming, DI, robustness). Used by the .NET Engineer and Reviewer. Test structure and test-execution rules live in the dotnet-testing skill.
---

# .NET Conventions

## Architecture: Clean Architecture (mandatory)

The backend follows Clean Architecture as **four projects**. **Source-code dependencies point
only inward** — `Domain` depends on nothing; `Api` is the outermost composition root.

### Source vs. test layout (mandatory)

**Production code lives under `<backend_src>/`. Test code lives under `<backend_test>/`
(default `tests/backend`) — never inside `<backend_src>/`.** The `.sln` stays in
`<backend_src>/` and references the test project by relative path, so `dotnet build
<backend_src>` and `dotnet test <backend_src>` still build and run everything.

```
<repo root>/
├── <backend_src>/                # e.g. src/backend — SOURCE ONLY
│   ├── <AppName>.sln             # references the test project at ../../<backend_test>/...
│   ├── <AppName>.Domain/         # refs: none
│   │   ├── Entities/             # domain entities (POCOs — no EF attributes required)
│   │   └── ValueObjects/         # value objects, domain enums/exceptions
│   ├── <AppName>.Application/     # refs: Domain
│   │   ├── Abstractions/         # IFooRepository.cs, IFooService.cs (interfaces only)
│   │   ├── Services/             # FooService.cs — use-case logic
│   │   └── Models/               # FooRequest.cs, FooResponse.cs (DTOs)
│   ├── <AppName>.Infrastructure/  # refs: Application (+ Domain)
│   │   ├── Data/                 # AppDbContext.cs + EF Core migrations
│   │   └── Repositories/         # FooRepository.cs — implements Application interfaces
│   └── <AppName>.Api/            # refs: Application + Infrastructure
│       ├── Controllers/          # One controller per resource — depends on Application interfaces
│       ├── Program.cs            # Entry point + DI composition root + /health
│       └── appsettings.json
└── <backend_test>/               # e.g. tests/backend — TESTS ONLY (never under src/)
    └── <AppName>.Tests/          # refs: the project(s) under test
        ├── Domain/               # entity / value-object tests
        ├── Application/          # service unit tests (mock the Abstractions)
        ├── Infrastructure/       # repository tests (SQLite in-memory)
        └── Integration/          # WebApplicationFactory tests
```

### The dependency rule
- **Domain** references nothing. No EF Core, no ASP.NET, no framework packages.
- **Application** references **only** Domain. Declares interfaces + DTOs + service logic. No EF Core.
- **Infrastructure** references Application. **EF Core, `DbContext`, and migrations live here and only here.** Repository classes implement the Application `Abstractions` interfaces.
- **Api** references Application + Infrastructure. It is the only project that knows about `DbContext`. Controllers inject Application interfaces (`IFooService`) — **never** `DbContext` or a concrete repository.

A violation — e.g. `DbContext` in Api, a controller using a concrete repository, Domain
referencing Application, or an Application class importing EF Core — is a hard failure.

## Naming conventions
- Controllers: `<Resource>Controller.cs`
- Services: `I<Name>Service.cs` (interface) + `<Name>Service.cs` (impl)
- DTOs: `<Name>Request.cs`, `<Name>Response.cs`

## Async patterns
- All controller actions and service methods touching I/O are `async Task<T>`.
- Never use `.Result` or `.Wait()` — always `await`.
- Return `IActionResult` or `ActionResult<T>` from controllers.

## Dependency injection
- `Program.cs` (Api) is the **composition root** — it is the only place that wires concrete
  types to interfaces across layers: `builder.Services.AddScoped<IFooService, FooService>()`
  (Application impl) and `builder.Services.AddScoped<IFooRepository, FooRepository>()`
  (Infrastructure impl).
- Inject via constructor; never use service locator pattern.
- Controllers depend on Application interfaces only — never on `DbContext` or a concrete repository.

## EF Core
- Lives **only** in the Infrastructure project. `AppDbContext` is defined under
  `Infrastructure/Data/`; migrations are generated there (`dotnet ef migrations add <Name>
  -p <AppName>.Infrastructure -s <AppName>.Api`).
- `DbContext` registered as scoped in `Program.cs` (the composition root).
- Always use async EF methods: `ToListAsync()`, `FirstOrDefaultAsync()`, `SaveChangesAsync()`.

## Testing
Test structure, mocking, test scope, and test-execution rules live in the
**`agentic-sdlc:dotnet-testing`** skill (used by the test engineer and test
reviewer). One rule engineers must know: tests never live under `<backend_src>`,
and production code never asserts on project structure or spawns the `dotnet` CLI.

## Robustness essentials (mandatory)

These are non-negotiable quality bars the reviewer enforces on every story:

- **Nullable reference types on.** Every project sets `<Nullable>enable</Nullable>` and
  `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` (in `Directory.Build.props` or each
  `.csproj`). No `#nullable disable`. Model optionality in the type, not with `!`.
- **Validate input at the boundary.** Controllers are annotated `[ApiController]` so invalid
  models return `400` automatically; request DTOs carry DataAnnotations (`[Required]`,
  `[Range]`, `[MaxLength]`) — or FluentValidation where rules are non-trivial. Never trust a
  request body straight into the domain.
- **Structured logging via `ILogger<T>`.** Inject `ILogger<T>`; log at the service/controller
  boundary with message templates (`_logger.LogInformation("Fetched {Count} todos", n)`) —
  never string interpolation into the message, never `Console.WriteLine`. Do not log secrets
  or full request bodies.
- **Propagate `CancellationToken`.** Controller actions accept a `CancellationToken` and pass
  it through service → repository → EF (`ToListAsync(ct)`, `SaveChangesAsync(ct)`), so
  requests cancel cleanly.
- **Configuration via the options pattern.** Bind settings to typed options
  (`IOptions<T>`); read secrets/connection strings from configuration/environment — never
  hard-code them.

## Error handling
- Use `ProblemDetails` for API error responses (ASP.NET Core default).
- `404 NotFound()` for missing resources, `400 BadRequest()` for validation, `500` for unhandled.
- Register a global exception handler (`app.UseExceptionHandler` / `IExceptionHandler`) so no
  raw exception or stack trace leaks to the client; unhandled failures become a `500`
  `ProblemDetails`. Do not wrap every action in try/catch — let the handler centralize it.

## Required: `/health` endpoint
Every backend MUST expose `GET /health` that returns HTTP 200 with `{"status":"ok"}`. This is what the docker-compose readiness check and the DevOps reviewer's smoke test hit. Implement it in `Program.cs` using `app.MapGet("/health", () => Results.Ok(new { status = "ok" }))` or as a `HealthController`. Do not require auth or a DB connection for this endpoint — it must succeed even before DB migrations run.

## Commands
```bash
dotnet build          # Expected: Build succeeded.
dotnet test           # Expected: All tests pass.
```

## Build execution discipline (CI/Ubuntu)

These rules keep agent runs fast and context lean — a full solution build is slow on
Linux/CI, and full stack traces waste the agent's context budget. (Test-run
discipline — focused runs, hang timeouts, `--no-build` — lives in the
`agentic-sdlc:dotnet-testing` skill.)

- **Engineers and reviewers build only** (`dotnet build <backend_src>`) — they do not
  run the test suite. At most one build/test process in flight against the tree.
- **Truncate error output.** When `dotnet build` emits more than ~30 lines of errors,
  do NOT read or echo the whole trace. Read only the first ~5 distinct errors and fix
  those — repeated errors usually share one root cause. Scope output at the source:
  ```bash
  dotnet build <backend_src> 2>&1 | head -n 30
  ```
- **Cap the inner fix loop at 3.** Within a single agent invocation, stop after 3
  consecutive failed fix attempts on the same persistent build error. Report the
  (truncated) logs to the orchestrator instead of attempting a fourth — the
  orchestrator's outer loop handles escalation.
