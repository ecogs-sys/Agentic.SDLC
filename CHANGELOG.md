# Changelog

All notable changes to the agentic-sdlc plugin are documented here.

## [1.6.0] - 2026-11-02

**Gap analysis for a reverse-engineered system.** `/agentic-sdlc:reverse-spec`
describes what a legacy system *does*, and `/agentic-sdlc:redesign` changes *how*
existing behavior works. Neither could answer three other questions: what the survey
failed to specify, what the system **should** do but does not, and what actually
changes for the business at switchover. The first is how a rebuild silently drops
behavior; the second was a blind spot by construction, since every other agent
reasons about what is present; the third existed only scattered across individual
decisions.

### Added
- **`/agentic-sdlc:gap-analysis`** — three passes over a reverse-spec run:
  `--coverage` (completeness audit with a triage gate), `--capability` (missing
  capabilities), and `--cutover` (the legacy-to-rebuild delta). Accepts a
  `--backlog <path>` ticket export as evidence.
- **Four agents.** `coverage-auditor` (sonnet) accounts for every inventory item and
  gives a verdict on whether the spec is safe to rebuild from; `capability-gap-analyst`
  (opus) finds what is missing; `gap-analysis-validator` (haiku) checks both;
  `cutover-delta-writer` (sonnet) assembles the stakeholder document.
- **`write-gap-analysis` skill** — the coverage audit, `GAP-NNN` capability gaps, and
  the cutover delta, each with its own evidence standard.
- **The signal rule.** Finding what is *absent* is inherently weaker inference than
  recovering what code does, and absences are unbounded — an unconstrained search
  yields forty plausible missing features and drowns the three that were real. So every
  `GAP` must cite a signal from **this** system or its users: a hard rejection with no
  path through, visible workaround evidence, an asymmetry, half-built code, something
  the human said, or a supplied backlog item. "Systems like this usually have X" is
  explicitly forbidden, and the validator rejects it. Gaps sourced from the human are
  attributed to them rather than laundered into code findings.
- **Accepted gaps reuse the decision machinery.** There is no second amendment path: a
  promoted `GAP` becomes a `DEC` (with the usual impact analysis, since a new
  capability ripples too) and `spec-amender` adds REQs marked `**Origin:** DEC-NNN`.
  Declined gaps are still written up, so the same suggestion does not resurface and
  cutover can explain why the rebuild lacks it.
- **Coverage triage is now a gate, not a by-product.** `summary.md` already reported
  coverage; the audit promotes it to a deliberate pass where unspecified items are
  accepted, sent back to be specified, or recorded as deliberate exclusions with a
  human behind them. Uncovered scheduled jobs and file drops are called out for
  particular suspicion — business-visible with no UI, so an omission surfaces only when
  something downstream starves.
- **A cutover delta for non-engineers.** What reaches parity, what changes and who
  notices, what is dropped and who relied on it, what is new, which external parties
  need notice and how much lead time, and what happens to in-flight data. Derived
  entirely from approved requirements and accepted decisions — it originates nothing.

### Changed
- **`write-design-decision`** documents gap-sourced decisions: the `DEC` names the
  `GAP-NNN` in its question, and the legacy-baseline field records the manual
  workaround the gap forces.
- **`reverse-spec`'s handoff** offers `gaps` alongside `start` and `redesign`.

### Notes
- Internal quality gaps — contradictions, dead code, duplicated rules, accumulated
  special cases — are deliberately **not** here; `redesign-scout` already covers them,
  and splitting one finding across two artifacts would help nobody.
- The capability pass needs code access and should not run without a resolved source
  root: an analyst reasoning about absence from specs alone is guessing. Coverage and
  cutover work from the artifacts alone.
- Among the new agents only `cutover-delta-writer` can write anything, and only its own
  file. Requirement specs are still amended solely by `spec-amender`, via an approved
  decision.

## [1.5.0] - 2026-11-02

**You can now interrogate a reverse-engineered system and deliberately redesign it.**
`/agentic-sdlc:reverse-spec` recovers the legacy system *as it is* — convolutions
included, by design, since inventing rules is the one thing it must never do. But a
rebuild is the moment to fix the features everyone already knows are wrong. In a
long-lived system almost every convoluted feature is convoluted for a reason that no
longer applies; nobody fixed it because the effort plus the blast radius never
justified it while the system was running. A rebuild removes that constraint, but only
if someone can see the opportunity and bound the risk.

### Added
- **`/agentic-sdlc:redesign`** — ask how the legacy system actually works, get answers
  grounded in its real code, propose a change, see everything it would touch, and have
  approved decisions applied across every affected `req-spec.md`. Operates on a
  reverse-spec run; no branch, no automatic commit.
- **Five agents.** `legacy-analyst` (sonnet) answers questions from code and evidence;
  `redesign-scout` (opus) sweeps a module for candidates; `redesign-impact-analyst`
  (opus) maps the blast radius and drafts the decision; `spec-amender` (sonnet)
  applies an approved decision across modules; `spec-amendment-validator` (haiku)
  checks it was applied completely *and* not beyond its approved scope.
- **`write-design-decision` skill** — the `DEC-NNN` decision log, divergence markers,
  withdrawn requirements, the impact/ripple report, and the Q&A log.
- **Divergence is recorded, never silent.** This is the one place the workflow's
  fidelity rule is deliberately broken, so an amended REQ carries
  `**Divergence:** DEC-NNN` and its citation is **demoted** to
  `**Legacy behavior:** … (superseded by DEC-NNN)` rather than deleted. Without that
  demotion the spec would cite code implementing the behavior that was just replaced —
  evidenced-looking and actively wrong. New REQs with no legacy equivalent carry
  `**Origin:** DEC-NNN`; dropped behavior stays as `**Status:** withdrawn by DEC-NNN`
  (write-once: never deleted, never renumbered). The legacy baseline is preserved
  because it is what explains the difference at cutover.
- **Candidate sweep** for the seven patterns that mark a redesign opportunity:
  accumulated special cases (including unreachable ones), rules contradicting each
  other, the same rule implemented in several modules with drifted thresholds,
  workarounds for systems being retired, manual steps encoded as requirements, dead
  behavior, and rules justified only by a limitation that no longer exists.
- **A persisted Q&A log.** Several engineers work one reverse-spec run, so questions
  and their grounded answers are written to `qa-log.md` instead of being left in chat.

### Changed
- **`write-reverse-spec`** documents the three divergence markers as the only
  circumstances in which a REQ may lack an `**Evidence:**` line, and specifies that
  **withdrawn REQs are excluded from the handed-off master spec** — the pipeline builds
  what the master spec contains, and leaving one in would fail the Phase Planner
  validator's exactly-one-phase coverage check.
- **`requirement-archaeologist-validator`** exempts the three marker cases, so a
  redesigned REQ is not reported as missing evidence, and treats an entry point whose
  only REQ was withdrawn by a recorded decision as covered.
- **`start-run`'s reverse-spec entry** skips withdrawn REQs when writing the master
  spec, lists them in a `### Withdrawn` table for traceability, and carries
  `decisions.md` across so the Architect knows which requirements diverge from the
  system they were recovered from.

### Notes
- **The human decides.** Every agent here answers, analyses, or executes — none
  chooses. The analyst separates what it *observed* from what it *inferred* and says
  "no reason visible in the code" rather than inventing a history; the impact analyst
  states the strongest argument against its own recommendation and puts unverified
  ripples in `## Unknowns`; the validator confirms an amendment matches its approval
  and explicitly does not endorse the redesign. A `DEC` with no `Decided by` is not a
  decision.
- **Timing.** Amendments are free before a program is seeded. Afterwards they route
  through the pipeline's own gates (the Architect's BA-reopen, or
  `/next-phase --replan`), and once `spec_frozen` is set at the eval gate the command
  refuses and points at a post-delivery change run — the decision is still recorded.

## [1.4.0] - 2026-11-01

**Requirement specs can now be reverse-engineered from existing source code.**
Until now the plugin could only act on an existing codebase *reactively*:
`/start-run` detected existing code and surveyed it, but that survey
(`codebase-context.md`) is technical and scoped to a change request the human had
already written. There was no way to point the plugin at a legacy system with
nothing in hand and ask what it does, which blocked the rewrite/re-platform case —
nobody hand-writes a requirement spec for a 60k-LOC monolith that has been in
production for fifteen years. Stack detection was also hardcoded to `*.csproj`,
`package.json` and `sdkconfig`, so most legacy systems registered as empty.

