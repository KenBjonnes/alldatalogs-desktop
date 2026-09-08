'use strict';
// Preload for the prompt window only: fetch the question, send the answer. Nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptApi', {
  init: () => ipcRenderer.sendSync('dlg:prompt:init'),
  submit: (value) => ipcRenderer.send('dlg:prompt:submit', value),
});
