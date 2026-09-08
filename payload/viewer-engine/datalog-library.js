'use strict';
/*
 * datalog-library.js -- the shared library (browse / use / share) for custom-gauge dashboards and
 * histogram definitions. Ken, 2026-09-08: "a library of gauges and histograms ... labeled as our
 * official one ... if a user shares one it will be marked as a user share ... a thumbnail to show
 * what it looks like."
 *
 * Host-agnostic on purpose: this file talks only to the async provider a host installs at
 * window.DATAVIEWER.library (runtime.js carries it) and to the callbacks a caller passes in. On a
 * host with no provider, Library.available() is false and every entry point stays hidden.
 *
 * Provider contract (every method returns a Promise):
 *   list({kind, q, official, mine, page, pageSize}) -> { items: [summary...], hasMore }
 *   get(id)            -> full item (summary + payload) | null
 *   publish({kind, name, description, vehicle, tags, payload, thumb_svg}) -> { ok, item } | { ok:false, error }
 *   remove(id)         -> { ok } | { ok:false, error }        (the caller's own items)
 *   pull(id)                                                  (use counter, best effort)
 *   me()               -> { userId, email } | null
 *   isAdmin()          -> boolean
 *   admin: { setOfficial(id, bool), hide(id, bool), remove(id) }  (each -> { ok } | { ok:false, error })
 * Summary: { id, kind:'gauges'|'histogram', name, description, owner_id, author_name, is_official,
 *            status:'published'|'hidden', thumb_svg, vehicle, tags, pulls, updated_at }
 *
 * Thumbnails are SVG strings other users generated (via gaugesThumbnailSvg / HistogramUI.thumbnailSvg).
 * They are shown through <img src="data:image/svg+xml,..."> and never inlined into the DOM: an image
 * cannot run script or fetch anything, so a hostile thumbnail is at worst an ugly picture.
 *
 * Load order: after datalog-histogram-editor.js and before datalog-viewer.js (the viewer references
 * window.Library lazily, guarded by typeof).
 */