### Added
- **`/agentic-sdlc:reverse-spec`** — a standalone command (the
  `/agentic-sdlc:brainstorm` precedent: no run state, no branch, no automatic
  commit) that surveys one or more legacy repositories **read-only** and writes
  non-technical, diagram-bearing `req-spec.md` files to `reverse-spec/<rev-id>/`.
  Accepts arbitrary absolute paths across multiple repositories, resumes an
  interrupted run from what is on disk, and can hand off to `/start-run` later via
  `--handoff <rev-id>` without re-surveying.
- **Six agents.** `legacy-surveyor` (sonnet) + `legacy-surveyor-validator` (haiku)
  take a language-agnostic census; `integration-cartographer` (sonnet) maps external
  entities and reconciles integrations spanning more than one repository;
  `legacy-decomposer` (opus) proposes business module boundaries;
  `requirement-archaeologist` (opus) + `requirement-archaeologist-validator` (haiku)
  recover each module's requirements.
- **Two skills.** `write-system-inventory` carries marker-file detection for ~13
  ecosystems (COBOL, VB6, Delphi, Java EE, PHP, Perl and the rest), entry-point
  heuristics including scheduled jobs and file drops, and the per-module size budget.
  `write-reverse-spec` defines the paired `req-spec.md` + `evidence.md` format, the
  business-level mermaid diagram set, and the merged master-spec format.
- **A human decomposition gate.** The decomposer proposes modules with size metrics
  and an explicit unassigned list; the user approves or redraws (`merge 01+02`,
  `split 03 by partner`). Module size governs how much code one specification pass
  can actually read, so this gate is both the correctness check and the cost control.
- **Reverse traceability validation.** The new validator runs the opposite direction
  from every other validator in the plugin: every entry point, background job and
  external entity must map to a requirement or be listed in `## Not specified` with
  a reason. That is what catches dropped behavior.
- **`/agentic-sdlc:start-run` entry from a reverse-spec run.** Writes the master
  `req-spec.md` directly with REQ-IDs preserved, freezes it, and starts the program
  at the Phase Planner. The BA does not run — the output is already in req-spec
  format, so re-deriving it would be a lossy round trip that renumbers every REQ-ID
  and breaks the evidence links back to the legacy code.
- **Portable citations with revision tracking, for teams.** A reverse-spec run is
  normally worked by several engineers, and a legacy repo is never checked out at the
  same path twice. So no artifact records an absolute path outside one root table:
  roots get symbolic ids (`SRC1`, `SRC2`) with fingerprints, branch, HEAD and
  clean/dirty state, and every citation is `SRC<n>:<relative path>:<line>`.
  Relocating is one table edit, not thousands of citations.

  On another machine the workflow resolves each root (per-machine
  `source-roots.local.md`, gitignored, so nobody edits a shared artifact others would
  conflict with), verifies the fingerprint markers, then verifies the *revision* —
  same remote, recorded branch present and checked out, and how far HEAD has drifted,
  narrowed to the files this run actually cites. **When a root or branch cannot be
  found it asks the user to confirm the location rather than guessing**, and it never
  switches branches, pulls, stashes or resets on their behalf, since that would mutate
  their working tree and can discard uncommitted work.

  Both validators distinguish "citation is wrong" from "root unavailable on this
  machine" and "line numbers drifted". Without that, a second engineer's run would
  fail a perfectly correct module and burn its whole iteration cap on the most
  expensive model "fixing" citations that were right.

### Changed
- **`phase-planner` reads index-first.** When a master `req-spec.md` carries a
  `## REQ index` table, the planner reads the overview and index and scoped-reads
  individual REQ blocks on demand instead of the whole file, which does not survive
  a several-hundred-REQ spec. Benefits ordinary BA-produced programs too.
- **`phase-planner-validator`** avoids reading a very large spec in full, and now
  states that REQ-ID gaps are legitimate (IDs are allocated per module) and that the
  authoritative REQ list is the `### REQ-NNN` headings — a plain `REQ-\d+` match
  would double every ID by also matching the index table.
- **`write-req-spec`** documents the reverse-engineered sections so a mid-phase BA
  reopen preserves them: decision tables and precise business figures are *not*
  technology detail, REQ-ID gaps must not be closed by renumbering, and
  `## Observed operating characteristics` is legitimate because a legacy system's
  measured behavior is stated reality rather than an invented requirement.

### Notes
- Business rules live **in the acceptance criteria**, not in a side file — that is
  the channel the Architect already reads, and it survives downstream restructuring.
  `evidence.md` carries `SRC<n>:<path>:<line>` citations, confidence levels and open
  questions for cross-checking.
- Surveyed source is never modified, and the legacy system is never built or run
  (unlike the brownfield `code-surveyor`, which runs the test suite for a baseline):
  legacy toolchains are usually absent and such a build can have real side effects.
  Secrets found in legacy code are flagged by kind and location, never transcribed.

## [1.3.0] - 2026-09-29

**Engineer-draft reviewers no longer fail stories for missing tests.** All
four code-review agents (dotnet, react, electron, embedded) shared a "Review
stance" that offered "test name" as sanctioned acceptance-criterion evidence,
with no statement that test existence/coverage is out of scope at the
engineer-draft review stage — which runs *before* the separate
test-engineer/test-reviewer loop even starts. Reported from a 28-story phase
run: the dotnet-reviewer alone invented a "zero tests = CRITICAL fail" rule at
least 6 times (STORY-029, 030, 031, 032, 033, 041, 043), each requiring a
manual "reconsideration" agent invocation citing git-log precedent to reverse
the verdict.

### Fixed
- **Review stance now states test coverage is out of scope at this stage**,
  added to all four code-review agents (`dotnet-reviewer`, `react-reviewer`,
  `electron-reviewer`, `embedded-reviewer`). Acceptance criteria must be
  verified by reading code and tracing logic (or running the build) — never by
  looking for a test that proves them; the test-reviewer verifies coverage
  later in the same story's pipeline.
- **Dropped "test name" from the evidence schema hint**
  (`"evidence": "file:line or test name"` → `"file:line or command output"`)
  in each reviewer's output-format example, which had implicitly signaled
  tests as expected evidence pre-test-loop.

## [1.2.0] - 2026-09-02

**Phase-level `app_type` — a brownfield program can now span more than one
application archetype.** Previously `app_type` was a single value fixed at
program creation and copied unchanged into every phase, so a workspace
containing both an existing web app and a separate firmware tree (e.g. an
ESP32 device the web app talks to) could only be worked through the SDLC one
archetype at a time — the other had to be a standalone `change-*` run outside
the program, with no shared planning.

### Added
- **`Detected stacks` in `codebase-context.md`.** The Code Surveyor now checks
  every archetype (`web`/`electron`/`embedded`) independently instead of
  stopping at the first match, records each one it actually confirms with its
  own `src_paths`, and sets an explicit `Proposed app_type` for the current
  request. The Code Surveyor Validator checks each listed stack is grounded in
  real marker files.
- **`Stack` column in the phase plan.** The Phase Planner assigns an archetype
  to every phase (`## Phase index` table + each `### Phase N` section). For
  the ordinary single-archetype program every phase just gets that one
  archetype; for a multi-stack brownfield program, REQ-IDs are grouped so
  **no phase mixes archetypes** — this takes priority over normal phase-sizing
  rules. The Phase Planner Validator gates it (`stack_mismatch`).
- **`phases[].app_type` / `phases[].src_paths` in `program.json`.** Phase
  creation (`start-run` Step 10/BP4) and `next-phase` now read a phase's own
  archetype from its `phases[]` entry — sourced from the phase plan's `Stack`
  column — instead of blindly copying `program.json`'s top-level `app_type`.
  Falls back to the program-level default for programs created before this
  change, so existing single-archetype programs are unaffected.

### Notes
- This is a documentation/prompt-only change (agent and skill instructions) —
  no changes to `scripts/sdlc.mjs` or the state-machine schema's mechanics.
