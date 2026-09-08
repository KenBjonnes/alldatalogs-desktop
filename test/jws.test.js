'use strict';
// jws.test.js — the token format the edge function signs must be exactly what the app verifies.
// Uses a throwaway P-256 pair generated per run; the module under test is the built main/jws.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const jws = require('../main/jws.js');

const { subtle } = webcrypto;
const ISS = 'alldatalogs', AUD = 'bigdata-desktop';

async function pair() {
  const p = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    priv: Buffer.from(await subtle.exportKey('pkcs8', p.privateKey)).toString('base64'),
    pub: Buffer.from(await subtle.exportKey('spki', p.publicKey)).toString('base64'),
  };
}

const now = 1_800_000_000; // seconds
const baseClaims = (o) => ({ v: 1, iss: ISS, aud: AUD, sub: 'user-1', email: 'k@example.com', pro: true, status: 'active', mid: 'install-1', iat: now, exp: now + 30 * 86400, ...o });

test('sign then verify round-trips (P1363 signature, WebCrypto on both ends)', async () => {
  const k = await pair();
  const token = await jws.signJws(baseClaims({}), await jws.importPrivateKey(k.priv), 'kid-1');
  assert.equal(token.split('.').length, 3);
  const r = await jws.verifyJws(token, { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now });
  assert.equal(r.ok, true);
  assert.equal(r.kid, 'kid-1');
  assert.equal(r.claims.sub, 'user-1');
  assert.equal(r.claims.pro, true);
});

test('rejects a token signed by another key', async () => {
  const k1 = await pair(), k2 = await pair();
  const token = await jws.signJws(baseClaims({}), await jws.importPrivateKey(k1.priv), 'kid-1');
  const r = await jws.verifyJws(token, { keys: { 'kid-1': k2.pub }, iss: ISS, aud: AUD, now });
  assert.deepEqual(r, { ok: false, error: 'bad_signature' });
});

test('rejects a tampered payload', async () => {
  const k = await pair();
  const token = await jws.signJws(baseClaims({ pro: false }), await jws.importPrivateKey(k.priv), 'kid-1');
  const [h, , s] = token.split('.');
  const forged = jws.b64urlEncode(new TextEncoder().encode(JSON.stringify(baseClaims({ pro: true }))));
  const r = await jws.verifyJws(`${h}.${forged}.${s}`, { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now });
  assert.deepEqual(r, { ok: false, error: 'bad_signature' });
});

test('rejects unknown kid, alg none, wrong iss/aud, malformed', async () => {
  const k = await pair();
  const token = await jws.signJws(baseClaims({}), await jws.importPrivateKey(k.priv), 'kid-1');
  assert.equal((await jws.verifyJws(token, { keys: { other: k.pub }, iss: ISS, aud: AUD, now })).error, 'unknown_kid');
  const [, p, s] = token.split('.');
  const noneHeader = jws.b64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'kid-1' })));
  assert.equal((await jws.verifyJws(`${noneHeader}.${p}.${s}`, { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now })).error, 'bad_alg');
  assert.equal((await jws.verifyJws(token, { keys: { 'kid-1': k.pub }, iss: 'someone', aud: AUD, now })).error, 'bad_iss');
  assert.equal((await jws.verifyJws(token, { keys: { 'kid-1': k.pub }, iss: ISS, aud: 'web', now })).error, 'bad_aud');
  assert.equal((await jws.verifyJws('nope', { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now })).error, 'malformed');
  assert.equal((await jws.verifyJws('', { keys: {}, iss: ISS, aud: AUD, now })).error, 'malformed');
});

test('expired token: signature still checked, claims returned with error=expired', async () => {
  const k = await pair();
  const token = await jws.signJws(baseClaims({ iat: now - 100, exp: now - 1 }), await jws.importPrivateKey(k.priv), 'kid-1');
  const r = await jws.verifyJws(token, { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'expired');
  assert.equal(r.claims.sub, 'user-1');
  // ...but an expired token with a bad signature is just bad
  const [h, p] = token.split('.');
  const r2 = await jws.verifyJws(`${h}.${p}.${jws.b64urlEncode(new Uint8Array(64))}`, { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now });
  assert.equal(r2.error, 'bad_signature');
});

test('rejects missing or inverted iat/exp', async () => {
  const k = await pair();
  const key = await jws.importPrivateKey(k.priv);
  const t1 = await jws.signJws(baseClaims({ exp: now - 100, iat: now }), key, 'kid-1');
  assert.equal((await jws.verifyJws(t1, { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now })).error, 'bad_times');
  const c = baseClaims({}); delete c.exp;
  const t2 = await jws.signJws(c, key, 'kid-1');
  assert.equal((await jws.verifyJws(t2, { keys: { 'kid-1': k.pub }, iss: ISS, aud: AUD, now })).error, 'bad_times');
});
