# Review 2026-07-07 — Token-Usage Optimization & Progress Visibility

**Scope:** the `agentic-sdlc` plugin (v0.10.0) — both orchestrator commands, all 26
agent definitions, and the skills. Goal: minimize token consumption per run while
keeping the same or better code quality and correctness, plus improve the user's
visibility of pipeline progress.

**How to use this document:** each finding has an ID (`OPT-*` for token
optimizations, `VIS-*` for visibility), the affected files, evidence, a concrete
fix, and a priority. Implement in the order given in "Suggested implementation
order" at the bottom. Constraints for the implementing agent are listed there too.

---

## Context: where the tokens go

The pipeline is orchestrated from the **main session** (`/start-run`,
`/advance-stage`): the orchestrator's context accumulates the full command prose,
every artifact displayed at user gates, every subagent report, and every commit
round-trip — and all of it is re-processed on **every subsequent turn** of the
run. Subagents are fresh per invocation: each one loads its agent `.md` + any
referenced skills + whatever content the orchestrator pastes into its prompt.

Therefore the two dominant cost multipliers are:

1. **Resident orchestrator context** (paid again every turn, all run long).
2. **Per-invocation subagent payload** (paid per story × per role × per iteration).

File sizes as of this review (top offenders):

| File | Size |
|---|---|
| `commands/advance-stage.md` | 41.2 KB |
| `commands/start-run.md` | 28.6 KB |
| `skills/dotnet-conventions/SKILL.md` | 12.8 KB |
| `agents/react-engineer.md` | 10.6 KB |
| `skills/react-conventions/SKILL.md` | 9.6 KB |
| `commands/show-run-status.md` | 8.9 KB |
| `agents/dotnet-engineer.md` | 7.4 KB |

---

## Part 1 — Token optimizations

### OPT-1 (HIGH): Split `advance-stage.md` into per-stage skills loaded on demand

**Files:** `commands/advance-stage.md`, `commands/start-run.md`

**Evidence:** `advance-stage.md` (41 KB) contains every stage handler (ba,
architect, tech_lead, development, devops, packaging, the full brownfield driver
and its handlers). `start-run.md` (28 KB) invokes the advance-stage skill on
approval (Step 10 / Step B5), so during a normal run **both** files sit in the
main context — ≈17 K tokens of prose resident for every turn of the entire run,
even though at any moment only one stage handler is relevant.

**Fix:**
- Reduce `advance-stage.md` to a **dispatcher** (~5 KB): find the active run,
  read state, the shared disciplines (status lifecycle, spec freeze, test
  serialization, gate convention), and a table mapping `current_stage` → a
  stage-handler skill to invoke.
- Move each stage handler into its own skill, e.g.
  `skills/stage-ba/SKILL.md`, `skills/stage-architect/SKILL.md`,
  `skills/stage-tech-lead/SKILL.md`, `skills/stage-development/SKILL.md`,
  `skills/stage-devops/SKILL.md`, `skills/stage-packaging/SKILL.md`,
  `skills/brownfield-driver/SKILL.md`.
- The dispatcher invokes only the skill for the current stage. When the stage
  completes, it advances state and invokes the next stage's skill.
- Bonus: after context compaction the dispatcher re-loads the current stage's
  exact rules instead of relying on a lossy summary — a correctness improvement.

**Impact:** largest single saving; removes ~10 K tokens from every orchestrator
turn. No behavior change — same handlers, loaded one at a time.

### OPT-2 (HIGH): Delete duplicated loops; define one generic creator→validator loop protocol

**Files:** `commands/start-run.md` (Steps 7–10), `commands/advance-stage.md`
(Stage: ba, Stage: architect, Stage: tech_lead, Brownfield change-spec handler)

**Evidence:**
- `start-run.md` Steps 9–10 (BA loop + req-spec gate) are a near-verbatim copy of
  advance-stage's "Stage: ba" (~2.5 KB duplicated).