- Greenfield programs are unaffected: an archetype is still chosen once at
  `/start-run` and applies to every phase, since a from-scratch build is
  inherently single-archetype.
- A REQ that genuinely cannot be satisfied within one archetype is not
  supported as a single mixed phase — the Phase Planner flags it as an open
  question instead of forcing it into one phase.

## [1.1.0] - 2026-09-02

**Repo-unique story ids + an eval corpus that can be trusted** — the eval layer
keyed criterion→test bindings on the bare `STORY-XXX/AC-n` tag, but every phase
restarted numbering at `STORY-001` while sharing one test tree. The same tag
string legitimately named different criteria across runs, so `scan` and `replay`
could bind the wrong test. Reported from a 19-story phase-2 run: ~100 spurious
"unknown criterion id" warnings per scan, 48 false regressions per replay, and —
found while investigating — 57 corpus evals reporting green on the strength of an
unrelated test that merely shared a tag string.

### Changed
- **Story ids are now unique across the repository, not per run.** New
  `SDLC next-story-id` prints the first free id (highest across
  `runs/**/stories/` and the eval corpus, plus one); `stage-tech-lead` and the
  brownfield fix-plan handler pass it as `story_id_start` to the creator and its
  validator. A phase-2 run legitimately starts at e.g. `STORY-038`.
- **`EVALS author` fails closed** when a run authors a criterion id the corpus
  already owns, naming the owning run — a numbering slip is caught before any
  code is written, not after the bindings are wrong.
- **`EVALS replay` derives its own scan roots** from the test paths the corpus
  recorded at promote time, so it no longer reports every *other* archetype's
  evals as lost when called with one run's paths. Call it with **no test paths**;
  `stage-development`'s completion block was updated (it previously instructed
  `<backend_test> <frontend_src>` for web runs, which caused the false failures).
- **`EVALS replay` proves a criterion by its tag, not by a substring match.** The
  old last-resort "any scanned file contains the locator" fallback let a test
  prove an unrelated criterion that shared a story number.
- **`EVALS scan` no longer warns about earlier runs' tags.** They are valid ids
  in a shared test tree — it counts them and warns only about an id no run has
  ever owned (a genuine typo), which is what the warning is for.

### Added
- **Unity / ESP-IDF tag support.** `scan` now reads `.c/.h/.cpp/.hpp/.cc` files
  and the `TEST_CASE("[STORY-XXX/AC-n] …", "[group]")` form. Embedded runs could
  not bind a single criterion before this, which is why their manifests were
  being hand-edited against the write-evals rules.
- **Replay failures are classified.** `MISSING` (no test carries the id — a real
  regression, or `retire`) vs `RETAGGED` (the recorded test still exists but now
  carries a different id — `supersede`, naming the id that took over). A fixture
  rework that merely re-points a test no longer reads as an unexplained loss.
- Locators recorded for provenance are now the test's name — the rest of the
  title after `[tag]`, or the xUnit method name (found past stacked
  `[Theory]`/`[InlineData]` attributes, which previously fell back to a
  placeholder no replay could ever match).

## [1.0.0] - 2026-08-23

**Program-level BA + REQ-ID-driven Phase Planning** — the Phase Planner used to
split the raw, unanalyzed `original-input.md` into phases before any BA pass had
extracted requirements, so phase boundaries were a guess against prose. The BA now
runs **once per program**, before the Phase Planner, producing a master
`req-spec.md`; the Phase Planner splits that spec into phases **by REQ-ID**
instead of by paragraph. This is a breaking change to the run/program state
schema — see Breaking below.

### Breaking
- **`program.json`** gains a `req_spec` lifecycle field (mirrors `phase_plan`)
  and `phases[].req_ids` (parsed mechanically from `phase-plan.md`'s new
  `## Phase index` table — never hand-typed).
- **Phase `state.json`** gains `req_ids` and `master_req_spec_path`, and its
  `stages` map **drops `ba` / `ba_validation` / `user_review_req` entirely** —
  those now run only once at the program level. A phase's `current_stage` starts
  at `"architect"`, not `"ba"`. There is no per-phase `raw-input.md`.
- No migration tooling for in-flight runs started under the pre-1.0 schema — start
  a fresh program.
- Brownfield flat `change-*` runs (bug_fix/small_change/non-split new_feature) are
  **unaffected** — no Phase Planner involved, no schema change. The brownfield
  "new_feature split → convert to program" path gets a program-level,
  brownfield-aware BA pass (reads both `original-input.md` and
  `codebase-context.md`) inserted between Step BP1 and the Phase Planner.

### Added
- **`skills/artifact-slicing/SKILL.md`**: the shared scoped-read / scoped-edit
  ("Revision mode") primitives, factored out of `ba`, `architect`, `tech-lead`,
  `phase-planner`, and `fix-planner` into one skill those agents now reference.
  Also the mechanism the Architect uses to read only its assigned `### REQ-NNN`
  blocks out of the (potentially large, multi-phase) master req-spec.
- **Mid-phase requirements reopen**: if the Architect (or a later stage) flags
  that the master req-spec is wrong/incomplete for the phase it's working, the
  `stage-architect` skill reopens the BA ↔ BA-Validator loop against the
  program-level req-spec — scoped to the phase's own REQ-IDs, guarded against
  touching an already-`complete`/spec-frozen phase, and gated by a lightweight
  git-diff re-approval — without resetting the in-flight Architect loop.
- **`## Phase index` table** in `phase-plan.md` (`Phase | Title | REQ-IDs |
  Depends on | Folder`) — the phase-plan analog of the existing `## Story index`
  table convention; `phase-planner-validator`'s coverage check is now a
  mechanical REQ-ID set comparison instead of prose diffing.

### Fixed
- **M1 (deferred from 0.5.0): unified all 11 reviewer agents on structured
  JSON** (`dotnet`/`react`/`electron`/`embedded` reviewers and test-reviewers,
  `devops-reviewer`, `electron-packager-reviewer`, `embedded-packager-reviewer`),
  replacing narrative Markdown, for their internal, non-human-facing handoffs to
  `stage-development` / `stage-devops` / `stage-packaging`. Human-facing gates
  (req-spec, tech-spec, stories, phase-plan, evals) are unaffected — still
  Markdown.

## [0.19.0] - 2026-08-21

**New `embedded` track** — a third `app_type` (alongside `web` and `electron`) for
IoT firmware development: C/C++ on ESP32 using ESP-IDF only (Arduino framework
support deferred). The final stage validates the firmware **builds** (produces a
`.bin`/`.elf` within its partition budget) but never flashes physical hardware —
that step stays manual.

### Added
- **`embedded-engineer` / `embedded-reviewer` / `embedded-test-engineer` /
  `embedded-test-reviewer` agents**: per-story implementation, review, and testing
  for the `embedded` track, mirroring the `electron-*` agent shapes. Testing runs
  on ESP-IDF's Linux host target (Unity framework) so no physical device or QEMU
  is required.
- **`embedded-packager` / `embedded-packager-reviewer` agents**: final-stage
  build-config (sdkconfig/partitions/OTA) and build-artifact verification. These
  reuse the existing `packaging` stage id (`stage-packaging` now branches by
  `app_type` between electron and embedded) rather than introducing a new stage.
- **`embedded-conventions`, `embedded-testing`, `scaffold-embedded` skills**:
  ESP-IDF component layout, non-negotiable safety rules (HAL-abstracted peripheral
  access, no allocation/blocking in ISRs, checked `esp_err_t`), and the one-time
  project scaffold.
- **Embedded coverage section** added to the shared `coverage-report` skill
  (gcov/lcov via the ESP-IDF host target).
- `app_type = embedded` support threaded through `start-run` (archetype prompt,
  brownfield detection), `code-surveyor` (auto-detection heuristic),
  `write-tech-spec` (stack block), `write-stories` (track assignment), and
  `stage-development` (per-story dispatch).

## [0.18.0] - 2026-08-21

**New `/agentic-sdlc:brainstorm` command** — an independent brainstorming skill for
software, IoT/hardware, and general-engineering ideas, decoupled from the
run/program state machine so it can be used any time, before a run even exists.

