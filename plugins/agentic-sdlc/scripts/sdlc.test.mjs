/**
 * Tests for sdlc.mjs — the state/commit/log helper.
 * Run with: node --test scripts/sdlc.test.mjs   (Node built-in runner, no deps)
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SDLC = join(dirname(fileURLToPath(import.meta.url)), 'sdlc.mjs');

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sdlc-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Run sdlc.mjs with cwd = dir (so its internal `git` calls target the test repo). */
function sdlc(cwd, ...args) {
  const r = spawnSync('node', [SDLC, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

/** Init a git repo at `dir` with one committed file, on `branch`. */
function initRepo(repoDir, { branch = 'master' } = {}) {
  git(repoDir, ['init', '-q', '-b', branch]);
  git(repoDir, ['config', 'user.email', 'test@test.com']);
  git(repoDir, ['config', 'user.name', 'test']);
  writeFileSync(join(repoDir, 'README.md'), 'base\n');
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-q', '-m', 'base']);
}

function scaffoldRun(baseDir, initialState = {}) {
  const run = join(baseDir, 'run');
  mkdirSync(run, { recursive: true });
  writeFileSync(join(run, 'state.json'), JSON.stringify(initialState));
  return run;
}

// ---- set-stage ----

test('set-stage creates the stage entry and logs the transition', () => {
  const run = scaffoldRun(dir);
  const r = sdlc(dir, 'set-stage', run, 'ba', 'in_progress');
  assert.equal(r.code, 0);
  const state = readJson(join(run, 'state.json'));
  assert.equal(state.stages.ba.status, 'in_progress');
  assert.match(readFileSync(join(run, 'progress.log'), 'utf8'), /stage ba pending -> in_progress/);
});

test('set-stage rejects an invalid status', () => {
  const run = scaffoldRun(dir);
  const r = sdlc(dir, 'set-stage', run, 'ba', 'bogus');
  assert.equal(r.code, 1);
  assert.match(r.out, /invalid status/);
});

// ---- set-field ----

test('set-field sets a dotted path, creating intermediate objects', () => {
  const run = scaffoldRun(dir);
  const r = sdlc(dir, 'set-field', join(run, 'state.json'), 'phase_plan.status', '"in_progress"');
  assert.equal(r.code, 0);
  const state = readJson(join(run, 'state.json'));
  assert.equal(state.phase_plan.status, 'in_progress');
});

// ---- bump-iter ----

test('bump-iter increments the stage iteration counter', () => {
  const run = scaffoldRun(dir);
  sdlc(dir, 'set-stage', run, 'ba', 'in_progress');
  assert.equal(sdlc(dir, 'bump-iter', run, 'ba').out.trim(), '1');
  assert.equal(sdlc(dir, 'bump-iter', run, 'ba').out.trim(), '2');
});

// ---- story-status / story-iter ----

test('story-status updates a known story and dies on an unknown one', () => {
  const run = scaffoldRun(dir, { stories: { 'STORY-001': { status: 'pending' } } });
  const ok = sdlc(dir, 'story-status', run, 'STORY-001', 'in_progress');
  assert.equal(ok.code, 0);
  assert.equal(readJson(join(run, 'state.json')).stories['STORY-001'].status, 'in_progress');
  const bad = sdlc(dir, 'story-status', run, 'STORY-999', 'in_progress');
  assert.equal(bad.code, 1);
});

test('story-iter bumps then resets a counter', () => {
  const run = scaffoldRun(dir, { stories: { 'STORY-001': {} } });
  assert.equal(sdlc(dir, 'story-iter', run, 'STORY-001', 'reviewer_iterations').out.trim(), '1');
  assert.equal(sdlc(dir, 'story-iter', run, 'STORY-001', 'reviewer_iterations').out.trim(), '2');
  assert.equal(sdlc(dir, 'story-iter', run, 'STORY-001', 'reviewer_iterations', 'reset').out.trim(), '0');
});

// ---- log / tail-log ----

test('log appends an event and tail-log reads it back', () => {
  const run = scaffoldRun(dir);
  sdlc(dir, 'log', run, 'hello', 'world');
  assert.match(sdlc(dir, 'tail-log', run).out, /hello world/);
});

// ---- commit-step ----

test('commit-step stages explicit paths and commits', () => {
  initRepo(dir);
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  const r = sdlc(dir, 'commit-step', 'add a', 'a.txt');
  assert.equal(r.code, 0);
  assert.match(git(dir, ['log', '--oneline', '-1']).stdout, /add a/);
  assert.equal(git(dir, ['status', '--porcelain']).stdout.trim(), '');
});

test('commit-step requires a message', () => {
  initRepo(dir);
  const r = sdlc(dir, 'commit-step');
  assert.equal(r.code, 1);
  assert.match(r.out, /usage: commit-step/);
});

test('commit-step reports "nothing to commit" on a clean tree (idempotent)', () => {
  initRepo(dir);
  const r = sdlc(dir, 'commit-step', 'noop');
  assert.equal(r.code, 0);
  assert.match(r.out, /nothing to commit/);
});

test('commit-step --run auto-stages state.json and progress.log', () => {
  initRepo(dir);
  const run = scaffoldRun(dir, { a: 1 });
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'init run']);
  sdlc(dir, 'set-field', join(run, 'state.json'), 'a', '2'); // dirties state.json, creates progress.log
  const r = sdlc(dir, 'commit-step', '--run', run, 'update a');
  assert.equal(r.code, 0);
  assert.equal(git(dir, ['status', '--porcelain']).stdout.trim(), '');
  assert.match(readFileSync(join(run, 'progress.log'), 'utf8'), /commit: update a/);
});

test('commit-step --all stages every change, including files outside explicit paths', () => {
  initRepo(dir);
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  writeFileSync(join(dir, 'b.txt'), 'two\n');
  const r = sdlc(dir, 'commit-step', '--all', 'add everything');
  assert.equal(r.code, 0);
  assert.equal(git(dir, ['status', '--porcelain']).stdout.trim(), '');
  assert.match(git(dir, ['show', '--stat', '-1']).stdout, /a\.txt/);
  assert.match(git(dir, ['show', '--stat', '-1']).stdout, /b\.txt/);
});

test('commit-step rejects --all combined with explicit paths instead of silently dropping them', () => {
  initRepo(dir);
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  const r = sdlc(dir, 'commit-step', '--all', 'add everything', 'a.txt');
  assert.equal(r.code, 1);
  assert.match(r.out, /--all.*cannot combine with explicit paths/);
  assert.doesNotMatch(git(dir, ['log', '--oneline']).stdout, /add everything/); // nothing committed
});

// ---- cleanup-branch ----

test('cleanup-branch dies (does not silently continue) when discarding uncommitted changes fails', () => {
  // Not a git repository at all, so `git checkout -- .` fails immediately —
  // exercises the same status-check path a locked file or permission error
  // would hit, without relying on platform-specific file-locking tricks.
  const r = sdlc(dir, 'cleanup-branch', 'feature', 'master');
  assert.equal(r.code, 1);
  assert.match(r.out, /git checkout -- \. failed/);
});

test('cleanup-branch switches to the given parent and deletes the cancel branch', () => {
  initRepo(dir, { branch: 'master' });
  git(dir, ['checkout', '-q', '-b', 'feature']);
  writeFileSync(join(dir, 'work.txt'), 'work\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'work']);
  writeFileSync(join(dir, 'scratch.txt'), 'uncommitted\n'); // untracked — should be discarded

  const r = sdlc(dir, 'cleanup-branch', 'feature', 'master');
  assert.equal(r.code, 0);
  assert.equal(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim(), 'master');
  assert.doesNotMatch(git(dir, ['branch', '--format=%(refname:short)']).stdout, /feature/);
  assert.equal(existsSync(join(dir, 'scratch.txt')), false);
});

test('cleanup-branch falls back to main when the given parent does not exist, and deletes the cancel branch', () => {
  initRepo(dir, { branch: 'main' });
  git(dir, ['checkout', '-q', '-b', 'feature']);
  const r = sdlc(dir, 'cleanup-branch', 'feature', 'nonexistent-parent');
  assert.equal(r.code, 0);
  assert.equal(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim(), 'main');
  assert.doesNotMatch(git(dir, ['branch', '--format=%(refname:short)']).stdout, /feature/);
});

test('cleanup-branch errors and leaves the branch intact when no parent/main/master exists', () => {
  initRepo(dir, { branch: 'trunk' }); // neither main nor master exists
  git(dir, ['checkout', '-q', '-b', 'feature']);
  const r = sdlc(dir, 'cleanup-branch', 'feature');
  assert.equal(r.code, 1);
  assert.match(r.out, /none of \[main, master\] exist/);
  assert.equal(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim(), 'feature');
});

test('cleanup-branch accepts a custom fallback-branch list overriding the main/master default', () => {
  initRepo(dir, { branch: 'trunk' });
  git(dir, ['checkout', '-q', '-b', 'feature']);
  const r = sdlc(dir, 'cleanup-branch', 'feature', 'nonexistent-parent', 'trunk');
  assert.equal(r.code, 0);
  assert.equal(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim(), 'trunk');
  assert.doesNotMatch(git(dir, ['branch', '--format=%(refname:short)']).stdout, /feature/);
});

test('cleanup-branch requires a cancel-branch argument', () => {
  const r = sdlc(dir, 'cleanup-branch');
  assert.equal(r.code, 1);
  assert.match(r.out, /usage: cleanup-branch/);
});

// ---- dispatcher ----

test('unknown command exits non-zero', () => {
  const r = sdlc(dir, 'frobnicate');
  assert.equal(r.code, 1);
});
