'use strict';
/*
 * history-core.js -- account history for BigData for Windows: the CommonJS twin of the website's
 * apps/web/lib/history.ts (the phone apps bundle that file; Electron's main process cannot, so the
 * logic is mirrored here -- keep the two in step). Dependency-injected: `sb` is a signed-in
 * supabase-js client, `hash` a function bytes -> sha256 hex, so scripts/.smoke/history-e2e.mjs can
 * drive it against the live project outside Electron.
 *
 * Every log a Pro user opens is saved to the account once (deduplicated by content hash), listed
 * newest-opened first on every host, and re-opened from storage. Auto rows (origin 'auto') are
 * evicted least-recently-opened first when the 1 GiB quota trigger refuses a new one; manual saves
 * never are. Never throws.
 */
const BUCKET = 'datalogs';
const COLS = 'id, name, format, size_bytes, storage_path, created_at, last_opened_at, opens, origin, content_hash';

function rowToHistory(r) {
  return {
    id: r.id, name: r.name, format: r.format, sizeBytes: Number(r.size_bytes) || 0, storagePath: r.storage_path,
    createdAt: r.created_at, lastOpenedAt: r.last_opened_at || r.created_at, opens: Number(r.opens) || 1,
    origin: r.origin === 'auto' ? 'auto' : 'manual', contentHash: r.content_hash || null,
  };
}
function uidPart() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`; }
function safeFileName(name) { return String(name || 'log').replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'log'; }
const isLimitError = (e) => /STORAGE_LIMIT/i.test(`${(e && e.message) || ''} ${(e && e.details) || ''}`);

async function currentUid(sb) {
  try { const { data } = await sb.auth.getUser(); return data && data.user ? data.user.id : null; } catch { return null; }
}

async function listHistory(sb, limit = 60) {
  try {
    if (!sb) return [];
    const { data, error } = await sb.from('saved_logs').select(COLS).order('last_opened_at', { ascending: false }).limit(limit);
    if (error || !data) return [];
    return data.map(rowToHistory);
  } catch { return []; }
}

async function touchOpened(sb, id) {
  try {
    const { data } = await sb.from('saved_logs').select('opens').eq('id', id).maybeSingle();
    const opens = (data && Number(data.opens)) || 0;
    const { error } = await sb.from('saved_logs').update({ last_opened_at: new Date().toISOString(), opens: opens + 1 }).eq('id', id);
    return !error;
  } catch { return false; }
}

/** -> { name, format, buffer: Buffer } | null */
async function openHistory(sb, id) {
  try {
    const { data: row } = await sb.from('saved_logs').select('name, format, storage_path').eq('id', id).maybeSingle();
    if (!row || !row.storage_path) return null;
    const { data: blob, error } = await sb.storage.from(BUCKET).download(row.storage_path);
    if (error || !blob) return null;
    await touchOpened(sb, id);   // counted before the caller lists again
    return { name: row.name, format: row.format, buffer: Buffer.from(await blob.arrayBuffer()) };
  } catch { return null; }
}

async function deleteHistory(sb, id) {
  try {
    const { data: row } = await sb.from('saved_logs').select('storage_path').eq('id', id).maybeSingle();
    if (row && row.storage_path) await sb.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await sb.from('saved_logs').delete().eq('id', id);
    return !error;
  } catch { return false; }
}

async function evictAutoSaved(sb, bytesNeeded) {
  let freed = 0;
  try {
    const { data } = await sb.from('saved_logs').select('id, size_bytes, storage_path').eq('origin', 'auto').order('last_opened_at', { ascending: true }).limit(200);
    for (const r of data || []) {
      if (freed >= bytesNeeded) break;
      if (r.storage_path) await sb.storage.from(BUCKET).remove([r.storage_path]);
      const { error } = await sb.from('saved_logs').delete().eq('id', r.id);
      if (!error) freed += Number(r.size_bytes) || 0;
    }
  } catch { /* whatever was freed */ }
  return freed;
}

/**
 * autoSaveLog(sb, bytes, name, format, { origin, hash }) -> { ok, id, deduped, row } | { ok:false, error, limit?, skipped? }
 * `hash` is the sha256 hex of `bytes` (computed by the caller with node crypto); null = dedupe by name + size.
 */
async function autoSaveLog(sb, bytes, name, format, opts) {
  const origin = opts && opts.origin === 'manual' ? 'manual' : 'auto';
  const hash = opts && opts.hash !== undefined ? opts.hash : null;
  try {
    if (!sb) return { ok: false, error: 'not_connected', skipped: true };
    const uid = await currentUid(sb);
    if (!uid) return { ok: false, error: 'signed_out', skipped: true };
    const u8 = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const size = u8.length;

    let existing = null;
    if (hash) { const { data } = await sb.from('saved_logs').select(COLS).eq('content_hash', hash).maybeSingle(); existing = data || null; }
    if (!existing) {
      const { data } = await sb.from('saved_logs').select(COLS).eq('name', name).eq('size_bytes', size).order('last_opened_at', { ascending: false }).limit(1);
      existing = data && data[0] ? data[0] : null;
    }
    if (existing) {
      const patch = { last_opened_at: new Date().toISOString(), opens: (Number(existing.opens) || 0) + 1 };
      if (origin === 'manual' && existing.origin !== 'manual') patch.origin = 'manual';
      if (hash && !existing.content_hash) patch.content_hash = hash;
      const { data: upd } = await sb.from('saved_logs').update(patch).eq('id', existing.id).select(COLS).maybeSingle();
      return { ok: true, id: existing.id, deduped: true, row: rowToHistory(upd || Object.assign({}, existing, patch)) };
    }

    const storagePath = `${uid}/${uidPart()}-${safeFileName(name)}`;
    const insertRow = { user_id: uid, name: name || 'log', format, size_bytes: size, storage_path: storagePath, origin, content_hash: hash, last_opened_at: new Date().toISOString(), opens: 1 };
    let ins = await sb.from('saved_logs').insert(insertRow).select(COLS).single();
    if (ins.error && isLimitError(ins.error)) {
      const freed = await evictAutoSaved(sb, size);
      if (freed > 0) ins = await sb.from('saved_logs').insert(insertRow).select(COLS).single();
    }
    if (ins.error || !ins.data) {
      const limit = !!ins.error && isLimitError(ins.error);
      return { ok: false, limit, error: limit ? 'limit' : ((ins.error && ins.error.message) || 'Could not save.') };
    }
    const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, u8, { contentType: 'application/octet-stream', upsert: false });
    if (upErr) {
      await sb.from('saved_logs').delete().eq('id', ins.data.id);
      return { ok: false, error: upErr.message || 'Upload failed.' };
    }
    return { ok: true, id: ins.data.id, deduped: false, row: rowToHistory(ins.data) };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Could not save.' };
  }
}

/** Account rows first (newest opened), then local recents that are not already in the account. */
function mergeHistory(cloud, local) {
  const out = (cloud || []).map((row) => ({ kind: 'cloud', row }));
  const seen = new Set((cloud || []).map((c) => String(c.name || '').toLowerCase() + '|' + (c.sizeBytes || 0)));
  for (const r of local || []) {
    if (seen.has(String(r.name || '').toLowerCase() + '|' + (r.size || 0))) continue;
    out.push({ kind: 'local', row: r });
  }
  return out;
}

module.exports = { listHistory, touchOpened, openHistory, deleteHistory, evictAutoSaved, autoSaveLog, mergeHistory, rowToHistory, safeFileName, BUCKET };
