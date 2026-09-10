'use strict';
/*
 * history.js -- account history in BigData for Windows (Ken, 2026-09-09: "when I get home, I want to
 * see exactly the same things including my history on the right"). Every log a Pro user opens here is
 * saved to the account (main reads the file it already has the path of, hashes it, and hands it to
 * history-core.js with the signed-in supabase client); the home screen's History list is the account's
 * list plus whatever is only on this PC; clicking an account entry downloads it and opens it.
 *
 * The "Save opened logs to my account" switch lives in userData/history.json (default on). Everything
 * is best effort and silent: an upload that fails never gets in the way of the log that just opened.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, ipcMain, dialog } = require('electron');
const core = require('./history-core');

let deps = null;          // { supabase, license, getWindow }
const inflight = new Set();

function settingsPath() { return path.join(app.getPath('userData'), 'history.json'); }
function readSettings() {
  try { const o = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function syncEnabled() { return readSettings().sync !== false; }
function setSync(on) {
  try { fs.mkdirSync(path.dirname(settingsPath()), { recursive: true }); fs.writeFileSync(settingsPath(), JSON.stringify(Object.assign(readSettings(), { sync: !!on }))); } catch { /* best effort */ }
  return syncEnabled();
}
function fmtOf(name) {
  const l = String(name || '').toLowerCase();
  return l.endsWith('.hpl') ? 'HPL' : l.endsWith('.ld') ? 'MoTeC' : l.endsWith('.dl') ? 'Holley' : (l.endsWith('.msl') || l.endsWith('.mlg')) ? 'MegaSquirt' : 'CSV';
}
function proNow() {
  try { const st = deps.license.getState(); return !!(st && st.pro === true); } catch { return false; }
}
/** The supabase client, only while a session exists (RLS needs it). */
async function client() {
  if (!deps || typeof deps.supabase.getClient !== 'function') return null;
  const sb = deps.supabase.getClient();
  if (!sb) return null;
  const s = await deps.supabase.getSession();
  return s ? sb : null;
}
function notify() {
  try { const w = deps && deps.getWindow ? deps.getWindow() : null; if (w && !w.isDestroyed()) w.webContents.send('history:changed'); } catch { /* ignore */ }
}

/** Fire-and-forget after a local file opened (files.js calls this next to addRecent). */
function noteOpened(f) {
  if (!deps || !f || !f.path || !proNow() || !syncEnabled()) return;
  if (inflight.has(f.path)) return;
  inflight.add(f.path);
  autoSave(f).catch(() => null).finally(() => inflight.delete(f.path));
}
async function autoSave(f) {
  const sb = await client();
  if (!sb) return { ok: false, skipped: true };
  const bytes = await fs.promises.readFile(f.path);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const r = await core.autoSaveLog(sb, bytes, f.name || path.basename(f.path), fmtOf(f.name || f.path), { hash });
  if (r && r.ok) notify();
  return r;
}
async function list() {
  const sb = await client();
  if (!sb) return [];
  return core.listHistory(sb);
}
async function open(id) {
  const sb = await client();
  if (!sb) return { error: 'Sign in to open logs from your account.' };
  const r = await core.openHistory(sb, id);
  if (!r) return { error: 'That log is no longer in your account.' };
  return { name: r.name, format: r.format, size: r.buffer.length, data: r.buffer };
}
async function remove(id) {
  const sb = await client();
  if (!sb) return false;
  const ok = await core.deleteHistory(sb, id);
  if (ok) notify();
  return ok;
}

function install(d) {
  deps = d;
  ipcMain.handle('history:list', () => list());
  ipcMain.handle('history:open', (_e, id) => open(String(id || '')));
  // The History list's delete button (Ken, 2026-09-10). This drops the copy stored in the account, so
  // it asks first -- in main, where the deletion happens, not in the page. `name` is for the wording
  // only; the id is what gets deleted. remove() itself (module export) stays confirmation-free.
  ipcMain.handle('history:remove', async (_e, id, name) => {
    const nm = String(name || '').trim() || 'this log';
    const opts = {
      type: 'warning', title: 'Delete from account', noLink: true,
      message: `Delete "${nm}" from your account?`,
      detail: 'It stops showing up in History on your other devices. Files on this PC are not touched.',
      buttons: ['Delete', 'Cancel'], defaultId: 0, cancelId: 1,
    };
    const w = deps && deps.getWindow ? deps.getWindow() : null;
    const r = await (w && !w.isDestroyed() ? dialog.showMessageBox(w, opts) : dialog.showMessageBox(opts));
    if (!r || r.response !== 0) return { canceled: true };
    const ok = await remove(String(id || ''));
    return ok ? { ok: true } : { error: 'Could not delete that log from your account.' };
  });
  ipcMain.handle('history:getSync', () => syncEnabled());
  ipcMain.handle('history:setSync', (_e, on) => setSync(!!on));
}

module.exports = { install, noteOpened, list, open, remove, syncEnabled, setSync, fmtOf };
