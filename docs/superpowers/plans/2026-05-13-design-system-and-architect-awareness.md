# Design System Awareness + Architect Codebase Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add design system awareness, CSS isolation, and component decomposition to React agents; add codebase discovery and CSS framework selection to the Architect agent.

**Architecture:** Pure markdown edits — no compiled code. Six independent tasks, each touching one logical unit. All changes are additive (no existing content removed, only extended). Tasks can be executed sequentially; each produces a committed change.

**Tech Stack:** Markdown, PowerShell (file copy in Task 1), Git

---

## File Map

| File | Change type |
|---|---|
| `plugins/agentic-sdlc/skills/verdant-design/SKILL.md` | Create |
| `plugins/agentic-sdlc/skills/verdant-design/README.md` | Create (copy from branding) |
| `plugins/agentic-sdlc/skills/verdant-design/colors_and_type.css` | Create (copy from branding) |
| `plugins/agentic-sdlc/skills/react-conventions/SKILL.md` | Modify — insert 3 new sections |
| `plugins/agentic-sdlc/agents/react-engineer.md` | Modify — expand step 2, update Definition of done |
| `plugins/agentic-sdlc/agents/react-reviewer.md` | Modify — insert 3 new check steps, update PASS criteria |
| `plugins/agentic-sdlc/agents/architect.md` | Modify — insert Step 1 codebase discovery, renumber remaining steps |
| `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md` | Modify — CSS framework field, Existing system section, checklist items |

---

### Task 1: Bundle Verdant Design System as a plugin skill

**Files:**
- Create: `plugins/agentic-sdlc/skills/verdant-design/SKILL.md`
- Create: `plugins/agentic-sdlc/skills/verdant-design/README.md`
- Create: `plugins/agentic-sdlc/skills/verdant-design/colors_and_type.css`

- [ ] **Step 1: Write SKILL.md**

Create `plugins/agentic-sdlc/skills/verdant-design/SKILL.md` with this exact content:

```markdown
---
name: verdant-design
description: Verdant Design System. Used by React Engineer and React Reviewer for design token reference, CSS framework integration, and visual conventions. Contains CSS custom properties, typography, spacing, and component patterns for admin web applications.
---

# Verdant Design System — Plugin Reference

This is the Verdant Design System bundled into the Agentic SDLC plugin.

## When to use this skill

- **React Engineer (fresh project):** Read this skill, then copy `colors_and_type.css` content into `src/styles/design-tokens.css`.
- **React Engineer or Reviewer (any project):** Read `README.md` to understand the full token system and component visual conventions.
- **Token reference:** All CSS custom properties are defined in `colors_and_type.css`. Key tokens:
  - Colors: `--color-primary`, `--color-accent`, `--fg-1`, `--fg-2`, `--bg-base`, `--bg-surface`, `--border`
  - Spacing: `--space-1` (4px) through `--space-24` (96px)
  - Radius: `--radius-sm` (4px), `--radius-md` (6px), `--radius-lg` (8px), `--radius-xl` (12px)
  - Typography: `--font-sans`, `--text-base` (14px), `--weight-semibold`, `--leading-normal`

## Files
- `README.md` — full design system reference: colors, typography, spacing, iconography, copy rules, component patterns
- `colors_and_type.css` — all CSS custom properties; copy this directly into `src/styles/design-tokens.css` in the frontend project

Read `README.md` now to load full design system context.
```

- [ ] **Step 2: Copy README.md from the branding directory**

```powershell
Copy-Item "C:\Work\ecogs\branding\Design System\Verdant Design System\README.md" `
  "C:\Work\ecogs\projects\Agentic.SDLC\plugins\agentic-sdlc\skills\verdant-design\README.md"
```

- [ ] **Step 3: Copy colors_and_type.css from the branding directory**

```powershell
Copy-Item "C:\Work\ecogs\branding\Design System\Verdant Design System\colors_and_type.css" `
  "C:\Work\ecogs\projects\Agentic.SDLC\plugins\agentic-sdlc\skills\verdant-design\colors_and_type.css"
```

- [ ] **Step 4: Verify three files exist**

```powershell
Get-ChildItem "C:\Work\ecogs\projects\Agentic.SDLC\plugins\agentic-sdlc\skills\verdant-design"
```

Expected output: three files — `SKILL.md`, `README.md`, `colors_and_type.css`

