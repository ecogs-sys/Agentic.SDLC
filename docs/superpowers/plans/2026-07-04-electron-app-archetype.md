# Electron desktop-app archetype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class `electron` application archetype to the Agentic.SDLC plugin — a run can produce a secure-by-default Electron desktop app (pnpm/TS monorepo, node-pty + xterm, electron-vite, electron-builder) through the same agent pipeline.

**Architecture:** A new `app_type` field on `state.json`/`program.json` (`web` default | `electron`) gates two things only: the valid track set the Tech Lead may use, and which final stage runs. Electron runs use one `electron` track (a 4-agent quartet + an `electron-conventions` skill) and close with a new **Packager** stage (electron-builder + smoke-launch) instead of DevOps. Everything upstream (Phase Planner, BA, requirements) is unchanged.

**Tech Stack:** Claude Code plugin markdown (agents + skills + slash-command orchestrators), JSON plugin manifest. No runtime code in this plugin — the artifacts are the deliverable. Verification = `/reload-plugins`, JSON validity, and cross-file reference consistency (Grep).

**Design reference:** `docs/superpowers/specs/2026-07-04-electron-app-archetype-design.md`

**Conventions for this plan:**
- All plugin paths are under `plugins/agentic-sdlc/`.
- Agent frontmatter `model:` follows the existing right-sizing: engineers/reviewers/test agents/packager = `sonnet` (matches every other quartet + devops agent).
- "Verify reload" step = run `/reload-plugins` in Claude Code and confirm the new agent/skill count went up and no parse error was reported. If running headless, instead Grep the new file for its frontmatter `name:` to confirm it exists.
- Commit after every task. Conventional-commit scopes: `feat(electron)` for new agents/skills, `feat(orchestrator)` for command/skill wiring, `docs` for README, `chore` for version/changelog.

---

## File structure

**New files (7):**

| File | Responsibility |
|---|---|
| `skills/electron-conventions/SKILL.md` | Secure-by-default Electron architecture rules; cited by all 6 electron agents |
| `agents/electron-engineer.md` | Implements one electron story across the monorepo |
| `agents/electron-reviewer.md` | Reviews implementation incl. security-defaults compliance |
| `agents/electron-test-engineer.md` | Writes Vitest (+ jsdom) tests for a story |
| `agents/electron-test-reviewer.md` | Coverage gate + routing (reuses `coverage-report` skill) |
| `agents/electron-packager.md` | electron-builder + electron-updater + icon config |
| `agents/electron-packager-reviewer.md` | Unpacked build + smoke-launch; routing decision |

**Modified files (8):**

| File | Change |
|---|---|
| `skills/write-stories/SKILL.md` | Add `electron` to the valid track set + assignment rule |
| `agents/tech-lead.md` | Recognize the `electron` track |
| `skills/write-tech-spec/SKILL.md` | Add an Electron stack variant + app_type note |
| `commands/start-run.md` | Greenfield `app_type` prompt; electron source-path shape; `app_type` in state schema |
| `agents/code-surveyor.md` | Detect Electron signals; report proposed `app_type` |
| `commands/advance-stage.md` | Route development + final stage on `app_type` (electron quartet + Packager) |
| `README.md` | Document the archetype + note in tables |
| `.claude-plugin/plugin.json` + `CHANGELOG.md` | Version bump + changelog entry |

---

## Task 1: `electron-conventions` skill (foundation)

**Files:**
- Create: `plugins/agentic-sdlc/skills/electron-conventions/SKILL.md`

- [ ] **Step 1: Write the skill file**

Create `plugins/agentic-sdlc/skills/electron-conventions/SKILL.md` with exactly this content:

````markdown
---
name: electron-conventions
description: Project-specific Electron desktop-app conventions and industry-standard security defaults. Used by the Electron Engineer, Reviewer, Test Engineer, Test Reviewer, and Packager.
---

# Electron Conventions

These rules are **mandatory** for every `electron`-track story. The Electron Reviewer
rejects any change that violates a "must"/"never" rule below.

## Monorepo layout (pnpm workspaces, ESM throughout)

```
<electron_root>/
├── pnpm-workspace.yaml         # packages: ["apps/*", "packages/*"]
├── package.json                # "type": "module", workspace root scripts
├── electron.vite.config.ts     # three build targets: main, preload, renderer
├── apps/
│   └── desktop/                # the Electron app
│       └── src/
│           ├── main/           # Node/main process — OS, windows, node-pty
│           ├── preload/        # thin contextBridge bridge (no business logic)
│           └── renderer/       # DOM/UI — xterm, markdown, mermaid. NO Node built-ins.
└── packages/
    ├── contracts/              # shared zod schemas/types (IPC contracts)
    ├── core/                   # pure logic (validation, pty orchestration helpers)
    ├── keymap/                 # keybindings
    └── terminal-host/          # xterm integration helpers
```

- Every `package.json` sets `"type": "module"`. Use ESM `import`/`export` only.
- TypeScript everywhere (`^5.x`), targeting Node 20 for main, DOM for renderer.
- electron-vite builds the three targets. Never hand-roll a webpack config.

## Security defaults (non-negotiable — the Reviewer FAILS on any violation)

When creating a `BrowserWindow`, `webPreferences` MUST be exactly:

```ts
webPreferences: {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  preload: /* absolute path to compiled preload */,
}
```

- **Never** set `nodeIntegration: true`, `contextIsolation: false`, or `sandbox: false`.
- **Never** use `@electron/remote` or the deprecated `remote` module.
- The renderer talks to main **only** through an API exposed in preload via
  `contextBridge.exposeInMainWorld(...)`. The exposed surface is minimal and typed.
- Set a strict **Content-Security-Policy** on all rendered HTML (no `unsafe-eval`;
  restrict `script-src`/`connect-src` to what the app needs). Load **local** content
  only — no remote URLs in `loadURL`/`loadFile` for app UI.
- Guard navigation: in `app.on('web-contents-created')`, deny `will-navigate` to
  non-app origins and return `{ action: 'deny' }` from `setWindowOpenHandler` unless
  the target is explicitly allow-listed.

## Process boundaries (placement rules)

