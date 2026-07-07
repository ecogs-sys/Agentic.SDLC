---
name: scaffold-electron
description: One-time pnpm/electron-vite monorepo scaffold for a fresh Electron app. Used by the Electron Engineer ONLY when <electron_root> is empty (the first story of a greenfield electron run).
---

# Scaffold: Electron monorepo (pnpm + electron-vite)

Run this ONLY when `<electron_root>` has no `package.json` /
`pnpm-workspace.yaml` yet. Scaffold the monorepo skeleton once:

- `pnpm-workspace.yaml` with `packages: ["apps/*", "packages/*"]`
- root `package.json` (`"type": "module"`, `"private": true`, scripts: `dev`,
  `build`, `test`, `lint`) with devDeps: `electron`, `electron-vite`, `vite`,
  `typescript`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `eslint`, `prettier`.
- `apps/desktop/src/{main,preload,renderer}` and `packages/contracts` (with `zod`).
- `electron.vite.config.ts` with `main`, `preload`, `renderer` targets.
- a root `vitest.config.ts` (or per-package) enabling
  `coverage: { provider: 'v8' }`, with `jsdom` for renderer tests and `node`
  elsewhere.

Install with `pnpm install`. Follow the `agentic-sdlc:electron-conventions` skill
for the layout and the non-negotiable security defaults (contextIsolation,
sandbox, CSP, contextBridge-only IPC).
