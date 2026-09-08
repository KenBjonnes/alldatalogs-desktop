'use strict';
/*
 * protocol.js — the bigdata:// scheme that serves renderer/ and payload/ to the window.
 *
 * Why a custom scheme instead of file://: a "standard, secure" scheme gives the page a stable origin
 * (bigdata://app), so the engine's localStorage/sessionStorage keys persist, the classic parse worker
 * can importScripts('/vendor/pako.min.js') by absolute path exactly as on the website, blob: downloads
 * and CSP behave like https, and file:// quirks never apply.
 *
 * The handler strips query strings (script tags carry ?v=<version> so the engine can display the
 * build), refuses path traversal, and sets Content-Type by extension: Chromium refuses to run a worker
 * script served without a JavaScript type.
 */
const { protocol, net, app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const SCHEME = 'bigdata';
const HOST = 'app';
const ORIGIN = `${SCHEME}://${HOST}`;
// renderer/ first so an accidental payload file can't shadow the app pages.
const ROOTS = [path.join(__dirname, '..', 'renderer'), path.join(__dirname, '..', 'payload')];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function registerScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  }]);
}

// Map a URL path to a file under one of ROOTS, or null. Only plain descending paths are allowed.
function resolveLocal(urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath || '/'); } catch { return null; }
  if (rel === '/' || rel === '') rel = '/index.html';
  const parts = rel.split('/').filter(Boolean);
  if (parts.some((p) => p === '..' || p === '.' || p.includes('\\'))) return null;
  for (const root of ROOTS) {
    const abs = path.join(root, ...parts);
    if (!abs.startsWith(root + path.sep)) continue;
    try { if (fs.statSync(abs).isFile()) return abs; } catch { /* try next root */ }
  }
  return null;
}

function installHandler() {
  protocol.handle(SCHEME, async (request) => {
    let url;
    try { url = new URL(request.url); } catch { return new Response('Bad request', { status: 400 }); }
    if (url.host !== HOST) return new Response('Not found', { status: 404 });
    const abs = resolveLocal(url.pathname);
    if (!abs) return new Response('Not found', { status: 404 });
    const ext = path.extname(abs).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
    if (ext === '.html') {
      // Pages carry __APP_VERSION__ on their script URLs so the engine's VIEWER_VERSION shows the build.
      const html = fs.readFileSync(abs, 'utf8').split('__APP_VERSION__').join(app.getVersion());
      return new Response(html, { status: 200, headers });
    }
    const res = await net.fetch(pathToFileURL(abs).toString());
    return new Response(res.body, { status: 200, headers });
  });
}

module.exports = { registerScheme, installHandler, resolveLocal, ORIGIN, SCHEME };
