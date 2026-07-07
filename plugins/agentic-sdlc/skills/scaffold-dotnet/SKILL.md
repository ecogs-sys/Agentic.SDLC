---
name: scaffold-dotnet
description: One-time Clean Architecture solution scaffold for a fresh .NET backend. Used by the .NET Engineer ONLY when <backend_src> is empty (the first story of a greenfield run).
---

# Scaffold: .NET Clean Architecture solution

Run this ONLY when `<backend_src>` has no `.sln`/`.csproj` yet. Scaffold four
source projects under `<backend_src>` plus one test project under `<backend_test>`.
**The test project goes in `<backend_test>`, never under `<backend_src>`** (the
`.sln` stays in `<backend_src>` and references it by relative path). Use `.sln`
(the default classic format) consistently — do NOT mix `.sln` and `.slnx`. The
reference wiring enforces the inward dependency rule
(Domain ← Application ← Infrastructure ← Api):

```bash
dotnet new sln -n AppName -o <backend_src>

# Source projects (inner → outer) — all under <backend_src>
dotnet new classlib -n AppName.Domain        -o <backend_src>/AppName.Domain
dotnet new classlib -n AppName.Application    -o <backend_src>/AppName.Application
dotnet new classlib -n AppName.Infrastructure -o <backend_src>/AppName.Infrastructure
dotnet new webapi   -n AppName.Api --use-minimal-apis false -o <backend_src>/AppName.Api

# Test project — under <backend_test> (NOT under <backend_src>)
dotnet new xunit    -n AppName.Tests          -o <backend_test>/AppName.Tests

# Add all projects to the solution (the .sln lives in <backend_src>;
# dotnet records relative paths, so the test project resolves to ../../<backend_test>/...)
dotnet sln <backend_src>/AppName.sln add <backend_src>/AppName.Domain/AppName.Domain.csproj
dotnet sln <backend_src>/AppName.sln add <backend_src>/AppName.Application/AppName.Application.csproj
dotnet sln <backend_src>/AppName.sln add <backend_src>/AppName.Infrastructure/AppName.Infrastructure.csproj
dotnet sln <backend_src>/AppName.sln add <backend_src>/AppName.Api/AppName.Api.csproj
dotnet sln <backend_src>/AppName.sln add <backend_test>/AppName.Tests/AppName.Tests.csproj

# Dependency rule: references point only inward
dotnet add <backend_src>/AppName.Application/AppName.Application.csproj       reference <backend_src>/AppName.Domain/AppName.Domain.csproj
dotnet add <backend_src>/AppName.Infrastructure/AppName.Infrastructure.csproj reference <backend_src>/AppName.Application/AppName.Application.csproj
dotnet add <backend_src>/AppName.Api/AppName.Api.csproj                       reference <backend_src>/AppName.Application/AppName.Application.csproj
dotnet add <backend_src>/AppName.Api/AppName.Api.csproj                       reference <backend_src>/AppName.Infrastructure/AppName.Infrastructure.csproj

# Tests reference the layers under test (cross-tree project references are fine)
dotnet add <backend_test>/AppName.Tests/AppName.Tests.csproj reference <backend_src>/AppName.Api/AppName.Api.csproj
dotnet add <backend_test>/AppName.Tests/AppName.Tests.csproj reference <backend_src>/AppName.Application/AppName.Application.csproj
dotnet add <backend_test>/AppName.Tests/AppName.Tests.csproj reference <backend_src>/AppName.Infrastructure/AppName.Infrastructure.csproj
dotnet add <backend_test>/AppName.Tests/AppName.Tests.csproj package Moq

# EF Core lives only in Infrastructure
dotnet add <backend_src>/AppName.Infrastructure/AppName.Infrastructure.csproj package Microsoft.EntityFrameworkCore
```

Replace `AppName` with a name derived from the project in tech-spec (e.g.
`TodoApp`). Do NOT add a reference from Domain or Application to Infrastructure or
Api — that breaks the dependency rule.

**Also add the mandatory `/health` endpoint** in `Program.cs` (Api layer — see
dotnet-conventions, "Required: /health endpoint"). It is required by the DevOps
smoke test and is not part of any user story.
