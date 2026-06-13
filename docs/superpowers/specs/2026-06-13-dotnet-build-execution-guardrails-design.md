# .NET Build & Test Execution Guardrails — Design

**Date:** 2026-06-13
**Status:** Approved (design), pending spec review
**Scope:** `plugins/agentic-sdlc` — .NET agents + `dotnet-conventions` skill

## Problem

A user proposed adding a ".NET Test & Subagent Constraints" block to the repo-root
`CLAUDE.md` to stop the pipeline's .NET subagents from getting trapped in slow
test-and-compile loops on Ubuntu and from flooding context with full stack traces.

The proposed *placement* is wrong for this repo. This repo is a **distributable Claude
Code plugin**, not a .NET application. The root `CLAUDE.md` governs Claude only while
someone develops the plugin itself (markdown agent/skill definitions — there is no .NET
solution here). It does **not** travel with the plugin and does **not** reach the
`dotnet-engineer` / `dotnet-test-engineer` / `dotnet-reviewer` / `dotnet-test-reviewer`
subagents when an end user installs the plugin and runs the pipeline against *their* .NET
project. Those agents run in the end user's repo, governed by the end user's `CLAUDE.md`
(or none).

The guardrails themselves are sound. They belong in the artifacts that **do** travel with
the plugin and **are** loaded by the .NET subagents: the agent definitions and the
`dotnet-conventions` skill.

## What already exists (so we don't duplicate)

- **Outer orchestration loops are already bounded.** Every stage loop in
  `commands/advance-stage.md` is capped at 5 iterations. The risk is **not** in
  orchestration.
- The real gaps are the **inner** loops *inside a single agent invocation* (an agent
  retrying `dotnet build` / `dotnet test` repeatedly) and **context bloat** from dumping
  full stack traces.
- `dotnet-engineer` already caps its inner build-fix loop at **3** attempts and reports
  out. No other .NET agent has an inner cap.
- Agents already target `<backend_src>` / `--filter` rather than blind solution runs in
  most places, but this is not stated as an explicit rule.
- **No agent truncates error output today.**

## Decision: placement

**Centralize in `dotnet-conventions`, with thin references in each agent.**

`dotnet-conventions` is the designated .NET home and is already loaded by all four .NET
agents. A single new section there is the source of truth; each agent gets a one-or-two
line reference plus its own explicit inner-loop cap. This avoids the four-way drift of
duplicating full rules per agent, and avoids the extra wiring of a brand-new skill.

Rejected alternatives:
- **Full rules duplicated into each agent file** — four copies that will drift.
- **A new dedicated skill** (`dotnet-build-discipline`) — `dotnet-conventions` already
  fills this role and is already loaded everywhere; a second skill is wiring for no gain.

## Changes

### 1. New section in `skills/dotnet-conventions/SKILL.md`

Add a section "Build & test execution discipline (CI/Ubuntu)" with four rules, stated
once:

1. **Error-output truncation.** When a `dotnet build` / `dotnet test` produces more than
   ~30 lines of errors, read only the first ~5 distinct failures (e.g. pipe through
   `head`, or use `--verbosity quiet`) rather than the full stack trace. Fix those and
   rebuild — repeated errors usually share one root cause.
2. **Scoped targeting.** During iteration, build/test the specific project
   (`dotnet test <AppName>.Tests.csproj --filter ...`), not the whole solution. The
   single authoritative full-solution run with coverage stays where it belongs: the test
   reviewer's gate.
3. **`--no-build` / `--no-restore` discipline, with a staleness guard.** Reuse binaries
   (`dotnet test --no-build`) only when a successful build has already happened **this
   invocation** and nothing has changed since. Force a clean build whenever a `.csproj`,
   project reference, or package changed — and **always** for the test reviewer's
   authoritative coverage run. Never report a pass off stale binaries.
4. **Inner-loop cap.** Stop after **3** consecutive failed fix attempts on the *same*
   persistent error; report the (truncated) logs to the orchestrator instead of a fourth
   attempt. The orchestrator's outer loop (cap 5) handles escalation.

### 2. Per-agent touch-ups

- **`dotnet-engineer`** — keep its existing 3-attempt cap (unchanged number); add a
  pointer to the skill's truncation rule when it excerpts build errors.
- **`dotnet-test-engineer`** — add an explicit **3**-attempt cap on its compile loop +
  truncation pointer (currently has neither).
- **`dotnet-reviewer`** — when excerpting a failed build into its report, apply the
  truncation rule (keeps the PASS/FAIL report lean). No loop cap needed — it does not
  loop.
- **`dotnet-test-reviewer`** — same truncation pointer for failing-test excerpts. No loop
  cap needed.

Inner-loop cap number is **3 across the board** (per user decision — no change to the
proven engineer value).

### 3. Release mechanics (required by repo `CLAUDE.md`)

This lands as a PR to `master`, so:
- Bump `version` in `plugins/agentic-sdlc/.claude-plugin/plugin.json`.
- Add a matching `CHANGELOG.md` entry.

## Out of scope

- No changes to React agents or `react-conventions` (this is .NET-specific).
- No change to the orchestrator's outer loop caps (already bounded at 5).
- No `CLAUDE.local.md` / root `CLAUDE.md` additions — wrong target for plugin behavior.

## Success criteria

- All four .NET agents either reference or carry the truncation rule.
- `dotnet-test-engineer` has an explicit inner-loop cap (3).
- `dotnet-conventions` states scoped targeting + `--no-build` staleness guard as explicit
  rules.
- Plugin version bumped + CHANGELOG entry added.
