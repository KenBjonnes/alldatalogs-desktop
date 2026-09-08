'use strict';
/*
 * updater.js — auto-update via electron-updater against the public GitHub Releases feed.
 *
 * M0 scaffold: wiring lands in M4. Until then "Check for updates" explains itself and the renderer
 * status channel stays quiet. Kept as a module now so main.js and the menu don't change later.
 */
const { app, ipcMain, dialog } = require('electron');

let getWindow = () => null;

function checkInteractive() {
  dialog.showMessageBox(getWindow() || undefined, {
    type: 'info',
    title: 'Check for updates',
    message: `BigData ${app.getVersion()}`,
    detail: app.isPackaged
      ? 'Automatic updates are not enabled in this build yet.'
      : 'Development build: updates are only checked in packaged installs.',
    buttons: ['OK'],
  });
}

function install(opts) {
  getWindow = opts.getWindow;
  ipcMain.handle('updates:check', async () => ({ ok: false, reason: 'not_enabled' }));
  ipcMain.handle('updates:restart', async () => ({ ok: false }));
}

module.exports = { install, checkInteractive };
