/**
 * Tests for evals.mjs — the eval-manifest / corpus helper.
 * Run with: node --test scripts/evals.test.mjs   (Node built-in runner, no deps)
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const EVALS = join(dirname(fileURLToPath(import.meta.url)), 'evals.mjs');

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'evals-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Run evals.mjs; returns { code, out }. */
function evals(...args) {
  const r = spawnSync('node', [EVALS, ...args], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

/** Build a run dir with two stories (3 criteria) + optional test files. */
function scaffold({ tests = true } = {}) {
  const run = join(dir, 'run');
  mkdirSync(join(run, 'stories'), { recursive: true });
  writeFileSync(join(run, 'state.json'), JSON.stringify({ run_id: 'phase-01' }));
  writeFileSync(join(run, 'stories', 'STORY-001.md'),
    '# STORY-001: Todos\n**Implements:** [TECH-001]\n\n## Acceptance criteria\n' +
    '- **AC-1:** GET returns 200\n- **AC-2:** POST creates\n\n## Notes\nignore\n');
  writeFileSync(join(run, 'stories', 'STORY-002.md'),
    '# STORY-002: UI\n**Implements:** [TECH-002]\n\n## Acceptance criteria\n- **AC-1:** list renders\n');
  const testsDir = join(dir, 'tests');
  mkdirSync(testsDir, { recursive: true });
  if (tests) {
    writeFileSync(join(testsDir, 'A.cs'),
      'public class A {\n  [Trait("criterion", "STORY-001/AC-1")]\n  [Fact]\n  public void Get_Ok() {}\n}\n');
    writeFileSync(join(testsDir, 'b.test.tsx'),
      'it("[STORY-002/AC-1] list renders", () => {});\n');
  }
  return { run, testsDir };
}

test('author generates one stub per AC-id and ignores non-criteria bullets', () => {
  const { run } = scaffold();
  const r = evals('author', run);
  assert.equal(r.code, 0);
  const m = readJson(join(run, 'evals', 'manifest.json'));
  assert.deepEqual(m.evals.map((e) => e.id).sort(), ['STORY-001/AC-1', 'STORY-001/AC-2', 'STORY-002/AC-1']);
  assert.equal(m.evals[0].trace.tech[0], 'TECH-001');
  assert.equal(m.evals.every((e) => e.check.tests.length === 0), true);
});

test('scan derives bindings from xUnit Trait and Vitest title token', () => {
  const { run, testsDir } = scaffold();
  evals('author', run);
  const r = evals('scan', run, testsDir);
  assert.equal(r.code, 0);
  const m = readJson(join(run, 'evals', 'manifest.json'));
  const byId = Object.fromEntries(m.evals.map((e) => [e.id, e.check.tests.length]));
  assert.equal(byId['STORY-001/AC-1'], 1); // xUnit trait
  assert.equal(byId['STORY-002/AC-1'], 1); // vitest token
  assert.equal(byId['STORY-001/AC-2'], 0); // no test written
});

test('run gate fails (exit 1) on an unbound criterion, passes when filtered to bound', () => {
  const { run, testsDir } = scaffold();
  evals('author', run);
  evals('scan', run, testsDir);
  const all = evals('run', run, '--suite-green');
  assert.equal(all.code, 1);
  assert.match(all.out, /STORY-001\/AC-2/);
  const filtered = evals('run', run, '--filter', 'STORY-002', '--suite-green');
  assert.equal(filtered.code, 0);
});

test('promote mints sequential EVAL ids, skips unbound, and is idempotent', () => {
  const { run, testsDir } = scaffold();
  evals('author', run);
  evals('scan', run, testsDir);
  const corpus = join(dir, 'evals');
  const p1 = evals('promote', run, corpus);
  assert.equal(p1.code, 0);
  const reg = readJson(join(corpus, 'registry.json'));
  assert.deepEqual(Object.keys(reg.evals).sort(), ['EVAL-0001', 'EVAL-0002']); // only 2 bound
  assert.equal(reg.next_id, 3);
  assert.ok(existsSync(join(corpus, 'EVAL-0001.json')));
  // re-promote: no new ids
  evals('promote', run, corpus);
  const reg2 = readJson(join(corpus, 'registry.json'));
  assert.equal(reg2.next_id, 3);
});

test('replay passes when tests present, fails when a proving test is removed', () => {
  const { run, testsDir } = scaffold();
  evals('author', run);
  evals('scan', run, testsDir);
  const corpus = join(dir, 'evals');
  evals('promote', run, corpus);
  const ok = evals('replay', '--corpus', corpus, testsDir);
  assert.equal(ok.code, 0);
  // remove the vitest test → its eval loses its proving test
  rmSync(join(testsDir, 'b.test.tsx'));
  const bad = evals('replay', '--corpus', corpus, testsDir);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /STORY-002\/AC-1/);
});

test('retire removes an eval from replay; superseded is also skipped', () => {
  const { run, testsDir } = scaffold();
  evals('author', run);
  evals('scan', run, testsDir);
  const corpus = join(dir, 'evals');
  evals('promote', run, corpus);
  rmSync(join(testsDir, 'b.test.tsx'));
  // find the eval id for STORY-002/AC-1
  const reg = readJson(join(corpus, 'registry.json'));
  const [eid] = Object.entries(reg.evals).find(([, v]) => v.source.criterion_id === 'STORY-002/AC-1');
  const rt = evals('retire', eid, 'feature removed', '--corpus', corpus);
  assert.equal(rt.code, 0);
  const after = evals('replay', '--corpus', corpus, testsDir);
  assert.equal(after.code, 0); // retired eval no longer gates
  const recs = readJson(join(corpus, `${eid}.json`));
  assert.equal(recs.status, 'retired');
});

test('set-kind changes check.kind, marks non-test source human, and run treats it as bound', () => {
  const { run } = scaffold({ tests: false });
  evals('author', run);
  // reclassify the never-tested criterion as a judge check
  const sk = evals('set-kind', run, 'STORY-001/AC-2', 'judge');
  assert.equal(sk.code, 0);
  const m = readJson(join(run, 'evals', 'manifest.json'));
  const ev = m.evals.find((e) => e.id === 'STORY-001/AC-2');
  assert.equal(ev.check.kind, 'judge');
  assert.equal(ev.check.source, 'human');
  // a judge criterion is bound without a tagged test
  const filtered = evals('run', run, '--filter', 'STORY-001/AC-2', '--suite-green');
  assert.equal(filtered.code, 0);
  // report surfaces the kind
  const rep = evals('report', run);
  assert.match(rep.out, /\[judge\].*STORY-001\/AC-2|STORY-001\/AC-2.*\[judge\]/);
});

test('set-kind rejects a bad kind and an unknown id', () => {
  const { run } = scaffold({ tests: false });
  evals('author', run);
  assert.equal(evals('set-kind', run, 'STORY-001/AC-1', 'bogus').code, 1);
  assert.equal(evals('set-kind', run, 'STORY-999/AC-9', 'judge').code, 1);
});

test('unknown command exits non-zero', () => {
  const r = evals('frobnicate');
  assert.equal(r.code, 1);
});
