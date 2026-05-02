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
