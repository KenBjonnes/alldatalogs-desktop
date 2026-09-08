'use strict';
/*
 * supabase.js — the app's only Supabase client, in the MAIN process.
 *
 * Auth (email + password, the same accounts as alldatalogs.com), session persistence, the entitlement
 * token request, and cloud layouts all go through here. The renderer never holds a token.
 *
 * Session persistence: supabase-js gets a storage adapter that writes one file, userData/session.bin,
 * encrypted with Electron safeStorage (Windows DPAPI, per Windows user). If DPAPI is unavailable the
 * session is kept in memory only and the app reports `storage_unavailable` so the user knows they will
 * sign in each launch — a refresh token is never written to disk in the clear.
 *
 * Sign-out is LOCAL scope on purpose: the default ('global') would also sign the user out of the
 * website in their browser.
 */
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const cfg = require('./config');

let client = null;
let encryptionOk = false;
let memoryStore = new Map();

function sessionPath() { return path.join(app.getPath('userData'), 'session.bin'); }

function readFileStore() {
  try {
    if (!encryptionOk) return null;
    const buf = fs.readFileSync(sessionPath());
    const json = safeStorage.decryptString(buf);
    const obj = JSON.parse(json);
    return obj && typeof obj === 'object' ? obj : null;
  } catch { return null; }
}
function writeFileStore(obj) {
  try {
    if (!encryptionOk) return;
    fs.mkdirSync(path.dirname(sessionPath()), { recursive: true });
    fs.writeFileSync(sessionPath(), safeStorage.encryptString(JSON.stringify(obj)));
  } catch { /* best effort */ }
}

// supabase-js SupportedStorage: async methods are allowed.
const storage = {
  async getItem(key) {
    if (memoryStore.has(key)) return memoryStore.get(key);
    const f = readFileStore();
    return f && typeof f[key] === 'string' ? f[key] : null;
  },
  async setItem(key, value) {
    memoryStore.set(key, value);
    const f = readFileStore() || {};
    f[key] = value;
    writeFileStore(f);
  },
  async removeItem(key) {
    memoryStore.delete(key);
    const f = readFileStore();
    if (f && key in f) { delete f[key]; writeFileStore(f); }
  },
};

function init() {
  encryptionOk = (() => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } })();
  client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage, storageKey: 'bigdata-auth' },
    global: { headers: { 'x-client-info': `bigdata-desktop/${app.getVersion()}` } },
  });
  return client;
}

function isEncryptionAvailable() { return encryptionOk; }

/** Current session (may be stale offline; supabase-js refreshes when it can). Null when signed out. */
async function getSession() {
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data && data.session ? data.session : null;
  } catch { return null; }
}

function mapAuthError(err) {
  const msg = (err && err.message) || '';
  const code = (err && (err.code || err.name)) || '';
  if (/email_not_confirmed/i.test(code + msg)) return 'Please confirm your email address first (check your inbox), then sign in.';
  if (/invalid login credentials|invalid_credentials/i.test(code + msg)) return 'Wrong email or password.';
  if (/fetch|network|ENOTFOUND|ECONN|timeout/i.test(code + msg)) return 'Could not reach alldatalogs.com. Check your internet connection.';
  if (/rate/i.test(code + msg)) return 'Too many attempts. Please wait a minute and try again.';
  return msg || 'Sign-in failed.';
}

async function signIn(email, password) {
  if (!client) return { ok: false, error: 'Not ready.' };
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data || !data.session) return { ok: false, error: mapAuthError(error) };
    return { ok: true, session: data.session };
  } catch (e) {
    return { ok: false, error: mapAuthError(e) };
  }
}

async function signOut() {
  if (!client) return;
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
  memoryStore = new Map();
  try { fs.unlinkSync(sessionPath()); } catch { /* none */ }
}

/**
 * Ask the edge function for a signed entitlement token.
 * Returns { kind: 'ok', token, pro, status } | { kind: 'unauthorized' | 'outdated' | 'server' | 'network', error }.
 */