### Added
- **`idea-generator` agent** (opus): divergent pass producing a wide spread of raw
  concepts from a seed prompt, plus an expand mode (more ideas / revision notes).
  Opus is reserved for this one creativity-ceiling step (consistent with
  phase-planner / architect).
- **`idea-critic` agent** (sonnet): convergent pass that scores every concept
  (Impact / Feasibility / Cost / Risk / Novelty), kills the weak ones with a
  stated reason, and shortlists the strongest 2-3 — carries the same
  anti-sycophancy stance as the 0.17.0 reviewers: even the shortlisted top pick
  must carry a stated **Strongest objection**, no idea advances "for free".
- **`concept-detailer` agent** (sonnet): expands one already-chosen, already-scored
  concept into a full deep-dive brief. Split out of the generator and kept on
  sonnet deliberately — it is structured elaboration (≈ tech-lead / fix-planner
  work), so the 2-3 deep-dive calls per session don't run on opus for nothing.
- **`write-brainstorm` skill**: templates for `session-input.md`, `concepts.md`
  (raw concepts + scoring matrix + mermaid `quadrantChart` prioritization +
  critic notes), per-concept deep-dive `brief.md` (mermaid `flowchart` +
  `sequenceDiagram`), and `summary.md`.
- **`brainstorm.md` command**: intake → divergent pass (idea-generator) → convergent
  pass (idea-critic) → user picks what to deep-dive → briefs (concept-detailer) →
  summary → optional handoff into
  `/agentic-sdlc:start-run` (the chosen brief seeds `original-input.md`
  verbatim). Writes to a new top-level `brainstorms/<brainstorm-id>/` directory;
  no branch or commit happens automatically since this is exploratory writing,
  not shippable code.

## [0.17.0] - 2026-08-14

**Anti-sycophancy pass across the agents and gates.** The pipeline's mechanical spine
(traceability, DAG/wave checks, coverage, DERIVED eval bindings, execution gates) was
already resistant to agreement bias; this release hardens the remaining *subjective*
judgment points and the *human-facing* gates so an agent can't pass work — or present
it to the user — just to be agreeable. Prompt/skill edits only; no script or state
changes.

### Changed
- **Reviewers (all 8: dotnet / react / electron code + test reviewers, devops-reviewer,
  electron-packager-reviewer) gained a `Review stance`:** assume a defect exists and
  find the strongest reason *not* to pass first (adversarial framing); a **PASS is not
  free** — it must cite the same file:line / test / command evidence a FAIL does, now
  surfaced as **Verified** / **Could not verify** lines in every report; and uncertainty
  must be disclosed, never rounded up to "fine".
- **Validators fail closed on uncertainty** (`validate-traceability` skill): an item that
  can't be *positively* confirmed present-and-meaning-preserved goes in the appropriate
  concern array instead of passing, and a `pass` must record its evidence in `notes`.
  `phase-planner-validator` carries the same rule for its `not_shippable` call.
- **Human-review gates surface dissent before asking** (`validation-loop` gate convention
  + the bespoke `stage-evals` gate): the orchestrator must present a short
  *Concerns / what I'd challenge* list — the weakest parts a validator's mechanical
  checks can't see — rather than presenting an artifact as ready-to-approve. A validator
  PASS is explicitly not an endorsement.
- **`judge`-kind evals calibrated** (`write-evals` skill): grade strictly against the
  persisted rubric, fail closed when criteria aren't clearly met — sycophancy toward the
  implementation is called out as the LLM judge's primary failure mode.
- **Spec creators must not launder assumptions into fact** (`architect`, `tech-lead`):
  anything assumed rather than derived from the upstream spec must be visibly marked as
  an assumption, since these criteria become frozen evals.

### Note
- The haiku validators' subjective "meaning changed?" judgment is only hardened via the
  fail-closed prompt for now; moving it to a stronger model was deliberately deferred
  (model rate is a per-token multiplier). Expect the fail-closed rule to produce more
  FAILs / loop iterations — the intended safety-over-agreeableness trade.

## [0.16.0] - 2026-08-08

Add a **human review gate for the evals authored each run**. After the stories
(greenfield / brownfield new_feature) or fix-plan (brownfield bug_fix / small_change)
gate authors the eval manifest, the pipeline now pauses at a new `user_review_evals`
gate before development. The human reviews the run's machine-checkable definition of
correctness — the evals that get promoted into the permanent corpus and replayed
forever — signs off, adjusts how a criterion is checked, or routes a substantial
change back to the stage that owns the acceptance criterion.

**The eval gate is now the single SPEC-FREEZE point.** `spec_frozen` moved off the
stories / fix-plan gates and onto this gate, so a substantial change here can still
re-open the upstream stages (which freeze would otherwise block).

### Added
- **`user_review_evals` stage + `stage-evals` handler skill** — the eval review gate.
  Displays the authored manifest (`EVALS report`), then: **approve** (freezes the spec,
  advances to development); **set a check kind** in place (`test`/`assert`/`judge`);
  or **route a substantial change** (add/remove/reword a criterion) back to the
  Tech Lead / fix-plan / Architect / BA, mirroring the tech-spec gate's routing. It
  re-authors the manifest on the way back down and re-shows the gate.
- **`evals.mjs set-kind <run-dir> <criterion-id> <kind>`** — the only sanctioned
  manifest mutation (goes through the tool, never a hand-edit). Non-`test` kinds mark
  `check.source = "human"`. `report` now shows each eval's `check.kind`.

### Changed
- `spec_frozen` is set at `user_review_evals`, not at the stories / fix-plan gates.
- `stage-tech-lead` and the brownfield fix-plan gate now advance to `user_review_evals`
  after authoring the manifest instead of jumping to development.
- Brownfield tier pipelines (`bug_fix`, `small_change`, `new_feature`) include
  `user_review_evals` before `development`; greenfield seeds the stage; the dispatcher
  and brownfield driver route it; `show-run-status` renders it in the ladder.

## [0.15.0] - 2026-08-04

Collapse hand-written git sequences in the orchestrator commands into single
`sdlc.mjs` calls. Deterministic git (branch cleanup, add/commit) now runs as code,
not model-emitted prose — fewer tool round-trips, no chance of the model formatting
a multi-line git sequence wrong, and ~0 reasoning tokens spent on git plumbing.
Behavior is unchanged; only the invocation collapses.

### Added
- **`sdlc.mjs cleanup-branch <cancel-branch> [parent-branch] [fallback-branch...]`**
  — discards uncommitted changes, switches to the parent branch (falling back to
  `main`, then `master`, or to a caller-supplied fallback list), then deletes the
  cancel branch. Replaces the ~10-line branch-cleanup sequence in `cancel-run`
  (also reused by the brownfield-change cancel path). Never uses `git checkout -`.
  The discard step (`checkout -- .` / `clean -fd`) is status-checked and dies
  loudly on failure, same as every other git call in the function — a locked file
  no longer produces a silent false-success. The fallback-branch existence check
  is one batched `git branch --list` call instead of one `rev-parse` per candidate.
- **`sdlc.mjs commit-step --all`** — stages every change (`git add -A`) instead of
  explicit paths, for migrations that rename/move files. Rejects being combined
  with explicit paths (fails fast instead of silently ignoring them).
- **`scripts/sdlc.test.mjs`** — Node `--test` suite for `sdlc.mjs` (mirrors the
  `evals.test.mjs` pattern), covering every subcommand including the
  `cleanup-branch` fallback chain (default and custom), `commit-step --all`, and
  their new failure/validation paths.

### Changed (internal)
- `commit-step`'s staged/log dirty-check collapses from two `git` spawns into one
  `git status --porcelain` call.
- `commit-step`'s `--run`/`--all` flag parsing simplified from a loop to two
  straight-line checks (no real caller combines or reorders them).

### Changed
- **`cancel-run`** Step 3 now calls `SDLC cleanup-branch` instead of an inline
  `checkout`/`clean`/branch-fallback/`branch -D` block.
- **`next-phase`** — the phase-plan replan commit and the "Phase N started" commit
  now go through `SDLC commit-step` (helper defined once at the top of the command).
- **`start-run`** — the brownfield-to-program conversion commit now uses
  `SDLC commit-step --all`.

## [0.14.0] - 2026-07-31

