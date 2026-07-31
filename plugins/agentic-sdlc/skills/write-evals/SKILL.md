---
name: write-evals
description: The eval layer — how acceptance criteria become a machine-checkable, replayable eval manifest, how tests are tagged so bindings are DERIVED (not hand-authored), and the permanent EVAL-NNNN corpus conventions. Used by the Tech Lead / Fix Planner (authoring), the test engineers (tagging), the test reviewers (gate), and the orchestrator (scripts/evals.mjs).
---

# The eval layer

An **eval** binds one frozen acceptance criterion (`STORY-XXX/AC-n`) to a
machine-checkable verification and records whether it holds. Evals are the pipeline's
*memory of correctness*: authored when criteria freeze, replayed on every later run as
a deterministic regression gate.

Two lifecycle stages of the **same** artifact:
- **Run-specific** — `runs/<run-id>/evals/manifest.json`, gates *this* run, discarded
  with the run.
- **Permanent** (Phase B) — promoted on merge into `evals/` at the workspace root,
  minted a write-once `EVAL-NNNN` id, replayed forever.

Everything runs through **`scripts/evals.mjs`** (deterministic, Node built-ins only) —
never hand-edit the manifest.

## Core rule: the test is the source of truth

The criterion→test binding is **never hand-authored as a list of test names**. Each
test carries its criterion id as metadata; `evals.mjs scan` *derives* the binding. So
a rename of a test can never desync a manifest, and the eval never re-implements the
assertion — it points at the test that owns it.

### Tag convention (test authors MUST follow)

- **.NET (xUnit):** annotate the test method with a Trait whose key is `criterion`:
  ```csharp
  [Trait("criterion", "STORY-003/AC-1")]
  [Fact]
  public async Task Get_ReturnsOkArray() { … }
  ```
  Queryable at runtime with `dotnet test --filter "criterion=STORY-003/AC-1"`.
- **React / Electron (Vitest):** embed the id token as the first thing in the test
  title, in `[brackets]`:
  ```ts
  it("[STORY-003/AC-1] returns 200 with a JSON array", () => { … });
  ```
  Filterable with `vitest -t "[STORY-003/AC-1]"`.

One criterion may have several tagged tests; one test tags exactly one criterion (the
criterion it primarily proves). Structural criteria that the architect-validator/build
enforce (not tests — see the testing skills) get no tag and are covered by a `judge`
or `assert` check instead, not `test`.

## Manifest schema (`runs/<run-id>/evals/manifest.json`)

```jsonc
{
  "manifest_version": 1,
  "run": "<run-id>",
  "generated": "<iso>",
  "scanned": "<iso>",                 // set by `scan`
  "evals": [
    {
      "id": "STORY-003/AC-1",         // write-once story-scoped key
      "trace": { "story": "STORY-003", "tech": ["TECH-007"] },
      "criterion": "GET /api/todos returns 200 with a JSON array",
      "check": {
        "kind": "test",               // test | assert | judge
        "source": "annotation",       // DERIVED by scan — not authored by hand
        "tests": ["<file>:<line> <locator>"]   // provenance; filled by scan
      },
      "status": { "result": "pending | bound | pass | unbound", "checked": "<iso>" }
    }
  ]
}
```

`check.kind`:
- **`test`** (default) — ≥1 test tagged with this id must exist and pass. Deterministic;
  ~0 LLM tokens to replay. The zero-duplication path.
- **`assert`** — a runnable command/probe, **only for criteria a test does not already
  cover** (never assert the same behavior twice).
- **`judge`** (Phase C) — a persisted rubric prompt, the minimal fallback for
  irreducibly semantic criteria. Kept rare so the growing corpus stays cheap to replay.

## The commands (`scripts/evals.mjs`)

| Command | When | Effect |
|---|---|---|
| `author <run-dir> [stories-dir]` | at SPEC FREEZE | one stub per `STORY-XXX/AC-n` parsed from the frozen `stories/` (`check` unbound) |
| `scan <run-dir> <test-path…>` | after a story's tests pass review | derive `check.tests` by extracting criterion tags from the test files |
| `run <run-dir> [--filter <id\|story,…>] [--suite-green]` | the story / end-of-run gate | verify every targeted criterion is bound (has a tagged test); exit non-zero on any unbound criterion. Pass `--suite-green` when the test-reviewer reported the suite green so covered evals stamp `pass` |
| `report <run-dir>` | any time | human-readable coverage summary |

`run` is a **completeness gate**, not a second test runner: the test-reviewer's suite is
the authoritative execution: `run` asserts each criterion resolves to a passing tagged
test. `--filter` accepts criterion ids or a story id (all its criteria).

## Permanent corpus (Phase B — forward reference)

- `promote <run-dir>` mints a write-once **`EVAL-NNNN`** per bound eval into
  `evals/registry.json` + `evals/EVAL-NNNN.json` at the workspace root, recording
  provenance (run-id, story, tech, criterion text).
- `retire <eval-id> <reason>` / `supersede <eval-id> <new-check>` — the ONLY sanctioned
  way to change corpus expectations, used when a change *intentionally* alters prior
  behavior. Reviewed like code; prevents false regressions.
- Replay: later runs and brownfield change-runs `run` the whole corpus; only NEW
  failures block (an upgrade of the brownfield `state.test_baseline`).

## Quality checklist
- [ ] Every acceptance criterion has a write-once `AC-n` id (`write-stories` /
      `write-fix-plan` format)
- [ ] Every `test`-kind criterion has ≥1 test tagged with its id (xUnit Trait or Vitest
      title token)
- [ ] `evals.mjs run` passes (no unbound criteria) before a story is marked complete
- [ ] Manifest was produced by `evals.mjs`, never hand-edited
