'use strict';
// Minimal Electron main used only by make-icon.mjs: one transparent window Playwright can render into.
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 256, height: 256, show: false, transparent: true, frame: false, webPreferences: { sandbox: true } });
  win.loadURL('about:blank');
});
app.on('window-all-closed', () => app.quit());
