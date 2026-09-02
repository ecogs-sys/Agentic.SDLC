#!/usr/bin/env node
/**
 * evals.mjs — deterministic eval-manifest helper for the Agentic SDLC.
 *
 * Turns frozen acceptance criteria into a machine-checkable, replayable eval
 * manifest, keyed by the write-once `STORY-XXX/AC-n` ids the Tech Lead / Fix
 * Planner assign. The criterion→test binding is NOT hand-authored here: tests
 * carry the criterion id as metadata (xUnit `[Trait("criterion", "…")]` or a
 * Vitest title token `[STORY-XXX/AC-n]`) and `scan` DERIVES the binding from that
 * metadata — the tests stay the single source of truth. Node built-ins only;
 * works on Windows (Git Bash / PowerShell) and Linux CI.
 *
 * Usage:
 *   node evals.mjs author   <run-dir> [stories-dir] [--corpus <dir>]  # manifest stubs
 *   node evals.mjs scan     <run-dir> <test-path...> [--corpus <dir>] # bind from tags
 *   node evals.mjs run      <run-dir> [--filter <id,...>] [--suite-green]
 *   node evals.mjs report   <run-dir>                   # human-readable summary
 *   node evals.mjs set-kind <run-dir> <criterion-id> <test|assert|judge>   # human gate edit
 *   node evals.mjs promote   <run-dir> [corpus-dir]     # mint EVAL-NNNN into evals/
 *   node evals.mjs replay    [--corpus <dir>] [test-path...]   # regression gate
 *   node evals.mjs retire    <eval-id> <reason> [--corpus <dir>]
 *   node evals.mjs supersede <eval-id> <reason> [--corpus <dir>]
 *
 * The run manifest lives at <run-dir>/evals/manifest.json; the permanent corpus at
 * <corpus-dir>/registry.json + <corpus-dir>/EVAL-NNNN.json (default corpus-dir:
 * evals/ at cwd). `author`/`scan`/`run` append a timestamped line to
 * <run-dir>/progress.log (the run's activity feed), matching sdlc.mjs. `run` exits
 * non-zero if any targeted criterion is unbound (the run-specific completeness
 * gate); `replay` exits non-zero if any active corpus eval lost its proving test
 * (the permanent regression gate — an intended change must retire/supersede first).
 *
 * Story ids are unique across the repository (see sdlc.mjs next-story-id), which
 * is what makes the bare `STORY-XXX/AC-n` tag a safe key: runs share one test
 * tree, so a per-run id would let one run's tests bind and prove another run's
 * criteria. `author` fails closed if a run reuses an id the corpus already owns.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname, dirname, isAbsolute } from 'node:path';

const MANIFEST_VERSION = 1;
const TEST_EXTS = new Set([
  '.cs',                                          // xUnit
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts',   // Vitest
  '.c', '.h', '.cpp', '.hpp', '.cc',              // Unity (ESP-IDF)
]);

function die(msg) {
  console.error(`evals: ${msg}`);
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
  if (!existsSync(runDir)) return;
  appendFileSync(join(runDir, 'progress.log'), `${new Date().toISOString()} ${text}\n`, 'utf8');
}

function manifestPath(runDir) {
  return join(runDir, 'evals', 'manifest.json');
}

function loadManifest(runDir) {
  const file = manifestPath(runDir);
  if (!existsSync(file)) die(`no eval manifest at ${file} — run "author" first`);
  return readJson(file);
}

/** Load the permanent corpus registry, or null when the repo has no corpus yet. */
function loadRegistry(corpusDir) {
  const regFile = join(corpusDir, 'registry.json');
  return existsSync(regFile) ? readJson(regFile) : null;
}

/** criterion-id → owning run, from the corpus source_index ("<run>::<id>" keys). */
function corpusOwners(reg) {
  const owners = new Map();
  for (const key of Object.keys(reg?.source_index ?? {})) {
    const sep = key.lastIndexOf('::');
    if (sep !== -1) owners.set(key.slice(sep + 2), key.slice(0, sep));
  }
  return owners;
}

