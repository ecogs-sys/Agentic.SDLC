---
name: validate-traceability
description: How to compare two artifacts and produce a structured diff report. Used by all Validator agents (Phase Planner Validator, BA Validator, Architect Validator, Tech Lead Validator).
---

# Validate Traceability

You produce a **structured diff report** comparing a source artifact to a derived artifact.

## Diff schema

```json
{
  "status": "pass | fail",
  "missing": [
    {
      "id": "REQ-001",
      "source_location": "raw-input.md, paragraph 2",
      "description": "Requirement about X was not captured in req-spec.md"
    }
  ],
  "added_without_source": [
    {
      "id": "REQ-005",
      "description": "This requirement has no traceable source in raw-input.md"
    }
  ],
  "altered": [
    {
      "id": "REQ-002",
      "original": "User wants Y",
      "derived": "Spec says Z",
      "concern": "Meaning changed"
    }
  ],
  "notes": "Optional overall observations"
}
```

## Instructions

1. **Full validation** (the first pass of a loop): read both artifacts fully before writing anything. On later iterations, use **Delta re-validation** below instead.
2. For each item in the **source** artifact: confirm it appears in the derived artifact. If not → `missing`.
3. For each item in the **derived** artifact: confirm it has a traceable source. If not → `added_without_source`.
4. For each matched pair: check that meaning is preserved. Paraphrasing is fine; scope change is not → `altered`.
5. `status` is `"pass"` only if all three arrays are empty.
6. Always cite line numbers or section names when available.
7. Be exhaustive — a single missed item is a failed validation.
8. **Fail closed on uncertainty.** If you cannot *positively* confirm an item is present and meaning-preserved, record it in the appropriate concern array and do NOT pass — do not extend the derived artifact the benefit of the doubt. A possible meaning change goes in `altered`; an item you could not confirm is covered goes in `missing`. Validators using an extended schema without `altered` (e.g. the Phase Planner Validator) record the unconfirmed item in their nearest concern array (`not_shippable` / `misordered` / `missing`). "Looks fine" is not confirmation; an observation is.
9. **A `pass` is not free.** When you pass, use `notes` to state the evidence — which source items you confirmed present and meaning-preserved, and how (section names / line numbers). An empty `notes` on a pass means you did not do the work. This is the same evidence bar a fail meets when it cites a concern.

## Delta re-validation (iterations 2+)

When the orchestrator passes your previous diff report plus a `git diff` of the derived
artifact since the last validated commit, do NOT re-read both artifacts fully:

1. For each ID flagged in the previous report: Grep its heading in the derived artifact,
   Read only that block, and Read the source section its `source_location` cites.
   Confirm the issue is resolved; if not, re-flag it.
2. Scan the git diff for changes **outside** the flagged blocks:
   - a deleted or renumbered un-flagged block is an automatic `altered` fail;
   - any other touched block gets the same block-scoped check as step 1;
   - a new ID appearing in the diff gets the full `added_without_source` check.
3. Unchanged blocks are already validated — do not re-read them.
4. Pass criteria are unchanged. Add to `notes`: `"delta validation vs <sha>"`.
5. If the diff is empty, missing, or you cannot map it to the artifact structure,
   fall back to full validation.

## Example (BA validation)

Source: `raw-input.md` → Derived: `req-spec.md`

- "The app should let users log in with email and password" (paragraph 1)
- If req-spec has no login requirement → `missing: [{id: "REQ-?", source_location: "raw-input.md, paragraph 1", description: "Login requirement not captured"}]`
- If req-spec adds "user must log in with OAuth" not mentioned in raw-input → `added_without_source`
- If raw-input says "send welcome email" but spec says "send onboarding sequence" → `altered`
