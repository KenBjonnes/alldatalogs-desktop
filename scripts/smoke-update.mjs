/*
 * smoke-update.mjs — drives an INSTALLED copy of BigData (per-user install from the Setup exe) and
 * watches the auto-updater: after a newer release is published, the running app must download it and
 * report 'ready'; on restart it must be the new version.
 *
 *   node scripts/smoke-update.mjs                # expects the installed app to find an update
 *   node scripts/smoke-update.mjs --expect-current   # expects "already latest"
 *
 * State goes to a throwaway folder (BIGDATA_USER_DATA) so Ken's own install state is untouched.
 */
import { _electron as electron } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const EXE = join(process.env.LOCALAPPDATA || '', 'Programs', 'BigData', 'BigData.exe');
if (!existsSync(EXE)) { console.error(`Not installed: ${EXE}`); process.exit(2); }
const expectCurrent = process.argv.includes('--expect-current');
const acct = JSON.parse(readFileSync(join(homedir(), '.alldatalogs-keys', 'bigdata-test-account.json'), 'utf8'));
const USER_DATA = join(tmpdir(), 'bigdata-smoke-update');
mkdirSync(USER_DATA, { recursive: true });

const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };
const visible = (page, sel, timeout = 30000) => page.waitForSelector(`${sel}:not([hidden])`, { timeout, state: 'visible' });

const env = { ...process.env, BIGDATA_USER_DATA: USER_DATA };
delete env.BIGDATA_DEV_PRO;
const app = await electron.launch({ executablePath: EXE, args: [], env });
const page = await app.firstWindow();

const version = await page.evaluate(() => window.bigdata.app.version);
console.log(`installed app version: ${version}`);
// Wait for the renderer to settle on a screen (sign-in on a fresh folder, home when a session persisted).
await page.waitForSelector('#screen-signin:not([hidden]), #screen-home:not([hidden])', { timeout: 30000, state: 'visible' });
if (await page.$('#screen-signin:not([hidden])')) {
  await page.fill('#signinEmail', acct.email);
  await page.fill('#signinPassword', acct.password);
  await page.click('#signinBtn');
}
await visible(page, '#screen-home');

let last = null;
const deadline = Date.now() + 4 * 60_000;
while (Date.now() < deadline) {
  last = await page.evaluate(() => window.bigdata.updates.get());
  if (last.state === 'ready' || last.state === 'current' || last.state === 'error') break;
  await page.waitForTimeout(3000);
}
console.log('updater:', JSON.stringify(last));
if (expectCurrent) check(last && last.state === 'current', 'installed app reports it is current');
else check(last && last.state === 'ready' && last.version && last.version !== version, `update downloaded and ready (${last && last.version})`);
const foot = await page.textContent('#banner').catch(() => '');
console.log('banner:', (foot || '').trim());
await app.close();

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
