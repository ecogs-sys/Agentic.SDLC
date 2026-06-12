---
name: dotnet-conventions
description: Project-specific .NET coding conventions. Used by .NET Engineer, Reviewer, Test Engineer, and Test Reviewer.
---

# .NET Conventions

## Architecture: Clean Architecture (mandatory)

The backend follows Clean Architecture as **four projects**. **Source-code dependencies point
only inward** — `Domain` depends on nothing; `Api` is the outermost composition root.

```
<backend_src>/
├── <AppName>.sln
├── <AppName>.Domain/         # refs: none
│   ├── Entities/             # domain entities (POCOs — no EF attributes required)
│   └── ValueObjects/         # value objects, domain enums/exceptions
├── <AppName>.Application/     # refs: Domain
│   ├── Abstractions/         # IFooRepository.cs, IFooService.cs (interfaces only)
│   ├── Services/             # FooService.cs — use-case logic
│   └── Models/               # FooRequest.cs, FooResponse.cs (DTOs)
├── <AppName>.Infrastructure/  # refs: Application (+ Domain)
│   ├── Data/                 # AppDbContext.cs + EF Core migrations
│   └── Repositories/         # FooRepository.cs — implements Application interfaces
├── <AppName>.Api/            # refs: Application + Infrastructure
│   ├── Controllers/          # One controller per resource — depends on Application interfaces
│   ├── Program.cs            # Entry point + DI composition root + /health
│   └── appsettings.json
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

## Error handling
- Use `ProblemDetails` for API error responses (ASP.NET Core default).
- `404 NotFound()` for missing resources, `400 BadRequest()` for validation, `500` for unhandled.

## Required: `/health` endpoint
Every backend MUST expose `GET /health` that returns HTTP 200 with `{"status":"ok"}`. This is what the docker-compose readiness check and the DevOps reviewer's smoke test hit. Implement it in `Program.cs` using `app.MapGet("/health", () => Results.Ok(new { status = "ok" }))` or as a `HealthController`. Do not require auth or a DB connection for this endpoint — it must succeed even before DB migrations run.

## Commands
```bash
dotnet build          # Expected: Build succeeded.
dotnet test           # Expected: All tests pass.
```