Accumulating **eval layer** — acceptance criteria become a machine-checkable,
replayable regression asset the SDLC grows on every run. Two lifecycle stages of one
artifact: a **run-specific** manifest that gates the current run, promoted into a
**permanent** `evals/` corpus that is replayed forever. Deterministic (~0 LLM
tokens) and criteria-keyed, so it catches cross-feature regressions no single
reviewer sees. No quality gate was weakened: the existing creator→validator loops,
reviewers, iteration caps, spec freeze, and human gates are unchanged — the eval gate
is additive.

### Added
- **`scripts/evals.mjs`** — deterministic eval helper (Node built-ins only), sibling
  to `sdlc.mjs`. Commands: `author` (stub one eval per `STORY-XXX/AC-n` from the
  frozen stories at spec freeze), `scan` (DERIVE criterion→test bindings from
  in-test tags — never hand-authored), `run` (run-specific completeness gate),
  `promote` (mint write-once `EVAL-NNNN` into the permanent `evals/` corpus),
  `replay` (criteria-keyed regression gate), `retire` / `supersede` (the only
  sanctioned way to change corpus expectations on an intentional behavior change).
  `EVALS` alias added to `advance-stage`.
- **`scripts/evals.test.mjs`** — Node `--test` suite for the helper (author/scan/run/
  promote/replay/retire), establishing the script-test pattern the repo lacked.
- **`write-evals` skill** — manifest schema, the per-language criterion-tag
  convention (xUnit `[Trait("criterion", …)]`, Vitest `[STORY-XXX/AC-n]` title
  token), `EVAL-NNNN` registry/provenance rules, and deterministic-by-default /
  judge-only-for-residue policy.

### Changed
- **Criterion ids.** Each acceptance criterion now carries a write-once `AC-n` id
  (`write-stories`, `write-fix-plan`) — the key the whole layer binds to.
- **Zero-duplication binding.** Test engineers tag each test with its criterion id;
  `evals.mjs scan` derives the binding, so tests stay the single source of truth and
  the mapping can't drift on a rename. The three testing skills document the tag as a
  required rule; the three test reviewers verify no criterion is left untagged.
- **Authoring at spec freeze.** `stage-tech-lead` and the brownfield fix-plan gate
  author the run manifest when criteria freeze.
- **Gate + promote in development.** `stage-development`'s test-reviewer `DONE` route
  scans + runs the run gate (a criterion with no passing tagged test routes back);
  completion promotes to the corpus and replays it.
- **Brownfield replay + retire.** `brownfield-mode` / `brownfield-driver` replay the
  corpus as a criteria-keyed regression gate atop the `test_baseline` comparison, and
  document `retire`/`supersede` for deliberate behavior changes.

## [0.13.0] - 2026-07-23

fix_plan stage replaces change_spec + tech_lead for bug_fix/small_change
tiers; new fix-planner (sonnet) + fix-plan-validator (haiku) agents;
evidence-cited fix plans, no assumption story synthesis.

### Changed
- **`bug_fix` and `small_change` share a new Fix Plan stage.** Both tiers now
  run `survey → fix_plan → user_review_fix_plan → development → devops?` — two
  gates (triage, fix plan) instead of `bug_fix`'s blind story synthesis at
  triage or `small_change`'s change-spec + tech-lead + two extra gates.
- **New `fix-planner` agent (sonnet).** Traces the actual code path for the
  reported scenario, establishes root cause (bug_fix) / insertion points
  (small_change) with `file:line` evidence, reproduces the scenario where
  feasible, and writes `fix-plan.md` including 1–3 story stubs — no separate
  Tech Lead stage needed for these tiers. Follows the new `write-fix-plan`
  skill.
- **New `fix-plan-validator` agent (haiku).** Mechanically verifies every
  citation is real, the request is covered, no speculative language leaks
  outside `## Open questions`, and stories are well-formed.

### Removed
- **`write-change-spec` skill and the `change_spec` stage.** Superseded by
  `fix_plan` for both `bug_fix` and `small_change`. All references to
  `change_spec` / `change-spec.md` removed from commands, skills, and docs.

## [0.12.0] - 2026-07-23

Delta-scoped revision and re-validation release. Loop re-iterations no longer
re-read full artifacts: revision and re-validation invocations are scoped to the
flagged blocks plus the git diff since the last validated commit (~70–80% fewer
tokens per re-iteration). No quality gate was weakened: first-pass full
validation, build/test execution, 5-iteration caps, spec freeze, and human gates
(full artifact on first review, diff after) are unchanged.

### Changed
- **Creators revise as a delta.** BA / Architect / Tech Lead / Phase Planner
  gained a delta "Revision mode": Grep the flagged ID headings, Read only those
  blocks plus the cited source sections, fix with surgical Edits (never rewrite
  with Write), scoped self-check. Full re-read only when notes demand a global
  or structural change. All four gained the `Grep` tool.
- **Validators re-validate the delta.** Full validation on iteration 1; on
  iterations 2+ the orchestrator passes the previous diff report plus
  `git diff <validated_commit> -- <artifact>` and the validator checks only the
  flagged blocks and the diff (a new **Delta re-validation** section in
  `validate-traceability`; drift outside flagged blocks — deletions,
  renumbering, new IDs — is still caught from the diff). Fallback to full
  validation whenever the SHA or diff is missing/unmappable. All four planning
  validators gained `Grep` (still no Bash — the orchestrator computes diffs).
- **Dev-stage reviewers re-review the delta.** The six code/test reviewers
  gained a "Re-review mode": verify prior findings and review only the diff
  hunks since the last review. Builds and the `full_suite` test-execution rules
  are unchanged — the delta applies to file reading only.
- **Validated-commit tracking.** The validation loop records
  `stages.<v>.validated_commit`, and stage-development records per-story
  `last_review_commit` / `last_test_review_commit`, via the existing
  `sdlc.mjs set-field` (no script changes).

## [0.11.0] - 2026-07-07

Token-usage optimization + progress-visibility release (see
`docs/REVIEW-2026-07-07-token-optimization.md` for the full findings). No quality
gate was weakened: all 5-iteration caps, validator loops, spec-freeze rules, test
serialization, and the brownfield baseline comparison are unchanged.

### Added
- **`scripts/sdlc.mjs` helper.** All state.json transitions, iteration counters,
  and commits now go through one deterministic script (`set-stage`, `set-field`,
  `bump-iter`, `story-status`, `story-iter`, `commit-step`, `log`, `tail-log`)
  instead of hand-written prose steps. Every call appends to a per-run
  **`progress.log`** — an append-only activity feed you can `tail -f`.
- **Per-stage orchestrator skills.** `advance-stage` is now a ~6KB dispatcher that
  loads only the current stage's handler on demand: `stage-ba`, `stage-architect`,
  `stage-tech-lead`, `stage-development`, `stage-devops`, `stage-packaging`, and
  `brownfield-driver`, plus a shared `validation-loop` protocol that replaces the
  five duplicated creator→validator loops.
- **Scaffold skills** (`scaffold-dotnet`, `scaffold-react`, `scaffold-electron`):
  one-time project scaffolding moved out of the engineer agent prompts — loaded
  only on the first story of a greenfield run.
- **Testing skills** (`dotnet-testing`, `react-testing`): test structure, mocking,
  test scope, and test-execution discipline split out of the conventions skills so
  each role loads only its half.
- **Progress visibility:** one-line ▶/✔/✖ banners around every agent invocation,
  stage-entry summaries with pipeline position, informative subagent descriptions,
  a standard ⛔ escalation block at every 5-cap, a "Recent activity" section in
  `/show-run-status` (from `progress.log`), and an optional zero-token statusline
  (`scripts/statusline-sdlc.mjs`).

### Changed
- **Subagents receive paths, not pasted contents.** Engineers/reviewers/test roles
  read the story file themselves and only the tech-spec sections named in the
  story's `Implements` list. Creators/engineers gained a "revision mode" rule:
  fix only the flagged issues instead of re-reading everything.
- **Test runs are scoped per story.** Test reviewers take a `full_suite` flag —
  the whole suite runs on the last story of each wave, on every brownfield story
  (baseline comparison unchanged), on DevOps/Packaging fix cycles, and at the
  end-of-run gate; other stories run only their own tests with coverage.
