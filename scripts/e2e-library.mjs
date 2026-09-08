/*
 * e2e-library.mjs — exercises the desktop's shared-library provider against the REAL Supabase table
 * with the test account: list, publish, get, pull, a refused admin action, remove. Isolated user-data.
 *
 *   node scripts/e2e-library.mjs
 */
import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const acct = JSON.parse(readFileSync(join(homedir(), '.alldatalogs-keys', 'bigdata-test-account.json'), 'utf8'));
const UD = join(tmpdir(), 'bigdata-lib-e2e-' + Date.now().toString(36));
mkdirSync(UD, { recursive: true });
const env = { ...process.env, BIGDATA_USER_DATA: UD };
delete env.BIGDATA_DEV_PRO;

const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };

const app = await electron.launch({ executablePath: electronPath, args: ['.'], env });
const page = await app.firstWindow();
await page.waitForSelector('#screen-signin:not([hidden])', { timeout: 30000, state: 'visible' });
await page.fill('#signinEmail', acct.email);
await page.fill('#signinPassword', acct.password);
await page.click('#signinBtn');
await page.waitForSelector('#screen-home:not([hidden])', { timeout: 30000, state: 'visible' });

const r = await page.evaluate(async () => {
  const L = window.DATAVIEWER.library; const out = {};
  out.available = typeof Library !== 'undefined' && Library.available();
  out.me = await L.me();
  out.admin = await L.isAdmin();
  const before = await L.list({ kind: 'gauges' });
  out.beforeErr = before.error || null;
  const pub = await L.publish({
    kind: 'gauges', name: 'E2E dash', description: 'desktop e2e', vehicle: 'test',
    payload: { kind: 'gauges', gauges: [{ id: 'dash-1', type: 'round', x: 0, y: 0, scale: 1, label: 'RPM', channelOverride: 'Engine RPM', role: 'engine_rpm', roleFallback: true, min: 0, max: 8000 }] },
    thumb_svg: gaugesThumbnailSvg([{ type: 'round', x: 0, y: 0, scale: 1, label: 'RPM' }]),
  });
  out.publishOk = !!pub.ok; out.publishErr = pub.error || null;
  out.item = pub.item ? { official: pub.item.is_official, status: pub.item.status, author: pub.item.author_name } : null;
  if (!pub.ok) return out;
  const after = await L.list({ kind: 'gauges', q: 'E2E' });
  out.listed = after.items.map((i) => i.name + '|' + i.is_official + '|' + (i.thumb_svg ? i.thumb_svg.length : 0));
  const full = await L.get(pub.item.id);
  out.getGauges = full && full.payload && full.payload.gauges ? full.payload.gauges.length : null;
  await L.pull(pub.item.id);
  const pulled = await L.get(pub.item.id);
  out.pulls = pulled && pulled.pulls;
  const adminTry = await L.admin.setOfficial(pub.item.id, true);
  out.nonAdminRefused = !adminTry || adminTry.ok === false;
  out.nonAdminMsg = adminTry && adminTry.error;
  const stillNotOfficial = await L.get(pub.item.id);
  out.stillNotOfficial = stillNotOfficial && stillNotOfficial.is_official === false;
  const rm = await L.remove(pub.item.id);
  out.removed = !!rm.ok;
  out.gone = (await L.get(pub.item.id)) === null;
  return out;
});
console.log(JSON.stringify(r, null, 1));
check(r.available, 'engine sees the provider');
check(r.me && r.me.email === acct.email, 'me() is the signed-in test account');
check(r.admin === false, 'test account is not an admin');
check(!r.beforeErr, 'list works against the real table');
check(r.publishOk && r.item && r.item.official === false && r.item.status === 'published', 'publish lands as a published user share');
check(r.listed && r.listed.some((s) => s.startsWith('E2E dash|false|') && !s.endsWith('|0')), 'listed with its thumbnail');
check(r.getGauges === 1, 'get returns the payload');
check(r.pulls === 1, 'pull counter increments through the definer RPC');
check(r.nonAdminRefused && r.stillNotOfficial, 'a non-admin cannot mark items official');
check(r.removed && r.gone, 'owner can remove their own item');

await page.click('#btnSignOut');
await sleep(400);
await app.close();
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
