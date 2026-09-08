/*
 * smoke-license.mjs — drives the real app WITHOUT the dev-Pro override against a throwaway user-data
 * folder, signing in as the test account (credentials in %USERPROFILE%\.alldatalogs-keys\).
 *
 *   node scripts/smoke-license.mjs pro     # account is Pro: sign-in → home → Pro; relaunch stays signed in; sign out
 *   node scripts/smoke-license.mjs gate    # account is NOT Pro: sign-in → "Pro required" gate
 *
 * Flip the test account between the two with SQL on subscription_status (see docs/LICENSING.md in the
 * site repo), then run the matching mode.
 */
import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(here, '.smoke');
mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] || 'pro';
const acct = JSON.parse(readFileSync(join(homedir(), '.alldatalogs-keys', 'bigdata-test-account.json'), 'utf8'));
const USER_DATA = join(tmpdir(), 'bigdata-smoke-userdata');
rmSync(USER_DATA, { recursive: true, force: true });

const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };

async function launch() {
  const env = { ...process.env, BIGDATA_USER_DATA: USER_DATA };
  delete env.BIGDATA_DEV_PRO;
  const app = await electron.launch({ executablePath: electronPath, args: ['.'], cwd: ROOT, env });
  const page = await app.firstWindow();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return { app, page, errors };
}
const visible = (page, sel, timeout = 30000) => page.waitForSelector(`${sel}:not([hidden])`, { timeout, state: 'visible' });

{
  const { app, page, errors } = await launch();
  await visible(page, '#screen-signin');
  check(true, 'fresh install shows the sign-in screen (no dev override)');
  await page.fill('#signinEmail', acct.email);
  await page.fill('#signinPassword', acct.password);
  await page.click('#signinBtn');

  if (mode === 'pro') {
    await visible(page, '#screen-home');
    const foot = await page.textContent('#footPro');
    check(/^Pro/.test(foot || ''), `home after sign-in, footer shows Pro (got "${foot}")`);
    const state = await page.evaluate(() => window.bigdata.license.get());
    check(state.pro === true && state.reason === 'ok', `license state ok (${JSON.stringify(state)})`);
    check(existsSync(join(USER_DATA, 'license.json')) && JSON.parse(readFileSync(join(USER_DATA, 'license.json'), 'utf8')).token, 'license.json holds a token');
    check(existsSync(join(USER_DATA, 'session.bin')), 'session.bin persisted (DPAPI)');
    await page.click('#btnSample');
    await page.waitForFunction(() => { const o = document.getElementById('viewerOverlay'); return !!o && o.classList.contains('open'); }, null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    const pro = await page.evaluate(() => (typeof viewerIsPro === 'function' ? viewerIsPro() : null));
    check(pro === true, 'engine reports Pro after a real sign-in');
    await page.screenshot({ path: join(OUT, 'license-1-pro.png') });
    check(errors.length === 0, `no console errors (${errors.length})`);
    errors.forEach((e) => console.log('   console:', e.slice(0, 200)));
    await app.close();

    // Relaunch: the persisted session + token must land on home without asking again.
    const second = await launch();
    await visible(second.page, '#screen-home', 30000);
    const state2 = await second.page.evaluate(() => window.bigdata.license.get());
    check(state2.pro === true, `relaunch stays signed in and Pro (${state2.reason})`);
    await second.page.click('#btnSignOut');
    await visible(second.page, '#screen-signin');
    await second.page.waitForTimeout(500);
    check(!existsSync(join(USER_DATA, 'session.bin')), 'sign out removes session.bin');
    const lic = existsSync(join(USER_DATA, 'license.json')) ? JSON.parse(readFileSync(join(USER_DATA, 'license.json'), 'utf8')) : null;
    check(!lic || !lic.token, 'sign out clears the token');
    await second.page.screenshot({ path: join(OUT, 'license-2-signed-out.png') });
    await second.app.close();
  } else if (mode === 'layouts-save') {
    // M3: a layout saved here must reach viewer_layouts (check with SQL afterwards).
    await visible(page, '#screen-home');
    await page.waitForTimeout(1500);
    const saved = await page.evaluate(() => window.DATAVIEWER.layouts.save({ kind: 'view', smoke: 'cloud' }, 'Cloud Smoke Layout'));
    check(saved === true, 'provider.save with a name saves without prompting');
    await page.waitForTimeout(2500); // let the push land
    const listed = await page.evaluate(() => window.DATAVIEWER.layouts.list().map((l) => l.name));
    check(listed.includes('Cloud Smoke Layout'), `listed locally (${listed.join(', ')})`);
    await app.close();
  } else if (mode === 'layouts-list') {
    // M3: rows inserted on the server (as the website would) must appear after sign-in.
    await visible(page, '#screen-home');
    await page.waitForTimeout(3000); // pull + reloadViewerLayouts
    const listed = await page.evaluate(() => window.DATAVIEWER.layouts.list().map((l) => l.name));
    console.log('   listed:', listed.join(', '));
    check(listed.includes('From Web Smoke'), 'server-side layout row appears in the app');
    const removed = await page.evaluate(() => { const l = window.DATAVIEWER.layouts.list().find((x) => x.name === 'From Web Smoke'); if (!l) return false; window.DATAVIEWER.layouts.remove(l.id); return true; });
    check(removed, 'provider.remove on the cloud row');
    await page.waitForTimeout(2500);
    await app.close();
  } else {
    await visible(page, '#screen-gate');
    const text = await page.textContent('#gateText');
    check((text || '').includes(acct.email), `gate screen names the account (got "${text}")`);
    const state = await page.evaluate(() => window.bigdata.license.get());
    check(state.pro === false && state.reason === 'not_pro', `license state not_pro (${JSON.stringify(state)})`);
    await page.screenshot({ path: join(OUT, 'license-3-gate.png') });
    await app.close();
  }
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
