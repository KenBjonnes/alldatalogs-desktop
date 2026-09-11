/*
 * glue.ts — the renderer-side host for the viewer engine inside BigData for Windows.
 *
 * It is a port of the parts of alldatalogs.com's OpenLog.tsx that a host must supply: the
 * worker-first / sync-fallback open path, the saved-layouts provider, the configure → ensureDom →
 * setViewerPro boot order, plus the three desktop screens (sign-in, Pro gate, home). Everything that
 * touches disk, network or licence state goes through window.bigdata (preload.js) and is decided in
 * the main process.
 *
 * The payload builder is imported from the site repo by path (see scripts/build-payload.mjs alias)
 * so the desktop app can never build a different VIEWER_DATA shape than the website does.
 */
import { buildViewerPayload } from '@site/viewerPayload';

type Dict = Record<string, unknown>;

interface LicenseState {
  pro: boolean | null;
  reason: string;
  status: string | null;
  daysLeft: number | null;
  email: string | null;
  storageUnavailable?: boolean;
}
interface Staged { token?: string; name: string; size?: number; path?: string; error?: string }
interface ReadResult { name: string; path: string; size: number; data: Uint8Array; error?: string }
interface RecentRow { path: string; name: string; size: number; format: string; openedAt: string }
interface HistoryRow { id: string; name: string; format: string; sizeBytes: number; lastOpenedAt: string; origin: 'manual' | 'auto' }
// What main answers a delete with: the user said no (canceled), it worked (ok), or it didn't (error).
interface Removed { ok?: boolean; canceled?: boolean; trashed?: boolean; error?: string }
// owner = the account (lower-case email) an entry is synced under; absent = saved while signed out.
// The local store is one list per machine: without this, two sign-ins on one PC would see and
// overwrite each other's rows, and a push of another account's row is refused by RLS -- the save
// looks fine locally and never reaches the cloud (Ken, 2026-09-09).
interface SavedLayout { id: string; name: string; state: Dict; updatedAt: number; owner?: string }

interface BigdataApi {
  app: { version: string; dev: boolean; devPro: boolean; platform: string };
  promptSync(message: string, defaultValue?: string): string | null;
  files: {
    openDialog(): Promise<Staged | null>;
    read(token: string): Promise<ReadResult>;
    recent(): Promise<RecentRow[]>;
    openPath(p: string): Promise<Staged>;
    note(p: string): Promise<boolean>;
    forget(p: string): Promise<Removed>;
    trash(p: string): Promise<Removed>;
    pathOf(file: File): string;
    onOpen(cb: (s: Staged) => void): () => void;
    ready(): void;
  };
  license: {
    get(): Promise<LicenseState>;
    refresh(): Promise<LicenseState>;
    online(): void;
    onChange(cb: (s: LicenseState) => void): () => void;
  };
  auth: {
    signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }>;
    signOut(): Promise<{ ok: boolean }>;
  };
  support: {
    reportFailedLog(r: { name: string; bytes: ArrayBuffer; error: string; format?: string; engine?: string }): Promise<'sent' | 'skipped' | 'failed'>;
  };
  history: {
    list(): Promise<HistoryRow[]>;
    open(id: string): Promise<{ name: string; format: string; size: number; data: Uint8Array } | { error: string }>;
    remove(id: string, name?: string): Promise<Removed>;
    getSync(): Promise<boolean>;
    setSync(on: boolean): Promise<boolean>;
    onChanged(cb: () => void): () => void;
  };
  layouts: {
    pull(): Promise<{ ok: boolean; rows?: SavedLayout[] }>;
    push(entry: SavedLayout): Promise<{ ok: boolean }>;
    remove(id: string): Promise<{ ok: boolean }>;
  };
  // The engine's shared-library provider contract (datalog-library.js), proxied to main over IPC.
  library: {
    list(q: Dict): Promise<{ items: Dict[]; hasMore: boolean; error?: string }>;
    get(id: string): Promise<Dict | null>;
    publish(input: Dict): Promise<{ ok: boolean; item?: Dict; error?: string }>;
    update(id: string, input: Dict): Promise<{ ok: boolean; item?: Dict; error?: string }>;
    remove(id: string): Promise<{ ok: boolean; error?: string }>;
    pull(id: string): Promise<void>;
    me(): Promise<{ userId: string; email: string | null } | null>;
    isAdmin(): Promise<boolean>;
    admin: {
      setOfficial(id: string, value: boolean): Promise<{ ok: boolean; error?: string }>;
      hide(id: string, value: boolean): Promise<{ ok: boolean; error?: string }>;
      remove(id: string): Promise<{ ok: boolean; error?: string }>;
    };
  };
  help: {
    open(topic?: string): Promise<{ ok: boolean }>;
  };
  updates: {
    check(): Promise<{ ok: boolean; reason?: string }>;
    restart(): Promise<{ ok: boolean }>;
    onStatus(cb: (s: Dict) => void): () => void;
  };
  shell: { openExternal(url: string): Promise<boolean> };
}

