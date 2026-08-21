---
name: coverage-report
description: How to run coverage tooling per language and interpret results against thresholds. Used by .NET Test Reviewer, React Test Reviewer, and Embedded Test Reviewer.
---

# Coverage Report

## .NET coverage

### Run
```bash
dotnet test --collect:"XPlat Code Coverage" --results-directory coverage/
```

### Generate readable summary
Install reportgenerator into a local tool path (`coverage/.tools`) — do NOT install globally with `-g`, that pollutes the user's machine.
```bash
dotnet tool install dotnet-reportgenerator-globaltool --tool-path coverage/.tools 2>/dev/null || true
coverage/.tools/reportgenerator \
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

## Embedded coverage (ESP-IDF host target)

Requires the `lcov` system package (e.g. `apt-get install lcov`) in addition to
the `libbsd-dev` prerequisite from `agentic-sdlc:embedded-testing`.

### Run
Build the host-target test binary with gcov instrumentation, then run it (this
executes the tests and emits `.gcda` coverage data). Each component's `test/` is
its own idf.py project — see `agentic-sdlc:embedded-testing` for that layout.
The gcov-linking flags must be the real CMake variables
(`CMAKE_C_FLAGS`/`CMAKE_CXX_FLAGS`/`CMAKE_EXE_LINKER_FLAGS`) — a plain build
already compiles with `--coverage`, but without `CMAKE_EXE_LINKER_FLAGS` the gcov
runtime isn't linked in and no `.gcda` files are ever written:
```bash
cd <embedded_root>/components/<component-name>/test
idf.py --preview set-target linux
idf.py build -DCMAKE_C_FLAGS="--coverage" -DCMAKE_CXX_FLAGS="--coverage" -DCMAKE_EXE_LINKER_FLAGS="--coverage"
./build/<component-name>_test.elf
```
Let the binary run to its own `exit()` — do not kill it. A killed process never
reaches the gcov `atexit` flush, so `.gcda` silently comes back empty even though
the tests ran and passed (see "Process exit" in `agentic-sdlc:embedded-testing`).

For a full-suite run, repeat across every component's `test/` directory under
`<embedded_root>`.

### Generate readable summary
```bash
lcov --capture --directory build --output-file coverage.info
lcov --summary coverage.info
# optional HTML: genhtml coverage.info --output-directory coverage/report
```

### Reading the output
```
lines......: 85.3% (227 of 266 lines)
functions..: 88.0% (44 of 50 functions)
```

### Thresholds
Default: **80% line coverage**, **90% on critical paths**.
Per-story override: check the story's `coverage_threshold` field.

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
