/*
 * keygen.mjs — one-time generation of the entitlement-token signing key pair (ECDSA P-256 / ES256).
 *
 *   node scripts/keygen.mjs [kid]
 *
 * Prints two single-line base64 strings:
 *   PRIVATE (PKCS8) — goes ONLY into the Supabase secret ENTITLEMENT_SIGNING_KEY. Never into a repo.
 *   PUBLIC  (SPKI)  — goes into main/entitlement-keys.js under the given kid.
 *
 * Single-line base64 rather than PEM because `supabase secrets set` and .env files mangle newlines.
 * WebCrypto is used on both ends (Deno edge function signs, Electron main verifies with crypto.subtle)
 * so the exported formats are exactly what both sides import.
 */
import { webcrypto } from 'node:crypto';

const kid = process.argv[2] || new Date().toISOString().slice(0, 7);
const { subtle } = webcrypto;

const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
const spki = Buffer.from(await subtle.exportKey('spki', pair.publicKey)).toString('base64');

console.log(`kid: ${kid}\n`);
console.log('PRIVATE (Supabase secret, never commit):');
console.log(`  supabase secrets set ENTITLEMENT_SIGNING_KEY="${pkcs8}" ENTITLEMENT_SIGNING_KID="${kid}" --project-ref nvkfhbfyrbifkbynjbsd\n`);
console.log('PUBLIC (main/entitlement-keys.js):');
console.log(`  '${kid}': '${spki}',`);
