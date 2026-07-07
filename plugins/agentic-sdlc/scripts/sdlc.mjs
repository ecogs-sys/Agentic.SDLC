#!/usr/bin/env node
/**
 * sdlc.mjs — deterministic state/commit/log helper for the Agentic SDLC orchestrator.
 *
 * Replaces hand-written state.json edits, git add/commit sequences, and progress
 * logging with single one-line calls, so state transitions are code, not prose.
 * Node built-ins only; works on Windows (Git Bash / PowerShell) and Linux CI.
 *
 * Usage:
 *   node sdlc.mjs set-stage    <run-dir> <stage> <status>
 *   node sdlc.mjs set-field    <json-file> <dotted.path> <value>
 *   node sdlc.mjs bump-iter    <run-dir> <stage>
 *   node sdlc.mjs story-status <run-dir> <story-id> <status>
 *   node sdlc.mjs story-iter   <run-dir> <story-id> <counter> [bump|reset]
 *   node sdlc.mjs commit-step  [--run <run-dir>] "<message>" [paths...]
 *   node sdlc.mjs log          <run-dir> <event text...>
 *   node sdlc.mjs tail-log     <run-dir> [n]
 *
 * Every state-mutating command appends a timestamped line to <run-dir>/progress.log
 * (the run's live activity feed — `tail -f` it during long stages).
 *
 * commit-step: `--run <run-dir>` auto-stages <run-dir>/state.json and
 * <run-dir>/progress.log alongside any extra paths. If nothing is staged the
 * command prints "nothing to commit" and exits 0 (idempotent).
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const VALID_STATUS = ['pending', 'in_progress', 'complete', 'escalated', 'skipped', 'cancelled'];
const VALID_COUNTERS = ['reviewer_iterations', 'test_reviewer_iterations', 'fix_iterations'];

function die(msg) {
  console.error(`sdlc: ${msg}`);
  process.exit(1);
}

function readJson(file) {
  if (!existsSync(file)) die(`file not found: ${file}`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    die(`invalid JSON in ${file}: ${e.message}`);
  }
}

function writeJson(file, obj) {
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function logEvent(runDir, text) {
  const line = `${new Date().toISOString()} ${text}\n`;
  appendFileSync(join(runDir, 'progress.log'), line, 'utf8');
}

function statePath(runDir) {
  return join(runDir, 'state.json');
}

/** Set a dotted path (e.g. stages.ba.status) on obj, creating objects as needed. */
function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function parseValue(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // plain string
  }
}

