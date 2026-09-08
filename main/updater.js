'use strict';
/*
 * updater.js — auto-update from the public GitHub Releases feed (electron-updater, config in
 * electron-builder.yml `publish`).
 *
 * Checks shortly after launch and every 4 hours, downloads in the background, installs on quit.
 * Status is pushed to the renderer footer ("Update ready — restart") and the Help menu can run an
 * interactive check. Only packaged builds check: a dev checkout has no feed to compare against.
 * Unsigned builds update fine (electron-updater skips publisher verification when the running exe is
 * unsigned); once a signed build ships, every later build must be signed too.
 */
const { app, ipcMain, dialog } = require('electron');

const CHECK_EVERY_MS = 4 * 3_600_000;
const FIRST_CHECK_MS = 8_000;

let getWindow = () => null;
let autoUpdater = null;
let status = { state: app.isPackaged ? 'idle' : 'disabled', version: null, percent: null, error: null };
let timer = null;

function send(next) {
  status = { ...status, ...next };
  const w = getWindow();
  if (w && !w.isDestroyed()) w.webContents.send('updates:status', status);
}

function setup() {
  if (!app.isPackaged) return null;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return null;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = null;
  autoUpdater.on('checking-for-update', () => send({ state: 'checking', error: null }));
  autoUpdater.on('update-available', (info) => send({ state: 'downloading', version: info && info.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => send({ state: 'current', percent: null }));
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info && info.version, percent: 100 }));
  autoUpdater.on('error', (err) => send({ state: 'error', error: (err && err.message) || String(err) }));
  return autoUpdater;
}

async function check() {
  if (!autoUpdater) return status;
  try { await autoUpdater.checkForUpdates(); } catch (e) { send({ state: 'error', error: (e && e.message) || String(e) }); }
  return status;
}

async function checkInteractive() {
  const win = getWindow() || undefined;
  if (!autoUpdater) {
    await dialog.showMessageBox(win, {
      type: 'info', title: 'Check for updates', message: `BigData ${app.getVersion()}`,
      detail: 'Development build: updates are only checked in installed copies.', buttons: ['OK'],
    });
    return;
  }
  if (status.state === 'ready') {
    const r = await dialog.showMessageBox(win, {
      type: 'info', title: 'Update ready', message: `BigData ${status.version} is ready to install.`,
      detail: 'Restart now to finish the update?', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
    });
    if (r.response === 0) autoUpdater.quitAndInstall(false, true);
    return;
  }
  await check();
  const detail = status.state === 'current' ? 'You have the latest version.'
    : status.state === 'downloading' ? `Downloading BigData ${status.version || ''} in the background. You'll be asked to restart when it's ready.`
    : status.state === 'ready' ? `BigData ${status.version} is ready — restart to install.`
    : status.state === 'error' ? `Could not check for updates: ${status.error}` : 'Checking…';
  await dialog.showMessageBox(win, { type: 'info', title: 'Check for updates', message: `BigData ${app.getVersion()}`, detail, buttons: ['OK'] });
}

function install(opts) {
  getWindow = opts.getWindow;
  setup();
  ipcMain.handle('updates:check', async () => ({ ok: !!autoUpdater, ...(await check()) }));
  ipcMain.handle('updates:get', () => status);
  ipcMain.handle('updates:restart', async () => {
    if (!autoUpdater || status.state !== 'ready') return { ok: false };
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true };
  });
  if (autoUpdater) {
    setTimeout(() => { check().catch(() => {}); }, FIRST_CHECK_MS);
    timer = setInterval(() => { check().catch(() => {}); }, CHECK_EVERY_MS);
  }
}

module.exports = { install, check, checkInteractive };
