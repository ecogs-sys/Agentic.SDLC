---
name: write-codebase-context
description: Template and conventions for the Code Surveyor's codebase-context.md (existing-system survey, impact map, test baseline, proposed tier). Used by the code-surveyor agent.
---

# Writing Codebase Context

`codebase-context.md` is the shared source of truth for a brownfield change. Every
downstream agent reads it. Two depths:

- **shallow** — fill Stack, Conventions, Impact map, Test baseline, Infra
  assessment, Proposed tier. Leave `## Architecture map` as `(not surveyed — shallow)`.
- **deep** — additionally fill `## Architecture map`.

## Depth by tier
- Triage recon (before the tier is confirmed): **shallow**.
- After the user confirms the tier: `bug_fix`/`small_change` stay **shallow**;
  `new_feature` is re-surveyed at **deep**.

## Format

```markdown
# Codebase Context
Run ID: <run-id>
Captured: <YYYY-MM-DD HH:MM>
Survey depth: shallow | deep
Version: <n>

## Stack
- Backend: <.NET version from *.csproj, or "none found">
- Frontend: <React version + CSS framework from package.json, or "none found">
- Database: <provider from DbContext/migrations/connection strings, or "none found">
- Infra: <docker-compose.yml present? CI config present?>

## Conventions
- Backend: <DI/registration style, Clean-Architecture layout, naming, test framework>
- Frontend: <component folder structure, state management, styling, test framework>

## Architecture map
<deep only: modules/layers and their responsibilities; key entry points. For shallow: "(not surveyed — shallow)">

## Impact map
- Request: <one-line restatement of the user's request>
- Affected track(s): dotnet | react | both
- Likely-affected files/modules:
  - <relative/path> — <why it is touched>
- Affected areas: <feature/area names>

## Test baseline
- Backend test command: <e.g. `dotnet test <backend_test>`, or "n/a">
- Frontend test command: <e.g. `npm test --prefix <frontend_src> -- --run`, or "n/a">
- Result: <N passed / M failed / suite missing>
- Pre-existing failures (NOT caused by this change):
  - <test id or "none">

## Infra change assessment
- infra_change_required: true | false
- rationale: <why infra (compose/env/ports/deps) must or need not change>

## Proposed tier
- tier: bug_fix | small_change | new_feature
- rationale: <2–3 sentences tying the request + impact map to the tier>
```

## Tier rubric (how to propose a tier)
- **bug_fix** — restoring intended behavior; localized; no new endpoints/screens/
  data model changes. Usually one or two files.
- **small_change** — a small, well-bounded enhancement: a new field, a tweaked
  rule, one new endpoint or screen, no cross-cutting redesign.
- **new_feature** — a new capability spanning multiple components/layers, new data
  model or multiple endpoints/screens, or anything needing architectural decisions.

## Quality checklist (self-check before finishing)
- [ ] Every path in the Impact map exists in the repo (or is explicitly "new file")
- [ ] Test baseline records the actual commands run and their real result
- [ ] infra_change_required has a concrete rationale
- [ ] Proposed tier matches the rubric
- [ ] `Survey depth` matches what was actually filled in
