# .NET Build & Test Execution Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add build/test execution guardrails (error-output truncation, scoped targeting, `--no-build` staleness guard, inner-loop cap) to the plugin's .NET agents so the pipeline's .NET subagents stay fast and context-lean in end-user repos.

**Architecture:** Centralize the four rules in one new section of the `dotnet-conventions` skill (already loaded by all four .NET agents), then add thin one-or-two-line references and the missing inner-loop cap to each agent file. No root-`CLAUDE.md` change — that does not travel with the plugin.

**Tech Stack:** Markdown only (Claude Code plugin: agent definitions + skill files). No code, no compiler. "Tests" here are grep/consistency checks that the exact text landed.

**Source of truth:** `docs/superpowers/specs/2026-06-13-dotnet-build-execution-guardrails-design.md`

---

## File Structure

| File | Change |
|------|--------|
| `plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md` | Add new section "Build & test execution discipline (CI/Ubuntu)" after the existing `## Commands` section |
| `plugins/agentic-sdlc/agents/dotnet-engineer.md` | Add truncation pointer to its existing 3-attempt build-fail Failure mode |
| `plugins/agentic-sdlc/agents/dotnet-test-engineer.md` | Add a new 3-attempt compile-loop cap + truncation pointer (currently has neither) |
| `plugins/agentic-sdlc/agents/dotnet-reviewer.md` | Add truncation note when excerpting a failed build into its report |
| `plugins/agentic-sdlc/agents/dotnet-test-reviewer.md` | Add truncation note when excerpting failing tests into its report |
| `plugins/agentic-sdlc/.claude-plugin/plugin.json` | Bump `version` `0.6.2` → `0.6.3` |
| `CHANGELOG.md` | Add `[0.6.3]` entry |

Decision recap: inner-loop cap is **3 across the board** (per user — `dotnet-engineer` keeps its existing value, `dotnet-test-engineer` gains a matching cap). Reviewers do not loop, so they get truncation only.

---

### Task 1: Add the guardrails section to `dotnet-conventions`

**Files:**
- Modify: `plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md` (append after the `## Commands` section at the end of the file)

- [ ] **Step 1: Add the new section**

Find the current final section:

```markdown
## Commands
```bash
dotnet build          # Expected: Build succeeded.
dotnet test           # Expected: All tests pass.
```
```

Append immediately after it (end of file):

```markdown

## Build & test execution discipline (CI/Ubuntu)

These rules keep agent runs fast and context lean — a full solution build-and-test cycle is
slow on Linux/CI, and full stack traces waste the agent's context budget.

- **Truncate error output.** When `dotnet build` / `dotnet test` emits more than ~30 lines of
  errors, do NOT read or echo the whole trace. Read only the first ~5 distinct errors and fix
  those — repeated errors usually share one root cause. Scope output at the source:
  ```bash
  dotnet build <backend_src> 2>&1 | head -n 30
  ```
- **Target the specific project while iterating.** Build/test the project you changed, not the
  whole solution:
  ```bash
  dotnet test <backend_test>/<AppName>.Tests/<AppName>.Tests.csproj --filter "FullyQualifiedName~<ClassUnderTest>"
  ```
  The single authoritative full-solution run with coverage belongs to the Test Reviewer's gate,
  not to iteration.
- **Reuse binaries only when safe (`--no-build` / `--no-restore`).** After a successful build in
  the same invocation with nothing changed since, you may re-run tests with `dotnet test
  --no-build` to save time. Force a clean build (drop the flags) whenever a `.csproj`, project
  reference, or package changed — and ALWAYS for the Test Reviewer's authoritative coverage run.
  Never report a pass off stale binaries.
- **Cap the inner fix loop at 3.** Within a single agent invocation, stop after 3 consecutive
  failed fix attempts on the same persistent build/test error. Report the (truncated) logs to the
  orchestrator instead of attempting a fourth — the orchestrator's outer loop handles escalation.
```

- [ ] **Step 2: Verify the section landed**

Run: `grep -n "Build & test execution discipline" plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md`
Expected: one match.

Run: `grep -c "no-build\|Truncate error output\|inner fix loop" plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md`
Expected: `3` (or more).

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md
git commit -m "feat(dotnet-conventions): add build/test execution discipline section"
```

---

### Task 2: Add truncation pointer to `dotnet-engineer`

**Files:**
- Modify: `plugins/agentic-sdlc/agents/dotnet-engineer.md` (Failure modes section)

- [ ] **Step 1: Update the build-fail Failure mode**

Find:

```markdown
- If `dotnet build` still fails after 3 fix attempts: report the build error to the orchestrator; do not loop further.
```

Replace with:

```markdown
- If `dotnet build` still fails after 3 fix attempts: report the build error to the orchestrator; do not loop further. Excerpt only the first ~5 distinct errors (see the dotnet-conventions skill, "Build & test execution discipline") — do not paste the full trace.
```

- [ ] **Step 2: Verify**

Run: `grep -n "first ~5 distinct errors" plugins/agentic-sdlc/agents/dotnet-engineer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/dotnet-engineer.md
git commit -m "feat(dotnet-engineer): truncate build-error output on report-out"
```

---

### Task 3: Add inner-loop cap + truncation to `dotnet-test-engineer`

**Files:**
- Modify: `plugins/agentic-sdlc/agents/dotnet-test-engineer.md` (Failure modes section)

- [ ] **Step 1: Add the compile-loop cap as a new Failure mode bullet**

Find the Failure modes section:

```markdown
## Failure modes
- If a production bug is discovered while writing tests: write the failing test, report "PRODUCTION BUG: <description>", and stop. Do not fix production code.
```

Replace with:

```markdown
## Failure modes
- If a production bug is discovered while writing tests: write the failing test, report "PRODUCTION BUG: <description>", and stop. Do not fix production code.
- If `dotnet build <backend_src>` still fails to compile the test project after 3 fix attempts: stop, report the compiler output to the orchestrator, and do not attempt a fourth. Excerpt only the first ~5 distinct errors (see the dotnet-conventions skill, "Build & test execution discipline") — do not paste the full trace.
```

- [ ] **Step 2: Verify**

Run: `grep -n "after 3 fix attempts" plugins/agentic-sdlc/agents/dotnet-test-engineer.md`
Expected: one match.

Run: `grep -n "Build & test execution discipline" plugins/agentic-sdlc/agents/dotnet-test-engineer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/dotnet-test-engineer.md
git commit -m "feat(dotnet-test-engineer): cap compile-fix loop at 3 + truncate errors"
```

---

### Task 4: Add truncation note to `dotnet-reviewer`

**Files:**
- Modify: `plugins/agentic-sdlc/agents/dotnet-reviewer.md` (Process step 3)

- [ ] **Step 1: Update the build step**

Find:

```markdown
3. Run build:
   ```bash
   dotnet build <backend_src>
   ```
   Build failure → automatic FAIL.
