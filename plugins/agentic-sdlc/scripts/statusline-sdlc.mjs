#!/usr/bin/env node
/**
 * statusline-sdlc.mjs — optional Claude Code statusline for Agentic SDLC runs.
 *
 * Renders one line describing the active run, e.g.:
 *   SDLC ▸ program-2026-07-07-001/phase-01 ▸ development ▸ STORY-003 ▸ last: reviewer FAIL iter 2
 * Prints nothing when no active run exists (statusline stays clean).
 *
 * Zero token cost — pure filesystem reads. Wire it up in .claude/settings.json:
 *   { "statusLine": { "type": "command",
 *       "command": "node <path-to-plugin>/scripts/statusline-sdlc.mjs" } }
 * The working directory is the workspace root (where runs/ lives).
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function lastLogLine(runDir) {
  const file = join(runDir, 'progress.log');
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
  const last = lines[lines.length - 1] ?? '';
  // Drop the ISO timestamp for brevity.
  return last.replace(/^\S+\s/, '');
}

function activeStory(state) {
  for (const [id, s] of Object.entries(state.stories ?? {})) {
    if (s.status === 'in_progress' || s.status === 'escalated') {
      return s.status === 'escalated' ? `${id}⛔` : id;
    }
  }
  return null;
}

function render(runDir, state) {
  const parts = ['SDLC', state.run_id ?? runDir, state.current_stage ?? '?'];
  const story = activeStory(state);
  if (story) parts.push(story);
  const last = lastLogLine(runDir);
  if (last) parts.push(`last: ${last}`);
  console.log(parts.join(' ▸ '));
}

const runsRoot = 'runs';
if (!existsSync(runsRoot)) process.exit(0);

const entries = readdirSync(runsRoot)
  .map((n) => join(runsRoot, n))
  .filter((p) => {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  })
  .sort()
  .reverse(); // highest sequence first

// 1. Active brownfield change run wins.
for (const dir of entries) {
  if (!dir.includes('change-')) continue;
  const state = readJson(join(dir, 'state.json'));
  if (state?.mode === 'brownfield' && state.current_stage !== 'complete') {
    render(dir, state);
    process.exit(0);
  }
}

// 2. Most recent non-delivered program's active phase.
for (const dir of entries) {
  const program = readJson(join(dir, 'program.json'));
  if (!program) continue;
  const { phase_plan = {}, current_phase = 0, phases = [] } = program;
  const done =
    phase_plan.status === 'frozen' &&
    current_phase === phase_plan.phase_count &&
    phases.find((p) => p.phase === current_phase)?.status === 'complete';
  if (done) continue;
  if (current_phase === 0 || phases.length === 0) {
    console.log(`SDLC ▸ ${program.program_id} ▸ phase planning`);
    process.exit(0);
  }
  const folder = phases.find((p) => p.phase === current_phase)?.folder;
  if (!folder) continue;
  const phaseDir = join(dir, folder);
  const state = readJson(join(phaseDir, 'state.json'));
  if (state) {
    render(phaseDir, state);
    process.exit(0);
  }
}