- [ ] **Step 5: Commit**

```bash
git add plugins/agentic-sdlc/skills/verdant-design/
git commit -m "feat(plugin): bundle Verdant Design System as verdant-design skill"
```

---

### Task 2: Update react-conventions skill — design system, decomposition, CSS isolation

**Files:**
- Modify: `plugins/agentic-sdlc/skills/react-conventions/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `plugins/agentic-sdlc/skills/react-conventions/SKILL.md`. Confirm the file ends with:
```
## Commands
```
and that the section order is: Project structure → Component conventions → State management → TypeScript style → API calls → Vitest patterns → Commands.

The three new sections go between `## TypeScript style` and `## API calls`.

- [ ] **Step 2: Insert the three new sections**

Find this exact string in the file:
```
## API calls
```

Insert the following block **immediately before** that line (leaving one blank line between the new content and `## API calls`):

```markdown
## Design system

Detect the CSS framework already in use before writing any styles:

| Signal in `<frontend_src>` | Framework | How to apply Verdant tokens |
|---|---|---|
| `tailwind.config.ts` or `tailwind.config.js` present | Tailwind | Extend config with Verdant color/spacing/radius tokens (see react-engineer step 2) |
| `bootstrap` in `package.json` dependencies | Bootstrap | Override Bootstrap CSS vars with Verdant tokens in a global `_verdant-bootstrap.css` |
| `*.module.css` files present | CSS Modules | Use `var(--token-name)` inside `.module.css` files; tokens loaded globally via `main.tsx` |
| `styled-components` or `@emotion/*` in `package.json` | CSS-in-JS | Follow existing patterns; reference Verdant tokens via `createGlobalStyle` or theme |
| `<frontend_src>` has content but none of the above match | Plain CSS | Follow existing conventions — do **not** inject Verdant tokens |
| Empty / no `<frontend_src>` | Fresh project | Read CSS framework from `tech-spec.md`; invoke `agentic-sdlc:verdant-design` skill |

For **fresh projects**: invoke the `agentic-sdlc:verdant-design` skill to load the full token reference. The react-engineer copies `colors_and_type.css` into `src/styles/design-tokens.css` during scaffold (see react-engineer step 2).

## Component decomposition

**Fresh project:** Feature-scoped decomposition.
- Components live alongside the page or feature that owns them.
  - Example: `src/pages/UserListPage/UserRow.tsx` — `UserRow` belongs to `UserListPage`.
- Promote a component to shared `src/components/` only when two or more distinct pages/features use it.
- No Atomic Design folder hierarchy imposed.

**Existing project:** Scan `src/` before writing any component. Identify whether the project uses flat, feature-scoped, or atomic structure. Follow it exactly.

**Single responsibility rule:** A component file should do exactly one of: render UI, fetch data, or manage complex form state. A component that fetches data AND renders AND manages multi-step form state needs to be split into a hook + a presentational component.

## CSS isolation

These rules apply regardless of CSS framework:

- Every component owns its styles — no CSS selector targets elements outside the component's own root.
- No raw hex color values in component source — use semantic tokens (`var(--color-primary)`, `var(--fg-1)`, etc.).
- No raw pixel values for spacing or border-radius — use token variables (`var(--space-2)`, `var(--radius-md)`).
- No bare global class names that could collide (`.button`, `.card`, `.table` — always scope them).

**Correct (CSS Modules + Verdant tokens):**
```css
/* Button.module.css */
.root {
  background-color: var(--color-primary);
  color: var(--color-primary-fg);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
}
.root:hover {
  background-color: var(--color-primary-hover);
}
```

**Wrong:**
```css
.button {
  background-color: #15803d;  /* raw hex — use var(--color-primary) */
  padding: 8px 16px;          /* raw px — use var(--space-2) var(--space-4) */
}
```

```

- [ ] **Step 3: Verify the insertion**

Read `plugins/agentic-sdlc/skills/react-conventions/SKILL.md` and confirm:
- `## Design system` section appears before `## API calls`
- `## Component decomposition` section appears before `## API calls`
- `## CSS isolation` section appears before `## API calls`
- `## TypeScript style` section is unchanged

- [ ] **Step 4: Commit**

```bash
git add plugins/agentic-sdlc/skills/react-conventions/SKILL.md
git commit -m "feat(plugin): add design system, component decomposition, CSS isolation to react-conventions"
```