- **Validators run on Haiku.** The five Read-only traceability validators
  (ba/architect/tech-lead/phase-planner/code-surveyor) switch from Sonnet to Haiku.
- **Fewer commits.** Validator/reviewer outcomes no longer get standalone
  state-only commits — the state update ships with the next commit.
- **Review gates show diffs on re-review.** Full artifact contents on first
  review; validator notes + `git diff` after revisions (full file on request).
- **`/start-run` slimmed:** its duplicated BA loop is gone — it hands off to
  `advance-stage` after the phase-plan gate. The repeated 8-line brownfield block
  in every agent is now a one-liner pointing at the `brownfield-mode` skill.

## [0.10.0] - 2026-07-04

### Added
- **Electron desktop-app archetype.** A run can now build a secure-by-default Electron
  desktop app via a new `app_type: electron` (default stays `web`). Adds one `electron`
  development track — `electron-engineer` / `-reviewer` / `-test-engineer` /
  `-test-reviewer` — plus an `electron-conventions` skill encoding industry-standard
  security defaults (contextIsolation + sandbox on, nodeIntegration off,
  contextBridge-only IPC validated with zod, strict CSP, node-pty confined to main).
- **Packager stage for electron runs.** `electron-packager` (electron-builder +
  electron-updater + icon generation) and `electron-packager-reviewer` (unpacked build
  + smoke-launch) replace the DevOps/docker-compose done-gate when `app_type = electron`.

### Changed
- `/start-run` asks greenfield runs to pick an archetype (web | electron); the Code
  Surveyor auto-detects electron for brownfield runs.
- `write-tech-spec`, `write-stories`, `tech-lead`, and `advance-stage` now branch on
  `app_type` — the electron stack, the single `electron` track, and Packager-vs-DevOps
  routing. Web runs are unchanged.
- `next-phase` carries `app_type` into later phases, and both the brownfield change-run
  driver and brownfield-program storage are electron-aware, so multi-phase and brownfield
  electron runs route to the packaging done-gate.
- `show-run-status` now renders by `app_type` — electron runs show the Electron root, the
  Packaging phase, and the monorepo/electron-builder artifacts instead of the web
  backend/frontend/docker-compose lines.
- **Pipeline diagram (`docs/agentic-sdlc-pipeline.svg`)** updated: the DevOps phase is
  labelled the web archetype and a dashed "Electron archetype" note shows the Packager
  (electron-builder + smoke-launch) replacing DevOps; `<title>`/`<desc>` updated for
  accessibility.

## [0.9.2] - 2026-07-04

### Changed
- **Pipeline diagram now shows track extensibility.** Updated `docs/agentic-sdlc-pipeline.svg`
  to convey that the development-phase track set is pluggable rather than limited to .NET and
  React. Added a dashed "＋ More tracks" column (illustrative Java / Vue / Go chips) wired into
  the story-dispatch and DevOps flow, and updated the accessible `<desc>` accordingly. Diagram
  only — no behavior change.

## [0.9.1] - 2026-07-04

### Changed
- **Agent model right-sizing.** Matched each agent's model tier to its cognitive load and
  run volume:
  - `code-surveyor` opus → **sonnet** — the survey is Grep/Glob-driven exploration plus a
    templated write-up (not open-ended design), it runs shallow on every brownfield run, and
    the code-surveyor-validator backstops its output.
  - `phase-planner` sonnet → **opus** — the highest-leverage decomposition step, where a bad
    phase split cascades across the whole program. Note: this applies to every invocation,
    including the common single-phase case (frontmatter model is unconditional).
  - `architect` stays **opus**; all validators, engineers, reviewers, test engineers/reviewers,
    and devops agents stay **sonnet**.

## [0.9.0] - 2026-07-04

### Fixed
- **Live `in_progress` status.** Stages no longer sit at `pending` until they jump to
  `complete` — the orchestrator now flips each stage, validator sub-stage, and story to
  `in_progress` *before* invoking its agent. Previously only `stages.ba` (seeded
  `in_progress` in the schema) ever looked "running"; `architect`, `tech_lead`,
  `development`, `devops`, all `*_validation` sub-stages, and per-story status were
  unobservable while running.
- `stages.development` is now closed out to `complete` (it was permanently stuck at
  `pending`), and the program-level `phase_plan` is set to `in_progress` at the start of the
  Phase Planner loop.

### Added
- **Stage-lifecycle & status discipline** convention in `advance-stage` — a single canonical
  status vocabulary (`pending → in_progress → complete`; `escalated`/`skipped`/`cancelled`)
  and entry/exit rules that every stage references, so status transitions can't drift.
- **Escalation & failure visibility** in `show-run-status`: `◀ NEEDS ATTENTION` on any
  `escalated` stage/story, `◀ active` on the current stage/story, a `⚠ …escalated…` banner,
  per-story rework counters, and the development/devops aggregate status.
- Consistent `escalated` status is now written for the Tech Lead stage and for any story that
  hits a 5-iteration cap (new `escalated` story status), so blocked work surfaces instead of
  showing as mid-flight `in_progress`.
- **.NET robustness essentials** (dotnet-conventions): nullable reference types + warnings-as-
  errors, boundary input validation, `ILogger<T>` structured logging, `CancellationToken`
  propagation, options-pattern config, and a global exception handler.
- **React robustness essentials** (react-conventions): render loading/error states,
  accessibility (semantic elements, labels, alt), stable list keys, app-level error boundary,
  and no secrets in the bundle.

## [0.8.1] - 2026-06-21

### Changed
- Docs: documented the brownfield **change-run** and **brownfield-program** folder
  layouts in the plugin README ("Where artifacts live"), with a per-tier
  artifact table.

## [0.8.0] - 2026-06-21

### Added
- **Brownfield mode.** `/start-run` now auto-detects an existing codebase and runs a
  right-sized, tiered pipeline (bug-fix / small-change / new-feature) as a standalone
  `change-*` run, alongside the unchanged greenfield program/phase flow.
- **Code Surveyor** agent (+ validator) produces a shared `codebase-context.md`
  (stack, conventions, architecture, impact map, test baseline, infra assessment) and
  proposes a tier at a new triage gate; depth scales by tier.
- New skills: `brownfield-mode`, `write-codebase-context`, `write-change-spec`.
- **Multi-feature brownfield programs.** A new-feature that is really several
  features can be **split** at the triage gate into a brownfield *program* that
  reuses the Phase Planner loop and ships one PR per phase via `/next-phase`; every
  phase stays brownfield-aware (reads `codebase-context.md`, works the delta).

### Changed
- BA, Architect, Tech Lead, engineers, reviewers, and test reviewers are now
  brownfield-aware (delta-only work; reuse existing conventions).
- DevOps runs only when the change needs infra changes; brownfield done-gate keeps
  the full existing suite green (no new failures vs baseline) plus new tests.
- `advance-stage`, `cancel-run`, `show-run-status`, and `next-phase` recognize
  `change-*` runs.

## [0.7.1] - 2026-06-21

### Changed
- **Test execution guardrails: serialize and run once per change.** Made the implicit
  "one authoritative run" rule explicit and enforceable to stop concurrent `dotnet test` /
  `npm test` storms (SQL deadlocks, `database is locked`, port-in-use, and net slowdown from
  oversubscribed cores). Added a "Test execution discipline" section to `/advance-stage`
  mandating strictly sequential story processing — waves express dependency order, not
  permission to parallelize — with the test-reviewer (plus the single end-of-run
  devops-reviewer pass) as the sole owner of the full-suite run. Added a one-suite-in-flight
  concurrency clause to `dotnet-conventions`, and a new "Build & test execution discipline"
  section to `react-conventions` mirroring it.

## [0.7.0] - 2026-06-20

### Added
- **Phase planning.** A new pre-BA Phase Planner agent (+ validator) splits a large
  requirement into ordered, independently shippable phases. Each phase is its own
  run under `runs/<program-id>/phase-0N/`, ships on its own branch, and opens its
  own PR.
- `/agentic-sdlc:next-phase` command to start the next phase (lazy creation;
  requires the prior phase merged; optional replan of remaining phases).
