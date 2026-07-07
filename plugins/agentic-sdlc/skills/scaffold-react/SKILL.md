---
name: scaffold-react
description: One-time Vite + TypeScript + design-system scaffold for a fresh React frontend. Used by the React Engineer ONLY when <frontend_src> is empty (the first story of a greenfield run).
---

# Scaffold: React (Vite + TS) + Verdant design system

Run this ONLY when `<frontend_src>` is empty. First invoke the
`agentic-sdlc:verdant-design` skill to load the design token reference. Then:

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

Then set up the design system based on the `CSS framework` field from
`tech-spec.md`:

## CSS Modules (default — use if tech-spec says "CSS Modules" or nothing)

Create `<frontend_src>/src/styles/design-tokens.css` — copy the full content of
`colors_and_type.css` from the `agentic-sdlc:verdant-design` skill into this file
verbatim. Add this as the **first** import in `<frontend_src>/src/main.tsx`:
```typescript
import './styles/design-tokens.css'
```

## Tailwind CSS (v3 + PostCSS — stable and compatible with `tailwind.config.ts`)

```bash
cd <frontend_src> && npm install -D tailwindcss@3 postcss autoprefixer && npx tailwindcss init -p
```
Create `<frontend_src>/src/styles/design-tokens.css` — copy `colors_and_type.css`
from the verdant-design skill verbatim.
Create `<frontend_src>/src/styles/tailwind.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
Add to `src/main.tsx` in this order (tokens first, then Tailwind):
```typescript
import './styles/design-tokens.css'
import './styles/tailwind.css'
```
The `design-tokens.css` import is required — Tailwind emits `var(--color-primary)`
references that only resolve because these CSS variables are loaded globally.
Replace the generated `tailwind.config.js` with `<frontend_src>/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:           'var(--color-primary)',
        'primary-hover':   'var(--color-primary-hover)',
        'primary-active':  'var(--color-primary-active)',
        'primary-subtle':  'var(--color-primary-subtle)',
        'primary-fg':      'var(--color-primary-fg)',
        accent:            'var(--color-accent)',
        'accent-hover':    'var(--color-accent-hover)',
        'accent-subtle':   'var(--color-accent-subtle)',
        'accent-fg':       'var(--color-accent-fg)',
        success:           'var(--color-success)',
        'success-subtle':  'var(--color-success-subtle)',
        'success-fg':      'var(--color-success-fg)',
        warning:           'var(--color-warning)',
        'warning-subtle':  'var(--color-warning-subtle)',
        'warning-fg':      'var(--color-warning-fg)',
        error:             'var(--color-error)',
        'error-subtle':    'var(--color-error-subtle)',
        'error-fg':        'var(--color-error-fg)',
        info:              'var(--color-info)',
        'info-subtle':     'var(--color-info-subtle)',
        'info-fg':         'var(--color-info-fg)',
        'fg-1':            'var(--fg-1)',
        'fg-2':            'var(--fg-2)',
        'fg-3':            'var(--fg-3)',
        'fg-invert':       'var(--fg-invert)',
        'bg-base':         'var(--bg-base)',
        'bg-surface':      'var(--bg-surface)',
        'bg-subtle':       'var(--bg-subtle)',
        'bg-muted':        'var(--bg-muted)',
        'bg-hover':        'var(--bg-hover)',
        'bg-active':       'var(--bg-active)',
        border:            'var(--border)',
        'border-strong':   'var(--border-strong)',
        'border-focus':    'var(--border-focus)',
      },
      spacing: {
        1:  'var(--space-1)',
        2:  'var(--space-2)',
        3:  'var(--space-3)',
        4:  'var(--space-4)',
        5:  'var(--space-5)',
        6:  'var(--space-6)',
        8:  'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
        20: 'var(--space-20)',
        24: 'var(--space-24)',
      },
      borderRadius: {
        sm:      'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md:      'var(--radius-md)',
        lg:      'var(--radius-lg)',
        xl:      'var(--radius-xl)',
        '2xl':   'var(--radius-2xl)',
        full:    'var(--radius-full)',
      },
    },
  },
} satisfies Config
```

## Bootstrap

```bash
cd <frontend_src> && npm install bootstrap
```
Create `<frontend_src>/src/styles/design-tokens.css` — copy `colors_and_type.css`
from the verdant-design skill verbatim.
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
