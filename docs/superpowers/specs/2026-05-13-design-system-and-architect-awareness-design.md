# Design: Design System Awareness + Architect Codebase Intelligence

Date: 2026-05-13  
Status: approved

---

## Problem

Two gaps in the current Agentic SDLC plugin:

1. **React agents are design-blind.** The react-engineer scaffolds bare Vite+React with no design system, no CSS isolation strategy, and no component decomposition guidance. The react-reviewer has no design compliance checks. Result: engineers pick arbitrary CSS approaches and build monolithic components.

2. **The Architect ignores the existing codebase.** The architect reads req-spec and immediately writes a tech spec, with no step to inspect the working directory for existing code. On brownfield projects this produces specs that conflict with the current stack. On greenfield projects it misses key setup decisions (like CSS framework choice).

---

## Goals

- For **greenfield** frontend work: the Architect asks the user to choose a CSS framework; the React engineer scaffolds with that choice plus the Verdant Design System tokens; components follow feature-scoped decomposition with module-level CSS isolation.
- For **brownfield** frontend work: the React engineer detects the existing design system and component structure and follows them exactly.
- For **all** Architect runs: a codebase discovery step runs first; findings inform the tech spec; if brownfield, the tech spec documents the existing stack and which patterns are preserved or intentionally changed.

---

## Non-goals

- Replacing or wrapping the Verdant Design System — it is embedded as-is.
- Enforcing a specific component library (Shadcn, MUI, etc.) — the design system covers tokens and conventions only.
- Changing the BA, tech-lead, dotnet, or devops agents.
- Updating react-test-engineer or react-test-reviewer (behavior testing, not visual).

---

## Feature 1: Design system, CSS isolation, component decomposition

### 1.1 New skill: `verdant-design`

**Path:** `plugins/agentic-sdlc/skills/verdant-design/`

Copy the following files from `C:\Work\ecogs\branding\Design System\Verdant Design System` into this skill directory:
- `SKILL.md` — skill descriptor (already written, describes the design system)
- `README.md` — full design system documentation (colors, type, spacing, components)
- `colors_and_type.css` — all CSS custom properties

The UI kit `.jsx` files are reference only and are **not** copied — the plugin generates `.tsx`. Engineers read the README for component patterns and translate them.

This makes the design system self-contained inside the plugin with no external path dependency.

### 1.2 Detection logic (shared rule for react-engineer and react-reviewer)

When operating on `<frontend_src>`, detect the CSS framework by scanning in this order:

| Signal | Framework |
|---|---|
| `tailwind.config.ts` or `tailwind.config.js` present | Tailwind — use utility classes; wire Verdant tokens into `tailwind.config.ts` as custom colors/spacing |
| `bootstrap` in `package.json` dependencies | Bootstrap — override Bootstrap CSS variables with Verdant tokens in a global `_variables.css` |
| `*.module.css` files present | CSS Modules — `var(--token)` inside module files; Verdant tokens loaded globally |
| `styled-components` or `@emotion/*` in `package.json` | CSS-in-JS — follow existing patterns; reference Verdant tokens via `createGlobalStyle` or theme |
| `<frontend_src>` exists with content but none of the above signals found | Plain CSS / unknown — follow existing CSS conventions; do **not** inject Verdant tokens |
| Empty / no `<frontend_src>` | Fresh project — CSS framework is specified in `tech-spec.md`; read it |

For fresh projects the Architect records the CSS framework in the tech spec (see §2 below). The React engineer reads tech spec before scaffolding.

### 1.3 Component decomposition rule

**Fresh project:** Feature-scoped decomposition.
- Components live alongside the page or feature that owns them.
- A component is promoted to shared `src/components/` only when two or more distinct features use it.
- No Atomic Design folder hierarchy imposed.

**Existing project:** Match the existing structure exactly. Before writing any component, scan `<frontend_src>/src/` and identify the current layout (flat, feature-scoped, atomic, etc.). Follow it.

### 1.4 CSS isolation rule

Applies regardless of framework:
- Every component owns its styles. No component applies classes or styles that affect elements outside itself.
- No raw hex color values in component code — use design tokens (`var(--green-700)`, `text-green-700`, etc.).
- No raw pixel values for spacing/radius — use token-derived values.
- No global class names that could collide (`button`, `card`, `table` as bare class names are forbidden — scope them).

### 1.5 Changes to `react-conventions/SKILL.md`

Add three new sections after the existing "TypeScript style" section:

**Design system section:** Detection rules from §1.2; instruction to read `verdant-design` skill when fresh.

**Component decomposition section:** Feature-scoped rule for fresh projects; follow-existing rule for brownfield; definition of "shared component" (used by 2+ features).

**CSS isolation section:** The four rules from §1.4; example of correct vs incorrect token usage.

### 1.6 Changes to `react-engineer.md`

Add a new step **before** the existing step 1, labeled "Step 0: Detect environment":

