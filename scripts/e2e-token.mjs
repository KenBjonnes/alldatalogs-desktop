/*
 * e2e-token.mjs — proves the deployed issue-entitlement-token function and the app's verifier agree,
 * without launching the app: sign in as the test account (credentials in
 * %USERPROFILE%\.alldatalogs-keys\bigdata-test-account.json), request a token, verify it with the
 * bundled main/jws.js and the embedded public keys, print the claims.
 *
 *   node scripts/e2e-token.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jws = require('../main/jws.js');
const KEYS = require('../main/entitlement-keys.js');
const cfg = require('../main/config.js');

const acct = JSON.parse(readFileSync(join(homedir(), '.alldatalogs-keys', 'bigdata-test-account.json'), 'utf8'));

const signIn = await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: acct.email, password: acct.password }),
});
const auth = await signIn.json();
if (!auth.access_token) { console.error('sign-in failed:', signIn.status, auth); process.exit(1); }
console.log(`signed in as ${acct.email} (user ${auth.user && auth.user.id})`);

const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${cfg.ENTITLEMENT_FUNCTION}`, {
  method: 'POST',
  headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ installId: 'e2e-test-install', appVersion: '0.1.0' }),
});
const body = await res.json().catch(() => null);
console.log('function status', res.status, body && { pro: body.pro, status: body.status, exp: body.exp, kid: body.kid, error: body.error });
if (res.status !== 200 || !body || !body.token) process.exit(1);

const v = await jws.verifyJws(body.token, { keys: KEYS, iss: cfg.TOKEN_ISS, aud: cfg.TOKEN_AUD });
console.log('verify:', v.ok ? 'OK' : `FAILED (${v.error})`);
if (v.ok || v.error === 'expired') {
  const c = v.claims;
  const days = ((c.exp - c.iat) / 86400).toFixed(1);
  console.log(`claims: sub=${c.sub} email=${c.email} pro=${c.pro} status=${c.status} provider=${c.provider} mid=${c.mid} ttl=${days}d kid=${v.kid}`);
}
process.exit(v.ok ? 0 : 1);