async function fetchEntitlementToken(accessToken, installId) {
  const url = `${cfg.SUPABASE_URL}/functions/v1/${cfg.ENTITLEMENT_FUNCTION}`;
  let res;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: cfg.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ installId, appVersion: app.getVersion() }),
      signal: ctl.signal,
    }).finally(() => clearTimeout(t));
  } catch (e) {
    return { kind: 'network', error: (e && e.message) || 'network' };
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (res.status === 200 && body && typeof body.token === 'string') return { kind: 'ok', token: body.token, pro: !!body.pro, status: body.status || null };
  if (res.status === 401) return { kind: 'unauthorized', error: (body && body.error) || 'unauthorized' };
  if (res.status === 426) return { kind: 'outdated', error: (body && body.minVersion) || 'update_required' };
  return { kind: 'server', error: `${res.status} ${(body && body.error) || ''}`.trim() };
}

// ---- cloud layouts (viewer_layouts, RLS owner-CRUD) ------------------------------------------------
async function pullLayouts() {
  if (!client) return { ok: false, rows: [] };
  const session = await getSession();
  if (!session) return { ok: false, rows: [] };
  const { data, error } = await client.from('viewer_layouts').select('id,name,state,updated_at').order('updated_at', { ascending: false });
  if (error || !data) return { ok: false, rows: [], error: error && error.message };
  return {
    ok: true,
    rows: data.map((r) => ({ id: r.id, name: r.name, state: r.state, updatedAt: r.updated_at ? Date.parse(r.updated_at) : Date.now() })),
  };
}
async function pushLayout(entry) {
  if (!client || !entry || !entry.id || !entry.name) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  const { error } = await client.from('viewer_layouts').upsert({
    id: String(entry.id),
    user_id: session.user.id,
    name: String(entry.name),
    state: entry.state && typeof entry.state === 'object' ? entry.state : {},
    updated_at: new Date(Number(entry.updatedAt) || Date.now()).toISOString(),
  });
  return { ok: !error, error: error && error.message };
}
async function removeLayout(id) {
  if (!client || !id) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  const { error } = await client.from('viewer_layouts').delete().eq('id', String(id));
  return { ok: !error, error: error && error.message };
}

