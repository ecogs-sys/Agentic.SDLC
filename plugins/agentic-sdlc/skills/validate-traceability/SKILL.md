---
name: validate-traceability
description: How to compare two artifacts and produce a structured diff report. Used by all Validator agents (BA Validator, Architect Validator, Tech Lead Validator).
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

1. Read both artifacts fully before writing anything.
2. For each item in the **source** artifact: confirm it appears in the derived artifact. If not → `missing`.
3. For each item in the **derived** artifact: confirm it has a traceable source. If not → `added_without_source`.
4. For each matched pair: check that meaning is preserved. Paraphrasing is fine; scope change is not → `altered`.
5. `status` is `"pass"` only if all three arrays are empty.
6. Always cite line numbers or section names when available.
7. Be exhaustive — a single missed item is a failed validation.

## Example (BA validation)

Source: `raw-input.md` → Derived: `req-spec.md`

- "The app should let users log in with email and password" (paragraph 1)
- If req-spec has no login requirement → `missing: [{id: "REQ-?", source_location: "raw-input.md, paragraph 1", description: "Login requirement not captured"}]`
- If req-spec adds "user must log in with OAuth" not mentioned in raw-input → `added_without_source`
- If raw-input says "send welcome email" but spec says "send onboarding sequence" → `altered`