declare global {
  interface Window {
    bigdata: BigdataApi;
    DVCore: any;
    pako: any;
    configureViewer: (cfg: Dict) => Dict;
    ensureViewerDom: () => void;
    setViewerPro?: (pro: boolean) => void;
    setScorecardEnabledForEmail?: (email: string) => boolean;
    reloadViewerLayouts?: () => Promise<unknown>;
    openViewerFromPromise: (p: Promise<unknown>, opts: Dict) => void;
    showToast: (msg: string) => void;
    ADL_HOST?: Dict;
  }
}

const api = window.bigdata;
// Declare the host to the engine before it renders. pinHeader: the viewer's header bar stays open instead
// of collapsing to a hover strip -- there is no browser chrome here and the window is 920px+ tall
// (Ken, 2026-09-09: "get rid of the auto hide on that top menu ... there is plenty of room").
window.ADL_HOST = { kind: 'electron', platform: api.app.platform, pinHeader: true };
const MAX_POINTS = 12000;              // display set for the charts (same as the site)
const FULL_BUDGET_CELLS = 40_000_000;  // full-resolution set budget for Histograms (same as the site)
const MAX_FILE_BYTES = 250 * 1048576;  // Pro cap (main enforces the same on staged files)

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

let license: LicenseState = { pro: null, reason: 'signed_out', status: null, daysLeft: null, email: null };

// ---- Saved layouts: local-first provider (port of apps/web/lib/layouts.ts) -------------------------
const LS_KEY = 'alldatalogs.viewerLayouts.v1';