```

Replace with:

```markdown
3. Run build:
   ```bash
   dotnet build <backend_src>
   ```
   Build failure → automatic FAIL. When excerpting the failure into your report, include only the first ~5 distinct errors (see the dotnet-conventions skill, "Build & test execution discipline") — not the full trace.
```

- [ ] **Step 2: Verify**

Run: `grep -n "first ~5 distinct errors" plugins/agentic-sdlc/agents/dotnet-reviewer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/dotnet-reviewer.md
git commit -m "feat(dotnet-reviewer): truncate build-failure excerpt in report"
```

---

### Task 5: Add truncation note to `dotnet-test-reviewer`

**Files:**
- Modify: `plugins/agentic-sdlc/agents/dotnet-test-reviewer.md` (Process — add a bullet after step 4)

- [ ] **Step 1: Add a truncation instruction to the Process**

Find:

```markdown
3. Check: do tests verify story acceptance criteria, or are they trivially passing (e.g., `Assert.True(true)`)?
4. Apply the decision tree from coverage-report skill.
```

Replace with:

```markdown
3. Check: do tests verify story acceptance criteria, or are they trivially passing (e.g., `Assert.True(true)`)?
4. Apply the decision tree from coverage-report skill.
5. When tests fail, list the failing test names and only the first ~5 distinct errors in your report — not full stack traces (see the dotnet-conventions skill, "Build & test execution discipline").
```

- [ ] **Step 2: Verify**

Run: `grep -n "first ~5 distinct errors" plugins/agentic-sdlc/agents/dotnet-test-reviewer.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add plugins/agentic-sdlc/agents/dotnet-test-reviewer.md
git commit -m "feat(dotnet-test-reviewer): truncate failing-test excerpt in report"
```

---

### Task 6: Version bump + CHANGELOG

**Files:**
- Modify: `plugins/agentic-sdlc/.claude-plugin/plugin.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump the plugin version**

Find:

```json
  "version": "0.6.2",
```

Replace with:

```json
  "version": "0.6.3",
```

- [ ] **Step 2: Add the CHANGELOG entry**

Find the top entry header:

```markdown
# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

## [0.6.2] - 2026-06-13
```

Replace with:

```markdown
# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

## [0.6.3] - 2026-06-13

### Added
- **.NET build/test execution guardrails.** New `dotnet-conventions` section "Build & test execution discipline (CI/Ubuntu)" stating four rules: truncate error output to the first ~5 distinct errors; target the specific project while iterating (full-solution coverage run stays at the Test Reviewer gate); reuse binaries with `--no-build`/`--no-restore` only when safe, with a staleness guard; and cap the inner fix loop at 3.
  - `dotnet-engineer`: truncates build-error output when reporting out after its 3-attempt cap.
  - `dotnet-test-engineer`: new 3-attempt cap on the test-project compile loop + error truncation.
  - `dotnet-reviewer` / `dotnet-test-reviewer`: truncate build-failure / failing-test excerpts in their reports.

## [0.6.2] - 2026-06-13
```

- [ ] **Step 3: Verify**

Run: `grep -n '"version": "0.6.3"' plugins/agentic-sdlc/.claude-plugin/plugin.json`
Expected: one match.

Run: `grep -n "0.6.3" CHANGELOG.md`
Expected: one match.

- [ ] **Step 4: Commit**

```bash
git add plugins/agentic-sdlc/.claude-plugin/plugin.json CHANGELOG.md
git commit -m "chore: bump plugin to 0.6.3 for .NET execution guardrails"
```

---

## Final verification

- [ ] **Confirm all five .NET files reference the guardrails**

Run: `grep -rl "Build & test execution discipline" plugins/agentic-sdlc/skills/dotnet-conventions/SKILL.md plugins/agentic-sdlc/agents/dotnet-engineer.md plugins/agentic-sdlc/agents/dotnet-test-engineer.md plugins/agentic-sdlc/agents/dotnet-reviewer.md plugins/agentic-sdlc/agents/dotnet-test-reviewer.md`
Expected: all five paths listed.

- [ ] **Confirm both inner-loop caps say 3**

Run: `grep -rn "after 3 fix attempts" plugins/agentic-sdlc/agents/dotnet-engineer.md plugins/agentic-sdlc/agents/dotnet-test-engineer.md`
Expected: one match in each file.

- [ ] **Open a PR to `master`** (per repo `CLAUDE.md`) from `feat/dotnet-build-guardrails`, with the version bump already included.
