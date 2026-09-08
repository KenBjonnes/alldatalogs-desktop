'use strict';
// entitlement.test.js — one row per line of the TTL table in the plan (built from the site's
// supabase/functions/_shared/entitlement.ts).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../main/entitlement.js');

const DAY = 86_400_000;
const now = Date.UTC(2026, 8, 7, 12, 0, 0);
const iso = (ms) => new Date(ms).toISOString();

test('no row -> not pro, status none, short negative TTL', () => {
  const e = E.computeEntitlement(null, now);
  assert.equal(e.pro, false); assert.equal(e.status, 'none'); assert.equal(e.ttlMs, E.NEGATIVE_TTL_MS);
});

test('active Stripe subscription -> 30 days', () => {
  const e = E.computeEntitlement({ is_active: true, status: 'active', provider: 'stripe', product_id: 'pro_annual', current_period_end: iso(now + 200 * DAY), will_renew: true }, now);
  assert.deepEqual([e.pro, e.status, e.ttlMs, e.productId, e.provider], [true, 'active', E.FULL_TTL_MS, 'pro_annual', 'stripe']);
});

test('comp grant (current_period_end null) -> 30 days', () => {
  const e = E.computeEntitlement({ is_active: true, status: 'active', provider: 'comp', current_period_end: null, will_renew: false }, now);
  assert.equal(e.pro, true); assert.equal(e.ttlMs, E.FULL_TTL_MS); assert.equal(e.cpe, null);
});

test('canceled_active -> until period end + 3 days, capped at 30', () => {
  const soon = E.computeEntitlement({ is_active: true, status: 'canceled_active', current_period_end: iso(now + 10 * DAY) }, now);
  assert.equal(soon.pro, true); assert.equal(soon.ttlMs, 13 * DAY);
  const far = E.computeEntitlement({ is_active: true, status: 'canceled_active', current_period_end: iso(now + 100 * DAY) }, now);
  assert.equal(far.ttlMs, E.FULL_TTL_MS);
  const past = E.computeEntitlement({ is_active: true, status: 'canceled_active', current_period_end: iso(now - 5 * DAY) }, now);
  assert.equal(past.pro, false); assert.equal(past.status, 'expired');
  const noCpe = E.computeEntitlement({ is_active: true, status: 'canceled_active', current_period_end: null }, now);
  assert.equal(noCpe.ttlMs, E.FULL_TTL_MS);
});

test('grace (past_due) -> pro with a 7 day leash', () => {
  const e = E.computeEntitlement({ is_active: true, status: 'grace' }, now);
  assert.equal(e.pro, true); assert.equal(e.ttlMs, E.GRACE_TTL_MS);
});

test('billing_issue / expired / comp_revoked -> not pro', () => {
  for (const status of ['billing_issue', 'expired', 'comp_revoked', 'free']) {
    const e = E.computeEntitlement({ is_active: false, status }, now);
    assert.equal(e.pro, false, status); assert.equal(e.status, status); assert.equal(e.ttlMs, E.NEGATIVE_TTL_MS);
  }
});

test('is_active without a status still grants (defensive)', () => {
  const e = E.computeEntitlement({ is_active: true, status: null }, now);
  assert.equal(e.pro, true); assert.equal(e.status, 'active');
});