/** Pull one arg out of an argv array: `--name <value>` → value (or fallback). */
function takeFlag(rest, name, fallback) {
  const i = rest.indexOf(name);
  if (i === -1) return fallback;
  const [, value] = rest.splice(i, 2);
  return value ?? fallback;
}

/** Recursively collect files with a test-ish extension under a path (file or dir). */
function collectFiles(path) {
  if (!existsSync(path)) return [];
  const st = statSync(path);
  if (st.isFile()) return TEST_EXTS.has(extname(path)) ? [path] : [];
  const out = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'bin', 'obj', 'dist', '.git'].includes(entry.name)) continue;
      out.push(...collectFiles(full));
    } else if (TEST_EXTS.has(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

// ── Parsing ────────────────────────────────────────────────────────────────

const AC_ID = /STORY-\d+\/AC-\d+/;

/** Parse one STORY-XXX.md (write-stories format) → { story, tech[], criteria[] }. */
function parseStory(file) {
  const text = readFileSync(file, 'utf8');
  const storyFromHeading = text.match(/^#\s*(STORY-\d+)\b/m);
  const storyFromName = basename(file).match(/^(STORY-\d+)/);
  const story = (storyFromHeading?.[1] || storyFromName?.[1]);
  if (!story) return null;

  const impl = text.match(/\*\*Implements:\*\*\s*\[([^\]]*)\]/);
  const tech = impl
    ? impl[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Slice the "## Acceptance criteria" section up to the next "## " heading.
  const start = text.search(/^##\s+Acceptance criteria\s*$/m);
  const criteria = [];
  if (start !== -1) {
    const rest = text.slice(start);
    const end = rest.slice(1).search(/^##\s+/m); // skip our own heading
    const block = end === -1 ? rest : rest.slice(0, end + 1);
    const re = /^\s*[-*]\s*\*\*(AC-\d+):\*\*\s*(.+?)\s*$/gm;
    let m;
    while ((m = re.exec(block)) !== null) {
      criteria.push({ ac: m[1], text: m[2] });
    }
  }
  return { story, tech, criteria };
}

/**
 * Extract criterion-tag occurrences from a test file → [{ id, file, line, locator }].
 *
 * The `locator` is provenance, and the evidence `replay` uses to tell a deleted
 * test apart from one that was merely retagged — so it must name the test, not
 * repeat the tag. For xUnit that is the method name; for Vitest/Unity, the rest
 * of the test title after the `[tag]`.
 */
function extractTags(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  const push = (id, idx, locator) => {
    if (AC_ID.test(id)) hits.push({ id, file, line: idx + 1, locator: locator || id });
  };

  lines.forEach((line, idx) => {
    // xUnit: [Trait("criterion", "STORY-003/AC-1")]
    for (const m of line.matchAll(/\[Trait\(\s*"criterion"\s*,\s*"([^"]+)"\s*\)\]/g)) {
      // locator = the next method-ish identifier below the attribute. Traits stack
      // with [Fact]/[Theory]/[InlineData(…)] blocks, so look well past them.
      let locator = null;
      for (let j = idx + 1; j < Math.min(idx + 25, lines.length); j++) {
        const mm = lines[j].match(/\b(?:public|internal)\s+(?:static\s+)?(?:async\s+)?[\w<>\[\],\s]+?\s+(\w+)\s*\(/);
        if (mm) { locator = mm[1]; break; }
      }
      push(m[1], idx, locator);
    }
    // Vitest: it("[STORY-003/AC-1] …" | test(`[…]` | describe('[…]'
    // Unity (ESP-IDF): TEST_CASE("[STORY-003/AC-1] …", "[group]")
    for (const m of line.matchAll(
      /(?:\bit|\btest|\bdescribe|\bTEST_CASE)\s*(?:\.\w+)?\s*\(\s*[`'"]\s*\[([^\]]+)\]\s*([^`'"]*)/g
    )) {
      push(m[1], idx, m[2].trim());
    }
  });
  return hits;
}

/** The set of criterion ids actually tagged in a test file. */
function tagIdsIn(file) {
  return new Set(extractTags(file).map((h) => h.id));
}

// ── Commands ─────────────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'author': {
    const rest = [...args];
    const corpusDir = takeFlag(rest, '--corpus', 'evals');
    const [runDir, storiesArg] = rest;
    if (!runDir) die('usage: author <run-dir> [stories-dir] [--corpus <dir>]');
    const storiesDir = storiesArg || join(runDir, 'stories');
    if (!existsSync(storiesDir)) die(`stories dir not found: ${storiesDir}`);

    const storyFiles = readdirSync(storiesDir)
      .filter((f) => /^STORY-\d+\.md$/.test(f))
      .sort();
    if (storyFiles.length === 0) die(`no STORY-*.md files in ${storiesDir}`);

    const evals = [];
    for (const f of storyFiles) {
      const parsed = parseStory(join(storiesDir, f));
      if (!parsed) continue;
      for (const c of parsed.criteria) {
        evals.push({
          id: `${parsed.story}/${c.ac}`,
          trace: { story: parsed.story, tech: parsed.tech },
          criterion: c.text,
          check: { kind: 'test', source: 'annotation', tests: [] },
          status: { result: 'pending' },
        });
      }
    }
    if (evals.length === 0) die('no acceptance criteria with AC-ids found — check write-stories format');

    const runId = existsSync(join(runDir, 'state.json'))
      ? (readJson(join(runDir, 'state.json')).run_id ?? basename(runDir))
      : basename(runDir);

    // Story ids are unique across the repository, not per run (see sdlc.mjs
    // next-story-id). If this run reused an id another run already owns, its
    // tests would carry an ambiguous tag and the eval layer would bind and
    // replay the wrong criterion — so fail here, before any code is written.
    const owners = corpusOwners(loadRegistry(corpusDir));
    const collisions = evals
      .map((e) => [e.id, owners.get(e.id)])
      .filter(([, owner]) => owner && owner !== runId);
    if (collisions.length) {
      console.error(`evals: ${collisions.length} criterion id(s) are already owned by another run:`);
      for (const [id, owner] of collisions) console.error(`  - ${id} → ${owner}`);
      die('renumber this run\'s stories from the id "sdlc.mjs next-story-id" prints, then re-author');
    }

    const manifest = {
      manifest_version: MANIFEST_VERSION,
      run: runId,
      generated: new Date().toISOString(),
      evals,
    };
    mkdirSync(join(runDir, 'evals'), { recursive: true });
    writeJson(manifestPath(runDir), manifest);
    logEvent(runDir, `evals author — ${evals.length} criteria from ${storyFiles.length} stories`);
    console.log(`authored ${evals.length} eval stubs → ${manifestPath(runDir)}`);
    break;
  }

  case 'scan': {
    const rest = [...args];
    const corpusDir = takeFlag(rest, '--corpus', 'evals');
    const [runDir, ...paths] = rest;
    if (!runDir || paths.length === 0) die('usage: scan <run-dir> <test-path...> [--corpus <dir>]');
    const manifest = loadManifest(runDir);

    // id → set of "file:line locator" for provenance
    const found = new Map();
    for (const p of paths) {
      for (const file of collectFiles(p)) {
        for (const hit of extractTags(file)) {
          if (!found.has(hit.id)) found.set(hit.id, []);
          found.get(hit.id).push(`${hit.file}:${hit.line} ${hit.locator}`);
        }
      }
    }

    let bound = 0;
    const orphanTags = new Set(found.keys());
    for (const ev of manifest.evals) {
      const refs = found.get(ev.id);
      if (refs && refs.length) {
        ev.check.tests = refs;
        ev.check.source = 'annotation';
        bound++;
      }
      orphanTags.delete(ev.id);
    }
    manifest.scanned = new Date().toISOString();
    writeJson(manifestPath(runDir), manifest);

    // The scanned paths are a shared test tree: they also hold the tagged tests
    // of every earlier run. Those tags are valid criterion ids, just not ours —
    // only an id no run has ever owned is worth warning about (a typo).
    const owners = corpusOwners(loadRegistry(corpusDir));
    let priorRunTags = 0;
    for (const id of orphanTags) {
      if (owners.has(id)) { orphanTags.delete(id); priorRunTags++; }
    }

    const total = manifest.evals.length;
    logEvent(runDir, `evals scan — ${bound}/${total} criteria bound to tagged tests`);
    console.log(`bound ${bound}/${total} criteria${priorRunTags ? ` (${priorRunTags} tag(s) belong to earlier runs — ignored)` : ''}`);
    if (orphanTags.size) {
      console.log(`⚠ tagged tests reference unknown criterion ids: ${[...orphanTags].join(', ')}`);
    }
    break;
  }

  case 'run': {
    let runDir = null;
    let filter = null;
    let suiteGreen = false;
    const rest = [...args];
    while (rest.length) {
      const a = rest.shift();
      if (a === '--filter') filter = (rest.shift() || '').split(',').map((s) => s.trim()).filter(Boolean);
      else if (a === '--suite-green') suiteGreen = true;
      else if (!runDir) runDir = a;
      else die(`unexpected arg: ${a}`);
    }
    if (!runDir) die('usage: run <run-dir> [--filter <id,...>] [--suite-green]');
    const manifest = loadManifest(runDir);

    const targeted = manifest.evals.filter((e) => !filter || filter.includes(e.id) || filter.includes(e.trace.story));
    if (targeted.length === 0) die(`no evals match filter ${filter?.join(',') ?? ''}`);

    const unbound = [];
    for (const ev of targeted) {
      const isBound = ev.check.kind !== 'test' || (ev.check.tests && ev.check.tests.length > 0);
      if (!isBound) {
        ev.status = { result: 'unbound', checked: new Date().toISOString() };
        unbound.push(ev.id);
      } else {
        ev.status = {
          result: ev.check.kind === 'test' ? (suiteGreen ? 'pass' : 'bound') : 'pass',
          checked: new Date().toISOString(),
        };
      }
    }
    writeJson(manifestPath(runDir), manifest);

    const pass = unbound.length === 0;
    logEvent(runDir, `evals run — ${targeted.length - unbound.length}/${targeted.length} covered${suiteGreen ? ' (suite green)' : ''}`);
    if (pass) {
      console.log(`✔ eval gate PASS — ${targeted.length} criteria covered by tagged tests`);
    } else {
      console.log(`✖ eval gate FAIL — ${unbound.length} criteria have no tagged test:`);
      for (const id of unbound) console.log(`  - ${id}`);
      process.exit(1);
    }
    break;
  }

  case 'report': {
    const [runDir] = args;
    if (!runDir) die('usage: report <run-dir>');
    const manifest = loadManifest(runDir);
    console.log(`Eval manifest — run ${manifest.run} (${manifest.evals.length} criteria)`);
    for (const ev of manifest.evals) {
      const n = ev.check.tests?.length ?? 0;
      const mark = ev.status?.result === 'pass' ? '✔' : ev.status?.result === 'unbound' ? '✖' : '·';
      console.log(`  ${mark} ${ev.id} — [${ev.check.kind}] ${n} test(s) — ${ev.criterion}`);
    }
    break;
  }

  case 'set-kind': {
    const [runDir, id, kind] = args;
    if (!runDir || !id || !kind) die('usage: set-kind <run-dir> <criterion-id> <test|assert|judge>');
    if (!['test', 'assert', 'judge'].includes(kind)) die(`invalid kind "${kind}" — expected test | assert | judge`);
    const manifest = loadManifest(runDir);
    const ev = manifest.evals.find((e) => e.id === id);
    if (!ev) die(`unknown criterion id ${id} — not in ${manifestPath(runDir)}`);
    const prevKind = ev.check.kind;
    ev.check.kind = kind;
    // A non-test kind is a human decision that a tagged test won't prove this
    // criterion; a test kind restores the DERIVED (scan) binding source.
    ev.check.source = kind === 'test' ? 'annotation' : 'human';
    writeJson(manifestPath(runDir), manifest);
    logEvent(runDir, `evals set-kind — ${id} ${prevKind} → ${kind}`);
    console.log(`${id}: check.kind ${prevKind} → ${kind}`);
    break;
  }

  // ── Phase B: permanent corpus ──────────────────────────────────────────────

  case 'promote': {
    const [runDir, corpusArg] = args;
    if (!runDir) die('usage: promote <run-dir> [corpus-dir]');
    const corpusDir = corpusArg || 'evals';
    const manifest = loadManifest(runDir);
    mkdirSync(corpusDir, { recursive: true });

    const regFile = join(corpusDir, 'registry.json');
    const reg = existsSync(regFile)
      ? readJson(regFile)
      : { registry_version: 1, next_id: 1, source_index: {}, evals: {} };

    let minted = 0;
    let updated = 0;
    let skipped = 0;
    for (const ev of manifest.evals) {
      // Only promote bound evals — a criterion with no proving test never enters
      // the permanent corpus (the run gate should have blocked it already).
      if (ev.check.kind === 'test' && !(ev.check.tests && ev.check.tests.length)) {
        skipped++;
        continue;
      }
      const sourceKey = `${manifest.run}::${ev.id}`;
      let evalId = reg.source_index[sourceKey];
      if (!evalId) {
        evalId = `EVAL-${String(reg.next_id).padStart(4, '0')}`;
        reg.next_id += 1;
        reg.source_index[sourceKey] = evalId;
        minted++;
      } else {
        updated++;
      }
      const prev = reg.evals[evalId];
      const record = {
        eval_id: evalId,
        status: prev?.status ?? 'active',
        source: {
          run: manifest.run,
          criterion_id: ev.id,
          story: ev.trace.story,
          tech: ev.trace.tech,
          criterion: ev.criterion,
        },
        // Provenance = concrete tagged-test locators captured at promote time.
        // Replay derives its scan roots from these paths, and uses the locators
        // to tell a deleted test apart from one that was merely retagged.
        check: { kind: ev.check.kind, tests: ev.check.tests ?? [] },
        created: prev?.created ?? new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      reg.evals[evalId] = record;
      writeJson(join(corpusDir, `${evalId}.json`), record);
    }
    writeJson(regFile, reg);
    logEvent(runDir, `evals promote — ${minted} minted, ${updated} updated, ${skipped} skipped → ${corpusDir}`);
    console.log(`promoted → ${corpusDir}: ${minted} new EVAL id(s), ${updated} updated${skipped ? `, ${skipped} unbound skipped` : ''}`);
    break;
  }

  case 'replay': {
    const rest = [...args];
    const corpusDir = takeFlag(rest, '--corpus', 'evals');
    const paths = rest;
    const regFile = join(corpusDir, 'registry.json');
    if (!existsSync(regFile)) {
      console.log(`no corpus at ${regFile} — nothing to replay`);
      break;
    }
    const reg = readJson(regFile);
    const active = Object.values(reg.evals).filter((r) => r.status === 'active' && r.check.kind === 'test');

    // The corpus outlives any one run and spans every app_type ever built here,
    // so it — not the caller — decides what to scan. Roots are derived from the
    // test paths the corpus itself recorded at promote time; the paths passed in
    // are additive (they cover a test tree nothing has been promoted from yet).
    // A provenance ref is "<path>:<line> <locator>". Both halves can contain
    // spaces and the path can contain colons (a Windows drive), so anchor the
    // split on the ":<digits> " between them.
    const parseRef = (ref) => {
      const m = ref.match(/^(.+):(\d+) (.*)$/);
      return m ? { path: m[1], locator: m[3] } : { path: ref, locator: '' };
    };
    // Recorded paths are repo-relative, so their first segment is the test root
    // (tests/, src/) — broad enough that a test moved within it is still found.
    // An absolute path has no such root: scan its own directory instead, never
    // the filesystem root it starts with.
    const rootFor = (p) => {
      if (isAbsolute(p)) return dirname(p);
      const [first] = p.split(/[\\/]/);
      return first && first !== '.' && first !== '..' ? first : dirname(p);
    };
    const roots = new Set(paths.filter((p) => existsSync(p)));
    for (const rec of active) {
      for (const ref of rec.check.tests ?? []) {
        const root = rootFor(parseRef(ref).path);
        if (root && existsSync(root)) roots.add(root);
      }
    }
    if (roots.size === 0) die('nothing to scan — pass a test path, or promote a run first');

    // Index every test file under those roots by the criterion ids it tags.
    const hitsOf = new Map();
    const textOf = new Map();
    for (const root of roots) {
      for (const file of collectFiles(root)) {
        if (hitsOf.has(file)) continue;
        hitsOf.set(file, extractTags(file));
        textOf.set(file, readFileSync(file, 'utf8'));
      }
    }
    const proven = new Set();
    for (const hits of hitsOf.values()) for (const h of hits) proven.add(h.id);

    // A criterion is proven when a test *carries its id* — never when some file
    // merely mentions a string. Story ids are repo-unique, so this cannot bind
    // across runs.
    const regressions = [];
    for (const rec of active) {
      if (proven.has(rec.source.criterion_id)) continue;
      // Not proven. Distinguish a deleted test from one that still exists but was
      // retagged — the fix differs (fix the code, vs. supersede this eval).
      let retag = null;
      for (const ref of rec.check.tests ?? []) {
        const { locator } = parseRef(ref);
        if (!locator || AC_ID.test(locator)) continue; // no usable locator recorded
        for (const [file, text] of textOf) {
          const at = text.indexOf(locator);
          if (at === -1) continue;
          const line = text.slice(0, at).split(/\r?\n/).length;
          const near = hitsOf.get(file)
            .slice()
            .sort((a, b) => Math.abs(a.line - line) - Math.abs(b.line - line))[0];
          retag = { file, locator, id: near?.id };
          break;
        }
        if (retag) break;
      }
      regressions.push({ rec, retag });
    }

    const total = active.length;
    const rootList = [...roots].join(', ');
    if (regressions.length === 0) {
      console.log(`✔ corpus replay PASS — ${total} active eval(s) still proven by a tagged test (roots: ${rootList})`);
    } else {
      console.log(`✖ corpus replay FAIL — ${regressions.length}/${total} eval(s) lost their proving test (roots: ${rootList}):`);
      for (const { rec, retag } of regressions) {
        if (retag) {
          console.log(
            `  - ${rec.eval_id} (${rec.source.criterion_id}) RETAGGED — "${retag.locator}" in ${retag.file} ` +
            `now tags ${retag.id ?? 'no criterion'} — supersede this eval if that was intended`
          );
        } else {
          console.log(`  - ${rec.eval_id} (${rec.source.criterion_id}) MISSING — no test carries this id — ${rec.source.criterion}`);
        }
      }
      console.log('Fix the regression, or `EVALS retire|supersede <EVAL-ID> "<reason>"` if the change was intended.');
      process.exit(1);
    }
    break;
  }

  case 'retire':
  case 'supersede': {
    let corpusDir = 'evals';
    const rest = [...args];
    const positional = [];
    while (rest.length) {
      const a = rest.shift();
      if (a === '--corpus') corpusDir = rest.shift();
      else positional.push(a);
    }
    const [evalId, ...reasonParts] = positional;
    const reason = reasonParts.join(' ');
    if (!evalId || !reason) die(`usage: ${cmd} <eval-id> <reason> [--corpus <dir>]`);
    const regFile = join(corpusDir, 'registry.json');
    if (!existsSync(regFile)) die(`no corpus registry at ${regFile}`);
    const reg = readJson(regFile);
    const rec = reg.evals[evalId];
    if (!rec) die(`unknown eval id ${evalId} in ${regFile}`);
    rec.status = cmd === 'retire' ? 'retired' : 'superseded';
    rec[rec.status] = { reason, at: new Date().toISOString() };
    rec.updated = new Date().toISOString();
    writeJson(join(corpusDir, `${evalId}.json`), rec);
    writeJson(regFile, reg);
    console.log(`${evalId} → ${rec.status}: ${reason}`);
    break;
  }

  default:
    die(`unknown command "${cmd ?? ''}" — see header comment for usage`);
}
