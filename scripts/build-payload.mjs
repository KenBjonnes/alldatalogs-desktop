/*
 * build-payload.mjs — assembles payload/ (the web app the Electron shell serves at bigdata://app/)
 * from its canonical sources and records exactly what shipped in payload/BUNDLED.json.
 *
 * WHY: the app must SHIP a copy of the viewer engine, the decoder and the vendor libs. A shipped copy
 * is a copy that can drift, and drift is this project's repeat failure (a stale dvcore.js shipped a bad
 * HPL decoder twice; the single-file offline build fell 9 engine files behind). So copies are never
 * made by hand: this script pulls them, REBUILDS the decoder from source instead of copying it, hashes
 * everything, and `--check` fails loudly when the committed payload is stale or inconsistent.
 *
 * The payload mirrors the site's apps/web/public layout (/vendor, /viewer-engine, /parse-worker.js,
 * /sample) so the site's parse-worker.js and script order work with zero edits.
 *
 *   node scripts/build-payload.mjs           refresh from source (needs the source folders: Ken's PC)
 *   node scripts/build-payload.mjs --check   no writes; exit 1 if payload/ differs from BUNDLED.json,
 *                                            from source (when the source folders exist), or if
 *                                            renderer/index.html loads scripts in the wrong order
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const PAYLOAD = join(ROOT, 'payload');

// Source roots. The engine comes from the gated RELEASE folder (tests passed, never the working copy);
// everything else from the alldatalogs repo, which is its home. Override for other machines/CI.
const RELEASE_DIR = process.env.BIGDATA_RELEASE_DIR || 'C:/Users/kenbj/Code/datalog viewer';
const SITE = process.env.BIGDATA_SITE_REPO || 'C:/websites/Alldatalogs';

// The 13 DataViewer-owned engine files. Keep in step with the site's
// apps/web/scripts/sync-viewer-engine.mjs VENDOR list and the work folder's release.ps1 $files.
const ENGINE = [
  'datalog-viewer.css',
  'datalog-histogram.css',
  'datalog-histogram-editor.css',
  'datalog-presets.js',
  'datalog-gauges.js',
  'datalog-scorecard.js',
  'datalog-scorecard-evaluators.js',
  'datalog-expr.js',
  'datalog-histogram.js',
  'datalog-histogram-ui.js',
  'datalog-histogram-editor.js',
  'datalog-hpt.js',
  'datalog-viewer.js',
];

// Straight copies: [source, payload-relative destination].
const COPIES = [
  ...ENGINE.map((f) => [join(RELEASE_DIR, f), `viewer-engine/${f}`]),
  [join(SITE, 'packages/viewer-engine/src/runtime.js'), 'viewer-engine/runtime.js'],
  [join(SITE, 'apps/web/public/vendor/chart.umd.js'), 'vendor/chart.umd.js'],
  [join(SITE, 'apps/web/public/vendor/hammer.min.js'), 'vendor/hammer.min.js'],
  [join(SITE, 'apps/web/public/vendor/chartjs-plugin-zoom.min.js'), 'vendor/chartjs-plugin-zoom.min.js'],
  [join(SITE, 'apps/web/public/vendor/pako.min.js'), 'vendor/pako.min.js'],
  [join(SITE, 'apps/web/public/parse-worker.js'), 'parse-worker.js'],
  [join(SITE, 'apps/web/public/sample/mile.hpl'), 'sample/mile.hpl'],
];

// esbuild outputs: rebuilt from source every time, never copied. Same invocation shapes as the site's
// apps/web/scripts/regen-dvcore.mjs so the decoder can't be a different build than the site ships.
const BUILDS = [
  {
    dest: 'viewer-engine/dvcore.js',
    from: join(SITE, 'packages/datalog-core/browser/entry.ts'),
    options: { format: 'iife', globalName: 'DVCore', platform: 'browser' },
  },
  {
    dest: 'glue.js',
    from: join(ROOT, 'renderer/src/glue.ts'),
    options: {
      format: 'iife',
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' },
      // The renderer reuses the site's payload builder by path so it can never drift from the web app.
      alias: { '@site/viewerPayload': join(SITE, 'apps/web/lib/viewerPayload.ts') },
    },
  },
];

// The order renderer/index.html must load the payload scripts in (the site's OpenLog.tsx order). The
// engine files are plain globals-in-order IIFEs; loading one out of order fails silently at runtime.
export const SCRIPT_ORDER = [
  '/shim.js',
  '/vendor/chart.umd.js',
  '/vendor/hammer.min.js',
  '/vendor/chartjs-plugin-zoom.min.js',
  '/vendor/pako.min.js',
  '/viewer-engine/dvcore.js',
  '/viewer-engine/runtime.js',
  '/viewer-engine/datalog-presets.js',
  '/viewer-engine/datalog-gauges.js',
  '/viewer-engine/datalog-scorecard.js',
  '/viewer-engine/datalog-scorecard-evaluators.js',
  '/viewer-engine/datalog-expr.js',
  '/viewer-engine/datalog-histogram.js',
  '/viewer-engine/datalog-histogram-ui.js',
  '/viewer-engine/datalog-histogram-editor.js',
  '/viewer-engine/datalog-hpt.js',
  '/viewer-engine/datalog-viewer.js',
  '/glue.js',
];

const check = process.argv.includes('--check');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const short = (h) => h.slice(0, 12);
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

function gitHead(dir) {
  try { return execSync('git rev-parse --short HEAD', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

async function buildOne(b) {
  const r = await build({ entryPoints: [b.from], bundle: true, write: false, logLevel: 'warning', ...b.options });
  return Buffer.from(r.outputFiles[0].contents);
}

function scriptOrderProblems() {
  const html = readFileSync(join(ROOT, 'renderer/index.html'), 'utf8');
  const found = [...html.matchAll(/<script[^>]*\ssrc="([^"?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);
  const problems = [];
  if (found.length !== SCRIPT_ORDER.length || found.some((s, i) => s !== SCRIPT_ORDER[i])) {
    problems.push(`renderer/index.html script order differs from SCRIPT_ORDER:\n  have: ${found.join(' ')}\n  want: ${SCRIPT_ORDER.join(' ')}`);
  }
  return problems;
}

async function main() {
  const sourcesPresent = existsSync(RELEASE_DIR) && existsSync(SITE);
  const manifestPath = join(PAYLOAD, 'BUNDLED.json');
  let problems = scriptOrderProblems();

  if (check) {
    // 1) Committed payload must match its own manifest (this is all CI can verify).
    if (!existsSync(manifestPath)) { console.error('MISSING payload/BUNDLED.json — run: node scripts/build-payload.mjs'); process.exit(1); }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const [file, meta] of Object.entries(manifest.files)) {
      const p = join(PAYLOAD, file);
      if (!existsSync(p)) { problems.push(`MISSING payload/${file}`); continue; }
      const h = sha(readFileSync(p));
      if (h !== meta.sha256) problems.push(`MODIFIED payload/${file} (manifest ${short(meta.sha256)} vs disk ${short(h)})`);
    }
    for (const want of [...COPIES.map((c) => c[1]), ...BUILDS.map((b) => b.dest)]) {
      if (!manifest.files[want]) problems.push(`NOT IN MANIFEST: ${want}`);
    }
    // 2) When the sources are here (Ken's PC), the payload must also match them.
    if (sourcesPresent) {
      for (const [src, dest] of COPIES) {
        if (!existsSync(src)) { problems.push(`MISSING SOURCE ${src}`); continue; }
        const a = readFileSync(src); const b = existsSync(join(PAYLOAD, dest)) ? readFileSync(join(PAYLOAD, dest)) : null;
        if (!b || !a.equals(b)) problems.push(`STALE payload/${dest} (source ${short(sha(a))} vs payload ${b ? short(sha(b)) : 'missing'})`);
      }
      for (const b of BUILDS) {
        if (!existsSync(b.from)) { problems.push(`MISSING SOURCE ${b.from}`); continue; }
        const out = await buildOne(b);
        const have = existsSync(join(PAYLOAD, b.dest)) ? readFileSync(join(PAYLOAD, b.dest)) : null;
        if (!have || !out.equals(have)) problems.push(`STALE payload/${b.dest} (rebuilt ${short(sha(out))} vs payload ${have ? short(sha(have)) : 'missing'})`);
      }
    } else {
      console.log('build-payload --check: source folders not present, verified payload against BUNDLED.json only.');
    }
    if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} problem(s). Run: node scripts/build-payload.mjs`); process.exit(1); }
    console.log(`build-payload --check: ${Object.keys(manifest.files).length} payload files OK, script order OK.`);
    return;
  }

  if (!sourcesPresent) { console.error(`Source folders not found:\n  RELEASE_DIR=${RELEASE_DIR}\n  SITE=${SITE}\nSet BIGDATA_RELEASE_DIR / BIGDATA_SITE_REPO.`); process.exit(1); }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

  const files = {};
  const put = (dest, buf, from) => {
    const p = join(PAYLOAD, dest);
    mkdirSync(dirname(p), { recursive: true });
    const same = existsSync(p) && readFileSync(p).equals(buf);
    if (!same) writeFileSync(p, buf);
    files[dest] = { sha256: sha(buf), bytes: buf.length, from: from.replace(/\\/g, '/') };
    console.log(`  ${same ? '=' : '+'} ${dest.padEnd(46)} ${String(buf.length).padStart(8)} B  ${short(files[dest].sha256)}`);
  };
  for (const [src, dest] of COPIES) {
    if (!existsSync(src)) { console.error(`MISSING SOURCE: ${src}`); process.exit(1); }
    put(dest, readFileSync(src), src);
  }
  for (const b of BUILDS) {
    if (!existsSync(b.from)) { console.error(`MISSING SOURCE: ${b.from}`); process.exit(1); }
    put(b.dest, await buildOne(b), b.from + ' (esbuild)');
  }
  const manifest = {
    builtAt: new Date().toISOString(),
    sources: { releaseDir: RELEASE_DIR, siteRepo: SITE, siteCommit: gitHead(SITE) },
    files,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${rel(manifestPath)} (${Object.keys(files).length} files, site @ ${manifest.sources.siteCommit || '?'}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
