'use strict';
/*
 * files.js — every way a log file reaches the renderer, funnelled through one staging table.
 *
 * Sources: command-line / file-association launch (first instance argv, later instances via
 * 'second-instance'), the File menu, the renderer's Open button, and the recents list. Each one
 * validates the path (extension, exists, size cap), stages it under a one-time token, and the renderer
 * then calls files:read with that token to receive the bytes. The renderer never names a path itself,
 * and the read is where the licence gate is enforced (defence in depth: setViewerPro is a client flag).
 *
 * Files that arrive before the renderer has booted are queued until it reports 'renderer:ready'.
 */
const { app, ipcMain, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ACCEPT = new Set(['.hpl', '.csv', '.ld', '.dl']);
const MAX_BYTES = 250 * 1024 * 1024;
const RECENT_MAX = 20;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const FILTERS = [
  { name: 'Datalogs', extensions: ['hpl', 'csv', 'ld', 'dl'] },
  { name: 'HP Tuners (*.hpl)', extensions: ['hpl'] },
  { name: 'CSV (*.csv)', extensions: ['csv'] },
  { name: 'MoTeC (*.ld)', extensions: ['ld'] },
  { name: 'Holley (*.dl)', extensions: ['dl'] },
  { name: 'All files', extensions: ['*'] },
];

let getWindow = () => null;
let gate = () => null; // returns an error string when files may not be opened right now
const staged = new Map(); // token -> { path, name, size, at }
const queue = [];
let rendererReady = false;

function fmtOf(name) {
  const e = path.extname(name).toLowerCase();
  return e === '.hpl' ? 'HPL' : e === '.ld' ? 'MoTeC' : e === '.dl' ? 'Holley' : 'CSV';
}

// --- recents (per signed-in account) -------------------------------------------------------------
// recent.json v2: { v: 2, byUser: { <account id | 'anon'>: [rows] } }. The list is scoped to the
// AllDataLogs account that opened the files, not to the Windows profile: with two accounts signing
// in on one PC the old flat list showed everyone everything (Ken, 2026-09-08). A v1 flat list is
// kept under 'anon' (its owner is unknowable), which in practice starts everyone fresh.
function recentPath() { return path.join(app.getPath('userData'), 'recent.json'); }
function whoKey() {
  try { return require('./license').currentUserId() || 'anon'; } catch { return 'anon'; }
}
function readRecentAll() {
  try {
    const o = JSON.parse(fs.readFileSync(recentPath(), 'utf8'));
    if (Array.isArray(o)) return { v: 2, byUser: { anon: o } };
    if (o && typeof o === 'object' && o.byUser && typeof o.byUser === 'object') return o;
  } catch { /* none yet */ }
  return { v: 2, byUser: {} };
}
function readRecent(who) {
  const list = readRecentAll().byUser[who || whoKey()];
  return Array.isArray(list) ? list : [];
}
function writeRecent(list, who) {
  const all = readRecentAll();
  all.byUser[who || whoKey()] = list;
  try { fs.mkdirSync(path.dirname(recentPath()), { recursive: true }); fs.writeFileSync(recentPath(), JSON.stringify(all, null, 2)); } catch { /* best effort */ }
}
function addRecent(f) {
  const who = whoKey();
  const list = readRecent(who).filter((r) => r && typeof r.path === 'string' && r.path.toLowerCase() !== f.path.toLowerCase());
  list.unshift({ path: f.path, name: f.name, size: f.size, format: fmtOf(f.name), openedAt: new Date().toISOString() });
  writeRecent(list.slice(0, RECENT_MAX), who);
}
function listRecent() {
  return readRecent().filter((r) => { try { return fs.statSync(r.path).isFile(); } catch { return false; } });
}

// --- staging -------------------------------------------------------------------------------------
function validate(p) {
  const ext = path.extname(p).toLowerCase();
  if (!ACCEPT.has(ext)) return { error: `BigData opens .hpl, .csv, .ld and .dl logs (this is ${ext ? '"' + ext + '"' : 'a file with no extension'}).` };
  let st;
  try { st = fs.statSync(p); } catch { return { error: 'That file could not be found.' }; }
  if (!st.isFile()) return { error: 'That is not a file.' };
  if (st.size > MAX_BYTES) return { error: `This file is ${(st.size / 1048576).toFixed(1)} MB, above the 250 MB limit.` };
  return { size: st.size };
}
function stage(p) {
  const v = validate(p);
  const name = path.basename(p);
  if (v.error) return { error: v.error, name };
  const now = Date.now();
  for (const [k, s] of staged) if (now - s.at > TOKEN_TTL_MS) staged.delete(k);
  const token = crypto.randomUUID();
  staged.set(token, { path: p, name, size: v.size, at: now });
  return { token, name, size: v.size, path: p };
}

// --- delivery to the renderer ---------------------------------------------------------------------
// A file stays queued until the renderer is up AND the licence allows opening (a double-clicked log
// that launched the app while signed out opens right after sign-in instead of being dropped).
function canDeliver() {
  const w = getWindow();
  return rendererReady && w && !w.isDestroyed() && !gate();
}
function deliver(s) {
  queue.push(s);
  flush();
}
function flush() {
  if (!canDeliver()) return;
  const w = getWindow();
  while (queue.length && canDeliver()) w.webContents.send('files:open', queue.shift());
}
function pushPath(p) {
  const s = stage(p);
  if (s.error) { dialog.showErrorBox('BigData cannot open this file', `${s.name}\n\n${s.error}`); return; }
  deliver(s);
}
function argvPaths(argv, cwd) {
  const out = [];
  for (const a of (argv || []).slice(app.isPackaged ? 1 : 2)) {
    if (!a || a.startsWith('-')) continue;
    const p = path.resolve(cwd || process.cwd(), a);
    if (ACCEPT.has(path.extname(p).toLowerCase())) out.push(p);
  }
  return out;
}
function queueArgv(argv, cwd) { for (const p of argvPaths(argv, cwd)) pushPath(p); }
function rendererReset() { rendererReady = false; }

async function openViaMenu() {
  const w = getWindow();
  const r = await dialog.showOpenDialog(w || undefined, { properties: ['openFile'], filters: FILTERS });
  if (!r.canceled && r.filePaths[0]) pushPath(r.filePaths[0]);
}

function install(opts) {
  getWindow = opts.getWindow;
  if (opts.gate) gate = opts.gate;

  ipcMain.on('renderer:ready', () => { rendererReady = true; flush(); });

  ipcMain.handle('files:openDialog', async () => {
    const r = await dialog.showOpenDialog(getWindow() || undefined, { properties: ['openFile'], filters: FILTERS });
    if (r.canceled || !r.filePaths[0]) return null;
    return stage(r.filePaths[0]);
  });

  ipcMain.handle('files:read', async (_e, token) => {
    const f = staged.get(token);
    if (!f) return { error: 'This file request has expired. Please open the file again.' };
    staged.delete(token);
    const blocked = gate();
    if (blocked) return { error: blocked };
    try {
      const data = await fs.promises.readFile(f.path);
      addRecent(f);
      return { name: f.name, path: f.path, size: f.size, data };
    } catch (e) {
      return { error: `Could not read ${f.name}: ${e && e.message ? e.message : e}` };
    }
  });

  ipcMain.handle('files:recent', () => listRecent());

  // A file dropped onto the window arrives as bytes via the renderer; main only learns its path so
  // it can appear in the recents list. Same validation as every other path.
  ipcMain.handle('files:note', (_e, p) => {
    if (typeof p !== 'string' || !p) return false;
    const v = validate(p);
    if (v.error) return false;
    addRecent({ path: p, name: path.basename(p), size: v.size });
    return true;
  });

  // Only paths the app itself recorded may be re-opened by name.
  ipcMain.handle('files:openPath', (_e, p) => {
    const known = readRecent().some((r) => r && r.path === p);
    if (!known) return { error: 'That file is not in the recent list.' };
    return stage(p);
  });
}

module.exports = { install, queueArgv, rendererReset, openViaMenu, flush, MAX_BYTES, ACCEPT };
