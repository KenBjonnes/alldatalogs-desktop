'use strict';
/*
 * license.js — what the renderer is told about the user's AllDataLogs Pro entitlement.
 *
 * M0 scaffold: the real state machine (signed entitlement token, offline grace, clock guard) lands in
 * M2. Until then the app runs in one of two states: the developer override BIGDATA_DEV_PRO=1 (never
 * honoured in a packaged build) reports Pro; otherwise 'signed_out'.
 *
 * State shape handed to the renderer (stable across milestones):
 *   { pro: true | false | null, reason, status, daysLeft, email }
 */
const { app, ipcMain } = require('electron');

const DEV_PRO = !app.isPackaged && process.env.BIGDATA_DEV_PRO === '1';

let state = DEV_PRO
  ? { pro: true, reason: 'dev', status: 'active', daysLeft: null, email: 'dev@localhost' }
  : { pro: null, reason: 'signed_out', status: null, daysLeft: null, email: null };

let getWindow = () => null;

function getState() { return state; }
function devPro() { return DEV_PRO; }

// Which states may open log files at all. 'limited'/'clock_tamper'/'app_outdated' still open files
// (Pro features are locked by the engine instead); the rest show a screen with no viewer behind it.
const NO_FILES = new Set(['signed_out', 'not_pro', 'wrong_account', 'activate_offline']);
function openBlockedReason() {
  if (state.pro === true) return null;
  if (NO_FILES.has(state.reason)) return 'Sign in with an AllDataLogs Pro account to open logs.';
  return null;
}

function setState(next) {
  state = next;
  const w = getWindow();
  if (w && !w.isDestroyed()) w.webContents.send('license:changed', state);
}

async function signOut() {
  if (DEV_PRO) return { ok: true };
  setState({ pro: null, reason: 'signed_out', status: null, daysLeft: null, email: null });
  return { ok: true };
}

function install(opts) {
  getWindow = opts.getWindow;
  ipcMain.handle('license:get', () => state);
  ipcMain.handle('license:refresh', async () => state);
  ipcMain.handle('auth:signIn', async () => ({ ok: false, error: 'Sign-in is not available in this build yet.' }));
  ipcMain.handle('auth:signOut', signOut);
}

module.exports = { install, getState, setState, devPro, openBlockedReason, signOut };
