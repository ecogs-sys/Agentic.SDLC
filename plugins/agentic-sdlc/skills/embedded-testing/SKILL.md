---
name: embedded-testing
description: Project-specific ESP-IDF testing conventions — Unity framework, host-target (no-hardware) test execution, and test-execution discipline. Used by the Embedded Test Engineer and Embedded Test Reviewer.
---

# Embedded Testing (Unity, ESP-IDF host target)

No agent in this pipeline flashes or drives physical hardware. Tests must be
runnable and meaningful **without a device attached** — this works because ESP-IDF
supports building and running a component's tests directly on the host machine
("Linux target") for any logic that sits behind the HAL boundary from
`agentic-sdlc:embedded-conventions`.

## Framework

- **Unity** (bundled with ESP-IDF) is the test framework. Test cases use
  `TEST_CASE("<name>", "[<tag>]")`.
- Tests live in `components/<component-name>/test/`, one `test_*.c`/`test_*.cpp`
  file per area of behavior, plus a `CMakeLists.txt` registering the test component
  (`idf_component_register(SRCS ... PRIV_REQUIRES unity <component-name> ...)`).

## Host-target execution (no hardware, no QEMU)

For components whose logic sits behind the HAL interface (peripheral access
abstracted per embedded-conventions), tests build and run on the host:

```bash
cd <embedded_root>/components/<component-name>/test
idf.py --preview set-target linux
idf.py build
./build/<test-app-binary>          # runs Unity, prints PASS/FAIL per TEST_CASE
```

Peripheral-facing code cannot execute meaningfully on the host target — its HAL
interface is swapped for a fake/mock implementation (a second, test-only
implementation of the same header) so the logic under test still runs. Code that
is genuinely hardware-only (e.g. a raw register dump) is out of scope for
automated tests; note it in the story instead of forcing a fake test around it.

## Coverage

Host-target builds can be compiled with `--coverage` (gcov instrumentation); see
the "Embedded coverage" section of `agentic-sdlc:coverage-report` for the exact
commands and threshold interpretation.

## Criterion tagging (required)

Every `TEST_CASE` name begins with its acceptance-criterion token
`[STORY-XXX/AC-n]`:
```c
TEST_CASE("[STORY-004/AC-2] rejects out-of-range sensor reading", "[sensor]")
```
The eval layer derives its criterion→test bindings from these tokens (see
`agentic-sdlc:write-evals`) — an untagged or unmatched criterion fails the story's
eval gate.

## Process (Test Engineer)

1. Read the story and this skill.
2. Write/extend `components/<component-name>/test/test_*.c(pp)` covering each
   acceptance criterion with at least one `TEST_CASE`, tagged as above. Mock any
   HAL-boundary dependency rather than touching real peripherals.
3. Run the focused test binary for the touched component(s) to confirm they pass
   (per the host-target commands above). Do NOT run every component's test suite —
   that is the Test Reviewer's single authoritative run.
4. Do not modify production (non-test) files.

## Process (Test Reviewer)

1. Read the story and this skill, plus the coverage-report skill's Embedded
   section.
2. Run the test suite with coverage **once**, scoped by the `full_suite` flag
   exactly like every other track (this story's component only vs. every
   component's `test/` under `<embedded_root>`).
3. Compare coverage to the story's `Coverage threshold`. Confirm every `AC-n` has
   a tagged `TEST_CASE`.
4. Route `DONE` / `BACK_TO_TEST_ENGINEER` (test-quality/coverage gap) /
   `BACK_TO_ENGINEER` (a test reveals a genuine production bug) — same decision
   tree as the coverage-report skill's shared decision tree.
