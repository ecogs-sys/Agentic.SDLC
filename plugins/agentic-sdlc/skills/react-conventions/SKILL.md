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
