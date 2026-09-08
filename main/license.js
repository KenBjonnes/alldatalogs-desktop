'use strict';
/*
 * license.js — what the renderer is told about the user's AllDataLogs Pro entitlement.
 *
 * The truth is a signed token from the issue-entitlement-token edge function (verified here with the
 * embedded PUBLIC keys; see main/jws.js, built from the site's single source). Its lifetime is the
 * offline grace period. Around it, a small state machine decides what the app does when the token is
 * fresh, ageing, expired, negative, missing, or bound to a different PC or account.
 *
 * Principles (from the plan): only a VERIFIED answer of "not Pro" may demote — network trouble, server
 * errors, a dead session or a bad signature keep the last known state. "Unreachable" is never
 * "cancelled". A formerly-verified customer whose token expired while offline is limited (Pro features
 * locked, viewer still opens) rather than walled out. A clock set backwards is treated as tampering
 * until an online refresh proves otherwise. license.json is bound to this install (mid claim) and to
 * the signed-in account (sub claim), so copying it to another PC or user does nothing.
 *
 * `evaluate()` is pure and unit-tested (test/license.test.js); everything else is plumbing.
 *
 * State shape handed to the renderer:
 *   { pro: true | false | null, reason, status, daysLeft, email, storageUnavailable }
 */
const { app, ipcMain, powerMonitor } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cfg = require('./config');

const DAY_MS = 86_400_000;
const REFRESH_EVERY_MS = 6 * 3_600_000;
const STALE_AFTER_MS = 6 * 3_600_000;
const TAMPER_SLACK_MS = DAY_MS;
const EXPIRING_DAYS = 7;

const DEV_PRO = !app.isPackaged && process.env.BIGDATA_DEV_PRO === '1';

// ---- pure decision -----------------------------------------------------------------------------------
function mkState(pro, reason, extra) {
  return Object.assign({ pro, reason, status: null, daysLeft: null, email: null, storageUnavailable: false }, extra || {});
}

/**
 * @param {object} input
 * @param {object} input.store        persisted { token, fetchedAt, clockHighWater, lastResult }
 * @param {object|null} input.verified result of verifyJws(store.token) at `now`, or null when no token
 * @param {number} input.now          ms since epoch
 * @param {object|null} input.session { userId, email } or null when signed out
 * @param {string} input.installId
 * @param {boolean} [input.encryptionAvailable]
 */
function evaluate(input) {
  const { store, verified, now, session, installId } = input;
  const storageUnavailable = input.encryptionAvailable === false;
  const claims = verified && (verified.ok || verified.error === 'expired') ? verified.claims : null;
  const live = !!(verified && verified.ok);
  const lastResult = store && store.lastResult ? store.lastResult : null;
  const refreshFailed = lastResult === 'network' || lastResult === 'server' || lastResult === 'bad_token';
  const email = (session && session.email) || (claims && typeof claims.email === 'string' ? claims.email : null);

  const withCommon = (s) => Object.assign(s, { email: s.email || email, storageUnavailable });

  // A token from another install or another account is not ours.
  const foreignInstall = !!(claims && claims.mid !== installId);
  const wrongAccount = !!(claims && session && claims.sub !== session.userId);
  if (wrongAccount) return withCommon(mkState(false, 'wrong_account', { email: session.email }));

  const usable = claims && !foreignInstall ? claims : null;

  if (lastResult === 'outdated') return withCommon(mkState(null, 'app_outdated'));

  if (!session && !usable) return withCommon(mkState(null, 'signed_out', { email: null }));

  // A signed negative is definitive until a refresh replaces it, expired or not.
  if (usable && usable.pro === false) {
    return withCommon(mkState(false, 'not_pro', { status: typeof usable.status === 'string' ? usable.status : 'none' }));
  }

  const highWater = store && typeof store.clockHighWater === 'number' ? store.clockHighWater : 0;
  if (highWater && now < highWater - TAMPER_SLACK_MS) return withCommon(mkState(null, 'clock_tamper'));

  if (usable && usable.pro === true && live) {
    const daysLeft = Math.max(0, Math.ceil((usable.exp * 1000 - now) / DAY_MS));
    const base = { status: typeof usable.status === 'string' ? usable.status : 'active', daysLeft };
    if (!session || lastResult === 'unauthorized') return withCommon(mkState(true, 'session_lost', base));
    if (refreshFailed) return withCommon(mkState(true, daysLeft <= EXPIRING_DAYS ? 'expiring_soon' : 'ok_offline', base));
    return withCommon(mkState(true, 'ok', base));
  }

  if (usable && usable.pro === true && !live) {
    if (!session) return withCommon(mkState(null, 'signed_out', { email: null }));
    return withCommon(mkState(null, 'limited', { status: typeof usable.status === 'string' ? usable.status : null }));
  }

  // Signed in, no usable token yet: the app must reach the server once.
  return withCommon(mkState(null, 'activate_offline'));
}

