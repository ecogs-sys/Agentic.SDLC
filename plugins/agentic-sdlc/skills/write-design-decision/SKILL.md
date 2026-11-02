---
name: write-design-decision
description: Template and conventions for deliberate redesign decisions taken against a reverse-engineered system — the DEC-NNN decision log, the divergence markers that distinguish recovered legacy behavior from a chosen change, withdrawn requirements, the impact/ripple report, and the Q&A log. Used by the legacy-analyst, redesign-scout, redesign-impact-analyst, and spec-amender agents.
---

# Writing a Design Decision

Every other part of the reverse-spec workflow enforces **fidelity** — recover exactly
what the legacy system does, never invent a rule. This skill covers the one place
that rule is deliberately broken: a human decides the rebuild should behave
*differently*, because the legacy way is convoluted, duplicated, or a workaround for
something being replaced anyway.

That divergence must be **recorded, attributed, and traceable** — never silently
written into a requirement.

## Why a bare edit is not acceptable

A reverse-engineered REQ carries `**Evidence:** MOD-02 EV-031`, pointing at the code
the rule was recovered from. If someone edits the acceptance criteria to the new,
better behavior and leaves that line alone, the citation now points at code
implementing the **old** behavior. The spec looks evidenced and is actively wrong.

Six months later nobody can tell:

- "this is what the legacy does" from
- "this is what we decided to do instead"

and at cutover nobody can explain to the business *why* the new system behaves
differently. So every divergence gets a `DEC-NNN` record, and the legacy baseline is
**preserved as superseded**, not overwritten.

## ID rules

- `DEC-001`, `DEC-002`, … allocated in decision order, **write-once**, never reused.
- A decision is never deleted. A reversed decision gets a new `DEC` that supersedes it.
- Decisions live in `reverse-spec/<rev-id>/decisions.md`.
- `Last allocated` in the header is the cursor. **Re-read it immediately before
  allocating** — `decisions.md` is shared, several engineers work one run, and a
  colleague may have added a decision since you last looked. Reusing a taken number
  overwrites their record and their impact report.
- A **rejected** decision consumes its number; the record exists with
  `Status: rejected`. A proposal still being revised has not been written yet, so it
  keeps the same number across revisions and its `impact-DEC-NNN.md` is replaced.
- Gaps in the `DEC` sequence are harmless. Never renumber to close one.

## decisions.md format

````markdown
# Design decisions
Reverse-spec ID: <rev-id>
Last allocated: DEC-<NNN>

## Decision index
| ID | Title | Modules affected | REQs changed | Status | Decided by | Date |
|---|---|---|---|---|---|---|
| DEC-001 | <short name> | MOD-02, MOD-04 | 6 changed, 1 withdrawn, 2 new | accepted | <name/role> | <YYYY-MM-DD> |

Status is one of: accepted, rejected, superseded by DEC-00N.

## DEC-001: <short name>

**Question asked**
<the human's question, verbatim. For a decision promoting a capability gap, name it —
"GAP-007: no partial-payment handling" — so the requirement traces back to the gap
analysis that found it.>

**How the legacy system behaves today**
<grounded answer, in business language, with citations. This is the baseline being
diverged from, so it must be accurate even though it is being replaced.>
- Evidence: MOD-02 EV-031, MOD-02 EV-044

**Why it is this way, as far as the code shows**
<accumulated special cases, a workaround for a system being retired, two teams
solving it twice — or "no reason visible in the code", which is itself an answer.
Never invent a historical motive.>

**Options considered**
| Option | What changes for the business | Effort | Risk |
|---|---|---|---|
| A — keep legacy behavior | nothing | none | carries the complexity forward |
| B — <the chosen change> | <plain language> | <S/M/L> | <what could go wrong> |

**Decision**
<what the rebuild will do instead, in business language — no technology names.>

**Rationale**
<why, in a sentence or three. This is the part people read at cutover.>

**Who is affected outside this module**
<the ripple: other modules, external entities, reports, downstream consumers. Name
them; "none" is acceptable only if the impact analysis actually showed none.>

**Behavior change the business will notice**
<the honest answer, including "none" where the change is internal only. If a number,
a timing, or an outcome changes for a real person, say so plainly — this is what
needs sign-off from outside engineering.>

**Migration / cutover note**
<anything that must happen to existing data or in-flight work when the new behavior
takes over — or "none".>

**Requirement changes**
| REQ | Module | Change | Legacy baseline |
|---|---|---|---|
| REQ-014 | MOD-02 | amended | EV-031 (superseded) |
| REQ-019 | MOD-02 | withdrawn | EV-038 (behavior dropped) |
| REQ-061 | MOD-02 | new — no legacy equivalent | — |

**Decided by:** <name or role> on <YYYY-MM-DD>
**Status:** accepted
````

## Decisions that add a missing capability

A decision does not only change existing behavior. `/agentic-sdlc:gap-analysis` finds
capabilities the legacy system **lacks**, and an accepted `GAP-NNN` is promoted through
this same machinery rather than a second path: the `DEC` names the gap in its
**Question asked**, gets the usual impact analysis (a new capability ripples too), and
`spec-amender` adds REQs marked `**Origin:** DEC-NNN`.

The `**How the legacy system behaves today**` field then records what people do
*instead* — the manual workaround the gap forces — which is the baseline the new
capability replaces.

## Divergence markers in req-spec.md

Three cases. In all of them the `agentic-sdlc:write-reverse-spec` rules still hold:
no technology names, ≥2 acceptance criteria, REQ-IDs write-once.

