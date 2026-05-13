---
name: react-conventions
description: Project-specific React coding conventions. Used by React Engineer, Reviewer, Test Engineer, and Test Reviewer.
---

# React Conventions

## Project structure
```
react/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── <Name>/
│   │       ├── <Name>.tsx
│   │       └── <Name>.test.tsx
│   ├── pages/            # Route-level page components
│   │   └── <Name>Page/
│   │       ├── <Name>Page.tsx
│   │       └── <Name>Page.test.tsx
│   ├── hooks/            # Custom React hooks
│   ├── api/              # fetch wrappers (one file per resource)
│   ├── types/            # TypeScript type definitions
│   └── App.tsx
├── index.html
├── vite.config.ts
└── package.json
```

## Component conventions
- Functional components only — no class components.
- One component per file; filename matches component name.
- Props typed with TypeScript interface: `interface FooProps { ... }`
- Named exports: `export function Foo({ prop }: FooProps) { ... }`

## State management
- `useState` for local component state.
- `useContext` + `useReducer` for shared state.
- Custom hooks for data-fetching: `useFoo()` → `{ data, isLoading, error }`.

## TypeScript style
- Strict mode enabled (`"strict": true` in tsconfig).
- No `any` types — use `unknown` and narrow, or define proper types.
- API response types defined in `src/types/`.

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

## API calls
```typescript
// src/api/todos.ts
export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/todos`);
  if (!res.ok) throw new Error(`Failed to fetch todos: ${res.status}`);
  return res.json();
}
```
- All fetch calls in `src/api/<resource>.ts` only.
- Base URL from `import.meta.env.VITE_API_URL`.

## Vitest + React Testing Library patterns
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import * as todosApi from '../../api/todos';
import { TodoList } from './TodoList';

vi.mock('../../api/todos');

describe('TodoList', () => {
  it('renders todo items when loaded', async () => {
    (todosApi.fetchTodos as Mock).mockResolvedValue([{ id: 1, title: 'Test todo' }]);
    render(<TodoList />);
    await waitFor(() => {
      expect(screen.getByText('Test todo')).toBeInTheDocument();
    });
  });
});
```

## Commands
```bash
npm run build         # Expected: vite build succeeds, no TypeScript errors
npm test -- --run     # Expected: all tests pass
```