// ---- persistence -------------------------------------------------------------------------------------
function storePath() { return path.join(app.getPath('userData'), 'license.json'); }
function installIdPath() { return path.join(app.getPath('userData'), 'install-id'); }

function readStore() {
  try {
    const o = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    if (o && typeof o === 'object') return { token: null, fetchedAt: null, clockHighWater: 0, lastResult: null, lastResultAt: null, ...o };
  } catch { /* none yet */ }
  return { token: null, fetchedAt: null, clockHighWater: 0, lastResult: null, lastResultAt: null };
}
function writeStore(s) {
  try { fs.mkdirSync(path.dirname(storePath()), { recursive: true }); fs.writeFileSync(storePath(), JSON.stringify(s, null, 2)); } catch { /* best effort */ }
}
function loadInstallId() {
  try {
    const v = fs.readFileSync(installIdPath(), 'utf8').trim();
    if (/^[a-f0-9-]{36}$/i.test(v)) return v;
  } catch { /* none yet */ }
  const id = crypto.randomUUID();
  try { fs.mkdirSync(path.dirname(installIdPath()), { recursive: true }); fs.writeFileSync(installIdPath(), id); } catch { /* best effort */ }
  return id;
}

// ---- runtime -------------------------------------------------------------------------------------------
let sb = null;            // main/supabase.js
let jws = null;           // main/jws.js (built)
let KEYS = {};            // kid -> spki
let getWindow = () => null;
let installId = '';
let store = null;
let state = DEV_PRO
  ? mkState(true, 'dev', { status: 'active', email: 'dev@localhost' })
  : mkState(null, 'signed_out');
let refreshing = null;
let inFlight = false; // a server round-trip is running: "no token yet" is "checking", not "activate"
let timer = null;

function getState() { return state; }
function devPro() { return DEV_PRO; }

// Which states may open log files. limited / clock_tamper / app_outdated still open files (the engine
// locks Pro features); the rest show a screen with no viewer behind it.
const NO_FILES = new Set(['signed_out', 'not_pro', 'wrong_account', 'activate_offline', 'checking']);
function openBlockedReason() {
  if (state.pro === true) return null;
  if (NO_FILES.has(state.reason)) return 'Sign in with an AllDataLogs Pro account to open logs.';
  return null;
}

function broadcast() {
  const w = getWindow();
  if (w && !w.isDestroyed()) w.webContents.send('license:changed', state);
}

async function verifyStored(now) {
  if (!store.token) return null;
  try { return await jws.verifyJws(store.token, { keys: KEYS, iss: cfg.TOKEN_ISS, aud: cfg.TOKEN_AUD, now: Math.floor(now / 1000) }); }
  catch { return { ok: false, error: 'malformed' }; }
}

async function sessionInfo() {
  const s = await sb.getSession();
  return s && s.user ? { userId: s.user.id, email: s.user.email || null, accessToken: s.access_token } : null;
}