---

### Task 3: Update react-engineer agent — environment detection and design system scaffold

**Files:**
- Modify: `plugins/agentic-sdlc/agents/react-engineer.md`

- [ ] **Step 1: Update step 1 to reference the CSS framework field**

Find:
```
1. Read the story and tech-spec.md. Understand exactly what to build.
```

Replace with:
```
1. Read the story and tech-spec.md. Understand exactly what to build. Note the `CSS framework` field in the Stack section — you will need it in step 2.
```

- [ ] **Step 2: Expand step 2 with detection and design system setup**

Find this exact block (the full step 2 including all its code blocks):
```
2. Check what exists in `<frontend_src>`. If empty, scaffold:
   ```bash
   # `npm create vite` already installs base dependencies; do not run a redundant `npm install`.
   npm create vite@latest <frontend_src> -- --template react-ts
   cd <frontend_src> && npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
   ```
   Update `<frontend_src>/vite.config.ts` to add test config:
   ```typescript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./src/setupTests.ts'],
       coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
     },
   })
   ```
   Create `<frontend_src>/src/setupTests.ts`:
   ```typescript
   import '@testing-library/jest-dom'
   ```
```

Replace with:
```
2. Detect the environment then set up the design system:

   **Existing `<frontend_src>` (has content):** Use the detection table in the react-conventions skill to identify the CSS framework and component structure already in use. Record both — apply them in all subsequent steps. No design system setup needed.

   **Empty `<frontend_src>` (fresh project):** Invoke the `agentic-sdlc:verdant-design` skill to load the design token reference. Then scaffold:
   ```bash
   # `npm create vite` already installs base dependencies; do not run a redundant `npm install`.
   npm create vite@latest <frontend_src> -- --template react-ts
   cd <frontend_src> && npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
   ```
   Update `<frontend_src>/vite.config.ts` to add test config:
   ```typescript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./src/setupTests.ts'],
       coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
     },
   })
   ```
   Create `<frontend_src>/src/setupTests.ts`:
   ```typescript
   import '@testing-library/jest-dom'
   ```
   Then set up the design system based on the `CSS framework` field from `tech-spec.md`:

   **CSS Modules** (use this if tech-spec says "CSS Modules" or if no framework was specified):
   Create `<frontend_src>/src/styles/design-tokens.css` — copy the full content of `colors_and_type.css` from the `agentic-sdlc:verdant-design` skill into this file verbatim.
   Add this as the **first** import in `<frontend_src>/src/main.tsx`:
   ```typescript
   import './styles/design-tokens.css'
   ```

   **Tailwind CSS:**
   ```bash
   cd <frontend_src> && npm install -D tailwindcss @tailwindcss/vite
   ```
   Create `<frontend_src>/src/styles/design-tokens.css` — copy `colors_and_type.css` from the verdant-design skill verbatim.
   Add as the **first** import in `src/main.tsx`: `import './styles/design-tokens.css'`
   Create `<frontend_src>/tailwind.config.ts`:
   ```typescript
   import type { Config } from 'tailwindcss'

   export default {
     content: ['./index.html', './src/**/*.{ts,tsx}'],
     theme: {
       extend: {
         colors: {
           primary:         'var(--color-primary)',
           'primary-hover': 'var(--color-primary-hover)',
           accent:          'var(--color-accent)',
           'fg-1':          'var(--fg-1)',
           'fg-2':          'var(--fg-2)',
           'bg-base':       'var(--bg-base)',
           'bg-surface':    'var(--bg-surface)',
           border:          'var(--border)',
         },
         spacing: {
           1: 'var(--space-1)',
           2: 'var(--space-2)',
           3: 'var(--space-3)',
           4: 'var(--space-4)',
           5: 'var(--space-5)',
           6: 'var(--space-6)',
           8: 'var(--space-8)',
         },
         borderRadius: {
           sm:  'var(--radius-sm)',
           DEFAULT: 'var(--radius-md)',
           md:  'var(--radius-md)',
           lg:  'var(--radius-lg)',
           xl:  'var(--radius-xl)',
           '2xl': 'var(--radius-2xl)',
         },
       },
     },
   } satisfies Config
   ```

   **Bootstrap:**
   ```bash
   cd <frontend_src> && npm install bootstrap
   ```
   Create `<frontend_src>/src/styles/design-tokens.css` — copy `colors_and_type.css` from the verdant-design skill verbatim.
   Create `<frontend_src>/src/styles/_verdant-bootstrap.css`:
   ```css
   /* Override Bootstrap variables with Verdant tokens — import after design-tokens.css */
   :root {
     --bs-primary:        var(--color-primary);
     --bs-primary-rgb:    21, 128, 61;
     --bs-border-radius:  var(--radius-md);
     --bs-font-sans-serif: var(--font-sans);
     --bs-body-color:     var(--fg-1);
     --bs-body-bg:        var(--bg-base);
   }
   ```
   Add to `src/main.tsx` in this order:
   ```typescript
   import './styles/design-tokens.css'
   import './styles/_verdant-bootstrap.css'
   import 'bootstrap/dist/css/bootstrap.min.css'
   ```
```

