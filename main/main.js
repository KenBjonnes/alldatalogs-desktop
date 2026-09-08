'use strict';
/*
 * main.js — BigData for Windows: Electron main process.
 *
 * The app is the alldatalogs.com viewer engine served from a private bigdata:// scheme (protocol.js),
 * wrapped with the things a browser can't give a tuner: double-click a .hpl, native Open/Save
 * dialogs, a synchronous prompt for naming layouts, auto-update, and a verifiable Pro licence.
 *
 * Security posture: the renderer is sandboxed with context isolation and no Node; everything that
 * touches the disk, the network or secrets lives here and is reached through the small preload API.
 * The renderer never navigates anywhere; https links are handed to the system browser, allow-listed.
 */
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const protocolMod = require('./protocol');
const files = require('./files');
const prompt = require('./prompt');
const license = require('./license');
const supabase = require('./supabase');
const updater = require('./updater');

const DEV = !app.isPackaged;
const EXTERNAL_HOSTS = new Set(['alldatalogs.com', 'www.alldatalogs.com', 'billing.stripe.com', 'checkout.stripe.com', 'github.com']);

protocolMod.registerScheme();

// Dev/test only: isolate all state (session, licence, recents, storage) in another folder.
if (DEV && process.env.BIGDATA_USER_DATA) app.setPath('userData', process.env.BIGDATA_USER_DATA);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv, cwd) => {
    files.queueArgv(argv, cwd);
    focusMain();
  });
  app.setAppUserModelId('com.alldatalogs.bigdata');
  app.whenReady().then(main);
}

let mainWindow = null;

function focusMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function openExternal(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:' || !EXTERNAL_HOSTS.has(u.hostname)) return false;
    shell.openExternal(u.toString());
    return true;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'BigData',
    backgroundColor: '#0a0a0d',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: DEV,
      spellcheck: false,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(protocolMod.ORIGIN + '/')) return; // reload / in-app
    event.preventDefault();
    openExternal(url);
  });
  // A reload (dev) or navigation means queued file opens must wait for the new page's renderer:ready.
  mainWindow.webContents.on('did-start-navigation', (details) => { if (details.isMainFrame) files.rendererReset(); });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('focus', () => license.onWindowFocus());
  mainWindow.loadURL(`${protocolMod.ORIGIN}/index.html`);
}

function showAbout() {
  dialog.showMessageBox(mainWindow || undefined, {
    type: 'info',
    title: 'About BigData',
    message: `BigData ${app.getVersion()}`,
    detail: [
      'Datalog viewer for high-performance vehicles.',
      'by AllDataLogs · alldatalogs.com',
      '',
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}`,
    ].join('\n'),
    buttons: ['OK'],
  });
}

function buildMenu() {
  const template = [
    {
      label: '&File',
      submenu: [
        { label: 'Open log…', accelerator: 'CmdOrCtrl+O', click: () => files.openViaMenu() },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: '&View',
      submenu: [
        ...(DEV ? [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }] : []),
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      ],
    },
    {
      label: '&Account',
      submenu: [
        { label: 'Sign out', click: () => license.signOut() },
      ],
    },
    {
      label: '&Help',
      submenu: [
        { label: 'Check for updates…', click: () => updater.checkInteractive() },
        { label: 'AllDataLogs website', click: () => openExternal('https://alldatalogs.com/') },
        { type: 'separator' },
        { label: 'About BigData', click: showAbout },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function main() {
  protocolMod.installHandler();
  prompt.install();
  supabase.init();
  license.install({ getWindow: () => mainWindow, supabase });
  files.install({ getWindow: () => mainWindow, gate: () => license.openBlockedReason() });
  updater.install({ getWindow: () => mainWindow });

  ipcMain.on('app:info', (event) => {
    event.returnValue = { version: app.getVersion(), dev: DEV, devPro: license.devPro(), platform: process.platform };
  });
  ipcMain.handle('shell:openExternal', (_event, url) => openExternal(url));
  // Cloud layout sync arrives in M3; until then the renderer's best-effort calls resolve quietly.
  ipcMain.handle('layouts:pull', async () => ({ ok: false, reason: 'not_enabled', rows: [] }));
  ipcMain.handle('layouts:push', async () => ({ ok: false, reason: 'not_enabled' }));
  ipcMain.handle('layouts:remove', async () => ({ ok: false, reason: 'not_enabled' }));

  buildMenu();
  createWindow();
  files.queueArgv(process.argv, process.cwd());
}

app.on('window-all-closed', () => app.quit());
