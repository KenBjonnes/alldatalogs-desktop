'use strict';
// license.test.js — table-driven coverage of the pure licence decision (main/license.js evaluate()).
// Electron is stubbed so the module loads under plain Node.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Stub the 'electron' import the module makes at load time.
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return 'electron-stub';
  return realResolve.call(this, request, ...rest);
};
require.cache['electron-stub'] = {
  id: 'electron-stub', filename: 'electron-stub', loaded: true,
  exports: { app: { isPackaged: true, getPath: () => '.', getVersion: () => '0.0.0' }, ipcMain: { handle() {}, on() {} }, powerMonitor: { on() {} } },
};
const { evaluate, DAY_MS } = require('../main/license.js');

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);
const sec = (ms) => Math.floor(ms / 1000);
const SESSION = { userId: 'u1', email: 'ken@example.com' };
const INSTALL = 'inst-1';

function claims(o) {
  return { v: 1, iss: 'alldatalogs', aud: 'bigdata-desktop', sub: 'u1', email: 'tok@example.com', pro: true, status: 'active', mid: INSTALL, iat: sec(NOW) - 60, exp: sec(NOW) + 30 * 86400, ...o };
}
const live = (o) => ({ ok: true, claims: claims(o), kid: 'k' });
const expired = (o) => ({ ok: false, error: 'expired', claims: claims({ exp: sec(NOW) - 5, ...o }), kid: 'k' });
const store = (o) => ({ token: 'tok', fetchedAt: NOW - 3600_000, clockHighWater: NOW - 60_000, lastResult: 'ok', ...o });
const run = (o) => evaluate({ store: store(), verified: null, now: NOW, session: SESSION, installId: INSTALL, encryptionAvailable: true, ...o });

test('signed out: no session, no token', () => {
  const s = run({ session: null, store: store({ token: null, lastResult: null }) });
  assert.equal(s.pro, null); assert.equal(s.reason, 'signed_out');
});

test('signed in, never fetched / fetch failed: must activate online', () => {
  assert.equal(run({ store: store({ token: null, lastResult: null }) }).reason, 'activate_offline');
  assert.equal(run({ store: store({ token: null, lastResult: 'network' }) }).reason, 'activate_offline');
  assert.equal(run({ store: store({ token: null, lastResult: 'server' }) }).reason, 'activate_offline');
});

test('live pro token, fresh refresh -> ok with daysLeft', () => {
  const s = run({ verified: live() });
  assert.equal(s.pro, true); assert.equal(s.reason, 'ok'); assert.equal(s.daysLeft, 30); assert.equal(s.status, 'active');
  assert.equal(s.email, 'ken@example.com');
});

test('live pro token, last refresh failed -> ok_offline, then expiring_soon under 7 days', () => {
  assert.equal(run({ verified: live(), store: store({ lastResult: 'network' }) }).reason, 'ok_offline');
  assert.equal(run({ verified: live(), store: store({ lastResult: 'server' }) }).reason, 'ok_offline');
  assert.equal(run({ verified: live(), store: store({ lastResult: 'bad_token' }) }).reason, 'ok_offline');
  const s = run({ verified: live({ exp: sec(NOW) + 5 * 86400 }), store: store({ lastResult: 'network' }) });
  assert.equal(s.pro, true); assert.equal(s.reason, 'expiring_soon'); assert.equal(s.daysLeft, 5);
});

test('live pro token but the session is gone or rejected -> still pro, session_lost', () => {
  const a = run({ verified: live(), session: null });
  assert.equal(a.pro, true); assert.equal(a.reason, 'session_lost'); assert.equal(a.email, 'tok@example.com');
  const b = run({ verified: live(), store: store({ lastResult: 'unauthorized' }) });
  assert.equal(b.pro, true); assert.equal(b.reason, 'session_lost');
});

test('expired pro token -> limited when signed in, signed_out otherwise', () => {
  const a = run({ verified: expired(), store: store({ lastResult: 'network' }) });
  assert.equal(a.pro, null); assert.equal(a.reason, 'limited');
  const b = run({ verified: expired(), session: null });
  assert.equal(b.pro, null); assert.equal(b.reason, 'signed_out');
});

test('signed negative is definitive, expired or not', () => {
  const a = run({ verified: live({ pro: false, status: 'expired' }), store: store({ lastResult: 'not_pro' }) });
  assert.equal(a.pro, false); assert.equal(a.reason, 'not_pro'); assert.equal(a.status, 'expired');
  const b = run({ verified: expired({ pro: false, status: 'billing_issue' }), store: store({ lastResult: 'network' }) });
  assert.equal(b.pro, false); assert.equal(b.reason, 'not_pro'); assert.equal(b.status, 'billing_issue');
});

test('token bound to another install is ignored (copied license.json)', () => {
  const a = run({ verified: live({ mid: 'other-pc' }) });
  assert.equal(a.pro, null); assert.equal(a.reason, 'activate_offline');
  const b = run({ verified: live({ mid: 'other-pc' }), session: null });
  assert.equal(b.reason, 'signed_out');
});

test('token for another account -> wrong_account', () => {
  const s = run({ verified: live({ sub: 'u2' }) });
  assert.equal(s.pro, false); assert.equal(s.reason, 'wrong_account'); assert.equal(s.email, 'ken@example.com');
});

test('clock moved backwards beyond a day -> clock_tamper; within a day is tolerated', () => {
  const a = run({ verified: live(), store: store({ clockHighWater: NOW + 3 * DAY_MS }) });
  assert.equal(a.pro, null); assert.equal(a.reason, 'clock_tamper');
  const b = run({ verified: live(), store: store({ clockHighWater: NOW + 12 * 3600_000 }) });
  assert.equal(b.reason, 'ok');
  // a signed negative still wins over tamper
  const c = run({ verified: live({ pro: false }), store: store({ clockHighWater: NOW + 3 * DAY_MS, lastResult: 'not_pro' }) });
  assert.equal(c.reason, 'not_pro');
});

test('server said the app is too old -> app_outdated even with a live token', () => {
  const s = run({ verified: live(), store: store({ lastResult: 'outdated' }) });
  assert.equal(s.pro, null); assert.equal(s.reason, 'app_outdated');
});

test('token with a bad signature counts as no token', () => {
  assert.equal(run({ verified: { ok: false, error: 'bad_signature' } }).reason, 'activate_offline');
  assert.equal(run({ verified: { ok: false, error: 'unknown_kid' }, session: null }).reason, 'signed_out');
});

test('storage unavailable is reported alongside the state', () => {
  const s = run({ verified: live(), encryptionAvailable: false });
  assert.equal(s.reason, 'ok'); assert.equal(s.storageUnavailable, true);
  assert.equal(run({ verified: live() }).storageUnavailable, false);
});
