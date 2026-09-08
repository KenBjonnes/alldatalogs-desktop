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

module.exports = { init, isEncryptionAvailable, getSession, signIn, signOut, fetchEntitlementToken, pullLayouts, pushLayout, removeLayout };
