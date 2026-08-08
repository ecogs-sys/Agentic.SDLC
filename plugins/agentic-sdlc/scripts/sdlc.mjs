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
 *   node sdlc.mjs commit-step  [--run <run-dir>] [--all] "<message>" [paths...]
 *   node sdlc.mjs log          <run-dir> <event text...>
 *   node sdlc.mjs tail-log     <run-dir> [n]
 *   node sdlc.mjs cleanup-branch <cancel-branch> [parent-branch] [fallback-branch...]
 *
 * Every state-mutating command appends a timestamped line to <run-dir>/progress.log
 * (the run's live activity feed — `tail -f` it during long stages).
 *
 * commit-step: `--run <run-dir>` auto-stages <run-dir>/state.json and
 * <run-dir>/progress.log alongside any extra paths. `--all` stages every change
 * (git add -A) instead of explicit paths — it cannot be combined with explicit
 * paths (fails fast rather than silently ignoring them). If nothing is staged
 * the command prints "nothing to commit" and exits 0 (idempotent).
 *
 * cleanup-branch: discards uncommitted changes, switches to parent-branch (else
 * the fallback-branch args, defaulting to main, then master, if none given),
 * then deletes cancel-branch. Used by cancel-run.
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
    let all = false;
    let rest = [...args];
    if (rest[0] === '--run') {
      runDir = rest[1];
      rest = rest.slice(2);
    }
    if (rest[0] === '--all') {
      all = true;
      rest = rest.slice(1);
    }
    const [message, ...paths] = rest;
    if (!message) die('usage: commit-step [--run <run-dir>] [--all] "<message>" [paths...]');
    if (all && paths.length > 0) die('commit-step: --all stages everything — cannot combine with explicit paths');
    const toAdd = [...paths];
    const progressLog = runDir ? join(runDir, 'progress.log') : null;
    if (runDir && existsSync(statePath(runDir))) toAdd.push(statePath(runDir));
    if (all) {
      const add = git(['add', '-A']);
      if (add.status !== 0) die(`git add -A failed: ${add.stderr.trim()}`);
    } else if (toAdd.length > 0) {
      const add = git(['add', '--', ...toAdd]);
      if (add.status !== 0) die(`git add failed: ${add.stderr.trim()}`);
    }
    // Single `git status --porcelain` answers both "is anything staged" and
    // "is progressLog dirty" without a second git spawn.
    const porcelain = git(['status', '--porcelain']).stdout;
    const stagedDirty = porcelain.split('\n').some((l) => l[0] && l[0] !== ' ' && l[0] !== '?');
    const logDirty =
      progressLog && existsSync(progressLog) &&
      porcelain.split('\n').some((l) => l.slice(3) === progressLog.replace(/\\/g, '/'));
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

  case 'cleanup-branch': {
    const [cancelBranch, parentBranch, ...fallbacks] = args;
    if (!cancelBranch) die('usage: cleanup-branch <cancel-branch> [parent-branch] [fallback-branch...]');
    // Discard any uncommitted changes so the branch switch is clean.
    const discard = git(['checkout', '--', '.']);
    if (discard.status !== 0) die(`git checkout -- . failed: ${discard.stderr.trim()}`);
    const clean = git(['clean', '-fd']);
    if (clean.status !== 0) die(`git clean -fd failed: ${clean.stderr.trim()}`);
    // Switch to a safe branch. Try parent, then the fallback list (default
    // main, master — override by passing your own fallback-branch args). Never
    // use `git checkout -` — it may land us back on the cancel branch, after
    // which `git branch -D` cannot delete it.
    const candidates = [parentBranch, ...(fallbacks.length > 0 ? fallbacks : ['main', 'master'])].filter(Boolean);
    // One batched `git branch --list` instead of one `rev-parse` per candidate.
    const existing = new Set(
      git(['branch', '--list', ...candidates]).stdout.split('\n').map((l) => l.replace(/^\*?\s+/, '').trim()).filter(Boolean)
    );
    const target = candidates.find((b) => existing.has(b));
    if (!target) {
      die(
        `none of [${candidates.join(', ')}] exist — checkout your default branch ` +
        `and delete the branch yourself: git branch -D ${cancelBranch}`
      );
    }
    const co = git(['checkout', target]);
    if (co.status !== 0) die(`git checkout ${target} failed: ${co.stderr.trim()}`);
    // We are guaranteed to be on a different branch now.
    const del = git(['branch', '-D', cancelBranch]);
    if (del.status !== 0) die(`git branch -D ${cancelBranch} failed: ${del.stderr.trim()}`);
    console.log(`switched to ${target}, deleted ${cancelBranch}`);
    break;
  }

  default:
    die(`unknown command "${cmd ?? ''}" — see header comment for usage`);
}