- Five loops share the identical a–f shape (invoke creator → commit draft →
  invoke validator → record outcome → commit → route on pass/fail with a
  5-iteration cap and escalation): phase-planner, BA, architect, tech-lead,
  change-spec. Each is spelled out in full.

**Fix:**
- `start-run.md`: after creating the Phase 1 run with `current_stage = "ba"`,
  hand off to advance-stage immediately (it already handles the BA stage). Delete
  Steps 9–10.
- Write the a–f protocol **once** (in the dispatcher or a
  `skills/validation-loop/SKILL.md`) parameterized by: creator agent, validator
  agent, artifact path(s), commit scope, commit-message prefix, state keys. Each
  stage handler then reduces to a parameter block plus stage-specific notes.

**Impact:** several KB out of both commands; also removes the risk of the two BA
loop copies drifting apart (they already differ subtly in status-seeding notes).

### OPT-3 (HIGH): Script the deterministic state/commit mechanics

**Files:** new `plugins/agentic-sdlc/scripts/` helper + edits across both
commands (or the post-OPT-1 stage skills)

**Evidence:** a large share of orchestrator prose and per-turn Bash traffic is
mechanical and fully deterministic: `git add` file lists, conventional-commit
messages per outcome, `state.json` field flips (`in_progress`/`complete`/
`escalated`), iteration counters, story-status updates. The model re-derives
these from prose on every step — the recent git history shows most fix commits
are state-handling corrections, i.e. this is also the main bug surface.

**Fix:** ship a small cross-platform helper (bash or Node, since runs already
require node/npm) — e.g. `sdlc.(sh|mjs)` with subcommands:
- `set-stage <stage> <status> [--commit "<msg>"]`
- `bump-iter <stage|story> [--kind reviewer|test_reviewer|fix]`
- `story-status <id> <status>`
- `commit-step <type> <scope> "<msg>" <paths...>` (add + commit in one call)

