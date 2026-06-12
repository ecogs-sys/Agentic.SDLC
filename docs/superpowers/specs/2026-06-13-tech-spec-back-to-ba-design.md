# Back to BA from the tech-spec review gate

Date: 2026-06-13
Status: approved

## Problem

At the tech-spec user-review gate, the user can only `approve` (→ Tech Lead) or
request changes (→ Architect revision). There is no way to recognise that a
problem the user spots in the tech-spec actually originates in the requirements.
The only escape today is `/cancel-run` and start over.

## Goal

Add a third path at the tech-spec review gate: route the change back to the
Business Analyst, then flow forward through the full planning chain again so the
updated requirements propagate down to a fresh tech-spec review.

## Behaviour

At the tech-spec review gate (`advance-stage.md`, "User review gate — tech-spec"):

- `approve` → Tech Lead (unchanged).
- Any other text (a change request) → orchestrator asks one follow-up:
  *"Is this a requirements change or a technical change?"*
  - **technical** → Architect revision (existing behaviour).
  - **requirements** → route back to the BA loop (new).

### Route back to BA

Reset state and re-enter the planning chain from the top:

```
current_stage               = "ba"
stages.ba                   = { status: "in_progress", iterations: 0 }
stages.ba_validation        = { status: "pending",     iterations: 0 }
stages.user_review_req      = { status: "pending" }
stages.architect            = { status: "pending", iterations: 0 }
stages.architect_validation = { status: "pending", iterations: 0 }
stages.user_review_tech     = { status: "pending" }
```

Counters reset to 0 — this is a fresh cross-loop entry and must not inherit
spent iteration budget (consistent with the existing `fix_iterations` pattern).

The user's change notes are passed to the BA as revision notes. Flow then
proceeds forward as usual:

BA (revises `req-spec.md`, version++) → BA Validator → **user review req gate**
→ Architect (revises `tech-spec.md`, version++) → Architect Validator →
**tech-spec gate again**.

The updated req-spec **is** re-gated — requirements changed, so the user
confirms the new `req-spec.md` before it flows downstream.

No `spec_frozen` conflict: the freeze happens later, after stories approval.

## Mechanism

`advance-stage.md` gains a `## Stage: ba` section mirroring the BA loop +
req-review gate that currently lives only in `start-run.md`. This lets
`/advance-stage` resume from `current_stage = "ba"`. On req-spec approval it sets
`current_stage = "architect"` and proceeds to the existing Architect stage.

`start-run.md` is unchanged.

## Diagram

`docs/agentic-sdlc-pipeline.svg`: add one red back-edge from the tech-spec
"User review" box up a new left lane into the Business Analyst box, labelled
"Requirements change", keeping the existing "User rejects" → Architect edge.
Update `<desc>` to mention the cross-stage requirements path. SVG only — the
plugin README's Mermaid diagram is left as-is.

## Out of scope

- The stories review gate (after Tech Lead) — tech-spec gate only.
- `start-run.md`.
- Plugin README Mermaid diagram.
