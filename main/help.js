'use strict';
/*
 * help.js — the Help window.
 *
 * A normal Windows help viewer: its own resizable window with its own title, opened from the Help menu
 * or F1, reused rather than stacked if it is already open, and closed with Escape or Ctrl+W. It loads
 * renderer/help.html over the app's own scheme, so the manual works with no log open, no sign-in and
 * no connection, and it always documents the build it shipped with.
 *
 * It gets the same preload as the main window purely so the page can read the version number; nothing
 * in the manual touches the disk or the network.
 */
const { BrowserWindow, shell } = require('electron');
const path = require('node:path');
const protocolMod = require('./protocol');

let win = null;
let getParent = () => null;

/** open('changelog') jumps straight to What's new; open() lands on the contents. */
function open(topic) {
  if (win && !win.isDestroyed()) {
    if (topic) win.loadURL(url(topic));
    if (win.isMinimized()) win.restore();
    win.focus();
    return win;
  }
  const parent = getParent();
  win = new BrowserWindow({
    width: 1040,
    height: 780,
    minWidth: 560,
    minHeight: 420,
    show: false,
    title: 'BigData Help',
    backgroundColor: '#0b0b0e',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    // Deliberately NOT a child window and not modal: you keep it open beside the app and switch
    // between them, which is the whole point of built-in help.
    parent: undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  // Escape and Ctrl+W close it, like a dialog; nothing else in the manual takes those keys.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const esc = input.key === 'Escape';
    const ctrlW = (input.control || input.meta) && String(input.key).toLowerCase() === 'w';
    if (esc || ctrlW) { event.preventDefault(); if (win && !win.isDestroyed()) win.close(); }
  });
  // Any external link opens in the real browser, never inside the help window.
  win.webContents.setWindowOpenHandler(({ url: u }) => { external(u); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, u) => {
    if (u.startsWith(protocolMod.ORIGIN + '/')) return;
    event.preventDefault();
    external(u);
  });
  if (parent && !parent.isDestroyed()) {
    // Offset a little from the main window so it is obviously a second window, and stay on screen.
    const b = parent.getBounds();
    win.setBounds({
      x: Math.max(0, b.x + 60), y: Math.max(0, b.y + 50),
      width: win.getBounds().width, height: win.getBounds().height,
    });
  }
  win.loadURL(url(topic));
  return win;
}

function url(topic) {
  return protocolMod.ORIGIN + '/help.html' + (topic ? '?topic=' + encodeURIComponent(topic) : '');
}

function external(u) {
  if (/^https?:\/\//i.test(u || '')) shell.openExternal(u).catch(() => {});
}

function install(opts) {
  getParent = (opts && opts.getWindow) || (() => null);
  // The home screen's Help button. Only a topic id crosses the wire, and an unknown one just lands on
  // the contents page, so there is nothing here for a renderer bug to abuse.
  const { ipcMain } = require('electron');
  ipcMain.handle('help:open', (_e, topic) => {
    const t = typeof topic === 'string' && /^[a-z0-9-]{1,40}$/.test(topic) ? topic : '';
    open(t);
    return { ok: true };
  });
}

module.exports = { install, open };