1. Check if `<frontend_src>` exists and has content.
2. If existing: run detection logic (§1.2) to identify CSS framework and component structure. Note both for use in all subsequent steps.
3. If fresh: read `runs/<run-id>/tech-spec.md` for the chosen CSS framework. Read the `verdant-design` skill. During scaffold (existing step 2), also:
   - Create `<frontend_src>/src/styles/design-tokens.css` by copying content from the verdant-design skill's `colors_and_type.css`.
   - Import it in `<frontend_src>/src/main.tsx`: `import './styles/design-tokens.css'`
   - If Tailwind: extend `tailwind.config.ts` with Verdant color and spacing tokens.

Also update the "Definition of done" to add: component decomposition followed, CSS isolation rules met, no hard-coded color/spacing values.

### 1.7 Changes to `react-reviewer.md`

Add three new checks after the existing step 4:

**Step 4a — CSS isolation check:**
- Grep for raw hex values (`#[0-9a-fA-F]{3,6}`) in component files. Any hit is a CRITICAL issue unless it is inside `design-tokens.css` or `tailwind.config.ts`.
- Grep for bare pixel values in inline styles or non-token CSS (e.g. `color: #333`, `padding: 13px`). Flag as WARNING.
- Check that no component applies styles that target elements in sibling or parent components.

**Step 4b — Component decomposition check:**
- Any component file over ~150 lines: inspect for multiple responsibilities (data fetch + render + form logic). Flag as WARNING if mixed.
- Any component that contains fetch logic and JSX rendering and state management together: flag as CRITICAL.
- Verify new components follow the detected or fresh-project decomposition rule.

**Step 4c — Design token usage check:**
- Verify Verdant CSS variables are imported (fresh) or existing tokens are used (brownfield).
- Check that interactive elements (buttons, inputs) use token-based colors, not arbitrary values.

---

## Feature 2: Architect codebase awareness

### 2.1 Changes to `architect.md`

Add a new **Step 0: Codebase discovery** before the existing step 1:

**Scan the working directory:**
- Backend: look for `*.csproj`, `src/**/*.cs`, `Program.cs`. If found: note the .NET version, service registration patterns, existing API endpoint patterns, EF Core DbContext and migration files.
- Frontend: look for `src/frontend/` or `src/client/` or similar. If found: identify CSS framework (tailwind.config, package.json), component structure, state management approach.
- Database: look for `Migrations/`, `*.sql` schema files. If found: note table names, naming conventions, relationship patterns.

**Decision fork:**
- **Existing system found:** Document findings in a brief "Existing system" section at the top of `tech-spec.md`. Design all TECHs to align with existing patterns unless req-spec explicitly requires a change. When a TECH deviates from the existing pattern, add a note explaining why.
- **No existing code (greenfield):** Ask the user one question before proceeding: *"What CSS framework would you like for the frontend? (Tailwind CSS / Bootstrap / CSS Modules / other)"*. Record the answer. Proceed with best practices for the fixed stack.

### 2.2 Changes to `write-tech-spec/SKILL.md`

**Add to the Stack section of the template:**

```markdown
- CSS framework: <Tailwind CSS | Bootstrap | CSS Modules | detected: X>
```

**Add an optional section to the template:**

```markdown
## Existing system (brownfield only — omit for greenfield)
- Backend patterns: <service layer approach, middleware, auth, naming conventions>
- Frontend patterns: <CSS framework, component structure, state management>
- Database patterns: <naming conventions, migration approach, notable constraints>
- Decisions preserved: <list of existing patterns the new TECHs must not break>
- Intentional deviations: <list of changes from existing patterns, each with justification>
```

**Add to the quality checklist:**
- [ ] CSS framework is specified in the Stack section
- [ ] If brownfield: "Existing system" section is present and all new TECHs align with it or document deviation

---

## File change summary

| # | Path | Change type |
|---|---|---|
| 1 | `plugins/agentic-sdlc/skills/verdant-design/SKILL.md` | New (copy from branding) |
| 2 | `plugins/agentic-sdlc/skills/verdant-design/README.md` | New (copy from branding) |
| 3 | `plugins/agentic-sdlc/skills/verdant-design/colors_and_type.css` | New (copy from branding) |
| 4 | `plugins/agentic-sdlc/skills/react-conventions/SKILL.md` | Update — add design system, decomposition, CSS isolation sections |
| 5 | `plugins/agentic-sdlc/agents/react-engineer.md` | Update — add Step 0 detection + scaffold design system setup |
| 6 | `plugins/agentic-sdlc/agents/react-reviewer.md` | Update — add CSS isolation, decomposition, and token checks |
| 7 | `plugins/agentic-sdlc/agents/architect.md` | Update — add Step 0 codebase discovery + CSS framework question |
| 8 | `plugins/agentic-sdlc/skills/write-tech-spec/SKILL.md` | Update — add CSS framework field + Existing system section |

---

## Open questions / assumptions

- The Verdant Design System's JSX components (`ui_kits/admin/*.jsx`) are not copied into the plugin. Engineers use the README for visual reference and write `.tsx` from scratch. If this needs to change (e.g. copy and convert to `.tsx`), that is a separate task.
- "Ask the user for CSS framework" in the Architect assumes an interactive session. If running fully automated (no human in the loop), the architect should default to CSS Modules as the safest zero-dependency choice and note the assumption in the tech spec.
- The brownfield detection is best-effort. If the existing codebase uses an unusual structure, the architect notes "structure unclear" rather than guessing.
