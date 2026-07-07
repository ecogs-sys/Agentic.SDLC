---
name: react-testing
description: Project-specific React testing conventions — Vitest + React Testing Library patterns and test-execution discipline. Used by the React Test Engineer and React Test Reviewer.
---

# React Testing Conventions

Tests are co-located with components as `<Component>.test.tsx` inside
`<frontend_src>/src/`.

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

- Test **UI behavior** (text on screen, user interactions via `userEvent`), not
  implementation details (internal state, private functions, exact DOM structure).
- Mock all API calls with `vi.mock()` at the `src/api/` boundary — tests never hit
  the network.
- Cover each acceptance criterion with ≥1 happy-path test AND ≥1 negative/edge test
  (error state, empty state).

## Test-execution discipline

The suite is verified once per change, and only by the agent that owns that change:

- **The test-engineer runs focused tests only:** `npm test -- --run
  <path/to/specific.test.tsx>` for a quick sanity check, plus `npx tsc --noEmit` to
  type-check. It does not run the coverage pass.
- **The test-reviewer owns the authoritative coverage run:** scoped to the story's
  test files by default, or the full suite when `full_suite = true`
  (`npm test -- --run --coverage [paths…]`).
- **At most one `npm test` in flight at a time.** Concurrent runs collide on fixed
  ports, temp files, and CPU — flakiness and net *slowdown*, never a speedup. Run
  once per change and let it finish.
- **Truncate error output.** Report only failing test names and the first ~5
  distinct errors — never full stack traces.
- **Cap the inner fix loop at 3.** Stop after 3 consecutive failed fix attempts on
  the same persistent error and report to the orchestrator.
