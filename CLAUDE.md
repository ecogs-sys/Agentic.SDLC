# Agentic.SDLC — Project Instructions

## Git workflow

- **Always branch from an up-to-date `master`.** When starting any new piece of work:
  1. Switch to `master`, then `git pull` the latest.
  2. Create the new feature branch out of `master`.
- **If the current branch is not `master`, ask the user for confirmation before proceeding** (do not silently branch off another branch).

## Releasing / pull requests

- **When creating a PR to `master`, bump the plugin version.** Increase the `version` field in
  `plugins/agentic-sdlc/.claude-plugin/plugin.json` (and add a matching `CHANGELOG.md` entry) as part of the PR.
