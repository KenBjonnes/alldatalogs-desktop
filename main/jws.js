var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../../../websites/Alldatalogs/supabase/functions/_shared/jws.ts
var jws_exports = {};
__export(jws_exports, {
  b64Decode: () => b64Decode,
  b64urlDecode: () => b64urlDecode,
  b64urlEncode: () => b64urlEncode,
  importPrivateKey: () => importPrivateKey,
  importPublicKey: () => importPublicKey,
  signJws: () => signJws,
  verifyJws: () => verifyJws
});
module.exports = __toCommonJS(jws_exports);
var te = new TextEncoder();
var td = new TextDecoder();
function subtle() {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("WebCrypto is not available in this runtime");
  return s;
}
function b64urlEncode(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBinary(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - b64.length % 4);
  return fromBinary(atob(b64 + pad));
}
function b64Decode(str) {
  return fromBinary(atob(str.trim()));
}
var EC = { name: "ECDSA", namedCurve: "P-256" };
var SIG = { name: "ECDSA", hash: "SHA-256" };
function importPrivateKey(pkcs8B64) {
  return subtle().importKey("pkcs8", b64Decode(pkcs8B64), EC, false, ["sign"]);
}
function importPublicKey(spkiB64) {
  return subtle().importKey("spki", b64Decode(spkiB64), EC, false, ["verify"]);
}
async function signJws(claims, privateKey, kid) {
  const header = b64urlEncode(te.encode(JSON.stringify({ alg: "ES256", typ: "JWT", kid })));
  const payload = b64urlEncode(te.encode(JSON.stringify(claims)));
  const sig = await subtle().sign(SIG, privateKey, te.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64urlEncode(new Uint8Array(sig))}`;
}
async function verifyJws(token, opts) {
  try {
    if (typeof token !== "string") return { ok: false, error: "malformed" };
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return { ok: false, error: "malformed" };
    const header = JSON.parse(td.decode(b64urlDecode(parts[0])));
    if (!header || header.alg !== "ES256") return { ok: false, error: "bad_alg" };
    const kid = typeof header.kid === "string" ? header.kid : "";
    const spki = kid ? opts.keys[kid] : void 0;
    if (!spki) return { ok: false, error: "unknown_kid" };
    const key = await importPublicKey(spki);
    const valid = await subtle().verify(SIG, key, b64urlDecode(parts[2]), te.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return { ok: false, error: "bad_signature" };
    const claims = JSON.parse(td.decode(b64urlDecode(parts[1])));
    if (!claims || typeof claims !== "object") return { ok: false, error: "malformed" };
    if (claims.iss !== opts.iss) return { ok: false, error: "bad_iss" };
    if (claims.aud !== opts.aud) return { ok: false, error: "bad_aud" };
    const iat = claims.iat, exp = claims.exp;
    if (typeof iat !== "number" || typeof exp !== "number" || !(exp > iat)) return { ok: false, error: "bad_times" };
    const now = opts.now ?? Math.floor(Date.now() / 1e3);
    if (exp <= now) return { ok: false, error: "expired", claims, kid };
    return { ok: true, claims, kid };
  } catch {
    return { ok: false, error: "malformed" };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  b64Decode,
  b64urlDecode,
  b64urlEncode,
  importPrivateKey,
  importPublicKey,
  signJws,
  verifyJws
});
