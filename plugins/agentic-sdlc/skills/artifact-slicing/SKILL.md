---
name: artifact-slicing
description: Scoped-read and scoped-edit primitives for working with large Markdown artifacts by ID (REQ/TECH/STORY/Phase) without re-reading or rewriting the whole file. Used by BA, Architect, Tech Lead, Phase Planner, and Fix Planner in Revision mode, and by Architect for REQ-ID-scoped reads of the master req-spec.
---

# Artifact Slicing

Two primitives for touching a large Markdown artifact without paying for its
full size in tokens: **scoped read** and **scoped edit**. Every planning agent
in Revision mode follows this skill for the *mechanics*; only the ID scheme
(heading pattern, ID prefix) is agent-specific.

## Scoped read

Given a set of IDs and a heading pattern (e.g. `### REQ-NNN`, `### TECH-NNN`,
`### Phase N`, `### STORY-XXX`):

1. Grep the artifact for each ID's heading to find its line number.
2. Read only that block: `offset` at the heading line, `limit` up to the next
   heading of the same level (or end of file for the last one).
3. Never Read the whole artifact when a caller only needs specific ID blocks.

This also covers non-revision scoped reads — e.g. Architect reading only its
assigned `### REQ-NNN` blocks out of a large multi-phase master req-spec (the
`## Overview` section is read in full; the REQ blocks are Grep+Read per ID).

## Scoped edit ("Revision mode")

Given validator diff JSON (flagged IDs) or user notes:

1. For each flagged ID, scoped-read its block (above), plus the source
   location its `source_location` cites in the upstream artifact.
2. Fix with **Edit** — surgical edits inside the flagged blocks only. Never
   `Write` (full rewrite). New IDs are always appended at the end; never
   renumber or delete existing IDs (for multi-file artifacts like `stories/`,
   "delete" means never remove an existing file or heading).
3. Bump the artifact's `Version:` line with one Edit.
4. Scoped self-check: confirm each flagged item is resolved; your Edits must
   be the only changes to the file(s).
5. User notes without IDs: Grep the terms the user mentions to find the
   affected blocks.
6. **Escape hatch**: if the notes demand a global or structural change (e.g.
   re-cutting phase/story boundaries, a cross-cutting rename), fall back to a
   full revision — read the artifact fully, rewrite it. Scoped editing is an
   optimization, not a constraint that blocks legitimate structural changes.

## What stays agent-specific

Each consumer keeps only:
- Its **heading pattern** (`### REQ-NNN`, `### TECH-NNN`, `### Phase N`, one
  file per `STORY-XXX`, etc).
- Its **ID prefix** and numbering rule (never renumber, append-only).
- Any artifact-specific self-check (e.g. Architect also re-checks REQ→TECH
  coverage only for the REQs whose blocks it edited).

Everything else — the Grep→Read→Edit mechanics, the Version bump, the escape
hatch — is this skill, referenced rather than repeated.
