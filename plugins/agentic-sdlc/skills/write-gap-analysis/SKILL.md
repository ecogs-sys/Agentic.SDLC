---
name: write-gap-analysis
description: Template and conventions for gap analysis of a reverse-engineered system — the coverage audit (what the survey failed to specify), capability gaps (GAP-NNN, what the system should do but does not, each tied to a real signal), and the cutover delta (what changes for the business when the rebuild takes over). Used by the coverage-auditor, capability-gap-analyst, gap-analysis-validator, and cutover-delta-writer agents.
---

# Writing a Gap Analysis

Three distinct questions, three artifacts. Keep them apart — they have different
evidence standards and different audiences.

| Artifact | Question | Evidence standard |
|---|---|---|
| `coverage-audit.md` | What did the survey fail to specify? | Mechanical — cross-reference |
| `capability-gaps.md` | What should the system do that it does not? | **Signal required** (below) |
| `cutover-delta.md` | What changes for the business at switchover? | Derived from approved specs |

Internal quality gaps — contradictions, dead code, duplicated rules, accumulated
special cases — are **not** here. The `redesign-scout` agent already covers those; see
`/agentic-sdlc:redesign`.

## 1. Coverage audit

The reverse-spec run already reports coverage as a by-product in `summary.md`. This
promotes it to a deliberate pass with a triage gate, because "we never specified that
part" is how a rebuild silently drops behavior.

### What counts as a coverage gap

- An entry point, background job, or external entity in `system-inventory.md` with no
  REQ and no `## Not specified` entry.
- An area a module's archaeologist listed as unread (it ran out of room).
- A rule at `Confidence: low` — specified, but on a guess.
- An `Open question` nobody has answered.
- A `## Conflicts found` entry nobody has resolved.
- A module whose source root was `skipped` or `unverified`, so its citations were
  never checked against code.
- A module that produced zero REQs — legitimate for pure plumbing, but worth
  confirming rather than assuming.

### Format

````markdown
# Coverage audit
Reverse-spec ID: <rev-id>
Audited: <YYYY-MM-DD>

## Verdict
<one paragraph: is this specification safe to rebuild from, and if not, what is
missing. Lead with the answer.>

## Coverage
| Module | REQs | Entry points covered | Jobs covered | Externals covered | Unspecified |
|---|---|---|---|---|---|

## Unspecified behavior
| ID | Kind | Module | Why unspecified | Risk if skipped |
|---|---|---|---|---|
| EP-014 | file-drop | MOD-03 | not reached — module ran out of room | <plain language> |

## Specified on a guess
| REQ | Module | Confidence | Open question |
|---|---|---|---|

## Unresolved conflicts
| Conflict | Modules | Why it matters |
|---|---|---|

## Unverified citations
| Module | Root | Status | Effect |
|---|---|---|---|
| MOD-04 | SRC2 | skipped | line numbers never checked against source |

## Recommended before rebuilding
<ordered, concrete: "specify EP-014 (MOD-03 re-run)", "answer the 3 open questions in
MOD-02", "resolve the rounding conflict". Name what to do, not just what is wrong.>
````

## 2. Capability gaps

**The most speculative work in this plugin, and the place to be strictest.**

Recovering what code does is verifiable: you read it. Establishing what a system
*fails* to do is inference about an absence, and absences are unbounded. An
unconstrained search produces forty plausible missing features, drowns the reader, and
discredits the three that were real.

### The signal rule (non-negotiable)

Every `GAP` must cite a **signal from this system or its users**. One of:

| Signal | What it looks like |
|---|---|
| Hard rejection | Validation that refuses something, with no path to achieve it |
| Workaround evidence | A comment, a manual step, a re-keyed report, an export-then-import loop |
| Asymmetry | Create exists but amend does not; supported for one type and not its sibling |
| Half-built | Code behind a permanently-off flag, an unreachable screen, a stub |
| Told by a human | The user stated it. Attribute it to them by name or role |
| External backlog | A ticket, request, or backlog item the user supplied |

**Forbidden:** "systems like this usually have X". A best-practice observation with no
signal from *this* system is not a gap — it is noise, and it is the failure mode that
makes this artifact useless. If you cannot name the signal, do not write the entry.

Say explicitly which signal kind each gap rests on, and never present "told by a
human" as if you found it in the code.

### These are candidates, not requirements

A `GAP` is a **proposal for new behavior**, never a recovered rule. It has no legacy
evidence because the behavior does not exist. It becomes a requirement only when a
human accepts it, which happens through a design decision — see **Promotion** below.

### Format

````markdown
# Capability gaps
Reverse-spec ID: <rev-id>
Analysed: <YYYY-MM-DD>
Sources: <code signals | user interview | backlog export at <path>>

