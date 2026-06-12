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
  - Semantic states: `--color-success`, `--color-warning`, `--color-error`, `--color-info` (each has `-subtle` and `-fg` variants)
  - Spacing: `--space-1` (4px) through `--space-24` (96px)
  - Radius: `--radius-sm` (4px), `--radius-md` (6px), `--radius-lg` (8px), `--radius-xl` (12px), `--radius-2xl` (16px), `--radius-full` (9999px)
  - Typography: `--font-sans`, `--text-base` (14px), `--weight-semibold`, `--leading-normal`

## Files
- `README.md` — full design system reference: colors, typography, spacing, iconography, copy rules, component patterns
- `colors_and_type.css` — all CSS custom properties; copy this directly into `src/styles/design-tokens.css` in the frontend project

Read `README.md` now to load full design system context.
