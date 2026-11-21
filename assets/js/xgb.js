/* Prediktor XGBoost di browser: menjalankan 24 model direct (XGBoost tanpa cuaca, final BAB II)
   yang diekspor oleh scripts/build_data.py (data/xgb_model.json + data/xgb_model.bin.gz). */
"use strict";
const XGB = (() => {
  let M = null;                                       // { meta, conds, lefts, feats, offsets:{h:[start per tree]} }

  async function fetchBin(url, onProgress) {
    const res = await fetch(url); if (!res.ok) throw new Error("model tidak ditemukan");
    const total = +res.headers.get("content-length") || 0, reader = res.body.getReader(), chunks = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; if (onProgress && total) onProgress(got / total); }
    let buf = new Uint8Array(got), o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
    if (buf[0] === 0x1f && buf[1] === 0x8b) {          // gzip -> dekompresi di browser
      const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
      buf = new Uint8Array(await new Response(ds).arrayBuffer());
    }
    return buf.buffer;
  }

  async function load(onProgress) {
    if (M) return M;
    const meta = await fetch("data/xgb_model.json").then(r => r.json());
    const buf = await fetchBin("data/xgb_model.bin.gz", onProgress);
    const N = meta.n_nodes;
    const conds = new Float32Array(buf, 0, N), lefts = new Int16Array(buf, 4 * N, N), feats = new Uint8Array(buf, 6 * N, N);
    const offsets = {}; let pos = 0;
    for (let h = 1; h <= 24; h++) { offsets[h] = meta.trees[h].sizes.map(s => { const st = pos; pos += s; return st; }); }
    M = { meta, conds, lefts, feats, offsets };
    return M;
  }

  function predictOne(h, x) {                          // x: Float32-kompatibel array fitur (urutan meta.features)
    const { conds, lefts, feats, offsets, meta } = M; let sum = 0;
    const xf = Float32Array.from(x);
    for (const off of offsets[h]) {
      let n = 0;
      for (;;) {
        const l = lefts[off + n]; if (l === -1) { sum += conds[off + n]; break; }
        const f = feats[off + n], v = xf[f & 127];
        n = Number.isNaN(v) ? ((f & 128) ? l : l + 1) : (v < conds[off + n] ? l : l + 1);
      }
    }
    const st = meta.stats[h];
    return (meta.trees[h].base + sum) * st.sd + st.mu;
  }

  function calendar(d, holiday, school) {               // fitur kalender pada waktu target (sama dengan notebook)
    const hour = d.getHours(), dow = (d.getDay() + 6) % 7, month = d.getMonth();
    const doy = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5);
    const P = 2 * Math.PI;
    return { hour_sin: Math.sin(P * hour / 24), hour_cos: Math.cos(P * hour / 24), dow_sin: Math.sin(P * dow / 7), dow_cos: Math.cos(P * dow / 7),
      doy_sin: Math.sin(P * doy / 365.25), doy_cos: Math.cos(P * doy / 365.25), month_sin: Math.sin(P * month / 12), month_cos: Math.cos(P * month / 12),
      weekend: dow >= 5 ? 1 : 0, holiday, school };
  }

  /* y: array beban per jam berurutan, elemen terakhir = origin t (waktu `lastTime`, Date). */
  function forecast(y, lastTime, holiday = 0, school = 0) {
    const { meta } = M, n = y.length, t = n - 1, out = [];
    if (n < 168) throw new Error("butuh minimal 168 jam data");
    for (let h = 1; h <= 24; h++) {
      const f = {};
      meta.lags.forEach(k => f[`lag_${k}`] = y[t - k + 1]);
      meta.tgt_lags.forEach(k => f[`tlag_${k}`] = y[t + h - k]);
      const when = new Date(lastTime.getTime() + h * 3600e3);
      Object.assign(f, calendar(when, holiday, school));
      out.push({ time: when, h, value: predictOne(h, meta.features.map(c => f[c])) });
    }
    return out;
  }
  return { load, forecast, get meta() { return M && M.meta; } };
})();