- `write-phase-plan` skill — phase-plan template and sizing/coverage conventions.

### Changed
- `/start-run` now creates a program, runs the Phase Planner loop + phase-plan
  review gate, then creates the Phase 1 run.
- `/advance-stage` and `/show-run-status` are program/phase-aware.
- `/cancel-run` now cancels the current in-progress phase only; completed phases and
  the program survive.

### Notes
- Clean break: the program/phase run layout is the only supported layout. Finish
  any in-flight flat runs on 0.6.x before upgrading.

## [0.6.5] - 2026-06-14

### Changed
- **.NET test guardrails: behavior-only scope + bounded execution.** Diagnosed a 20-minute `dotnet test` hang on Ubuntu caused by an emergent `ScaffoldTests` class that shelled out to `dotnet build`/`restore`/`sln list` (~15 nested subprocesses) to "verify" Clean Architecture project structure — deadlocking on the NuGet lock for zero behavioral coverage.
  - `dotnet-conventions`: new "Test scope: behavior only" section forbidding tests that invoke the `dotnet` CLI / spawn processes, assert on project structure or "it compiles" (enforced by the architect-validator and the build, not by tests), or depend on an ambient DB/network/Docker. Structural acceptance criteria get zero tests.
  - `dotnet-conventions` ("Build & test execution discipline"): two new rules — bound every test run with `--blame-hang-timeout` so a hang fails fast and names the test (a timeout is a failure to diagnose, not a slow run to wait out); and never pipe an observed/authoritative test run through `tail` (it buffers to EOF, hiding both progress and the hang report) — use `--logger "console;verbosity=detailed"` instead.
  - `dotnet-test-engineer`: new "Test scope (critical)" section + step 1 now skips purely structural criteria.
  - `dotnet-test-reviewer` / `devops-reviewer`: the authoritative coverage / suite runs now pass `--blame-hang-timeout 120s`.

## [0.6.4] - 2026-06-13

### Added
- **Automated GitHub releases on merge to `master`.** New `.github/workflows/release.yml` triggers on pushes to `master` that touch `plugin.json`, reads the plugin `version`, and—if a `v<version>` release doesn't already exist—creates a tag and GitHub Release whose notes are the matching `## [<version>]` section of `CHANGELOG.md`. Idempotent: merges that don't bump the version are no-ops.

## [0.6.3] - 2026-06-13

### Added
- **.NET build/test execution guardrails.** New `dotnet-conventions` section "Build & test execution discipline (CI/Ubuntu)" stating four rules: truncate error output to the first ~5 distinct errors; target the specific project while iterating (full-solution coverage run stays at the Test Reviewer gate); reuse binaries with `--no-build`/`--no-restore` only when safe, with a staleness guard; and cap the inner fix loop at 3.
  - `dotnet-engineer`: truncates build-error output when reporting out after its 3-attempt cap.
  - `dotnet-test-engineer`: new 3-attempt cap on the test-project compile loop + error truncation.
  - `dotnet-reviewer` / `dotnet-test-reviewer`: truncate build-failure / failing-test excerpts in their reports.

## [0.6.2] - 2026-06-13

### Changed
- **.NET test code now lives in a separate top-level `tests/` tree, never under `src/`.** The four source projects stay under `<backend_src>` (default `src/backend`); the xUnit test project moves to `<backend_test>` (default `tests/backend`). The `.sln` remains in `<backend_src>` and references the test project by relative path, so `dotnet build/test <backend_src>` still build and run the whole suite.
  - `start-run`: detects/derives `backend_test` (mirrors `src/<name>` → `tests/<name>`) and stores it in `state.src_paths.backend_test`.
  - `advance-stage`: threads `backend_test`/`test_path` to the .NET engineer, test engineer, and test reviewer; commits stage the test path.
  - `dotnet-conventions`: source-vs-test layout made explicit (tests never under `src/`).
  - `dotnet-engineer`: scaffolds the test project under `<backend_test>` with cross-tree project references; `.sln` (in `<backend_src>`) records the relative path.
  - `dotnet-test-engineer` / `dotnet-test-reviewer`: read/write tests under `<backend_test>`.
  - `docker-compose-setup`: .NET Dockerfile no longer restores the `.sln` (it references the out-of-context test project) — it restores/publishes the Api project directly and copies all four source `csproj` for restore-layer caching (also fixes a latent restore bug under Clean Architecture).
  - `show-run-status` / `README`: report and document the `tests/backend` location.
- **React is unchanged:** Vitest/RTL tests stay co-located next to their components inside `<frontend_src>` (the idiomatic React convention); only the .NET track uses a separate `tests/` tree.

## [0.6.1] - 2026-06-13

### Added
- `CLAUDE.md` — project instructions documenting the git workflow (always branch from an up-to-date `master`; confirm before branching off a non-`master` branch) and the release rule (bump the plugin version on every PR to `master`).

## [0.6.0] - 2026-06-13

### Added
- **Clean Architecture mandated across both tracks.** The pipeline now designs, builds, and reviews to Clean Architecture with an inward dependency rule.
  - **Backend (.NET): four projects** — `Domain` (entities, no deps) ← `Application` (use cases, DTOs, repository interfaces) ← `Infrastructure` (EF Core `DbContext`, repository impls) ← `Api` (controllers, DI composition root, `/health`). EF Core is confined to Infrastructure; controllers depend on Application interfaces, never on `DbContext`.
  - **Frontend (React): four folder layers** — `domain/` (types, models, pure logic) ← `api/` (fetch clients) ← `hooks/` (orchestration) ← `components/`+`pages/` (presentation). No `fetch`/`axios` calls inside components or pages.
- `write-tech-spec`: every backend TECH declares a `Layer` field; checklist enforces a valid layer and no outward `Depends on`.
- `architect`: assigns each backend TECH a layer and designs to the dependency rule; brownfield discovery notes the existing layer layout.
- `architect-validator`: validates layer declarations and the dependency rule (violations surface under `altered`).
- `dotnet-conventions`: replaced the single-project layout with the four-project structure, reference wiring, and per-layer placement rules.
- `dotnet-engineer`: four-project scaffolding commands (`dotnet new` + inward `dotnet add reference`); places each story's code in the correct layer.
- `dotnet-reviewer`: **CRITICAL** Clean Architecture compliance check (outward project references, `DbContext` leakage outside Infrastructure, controllers using concrete repositories, wrong-layer code).
- `react-conventions`: relabeled the structure as Clean Architecture layers, added an explicit `domain/` layer, stated the dependency rule.
- `react-engineer`: places code per layer; never calls `fetch`/`axios` inside a component or page.
- `react-reviewer`: **CRITICAL** check for `fetch`/`axios` outside `src/api/` and for cross-layer import violations.
- `docs/superpowers/specs/2026-06-13-clean-architecture-design.md` — design spec for this change.

## [0.5.0] - 2026-05-04

### Fixed (Critical)
- **C1: `dotnet sln` referenced `.slnx` while `dotnet new sln` created `.sln`.** Both `dotnet sln add` calls failed silently; the test project was never linked into the solution and tests for every story would silently fail to compile. Now uses `.sln` consistently.
- **C2: `docker-compose-setup` skill had hardcoded `./dotnet` and `./react` build contexts** — leftover from before v0.2.0 separated generated code into `state.src_paths`. Skill now uses `<backend_src>`/`<frontend_src>` placeholders with substitution instructions.
- **C3: DevOps Reviewer hardcoded ports 5000 and 3000.** If the architect chose different ports, smoke tests false-failed and burned BACK_TO_DEVOPS iterations. Reviewer now reads `BACKEND_PORT` and `FRONTEND_PORT` from `tech-spec.md` deployment topology.
- **C4: `/health` endpoint required by reviewer but never required of engineers.** Added a mandatory `TECH-HEALTH` component in `write-tech-spec`, a "/health endpoint" requirement in `dotnet-conventions`, and an explicit instruction in `dotnet-engineer.md` to scaffold it on the first story.
- **C5: Devops stage missing `iterations` counter in initial state.** `start-run` now writes `"devops": { "status": "pending", "iterations": 0 }`.
- **C6: Spec-freeze enforced only by orchestrator command, not by agents.** Added "Spec-freeze guardrail" sections to all agents that have Write/Edit tools (BA, Architect, Tech Lead, all engineers, DevOps Engineer). True file-level enforcement via hooks deferred to a future release.

