---
name: dotnet-conventions
description: Project-specific .NET coding conventions. Used by .NET Engineer, Reviewer, Test Engineer, and Test Reviewer.
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
- Test methods: `<MethodUnderTest>_<Scenario>_<ExpectedBehavior>`

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

## Test scope: behavior only — never the build, SDK, or project structure

Tests exercise the **application's runtime behavior** through its own types. They must NEVER:

- **Invoke the `dotnet` CLI or spawn any external process** — no `dotnet build` / `restore` /
  `sln list` / `run`, no `Process.Start`. Spawning `dotnet` from inside a `dotnet test` run is
  slow and deadlocks on the NuGet package-folder lock or a network restore; it has produced
  multi-minute hangs for zero behavioral coverage. If you find yourself shelling out to a tool,
  the test is wrong.
- **Assert on project structure, layering, or "it compiles"** — e.g. "the solution has four
  projects", "Domain references nothing", "the build succeeds". Clean Architecture layering is
  enforced by the **architect-validator**; "it compiles" is proven by the build step. These are
  not runtime behavior and get **zero** tests at this layer. A structural acceptance criterion
  ("split into Domain/Application/Infrastructure/Api") is satisfied by the architecture itself and
  validated upstream — do not write a test for it.
- **Depend on an ambient database, network service, or Docker.** Repository tests use SQLite
  in-memory; integration tests use `WebApplicationFactory` with the data layer pointed at SQLite
  in-memory (or EF in-memory) — never `(localdb)`, a `Server=localhost` SQL Server, or
  Testcontainers requiring a Docker daemon. CI/Ubuntu agents have none of these, so such tests
  hang on connect-retry.

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

## Build & test execution discipline (CI/Ubuntu)

These rules keep agent runs fast and context lean — a full solution build-and-test cycle is
slow on Linux/CI, and full stack traces waste the agent's context budget.

- **Truncate error output.** When `dotnet build` / `dotnet test` emits more than ~30 lines of
  errors, do NOT read or echo the whole trace. Read only the first ~5 distinct errors and fix
  those — repeated errors usually share one root cause. Scope output at the source:
  ```bash
  dotnet build <backend_src> 2>&1 | head -n 30
  ```
- **Target the specific project while iterating.** Build/test the project you changed, not the
  whole solution:
  ```bash
  dotnet test <backend_test>/<AppName>.Tests/<AppName>.Tests.csproj --filter "FullyQualifiedName~<ClassUnderTest>"
  ```
  The single authoritative full-solution run with coverage belongs to the Test Reviewer's gate,
  not to iteration.
- **At most one `dotnet test` in flight against a given project/DB.** Never launch a run while
  another is still active — concurrent runs share the same build output, test database, and ports,
  producing SQL deadlocks, `database is locked`, port-in-use, and net *slowdown* (more processes
  fighting the same cores and disk), never a speedup. Run the suite once per change and let it
  finish before starting another.
- **Reuse binaries only when safe (`--no-build` / `--no-restore`).** After a successful build in
  the same invocation with nothing changed since, you may re-run tests with `dotnet test
  --no-build` to save time. Force a clean build (drop the flags) whenever a `.csproj`, project
  reference, or package changed — and ALWAYS for the Test Reviewer's authoritative coverage run.
  Never report a pass off stale binaries.
- **Cap the inner fix loop at 3.** Within a single agent invocation, stop after 3 consecutive
  failed fix attempts on the same persistent build/test error. Report the (truncated) logs to the
  orchestrator instead of attempting a fourth — the orchestrator's outer loop handles escalation.
- **Bound every test run so a hang fails fast.** A test that blocks (e.g. in fixture setup, or a
  test that shells out — which it must not; see "Test scope" above) will otherwise stall the run
  indefinitely. Always pass `--blame-hang-timeout` so the run self-terminates and names the
  offending test instead of hanging forever:
  ```bash
  dotnet test <project> --blame-hang-timeout 120s
  ```
  A run that exceeds the timeout is a **failure to diagnose** (which test stalled, and why) — not
  a slow run to wait out. "It's just slow, I'll wait" is the wrong reflex; find the blocking test.
- **Never pipe a test run you need to observe through `tail`.** `tail` buffers all of stdin and
  flushes only at EOF, so a still-running — or hung — `dotnet test ... | tail` shows *nothing*:
  you lose both live progress and the hang report. `head`/`tail` truncation is for *error output
  after a finished build* (above), not for a live or authoritative test run. To see which test is
  executing, use `--logger "console;verbosity=detailed"` — it prints each test as it starts.