async function recompute() {
  if (DEV_PRO) return state;
  const now = Date.now();
  // Track the latest local time we have seen; moving backwards past this is the tamper signal.
  if (now > (store.clockHighWater || 0)) { store.clockHighWater = now; writeStore(store); }
  const session = await sessionInfo();
  const verified = await verifyStored(now);
  const next = evaluate({ store, verified, now, session, installId, encryptionAvailable: sb.isEncryptionAvailable() });
  if (inFlight && next.reason === 'activate_offline') next.reason = 'checking';
  const changed = JSON.stringify(next) !== JSON.stringify(state);
  state = next;
  if (changed) broadcast();
  return state;
}

/** Contact the server for a fresh token (never throws; never demotes on failure). */
async function refresh() {
  if (DEV_PRO) return state;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      inFlight = true;
      const session = await sessionInfo();
      if (!session) { inFlight = false; return recompute(); }
      await recompute(); // lets the UI show "checking" instead of "activate" while we wait
      const r = await sb.fetchEntitlementToken(session.accessToken, installId);
      const now = Date.now();
      if (r.kind === 'ok') {
        const v = await jws.verifyJws(r.token, { keys: KEYS, iss: cfg.TOKEN_ISS, aud: cfg.TOKEN_AUD, now: Math.floor(now / 1000) });
        if (v.ok && v.claims.mid === installId && v.claims.sub === session.userId) {
          store.token = r.token;
          store.fetchedAt = now;
          // A successful online answer is the trusted time reference: it also clears a tamper state.
          store.clockHighWater = Math.max(now, (Number(v.claims.iat) || 0) * 1000);
          store.lastResult = v.claims.pro === true ? 'ok' : 'not_pro';
        } else {
          store.lastResult = 'bad_token'; // key rotation mishap or tampering in transit: keep the old state
        }
      } else {
        store.lastResult = r.kind; // 'unauthorized' | 'outdated' | 'server' | 'network'
      }
      store.lastResultAt = now;
      writeStore(store);
      inFlight = false;
      return recompute();
    } catch {
      inFlight = false;
      return recompute();
    } finally {
      inFlight = false;
      refreshing = null;
    }
  })();
  return refreshing;
}

async function signIn(email, password) {
  if (DEV_PRO) return { ok: true };
  const r = await sb.signIn(String(email || '').trim(), String(password || ''));
  if (!r.ok) return { ok: false, error: r.error };
  // A different account than the stored token belongs to: drop the old token rather than flag it.
  await refresh();
  return { ok: true, state };
}

async function signOut() {
  if (DEV_PRO) return { ok: true };
  await sb.signOut();
  store = { token: null, fetchedAt: null, clockHighWater: store.clockHighWater || 0, lastResult: null, lastResultAt: null };
  writeStore(store);
  await recompute();
  return { ok: true };
}

function scheduleTimers() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => { refresh().catch(() => {}); }, REFRESH_EVERY_MS);
  try { powerMonitor.on('resume', () => { refresh().catch(() => {}); }); } catch { /* not on all platforms */ }
}

function onWindowFocus() {
  const at = store && store.lastResultAt ? store.lastResultAt : 0;
  if (Date.now() - at > STALE_AFTER_MS) refresh().catch(() => {});
}

function install(opts) {
  getWindow = opts.getWindow;
  sb = opts.supabase;
  jws = require('./jws');
  KEYS = require('./entitlement-keys');
  installId = loadInstallId();
  store = readStore();

  ipcMain.handle('license:get', async () => (DEV_PRO ? state : recompute()));
  ipcMain.handle('license:refresh', () => refresh());
  ipcMain.on('license:online', () => { refresh().catch(() => {}); });
  ipcMain.handle('auth:signIn', (_e, args) => signIn(args && args.email, args && args.password));
  ipcMain.handle('auth:signOut', () => signOut());

  scheduleTimers();
  // Boot: decide from what is on disk immediately, then go online for a fresh answer.
  recompute().then(() => refresh()).catch(() => {});
}

module.exports = { install, evaluate, getState, devPro, openBlockedReason, signOut, refresh, onWindowFocus, DAY_MS };
