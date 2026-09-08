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

// ../../../../websites/Alldatalogs/supabase/functions/_shared/entitlement.ts
var entitlement_exports = {};
__export(entitlement_exports, {
  CANCELED_TAIL_MS: () => CANCELED_TAIL_MS,
  FULL_TTL_MS: () => FULL_TTL_MS,
  GRACE_TTL_MS: () => GRACE_TTL_MS,
  NEGATIVE_TTL_MS: () => NEGATIVE_TTL_MS,
  computeEntitlement: () => computeEntitlement
});
module.exports = __toCommonJS(entitlement_exports);
var DAY = 864e5;
var FULL_TTL_MS = 30 * DAY;
var GRACE_TTL_MS = 7 * DAY;
var CANCELED_TAIL_MS = 3 * DAY;
var NEGATIVE_TTL_MS = 1 * DAY;
function computeEntitlement(row, nowMs = Date.now()) {
  if (!row) return { pro: false, status: "none", ttlMs: NEGATIVE_TTL_MS, productId: null, provider: null, cpe: null };
  const base = { productId: row.product_id ?? null, provider: row.provider ?? null, cpe: row.current_period_end ?? null };
  const status = row.status || (row.is_active ? "active" : "expired");
  const grants = row.is_active === true || status === "canceled_active" || status === "grace";
  if (!grants) return { pro: false, status, ttlMs: NEGATIVE_TTL_MS, ...base };
  let ttl = FULL_TTL_MS;
  if (status === "grace") {
    ttl = GRACE_TTL_MS;
  } else if (status === "canceled_active") {
    const cpe = row.current_period_end ? Date.parse(row.current_period_end) : NaN;
    if (!Number.isNaN(cpe)) ttl = Math.min(ttl, cpe + CANCELED_TAIL_MS - nowMs);
  }
  if (ttl <= 0) return { pro: false, status: "expired", ttlMs: NEGATIVE_TTL_MS, ...base };
  return { pro: true, status, ttlMs: ttl, ...base };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CANCELED_TAIL_MS,
  FULL_TTL_MS,
  GRACE_TTL_MS,
  NEGATIVE_TTL_MS,
  computeEntitlement
});