- [ ] **Step 3: Update step 3 to call out all three convention areas**

Find:
```
3. Follow the react-conventions skill for all style decisions.
```

Replace with:
```
3. Follow the react-conventions skill for all style decisions — including the detected design system token usage, component decomposition rules (feature-scoped for fresh; follow existing for brownfield), and CSS isolation rules (no raw hex/px values, no cross-component style leakage).
```

- [ ] **Step 4: Update Definition of done**

Find:
```
## Definition of done
- `npm run build` exits with code 0, no TypeScript errors.
- Story acceptance criteria are implemented.
- No test files created or modified.
- Only `<frontend_src>` files modified.
```

Replace with:
```
## Definition of done
- `npm run build` exits with code 0, no TypeScript errors.
- Story acceptance criteria are implemented.
- No test files created or modified.
- Only `<frontend_src>` files modified.
- Component decomposition rule followed (feature-scoped for fresh; existing structure for brownfield).
- CSS isolation rules met: no raw hex color values, no raw pixel spacing/radius values, no cross-component style selectors.
- All colors and spacing use design tokens (`var(--color-primary)`, `var(--space-2)`, etc.) or the detected CSS framework equivalent.
```

- [ ] **Step 5: Verify the file**

Read `plugins/agentic-sdlc/agents/react-engineer.md` and confirm:
- Step 1 mentions the `CSS framework` field
- Step 2 has both existing-project and fresh-project branches; fresh branch has CSS Modules, Tailwind, and Bootstrap sub-variants
- Step 3 mentions component decomposition and CSS isolation
- Definition of done has the three new bullet points

- [ ] **Step 6: Commit**

```bash
git add plugins/agentic-sdlc/agents/react-engineer.md
git commit -m "feat(plugin): add environment detection and design system scaffold to react-engineer"
```

---

### Task 4: Update react-reviewer agent — CSS isolation, decomposition, and token checks

**Files:**
- Modify: `plugins/agentic-sdlc/agents/react-reviewer.md`

- [ ] **Step 1: Read the current file**

Read `plugins/agentic-sdlc/agents/react-reviewer.md`. The current process ends at step 6. Confirm:
- Step 4: Check against react-conventions skill
- Step 5: Check story scope
- Step 6: Check for obvious bugs

The three new checks go between step 4 and step 5. Old steps 5 and 6 become steps 8 and 9.

- [ ] **Step 2: Replace steps 5 and 6 with the expanded step list**

Find:
```
5. Check story scope: matches what was asked.
6. Check for obvious bugs: unhandled promise rejections, missing null checks on API responses.
```

Replace with:
```
5. **CSS isolation check:**
   Grep for raw hex values in component and page source files:
   ```bash
   grep -rEn "#[0-9a-fA-F]{3,6}" <frontend_src>/src/components <frontend_src>/src/pages 2>/dev/null
   ```
   Any match outside `design-tokens.css` or `tailwind.config.ts` is a **CRITICAL** issue.

   Grep for raw pixel values in styles:
   ```bash
   grep -rEn ":\s*[0-9]+px" <frontend_src>/src/components <frontend_src>/src/pages 2>/dev/null
   ```
   Flag any match that is not inside `design-tokens.css` as a **WARNING**.

   Visually scan for CSS selectors in component stylesheets that target class names defined in a different component file — flag as **CRITICAL**.

6. **Component decomposition check:**
   - Any component file over ~150 lines: open it and inspect for mixed responsibilities. Flag as **WARNING** if the file contains fetch/API calls AND JSX rendering AND `useState` for non-UI state (e.g. form submission status, pagination).
   - Any component that imports from `src/api/` AND renders JSX AND contains `useReducer` or multiple `useState` calls for business logic: flag as **CRITICAL** — the data-fetching logic belongs in a custom hook.
   - Verify new components follow the detected decomposition pattern: feature-scoped layout for fresh projects (`src/pages/<Name>/SubComponent.tsx`), or the existing folder structure for brownfield.

7. **Design token check:**
   - Fresh project: verify `design-tokens.css` is imported in `main.tsx`.
   - Confirm interactive elements (buttons, inputs, links) use `var(--color-primary)` or framework-equivalent token — not a hard-coded color.
   - Flag any component using hard-coded color or spacing values as a **WARNING**.

8. Check story scope: matches what was asked.
9. Check for obvious bugs: unhandled promise rejections, missing null checks on API responses.
```

