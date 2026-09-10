'use strict';
/*
 * help.js — mounts the manual in the Help window.
 *
 * The window's own chrome is the title bar and the menu, like any Windows help viewer, so the reader
 * is mounted WITHOUT a close button of its own; Escape and Ctrl+W close the window (main/help.js).
 * `?topic=` on the URL is how the menu opens a specific page ("What's new" goes straight there).
 */
(function () {
  var host = document.getElementById('help');
  if (!host || !window.DatalogHelp) {
    if (host) host.textContent = 'The manual could not be loaded. Please reinstall BigData.';
    return;
  }
  var params = {};
  try {
    (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
  } catch (e) { /* no query */ }

  var version = '';
  try { version = (window.bigdata && window.bigdata.app && window.bigdata.app.version) || ''; } catch (e) { /* no preload */ }

  // Escape and Ctrl+W close the window. Main also watches the native key stream (main/help.js); this
  // page-side handler is what closes it when the key arrives through the page instead, and it keeps
  // the reader's own in-page close button off, because this window already has a title bar.
  document.addEventListener('keydown', function (e) {
    var ctrlW = (e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'w';
    if (e.key === 'Escape' || ctrlW) { e.preventDefault(); try { window.close(); } catch (err) { /* ignore */ } }
  });

  window.__help = window.DatalogHelp.mount(host, {
    version: version,
    start: params.topic || 'getting-started',
  });
  document.title = 'BigData Help';
})();