Each loop step in the prose becomes one line ("run `sdlc set-stage ba
in_progress`"). State transitions become deterministic code instead of
LLM-interpreted instructions.

**Impact:** big cut to command prose and to per-turn tool output; same-or-better
correctness. Also the natural hook point for VIS-2 (progress log) at zero token
cost.

### OPT-4 (HIGH): Pass artifact *paths* to subagents, not contents

**Files:** `commands/advance-stage.md` (Stage: development steps 1, 3a, 3c, 4a,
4c; and every "Pass: … story content …" elsewhere)

**Evidence:** the development stage instructs the orchestrator to read
`STORY-XXX.md` and pass "story content" inline to the engineer, reviewer,
test-engineer, and test-reviewer — the story text is held in the orchestrator's
context **and** copied into four subagent prompts, times up to 5 iterations per
loop. The whole `tech-spec.md` path is passed too, and engineers are told to read
it fully; the spec grows linearly with project size.

**Fix:**
- Orchestrator passes the story **path** only (all these agents have Read). It
  reads at most the story's frontmatter fields (`Track`, `Wave`, `Depends on`) —
  which it already has from `state.stories` anyway.
- In the engineer/test agents, change "Read the story and tech-spec.md" to:
  "Read the story file; from tech-spec.md read **only** the sections named in the
  story's `Implements` list (and the Stack/deployment section when relevant)."

**Impact:** removes the second-largest recurring injection; scales with project
size. No quality loss — agents read the same content at the point of use.

### OPT-5 (HIGH): Move scaffolding out of the per-story engineer prompts

**Files:** `agents/dotnet-engineer.md` (lines ~26–62: the 35-line `dotnet new`
script), `agents/react-engineer.md` (lines ~25–174: ~150 lines of Vite/Tailwind/
Bootstrap setup incl. the full Tailwind token config), `agents/electron-engineer.md`
(equivalent scaffold section)

**Evidence:** scaffolding is needed **only when the source dir is empty** (first
story of a greenfield run), but it is loaded as system prompt on *every* engineer
invocation — every story, every reviewer-feedback iteration, every
BACK_TO_ENGINEER fix cycle.

**Fix:** create `skills/scaffold-dotnet/SKILL.md`, `skills/scaffold-react/SKILL.md`
(and `scaffold-electron` if the electron engineer carries an inline scaffold).
The engineer `.md` keeps one line: "If `<src_path>` has no project files, invoke
the `agentic-sdlc:scaffold-<track>` skill first." Move the verbatim blocks there.

**Impact:** ~1–3 K tokens saved per engineer invocation × (stories × iterations).

### OPT-6 (MEDIUM): Deduplicate the boilerplate blocks pasted into every agent

**Files:** all `agents/*.md`

**Evidence:** ~20 agent files carry the identical 8-line "Brownfield mode"
paragraph, and creators carry near-identical "Spec-freeze guardrail" paragraphs.
The rules already live in `skills/brownfield-mode/SKILL.md`.

**Fix:** replace each pasted block with one line:
"When context says `mode = brownfield`, follow the `agentic-sdlc:brownfield-mode`
skill (read codebase-context.md first; delta only; never re-scaffold)." Keep the
one-line spec-freeze rule (it is short and load-bearing); delete the repeated
explanation sentences.

**Impact:** a few hundred tokens per subagent invocation, on every invocation.

### OPT-7 (MEDIUM): Downgrade the five validators to Haiku

**Files:** `agents/ba-validator.md`, `agents/architect-validator.md`,
`agents/tech-lead-validator.md`, `agents/phase-planner-validator.md`,
`agents/code-surveyor-validator.md`

**Evidence:** all validators are Read-only traceability diffs against an explicit
JSON schema (`skills/validate-traceability`). They run up to 5× per stage. This
is a mechanical-comparison task shape that a small model handles reliably.

**Fix:** change `model: sonnet` → `model: haiku` in the five validator
frontmatters. Do **not** downgrade the reviewers (they run builds and make
routing judgments) or the code-surveyor itself.

**Impact:** direct cost cut on the highest-frequency subagent class; no quality
risk — the validator's job is exhaustive matching, and the 5-loop + user gate
still backstops it.

### OPT-8 (MEDIUM): Show diffs, not full artifacts, at revision gates

**Files:** `commands/advance-stage.md` ("User-review gate convention" + each
gate), `commands/start-run.md` (same convention)

**Evidence:** the gate convention mandates displaying the artifact's **full
contents** before every approval — including every revision iteration. Re-review
of a large tech-spec after a two-line change re-injects the whole file into the
main context.

**Fix:** amend the convention: display the full artifact on **first** review of
a given version lineage; on re-review after revisions, display the validator's
notes + `git diff <last-reviewed-commit> -- <artifact>` and offer the full file
on request. Always still name the exact path.

**Impact:** removes the largest single main-context injections on revision
loops; the user reviews a diff *better* than a re-read.

### OPT-9 (MEDIUM): Halve the commit ceremony

**Files:** `commands/advance-stage.md`, `commands/start-run.md` (every loop's
step (e) "Commit — … validation outcome")

**Evidence:** every loop iteration makes two commits (creator draft, then a
state.json-only validation-outcome commit). Each commit is a Bash round-trip
plus output resident in orchestrator context; a full run produces 60–100 such
turns.

**Fix:** fold the state-only validation-outcome commit into the **next** commit
that will happen anyway (the revision draft on fail, or the gate-approval commit
on pass). Artifact versions all remain committed; only standalone "failed
validation (iter n)" commits disappear, and that history is still recoverable
from state.json inside the surviving commits. If OPT-3 lands first, this is a
one-line change in the helper's call sites.

**Impact:** ~30–50 fewer orchestrator turns per run.

### OPT-10 (LOW, has trade-offs): Scope the test-reviewer's full-suite run

**Files:** `agents/dotnet-test-reviewer.md`, `agents/react-test-reviewer.md`,
`agents/electron-test-reviewer.md`, `commands/advance-stage.md` (test-execution
discipline)

**Evidence:** the test-reviewer runs the full solution with coverage on **every
story** and every BACK_TO_TEST_ENGINEER iteration, while the devops-reviewer /
packager-reviewer already re-verifies the full suite at the end of the run.

**Fix (choose one):**
- (a) Per-story reviews run only the story's test project with coverage; the
  single authoritative full-suite pass stays at the devops/packaging gate.
- (b) Middle ground: full suite only on the **last story of each wave**.

**Trade-off:** a cross-story regression is caught at the end of the run (a) or
end of the wave (b) instead of at the offending story. **Keep the full-suite
baseline comparison for brownfield runs — that check is load-bearing.**

### OPT-11 (MEDIUM): Make revision iterations incremental

**Files:** all creator/engineer agents (`ba.md`, `architect.md`, `tech-lead.md`,
`*-engineer.md`, `*-test-engineer.md`)

**Evidence:** every re-invocation is a fresh subagent that re-reads everything
from scratch (spec, story, full source survey) even when the validator/reviewer
flagged two specific issues.

**Fix:** add one standard paragraph to each creator/engineer:
"**Revision mode:** when revision notes are present, fix only the listed issues.
Read only the files/sections named in the notes plus what you directly touch; do
not re-survey the codebase or re-read the full spec."

**Impact:** roughly halves the cost of every loop iteration after the first;
also reduces the chance of a revision drifting into unrelated rework (quality
improvement).

### OPT-12 (LOW): Split conventions skills by consumer role

**Files:** `skills/dotnet-conventions/SKILL.md` (12.8 KB),
`skills/react-conventions/SKILL.md` (9.6 KB),
`skills/electron-conventions/SKILL.md` (5.5 KB)

**Evidence:** four roles load each conventions skill, but the test-reviewer
doesn't need the scaffolding/layout half and the engineer doesn't need the
test-structure/coverage half.

**Fix:** split each into `<stack>-conventions` (architecture, naming, DI,
robustness, error handling) and `<stack>-testing` (test structure, test scope,
mocking, execution discipline). Engineers/reviewers load the first;
test-engineers/test-reviewers load the second (+ first only if needed).
**Keep it to two pieces per stack** — over-fragmentation is how convention
regressions creep in.

---

## Part 2 — Progress visibility (VIS)

Today the user's visibility is: on-demand `/show-run-status`, gate
announcements, and raw tool-call scroll. During the development stage (the
longest, possibly hours), there is no compact signal of *where the run is* —
which story, which role, which iteration — without interrupting to run status.

### VIS-1 (HIGH): Standard one-line progress banners in the orchestrator

**Files:** `commands/advance-stage.md` (or the post-OPT-1 dispatcher/stage skills)

**Fix:** add a "Progress reporting convention" section: before every subagent
invocation the orchestrator prints exactly one line, and after it one line.
Format:

```
▶ [development 4/7] STORY-003 (3/6, wave 2) — dotnet-engineer (iter 2/5)
✔ [development 4/7] STORY-003 — dotnet-reviewer: PASS
✖ [development 4/7] STORY-003 — dotnet-reviewer: FAIL (iter 2/5) — 2 CRITICAL
```

Where `[stage k/n]` is the stage's position in the run's pipeline, `(3/6, wave 2)`
is story position. Costs a few tokens; saves whole `/show-run-status` calls
(which re-read many files) and makes escalations impossible to miss.

### VIS-2 (HIGH): Append-only `progress.log` per run, written by the helper script

**Files:** the OPT-3 helper script; `commands/show-run-status.md`

**Fix:** every helper invocation (state flip, iteration bump, commit-step)
appends a timestamped line to `runs/<run-id>/progress.log`:

```
2026-07-07T14:32:10Z development STORY-003 dotnet-reviewer FAIL iter=2
```

- Zero model tokens (the script writes it).
- The user can `tail -f` it in another terminal during long stages.
- `/show-run-status` gains a "Recent activity (last 10 events)" section by
  reading the log tail instead of reconstructing history from git.
- It survives context compaction as a ground-truth timeline.

Add `progress.log` to the run's committed artifacts (it is part of the audit
trail, like state.json).

### VIS-3 (MEDIUM): Stage-entry summaries with pipeline position

**Files:** `commands/advance-stage.md` / stage skills

**Fix:** on entering any stage, announce one short block: stage name + position,
what will happen, and expected gates. Example:

> **Stage 4/7 — development.** 6 stories in 3 waves (4 dotnet, 2 react). Each
> story runs engineer → review → tests → test review. Next user gate: after
> devops (final).

At every user gate, add one line of forward context: "Remaining after this
gate: tech-lead stories gate → development → devops."

### VIS-4 (MEDIUM): Informative subagent descriptions

**Files:** `commands/advance-stage.md` / stage skills

**Fix:** require the orchestrator to put run position into the Agent tool's
`description` (the string shown next to the spinner while a subagent runs):
`"STORY-003 engineer iter 2"`, `"BA validation iter 1"` — instead of generic
"Invoke dotnet-engineer". Zero extra cost; the user sees what's running *while*
it runs.

### VIS-5 (LOW): Statusline showing live run state

**Files:** new optional `scripts/statusline-sdlc.(sh|ps1)` + README note

**Fix:** provide an optional Claude Code statusline script that reads the active
run's `state.json` (+ last `progress.log` line) and renders:

```
SDLC ▸ program-…/phase-01 ▸ development ▸ STORY-003 ▸ eng iter 2/5
```

Always-visible progress at zero token cost. Document it in the plugin README as
an opt-in (`/statusline` setup or settings.json entry).

### VIS-6 (LOW): Escalation visibility

**Files:** `commands/advance-stage.md` / stage skills

**Fix:** standardize an escalation block whenever any 5-cap hits: what stage or
story escalated, the last validator/reviewer report (already required), **plus**
a one-line "everything else is paused; reply with guidance or
`/agentic-sdlc:cancel-run`" so the user always knows the run is blocked on them.
Also ensure `progress.log` records `ESCALATED` events (via VIS-2).

---

## Suggested implementation order

1. **OPT-3** — helper script (unlocks OPT-9 and VIS-2 for free).
2. **OPT-1 + OPT-2** — dispatcher + per-stage skills + dedupe loops (the big
   structural change; do as one PR).
3. **VIS-1, VIS-2, VIS-3, VIS-4** — fold into the new stage skills while writing
   them (cheap if done together with #2).
4. **OPT-4, OPT-5, OPT-6, OPT-11** — agent-file edits (one PR).
5. **OPT-7** — validator model downgrade (trivial PR; verify plugin frontmatter
   accepts `model: haiku`).
6. **OPT-8, OPT-9** — gate-diff convention + commit folding.
7. **OPT-10, OPT-12, VIS-5, VIS-6** — optional/trade-off items, individually.

### Constraints for the implementing agent

- **Do not weaken any quality gate**: keep all 5-iteration caps, all validator
  loops, the spec-freeze rules, serialization of test runs, and the brownfield
  full-suite baseline comparison.
- Follow `CLAUDE.md`: branch from up-to-date `master`; bump
  `plugins/agentic-sdlc/.claude-plugin/plugin.json` version + add a
  `CHANGELOG.md` entry per PR.
- Stage-skill splitting (OPT-1) must preserve handler semantics **verbatim**
  where not explicitly changed by another OPT item — move text, don't rewrite it.
- After OPT-1/OPT-2, re-check `next-phase.md`, `cancel-run.md`, and
  `show-run-status.md` for references to sections that moved.
- The helper script (OPT-3) must run on Windows (Git Bash) and Linux/CI.
- Estimated combined effect of OPT-1…OPT-5: **40–60% reduction** in total token
  consumption for a typical 6-story run; the remaining items add smaller
  incremental savings.