- [ ] **Step 3: Update the PASS criteria**

Find:
```
PASS requires: build passes AND no CRITICAL issues.
```

Replace with:
```
PASS requires: build passes AND no CRITICAL issues (including raw hex colors in components, fetch logic inside render components, and cross-component CSS selectors).
```

- [ ] **Step 4: Verify the file**

Read `plugins/agentic-sdlc/agents/react-reviewer.md` and confirm:
- Steps 5, 6, 7 are the new checks
- Steps 8 and 9 are the old story-scope and obvious-bugs checks
- PASS criteria updated

- [ ] **Step 5: Commit**

```bash
git add plugins/agentic-sdlc/agents/react-reviewer.md
git commit -m "feat(plugin): add CSS isolation, decomposition, and token checks to react-reviewer"
```

---

### Task 5: Update architect agent — codebase discovery step

**Files:**
- Modify: `plugins/agentic-sdlc/agents/architect.md`

- [ ] **Step 1: Read the current file**

Read `plugins/agentic-sdlc/agents/architect.md`. Confirm the process currently has steps 1–8:
- Step 1: Read req-spec.md
- Step 2: List REQ-IDs
- Step 3: Design components
- Step 4: Follow write-tech-spec skill
- Step 5: Write deployment topology
- Step 6: Write to tech-spec.md
- Step 7: Self-check
- Step 8: If revising

The new step 1 is inserted before the existing step 1. All existing steps shift up by one.

- [ ] **Step 2: Find and replace the process block**

Find:
```
## Process
1. Read `runs/<run-id>/req-spec.md` fully.
2. List all REQ-IDs you must implement.
3. Design components: decide backend (dotnet) vs frontend (react) split for each REQ.
4. Follow the write-tech-spec skill format.
5. Write the deployment topology section with concrete ports, env vars, service names.
6. Write to `runs/<run-id>/tech-spec.md`.
7. Self-check: confirm every REQ-ID appears in at least one TECH's Implements list.
8. If revising: increment Version; do not change existing TECH IDs.
```

