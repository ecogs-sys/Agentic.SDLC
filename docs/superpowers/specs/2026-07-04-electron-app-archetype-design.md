# Electron desktop-app archetype for Agentic.SDLC

Date: 2026-07-04
Status: Approved (design) — pending implementation plan
Branch: `feat/electron-app-archetype`

## Problem

The pipeline today produces exactly one kind of application: a .NET backend + React
frontend web app, containerized and closed out with `docker compose up` as the
definition of done. There is no path for a self-contained desktop product.

We want to add first-class support for building an **Electron desktop application**
(pnpm/TypeScript monorepo, node-pty + xterm terminal, electron-vite, electron-builder,
Vitest) through the same agent pipeline, following **industry best-practice Electron
standards** (secure-by-default architecture).

## Decisions (locked with the user)

1. **Standalone application archetype**, not a lane beside dotnet/react. An Electron
   run produces a desktop app *instead of* the .NET+React web app.
2. **One `electron` track** (a single 4-agent quartet) spanning main / preload /
   renderer, rather than splitting main and renderer into separate lanes.
3. **New Packager stage** replaces DevOps for Electron runs: electron-builder +
   electron-updater, plus a reviewer that builds and smoke-launches the app.
4. **Auto-detect + confirm** routing: `/start-run` / Code Surveyor detects Electron
   signals and confirms `app_type` at a gate; greenfield asks explicitly.
5. **Industry best-practice Electron standards** are mandated by the conventions
   skill and enforced by the reviewer (see §D).

## A. Archetype & routing

A run gains an **`app_type`** field in `state.json`: `web` (today's default) or
`electron`. Set at `/start-run`:

- **Brownfield:** the Code Surveyor's detection gains Electron signals — `electron`
  in `package.json` deps, `pnpm-workspace.yaml`, `electron.vite.config.*` — and
  proposes `app_type: electron`, confirmed at the existing triage gate.
- **Greenfield:** `/start-run` asks "web app or Electron desktop app?" only when no
  code exists.

`app_type` gates exactly two things: the **valid track set** the Tech Lead may
assign, and **which final stage** runs (Packager vs DevOps). Everything upstream
(Phase Planner, BA, requirements) is archetype-agnostic and unchanged.

## B. Pipeline mapping

| Stage | Web run (today) | Electron run (new) |
|---|---|---|
| Phase Planner / BA | unchanged | unchanged |
| Architect | .NET+React stack in tech-spec | Electron stack section in tech-spec |
| Tech Lead | tracks: `dotnet`, `react` | track: `electron` |
| Development | dotnet/react quartets | electron quartet |
| Final / done-gate | DevOps → `docker compose up` | Packager → electron-builder + smoke-launch |

## C. The `electron` track (one quartet + conventions skill)

Four new agents mirroring the react quartet's shape:

- **`electron-engineer`** — implements a story across the monorepo
  (`apps/desktop/src/{main,preload,renderer}`, `packages/*`). Gates on
  `pnpm build` / `electron-vite build` exiting 0 with no TS errors. Writes no tests.
- **`electron-reviewer`** — correctness, TypeScript quality, security-defaults
  compliance (§D), and story compliance. Loops back to the engineer on FAIL.
- **`electron-test-engineer`** — Vitest (+ jsdom for renderer) tests covering the
  story's acceptance criteria.
- **`electron-test-reviewer`** — coverage gate, reusing the existing
  `coverage-report` skill (Vitest is already covered there); routes back to test
  engineer or engineer.

Plus **`skills/electron-conventions/SKILL.md`** — the heart of "industry best
standards" (§D).

The Tech Lead assigns every desktop story to the single `electron` track; each story
notes its **process area** (main / preload / renderer / package) so the engineer
knows where the code lands.

### Source paths

Instead of `src/backend` + `src/frontend`, an Electron run works within a pnpm
monorepo. `state.json` records the monorepo root and app package (default
`apps/desktop`). Detection follows the existing source-path detection pattern.

## D. Industry best-practice standards (`electron-conventions` skill)

The conventions skill mandates, and the reviewer enforces:

- **Security defaults (non-negotiable):** `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`, no `@electron/remote`. Renderer talks to main **only**
  through a minimal `contextBridge`-exposed API defined in preload. Strict CSP.
  Navigation and `window.open` allow-lists. Load local content only.
- **Process-boundary placement:** `node-pty` and all Node/OS access live in **main**;
  `xterm` and DOM live in **renderer**; preload is a thin typed bridge. The renderer
  never imports Node built-ins.
- **Typed IPC contracts:** every IPC channel is validated with **zod** schemas in
  `packages/contracts`, shared across main↔renderer. The reviewer rejects
  unvalidated IPC.
- **Monorepo layout:** pnpm workspaces (`apps/desktop`,
  `packages/{contracts,core,keymap,terminal-host}`), ESM (`type: module`)
  throughout, electron-vite for the three build targets (main / preload / renderer).
- **Tooling:** ESLint 8.57 + Prettier 3, Vitest 2.1 + coverage-v8, jsdom for
  renderer tests.

## E. Packager stage (replaces DevOps for Electron runs)

A new pair mirroring the DevOps engineer/reviewer:

- **`electron-packager`** — configures electron-builder (win/mac/linux targets),
  electron-updater wiring, and icon generation (sharp → png-to-ico / icns-lib).
  Emits `electron-builder.yml` + update config + build scripts. Code signing is a
  documented, config-gated step, not hard-required in CI.
- **`electron-packager-reviewer`** — runs `electron-builder --dir` (unpacked build,
  no signing) and smoke-launches the app to confirm it boots; routes failures back
  to packager or electron-engineer, mirroring the DevOps reviewer's routing logic.

**Done-gate for an Electron run:** build succeeds + app smoke-launches + all Vitest
suites green (analogous to the web run's `docker compose up`).

## F. Change inventory

**New (7 files):**
- 6 agents: `electron-engineer`, `electron-reviewer`, `electron-test-engineer`,
  `electron-test-reviewer`, `electron-packager`, `electron-packager-reviewer`.
- 1 skill: `electron-conventions`.
- Optional: a `write-electron-stack` snippet if the Architect needs more than a
  section in `write-tech-spec`.

**Edited (upstream wiring):**
- `skills/write-stories/SKILL.md` — add `electron` to the track set.
- `agents/tech-lead.md` — recognize the `electron` track.
- `commands/advance-stage.md` — dispatch the electron quartet + Packager based on
  `app_type`.
- `skills/write-tech-spec/SKILL.md` — Electron stack section.
- `commands/start-run.md` + `agents/code-surveyor.md` — Electron detection &
  `app_type`.
- `README.md` — docs + workflow diagram.
- `.claude-plugin/plugin.json` — version bump + `CHANGELOG.md` entry (required by
  project CLAUDE.md when opening a PR to master).

## G. YAGNI / out of scope

- **Code signing / notarization in CI** — config-gated and documented, not
  automated (needs real certs/secrets).
- **Auto-update server** — electron-updater is wired, but standing up a release feed
  is a separate concern.
- **Native modules beyond node-pty** — added per-story if a requirement needs them,
  not pre-built.
