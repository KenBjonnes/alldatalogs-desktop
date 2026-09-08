'use strict';
/*
 * shim.js — must load BEFORE the vendor libs and the viewer engine.
 *
 * 1) window.prompt: Electron does not implement it; the engine needs it to name a layout or a
 *    histogram. Route it through the synchronous modal in main (window.bigdata.promptSync).
 * 2) showToast: runtime.js installs a console fallback only if the host hasn't defined one, so ours
 *    must exist first. The engine calls it for "saved", "copied", "loaded" style feedback.
 * 3) Session prefs mirror: the engine keeps its view-mode / gauge-submode prefs in sessionStorage,
 *    which a browser tab keeps but a desktop app loses at every quit. Mirror it to localStorage on
 *    the way out and restore it at boot, so the app reopens the way it was left. No engine change.
 */
(function () {
  var api = window.bigdata;

  if (api && typeof api.promptSync === 'function') {
    window.prompt = function (message, defaultValue) {
      return api.promptSync(message, defaultValue);
    };
  }

  var toastTimer = null;
  window.showToast = function (msg) {
    var el = document.getElementById('toast');
    if (!el) { try { console.info('[BigData] ' + msg); } catch (e) {} return; }
    el.textContent = String(msg == null ? '' : msg);
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  };

  var MIRROR = 'bigdata.sessionMirror.v1';
  function saveMirror() {
    try {
      var all = {};
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        all[k] = sessionStorage.getItem(k);
      }
      localStorage.setItem(MIRROR, JSON.stringify(all));
    } catch (e) {}
  }
  try {
    if (sessionStorage.length === 0) {
      var raw = localStorage.getItem(MIRROR);
      if (raw) {
        var saved = JSON.parse(raw);
        Object.keys(saved).forEach(function (k) { sessionStorage.setItem(k, saved[k]); });
      }
    }
  } catch (e) {}
  window.addEventListener('beforeunload', saveMirror);
  window.addEventListener('pagehide', saveMirror);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveMirror(); });
})();