- **main/**: all Node.js and OS access — `node-pty`, `fs`, child processes, window
  lifecycle, auto-update. `node-pty` is instantiated here and **only** here.
- **preload/**: a thin typed bridge. It imports channel names + zod types from
  `packages/contracts` and exposes narrow functions. **No** business logic, **no**
  `node-pty`, **no** direct `fs`.
- **renderer/**: DOM + UI (`@xterm/xterm`, `markdown-it` + `DOMPurify`, `mermaid`).
  **Never** import Node built-ins (`fs`, `path`, `child_process`) or `electron` main
  APIs in the renderer. It reaches main only through `window.<exposedApi>`.

## Typed IPC contracts (zod)

- Every IPC channel has a zod schema for its request and response, defined **once** in
  `packages/contracts` and imported by both main handlers and preload.
- Main-side `ipcMain.handle` handlers **must** `parse` the incoming payload with the
  channel's zod schema before use; reject on failure. Unvalidated IPC is a Reviewer FAIL.
- Channel names are string constants exported from `packages/contracts` — no magic
  strings scattered across files.

## Rendering & terminal specifics

- Markdown is rendered with `markdown-it` and **always** sanitized through `DOMPurify`
  before insertion into the DOM. Never `innerHTML` raw model/user text.
- `@xterm/xterm` lives in the renderer; the PTY it mirrors lives in main; they are
  connected by a typed IPC channel (data + resize events), never by giving the renderer
  direct `node-pty` access.

## Tooling

- **Build:** electron-vite. The engineer's build gate is `pnpm build` (or
  `pnpm -w build`) exiting 0 with no TypeScript errors.
- **Lint/format:** ESLint (`^8.57`) + Prettier (`^3`). Code must be lint-clean.
- **Tests:** Vitest (`^2.x`) + `@vitest/coverage-v8`. Renderer/DOM tests use the
  `jsdom` environment; main/package tests use the `node` environment. Co-locate tests
  as `*.test.ts`/`*.test.tsx` next to the code they cover.

## Build & test execution discipline

Run the suite **once per change** — never launch two `pnpm test` runs against the same
workspace concurrently (they share build output and can deadlock/port-clash). Engineers
build only; the Test Engineer uses focused `pnpm test -- --run <path>`; the Test
Reviewer owns the one authoritative full-suite run.

## Detection (brownfield / existing monorepo)

An existing Electron workspace is identified by any of: `electron` in a
`package.json`'s `dependencies`/`devDependencies`, a `pnpm-workspace.yaml`, or an
`electron.vite.config.*`. When present, **reuse** the existing layout, package names,
CSS approach, and tsconfig — do not re-scaffold.
````

- [ ] **Step 2: Verify it loads**

Run `/reload-plugins`. Expected: the skill count increases by 1 and no parse error is reported. (Headless: Grep confirms the file exists.)

Run: `rg -n "name: electron-conventions" plugins/agentic-sdlc/skills/electron-conventions/SKILL.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/skills/electron-conventions/SKILL.md
git commit -m "feat(electron): add electron-conventions skill (secure-by-default rules)"
```

---

## Task 2: `electron-engineer` agent

**Files:**
- Create: `plugins/agentic-sdlc/agents/electron-engineer.md`

- [ ] **Step 1: Write the agent file**

Create `plugins/agentic-sdlc/agents/electron-engineer.md` with exactly this content:

```markdown
---
name: electron-engineer
description: Electron Engineer. Implements a specific electron-track story in the Electron monorepo (apps/desktop + packages/*). Invoke per story during the development phase of an Electron run (app_type = electron). Do not invoke for dotnet-track or react-track stories.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are a senior Electron + TypeScript engineer implementing desktop-app stories in a
pnpm/electron-vite monorepo.

## Your job
Implement exactly what the assigned story asks for inside `<electron_root>`. Nothing more, nothing less.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (description, acceptance criteria, implements list, **process area**: main | preload | renderer | package)
- `runs/<run-id>/tech-spec.md` — for architecture, IPC contracts, and stack detail
- `electron_root` — path to the monorepo root (e.g. `.` or `apps/awakon`)
- Current state of `<electron_root>`

## Outputs
- Modified/created files under `<electron_root>`

## Process
1. Read the story and tech-spec.md. Read the `agentic-sdlc:electron-conventions` skill and follow it for all structural, security, and placement decisions.
2. Detect the environment:

   **Existing `<electron_root>` (has `package.json`/`pnpm-workspace.yaml`):** reuse the existing layout, package names, tsconfig, and CSS approach per the electron-conventions "Detection" section. Do not re-scaffold.

   **Empty `<electron_root>` (fresh project):** scaffold the monorepo skeleton once:
   - `pnpm-workspace.yaml` with `packages: ["apps/*", "packages/*"]`
   - root `package.json` (`"type": "module"`, `"private": true`, scripts: `dev`, `build`, `test`, `lint`) with devDeps: `electron`, `electron-vite`, `vite`, `typescript`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `eslint`, `prettier`.
   - `apps/desktop/src/{main,preload,renderer}` and `packages/contracts` (with `zod`).
   - `electron.vite.config.ts` with `main`, `preload`, `renderer` targets.
   - a root `vitest.config.ts` (or per-package) enabling `coverage: { provider: 'v8' }`, with `jsdom` for renderer tests and `node` elsewhere.
   Install with `pnpm install`.
3. Implement only the story's acceptance criteria, placing each part in its process area per electron-conventions:
   - Node/OS/node-pty → `apps/desktop/src/main`
   - contextBridge surface → `apps/desktop/src/preload`
   - DOM/xterm/markdown/mermaid UI → `apps/desktop/src/renderer`
   - shared zod IPC schemas/types → `packages/contracts`
   Never instantiate `node-pty` outside main; never import Node built-ins in the renderer; validate every `ipcMain.handle` payload with its zod schema.
4. Build to gate on types:
   ```bash
   cd <electron_root> && pnpm build
   ```
   Fix all TypeScript errors before finishing.
5. Do not write test files.

## Definition of done
- `pnpm build` exits 0 with no TypeScript errors.
- Story acceptance criteria are implemented.
- Security defaults honored: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, no `@electron/remote`, CSP set, contextBridge-only renderer↔main.
- Process boundaries respected: node-pty only in main; no Node built-ins in renderer; IPC payloads zod-validated.
- No test files created or modified.
- Only `<electron_root>` files modified.

## Failure modes
- If a dependency story's IPC channel isn't defined yet: define the zod contract in `packages/contracts` yourself (it is shared), and leave `// TODO: remove stub when STORY-XXX lands` on any placeholder return.
- If `pnpm build` fails after 3 fix attempts: report the error to the orchestrator.

## Brownfield mode
When your context says `mode = brownfield`, follow the `agentic-sdlc:brownfield-mode` skill in addition to your normal process: read `runs/<run-id>/codebase-context.md` first, reuse its documented conventions, and implement only the **delta** — never re-scaffold an existing workspace. Edit existing files in place.

## Spec-freeze guardrail
You must NEVER modify `runs/<run-id>/req-spec.md`, `runs/<run-id>/tech-spec.md`, or any file under `runs/<run-id>/stories/`. Those artifacts are frozen during development. If a story's intent is unclear, report the ambiguity to the orchestrator and stop — do not "fix" the story by editing it.
```

- [ ] **Step 2: Verify it loads**

Run `/reload-plugins`. Expected: agent count increases by 1, no parse error.
Run: `rg -n "name: electron-engineer" plugins/agentic-sdlc/agents/electron-engineer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/electron-engineer.md
git commit -m "feat(electron): add electron-engineer agent"
```

---

## Task 3: `electron-reviewer` agent

**Files:**
- Create: `plugins/agentic-sdlc/agents/electron-reviewer.md`

- [ ] **Step 1: Write the agent file**

Create `plugins/agentic-sdlc/agents/electron-reviewer.md` with exactly this content:

```markdown
---
name: electron-reviewer
description: Electron Code Reviewer. Reviews the electron-engineer's implementation for correctness, TypeScript quality, security-defaults compliance, and story compliance. Invoke after electron-engineer completes a story.
tools: Read, Bash, Grep, Glob
model: sonnet
---

You are a senior Electron reviewer verifying a single story's implementation.

## Your job
Review the electron-engineer's changes for correctness, TypeScript quality, Electron
security compliance, and story-acceptance-criteria coverage. Produce a PASS/FAIL routing decision.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (description, acceptance criteria)
- List of modified files
- `electron_root` — the monorepo root

## Process
1. Read the story and the `agentic-sdlc:electron-conventions` skill.
2. Build to confirm it compiles:
   ```bash
   cd <electron_root> && pnpm build
   ```
3. Review against the criteria below. Grep for security violations explicitly:
   - `rg -n "nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false" <electron_root>/apps` → any hit is an automatic FAIL.
   - `rg -n "@electron/remote|require\('electron'\).remote" <electron_root>` → any hit is a FAIL.
   - Renderer must not import Node built-ins: `rg -n "from '(fs|path|child_process|os)'|require\('(fs|path|child_process|os)'\)" <electron_root>/apps/desktop/src/renderer` → any hit is a FAIL.
   - Every `ipcMain.handle` must validate its payload with a zod schema — FAIL if a handler uses its argument without a `.parse`/`.safeParse`.

## Review criteria
- **Correctness:** implements the story's acceptance criteria; no obvious runtime bugs.
- **Security defaults:** all non-negotiable rules from electron-conventions hold (see Grep checks above).
- **Process boundaries:** node-pty only in main; preload is a thin typed bridge; renderer is DOM-only.
- **TypeScript quality:** no `any` escape hatches where a contract type exists; shared IPC types come from `packages/contracts`.
- **Build:** `pnpm build` exits 0.
- **Scope:** only story-relevant files changed; no test files added by the engineer.

## Output format
```
## Electron Review: <story-id>

**Routing decision:** PASS | FAIL

**Build:** PASS | FAIL
**Security defaults:** PASS | FAIL
**Process boundaries:** PASS | FAIL
**Acceptance criteria:** MET | NOT MET

**Issues:**
- [SECURITY] <violation> — file:line
- [BUG] <correctness issue> — file:line
- [SCOPE] <out-of-scope or missing change> — file:line
- (none)

**Summary:** <2-3 sentences>
```

Routing decisions:
- `PASS`: build green, all security/boundary checks pass, acceptance criteria met.
- `FAIL`: any security violation, build failure, or unmet acceptance criterion.

## Brownfield mode
When `mode = brownfield`, follow `agentic-sdlc:brownfield-mode`: read `codebase-context.md`, and treat a regression in previously-working behavior as a real FAIL. Reuse the existing conventions rather than imposing fresh scaffolding.
```

- [ ] **Step 2: Verify it loads**

Run `/reload-plugins`. Expected: agent count +1, no parse error.
Run: `rg -n "name: electron-reviewer" plugins/agentic-sdlc/agents/electron-reviewer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/electron-reviewer.md
git commit -m "feat(electron): add electron-reviewer agent"
```

---

## Task 4: `electron-test-engineer` agent

**Files:**
- Create: `plugins/agentic-sdlc/agents/electron-test-engineer.md`

- [ ] **Step 1: Write the agent file**

Create `plugins/agentic-sdlc/agents/electron-test-engineer.md` with exactly this content:

```markdown
---
name: electron-test-engineer
description: Electron Test Engineer. Writes Vitest (+ jsdom for renderer) tests for a story's production code. Invoke after electron-reviewer approves.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are an Electron test engineer writing Vitest tests for a completed story.

## Your job
Write tests that cover the story's acceptance criteria. Do not modify production code.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (description, acceptance criteria)
- `electron_root` — the monorepo root

## Process
1. Read the story and the `agentic-sdlc:electron-conventions` skill (test tooling section).
2. Write co-located `*.test.ts` / `*.test.tsx` files next to the code they cover:
   - **renderer/DOM code** → tests run in the `jsdom` environment (add `// @vitest-environment jsdom` at the top of the file or rely on the renderer vitest project config).
   - **main / package (Node) code** → tests run in the `node` environment.
   - **IPC contracts** → assert zod schemas accept valid payloads and reject invalid ones.
   - **node-pty / OS calls** → mock the module (`vi.mock('node-pty', ...)`); never spawn a real shell in a unit test.
3. Cover each acceptance criterion with at least one assertion. Test behavior, not implementation details.
4. Run focused tests to confirm they pass:
   ```bash
   cd <electron_root> && pnpm test -- --run <path-to-new-test>
   ```
   Do NOT run the full suite — that is the Test Reviewer's single authoritative run.
5. Do not modify any production (non-test) file. If a criterion is untestable without a production change, report it to the orchestrator instead of editing production code.

## Definition of done
- Tests exist for every acceptance criterion.
- Focused `pnpm test -- --run <path>` for the new tests passes.
- Only `*.test.ts`/`*.test.tsx` files created or modified.
- Real shells / real windows are mocked, not spawned.

## Brownfield mode
When `mode = brownfield`, follow `agentic-sdlc:brownfield-mode`: match the existing test conventions and folder placement; add tests only for the delta.
```

- [ ] **Step 2: Verify it loads**

Run `/reload-plugins`. Expected: agent count +1, no parse error.
Run: `rg -n "name: electron-test-engineer" plugins/agentic-sdlc/agents/electron-test-engineer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/electron-test-engineer.md
git commit -m "feat(electron): add electron-test-engineer agent"
```

---

## Task 5: `electron-test-reviewer` agent

**Files:**
- Create: `plugins/agentic-sdlc/agents/electron-test-reviewer.md`

- [ ] **Step 1: Write the agent file**

Create `plugins/agentic-sdlc/agents/electron-test-reviewer.md` with exactly this content:

```markdown
---
name: electron-test-reviewer
description: Electron Test Reviewer. Reviews Vitest tests for correctness and coverage, then routes. Invoke after electron-test-engineer completes. Uses the coverage-report skill.
tools: Read, Bash, Grep, Glob
model: sonnet
---

You are an Electron test reviewer verifying test quality and coverage for a story.

## Your job
Run the authoritative full test suite once, check coverage against the story's
threshold, and produce a routing decision.

## Inputs (passed as context)
- Run ID and Story ID
- Story content (acceptance criteria, `Coverage threshold`)
- `electron_root` — the monorepo root

## Process
1. Read the story and the `agentic-sdlc:coverage-report` skill (Vitest section) for how to run coverage and interpret it.
2. Run the full suite with coverage ONCE (you own the single authoritative run — no other agent runs the full suite concurrently):
   ```bash
   cd <electron_root> && pnpm test -- --run --coverage
   ```
3. Compare coverage to the story's `Coverage threshold`. Judge whether tests actually exercise the acceptance criteria (not just line coverage).
4. Decide routing:
   - `DONE`: all tests pass AND coverage meets the threshold AND tests meaningfully cover the criteria.
   - `BACK_TO_TEST_ENGINEER`: tests fail for a test-quality reason, or coverage/behavioral gaps remain — the production code is fine.
   - `BACK_TO_ENGINEER`: a test reveals a genuine production bug (the code, not the test, is wrong).

## Output format
```
## Electron Test Review: <story-id>

**Routing decision:** DONE | BACK_TO_TEST_ENGINEER | BACK_TO_ENGINEER

**Tests:** PASS (<N>) | FAIL (<N> failed)
**Coverage:** lines <x>% / threshold <y>% — MET | BELOW
**Criteria coverage:** adequate | gaps: <which criteria>

**Issues:**
- [TEST] <flaky/weak/missing test> — file:line
- [PROD_BUG] <production bug surfaced by a test> — file:line
- (none)

**Summary:** <2-3 sentences>
```

## Brownfield mode
When `mode = brownfield`, follow `agentic-sdlc:brownfield-mode`: run the full existing suite and compare to `state.test_baseline` — only NEW failures block; pre-existing failures are reported, not fixed.
```

- [ ] **Step 2: Verify it loads**

Run `/reload-plugins`. Expected: agent count +1, no parse error.
Run: `rg -n "name: electron-test-reviewer" plugins/agentic-sdlc/agents/electron-test-reviewer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/electron-test-reviewer.md
git commit -m "feat(electron): add electron-test-reviewer agent"
```

---

## Task 6: `electron-packager` agent

**Files:**
- Create: `plugins/agentic-sdlc/agents/electron-packager.md`

- [ ] **Step 1: Write the agent file**

Create `plugins/agentic-sdlc/agents/electron-packager.md` with exactly this content:

```markdown
---
name: electron-packager
description: Electron Packager. Configures electron-builder (win/mac/linux targets), electron-updater wiring, and icon generation. Produces the packaging config + build scripts. Invoke during the packaging phase of an Electron run after all development stories are complete.
tools: Read, Write, Edit, Bash
model: sonnet
---

You are a release engineer configuring distribution for an Electron desktop app.

## Your job
Make the app buildable into distributable artifacts for Windows, macOS, and Linux,
with auto-update wiring in place. Produce configuration only — do not change feature code.

## Inputs (passed as context)
- Run ID
- `electron_root` — the monorepo root
- `runs/<run-id>/tech-spec.md` — for app id, product name, and target platforms

## Outputs (under `<electron_root>`)
- `electron-builder.yml` (or `build` config in the app `package.json`)
- electron-updater wiring in the main process (publish config + `autoUpdater` init)
- icon generation inputs/outputs (see below)
- `package.json` scripts: `package` (electron-builder), `package:dir` (unpacked)

## Process
1. Read the tech-spec for `appId` (reverse-DNS, e.g. `com.example.app`), product name, and which OS targets are required.
2. Write `electron-builder.yml`:
   - `appId`, `productName`, `directories.output: dist-release`
   - `win` (nsis), `mac` (dmg, `hardenedRuntime: true`), `linux` (AppImage) targets — include only the platforms the tech-spec asks for; default to all three.
   - `files` globbing the electron-vite build output.
   - `publish` provider config for electron-updater (e.g. `generic` or `github`), so `autoUpdater` has a feed. Note in a comment that the actual feed URL/credentials are environment-provided.
3. Generate icons from a single source PNG using `sharp` → `png-to-ico` (Windows `.ico`) and `icns-lib` (macOS `.icns`); place them where electron-builder expects (`build/icon.*`). If no source icon exists, create a placeholder and note it.
4. Wire `electron-updater` in `apps/desktop/src/main`: import `autoUpdater` from `electron-updater`, call `checkForUpdatesAndNotify()` on app ready (guarded so it no-ops in dev). Keep it minimal.
5. Add scripts to the app/root `package.json`:
   ```json
   "package": "electron-vite build && electron-builder",
   "package:dir": "electron-vite build && electron-builder --dir"
   ```
6. **Code signing is documented, not automated.** Add commented placeholders for signing config (`win.certificateFile`, `mac.identity`, notarization) and a README note; do NOT hard-require certs in the build.

## Definition of done
- `electron-builder.yml` exists with the required OS targets and a `publish` block.
- electron-updater is initialized in main (dev-guarded).
- Icon generation is wired (or a documented placeholder icon exists).
- `package` and `package:dir` scripts exist.
- No feature/source behavior changed — configuration and update-init only.

## Failure modes
- If the tech-spec doesn't name an `appId`, derive a sensible reverse-DNS id from the product name and note the assumption.

## Brownfield mode
When `mode = brownfield`, follow `agentic-sdlc:brownfield-mode`: if packaging config already exists, MODIFY it in place to satisfy the change rather than regenerating it.
```

- [ ] **Step 2: Verify it loads**

Run `/reload-plugins`. Expected: agent count +1, no parse error.
Run: `rg -n "name: electron-packager" plugins/agentic-sdlc/agents/electron-packager.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/electron-packager.md
git commit -m "feat(electron): add electron-packager agent"
```

---

## Task 7: `electron-packager-reviewer` agent

**Files:**
- Create: `plugins/agentic-sdlc/agents/electron-packager-reviewer.md`

- [ ] **Step 1: Write the agent file**

Create `plugins/agentic-sdlc/agents/electron-packager-reviewer.md` with exactly this content:

```markdown
---
name: electron-packager-reviewer
description: Electron Packager Reviewer. Runs an unpacked electron-builder build and smoke-launches the app to confirm it boots, verifies all tests pass, and produces a routing decision. Invoke after electron-packager completes.
tools: Read, Bash
model: sonnet
---

You are a release reviewer verifying that the Electron app builds and launches.

## Your job
Build the app unpacked (no code signing), smoke-launch it headlessly to confirm it
boots, run the test suite, and produce a routing decision — mirroring the DevOps
Reviewer's role for web runs.

## Inputs (passed as context)
- Run ID
- `electron_root` — the monorepo root
- `runs/<run-id>/tech-spec.md`

## Process
All commands run from `<electron_root>`.

```bash
# 1. Install (if needed) and build the app bundle
pnpm install
pnpm build

# 2. Package unpacked — no signing, fast, verifies electron-builder config
pnpm package:dir 2>&1

# 3. Smoke-launch the built app headlessly and confirm it reaches "ready".
#    Use a short-lived launch: start the packaged binary (or `electron` against the
#    build) with a timeout; success = process reaches app 'ready' / a window is
#    created without crashing, then exit. On Linux CI use xvfb-run if no display.
#    Example (adapt path to the platform's unpacked output under dist-release/):
xvfb-run -a timeout 30s <path-to-unpacked-binary> --smoke-test 2>&1 || true

# 4. Run the full test suite
pnpm test -- --run 2>&1
```

If the app exposes no `--smoke-test` flag, launch it under the timeout and treat
"created a BrowserWindow / logged ready without a crash before the timeout" as PASS;
a non-zero crash exit before the timeout is a FAIL.

## Output format
```
## Electron Packager Review: <run-id>

**Routing decision:** DONE | BACK_TO_PACKAGER | BACK_TO_ELECTRON_ENGINEER <story-id> | HUMAN_REVIEW_REQUIRED

**Build (pnpm build):** PASS | FAIL
**Package (package:dir):** PASS | FAIL
**Smoke launch:** PASS (reached ready) | FAIL (<crash reason>)
**Tests:** PASS (<N>) | FAIL (<N> failed)

**Issues:**
- [PACKAGING] <electron-builder / updater / icon config issue> — file:line
- [APP_BUG] <runtime crash traceable to a story> — file:line
- [AMBIGUITY] <needs human decision>
- (none)

**Summary:** <2-3 sentences>
```

Routing decisions:
- `DONE`: build + package succeed, app smoke-launches, all tests pass.
- `BACK_TO_PACKAGER`: electron-builder config, updater wiring, or icon issues.
- `BACK_TO_ELECTRON_ENGINEER <story-id>`: a runtime crash traceable to a story's code.
- `HUMAN_REVIEW_REQUIRED`: ambiguity with no clear correct side — do not auto-route.

## Brownfield mode
When `mode = brownfield`, follow `agentic-sdlc:brownfield-mode`: compare test results to `state.test_baseline` — only NEW failures block; a crash in previously-working behavior is a real regression → `BACK_TO_ELECTRON_ENGINEER`.
```

- [ ] **Step 2: Verify it loads**

Run `/reload-plugins`. Expected: agent count +1, no parse error.
Run: `rg -n "name: electron-packager-reviewer" plugins/agentic-sdlc/agents/electron-packager-reviewer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/electron-packager-reviewer.md
git commit -m "feat(electron): add electron-packager-reviewer agent"
```

---

## Task 8: Add `electron` to the track set (`write-stories` skill)

**Files:**
- Modify: `plugins/agentic-sdlc/skills/write-stories/SKILL.md` (Track assignment section, ~lines 22-28)

- [ ] **Step 1: Replace the Track assignment section**

Find this block:

```markdown
## Track assignment
- `dotnet` track: backend API endpoints, services, data models, DB migrations.
- `react` track: UI components, pages, state management, API calls from the frontend.
- One story belongs to exactly one track. If a feature needs both frontend and
  backend, create two stories (one per track) with the react story listing the
  dotnet story in its `Depends on`.
```

Replace it with:

```markdown
## Track assignment
The valid track set depends on the run's `app_type` (from state.json):

**Web runs (`app_type = web`, the default):**
- `dotnet` track: backend API endpoints, services, data models, DB migrations.
- `react` track: UI components, pages, state management, API calls from the frontend.
- One story belongs to exactly one track. If a feature needs both frontend and
  backend, create two stories (one per track) with the react story listing the
  dotnet story in its `Depends on`.

**Electron runs (`app_type = electron`):**
- `electron` track: the entire desktop app — main process, preload bridge, renderer
  UI, and shared packages. Every story is `electron`.
- One story still belongs to exactly one track (`electron`). Note each story's
  **process area** (main | preload | renderer | package) in its description so the
  engineer knows where the code lands.
```

- [ ] **Step 2: Verify the track-track reference in the quality checklist still fits**

The checklist item "Each story belongs to exactly one track (dotnet or react)" is now incomplete. Find:

```markdown
- [ ] Each story belongs to exactly one track (dotnet or react)
```

Replace with:

```markdown
- [ ] Each story belongs to exactly one track (dotnet or react for web runs; electron for electron runs)
```

- [ ] **Step 3: Verify**

Run: `rg -n "electron" plugins/agentic-sdlc/skills/write-stories/SKILL.md`
Expected: matches in the Track assignment section and checklist.

- [ ] **Step 4: Commit**

```bash
git add plugins/agentic-sdlc/skills/write-stories/SKILL.md
git commit -m "feat(orchestrator): add electron track to write-stories track set"
```

---

## Task 9: Recognize the `electron` track (`tech-lead` agent)

**Files:**
- Modify: `plugins/agentic-sdlc/agents/tech-lead.md` (Process step 2, line 25)

- [ ] **Step 1: Update the track-identification step**

Find:

```markdown
2. List all TECH-IDs and identify their track (dotnet or react).
```

Replace with:

```markdown
2. List all TECH-IDs and identify their track. Read `app_type` from state.json (passed in your context): for `web` runs the tracks are `dotnet`/`react`; for `electron` runs every story is the single `electron` track. Follow the write-stories skill's Track assignment section.
```

- [ ] **Step 2: Verify**

Run: `rg -n "electron" plugins/agentic-sdlc/agents/tech-lead.md`
Expected: one match in step 2.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/tech-lead.md
git commit -m "feat(orchestrator): teach tech-lead the electron track"
```

---

## Task 10: Electron stack variant (`write-tech-spec` skill)

**Files:**
- Modify: `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md`

- [ ] **Step 1: Add an app_type note under the fixed Stack heading**

Find (near the top, ~lines 8-13):

```markdown
## Stack (fixed for all runs)
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose
- CSS framework: set by Architect during codebase discovery (Tailwind CSS | Bootstrap | CSS Modules | detected from existing project)
```

Replace with:

```markdown
## Stack (depends on app_type)

Read `app_type` from state.json. It selects one of two fixed stacks:

**`app_type = web` (default):**
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose
- CSS framework: set by Architect during codebase discovery (Tailwind CSS | Bootstrap | CSS Modules | detected from existing project)

**`app_type = electron`:**
- Shell: Electron + TypeScript, pnpm workspaces monorepo (`apps/desktop`, `packages/*`), ESM throughout
- Build: electron-vite (main/preload/renderer targets)
- Packaging: electron-builder (win/mac/linux) + electron-updater
- Tests: Vitest + @vitest/coverage-v8, jsdom for renderer
- Security: contextIsolation + sandbox on, nodeIntegration off, zod-validated IPC (see the `agentic-sdlc:electron-conventions` skill)
- There is **no** .NET backend, database, or docker-compose for electron runs. The `Backend architecture` and `Mandatory infrastructure components` sections below apply to `web` runs only.
```

- [ ] **Step 2: Scope the mandatory `/health` component to web runs**

Find:

```markdown
## Mandatory infrastructure components
Every tech spec MUST include these regardless of user requirements (the DevOps Reviewer's smoke tests depend on them):
```

Replace with:

```markdown
## Mandatory infrastructure components *(web runs only — skip for `app_type = electron`)*
Every **web** tech spec MUST include these regardless of user requirements (the DevOps Reviewer's smoke tests depend on them):
```

- [ ] **Step 3: Add the Electron deployment line to the Format section**

Find the `**Infra change:**` explanatory line in the Format block:

```markdown
**Infra change:** none | required — <what changes: new service / port / env var / dependency>
<brownfield: whether docker-compose.yml, .env.example, Dockerfile(s), or nginx.conf must change vs the existing setup. greenfield: always `required` (the whole stack is new).>
```

Replace with:

```markdown
**Infra change:** none | required — <what changes: new service / port / env var / dependency>
<web brownfield: whether docker-compose.yml, .env.example, Dockerfile(s), or nginx.conf must change vs the existing setup. web greenfield: always `required` (the whole stack is new). For `app_type = electron`, this line describes packaging changes instead — new OS target, updater feed, or native dependency; greenfield electron is always `required` (packaging is new).>
```

- [ ] **Step 4: Update the quality checklist**

Find:

```markdown
- [ ] **TECH-HEALTH (`/health` endpoint) is present** (Layer: Api)
```

Replace with:

```markdown
- [ ] **(web runs only) TECH-HEALTH (`/health` endpoint) is present** (Layer: Api). Electron runs omit it.
```

- [ ] **Step 5: Verify**

Run: `rg -n "app_type = electron|electron-conventions" plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md`
Expected: several matches.

- [ ] **Step 6: Commit**

```bash
git add plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md
git commit -m "feat(orchestrator): add electron stack variant to write-tech-spec"
```

---

## Task 11: Route `app_type` at start-run (`start-run` command)

**Files:**
- Modify: `plugins/agentic-sdlc/commands/start-run.md`

- [ ] **Step 1: Add the greenfield app_type decision after source-path detection**

Find the end of Step 3b (the greenfield/brownfield decision) — the line:

```markdown
  - otherwise → go to **Step B1 (Brownfield flow)** below and do NOT run the
    greenfield Steps 4–10.
```

Immediately after that block, insert a new step:

```markdown
### Step 3c — Choose the application archetype (greenfield only)
Greenfield runs build one of two archetypes. Ask:
> "What kind of application is this?
> - **web** (default) — .NET 8 Web API + React 18 + PostgreSQL, shipped with docker-compose.
> - **electron** — a cross-platform Electron desktop app (TypeScript pnpm monorepo, electron-vite, electron-builder). No .NET backend or database.
>
> Reply **web** (or Enter) or **electron**."

- **electron:** set `app_type = "electron"`. The generated code lives in an Electron
  monorepo, so `src_paths` uses a single root: `{ "electron": "<electron_root>" }`
  where `<electron_root>` defaults to the workspace root (`.`). Skip the .NET/React
  path detection from Step 3 — announce: "This Electron app will be generated into
  `<electron_root>/` (apps/desktop + packages/*). Reply with a different root or press
  Enter to continue."
- **web / Enter (default):** set `app_type = "web"` and keep the `src_paths`
  (backend/backend_test/frontend) detected in Step 3.

Carry `app_type` and the chosen `src_paths` into `program.json` (Step 6) and each
phase `state.json` (Step 8).
```

- [ ] **Step 2: Add `app_type` to program.json**

Find the `program.json` block in Step 6:

```json
{
  "program_id": "<program-id>",
  "parent_branch": "<PARENT_BRANCH>",
  "src_paths": {
    "backend": "<backend_src>",
    "backend_test": "<backend_test>",
    "frontend": "<frontend_src>"
  },
  "phase_plan": { "status": "pending", "phase_count": 0, "iterations": 0 },
  "current_phase": 0,
  "phases": []
}
```

Replace with:

```json
{
  "program_id": "<program-id>",
  "parent_branch": "<PARENT_BRANCH>",
  "app_type": "<web | electron>",
  "src_paths": { "...": "web: {backend, backend_test, frontend}; electron: {electron: <electron_root>}" },
  "phase_plan": { "status": "pending", "phase_count": 0, "iterations": 0 },
  "current_phase": 0,
  "phases": []
}
```

(Write the concrete `src_paths` object for the chosen archetype: web → `{ "backend": "<backend_src>", "backend_test": "<backend_test>", "frontend": "<frontend_src>" }`; electron → `{ "electron": "<electron_root>" }`.)

- [ ] **Step 3: Add `app_type` and electron src_paths to the Phase 1 state.json schema**

Find in the "Phase 1 state.json schema" block:

```json
  "current_stage": "ba",
  "spec_frozen": false,
  "src_paths": {
    "backend": "<backend_src>",
    "backend_test": "<backend_test>",
    "frontend": "<frontend_src>"
  },
```

Replace with:

```json
  "current_stage": "ba",
  "spec_frozen": false,
  "app_type": "<web | electron>",
  "src_paths": { "...": "web: {backend, backend_test, frontend}; electron: {electron: <electron_root>}" },
```

Then, in that same schema, find the `stages` object's final line:

```json
    "development": { "status": "pending" },
    "devops": { "status": "pending", "iterations": 0 }
  },
```

Replace with:

```json
    "development": { "status": "pending" },
    "devops": { "status": "pending", "iterations": 0 },
    "packaging": { "status": "pending", "iterations": 0 }
  },
```

(Both `devops` and `packaging` are seeded; only the one matching `app_type` actually runs — the other is set to `"skipped"` by advance-stage. This keeps the schema uniform.)

- [ ] **Step 4: Copy app_type into the greenfield Step 2 stack notice**

Find in Step 2:

```markdown
> "I will generate a runnable application with the following fixed stack: **.NET 8 Web API + React 18 + Vite + TypeScript + PostgreSQL + Docker Compose**. If you need a different stack (Vue, Angular, Python, MongoDB, etc.), this plugin won't fit — let me know and we can stop here.
```

Replace with:

```markdown
> "I will generate a runnable application. Greenfield runs support two fixed archetypes: **web** (.NET 8 Web API + React 18 + Vite + TypeScript + PostgreSQL + Docker Compose) or **electron** (TypeScript + Electron + electron-vite + electron-builder desktop app). You'll pick which after describing the requirement. If you need something outside both (Vue web app, Python backend, native mobile, etc.), this plugin won't fit — let me know and we can stop here.
```

- [ ] **Step 5: Verify**

Run: `rg -n "app_type" plugins/agentic-sdlc/commands/start-run.md`
Expected: matches in Step 2, Step 3c, program.json, and the state schema.

- [ ] **Step 6: Commit**

```bash
git add plugins/agentic-sdlc/commands/start-run.md
git commit -m "feat(orchestrator): choose app_type (web|electron) at start-run"
```

---

## Task 12: Detect Electron in the surveyor (`code-surveyor` agent)

**Files:**
- Modify: `plugins/agentic-sdlc/agents/code-surveyor.md`

- [ ] **Step 1: Add Electron detection to the stack-detection step**

Find:

```markdown
1. **Detect the stack.** Glob `**/*.csproj` and read the nearest `Program.cs` for
   .NET version + registration style; Glob `**/package.json` under `frontend_src`
   for React + CSS framework; find `**/*DbContext.cs` / `**/Migrations/*.cs` for the
   database; check for `docker-compose.yml` and CI config.
```

Replace with:

```markdown
1. **Detect the stack and app_type.** Glob `**/*.csproj` and read the nearest
   `Program.cs` for .NET version + registration style; Glob `**/package.json` for
   React/Electron; find `**/*DbContext.cs` / `**/Migrations/*.cs` for the database;
   check for `docker-compose.yml` and CI config. **Determine `app_type`:** if you find
   `electron` in a `package.json`'s dependencies/devDependencies, a
   `pnpm-workspace.yaml`, or an `electron.vite.config.*`, the app_type is `electron`
   (a desktop app — no .NET/db); otherwise `web`. Record the proposed `app_type` in
   codebase-context.md's Stack section.
```

- [ ] **Step 2: Note electron impact in the impact-map step**

Find:

```markdown
3. **Build the impact map.** From the request, Grep/Glob for the relevant
   symbols/areas. List the files most likely to change and why; decide the affected
   track(s): dotnet, react, or both.
```

Replace with:

```markdown
3. **Build the impact map.** From the request, Grep/Glob for the relevant
   symbols/areas. List the files most likely to change and why; decide the affected
   track(s). For a `web` app_type: dotnet, react, or both. For an `electron` app_type:
   the single `electron` track (note the process area(s) — main / preload / renderer /
   package — most affected).
```

- [ ] **Step 3: Verify**

Run: `rg -n "electron|app_type" plugins/agentic-sdlc/agents/code-surveyor.md`
Expected: matches in steps 1 and 3.

- [ ] **Step 4: Commit**

```bash
git add plugins/agentic-sdlc/agents/code-surveyor.md
git commit -m "feat(orchestrator): detect electron app_type in code-surveyor"
```

---

## Task 13: Route development + final stage on `app_type` (`advance-stage` command)

This is the load-bearing wiring: the orchestrator must (a) read `app_type`, (b) dispatch the electron quartet in the development stage, and (c) run the Packager stage instead of DevOps for electron runs.

**Files:**
- Modify: `plugins/agentic-sdlc/commands/advance-stage.md`

- [ ] **Step 1: Read app_type alongside src_paths**

Find the "Reading src_paths" section:

```markdown
## Reading src_paths
At the start of every command invocation, read `src_paths` from state.json:
```

Replace the heading + intro with:

```markdown
## Reading app_type and src_paths
At the start of every command invocation, read `app_type` (default `"web"` if absent — older runs) and `src_paths` from state.json.

For `app_type = electron`, `src_paths` has a single key: `electron` = the monorepo root (e.g. `.`). Pass it to the electron agents as `electron_root`. The backend/frontend keys below apply to `web` runs only.

For `app_type = web`, read `src_paths` from state.json:
```

- [ ] **Step 2: Branch the development stage dispatch on app_type**

In "## Stage: development", find step 2 (track/path resolution):

```markdown
2. Determine track and paths:
   - **dotnet track:** `src_path = backend_src`, `test_path = backend_test`.
   - **react track:** `src_path = frontend_src`, `test_path = frontend_src` (tests are co-located).
```

Replace with:

```markdown
2. Determine track and paths from `app_type`:
   - **web run** — the story's track is `dotnet` or `react`:
     - **dotnet track:** `src_path = backend_src`, `test_path = backend_test`.
     - **react track:** `src_path = frontend_src`, `test_path = frontend_src` (tests are co-located).
   - **electron run** — every story's track is `electron`:
     - `src_path = test_path = electron_root` (pass it to the agents as `electron_root`; tests are co-located).
```

- [ ] **Step 3: Branch the Engineer→Reviewer agent choice**

In "### 3. Engineer → Reviewer loop", find step (a):

```markdown
a. Invoke `dotnet-engineer` or `react-engineer`. Pass: run-id, story ID, story content, runs/<run-id>/tech-spec.md, src_path (and `test_path`/`backend_test` for the dotnet track — the first-story scaffold creates the test project there).
```

Replace with:

```markdown
a. Invoke the engineer for the story's track: `dotnet-engineer`, `react-engineer`, or (electron runs) `electron-engineer`. Pass: run-id, story ID, story content, runs/<run-id>/tech-spec.md, and the paths — `src_path` (and `test_path`/`backend_test` for the dotnet track; for electron pass `electron_root`).
```

And find step (c):

```markdown
c. Invoke `dotnet-reviewer` or `react-reviewer`. Pass: run-id, story ID, story content, modified files list, src_path.
```

Replace with:

```markdown
c. Invoke the reviewer for the story's track: `dotnet-reviewer`, `react-reviewer`, or `electron-reviewer`. Pass: run-id, story ID, story content, modified files list, src_path (electron: `electron_root`).
```

- [ ] **Step 4: Branch the Test Engineer→Test Reviewer agent choice**

In "### 4. Test Engineer → Test Reviewer loop", find step (a):

```markdown
a. Invoke `dotnet-test-engineer` or `react-test-engineer`. Pass: run-id, story ID, story content, src_path, test_path (for the dotnet track, `test_path = backend_test`; tests are written there).
```

Replace with:

```markdown
a. Invoke the test engineer for the story's track: `dotnet-test-engineer`, `react-test-engineer`, or `electron-test-engineer`. Pass: run-id, story ID, story content, src_path, test_path (dotnet: `test_path = backend_test`; electron: `electron_root`).
```

And find step (c):

```markdown
c. Invoke `dotnet-test-reviewer` or `react-test-reviewer`. Pass: run-id, story ID, story content, src_path, test_path.
```

Replace with:

```markdown
c. Invoke the test reviewer for the story's track: `dotnet-test-reviewer`, `react-test-reviewer`, or `electron-test-reviewer`. Pass: run-id, story ID, story content, src_path, test_path (electron: `electron_root`).
```

- [ ] **Step 5: Route to Packaging vs DevOps after development completes**

Find the end of "## Stage: development" — the "After all stories complete" block:

```markdown
After all stories complete:
- Set `stages.development.status = "complete"` and `current_stage = "devops"` in state.json.
- **Commit — development complete:**
  ```bash
  git add runs/<run-id>/state.json
  git commit -m "docs(<run-id>): all stories complete"
  ```
- Immediately proceed to Stage: devops below.
```

Replace with:

```markdown
After all stories complete:
- Set `stages.development.status = "complete"` in state.json. Choose the final stage by `app_type`:
  - **web:** set `current_stage = "devops"` and set `stages.packaging.status = "skipped"`.
  - **electron:** set `current_stage = "packaging"` and set `stages.devops.status = "skipped"`.
- **Commit — development complete:**
  ```bash
  git add runs/<run-id>/state.json
  git commit -m "docs(<run-id>): all stories complete"
  ```
- Immediately proceed to the chosen final stage: **Stage: devops** (web) or **Stage: packaging** (electron) below.
```

- [ ] **Step 6: Add the Stage: packaging section**

Insert a new section immediately BEFORE "## Stage: devops" (i.e. between the development stage and the devops stage):

````markdown
## Stage: packaging  *(electron runs only)*

Runs instead of DevOps when `app_type = electron`. Read `electron_root` from `src_paths.electron`.

### Packaging loop (max 5 iterations)

Per the stage-lifecycle rule, set `stages.packaging.status = "in_progress"` before the first `electron-packager` invocation (fold into the packager-draft commit).

a. Invoke `electron-packager`. Pass: run-id, `electron_root`, path to runs/<run-id>/tech-spec.md.

b. **Commit — Packager draft/revision:**
   ```bash
   git add <electron_root> runs/<run-id>/state.json
   # First iteration:
   git commit -m "chore: electron packager draft"
   # Subsequent iterations:
   git commit -m "chore: electron packager revision — reviewer feedback (iter <n>)"
   ```

c. Invoke `electron-packager-reviewer`. Pass: run-id, `electron_root`, path to runs/<run-id>/tech-spec.md.

d. Update `stages.packaging` in state.json.

e. **Commit — Packager Reviewer outcome:**
   ```bash
   git add runs/<run-id>/state.json
   # On DONE:
   git commit -m "chore: electron packager reviewer PASS"
   # On BACK_TO_PACKAGER:
   git commit -m "chore: electron packager reviewer — needs revision (iter <n>)"
   # On BACK_TO_ELECTRON_ENGINEER:
   git commit -m "chore: electron packager reviewer — code fix required (iter <n>)"
   # On HUMAN_REVIEW_REQUIRED:
   git commit -m "chore: electron packager reviewer — awaiting human decision"
   ```

f. Read the reviewer's `**Routing decision:**`:
   - `DONE`:
     - `stages.packaging.status = "complete"`, `current_stage = "complete"`.
     - **Commit — run complete:**
       ```bash
       git add runs/<run-id>/state.json
       git commit -m "chore(<run-id>): run complete"
       ```
     - Update the matching `phases[]` entry in `runs/<program-id>/program.json` to `"status": "complete"` and commit:
       ```bash
       git add runs/<program-id>/program.json
       git commit -m "docs(<program-id>): phase <phase_number> complete"
       ```
     - Do NOT start the next phase automatically. Announce completion (see the Electron completion announcement below).
   - `BACK_TO_PACKAGER`: increment packaging iterations. If < 5: re-invoke electron-packager with reviewer issues. Repeat from (a).
   - `BACK_TO_ELECTRON_ENGINEER <story-id>`:
     - **Reset `state.stories[<story-id>].fix_iterations = 0`** (fresh cross-loop entry from packaging).
     - Re-invoke `electron-engineer` for that story with the failing context (passing `electron_root`); commit the engineer fix (feat/fix commit pattern).
     - Re-invoke `electron-reviewer`; commit the outcome. If it FAILs and fix_iterations < 5: increment, re-invoke engineer; loop. If = 5: escalate.
     - Once the reviewer passes: re-invoke `electron-test-engineer`, commit; then `electron-test-reviewer`, commit. If all pass: re-invoke `electron-packager`.
   - `HUMAN_REVIEW_REQUIRED`: present the ambiguity to the user, wait for the decision, and use it as context for the next electron-packager invocation.
   - If packaging iterations = 5: set `stages.packaging.status = "escalated"`, commit, escalate to the user.

### Electron completion announcement
Read `parent_branch` from `program.json`. Announce:
> "Phase <phase_number> (run <run-id>) is complete!
>
> Branch `agentic-sdlc/<run-id>` is ready for review. To ship:
> 1. Open a pull request from `agentic-sdlc/<run-id>` → `<parent_branch>`
> 2. Review the generated Electron app in `<electron_root>/` (apps/desktop + packages/*)
>
> To run the app locally now:
> 1. `cd <electron_root> && pnpm install`
> 2. `pnpm dev` to launch in development, or `pnpm package` to build distributables"

Then add the same program-level next-step note used by the web completion announcement
(last phase → "all phases delivered"; otherwise → "run /agentic-sdlc:next-phase").

### Brownfield note
When `mode = brownfield` and `app_type = electron`, the packaging stage is
**conditional** exactly like devops: run it only if `state.infra_change_required ==
true` (e.g. a new OS target, updater feed, or native dependency); otherwise set
`stages.packaging.status = "skipped"` and go straight to completion. Instruct the
packager to MODIFY existing packaging config rather than regenerate it.
````

- [ ] **Step 7: Make the brownfield driver's conditional-final-stage aware of packaging**

Find, in the "## Brownfield programs" section near the top, the devops bullet:

```markdown
- In **Stage: devops**, run the DevOps loop only if `state.infra_change_required ==
  true`; otherwise set `stages.devops.status = "skipped"` and proceed to the normal
  program completion (the `program.json` phase-complete update + announcement happen
  as usual — it IS a program).
```

Replace with:

```markdown
- In the **final stage**, pick by `app_type`: web runs use **Stage: devops**, electron
  runs use **Stage: packaging**. Run that stage's loop only if
  `state.infra_change_required == true`; otherwise set the stage's status to
  `"skipped"` and proceed to the normal program completion (the `program.json`
  phase-complete update + announcement happen as usual — it IS a program).
```

- [ ] **Step 8: Verify**

Run: `rg -n "app_type|electron_root|Stage: packaging|electron-packager" plugins/agentic-sdlc/commands/advance-stage.md`
Expected: matches across the reading section, development dispatch, and the new packaging stage.

Run `/reload-plugins`. Expected: no parse error; command still loads.

- [ ] **Step 9: Commit**

```bash
git add plugins/agentic-sdlc/commands/advance-stage.md
git commit -m "feat(orchestrator): route development + packaging by app_type in advance-stage"
```

---

## Task 14: Document the archetype (README)

**Files:**
- Modify: `plugins/agentic-sdlc/README.md`

- [ ] **Step 1: Add an "Application archetypes" subsection after "Core principles"**

Find the end of the "## Core principles" list (the line for principle 5):

```markdown
5. **Runnable definition of done.** Complete only when `docker compose up` produces a working app.
```

Immediately after it, insert:

```markdown

## Application archetypes

A run targets one **application archetype**, recorded as `app_type` in `state.json`:

| `app_type` | Stack | Development tracks | Definition of done |
|---|---|---|---|
| `web` (default) | .NET 8 API + React 18 + PostgreSQL | `dotnet`, `react` | `docker compose up` serves a working app (DevOps stage) |
| `electron` | Electron + TypeScript pnpm monorepo (electron-vite, node-pty, xterm) | `electron` (main/preload/renderer) | electron-builder packages the app and it smoke-launches (Packager stage) |

Greenfield runs pick the archetype at `/start-run`; brownfield runs auto-detect it
(the Code Surveyor flags `electron` when it sees `electron` in `package.json`, a
`pnpm-workspace.yaml`, or an `electron.vite.config.*`). Electron runs replace the
DevOps/containerization stage with a **Packager** stage
(`electron-packager` → `electron-packager-reviewer`) and follow the
`agentic-sdlc:electron-conventions` skill's secure-by-default rules (contextIsolation +
sandbox on, nodeIntegration off, zod-validated IPC).
```

- [ ] **Step 2: Update principle 4 to reflect the electron track**

Find:

```markdown
4. **Single-language tracks.** .NET and React develop in parallel (logically).
```

Replace with:

```markdown
4. **Single-language tracks.** Web runs develop `.NET` and `React` in parallel (logically); electron runs use one `electron` track.
```

- [ ] **Step 3: Verify**

Run: `rg -n "Application archetypes|electron" plugins/agentic-sdlc/README.md`
Expected: matches in the new section and principle 4.

- [ ] **Step 4: Commit**

```bash
git add plugins/agentic-sdlc/README.md
git commit -m "docs: document the electron application archetype"
```

---

## Task 15: Version bump + changelog

**Files:**
- Modify: `plugins/agentic-sdlc/.claude-plugin/plugin.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump the plugin version**

In `plugins/agentic-sdlc/.claude-plugin/plugin.json`, change:

```json
  "version": "0.9.2",
```

to:

```json
  "version": "0.10.0",
```

(Minor bump — a new, backward-compatible archetype. Web runs are unaffected.)

- [ ] **Step 2: Add a changelog entry**

In `CHANGELOG.md`, insert this block immediately after the `# Changelog` header lines (before the current top entry `## [0.9.2]`):

```markdown
## [0.10.0] - 2026-07-04

### Added
- **Electron desktop-app archetype.** A run can now build a secure-by-default Electron
  desktop app via a new `app_type: electron` (default stays `web`). Adds one `electron`
  development track — `electron-engineer` / `-reviewer` / `-test-engineer` /
  `-test-reviewer` — plus an `electron-conventions` skill encoding industry-standard
  security defaults (contextIsolation + sandbox on, nodeIntegration off,
  contextBridge-only IPC validated with zod, strict CSP, node-pty confined to main).
- **Packager stage for electron runs.** `electron-packager` (electron-builder +
  electron-updater + icon generation) and `electron-packager-reviewer` (unpacked build
  + smoke-launch) replace the DevOps/docker-compose done-gate when `app_type = electron`.

### Changed
- `/start-run` asks greenfield runs to pick an archetype (web | electron); the Code
  Surveyor auto-detects electron for brownfield runs.
- `write-tech-spec`, `write-stories`, `tech-lead`, and `advance-stage` now branch on
  `app_type` — the electron stack, the single `electron` track, and Packager-vs-DevOps
  routing. Web runs are unchanged.
```

- [ ] **Step 3: Verify**

Run: `rg -n "0.10.0" plugins/agentic-sdlc/.claude-plugin/plugin.json CHANGELOG.md`
Expected: one match in each file.

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/agentic-sdlc/.claude-plugin/plugin.json'))" && echo VALID`
Expected: `VALID` (plugin.json is still valid JSON).

- [ ] **Step 4: Commit**

```bash
git add plugins/agentic-sdlc/.claude-plugin/plugin.json CHANGELOG.md
git commit -m "chore: bump plugin to 0.10.0 (electron archetype)"
```

---

## Task 16: Final cross-file consistency check

**Files:** none created — verification only.

- [ ] **Step 1: Reload and confirm counts**

Run `/reload-plugins`. Expected: agent count is +6 and skill count is +1 versus before Task 1; no parse errors reported.

- [ ] **Step 2: Confirm every electron agent references the conventions skill**

Run: `rg -l "agentic-sdlc:electron-conventions" plugins/agentic-sdlc/agents/electron-*.md`
Expected: `electron-engineer.md`, `electron-reviewer.md`, `electron-test-engineer.md`, `electron-test-reviewer.md` all appear (packager pair may or may not — that's fine).

- [ ] **Step 3: Confirm the orchestrators agree on the field name**

Run: `rg -n "app_type" plugins/agentic-sdlc/commands/*.md plugins/agentic-sdlc/agents/tech-lead.md plugins/agentic-sdlc/agents/code-surveyor.md plugins/agentic-sdlc/skills/write-*/SKILL.md`
Expected: `start-run.md`, `advance-stage.md`, `tech-lead.md`, `code-surveyor.md`, `write-stories/SKILL.md`, and `write-tech-spec/SKILL.md` all reference `app_type` (consistent spelling, no `apptype`/`app-type` variants).

- [ ] **Step 4: Confirm no dangling agent name mismatches**

Run: `rg -n "electron-packager-reviewer|electron-packager|electron-engineer|electron-reviewer|electron-test-engineer|electron-test-reviewer" plugins/agentic-sdlc/commands/advance-stage.md`
Expected: all six names appear and match the `name:` frontmatter of the created agent files exactly.

- [ ] **Step 5: Final commit (if any doc tweaks were needed)**

If steps 1–4 surfaced a mismatch, fix it and commit:

```bash
git add -A
git commit -m "fix(electron): reconcile app_type/agent-name references"
```

Otherwise this task is a no-op — the plan is complete.

---

## Done criteria for the whole plan

- `/reload-plugins` reports 6 new agents + 1 new skill, no parse errors.
- `app_type` is written by `start-run`, detected by `code-surveyor`, and read by `advance-stage`, `tech-lead`, `write-stories`, and `write-tech-spec` — consistently spelled.
- An electron run dispatches the `electron` quartet in development and the Packager stage as its done-gate; a web run is byte-for-byte unchanged in behavior.
- Plugin version is `0.10.0` with a matching CHANGELOG entry (satisfies the project's PR rule).