(function (global) {
  var KINDS = { gauges: 'Gauge dashboards', histogram: 'Histograms' };
  var PAGE = 30;
  var state = { ovl: null };

  function provider() {
    var d = global.DATAVIEWER;
    return d && d.library && typeof d.library.list === 'function' ? d.library : null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(msg) { if (typeof global.showToast === 'function') global.showToast(msg); }
  function isPro() { return typeof global.viewerIsPro === 'function' ? !!global.viewerIsPro() : !!(global.DATAVIEWER && global.DATAVIEWER.isPro === true); }
  var PRO_MSG = 'Activate Pro to use and share library items';
  function plural(n, s) { return n + ' ' + s + (n === 1 ? '' : 's'); }

  function close() {
    if (state.ovl) { state.ovl.remove(); state.ovl = null; }
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function thumbHtml(svg) {
    var s = String(svg || '').trim();
    if (!/^<svg[\s>]/i.test(s) || s.length > 60000) return '<div class="dlv-lib-thumb dlv-lib-thumb-empty">No preview</div>';
    return '<img class="dlv-lib-thumb" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) + '">';
  }
  function headHtml(kicker, title, tabsHtml) {
    return '<div class="dlv-lib-head"><div class="dlv-lib-title"><span class="dlv-lib-kicker">' + esc(kicker) + '</span><b>' + esc(title) + '</b></div>' +
      (tabsHtml || '') + '<button type="button" class="dlv-lib-x" title="Close">&times;</button></div>';
  }
  function mount(html) {
    close();
    var ovl = document.createElement('div');
    ovl.className = 'dlv-lib-ovl';
    ovl.innerHTML = html;
    document.body.appendChild(ovl);
    state.ovl = ovl;
    ovl.addEventListener('click', function (e) { if (e.target === ovl) close(); });
    ovl.querySelector('.dlv-lib-x').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return ovl;
  }

  // ---- Browse ------------------------------------------------------------------------------------
  // opts: { kind: 'gauges'|'histogram', onUse(item) }  onUse receives the FULL item (with payload).
  function open(opts) {
    opts = opts || {};
    var p = provider();
    if (!p) { toast('The library is not available on this page.'); return; }
    var st = { kind: opts.kind === 'histogram' ? 'histogram' : 'gauges', q: '', filter: 'all', page: 0, items: [], hasMore: false, busy: false, me: null, admin: false, seq: 0 };
    var tabs = '<div class="dlv-lib-tabs">' + Object.keys(KINDS).map(function (k) {
      return '<button type="button" data-kind="' + k + '"' + (k === st.kind ? ' class="on"' : '') + '>' + esc(KINDS[k]) + '</button>';
    }).join('') + '</div>';
    var ovl = mount('<div class="dlv-lib" role="dialog" aria-label="Shared library">' +
      headHtml('Shared library', KINDS[st.kind], tabs) +
      '<div class="dlv-lib-bar"><input type="text" class="dlv-lib-search" placeholder="Search by name, car or author…" spellcheck="false">' +
        '<div class="dlv-lib-filters"><button type="button" data-filter="all" class="on">All</button><button type="button" data-filter="official">Official</button><button type="button" data-filter="mine">Mine</button></div></div>' +
      '<div class="dlv-lib-body"><div class="dlv-lib-grid"></div><div class="dlv-lib-foot"></div></div></div>');
    var grid = ovl.querySelector('.dlv-lib-grid'), foot = ovl.querySelector('.dlv-lib-foot'), search = ovl.querySelector('.dlv-lib-search');
    var titleEl = ovl.querySelector('.dlv-lib-title b');

    function card(it) {
      var mine = !!(st.me && it.owner_id === st.me.userId);
      var badge = it.is_official ? '<span class="dlv-lib-badge official">Official</span>' : '<span class="dlv-lib-badge user">User share</span>';
      var acts = '<button type="button" class="dlv-hg-btn primary sm' + (isPro() ? '' : ' dlv-pro-locked') + '" data-act="use">Use</button>';
      if (mine) acts += '<button type="button" class="dlv-hg-btn sm danger" data-act="remove">Remove</button>';
      if (st.admin) {
        acts += '<button type="button" class="dlv-hg-btn sm" data-act="official">' + (it.is_official ? 'Unmark official' : 'Mark official') + '</button>' +
          '<button type="button" class="dlv-hg-btn sm" data-act="hide">' + (it.status === 'hidden' ? 'Unhide' : 'Hide') + '</button>' +
          (mine ? '' : '<button type="button" class="dlv-hg-btn sm danger" data-act="admin-remove">Remove</button>');
      }
      return '<div class="dlv-lib-card' + (it.status === 'hidden' ? ' is-hidden' : '') + '" data-id="' + esc(it.id) + '">' + thumbHtml(it.thumb_svg) +
        '<div class="dlv-lib-card-body">' +
          '<div class="dlv-lib-card-name" title="' + esc(it.name) + '">' + esc(it.name) + (it.status === 'hidden' ? ' <span class="dlv-lib-hiddenmark">(hidden)</span>' : '') + '</div>' +
          '<div class="dlv-lib-card-meta">' + badge + '<span>' + esc(it.author_name || 'AllDataLogs') + '</span>' +
            (it.vehicle ? '<span>&middot; ' + esc(it.vehicle) + '</span>' : '') + '<span>&middot; ' + plural(it.pulls | 0, 'use') + '</span></div>' +
          (it.description ? '<div class="dlv-lib-card-desc">' + esc(it.description) + '</div>' : '') +
          '<div class="dlv-lib-card-acts">' + acts + '</div>' +
        '</div></div>';
    }
    function render() {
      grid.innerHTML = st.items.map(card).join('');
      if (st.busy) foot.innerHTML = '<span class="dlv-lib-faint">Loading…</span>';
      else if (!st.items.length) foot.innerHTML = '<span class="dlv-lib-faint">' + (st.filter === 'mine' ? 'You have not shared anything yet.' : st.q ? 'Nothing matches that search.' : 'Nothing here yet — be the first to share one.') + '</span>';
      else foot.innerHTML = st.hasMore ? '<button type="button" class="dlv-hg-btn sm" data-more="1">Load more</button>' : '<span class="dlv-lib-faint">' + plural(st.items.length, 'item') + '</span>';
    }
    function load(reset) {
      if (reset) { st.page = 0; st.items = []; st.hasMore = false; }
      var seq = ++st.seq;
      st.busy = true; render();
      var q = { kind: st.kind, q: st.q, official: st.filter === 'official', mine: st.filter === 'mine', page: st.page, pageSize: PAGE };
      Promise.resolve().then(function () { return p.list(q); }).then(function (r) {
        if (seq !== st.seq || !state.ovl) return;
        var items = (r && r.items) || [];
        st.items = st.items.concat(items); st.hasMore = !!(r && r.hasMore); st.busy = false;
        render();
        if (r && r.error) toast('Library: ' + r.error);
      }).catch(function (e) {
        if (seq !== st.seq || !state.ovl) return;
        st.busy = false; render(); toast('Could not load the library: ' + (e && e.message ? e.message : e));
      });
    }
    function reloadKeep() { load(true); }

    ovl.querySelectorAll('[data-kind]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.kind = b.getAttribute('data-kind');
        ovl.querySelectorAll('[data-kind]').forEach(function (x) { x.classList.toggle('on', x === b); });
        titleEl.textContent = KINDS[st.kind];
        load(true);
      });
    });
    ovl.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.filter = b.getAttribute('data-filter');
        ovl.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.toggle('on', x === b); });
        load(true);
      });
    });
    var debounce = null;
    search.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { st.q = search.value.trim(); load(true); }, 220);
    });
    foot.addEventListener('click', function (e) {
      var more = e.target.closest && e.target.closest('[data-more]');
      if (more) { st.page++; load(false); }
    });
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-act]');
      if (!btn) return;
      var cardEl = btn.closest('.dlv-lib-card'), id = cardEl && cardEl.getAttribute('data-id');
      var it = null;
      for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) { it = st.items[i]; break; }
      if (!it) return;
      var act = btn.getAttribute('data-act');
      if (act === 'use') {
        if (!isPro()) { toast(PRO_MSG); return; }
        btn.disabled = true;
        Promise.resolve().then(function () { return p.get(it.id); }).then(function (full) {
          if (!full || !full.payload) { btn.disabled = false; toast('That item is no longer available.'); return; }
          try { p.pull(it.id); } catch (err) { /* counter only */ }
          close();
          if (typeof opts.onUse === 'function') opts.onUse(full);
        }).catch(function (err) { btn.disabled = false; toast('Could not load that item: ' + (err && err.message ? err.message : err)); });
        return;
      }
      if (act === 'remove' || act === 'admin-remove') {
        if (!global.confirm('Remove "' + it.name + '" from the library? This cannot be undone.')) return;
        var rm = act === 'remove' ? p.remove(it.id) : p.admin.remove(it.id);
        Promise.resolve(rm).then(function (r) { if (r && r.ok === false) toast(r.error || 'Could not remove.'); else toast('Removed.'); reloadKeep(); });
        return;
      }
      if (act === 'official') {
        Promise.resolve(p.admin.setOfficial(it.id, !it.is_official)).then(function (r) { if (r && r.ok === false) toast(r.error || 'Could not update.'); reloadKeep(); });
        return;
      }
      if (act === 'hide') {
        Promise.resolve(p.admin.hide(it.id, it.status !== 'hidden')).then(function (r) { if (r && r.ok === false) toast(r.error || 'Could not update.'); reloadKeep(); });
      }
    });

    Promise.all([
      Promise.resolve().then(function () { return p.me(); }).catch(function () { return null; }),
      Promise.resolve().then(function () { return typeof p.isAdmin === 'function' ? p.isAdmin() : false; }).catch(function () { return false; })
    ]).then(function (r) {
      st.me = r[0] || null; st.admin = !!r[1];
      if (state.ovl === ovl) load(true);
    });
    load(true);
    search.focus();
  }

  // ---- Share -------------------------------------------------------------------------------------
  // opts: { kind, name, description, vehicle, payload, thumbSvg, onDone(item) }
  function share(opts) {
    opts = opts || {};
    var p = provider();
    if (!p) { toast('The library is not available on this page.'); return; }
    if (!isPro()) { toast(PRO_MSG); return; }
    var kind = opts.kind === 'histogram' ? 'histogram' : 'gauges';
    var ovl = mount('<div class="dlv-lib dlv-lib-share" role="dialog" aria-label="Share to the library">' +
      headHtml('Share to the library', KINDS[kind]) +
      '<div class="dlv-lib-share-body">' + thumbHtml(opts.thumbSvg) +
        '<label>Name<input type="text" class="dlv-lib-in" data-f="name" maxlength="120" value="' + esc(opts.name || '') + '"></label>' +
        '<label>Description<textarea class="dlv-lib-in" data-f="description" rows="3" maxlength="2000" placeholder="What is it for, what does it show, what to look for…">' + esc(opts.description || '') + '</textarea></label>' +
        '<label>Car (optional)<input type="text" class="dlv-lib-in" data-f="vehicle" maxlength="120" placeholder="e.g. 2020 Mustang GT 5.0, Gen 3 Coyote" value="' + esc(opts.vehicle || '') + '"></label>' +
        '<div class="dlv-lib-note">Shared items are public and appear right away, marked as a User share. Your account name is shown as the author.</div>' +
        '<div class="dlv-lib-share-acts"><button type="button" class="dlv-hg-btn" data-act="cancel">Cancel</button><button type="button" class="dlv-hg-btn primary" data-act="share">Share</button></div>' +
      '</div></div>');
    var val = function (f) { var el = ovl.querySelector('[data-f="' + f + '"]'); return el ? String(el.value || '').trim() : ''; };
    ovl.querySelector('[data-act="cancel"]').addEventListener('click', close);
    var shareBtn = ovl.querySelector('[data-act="share"]');
    shareBtn.addEventListener('click', function () {
      var name = val('name');
      if (!name) { toast('Give it a name first.'); ovl.querySelector('[data-f="name"]').focus(); return; }
      shareBtn.disabled = true; shareBtn.textContent = 'Sharing…';
      Promise.resolve().then(function () {
        return p.publish({ kind: kind, name: name, description: val('description'), vehicle: val('vehicle'), tags: [], payload: opts.payload, thumb_svg: opts.thumbSvg || null });
      }).then(function (r) {
        if (!r || r.ok === false) { shareBtn.disabled = false; shareBtn.textContent = 'Share'; toast((r && r.error) || 'Could not share that.'); return; }
        close();
        toast('Shared "' + name + '" to the library.');
        if (typeof opts.onDone === 'function') opts.onDone(r.item || null);
      }).catch(function (e) { shareBtn.disabled = false; shareBtn.textContent = 'Share'; toast('Could not share: ' + (e && e.message ? e.message : e)); });
    });
    var nameIn = ovl.querySelector('[data-f="name"]');
    nameIn.focus(); nameIn.select();
  }

  global.Library = {
    available: function () { return !!provider(); },
    open: open,
    share: share,
    close: close
  };
})(typeof window !== 'undefined' ? window : globalThis);