function readLocal(): SavedLayout[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => x && x.id && x.name) : [];
  } catch { return []; }
}
function writeLocal(list: SavedLayout[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 200))); } catch { /* full / unavailable */ }
}
function genId(): string {
  return 'ly_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
function ownerKey(): string | null { const e = (license.email || '').trim().toLowerCase(); return e || null; }
/** Entries the signed-in account may see: its own synced rows plus the machine's signed-out (unowned) ones. */
function visibleLayouts(list: SavedLayout[]): SavedLayout[] { const o = ownerKey(); return list.filter((l) => !l.owner || l.owner === o); }
function listLayouts(): SavedLayout[] { return visibleLayouts(readLocal()).sort((a, b) => b.updatedAt - a.updatedAt); }
function saveLayout(name: string, state: Dict): SavedLayout {
  const list = readLocal();
  const now = Date.now();
  const owner = ownerKey();
  // dedup by name only among what this account can see; a signed-out entry re-saved while signed in is adopted
  const existing = visibleLayouts(list).find((l) => l.name.toLowerCase() === name.toLowerCase());
  let entry: SavedLayout;
  if (existing) { existing.state = state; existing.updatedAt = now; if (owner) existing.owner = owner; entry = existing; }
  else { entry = owner ? { id: genId(), name, state, updatedAt: now, owner } : { id: genId(), name, state, updatedAt: now }; list.push(entry); }
  writeLocal(list);
  return entry;
}
function removeLayout(id: string) { writeLocal(readLocal().filter((l) => l.id !== id)); }

const layoutProvider = {
  list() {
    return listLayouts().map((l) => {
      const kind = (l.state as { kind?: unknown } | null)?.kind;
      return { id: l.id, name: l.name, kind: typeof kind === 'string' ? kind : undefined };
    });
  },
  save(state: Dict, name?: string): boolean {
    const chosen = name != null && name !== '' ? name : (window.prompt('Name this layout:', '') || '');
    const trimmed = chosen.trim();
    if (!trimmed) return false;
    const entry = saveLayout(trimmed, state);
    if (license.pro === true) api.layouts.push(entry).catch(() => {});
    return true;
  },
  apply(id: string): Dict | undefined { return readLocal().find((l) => l.id === id)?.state; },
  remove(id: string): void {
    removeLayout(id);
    if (license.pro === true) api.layouts.remove(id).catch(() => {});
  },
  // On-demand cloud pull -- the viewer calls it whenever the layout picker opens, so a layout saved on
  // another machine shows up without restarting the app. Throttled; resolves true when rows arrived.
  refresh(): Promise<boolean> {
    if (license.pro !== true || !license.email) return Promise.resolve(false);
    const now = Date.now();
    if (now - lastPullAt < PULL_THROTTLE_MS) return Promise.resolve(false);
    lastPullAt = now;
    return api.layouts.pull().then((r) => {
      if (r && r.ok && Array.isArray(r.rows) && r.rows.length) { mergeCloudRows(r.rows); return true; }
      return false;
    }).catch(() => false);
  },
  // Whose cloud the lists show (the viewer prints it in the picker).
  account(): { email: string; synced: boolean } | null {
    return license.email ? { email: license.email, synced: license.pro === true } : null;
  },
};
let lastPullAt = 0;
const PULL_THROTTLE_MS = 8000;

// Merge cloud rows into local storage, cloud wins on id (same rule as the website); every pulled row
// is stamped with the account it belongs to.
function mergeCloudRows(rows: SavedLayout[]) {
  const owner = ownerKey();
  const byId = new Map(readLocal().map((l) => [l.id, l]));
  for (const r of rows) if (r && r.id && r.name) byId.set(r.id, owner ? { ...r, owner } : r);
  writeLocal([...byId.values()]);
}

// ---- Open path (port of OpenLog.tsx) --------------------------------------------------------------
interface Job { id: number; name: string; fmt: string; source: string; file: File }

let worker: Worker | null = null;
let workerBroken = false;
let jobSeq = 0;
let pending: Job | null = null;
let cancelled = false;

function fmtOf(name: string): string {
  const l = name.toLowerCase();
  return l.endsWith('.hpl') ? 'HPL' : l.endsWith('.ld') ? 'MoTeC' : l.endsWith('.dl') ? 'Holley' : 'CSV';
}

function openParsed(parsed: any, filename: string, source: string): boolean {
  if (!parsed || !Array.isArray(parsed.channelNames) || !parsed.channelNames.length) {
    showError('No numeric channels found in this file.');
    return false;
  }
  const data = buildViewerPayload(parsed, {
    maxPoints: MAX_POINTS,
    budgetCells: FULL_BUDGET_CELLS,
    bucketDecimate: window.DVCore.bucketDecimate,
  });
  window.openViewerFromPromise(Promise.resolve({ ok: true, data }), { fileName: filename, source });
  return true;
}

function decodeSync(fmt: string, buf: ArrayBuffer): any {
  const bytes = new Uint8Array(buf);
  const D = window.DVCore;
  let csv: string;
  if (fmt === 'HPL') csv = D.convertHplToCsv(bytes, (d: Uint8Array) => window.pako.inflateRaw(d), { interpolate: true, usUnits: true });
  else if (fmt === 'MoTeC') csv = D.convertLdToCsv(bytes);
  else if (fmt === 'Holley') csv = D.convertHolleyDlToCsv(bytes);
  else csv = new TextDecoder().decode(bytes);
  return D.parseDatalogCsv(csv);
}

async function runSyncJob(job: Job) {
  await new Promise((r) => setTimeout(r, 30)); // let the loader paint before the blocking decode
  if (cancelled || job.id !== jobSeq) { hideLoader(); return; }
  let ab: ArrayBuffer;
  try { ab = await job.file.arrayBuffer(); } catch { showError('Could not read that file.'); hideLoader(); return; }
  if (cancelled || job.id !== jobSeq) { hideLoader(); return; }
  try { openParsed(decodeSync(job.fmt, ab), job.name, job.source); }
  catch (e) { const msg = errMsg(e, 'Could not open this file.'); showError(msg); void reportOpenFailure(job, ab, msg); }
  hideLoader();
}

function onWorkerMessage(data: any) {
  if (!data || cancelled || data.jobId !== jobSeq) return;
  const p = pending;
  pending = null;
  if (data.ok) openParsed(data.parsed, p ? p.name : data.name, p ? p.source : 'local');
  else { const msg = data.error || 'Could not open this file.'; showError(msg); if (p) void reportOpenFailure(p, null, msg); }
  hideLoader();
}

// A log that would not open: PBD reporters (Ken, anyone @pbdyno.com) send the bytes + error to the
// failed-logs queue for troubleshooting (main does the network work with the signed-in session);
// everyone else just sees the error. Best effort, never blocks (Ken, 2026-09-09).
async function reportOpenFailure(job: Job, bytes: ArrayBuffer | null, msg: string) {
  try {
    if (job.source !== 'local' || !api.support) return;
    const ab = bytes || await job.file.arrayBuffer();
    const engine = (window.DVCore && (window.DVCore as { HPL_CONVERTER_VERSION?: string }).HPL_CONVERTER_VERSION) || '';
    const r = await api.support.reportFailedLog({ name: job.name, bytes: ab, error: msg, format: job.fmt, engine });
    if (r === 'sent') window.showToast('Sent to PBD for troubleshooting.');
  } catch { /* never in the way of the error the user sees */ }
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    const w = new Worker('/parse-worker.js');
    w.onmessage = (ev) => onWorkerMessage(ev.data);
    w.onerror = () => {
      workerBroken = true;
      try { w.terminate(); } catch { /* ignore */ }
      worker = null;
      const p = pending;
      pending = null;
      if (p && p.id === jobSeq && !cancelled) void runSyncJob(p);
    };
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

function startJob(name: string, fmt: string, source: string, file: File) {
  cancelled = false;
  const id = ++jobSeq;
  const job: Job = { id, name, fmt, source, file };
  clearError();
  showLoader(name);
  const w = getWorker();
  if (!w) { void runSyncJob(job); return; }
  pending = job;
  try {
    w.postMessage({ jobId: id, name, fmt, file });
  } catch {
    workerBroken = true;
    try { w.terminate(); } catch { /* ignore */ }
    worker = null;
    pending = null;
    void runSyncJob(job);
  }
}

function cancelLoad() {
  cancelled = true;
  jobSeq++;
  pending = null;
  if (worker) { try { worker.terminate(); } catch { /* ignore */ } worker = null; }
  hideLoader();
}

function handleFile(file: File, source = 'local') {
  if (!file) return;
  const name = file.name || 'log';
  if ((file.size || 0) > MAX_FILE_BYTES) {
    showError(`This file is ${(file.size / 1048576).toFixed(1)} MB, above the 250 MB limit.`);
    return;
  }
  startJob(name, fmtOf(name), source, file);
}

async function openStaged(s: Staged | null) {
  if (!s) return;
  if (s.error) { showError(`${s.name}: ${s.error}`); return; }
  if (!s.token) return;
  let r: ReadResult;
  try { r = await api.files.read(s.token); } catch (e) { showError(errMsg(e, 'Could not read the file.')); return; }
  if (!r || r.error) { showError(r && r.error ? r.error : 'Could not read the file.'); return; }
  handleFile(new File([r.data], r.name), 'local');
  void refreshRecents();
}

async function openSample() {
  try {
    const res = await fetch('/sample/mile.hpl');
    if (!res.ok) throw new Error('Sample log missing from this build.');
    handleFile(new File([await res.blob()], 'mile.hpl'), 'sample');
  } catch (e) {
    showError(errMsg(e, 'Could not open the sample log.'));
  }
}

// ---- Screens ---------------------------------------------------------------------------------------
function showScreen(name: 'signin' | 'gate' | 'home') {
  for (const s of ['signin', 'gate', 'home']) $(`screen-${s}`).hidden = s !== name;
}
function showLoader(name: string) { $('loaderName').textContent = name; $('loader').hidden = false; }
function hideLoader() { $('loader').hidden = true; }
function showError(msg: string) {
  const el = $('homeError');
  el.textContent = msg;
  el.hidden = false;
  window.showToast(msg);
}
function clearError() { const el = $('homeError'); el.textContent = ''; el.hidden = true; }

function fmtBytes(n: number) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : d.toLocaleDateString();
}

// The History list (Ken, 2026-09-09: "when I get home, I want to see exactly the same things including my
// history on the right"): the ACCOUNT's opened logs first (newest opened, from any device, re-opened by
// download), then whatever is only on this PC. Same rule as the website and the phone apps.
// One row: name + meta on the left, delete buttons on the right (Ken, 2026-09-10: "add a delete button
// next to files in the desktop app so they are easy to delete"). The buttons live in their own column
// and stop the click, so pressing one never opens the log.
function recentRow(cls: string, title: string, name: string, meta: string, open: () => void) {
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.title = title;
  const text = document.createElement('div'); text.className = 'rtext';
  const nm = document.createElement('div'); nm.className = 'rname'; nm.textContent = name;
  const mt = document.createElement('div'); mt.className = 'rmeta'; mt.textContent = meta;
  text.append(nm, mt);
  const acts = document.createElement('div'); acts.className = 'ractions';
  li.append(text, acts);
  li.addEventListener('click', open);
  return { li, acts };
}
function rowButton(acts: HTMLElement, glyph: string, label: string, kind: string, run: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'rbtn ' + kind;
  b.textContent = glyph;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', (e) => { e.stopPropagation(); run(); });
  acts.appendChild(b);
  return b;
}
// Main asks for confirmation and does the deleting; here we only report what came back and repaint.
// A refresh runs even after a failure, so a row that is already gone stops being listed.
async function runDelete(what: Promise<Removed>, fallback: string) {
  let r: Removed;
  try { r = await what; } catch (e) { r = { error: errMsg(e, fallback) }; }
  if (r && r.canceled) return;
  if (!r || (!r.ok && r.error)) showError((r && r.error) || fallback);
  void refreshRecents();
}
async function refreshRecents() {
  let rows: RecentRow[] = [];
  try { rows = await api.files.recent(); } catch { rows = []; }
  let cloud: HistoryRow[] = [];
  try { cloud = (await api.history.list()) || []; } catch { cloud = []; }
  const seen = new Set(cloud.map((c) => (c.name || '').toLowerCase() + '|' + (c.sizeBytes || 0)));
  const local = rows.filter((r) => !seen.has((r.name || '').toLowerCase() + '|' + (r.size || 0)));
  const ul = $('recentList');
  ul.textContent = '';
  $('recentEmpty').hidden = cloud.length + local.length > 0;
  for (const c of cloud) {
    const meta = [c.format, fmtBytes(c.sizeBytes || 0), 'account', fmtWhen(c.lastOpenedAt)].filter(Boolean).join(' · ');
    const title = c.origin === 'manual' ? 'In your account (saved by you)' : 'In your account — opens on any device';
    const { li, acts } = recentRow('cloud', title, c.name, meta, async () => {
      showLoader(c.name);
      let r: { name: string; format: string; size: number; data: Uint8Array } | { error: string };
      try { r = await api.history.open(c.id); } catch (e) { hideLoader(); showError(errMsg(e, 'Could not open that log from your account.')); return; }
      if (!r || 'error' in r) { hideLoader(); showError((r && 'error' in r && r.error) || 'Could not open that log from your account.'); return; }
      handleFile(new File([r.data], r.name), 'cloud');
    });
    // An account row IS the stored copy, so there is nothing to "remove from the list" separately.
    rowButton(acts, '🗑', `Delete "${c.name}" from your account`, 'rdel', () => {
      void runDelete(api.history.remove(c.id, c.name), 'Could not delete that log from your account.');
    });
    ul.appendChild(li);
  }
  for (const r of local) {
    const meta = [r.format, fmtBytes(r.size || 0), 'this PC', fmtWhen(r.openedAt)].filter(Boolean).join(' · ');
    const { li, acts } = recentRow('', r.path, r.name, meta, async () => { openStaged(await api.files.openPath(r.path)); });
    rowButton(acts, '🗑', `Delete "${r.name}" — moves the file to the Recycle Bin`, 'rdel', () => {
      void runDelete(api.files.trash(r.path), 'Could not delete that file.');
    });
    // Harmless and instant: the file stays put and the row returns next time the log is opened.
    rowButton(acts, '✕', `Remove "${r.name}" from History — the file stays on this PC`, 'rforget', () => {
      void runDelete(api.files.forget(r.path), 'Could not remove that log from History.');
    });
    ul.appendChild(li);
  }
}
async function wireHistorySync() {
  const cb = document.getElementById('historySync') as HTMLInputElement | null;
  if (!cb) return;
  try { cb.checked = await api.history.getSync(); } catch { cb.checked = true; }
  cb.addEventListener('change', () => { void api.history.setSync(cb.checked); });
  api.history.onChanged(() => { void refreshRecents(); });
}

const BANNERS: Record<string, { text: (s: LicenseState) => string; bad?: boolean }> = {
  dev: { text: () => 'Developer build: Pro forced on by BIGDATA_DEV_PRO.' },
  ok_offline: { text: (s) => `Offline. Pro stays active for ${s.daysLeft ?? '?'} more days without a connection.` },
  expiring_soon: { text: (s) => `Couldn't verify your Pro membership. ${s.daysLeft ?? '?'} day(s) left. Connect to the internet to keep Pro active.` },
  session_lost: { text: () => 'You were signed out on this PC. Sign in again to keep Pro verified.' },
  limited: { text: () => 'Your Pro membership could not be verified for over 30 days. Pro features are locked until you reconnect.', bad: true },
  clock_tamper: { text: () => 'This PC\'s clock moved backwards. Check the date and time, then reconnect to verify Pro.', bad: true },
  app_outdated: { text: () => 'This version of BigData is too old to verify your membership. Please update.', bad: true },
  storage_unavailable: { text: () => 'Windows could not protect your sign-in on this PC, so you will be asked to sign in each time.' },
};

// Pull cloud layouts once per signed-in Pro account (at boot for a persisted session, or right after
// sign-in), then let the engine re-list. Mirrors OpenLog.tsx: pullCloudLayouts → reloadViewerLayouts.
let pulledFor: string | null = null;
function maybePullLayouts(s: LicenseState) {
  if (s.pro !== true || !s.email || pulledFor === s.email) return;
  pulledFor = s.email;
  lastPullAt = Date.now();
  api.layouts.pull().then((r) => {
    if (r && r.ok && Array.isArray(r.rows) && r.rows.length) mergeCloudRows(r.rows);
    return window.reloadViewerLayouts?.();   // re-list either way: the visible set is per account
  }).catch(() => {});
}

function applyLicense(s: LicenseState) {
  const switched = license.email !== s.email;
  license = s;
  window.setViewerPro?.(s.pro === true);
  // Scorecard is a PBD-internal dash gauge, hidden by default; the viewer unlocks it for staff sign-ins
  // (the same rule the website applies). Only ever turns it on.
  window.setScorecardEnabledForEmail?.(s.email ?? '');
  maybePullLayouts(s);
  if (switched) void refreshRecents(); // recents are per account (main keys them by the session's user)
  $('checking').hidden = s.reason !== 'checking';
  if (s.reason === 'checking') {
    // Keep whatever screen is up (sign-in on first run, home on a relaunch) under the overlay.
    if (['screen-signin', 'screen-gate', 'screen-home'].every((id) => $(id).hidden)) showScreen('signin');
  } else if (s.reason === 'not_pro' || s.reason === 'wrong_account') {
    $('gateText').textContent = s.email
      ? `${s.email} does not have an active AllDataLogs Pro membership.`
      : 'This account does not have an active AllDataLogs Pro membership.';
    showScreen('gate');
  } else if (s.pro !== true && (s.reason === 'signed_out' || s.reason === 'activate_offline')) {
    $('signinIntro').textContent = s.reason === 'activate_offline'
      ? 'BigData needs to reach alldatalogs.com once to activate on this PC. Connect to the internet and sign in.'
      : 'BigData for Windows is part of AllDataLogs Pro. Sign in with your alldatalogs.com account.';
    showScreen('signin');
  } else {
    showScreen('home');
  }
  const b = BANNERS[s.reason] || (s.storageUnavailable ? BANNERS.storage_unavailable : undefined);
  const banner = $('banner');
  if (b) { banner.textContent = b.text(s); banner.classList.toggle('bad', !!b.bad); banner.hidden = false; }
  else banner.hidden = true;
  $('footAccount').textContent = s.email || '';
  const pro = $('footPro');
  pro.className = s.pro === true ? 'pro' : s.pro === null ? 'warn' : '';
  pro.textContent = s.pro === true ? (s.reason === 'ok' ? 'Pro' : 'Pro · ' + s.reason.replace(/_/g, ' ')) : s.pro === false ? 'Not Pro' : s.reason.replace(/_/g, ' ');
}

function wireExternalButtons() {
  document.querySelectorAll<HTMLElement>('[data-ext]').forEach((el) => {
    el.addEventListener('click', () => { void api.shell.openExternal(el.dataset.ext || ''); });
  });
}

function wireHome() {
  const dz = $('dropzone');
  document.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; dz.classList.add('over'); });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dz.classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const p = api.files.pathOf(f);
    if (p) api.files.note(p).then(() => refreshRecents()).catch(() => {});
    handleFile(f, 'local');
  });
  $('btnOpen').addEventListener('click', async () => { openStaged(await api.files.openDialog()); });
  $('btnSample').addEventListener('click', () => { void openSample(); });
  $('btnCancelLoad').addEventListener('click', cancelLoad);
  $('btnHelp').addEventListener('click', () => { void api.help.open(); });
  $('btnUpdates').addEventListener('click', async () => {
    const r = await api.updates.check();
    if (!r.ok) window.showToast('Automatic updates are not enabled in this build yet.');
  });
  const signOut = async () => { await api.auth.signOut(); applyLicense(await api.license.get()); };
  $('btnSignOut').addEventListener('click', signOut);
  $('gateSignOut').addEventListener('click', signOut);
  $('gateRetry').addEventListener('click', async () => { applyLicense(await api.license.refresh()); });
  $('footVersion').textContent = 'v' + api.app.version;
}