## GAP-001 — <short name>  ·  module MOD-NN
**What the system cannot do:** <plain language, business terms>
**Signal:** <signal kind> — <the concrete observation>
**Cited:** SRC<n>:<relative path>:<line>, EV-NNN  (or: stated by <role> on <date>)
**How people cope today:** <the workaround, if one is visible — this is the cost>
**Who feels it:** <role or external party>
**Why it may never have been built:** <only if the code or the user shows it.
"Unknown" is the correct answer otherwise.>
**Confidence this is a real gap:** high | medium | low
**Related requirements:** REQ-014 (the rule that blocks it), REQ-022
**Would be new behavior, not recovered** — no legacy evidence exists by definition.

## GAP-002 — ...

## Considered and rejected
<gaps you thought of and dropped for lack of signal. Listing them shows the search was
real and stops the same suggestions resurfacing. One line each with why.>
````

### Promotion — how a gap becomes a requirement

Accepted gaps **reuse the decision machinery**; there is no second amendment path:

1. The human accepts `GAP-007` at the gate.
2. A `DEC-NNN` is written per `agentic-sdlc:write-design-decision`, naming the gap in
   its **Question asked** field and carrying the usual impact analysis — a new
   capability has a ripple too.
3. `spec-amender` adds the new REQs, each marked
   `**Origin:** DEC-NNN` (the decision record carries the `GAP-NNN` back-reference).

So a gap-sourced requirement is indistinguishable in form from any other
design-decision requirement, which is correct: both are things a human chose to build
that the legacy system never did.

## 3. Cutover delta

The document you hand support, operations, and partners **before** switching over.
Assembled from the approved module specs plus every accepted `DEC` — it invents
nothing.

### Format

````markdown
# Cutover delta — legacy to rebuild
Reverse-spec ID: <rev-id>
Prepared: <YYYY-MM-DD>
Based on: <n> decisions, <m> requirements

## Summary
| Outcome | Count |
|---|---|
| Behavior at parity | <n> |
| Behavior changed | <n> |
| Behavior dropped | <n> |
| Behavior new | <n> |

## What changes for people
| What | Who notices | Change | Decision |
|---|---|---|---|
| Late payment surcharge | Customers, support | 11 exemption cases become 2 | DEC-001 |

Lead with this section. It is why the document exists.

## What is being dropped
| Behavior | Who relied on it | Replacement | Decision |
|---|---|---|---|

## What is new
| Behavior | Who benefits | Decision |
|---|---|---|

## External parties to notify
| Party | What changes for them | Lead time needed |
|---|---|---|
| EXT-003 Partner billing | settlement file timing | <from the decision> |

## Data and in-flight work
<what must happen to records created under the old rules: invoices mid-cycle, stored
values computed the old way, queued items. From each decision's migration note.>

## At parity — no action needed
<the requirements that reproduce legacy behavior unchanged, by count and area. A
reader needs to know the surface area that is *not* changing.>
````

## Honesty rules

1. **Never invent a gap.** A fabricated missing capability sends a team building
   something nobody asked for — the mirror image of the fabricated-rule risk, and just
   as expensive. No signal, no entry.
2. **Separate "found in the code" from "told by a human".** Both are valid; conflating
   them hides who is accountable for the claim.
3. **"Unknown" beats a plausible story** for why something was never built. Code
   rarely records intent.
4. **A coverage audit must state its verdict first.** "Safe to rebuild from" or "not
   yet, because X" — a reader should not have to assemble that from tables.
5. **List what you considered and rejected.** For both the coverage audit and the gap
   list, visible negative results are what make the positive ones trustworthy.
6. **The cutover delta derives, never originates.** Every row traces to an approved REQ
   or an accepted `DEC`. If something belongs in it that is not yet decided, that is a
   decision still to be made, not a row to write.
7. **The human decides.** These agents report; acceptance of a gap is a human act,
   recorded as a decision with an owner.

## Quality checklist

- [ ] Coverage audit leads with a verdict, and every inventory item is accounted for
      as covered, unspecified, or explicitly out of scope
- [ ] Every `GAP` names its signal kind and cites it concretely
- [ ] No `GAP` rests on "systems like this usually…"
- [ ] Every `GAP` is marked as candidate new behavior with no legacy evidence
- [ ] `## Considered and rejected` is filled
- [ ] Gaps told by a human are attributed, not presented as code findings
- [ ] Cutover delta leads with what people notice, and every row cites a REQ or `DEC`
- [ ] Cutover delta includes the at-parity surface area, not only the changes
- [ ] No technology names in any business-facing text
