# Testing the `embedded` track (ESP-IDF / ESP32) on Linux

Branch: `feat/embedded-track`. This adds a third `app_type` (`embedded`, alongside
`web` and `electron`) for ESP-IDF C/C++ firmware development. It was written and
type/prose-reviewed on Windows without ESP-IDF installed, so none of the actual
`idf.py` command paths have been run for real yet. Test in the order below —
cheapest and highest-risk first — so a wrong assumption is caught before it costs
a full pipeline run.

## 1. Verify the host-target testing mechanism (do this first)

This is the single riskiest unverified assumption in the whole track: that
ESP-IDF's Linux/host target lets you build and run Unity tests **without physical
hardware**. `skills/embedded-testing/SKILL.md` and the "build-only, no hardware"
design decision both depend on this working as described.

```bash
idf.py create-project test_probe && cd test_probe
idf.py --preview set-target linux
idf.py build
./build/test_probe.elf
```

If the flag/target name differs on your installed ESP-IDF version, or the host
target doesn't build cleanly, fix `plugins/agentic-sdlc/skills/embedded-testing/SKILL.md`
(and the matching commands in `agents/embedded-test-engineer.md`,
`agents/embedded-test-reviewer.md`, and the "Embedded coverage" section of
`skills/coverage-report/SKILL.md`) before trusting anything downstream.

## 2. Re-run the existing test suite on Linux

Confirms no OS-specific path assumptions crept in (already green on Windows):

```bash
cd plugins/agentic-sdlc/scripts
node --test sdlc.test.mjs evals.test.mjs
```

## 3. Manually walk the scaffold once

Before judging an agent against it, do `skills/scaffold-embedded/SKILL.md`'s steps
by hand in a scratch directory: `CMakeLists.txt`, `sdkconfig.defaults` (target
`esp32`), `partitions.csv`, `main/app_main.c`. Then:

```bash
idf.py set-target esp32
idf.py build
```

Confirms the scaffold shape the `embedded-engineer` agent will produce is actually
buildable.

## 4. Full pipeline dry run

Only after 1–3 pass. Run `/agentic-sdlc:start-run` with a trivial requirement
(e.g. "blink the onboard LED on a 1s timer, expose a button-press counter over
UART") and pick **embedded** at the archetype prompt. Let it run through BA →
Architect → Tech Lead → development → packaging. Check specifically for:

- `state.json` / `program.json` carry `app_type: "embedded"` and `src_paths.embedded`
- the tech-spec omits `TECH-HEALTH` and docker-compose
- stories are tagged track `embedded` with a component area (driver | app-logic |
  rtos-task | build-config)
- the `embedded-reviewer`'s grep checks (ISR safety, unchecked `esp_err_t`, HAL
  boundary) don't false-positive on real generated code
- the packaging stage ends with a successful `idf.py build` + manual
  `idf.py -p <PORT> flash monitor` instructions — no attempted device access

## 5. Brownfield detection (lower priority)

Point `/agentic-sdlc:start-run` at a throwaway existing ESP-IDF repo (has
`idf_component_register` in a `CMakeLists.txt`, or a root `sdkconfig`) and confirm
it's classified **brownfield** with `app_type: embedded` — not misread as
greenfield or `web`. Exercises the detection heuristic added to `start-run.md`
(Step 3b) and `agents/code-surveyor.md`.

---

Step 1 is the one most likely to need a fix — everything else is prose-branch
plumbing following the same pattern as the existing `electron` track, which
already works in production.
