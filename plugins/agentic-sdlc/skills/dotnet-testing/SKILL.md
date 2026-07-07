---
name: dotnet-testing
description: Project-specific .NET testing conventions — xUnit structure, mocking, test scope, and test-execution discipline. Used by the .NET Test Engineer and .NET Test Reviewer.
---

# .NET Testing Conventions

Test code lives under `<backend_test>/<AppName>.Tests/` (default `tests/backend`) —
**never inside `<backend_src>/`**. The `.sln` in `<backend_src>` references the test
project by relative path, so `dotnet test <backend_src>` runs everything.

Test project layout mirrors the layers:
```
<backend_test>/<AppName>.Tests/
├── Domain/               # entity / value-object tests
├── Application/          # service unit tests (mock the Abstractions)
├── Infrastructure/       # repository tests (SQLite in-memory)
└── Integration/          # WebApplicationFactory tests
```

## Naming
- Test methods: `<MethodUnderTest>_<Scenario>_<ExpectedBehavior>`

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

## Test-execution discipline (CI/Ubuntu)

- **The test-engineer runs focused tests only** while iterating:
  ```bash
  dotnet test <backend_test>/<AppName>.Tests/<AppName>.Tests.csproj --filter "FullyQualifiedName~<ClassUnderTest>"
  ```
  The authoritative coverage run belongs to the Test Reviewer's gate (scoped to the
  story's tests, or the whole solution when `full_suite = true`).
- **At most one `dotnet test` in flight against a given project/DB.** Concurrent runs share
  build output, the test database, and ports — producing SQL deadlocks, `database is locked`,
  port-in-use, and net *slowdown*, never a speedup. Run once and let it finish.
- **Reuse binaries only when safe (`--no-build` / `--no-restore`).** After a successful build in
  the same invocation with nothing changed since, you may re-run tests with `--no-build`. Force a
  clean build whenever a `.csproj`, project reference, or package changed — and ALWAYS for the
  Test Reviewer's authoritative coverage run. Never report a pass off stale binaries.
- **Bound every test run so a hang fails fast.** Always pass `--blame-hang-timeout` so a blocking
  test self-terminates and is named, instead of stalling the run forever:
  ```bash
  dotnet test <project> --blame-hang-timeout 120s
  ```
  A run that exceeds the timeout is a **failure to diagnose** (which test stalled, and why) — not
  a slow run to wait out.
- **Never pipe a test run you need to observe through `tail`.** `tail` buffers stdin and flushes
  only at EOF, so a still-running — or hung — `dotnet test ... | tail` shows *nothing*. To see
  which test is executing, use `--logger "console;verbosity=detailed"`.
- **Truncate error output.** When a run emits more than ~30 lines of errors, read only the first
  ~5 distinct errors — repeated errors usually share one root cause. Report truncated excerpts,
  never full stack traces.
- **Cap the inner fix loop at 3.** Stop after 3 consecutive failed fix attempts on the same
  persistent error and report the (truncated) logs to the orchestrator.
