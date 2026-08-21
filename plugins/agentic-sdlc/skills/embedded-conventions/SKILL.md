---
name: embedded-conventions
description: Project-specific ESP-IDF/C++ firmware conventions for ESP32 embedded development. Used by the Embedded Engineer, Reviewer, Test Engineer, Test Reviewer, and Packager.
---

# Embedded Conventions (ESP-IDF, ESP32)

These rules are **mandatory** for every `embedded`-track story. The Embedded
Reviewer rejects any change that violates a "must"/"never" rule below.

## Project layout (ESP-IDF component model)

```
<embedded_root>/
├── CMakeLists.txt              # project() + include($ENV{IDF_PATH}/tools/cmake/project.cmake)
├── sdkconfig.defaults          # target chip + baseline Kconfig options
├── partitions.csv              # partition table (app slot size matters for the packaging gate)
├── main/
│   ├── CMakeLists.txt          # idf_component_register(SRCS ... INCLUDE_DIRS ...)
│   └── app_main.c(pp)          # app_main() entry point — thin, delegates to components
└── components/
    └── <component-name>/
        ├── include/<component-name>/*.h   # public headers (the component's API surface)
        ├── src/*.c(pp)                     # implementation
        ├── CMakeLists.txt                  # idf_component_register(...)
        └── test/                           # Unity host-target tests for this component (see embedded-testing)
```

- Every component exposes its public API only through `include/<component-name>/`.
  Nothing outside a component includes its `src/` headers directly.
- C99 for C, C++17 for C++. Mixed C/C++ components are fine (ESP-IDF supports both);
  keep the public header `extern "C"`-guarded if a C++ component is called from C.
- Never hand-roll a build system — `idf.py` (CMake-based) is the only build path.

## Non-negotiables (the Reviewer FAILs on any violation)

- **Peripheral access goes through a HAL interface, never directly.** A component
  that touches a peripheral (GPIO, UART, I2C, SPI, ADC, timers) exposes its logic
  behind an interface (a header with function pointers, or a small abstract driver
  struct) so the logic can be linked against a fake/mock implementation when built
  for the host-test target. Business/app logic must not call `driver/gpio.h` (etc.)
  directly — it calls the component's own HAL wrapper.
- **No dynamic allocation (`malloc`/`new`) inside an ISR or a `IRAM_ATTR` function.**
  ISRs allocate nothing; use pre-allocated buffers or a queue handoff to a task.
- **No blocking calls inside an ISR** (no `vTaskDelay`, no blocking queue/semaphore
  waits, no logging). ISRs signal a task (queue/semaphore/task-notify) and return.
- **Every ESP-IDF call that returns `esp_err_t` is checked** — either
  `ESP_ERROR_CHECK(...)` (fatal on failure) or an explicit `if (err != ESP_OK)`
  handling path. A discarded `esp_err_t` is a Reviewer FAIL.
- **`app_main()` stays thin.** It initializes NVS/peripherals and starts FreeRTOS
  tasks; it does not contain feature logic itself.

## FreeRTOS task conventions

- Give every task a descriptive name and an explicit stack size and priority — no
  magic numbers without a comment on why that stack size was chosen.
- Inter-task communication uses queues, event groups, or task notifications — never
  shared mutable globals without a mutex.
- Long-running tasks must yield (`vTaskDelay`, blocking on a queue, etc.); a task
  that spins without ever blocking starves lower-priority tasks.

## Logging

Use `ESP_LOGE`/`ESP_LOGW`/`ESP_LOGI`/`ESP_LOGD` with a per-file `static const char
*TAG = "<component>"`. Never `printf` for anything other than a host-test harness.

## Tooling

- **Build:** `idf.py build`. The engineer's build gate is `idf.py build` exiting 0
  with no errors (default target `esp32` unless the tech-spec names a different
  chip — set via `idf.py set-target <chip>` once, recorded in `sdkconfig.defaults`).
- **Lint/format:** `clang-format` (project `.clang-format`, if absent use a default
  ESP-IDF-compatible style). Code must be format-clean.
- **Tests:** see the `agentic-sdlc:embedded-testing` skill — Unity framework via
  ESP-IDF's Linux/host target, no physical hardware or QEMU required.
- **Criterion tagging (required):** every test case name embeds its acceptance-
  criterion token `[STORY-XXX/AC-n]`, e.g. `TEST_CASE("[STORY-004/AC-2] rejects
  invalid sensor reading", "[component]")`. The eval layer derives its
  criterion→test bindings from these tokens (`agentic-sdlc:write-evals`); a story's
  eval gate fails if any criterion has no tagged test.

## Build & test execution discipline

Run the build/test suite **once per change** — never launch two `idf.py build`/test
runs against the same `<embedded_root>` concurrently (they share the `build/`
directory and can corrupt each other's output). Engineers build only; the Test
Engineer runs focused host-target tests; the Test Reviewer owns the one
authoritative full-suite run.

## Detection (brownfield / existing project)

An existing ESP-IDF project is identified by any of: an `idf_component.yml`, a
`CMakeLists.txt` containing `idf_component_register`, or a root `sdkconfig`. When
present, **reuse** the existing component layout, naming, and target chip — do not
re-scaffold.
