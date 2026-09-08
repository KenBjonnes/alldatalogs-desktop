/*
 * keygen.mjs — one-time generation of the entitlement-token signing key pair (ECDSA P-256 / ES256).
 *
 *   node scripts/keygen.mjs [kid]
 *
 * Writes the PRIVATE key (PKCS8, single-line base64) to an env file OUTSIDE any repo:
 *   %USERPROFILE%\.alldatalogs-keys\entitlement-<kid>.env
 * and prints the PUBLIC key (SPKI) line to paste into main/entitlement-keys.js. The private key is
 * never printed and never enters a repo; it reaches Supabase only via:
 *   supabase secrets set --env-file %USERPROFILE%\.alldatalogs-keys\entitlement-<kid>.env --project-ref nvkfhbfyrbifkbynjbsd
 *
 * Single-line base64 rather than PEM because secrets tooling mangles newlines. WebCrypto on both ends
 * (Deno edge function signs, Electron main verifies with crypto.subtle) so the formats match exactly.
 */
import { webcrypto } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const kid = process.argv[2] || new Date().toISOString().slice(0, 7);
const dir = join(homedir(), '.alldatalogs-keys');
const envFile = join(dir, `entitlement-${kid}.env`);
if (existsSync(envFile)) { console.error(`Refusing to overwrite ${envFile}. Pick another kid.`); process.exit(1); }

const { subtle } = webcrypto;
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
const spki = Buffer.from(await subtle.exportKey('spki', pair.publicKey)).toString('base64');

mkdirSync(dir, { recursive: true });
writeFileSync(envFile, `ENTITLEMENT_SIGNING_KEY=${pkcs8}\nENTITLEMENT_SIGNING_KID=${kid}\n`, { mode: 0o600 });

console.log(`kid: ${kid}`);
console.log(`private key written to: ${envFile}`);
console.log(`\nSet the secret with:\n  supabase secrets set --env-file "${envFile}" --project-ref nvkfhbfyrbifkbynjbsd`);
console.log(`\nPUBLIC key for main/entitlement-keys.js:\n  '${kid}': '${spki}',`);
