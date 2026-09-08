/*
 * parse-worker.js — decodes a datalog (CSV / HP Tuners HPL / MoTeC LD / Holley DL) off the main
 * thread so the loader UI stays responsive and a long or hung parse can be cancelled by the page
 * calling worker.terminate(). Loads the same decoder bundle the page uses (dvcore.js) plus pako for
 * HPL inflate. Worker-safe: dvcore.js references no window/document. Classic worker (importScripts)
 * so it needs no bundler and works from the static export.
 */
/* global importScripts, DVCore, pako */
importScripts('/vendor/pako.min.js', '/viewer-engine/dvcore.js');

self.onmessage = async (e) => {
  const data = e.data || {};
  const jobId = data.jobId;
  try {
    const ab = data.buffer || (data.file ? await data.file.arrayBuffer() : null);
    if (!ab) throw new Error('No file data received.');
    const bytes = new Uint8Array(ab);
    let csvText;
    if (data.fmt === 'HPL') {
      csvText = DVCore.convertHplToCsv(bytes, (d) => pako.inflateRaw(d), { interpolate: true, usUnits: true });
    } else if (data.fmt === 'MoTeC') {
      csvText = DVCore.convertLdToCsv(bytes);
    } else if (data.fmt === 'Holley') {
      csvText = DVCore.convertHolleyDlToCsv(bytes);
    } else {
      csvText = new TextDecoder().decode(bytes);
    }
    const parsed = DVCore.parseDatalogCsv(csvText);
    // Only the parse result crosses back. The CSV text used to ride along too, but nothing on the
    // page reads it (OpenLog.tsx onWorkerMessage uses `parsed` alone) and structured-cloning it
    // would double the transfer -- ~500 MB extra at the 250 MB file cap.
    self.postMessage({ jobId: jobId, ok: true, parsed: parsed });
  } catch (err) {
    self.postMessage({ jobId: jobId, ok: false, error: (err && err.message) ? err.message : String(err) });
  }
};
