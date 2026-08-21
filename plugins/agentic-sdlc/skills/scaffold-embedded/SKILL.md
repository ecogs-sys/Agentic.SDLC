---
name: scaffold-embedded
description: One-time ESP-IDF project scaffold for a fresh ESP32 firmware app. Used by the Embedded Engineer ONLY when <embedded_root> is empty (the first story of a greenfield embedded run).
---

# Scaffold: ESP-IDF project (ESP32)

Run this ONLY when `<embedded_root>` has no `CMakeLists.txt` / `sdkconfig` yet.
Scaffold the project skeleton once (equivalent to `idf.py create-project` applied
manually so file contents can be reviewed):

- Root `CMakeLists.txt`:
  ```cmake
  cmake_minimum_required(VERSION 3.16)
  include($ENV{IDF_PATH}/tools/cmake/project.cmake)
  project(<project-name>)
  ```
- `sdkconfig.defaults` — target chip `esp32` (unless the tech-spec names a
  different chip) plus any baseline Kconfig options the tech-spec calls for
  (e.g. Wi-Fi, BLE, PSRAM).
- `partitions.csv` — a standard two-OTA-slot table if the tech-spec mentions OTA,
  otherwise the default single-app factory partition table.
- `main/CMakeLists.txt` (`idf_component_register(SRCS "app_main.c" INCLUDE_DIRS
  ".")`) and `main/app_main.c` with a minimal `app_main(void)`.
- `components/` directory, empty until the first story adds one.
- `.gitignore` entries for `build/`, `managed_components/`, `sdkconfig.old` (the
  orchestrator's workspace `.gitignore` already covers these — verify, don't
  duplicate).

Set the target once: `idf.py set-target esp32` (or the tech-spec's chip), which
writes/updates `sdkconfig` from `sdkconfig.defaults`. Follow the
`agentic-sdlc:embedded-conventions` skill for component layout and the
non-negotiable HAL/ISR/error-handling rules from the first component onward.