function git(args) {
  const res = spawnSync('git', args, { encoding: 'utf8' });
  if (res.error) die(`git failed to start: ${res.error.message}`);
  return res;
}

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'set-stage': {
    const [runDir, stage, status] = args;
    if (!runDir || !stage || !status) die('usage: set-stage <run-dir> <stage> <status>');
    if (!VALID_STATUS.includes(status)) die(`invalid status "${status}" (allowed: ${VALID_STATUS.join(', ')})`);
    const file = statePath(runDir);
    const state = readJson(file);
    state.stages ??= {};
    state.stages[stage] ??= { status: 'pending', iterations: 0 };
    const prev = state.stages[stage].status;
    state.stages[stage].status = status;
    writeJson(file, state);
    logEvent(runDir, `stage ${stage} ${prev} -> ${status}`);
    console.log(`stages.${stage}.status = ${status}`);
    break;
  }

  case 'set-field': {
    const [file, dotted, ...valueParts] = args;
    if (!file || !dotted || valueParts.length === 0) die('usage: set-field <json-file> <dotted.path> <value>');
    const obj = readJson(file);
    const value = parseValue(valueParts.join(' '));
    setPath(obj, dotted, value);
    writeJson(file, obj);
    // Log to the file's directory when a progress.log can live there (run or program dir).
    const dir = file.replace(/[\\/][^\\/]+$/, '');
    if (existsSync(dir)) logEvent(dir, `field ${dotted} = ${JSON.stringify(value)}`);
    console.log(`${dotted} = ${JSON.stringify(value)}`);
    break;
  }

  case 'bump-iter': {
    const [runDir, stage] = args;
    if (!runDir || !stage) die('usage: bump-iter <run-dir> <stage>');
    const file = statePath(runDir);
    const state = readJson(file);
    state.stages ??= {};
    state.stages[stage] ??= { status: 'pending', iterations: 0 };
    state.stages[stage].iterations = (state.stages[stage].iterations ?? 0) + 1;
    writeJson(file, state);
    logEvent(runDir, `stage ${stage} iteration -> ${state.stages[stage].iterations}`);
    console.log(state.stages[stage].iterations);
    break;
  }

  case 'story-status': {
    const [runDir, storyId, status] = args;
    if (!runDir || !storyId || !status) die('usage: story-status <run-dir> <story-id> <status>');
    if (!VALID_STATUS.includes(status)) die(`invalid status "${status}"`);
    const file = statePath(runDir);
    const state = readJson(file);
    if (!state.stories?.[storyId]) die(`unknown story ${storyId} in ${file}`);
    const prev = state.stories[storyId].status;
    state.stories[storyId].status = status;
    writeJson(file, state);
    logEvent(runDir, `story ${storyId} ${prev} -> ${status}`);
    console.log(`stories.${storyId}.status = ${status}`);
    break;
  }

  case 'story-iter': {
    const [runDir, storyId, counter, action = 'bump'] = args;
    if (!runDir || !storyId || !counter) die('usage: story-iter <run-dir> <story-id> <counter> [bump|reset]');
    if (!VALID_COUNTERS.includes(counter)) die(`invalid counter "${counter}" (allowed: ${VALID_COUNTERS.join(', ')})`);
    const file = statePath(runDir);
    const state = readJson(file);
    if (!state.stories?.[storyId]) die(`unknown story ${storyId} in ${file}`);
    state.stories[storyId][counter] = action === 'reset' ? 0 : (state.stories[storyId][counter] ?? 0) + 1;
    writeJson(file, state);
    logEvent(runDir, `story ${storyId} ${counter} ${action} -> ${state.stories[storyId][counter]}`);
    console.log(state.stories[storyId][counter]);
    break;
  }

  case 'commit-step': {
    let runDir = null;
    let rest = [...args];
    if (rest[0] === '--run') {
      runDir = rest[1];
      rest = rest.slice(2);
    }
    const [message, ...paths] = rest;
    if (!message) die('usage: commit-step [--run <run-dir>] "<message>" [paths...]');
    const toAdd = [...paths];
    const progressLog = runDir ? join(runDir, 'progress.log') : null;
    if (runDir && existsSync(statePath(runDir))) toAdd.push(statePath(runDir));
    if (toAdd.length > 0) {
      const add = git(['add', '--', ...toAdd]);
      if (add.status !== 0) die(`git add failed: ${add.stderr.trim()}`);
    }
    const stagedDirty = git(['diff', '--cached', '--quiet']).status !== 0;
    const logDirty =
      progressLog && existsSync(progressLog) &&
      git(['status', '--porcelain', '--', progressLog]).stdout.trim() !== '';
    if (!stagedDirty && !logDirty) {
      console.log('nothing to commit');
      break;
    }
    // Record the commit event BEFORE committing so the log line ships inside
    // the commit and the working tree is clean afterwards.
    if (runDir) {
      logEvent(runDir, `commit: ${message}`);
      git(['add', '--', progressLog]);
    }
    const commit = git(['commit', '-m', message]);
    if (commit.status !== 0) die(`git commit failed: ${(commit.stderr || commit.stdout).trim()}`);
    console.log(commit.stdout.trim().split('\n')[0]);
    break;
  }

  case 'log': {
    const [runDir, ...text] = args;
    if (!runDir || text.length === 0) die('usage: log <run-dir> <event text...>');
    logEvent(runDir, text.join(' '));
    break;
  }

  case 'tail-log': {
    const [runDir, n = '10'] = args;
    if (!runDir) die('usage: tail-log <run-dir> [n]');
    const file = join(runDir, 'progress.log');
    if (!existsSync(file)) {
      console.log('(no progress.log yet)');
      break;
    }
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    console.log(lines.slice(-Number(n)).join('\n'));
    break;
  }

  default:
    die(`unknown command "${cmd ?? ''}" — see header comment for usage`);
}