### 1. An amended REQ — behavior changed by a decision

The `**Evidence:**` line is **demoted**, not deleted:

```markdown
### REQ-014: Late payment surcharge
**Description:** A surcharge is applied to invoices settled after their due date.
**Divergence:** DEC-001 — simplified from legacy behavior
**Acceptance criteria:**
- <the NEW behavior, rule-complete as always>
**Legacy behavior:** MOD-02 EV-031, EV-044 (superseded by DEC-001)
```

`**Legacy behavior:**` replaces `**Evidence:**` so no reader mistakes the citation
for support of the current text. It stays because it is needed at cutover to explain
the difference.

### 2. A new REQ with no legacy equivalent

Created by a decision, so there is nothing to cite. Say so explicitly — otherwise a
reader (or the Architect) hunts for code that does not exist:

```markdown
### REQ-061: Single rounding rule
**Description:** ...
**Origin:** DEC-001 — design decision, no legacy equivalent
**Acceptance criteria:**
- ...
```

### 3. A withdrawn REQ — behavior deliberately dropped

**Never delete a REQ and never renumber** (write-once). Mark it:

```markdown
### REQ-019: Manual rounding reconciliation
**Status:** withdrawn by DEC-001
**Reason:** the monthly manual reconciliation exists only to correct the rounding
drift that DEC-001 removes at source, so there is nothing left to reconcile.
**Legacy behavior:** MOD-02 EV-038 (behavior dropped, not reimplemented)
```

A withdrawn REQ is **excluded from the handed-off master spec** — the pipeline builds
what the master spec contains, and withdrawn behavior is not built. It stays in the
reverse-spec artifacts as the record of a deliberate drop. See the merge rules in
`agentic-sdlc:write-reverse-spec`.

## Impact report format

Produced before a decision is approved. Its job is to answer "what else does this
touch?" — the question that stopped anyone fixing this in the legacy system.

````markdown
# Impact — proposed change to <feature>
Reverse-spec ID: <rev-id>
Proposed: <YYYY-MM-DD>
Status: draft — not yet decided

## Proposed change
<what the human asked for, restated>

## Direct effect
| REQ | Module | Effect | Notes |
|---|---|---|---|

## Ripple
| What | Where | Why it is affected | Confirmed by |
|---|---|---|---|
| REQ-047 | MOD-04 | duplicates the rule being changed | EV-047 |
| EXT-003 Partner billing | integration-map | receives the field whose meaning changes | EV-052 |
| Nightly settlement job | MOD-04 JOB-002 | reads the value this rule produces | EV-061 |

## Not affected (checked)
<things a reader would reasonably worry about, and why they are safe. An impact
report that only lists hits is hard to trust — say what you ruled out.>

## Unknowns
<what could not be established from the code, each as a question for the human.
Never present an unverified ripple as confirmed.>

## Recommendation
<proceed / proceed with caveats / do not proceed, and why. State the strongest
argument against the change, not only for it.>
````

## Q&A log format

Questions and their grounded answers are **persisted**, not left in the chat. Several
engineers work one reverse-spec run, and the second person should not re-ask what the
first already established.

````markdown
# Q&A log
Reverse-spec ID: <rev-id>

## Q-001 — <YYYY-MM-DD> — <module>
**Asked:** <verbatim question>
**Answer:** <grounded, business-language answer>
**Evidence:** MOD-02 EV-031 (`SRC1:Billing/Calc.vb:412`)
**Confidence:** high | medium | low
**Inferred, not established:** <anything in the answer that is reasoning rather than
observation — or "nothing">
**Led to:** DEC-001 | no decision | open
````

## The honesty rules that make this usable

1. **Separate observation from inference, in every answer.** "The code applies the
   waiver when the flag is set" is an observation. "This was probably added for the
   2019 migration" is inference. Label it. A legacy system punishes confident guesses.
2. **Never invent a historical reason.** Code rarely records *why*. "No reason visible
   in the code" is a complete and useful answer; a plausible story is not.
3. **An impact report must state what it ruled out**, not just what it found. The
   reason nobody fixed this in the legacy system is that they could not bound the
   blast radius — a report that only lists hits does not fix that.
4. **Never mark a ripple confirmed without evidence.** An unverified ripple goes in
   `## Unknowns` as a question.
5. **State the behavior change the business will notice**, including "none". A
   redesign that silently changes a customer-visible number is the worst outcome here.
6. **The human decides.** These agents answer, analyse, and draft; they do not choose.
   A decision with no `Decided by` is not a decision.

## Quality checklist

- [ ] Every `DEC` has a question, a grounded legacy baseline, options, a decision, a
      rationale, a ripple section, and a `Decided by`
- [ ] Every amended REQ carries `**Divergence:** DEC-NNN` and demotes its citation to
      `**Legacy behavior:** … (superseded by DEC-NNN)`
- [ ] Every new REQ with no legacy equivalent carries `**Origin:** DEC-NNN`
- [ ] Every withdrawn REQ carries `**Status:** withdrawn by DEC-NNN` and a reason, and
      is still present (never deleted, never renumbered)
- [ ] Every REQ named in a `DEC`'s requirement-changes table was actually edited
- [ ] No REQ-ID was renumbered or reused
- [ ] The decision index matches the `DEC` bodies
- [ ] Behavior change visible to the business is stated, even when it is "none"
- [ ] No technology names leaked into any amended acceptance criteria
