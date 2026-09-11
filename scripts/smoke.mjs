/*
 * smoke.mjs — drives the real Electron app with Playwright and checks the things a human would:
 * the window boots, a log passed on the command line opens, the sample opens, the prompt shim answers
 * a synchronous window.prompt, a saved layout survives a relaunch, and the console shows no errors
 * (CSP violations surface there). Screenshots land in scripts/.smoke/ for a visual check.
 *
 *   node scripts/smoke.mjs [path\to\log.hpl]
 *
 * Runs with BIGDATA_DEV_PRO=1 so Pro features are reachable without a backend.
 */
import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(here, '.smoke');
mkdirSync(OUT, { recursive: true });
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

const LOG = resolve(process.argv[2] || 'C:/Users/kenbj/Code/mile (1).hpl');
if (!existsSync(LOG)) { console.error(`Log not found: ${LOG}`); process.exit(2); }
// Own userData folder: keeps the smoke away from the real profile AND from the single-instance lock of
// an installed BigData that happens to be running (which otherwise makes this instance quit at once).
const USER_DATA = join(OUT, 'userData');
mkdirSync(USER_DATA, { recursive: true });

const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };

async function launch(args) {
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.', ...args],
    cwd: ROOT,
    env: { ...process.env, BIGDATA_DEV_PRO: '1', BIGDATA_USER_DATA: USER_DATA },
  });
  const page = await app.firstWindow();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));
  return { app, page, consoleErrors };
}

// The prompt window closes on keydown (that's the point), so Playwright's press() — which waits for the
// keyup — reports "target closed". Treat that as the expected outcome.
async function pressAndClose(win, selector, key) {
  try { await win.press(selector, key); } catch (e) { if (!/closed/i.test(String(e))) throw e; }
}

const viewerOpen = (page) => page.waitForFunction(() => {
  const o = document.getElementById('viewerOverlay');
  return !!o && o.classList.contains('open') && getComputedStyle(o).display !== 'none';
}, null, { timeout: 30000 });