function wireSignIn() {
  const form = $<HTMLFormElement>('signinForm');
  const err = $('signinError');
  const btn = $<HTMLButtonElement>('signinBtn');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    btn.disabled = true;
    try {
      const r = await api.auth.signIn($<HTMLInputElement>('signinEmail').value.trim(), $<HTMLInputElement>('signinPassword').value);
      if (!r.ok) { err.textContent = r.error || 'Sign-in failed.'; err.hidden = false; }
      else { $<HTMLInputElement>('signinPassword').value = ''; applyLicense(await api.license.get()); }
    } catch (ex) {
      err.textContent = errMsg(ex, 'Sign-in failed.');
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

// ---- The real BigData logo -------------------------------------------------------------------------
// Ken, 2026-09-11: "We need to use the real BigData logo on the windows app". The sign-in, Pro-required
// and home screens showed a typed "BIG DATA". The engine already carries the real wordmark as
// BRAND_LOGO_SVG (C:/websites/logos/bigdata.svg, its dark ink switched to currentColor so it reads on
// this dark UI while the red stays red) and loads before this script, so the screens take that exact
// art: one copy of the logo, not two. Without the engine the typed wordmark in the markup stays.
function applyBrandLogo(): void {
  const svg = (window as unknown as { BRAND_LOGO_SVG?: string }).BRAND_LOGO_SVG;
  if (!svg) return;
  document.querySelectorAll<HTMLElement>('.brand-mark').forEach((el) => {
    el.innerHTML = svg;
    el.classList.add('brand-logo');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'BigData');
    el.parentElement?.classList.add('brand-has-logo');
  });
}

// ---- Boot -------------------------------------------------------------------------------------------
async function boot() {
  applyBrandLogo();   // before any screen is shown
  // Order matters (runtime.js rebuilds window.DATAVIEWER; the engine caches Pro separately):
  // configure → inject the overlay DOM → then tell the engine about Pro, and again on every change.
  window.configureViewer({
    brand: { mark: 'B', name: 'BigData', sub: 'DATALOG VIEWER' },
    layouts: layoutProvider,
    library: api.library,
  });
  window.ensureViewerDom();

  wireExternalButtons();
  wireHome();
  wireSignIn();

  applyLicense(await api.license.get());
  api.license.onChange(applyLicense);
  window.addEventListener('online', () => api.license.online());

  void refreshRecents();
  void wireHistorySync();
  api.files.onOpen((s) => { void openStaged(s); });
  api.files.ready();
}

boot().catch((e) => {
  console.error(e);
  showError('BigData failed to start: ' + errMsg(e, String(e)));
});
