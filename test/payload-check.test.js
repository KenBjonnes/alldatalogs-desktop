'use strict';
// payload-check.test.js — the committed payload must match its manifest (and its sources, when present).
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

test('build-payload --check passes', () => {
  const r = spawnSync(process.execPath, [join(__dirname, '..', 'scripts', 'build-payload.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});
