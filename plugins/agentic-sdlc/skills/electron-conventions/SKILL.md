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