// ---- Run 1: launch with a log on the command line -------------------------------------------------
{
  const { app, page, consoleErrors } = await launch([LOG]);
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 20000 });
  check(true, 'home screen shown (dev Pro)');
  // The real BigData logo, not typed text (Ken, 2026-09-11): glue.ts applyBrandLogo puts the engine's
  // BRAND_LOGO_SVG into every brand slot. A build that loses it must not ship.
  const logo = await page.evaluate(() => {
    const m = document.querySelector('#screen-home .brand-mark'), s = m && m.querySelector('svg');
    return { logo: !!(m && m.classList.contains('brand-logo') && s), h: s ? Math.round(s.getBoundingClientRect().height) : 0 };
  });
  check(logo.logo && logo.h > 20, `home screen shows the real BigData logo (${logo.h}px tall)`);

  await viewerOpen(page);
  check(true, `viewer opened from argv: ${LOG}`);
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({
    version: typeof VIEWER_VERSION !== 'undefined' ? VIEWER_VERSION : null,
    channels: (window.VIEWER_DATA && window.VIEWER_DATA.channels) ? window.VIEWER_DATA.channels.length : (typeof VIEWER_DATA !== 'undefined' && VIEWER_DATA ? VIEWER_DATA.channels.length : -1),
    full: typeof VIEWER_DATA !== 'undefined' && VIEWER_DATA && VIEWER_DATA.full ? VIEWER_DATA.full.rows : -1,
    // Chart canvases only: NOT the overview-bar canvas, and not the .dlv-xhair cursor-line overlay
    // each panel carries since engine 0.1.44 -- a bare canvas count mixes all three and would hide a
    // missing chart.
    canvases: document.querySelectorAll('.dlv-graph-canvas-wrap canvas:not(.dlv-xhair)').length,
    xhairOverlays: document.querySelectorAll('.dlv-graph-canvas-wrap canvas.dlv-xhair').length,
    pro: typeof viewerIsPro === 'function' ? viewerIsPro() : null,
    promptShimmed: String(window.prompt).includes('promptSync'),
  }));
  console.log('   viewer info:', JSON.stringify(info));
  check(info.version === PKG_VERSION, `VIEWER_VERSION stamped from app version (got ${info.version}, package ${PKG_VERSION})`);
  check(info.channels > 5, `channels parsed (${info.channels})`);
  check(info.full > 1000, `full-resolution set present (${info.full} rows)`);
  check(info.canvases > 0, `charts rendered (${info.canvases} chart canvases)`);
  check(info.xhairOverlays === info.canvases, `every graph panel has its cursor-line overlay (${info.xhairOverlays} of ${info.canvases})`);
  check(info.pro === true, 'engine reports Pro');
  check(info.promptShimmed, 'window.prompt routed to promptSync');
  await page.screenshot({ path: join(OUT, '1-viewer-argv.png') });

  // Histograms tab (Pro-only) — click by text; soft-check the mode changed.
  const histTab = page.locator('.dlv-mode-tab', { hasText: /histogram/i }).first();
  if (await histTab.count()) {
    // A real mouse path crosses the engine's auto-hiding header strip, which slides open over the
    // tabs while the pointer sits there; dispatch the click instead of steering a pointer.
    await histTab.dispatchEvent('click');
    await page.waitForTimeout(1200);
    const mode = await page.evaluate(() => (typeof VIEWER_VIEW_MODE !== 'undefined' ? VIEWER_VIEW_MODE : null));
    check(mode === 'histograms', `Histograms tab switches mode (got ${mode})`);
    await page.screenshot({ path: join(OUT, '2-histograms.png') });
  } else {
    check(false, 'Histograms tab present');
  }

  // Synchronous prompt shim: evaluate blocks the renderer until the modal answers.
  const promptResult = page.evaluate(() => window.prompt('Smoke prompt:', 'default'));
  const promptWin = await app.waitForEvent('window', { timeout: 10000 });
  await promptWin.waitForSelector('#val');
  const shown = await promptWin.evaluate(() => ({ msg: document.getElementById('msg').textContent, val: document.getElementById('val').value }));
  check(shown.msg === 'Smoke prompt:' && shown.val === 'default', `prompt window shows message/default (${JSON.stringify(shown)})`);
  await promptWin.fill('#val', 'hello from smoke');
  await pressAndClose(promptWin, '#val', 'Enter');
  check((await promptResult) === 'hello from smoke', 'prompt returns typed value on Enter');

  const cancelResult = page.evaluate(() => window.prompt('Cancel me:', 'x'));
  const promptWin2 = await app.waitForEvent('window', { timeout: 10000 });
  await promptWin2.waitForSelector('#val');
  await pressAndClose(promptWin2, '#val', 'Escape');
  check((await cancelResult) === null, 'prompt returns null on Escape');

  // Save a layout through the engine's provider (prompts for a name) and confirm it lists.
  const saveResult = page.evaluate(() => window.DATAVIEWER.layouts.save({ kind: 'view', smoke: true }));
  const promptWin3 = await app.waitForEvent('window', { timeout: 10000 });
  await promptWin3.waitForSelector('#val');
  await promptWin3.fill('#val', 'Smoke Layout');
  await pressAndClose(promptWin3, '#val', 'Enter');
  check((await saveResult) === true, 'layouts.save via prompt returns true');
  const listed = await page.evaluate(() => window.DATAVIEWER.layouts.list().map((l) => l.name));
  check(listed.includes('Smoke Layout'), `saved layout listed (${listed.join(', ')})`);

  // Close the viewer, home should be back with the file in Recent.
  await page.evaluate(() => { if (typeof closeViewer === 'function') closeViewer(); });
  await page.waitForTimeout(800);
  const recents = await page.locator('#recentList li').count();
  check(recents >= 1, `recent list has the opened file (${recents})`);

  // Open the bundled sample.
  await page.click('#btnSample');
  await viewerOpen(page);
  await page.waitForTimeout(1200);
  const sampleName = await page.evaluate(() => (document.querySelector('.dlv-header') || document.body).textContent.includes('mile.hpl'));
  check(sampleName, 'sample mile.hpl opened');
  await page.screenshot({ path: join(OUT, '3-sample.png') });

  const errs = consoleErrors.filter((e) => !/DevTools|Autofill|Electron Security Warning/i.test(e));
  check(errs.length === 0, `no console errors/warnings (${errs.length})`);
  errs.forEach((e) => console.log('   console:', e.slice(0, 300)));
  await app.close();
}

// ---- Run 2: relaunch, the saved layout must still be there -----------------------------------------
{
  const { app, page } = await launch([]);
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(500);
  const listed = await page.evaluate(() => window.DATAVIEWER.layouts.list().map((l) => l.name));
  check(listed.includes('Smoke Layout'), `saved layout survives relaunch (${listed.join(', ')})`);
  // clean up the smoke layout so it doesn't accumulate
  await page.evaluate(() => { const l = window.DATAVIEWER.layouts.list().find((x) => x.name === 'Smoke Layout'); if (l) window.DATAVIEWER.layouts.remove(l.id); });
  await page.screenshot({ path: join(OUT, '4-home.png') });
  await app.close();
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
