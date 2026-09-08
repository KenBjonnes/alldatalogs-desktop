/*
 * smoke-packaged.mjs — drives the PACKAGED app (dist/win-unpacked/BigData.exe, from `npm run dist`)
 * the way a customer would meet it: no dev override, a log on the command line (the file-association
 * launch path), real sign-in with the test account, updater wired. State goes to a throwaway folder.
 *
 *   npm run dist && node scripts/smoke-packaged.mjs [path\to\log.hpl]
 */
import { _electron as electron } from 'playwright';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const EXE = join(ROOT, 'dist', 'win-unpacked', 'BigData.exe');
if (!existsSync(EXE)) { console.error(`Not built: ${EXE} (run npm run dist)`); process.exit(2); }
const LOG = resolve(process.argv[2] || 'C:/Users/kenbj/Code/mile (1).hpl');
const OUT = join(here, '.smoke');
mkdirSync(OUT, { recursive: true });
const acct = JSON.parse(readFileSync(join(homedir(), '.alldatalogs-keys', 'bigdata-test-account.json'), 'utf8'));
const USER_DATA = join(tmpdir(), 'bigdata-smoke-packaged');
rmSync(USER_DATA, { recursive: true, force: true });

const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };
const visible = (page, sel, timeout = 30000) => page.waitForSelector(`${sel}:not([hidden])`, { timeout, state: 'visible' });

const env = { ...process.env, BIGDATA_USER_DATA: USER_DATA };
delete env.BIGDATA_DEV_PRO;
const app = await electron.launch({ executablePath: EXE, args: [LOG], env });
const page = await app.firstWindow();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await visible(page, '#screen-signin');
const info = await page.evaluate(() => ({ version: window.bigdata.app.version, dev: window.bigdata.app.dev, devPro: window.bigdata.app.devPro }));
check(info.dev === false && info.devPro === false, `packaged build: dev=${info.dev} devPro=${info.devPro} version=${info.version}`);
await page.fill('#signinEmail', acct.email);
await page.fill('#signinPassword', acct.password);
await page.click('#signinBtn');
await visible(page, '#screen-home');
check(true, 'sign-in reaches home in the packaged build');

// The log passed on the command line was queued while signed out and must open once allowed.
await page.waitForFunction(() => { const o = document.getElementById('viewerOverlay'); return !!o && o.classList.contains('open'); }, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const v = await page.evaluate(() => ({
  version: typeof VIEWER_VERSION !== 'undefined' ? VIEWER_VERSION : null,
  channels: typeof VIEWER_DATA !== 'undefined' && VIEWER_DATA ? VIEWER_DATA.channels.length : -1,
  pro: typeof viewerIsPro === 'function' ? viewerIsPro() : null,
  name: (document.querySelector('.dlv-header') || document.body).textContent.includes('mile'),
}));
check(v.channels > 5 && v.name, `command-line log opened from the packaged exe (${v.channels} channels)`);
check(v.version === info.version, `engine shows the packaged version (${v.version})`);
check(v.pro === true, 'engine reports Pro');
const upd = await page.evaluate(() => window.bigdata.updates.get());
check(upd && upd.state !== 'disabled', `updater active in packaged build (state=${upd && upd.state}${upd && upd.error ? ', ' + upd.error.slice(0, 80) : ''})`);
await page.screenshot({ path: join(OUT, 'packaged-1.png') });
check(errors.length === 0, `no console errors (${errors.length})`);
errors.forEach((e) => console.log('   console:', e.slice(0, 200)));
await page.evaluate(() => { if (typeof closeViewer === 'function') closeViewer(); });
await page.waitForTimeout(500);
await page.click('#btnSignOut');
await visible(page, '#screen-signin');
await app.close();

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
