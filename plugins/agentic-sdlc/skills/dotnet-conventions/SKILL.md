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
