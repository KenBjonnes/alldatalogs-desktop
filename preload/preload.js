'use strict';
/*
 * preload.js — the whole surface the sandboxed renderer gets, as window.bigdata.
 *
 * Every function here is a thin IPC call; policy (what may be opened, who is Pro, which URLs may
 * leave the app) is enforced in main, never here. Keep this file boring.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const info = ipcRenderer.sendSync('app:info');

function subscribe(channel, cb) {
  const handler = (_event, data) => cb(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('bigdata', {
  app: { version: info.version, dev: !!info.dev, devPro: !!info.devPro, platform: info.platform },

  // Synchronous window.prompt replacement (see main/prompt.js). Returns string or null.
  promptSync: (message, defaultValue) =>
    ipcRenderer.sendSync('dlg:prompt', {
      message: message == null ? '' : String(message),
      defaultValue: defaultValue == null ? '' : String(defaultValue),
    }),

  files: {
    openDialog: () => ipcRenderer.invoke('files:openDialog'),
    read: (token) => ipcRenderer.invoke('files:read', token),
    recent: () => ipcRenderer.invoke('files:recent'),
    openPath: (p) => ipcRenderer.invoke('files:openPath', p),
    note: (p) => ipcRenderer.invoke('files:note', p),
    pathOf: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch { return ''; } },
    onOpen: (cb) => subscribe('files:open', cb),
    ready: () => ipcRenderer.send('renderer:ready'),
  },

  license: {
    get: () => ipcRenderer.invoke('license:get'),
    refresh: () => ipcRenderer.invoke('license:refresh'),
    online: () => ipcRenderer.send('license:online'),
    onChange: (cb) => subscribe('license:changed', cb),
  },

  auth: {
    signIn: (email, password) => ipcRenderer.invoke('auth:signIn', { email, password }),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
  },

  layouts: {
    pull: () => ipcRenderer.invoke('layouts:pull'),
    push: (entry) => ipcRenderer.invoke('layouts:push', entry),
    remove: (id) => ipcRenderer.invoke('layouts:remove', id),
  },

  library: {
    list: (q) => ipcRenderer.invoke('library:list', q),
    get: (id) => ipcRenderer.invoke('library:get', id),
    publish: (input) => ipcRenderer.invoke('library:publish', input),
    remove: (id) => ipcRenderer.invoke('library:remove', id),
    pull: (id) => ipcRenderer.invoke('library:pull', id),
    me: () => ipcRenderer.invoke('library:me'),
    isAdmin: () => ipcRenderer.invoke('library:isAdmin'),
    admin: {
      setOfficial: (id, value) => ipcRenderer.invoke('library:admin', { action: 'library_official', body: { itemId: id, value } }),
      hide: (id, value) => ipcRenderer.invoke('library:admin', { action: 'library_hide', body: { itemId: id, value } }),
      remove: (id) => ipcRenderer.invoke('library:admin', { action: 'library_delete', body: { itemId: id } }),
    },
  },

  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    get: () => ipcRenderer.invoke('updates:get'),
    restart: () => ipcRenderer.invoke('updates:restart'),
    onStatus: (cb) => subscribe('updates:status', cb),
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
});