Replace with:
```
## Process
1. **Codebase discovery** — before reading the req-spec, scan the working directory:
   - **Backend:** Glob for `*.csproj` and `src/**/*.cs`. If found: open `Program.cs` and note the .NET version, service registration pattern (minimal API vs controller-based), and any existing endpoint conventions. Check for `Migrations/` or `*DbContext.cs` and note table-naming conventions.
   - **Frontend:** Look for a directory containing `package.json` alongside a `src/` folder (common paths: `src/frontend/`, `src/client/`, `client/`). If found: read `package.json` dependencies to identify the CSS framework (`tailwindcss`, `bootstrap`, etc.), and scan `src/` to identify component folder structure (flat, feature-scoped, or atomic).
   - **Database:** Look for `Migrations/*.cs` or `*.sql` schema files. If found: note table names and their naming convention (PascalCase, snake_case), and any notable constraints or relationship patterns.

   **Brownfield (existing code found):** Document findings in an `## Existing system` section at the top of `tech-spec.md` (before `## Components`). Design all TECHs to align with existing patterns. When a TECH intentionally deviates from an existing pattern, add a note in the TECH description explaining why.

   **Greenfield (no existing code):** Ask the user this question and wait for the response before continuing:
   > "What CSS framework would you like for the frontend? Options: **Tailwind CSS** / **Bootstrap** / **CSS Modules** / other (please specify). If unsure, CSS Modules requires no extra dependencies."

   Record the response — you will write it into the `CSS framework` field in the Stack section of the tech spec.

2. Read `runs/<run-id>/req-spec.md` fully.
3. List all REQ-IDs you must implement.
4. Design components: decide backend (dotnet) vs frontend (react) split for each REQ.
5. Follow the write-tech-spec skill format.
6. Write the deployment topology section with concrete ports, env vars, service names.
7. Write to `runs/<run-id>/tech-spec.md`.
8. Self-check: confirm every REQ-ID appears in at least one TECH's Implements list.
9. If revising: increment Version; do not change existing TECH IDs.
```

- [ ] **Step 3: Update Definition of done**

Find:
```
## Definition of done
- Every REQ-ID from req-spec.md is implemented by at least one TECH-ID.
- Every TECH-ID has at least one REQ in its Implements list.
- Deployment topology names all ports and all required environment variables.
- Stack is exactly: .NET 8 Web API, React 18 + Vite + TypeScript, PostgreSQL, docker-compose.
- `tech-spec.md` saved with Status: draft.
```

Replace with:
```
## Definition of done
- Every REQ-ID from req-spec.md is implemented by at least one TECH-ID.
- Every TECH-ID has at least one REQ in its Implements list.
- Deployment topology names all ports and all required environment variables.
- Stack is exactly: .NET 8 Web API, React 18 + Vite + TypeScript, PostgreSQL, docker-compose.
- Stack section includes the `CSS framework` field (detected or chosen by user).
- Brownfield: `## Existing system` section is present in tech-spec.md.
- `tech-spec.md` saved with Status: draft.
```

- [ ] **Step 4: Verify the file**

Read `plugins/agentic-sdlc/agents/architect.md` and confirm:
- Step 1 is the new codebase discovery step with brownfield and greenfield branches
- Step 2 is "Read req-spec.md"
- Steps 3–9 match the previous steps 2–8
- Definition of done has the two new bullet points

- [ ] **Step 5: Commit**

```bash
git add plugins/agentic-sdlc/agents/architect.md
git commit -m "feat(plugin): add codebase discovery and CSS framework question to architect"
```

---

### Task 6: Update write-tech-spec skill — CSS framework and existing system section

**Files:**
- Modify: `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md`

- [ ] **Step 1: Add CSS framework to the fixed stack declaration**

Find:
```
## Stack (fixed for all runs)
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose
```

Replace with:
```
## Stack (fixed for all runs)
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose
- CSS framework: set by Architect during codebase discovery (Tailwind CSS | Bootstrap | CSS Modules | detected from existing project)
```

- [ ] **Step 2: Add CSS framework to the Stack section inside the template**

The template is inside the `## Format` code block. Find (inside that block):
```
## Stack
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose
```

Replace with:
```
## Stack
- Backend: .NET 8, ASP.NET Core Web API
- Frontend: React 18 + Vite + TypeScript
- Database: PostgreSQL (via Docker)
- Deployment: docker-compose
- CSS framework: <Tailwind CSS | Bootstrap | CSS Modules | detected: X>
```

- [ ] **Step 3: Add the optional Existing system section to the template**

Inside the `## Format` code block, find:
```
## Components
```

Insert the following block immediately before that line:
```
## Existing system *(brownfield only — omit entirely for greenfield)*
- Backend patterns: <service layer approach, middleware, auth, naming conventions>
- Frontend patterns: <CSS framework, component folder structure, state management>
- Database patterns: <table naming, migration approach, notable constraints>
- Decisions preserved: <list of existing patterns new TECHs must not break>
- Intentional deviations: <list of changes from existing patterns, each with justification>

```

- [ ] **Step 4: Add two items to the quality checklist**

Find:
```
- [ ] Status is "draft"
```

Replace with:
```
- [ ] Status is "draft"
- [ ] CSS framework is specified in the Stack section
- [ ] Brownfield: `## Existing system` section is present and all new TECHs align with it or document their deviation
```

- [ ] **Step 5: Verify the file**

Read `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md` and confirm:
- The fixed stack declaration has the CSS framework line
- The template Stack section has the `CSS framework` placeholder
- The template has `## Existing system` section before `## Components`
- The checklist has the two new items at the end

- [ ] **Step 6: Commit**

```bash
git add plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md
git commit -m "feat(plugin): add CSS framework field and existing system section to write-tech-spec"
```
