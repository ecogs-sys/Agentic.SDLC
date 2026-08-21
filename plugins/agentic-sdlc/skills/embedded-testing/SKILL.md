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
- `idf.py build` only works from a project root (a `CMakeLists.txt` that calls
  `project()`) — a bare component-style `CMakeLists.txt` is not enough, `idf.py`
  will fail trying to configure it as a project. So each component's test
  directory is itself a **separate, self-contained idf.py project**, not just a
  folder of test files:
  ```
  components/<component-name>/test/
    CMakeLists.txt          # project root: project(<component-name>_test) +
                             # EXTRA_COMPONENT_DIRS pointing at the component being tested
    main/
      CMakeLists.txt         # idf_component_register(SRCS ... PRIV_REQUIRES unity <component-name>)
      test_runner_main.c     # one-time boilerplate: UNITY_BEGIN/unity_run_all_tests/UNITY_END, see below
      test_*.c / test_*.cpp  # one file per area of behavior — these are what the Test Engineer writes/extends
  ```
  `test/CMakeLists.txt` (written once, when the component's test project doesn't
  exist yet):
  ```cmake
  cmake_minimum_required(VERSION 3.16)
  set(EXTRA_COMPONENT_DIRS "${CMAKE_CURRENT_LIST_DIR}/..")
  include($ENV{IDF_PATH}/tools/cmake/project.cmake)
  project(<component-name>_test)
  ```
  `test/main/test_runner_main.c` (written once; do not add `TEST_CASE`s here):
  ```c
  #include <stdlib.h>
  #include "unity.h"

  void app_main(void)
  {
      UNITY_BEGIN();
      unity_run_all_tests();
      int failures = UNITY_END();
      exit(failures);   // required — see "Process exit" below
  }
  ```

## Host-target execution (no hardware, no QEMU)

For components whose logic sits behind the HAL interface (peripheral access
abstracted per embedded-conventions), tests build and run on the host:

```bash
cd <embedded_root>/components/<component-name>/test
idf.py --preview set-target linux
idf.py build
./build/<component-name>_test.elf   # runs Unity, prints PASS/FAIL per TEST_CASE
```

The Linux target's `sys/cdefs.h` needs the `libbsd-dev` system package (e.g.
`apt-get install libbsd-dev` on Debian/Ubuntu) — without it, `idf.py build` fails
on every component with `bsd/sys/cdefs.h: No such file or directory`. This is a
one-time host machine setup, not a per-project step.

Peripheral-facing code cannot execute meaningfully on the host target — its HAL
interface is swapped for a fake/mock implementation (a second, test-only
implementation of the same header) so the logic under test still runs. Code that
is genuinely hardware-only (e.g. a raw register dump) is out of scope for
automated tests; note it in the story instead of forcing a fake test around it.

## Process exit (required, not optional)

After `UNITY_END()`, the FreeRTOS scheduler keeps running (the process does not
exit on its own) — `test_runner_main.c`'s explicit `exit(failures)` is what
terminates it. Do not run the test binary under a hard kill/timeout instead of
letting it exit itself: a killed process never reaches `exit()`, so gcov's
`atexit` flush never fires and coverage silently comes back empty (0 `.gcda`
files) even though the tests genuinely ran and passed. Always use the binary's
own exit code — 0 (all tests passed) or the failure count (nonzero) — never a
forced kill, to judge PASS/FAIL.

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
2. If `components/<component-name>/test/` doesn't exist yet, scaffold it once:
   `test/CMakeLists.txt` and `test/main/CMakeLists.txt` + `test_runner_main.c` as
   shown above. Do not touch `test_runner_main.c` on later stories for the same
   component.
3. Write/extend `components/<component-name>/test/main/test_*.c(pp)` covering
   each acceptance criterion with at least one `TEST_CASE`, tagged as above. Mock
   any HAL-boundary dependency rather than touching real peripherals.
4. Run the focused test binary for the touched component(s) to confirm they pass
   (per the host-target commands above). Do NOT run every component's test suite —
   that is the Test Reviewer's single authoritative run.
5. Do not modify production (non-test) files.

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