### Fixed (High)
- **H1: Counter accounting bug across cross-loop routing.** When `BACK_TO_ENGINEER` fired from the test reviewer or `BACK_TO_*_ENGINEER` from the DevOps reviewer, the orchestrator reused the original `reviewer_iterations` counter — which was often near 5 from the dev phase, causing immediate false escalation. Added a separate `fix_iterations` counter that is reset to 0 on each cross-loop entry, capped at 5 per fix cycle.
- **H2: Dead state-machine references.** BA, Architect, and Tech Lead descriptions claimed to handle a `*_revision` stage that was never set. Replaced with the actual revision-via-iteration-counter pattern.
- **H4: Cycle detection in `tech-lead-validator`.** Validator now performs DFS-based DAG validation on stories' `Depends on` graph, checks for self-references, and verifies that every `Depends on` entry is a defined STORY-ID. Cycles or unknown IDs fail the validation.
- **H5: Workspace `.gitignore` runs/ policy documented.** The intentional difference between marketplace `.gitignore` (excludes `runs/`) and workspace `.gitignore` (commits `runs/` as audit trail) is now spelled out in start-run Step 5.
- **H6: CHANGELOG missing v0.4.0 entry.** Added retroactively (see below).
- **H7: Frontend smoke test false-PASSed on broken bundles.** nginx serves `index.html` for any path. Smoke test now verifies a `<script src="...">` tag is present in the response.
- **H8: `dotnet test` / `npm test` ran twice per story.** Test engineer's full test pass was redundant with the test reviewer's coverage-instrumented run. Test engineers now compile-check (`dotnet build` / `tsc --noEmit`) instead.
- **H9: `/cancel-run` git branch deletion was fragile.** Used `git checkout -` as final fallback, which could land back on the run branch and then fail to delete it. `start-run` now records `parent_branch` in `state.json`; `cancel-run` uses it as the primary fallback target.
- **H11: Default coverage threshold fallback was implicit.** Test reviewers now explicitly fall back to `{lines: 80, critical_paths: 90}` when the story has no `coverage_threshold` field.

### Fixed (Medium)
- **M2: Hardcoded model IDs replaced with family aliases.** All 16 agents now use `model: sonnet` or `model: opus` instead of pinned versions like `claude-sonnet-4-6`. Plugin no longer breaks when a pinned minor is retired.
- **M3: Tech-stack lock-in is announced upfront.** `/start-run` now states the fixed stack (.NET 8 + React 18 + Postgres + Docker Compose) before asking for the requirement, so users with a different stack stop early instead of getting a forced spec.
- **M4: Removed redundant `npm install` after `npm create vite`** in `react-engineer`. Vite's create command already installs base dependencies.
- **M8: `show-run-status` handles missing `Version:` line gracefully** (mid-write or malformed artifacts now report `v?` instead of erroring).
- **M9: `.env.example` template note** explicitly tells the DevOps Engineer to include every env var referenced in the generated `docker-compose.yml`, not just the database baseline.
- **M10: `/start-run` refuses if a run is already active**, with a clear message pointing to `/advance-stage` or `/cancel-run`.

### Fixed (Low)
- **N1: Added `license: "MIT"` to plugin.json.**
- **N3: `.gitignore` template** removed redundant `**/coverage/` (kept `**/coverage*/` superset), added `*.log`.
- **N4: `dotnet tool install`** uses `--tool-path` instead of `-g` so reportgenerator is installed into the run's coverage directory rather than polluting the user's machine.

### Deferred to a future release
- H3: Topological story-dispatch algorithm (Kahn's algorithm) — current rule "empty `Depends on` first" is ambiguous past initial stories.
- H10: Resume-after-crash command — `state.json` captures enough state, but no UX exists.
- H12: Robust prompt-injection defense in BA agent — added a one-line guardrail; full mitigation needs a separate effort.
- M1: Unify all agent communication on JSON (vs. current mix of JSON for validators / Markdown for reviewers).
- M5: Retry/backoff for transient failures (network blips during `npm ci`, `dotnet restore`, `docker pull`).
- M6: Consistent state-update-then-commit ordering across all `/advance-stage` phases.
- N2: Iter=5 escalation arrows in the README mermaid diagram.

### Added
- `docs/REVIEW-2026-05-04.md` — full deep-review document tracking every finding with severity, location, and disposition.

## [0.4.0] - 2026-05-04

### Added
- **Auto-continue pipeline after approval.** After each user-review gate (`approve` reply), the orchestrator now immediately proceeds to the next stage instead of asking the user to run `/agentic-sdlc:advance-stage` manually. The user only types `approve` once per gate.

### Changed
- `start-run` and `advance-stage` updated to chain stages internally on approval (commit `5db136e`).

## [0.3.0] - 2026-05-04

### Changed
- **Granular git commits at every agent handover.** The orchestrator now commits after every step that produces or updates files — not just at story DONE and DevOps DONE.
- Commit points in `start-run`: run init, BA draft, BA validation outcome, req-spec approved.
- Commit points in `advance-stage` (architect): tech-spec draft, validation outcome, tech-spec approved.
- Commit points in `advance-stage` (tech lead): stories draft, validation outcome, stories approved + spec frozen.
- Commit points in `advance-stage` (development, per story): engineer draft, reviewer outcome, test engineer draft, test reviewer outcome, story complete.
- Commit points in `advance-stage` (devops): DevOps engineer draft, reviewer outcome, engineer fix cycles, run complete.
- Conventional commit message scheme: `docs(<run-id>)` for specs, `feat(STORY-XXX)` for production code, `test(STORY-XXX)` for tests, `fix(STORY-XXX)` for bug fixes, `chore` for devops/config.
- `runs/<run-id>/state.json` included in every commit so the run state is always captured alongside the artifact changes.

## [0.2.0] - 2026-05-04

### Changed
- **Generated code no longer lives inside `runs/`**. Code is written to `src/backend` and `src/frontend` (or the detected existing source layout) at the workspace root.
- **Per-run git branch**. `/start-run` creates branch `agentic-sdlc/<run-id>`. Each completed story is committed with `feat(STORY-XXX): <title>`. DevOps artifacts get a final commit. At completion, the user opens a PR from the run branch to main.
- **`runs/<run-id>/` is now SDLC audit trail only**: contains `state.json`, `raw-input.md`, `req-spec.md`, `tech-spec.md`, `stories.md`.
- **Source path detection**. `/start-run` inspects the workspace and detects or asks for `backend_src` / `frontend_src`. Paths are stored in `state.json` and passed to all engineering agents.
- **Workspace-root DevOps outputs**. `docker-compose.yml`, `.env.example`, and `README.md` are written to the workspace root. Build contexts in `docker-compose.yml` reference `backend_src` and `frontend_src` correctly.
- **`/cancel-run` now deletes the git branch**. Switching to main automatically restores the workspace; no manual code cleanup needed.
- **`.gitignore` bootstrap**. `/start-run` ensures `.gitignore` covers `bin/`, `obj/`, `node_modules/`, `dist/`, `coverage*/`, and `.env`.
- All 10 engineering agents updated to receive and use `backend_src` / `frontend_src` paths instead of hard-coded `runs/<run-id>/dotnet` or `runs/<run-id>/react` paths.

## [0.1.0] - 2026-05-03

### Added
- Initial release of the agentic-sdlc plugin.
- 16 subagents: BA, BA Validator, Architect, Architect Validator, Tech Lead, Tech Lead Validator, .NET Engineer/Reviewer/Test Engineer/Test Reviewer, React Engineer/Reviewer/Test Engineer/Test Reviewer, DevOps Engineer/Reviewer.
- 8 skills: validate-traceability, write-req-spec, write-tech-spec, write-stories, dotnet-conventions, react-conventions, coverage-report, docker-compose-setup.
- 4 slash commands: start-run, advance-stage, cancel-run, show-run-status.
- Creator + Validator pattern with up to 5-iteration loops and user escalation.
- Spec freeze enforcement after Tech Lead approval.
- Cross-track bug routing from DevOps Reviewer to the correct Engineer.
