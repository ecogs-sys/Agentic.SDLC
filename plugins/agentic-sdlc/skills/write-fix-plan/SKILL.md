---
name: write-fix-plan
description: Template and rules for the Fix Planner's fix-plan.md — an evidence-cited investigation (code path trace, root cause / insertion points, proposed changes, test plan, story stubs) for the bug_fix and small_change tiers. Used by the fix-planner agent.
---

# Writing a Fix Plan

A fix plan replaces guesswork with evidence. It traces the ACTUAL code path the
reported scenario exercises, establishes root cause (bug_fix) or insertion points
(small_change) with `file:line` citations, and ends in 1–3 story stubs ready for
development — no separate Tech Lead stage is needed.

## Hard rules
- Every claim in **Code path trace**, **Root cause / Insertion points**, and
  **Risk / blast radius** cites a real `file:line`.
- No speculative language ("probably", "likely", "should") outside
  `## Open questions`. If you cannot verify something by reading code, put it in
  Open questions instead of asserting it.
- If the scenario cannot be reproduced, say so explicitly in
  **Reproduction / evidence** with what was attempted — never fake a result.
- Do not modify production source. Read/run only; delete any throwaway repro
  files before finishing.

## Format

```markdown
# Fix Plan
Run ID: <run-id>
Captured: <YYYY-MM-DD HH:MM>
Version: <n>

## Request
<one-line restatement + the example scenario verbatim>

## Reproduction / evidence
- How the scenario was traced or reproduced (commands run, tests executed)
- Observed vs. expected behavior

## Code path trace
- <entry point file:line> → <file:line> → ... → <failure/insertion point>
  (each hop cites the real file:line and one line of what happens there)

## Root cause (bug_fix) / Insertion points (small_change)
<the verified cause or the exact places new code hooks in — every claim cites file:line>

## Proposed changes
- <relative/path> — <what changes and why> (or "new file")

## Risk / blast radius
- <call sites / features that share the touched code, with file:line refs>

## Test plan
- <which tests prove the fix/change; new tests to add>

## Open questions
- <anything not verifiable from the code — or "none">

## Stories
### STORY-001 — <title>
- track: dotnet | react | electron
- wave: 1
- description: <what to implement>
- acceptance criteria: <derived from the request + test plan>
(1–3 stories max; two tracks → separate stories)
```

## Quality checklist (self-check before finishing)
- [ ] Every claim in Code path trace / Root cause / Risk cites `file:line`
- [ ] No speculative language outside Open questions
- [ ] Reproduction / evidence states what was actually run, and the real result
- [ ] Every proposed-change path appears in at least one story
- [ ] 1–3 stories, each with track, wave, description, acceptance criteria
- [ ] Code path trace reaches a concrete failure/insertion point
- [ ] Version bumped on revision; Request section restates the scenario verbatim
