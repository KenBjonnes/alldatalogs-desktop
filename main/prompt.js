'use strict';
/*
 * prompt.js — a synchronous window.prompt() replacement.
 *
 * Electron deliberately does not implement window.prompt, but the viewer engine calls it to name a
 * layout ("Save Layout As…", datalog-viewer.js) and a histogram (datalog-histogram-ui.js). The engine's
 * prompt calls are synchronous, so the shim must be too: the renderer blocks in ipcRenderer.sendSync
 * while main shows a small modal child window and answers with event.returnValue when it closes. The
 * modal window is its own renderer process, so it paints and takes input while the caller waits.
 *
 * Contract (matches window.prompt): resolves to the entered string on OK/Enter, or null on Cancel,
 * Esc, or closing the window. Every exit path answers exactly once, or the caller would hang forever.
 */
const { BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { ORIGIN } = require('./protocol');

const sessions = new Map(); // prompt webContents.id -> { message, defaultValue, finish, win }

function install() {
  ipcMain.on('dlg:prompt', (event, args) => {
    const message = String((args && args.message) || '');
    const defaultValue = args && args.defaultValue != null ? String(args.defaultValue) : '';
    let answered = false;
    const finish = (value) => {
      if (answered) return;
      answered = true;
      try { event.returnValue = value; } catch { /* sender gone */ }
    };
    const parent = BrowserWindow.fromWebContents(event.sender);
    let win;
    try {
      win = new BrowserWindow({
        parent: parent || undefined,
        modal: !!parent,
        show: false,
        width: 460,
        height: 168,
        useContentSize: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        title: 'BigData',
        backgroundColor: '#111114',
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, '..', 'preload', 'prompt-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          devTools: false,
        },
      });
    } catch (e) {
      finish(null);
      return;
    }
    win.setMenuBarVisibility(false);
    const id = win.webContents.id;
    sessions.set(id, { message, defaultValue, finish, win });
    win.on('closed', () => { sessions.delete(id); finish(null); });
    win.once('ready-to-show', () => {
      // A modal child can land behind a parent that is in HTML fullscreen; force it up.
      win.show();
      win.moveTop();
      win.focus();
    });
    win.loadURL(`${ORIGIN}/prompt.html`).catch(() => {
      finish(null);
      try { win.close(); } catch { /* already gone */ }
    });
  });

  ipcMain.on('dlg:prompt:init', (event) => {
    const s = sessions.get(event.sender.id);
    event.returnValue = s ? { message: s.message, defaultValue: s.defaultValue } : { message: '', defaultValue: '' };
  });

  ipcMain.on('dlg:prompt:submit', (event, value) => {
    const s = sessions.get(event.sender.id);
    if (!s) return;
    s.finish(value == null ? null : String(value));
    try { s.win.close(); } catch { /* already closing */ }
  });
}

module.exports = { install };