// ---- shared library (library_items; browse is open to anyone, publish/remove need a session) -------
const LIB_COLS = 'id,kind,name,description,owner_id,author_name,is_official,status,thumb_svg,vehicle,vehicle_year,vehicle_make,vehicle_model,tags,pulls,created_at,updated_at';
function likeTerm(q) { return String(q || '').replace(/[,()%\\]/g, ' ').trim().slice(0, 60); }
// The structured car link (official Year / Make / Model from the engine's picker) + its display string.
function vehicleCols(v) {
  v = v || {};
  const year = typeof v.vehicle_year === 'number' && isFinite(v.vehicle_year) ? Math.round(v.vehicle_year) : null;
  return {
    vehicle: String(v.vehicle || '').trim().slice(0, 120),
    vehicle_year: year && year >= 1900 && year <= 2100 ? year : null,
    vehicle_make: String(v.vehicle_make || '').trim().slice(0, 60),
    vehicle_model: String(v.vehicle_model || '').trim().slice(0, 60),
  };
}
async function libraryList(q) {
  if (!client) return { items: [], hasMore: false };
  q = q || {};
  const size = Math.max(1, Math.min(60, q.pageSize || 30));
  const from = Math.max(0, q.page || 0) * size;
  let req = client.from('library_items').select(LIB_COLS)
    .order('is_official', { ascending: false }).order('pulls', { ascending: false }).order('updated_at', { ascending: false })
    .range(from, from + size);
  if (q.kind) req = req.eq('kind', q.kind);
  const source = q.source || (q.official ? 'official' : 'all');
  if (source === 'official') req = req.eq('is_official', true);
  else if (source === 'user') req = req.eq('is_official', false);
  if (q.mine) {
    const s = await getSession();
    if (!s) return { items: [], hasMore: false };
    req = req.eq('owner_id', s.user.id);
  } else {
    req = req.eq('status', 'published');
  }
  const term = likeTerm(q.q);
  if (term) req = req.or(`name.ilike.%${term}%,description.ilike.%${term}%,vehicle.ilike.%${term}%,author_name.ilike.%${term}%`);
  const { data, error } = await req;
  if (error || !data) return { items: [], hasMore: false, error: error && error.message };
  return { items: data.slice(0, size), hasMore: data.length > size };
}
async function libraryGet(id) {
  if (!client || !id) return null;
  const { data } = await client.from('library_items').select('*').eq('id', String(id)).maybeSingle();
  return data || null;
}
async function libraryPublish(input) {
  if (!client || !input) return { ok: false, error: 'Not ready.' };
  const s = await getSession();
  if (!s) return { ok: false, error: 'Sign in to share to the library.' };
  const meta = (s.user && s.user.user_metadata) || {};
  const author = String(meta.display_name || (s.user.email || '').split('@')[0] || 'AllDataLogs user').slice(0, 80);
  const row = {
    id: 'lib_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    kind: input.kind === 'histogram' ? 'histogram' : 'gauges',
    name: String(input.name || '').trim().slice(0, 120),
    description: String(input.description || '').trim().slice(0, 2000),
    owner_id: s.user.id,
    author_name: author,
    payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    thumb_svg: typeof input.thumb_svg === 'string' ? input.thumb_svg.slice(0, 60000) : null,
    ...vehicleCols(input),
    tags: Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
  };
  if (!row.name) return { ok: false, error: 'Give it a name first.' };
  const { data, error } = await client.from('library_items').insert(row).select(LIB_COLS).single();
  if (error) return { ok: false, error: error.message };
  // Ours are System from the first moment they are visible (Ken, 2026-09-08); the guard trigger
  // keeps clients from setting the flag directly, so it goes through the admin function.
  if (await libraryIsAdmin()) {
    const r = await libraryAdmin('library_official', { itemId: data.id, value: true });
    if (r && r.ok) data.is_official = true;
  }
  return { ok: true, item: data };
}
/** Replace the content / details of one of the caller's own items in place. */
async function libraryUpdate(id, input) {
  if (!client || !id || !input) return { ok: false, error: 'Not ready.' };
  const s = await getSession();
  if (!s) return { ok: false, error: 'Sign in to update library items.' };
  const patch = {};
  if (typeof input.name === 'string') { patch.name = input.name.trim().slice(0, 120); if (!patch.name) return { ok: false, error: 'Give it a name first.' }; }
  if (typeof input.description === 'string') patch.description = input.description.trim().slice(0, 2000);
  if (input.payload && typeof input.payload === 'object') patch.payload = input.payload;
  if (input.thumb_svg !== undefined) patch.thumb_svg = typeof input.thumb_svg === 'string' ? input.thumb_svg.slice(0, 60000) : null;
  if (input.vehicle !== undefined || input.vehicle_make !== undefined || input.vehicle_model !== undefined || input.vehicle_year !== undefined) Object.assign(patch, vehicleCols(input));
  const { data, error } = await client.from('library_items').update(patch).eq('id', String(id)).eq('owner_id', s.user.id).select(LIB_COLS).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'That item is not yours or no longer exists.' };
  return { ok: true, item: data };
}
async function libraryRemove(id) {
  if (!client || !id) return { ok: false, error: 'Not ready.' };
  const { error } = await client.from('library_items').delete().eq('id', String(id));
  return error ? { ok: false, error: error.message } : { ok: true };
}
async function libraryPull(id) {
  if (!client || !id) return;
  try { await client.rpc('library_pull', { item_id: String(id) }); } catch { /* counter only */ }
}
async function libraryMe() {
  const s = await getSession();
  return s ? { userId: s.user.id, email: s.user.email || null } : null;
}
async function libraryAdmin(action, body) {
  if (!client) return { ok: false, error: 'Not ready.' };
  const s = await getSession();
  if (!s) return { ok: false, error: 'Sign in first.' };
  try {
    const { data, error } = await client.functions.invoke('admin', { body: { action, ...(body || {}) } });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false, error: 'No response.' };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}
let adminKnown = null;
async function libraryIsAdmin() {
  if (adminKnown !== null) return adminKnown;
  const r = await libraryAdmin('whoami', {});
  adminKnown = !!(r && r.admin);
  return adminKnown;
}

module.exports = { init, isEncryptionAvailable, getSession, signIn, signOut, fetchEntitlementToken, pullLayouts, pushLayout, removeLayout,
  libraryList, libraryGet, libraryPublish, libraryUpdate, libraryRemove, libraryPull, libraryMe, libraryIsAdmin, libraryAdmin };
