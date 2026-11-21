/* PANAMA POWER ANALYTICS — dashboard statis (GitHub Pages).
   Semua angka dibaca dari ./data/*.json yang dibangun scripts/build_data.py dari hasil penelitian. */
"use strict";

const C = { navy: "#1e3a8a", cyan: "#0891b2", orange: "#f59e0b", violet: "#7c3aed", green: "#059669", red: "#e11d48", muted: "#64748b", ink: "#0f1f3d", text: "#334155", grid: "#e9eef5" };
const MODEL_COLOR = { SARIMAX: "#2563eb", XGBoost: "#f59e0b", TimesFM: "#7c3aed", "Naive-24": "#94a3b8", "Naive-168": "#cbd5e1" };
const SC_LABEL = { A: "Tanpa cuaca", B: "Dengan prediksi cuaca", C: "Dengan cuaca sebenarnya (pembanding)", "-": "Pembanding sederhana" };
const SC_SHORT = { A: "tanpa cuaca", B: "prediksi cuaca", C: "cuaca sebenarnya", "-": "" };
const SET_LABEL = { train_rolling: "Data latih", validation: "2019", test: "2020", test_pra: "2020 sebelum COVID", test_penurunan: "2020 saat COVID" };
const LOC = { toc: "Tocumen", san: "Santiago", dav: "David" };
const LOC_COLOR = { toc: "#0891b2", san: "#7c3aed", dav: "#f59e0b" };
const BASE_NAME = { T2M: "Suhu", QV2M: "Kelembapan", TQL: "Hujan", W2M: "Kecepatan angin" };
const DOW = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HOURS = [...Array(24).keys()].map(h => `${String(h).padStart(2, "0")}:00`);
const D = {}, inited = {};

/* ---------------- util ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x)) ? "—" : Number(x).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const load = async name => D[name] ?? (D[name] = await fetch(`data/${name}.json`).then(r => { if (!r.ok) throw new Error(name); return r.json(); }));
const parseT = s => new Date(s.replace(" ", "T"));
const tstr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
const nice = s => { const d = parseT(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:00`; };
const hourSeq = (start, n, stepH = 1) => { const t0 = parseT(start).getTime(); return Array.from({ length: n }, (_, i) => new Date(t0 + i * stepH * 3600e3)); };
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const argmax = a => a.reduce((b, v, i) => v > a[b] ? i : b, 0);
const argmin = a => a.reduce((b, v, i) => v < a[b] ? i : b, 0);
const varName = v => { const [b, l] = v.split("_"); return `${BASE_NAME[b] || b} ${LOC[l] || l}`; };
const ax = (extra = {}) => Object.assign({ gridcolor: C.grid, zerolinecolor: "#cbd5e1", linecolor: "#cbd5e1" }, extra);

const baseLayout = (extra = {}) => {
  const L = Object.assign({
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { family: "Inter, sans-serif", color: C.text, size: 12 },
    margin: { l: 56, r: 18, t: 18, b: 44 }, hovermode: "x unified",
    hoverlabel: { bgcolor: "#fff", bordercolor: C.cyan, font: { color: C.ink } },
    legend: { orientation: "h", y: 1.12, x: 0, bgcolor: "rgba(0,0,0,0)" },
    transition: { duration: 450, easing: "cubic-in-out" },
  }, extra);
  L.xaxis = ax(extra.xaxis); L.yaxis = ax(extra.yaxis);
  return L;
};
const cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] };
function plot(id, traces, layout) {
  const el = document.getElementById(id);
  el.classList.remove("skeleton"); el.classList.add("fade-swap"); setTimeout(() => el.classList.remove("fade-swap"), 450);
  return Plotly.react(el, traces, baseLayout(layout), cfg);
}
function kpiCard(icon, label, value, unit = "", note = "", cls = "", col = "col-6 col-md-4 col-xl") {
  const isNum = typeof value === "number";
  return `<div class="${col}"><div class="card-x kpi ${cls}"><div class="label"><i class="bi ${icon}"></i>${label}</div>
    <div class="value" ${!isNum && String(value).length > 9 ? 'style="font-size:17px"' : ""}><span class="count" data-v="${isNum ? value : ""}">${isNum ? "0" : value}</span>${unit ? `<small>${unit}</small>` : ""}</div>
    <div class="note">${note}</div></div></div>`;
}
function animateCounters(root) {
  root.querySelectorAll(".count[data-v]").forEach(el => {
    const v = parseFloat(el.dataset.v); if (Number.isNaN(v)) return;
    const dec = v % 1 === 0 ? 0 : Math.abs(v) < 10 ? 2 : Math.abs(v) < 1000 ? 1 : 0;
    const t0 = performance.now(), dur = 1000;
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(v * e, dec); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function table(id, cols, rows, opts = {}) {
  const head = `<thead><tr>${cols.map(c => `<th class="${c.left ? "tl" : ""}">${c.label}</th>`).join("")}</tr></thead>`;
  const body = rows.map(r => `<tr>${cols.map(c => {
    const v = typeof c.get === "function" ? c.get(r) : r[c.key];
    return `<td class="${c.left ? "tl" : ""} ${opts.best && opts.best(r, c) ? "best" : ""}">${typeof v === "number" ? fmt(v, c.d ?? 2) : (v ?? "—")}</td>`;
  }).join("")}</tr>`).join("");
  document.getElementById(id).innerHTML = head + `<tbody>${body}</tbody>`;
}
const renderMath = el => window.renderMathInElement && renderMathInElement(el, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }], throwOnError: false });
const download = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); };

/* ---------------- router ---------------- */
const PAGES = { beranda: initHome, eksplorasi: initExploration, cuaca: initWeather, performa: initPerformance, "cara-kerja": initExplanation, prediksi: initForecast, simulasi: initSimulation };
async function route() {
  const page = (location.hash || "#beranda").slice(1);
  const key = PAGES[page] ? page : (page === "coba" ? "prediksi" : "beranda");
  $$(".page").forEach(p => p.classList.remove("show"));
  $(`#page-${key}`).classList.add("show");
  $$("#nav .nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === key));
  const nc = $("#navMain"); if (nc.classList.contains("show")) bootstrap.Collapse.getOrCreateInstance(nc).hide();
  if (page !== "coba") window.scrollTo({ top: 0, behavior: "smooth" });
  if (!inited[key]) {
    inited[key] = true;
    try { await PAGES[key](); } catch (e) { console.error(e); $(`#page-${key}`).insertAdjacentHTML("beforeend", `<div class="callout mt-3">Data untuk bagian ini belum tersedia.</div>`); }
  } else { $$(`#page-${key} .js-plotly-plot`).forEach(el => Plotly.Plots.resize(el)); }
  if (page === "coba") $("#coba").scrollIntoView({ behavior: "smooth" });
}
window.addEventListener("hashchange", route);

/* ================= BERANDA ================= */
async function initHome() {
  const [meta, eda, lp, wp] = await Promise.all([load("meta"), load("eda"), load("load_perf"), load("weather_perf")]);
  const k = meta.kpi;
  $("#chipPeriod").textContent = `${k.start.slice(0, 10)} s.d. ${k.end.slice(0, 10)}`;
  const v = eda.values.slice(-24 * 7 * 2), mn = Math.min(...v), mx = Math.max(...v);
  const pts = v.map((y, i) => [i / (v.length - 1) * 1200, 285 - (y - mn) / (mx - mn) * 200]);
  const dLine = "M" + pts.map(p => p.map(n => n.toFixed(1)).join(",")).join(" L");
  $("#heroLine").setAttribute("d", dLine); $("#heroArea").setAttribute("d", dLine + " L1200,300 L0,300 Z");

  $("#kpiOverview").innerHTML = [
    kpiCard("bi-collection", "Jumlah data", k.n_obs, "jam", "satu data tiap jam"),
    kpiCard("bi-calendar-range", "Periode", `${k.start.slice(0, 4)}–${k.end.slice(0, 4)}`, "", `${nice(k.start)} – ${nice(k.end)}`),
    kpiCard("bi-activity", "Rata-rata beban", k.mean, "MWh", "per jam"),
    kpiCard("bi-arrow-up-circle", "Beban tertinggi", k.max, "MWh", nice(k.max_time), "orange"),
    kpiCard("bi-arrow-down-circle", "Beban terendah", k.min, "MWh", `${nice(k.min_time)} (data tidak wajar)`, "violet"),
    kpiCard("bi-cloud-sun", "Variabel cuaca", k.n_weather, "", "4 jenis × 3 wilayah", "green"),
    kpiCard("bi-clock-history", "Frekuensi data", "Per jam", "", "hourly"),
  ].join("");
  animateCounters($("#kpiOverview"));

  const nX = wp.summary.filter(r => r["Model terpilih"] === "XGBoost").length;
  $("#ovWeatherSel").innerHTML = `<div class="small">Model paling tepat: <b>XGBoost</b> untuk ${nX} variabel, <b>SARIMAX</b> untuk ${wp.summary.length - nX} variabel.</div>`;
  const ba = lp.registry.best_accuracy, bo = lp.registry.best_operational;
  $("#ovLoadSel").innerHTML = `<div class="small">Model paling tepat: <b>${ba.model}</b> (${SC_SHORT[ba.skenario]}).</div>`;

  const crit = lp.criteria.find(r => r.model === ba.model && r.skenario === ba.skenario);
  const op = lp.criteria.find(r => r.model === bo.model && r.skenario === bo.skenario);
  const el = $("#ovHighlight");
  if (!crit) { el.innerHTML = `<div class="col-12"><div class="callout">Hasil evaluasi belum dipublikasikan.</div></div>`; return; }
  el.innerHTML = `
    <div class="col-lg-4"><div class="card-x"><span class="badge-best"><i class="bi bi-trophy"></i> Model paling tepat</span>
      <div class="big-model mt-2">${ba.model}</div><div class="sub">${SC_LABEL[ba.skenario]}</div>
      <div class="small">Pada data uji 2020: rata-rata meleset ${fmt(crit["Test MAE"], 1)} MWh (sekitar ${fmt(crit["Test sMAPE"], 1)}%).</div></div></div>
    ${kpiCard("bi-bullseye", "MAE terbaik", crit["Val MAE"], "MWh", "rata-rata selisih, data 2019", "", "col-6 col-lg-2")}
    ${kpiCard("bi-graph-down", "RMSE terbaik", crit["Val RMSE"], "MWh", "data 2019", "", "col-6 col-lg-2")}
    <div class="col-lg-4"><div class="card-x"><span class="badge-best badge-op"><i class="bi bi-gear"></i> Dipakai untuk prediksi</span>
      <div class="big-model mt-2">${bo.model}</div><div class="sub">${SC_LABEL[bo.skenario]}${op && !op["butuh ramalan cuaca"] ? " — tidak perlu menunggu prediksi cuaca" : ""}</div>
      <div class="small"><a href="#prediksi">Lihat prediksi 24 jam →</a></div></div></div>`;
  animateCounters(el);
}

/* ================= EKSPLORASI ================= */
async function initExploration() {
  const eda = await load("eda");
  const T = hourSeq(eda.start, eda.values.length);
  const years = [...new Set(T.map(t => t.getFullYear()))];
  $("#exYear").innerHTML = `<option value="">Semua</option>` + years.map(y => `<option>${y}</option>`).join("");
  $("#exMonth").innerHTML = `<option value="">Semua</option>` + MON.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  const drawTs = () => {
    const yr = $("#exYear").value, mo = $("#exMonth").value;
    const f = $("#exFrom").value ? new Date($("#exFrom").value + "T00:00") : null, t = $("#exTo").value ? new Date($("#exTo").value + "T23:59") : null;
    const x = [], y = [];
    for (let i = 0; i < T.length; i++) {
      const d = T[i];
      if (yr && d.getFullYear() !== +yr) continue; if (mo && d.getMonth() + 1 !== +mo) continue;
      if (f && d < f) continue; if (t && d > t) continue;
      x.push(d); y.push(eda.values[i]);
    }
    plot("chTs", [{ x, y, type: "scattergl", mode: "lines", line: { color: C.cyan, width: 1 }, name: "Beban", hovertemplate: "%{y:,.1f} MWh<extra></extra>" }],
      { yaxis: { title: "MWh" }, xaxis: { rangeslider: { visible: true, bgcolor: "#f1f5f9", thickness: .08 },
        rangeselector: { buttons: [{ count: 7, label: "1 mgg", step: "day", stepmode: "backward" }, { count: 1, label: "1 bln", step: "month", stepmode: "backward" }, { count: 1, label: "1 thn", step: "year", stepmode: "backward" }, { step: "all", label: "Semua" }], bgcolor: "#f1f5f9", activecolor: "#bae6f5" } } });
  };
  drawTs();
  $("#exApply").onclick = drawTs;
  $("#exReset").onclick = () => { ["#exYear", "#exMonth", "#exFrom", "#exTo"].forEach(s => $(s).value = ""); drawTs(); };

  const hmax = argmax(eda.hourly), hmin = argmin(eda.hourly);
  plot("chHourly", [{ x: HOURS, y: eda.hourly, mode: "lines+markers", fill: "tozeroy", fillcolor: "rgba(8,145,178,.08)", line: { color: C.cyan, width: 3, shape: "spline" }, name: "Rata-rata", hovertemplate: "%{x}: %{y:,.1f} MWh<extra></extra>" },
    { x: [HOURS[hmax]], y: [eda.hourly[hmax]], mode: "markers", marker: { color: C.orange, size: 14, symbol: "star" }, name: "Tertinggi" },
    { x: [HOURS[hmin]], y: [eda.hourly[hmin]], mode: "markers", marker: { color: C.violet, size: 12, symbol: "diamond" }, name: "Terendah" }],
    { yaxis: { title: "MWh", range: [Math.min(...eda.hourly) * 0.92, Math.max(...eda.hourly) * 1.04] } });
  $("#kpiHourly").innerHTML = kpiCard("bi-sun", "Jam paling sibuk", HOURS[hmax], "", `rata-rata ${fmt(eda.hourly[hmax])} MWh`, "orange", "col-12")
    + kpiCard("bi-moon-stars", "Jam paling sepi", HOURS[hmin], "", `rata-rata ${fmt(eda.hourly[hmin])} MWh`, "violet", "col-12")
    + kpiCard("bi-arrows-expand", "Selisih sibuk vs sepi", eda.hourly[hmax] - eda.hourly[hmin], "MWh", `${fmt((eda.hourly[hmax] / eda.hourly[hmin] - 1) * 100)}% lebih tinggi`, "", "col-12");
  animateCounters($("#kpiHourly"));

  plot("chDow", [{ x: DOW, y: eda.dow, type: "bar", marker: { color: eda.dow.map((_, i) => i >= 5 ? C.violet : C.cyan) }, hovertemplate: "%{x}: %{y:,.1f} MWh<extra></extra>" }],
    { yaxis: { title: "MWh", range: [Math.min(...eda.dow) * 0.9, Math.max(...eda.dow) * 1.03] }, hovermode: "closest" });
  plot("chWdWe", [{ x: HOURS, y: eda.hourly_wd, name: "Hari kerja", line: { color: C.cyan, width: 3, shape: "spline" } },
    { x: HOURS, y: eda.hourly_we, name: "Akhir pekan", line: { color: C.violet, width: 3, shape: "spline", dash: "dot" } }], { yaxis: { title: "MWh" } });
  plot("chHeat", [{ z: eda.heat, x: HOURS, y: DOW, type: "heatmap", colorscale: [[0, "#eef6fb"], [.45, "#7dd3fc"], [.8, "#0891b2"], [1, "#f59e0b"]], hovertemplate: "%{y} %{x}<br>%{z:,.1f} MWh<extra></extra>", colorbar: { title: "MWh", thickness: 10 } }],
    { yaxis: { autorange: "reversed" }, hovermode: "closest", margin: { l: 64, r: 10, t: 10, b: 44 } });
  plot("chBoxMonth", [{ type: "box", x: MON, q1: eda.box_month.map(b => b.q1), median: eda.box_month.map(b => b.median), q3: eda.box_month.map(b => b.q3), lowerfence: eda.box_month.map(b => b.lower),
    upperfence: eda.box_month.map(b => b.upper), mean: eda.box_month.map(b => b.mean), marker: { color: C.cyan }, line: { color: C.cyan }, fillcolor: "rgba(8,145,178,.15)", name: "Beban" }],
    { yaxis: { title: "MWh" }, hovermode: "closest", showlegend: false });

  const s = eda.stats;
  $("#kpiStats").innerHTML = [["Rata-rata", s.mean], ["Median", s.median], ["Simpangan baku", s.std], ["Minimum", s.min], ["Maksimum", s.max], ["Kuartil 1", s.q1], ["Kuartil 3", s.q3]]
    .map(([l, v]) => kpiCard("bi-bar-chart", l, v, "MWh", "", "", "col-6 col-md-3 col-xl")).join("");
  animateCounters($("#kpiStats"));
  const mid = eda.hist.edges.slice(0, -1).map((e, i) => (e + eda.hist.edges[i + 1]) / 2);
  plot("chHist", [{ x: mid, y: eda.hist.counts, type: "bar", marker: { color: "rgba(8,145,178,.35)", line: { color: C.cyan, width: .5 } }, name: "Jumlah jam", hovertemplate: "%{x:,.0f} MWh: %{y} jam<extra></extra>" },
    { x: eda.kde.x, y: eda.kde.y, mode: "lines", line: { color: C.orange, width: 2.5 }, name: "Kurva kepadatan" }],
    { bargap: .02, xaxis: { title: "MWh" }, yaxis: { title: "jumlah jam" }, hovermode: "closest" });
  plot("chBoxAll", [{ type: "box", q1: [s.q1], median: [s.median], q3: [s.q3], lowerfence: [Math.max(s.min, s.q1 - 1.5 * (s.q3 - s.q1))], upperfence: [Math.min(s.max, s.q3 + 1.5 * (s.q3 - s.q1))],
    mean: [s.mean], x: ["Beban"], marker: { color: C.cyan }, fillcolor: "rgba(8,145,178,.15)", line: { color: C.cyan } }], { hovermode: "closest", showlegend: false, yaxis: { title: "MWh" } });

  const mmax = argmax(eda.month), mmin = argmin(eda.month);
  const we = (eda.weekend_mean / eda.weekday_mean - 1) * 100, hol = (eda.holiday_mean / eda.nonholiday_mean - 1) * 100;
  const full = Object.entries(eda.year).filter(([y]) => eda.year_n[y] > 8000);
  const ins = [
    ["bi-clock", `Pemakaian listrik paling tinggi rata-rata pukul <b>${HOURS[hmax]}</b> (${fmt(eda.hourly[hmax])} MWh) dan paling rendah pukul <b>${HOURS[hmin]}</b> (${fmt(eda.hourly[hmin])} MWh).`],
    ["bi-calendar-month", `Bulan dengan rata-rata tertinggi adalah <b>${MON[mmax]}</b> (${fmt(eda.month[mmax])} MWh), terendah <b>${MON[mmin]}</b> (${fmt(eda.month[mmin])} MWh).`],
    ["bi-briefcase", `Akhir pekan rata-rata <b>${fmt(Math.abs(we))}% ${we < 0 ? "lebih rendah" : "lebih tinggi"}</b> daripada hari kerja (${fmt(eda.weekend_mean)} vs ${fmt(eda.weekday_mean)} MWh).`],
    ["bi-flag", `Hari libur nasional rata-rata <b>${fmt(Math.abs(hol))}% ${hol < 0 ? "lebih rendah" : "lebih tinggi"}</b> daripada hari biasa.`],
    ["bi-arrows-angle-expand", `Separuh dari seluruh jam memiliki beban antara ${fmt(s.q1, 0)} dan ${fmt(s.q3, 0)} MWh; simpangan bakunya ${fmt(s.std, 0)} MWh (${fmt(s.cv * 100)}% dari rata-rata).`],
    ["bi-graph-up-arrow", `Rata-rata tahunan (tahun penuh): ${full.map(([y, v]) => `${y}: ${fmt(v, 0)}`).join(" · ")} MWh.`],
  ];
  $("#exInsights").innerHTML = ins.map(([i, t]) => `<li><i class="bi ${i}"></i><span>${t}</span></li>`).join("");
}

/* ================= CUACA ================= */
async function initWeather() {
  const [wx, meta] = await Promise.all([load("weather"), load("meta")]);
  const unitOf = v => v.startsWith("QV2M") ? "g/kg" : (meta.units[v] || "").replace(" (menurut README)", "").replace(/ \(README.*\)/, "");
  const scale = v => v.startsWith("QV2M") ? 1000 : 1;           // kelembapan ditampilkan dalam g/kg
  if (window.L) {
    const map = L.map("map", { scrollWheelZoom: false }).setView([8.6, -80.9], 7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap © CARTO", maxZoom: 12 }).addTo(map);
    meta.locations.forEach(l => {
      const pl = wx.kpi.per_loc[l.code];
      L.circleMarker([l.lat, l.lon], { radius: 10, color: LOC_COLOR[l.code], fillColor: LOC_COLOR[l.code], fillOpacity: .5, weight: 2 }).addTo(map)
        .bindPopup(`<b>${l.name}</b><br>Suhu rata-rata ${fmt(pl.T2M, 1)} °C<br>Angin rata-rata ${fmt(pl.W2M, 1)} m/s`);
    });
  }
  const k = wx.kpi;
  $("#kpiWeather").innerHTML = [
    kpiCard("bi-thermometer-half", "Suhu rata-rata", k.T2M_mean, "°C", "tiga wilayah", "orange", "col-6 col-md-4"),
    kpiCard("bi-thermometer-sun", "Suhu tertinggi", k.T2M_max, "°C", `${k.T2M_max_loc}, ${nice(k.T2M_max_time)}`, "orange", "col-6 col-md-4"),
    kpiCard("bi-droplet", "Kelembapan rata-rata", k.QV2M_mean * 1000, "g/kg", "uap air per kg udara", "", "col-6 col-md-4"),
    kpiCard("bi-cloud-rain", "Hujan rata-rata", fmt(k.TQL_mean, 3), "l/m²", "presipitasi cair", "violet", "col-6 col-md-4"),
    kpiCard("bi-wind", "Angin rata-rata", k.W2M_mean, "m/s", "pada ketinggian 2 m", "green", "col-6 col-md-4"),
    kpiCard("bi-geo", "Wilayah", 3, "", "Tocumen · Santiago · David", "", "col-6 col-md-4"),
  ].join("");
  animateCounters($("#kpiWeather"));

  const Td = hourSeq(wx.daily_start, wx.daily.T2M_toc.length, 24);
  const slider = { rangeslider: { visible: true, thickness: .07, bgcolor: "#f1f5f9" } };
  plot("chTemp", Object.keys(LOC).map(l => ({ x: Td, y: wx.daily[`T2M_${l}`], name: LOC[l], mode: "lines", line: { color: LOC_COLOR[l], width: 1.2 } })), { yaxis: { title: "°C" }, xaxis: slider });
  plot("chTempHour", Object.keys(LOC).map(l => ({ x: HOURS, y: wx.hourly[`T2M_${l}`], name: LOC[l], line: { color: LOC_COLOR[l], width: 2.5, shape: "spline" } })), { yaxis: { title: "°C" } });
  plot("chTempMonth", Object.keys(LOC).map(l => ({ x: MON, y: wx.monthly[`T2M_${l}`], name: LOC[l], mode: "lines+markers", line: { color: LOC_COLOR[l], width: 2.5, shape: "spline" } })), { yaxis: { title: "°C" } });

  const drawWx = () => {
    const b = $("#wxVar").value, unit = unitOf(`${b}_toc`), sc = scale(b);
    $("#wxUnit").textContent = `Satuan: ${unit}`;
    plot("chWxTrend", Object.keys(LOC).map(l => ({ x: Td, y: wx.daily[`${b}_${l}`].map(v => v * sc), name: LOC[l], mode: "lines", line: { color: LOC_COLOR[l], width: 1.1 } })), { yaxis: { title: unit }, xaxis: slider });
    plot("chWxDist", Object.keys(LOC).map(l => { const h = wx.hist[`${b}_${l}`]; return { x: h.edges.slice(0, -1).map((e, i) => sc * (e + h.edges[i + 1]) / 2), y: h.counts, name: LOC[l], mode: "lines", line: { color: LOC_COLOR[l], width: 2, shape: "hvh" }, fill: "tozeroy", fillcolor: LOC_COLOR[l] + "18" }; }),
      { xaxis: { title: unit }, yaxis: { title: "jumlah jam" }, hovermode: "closest" });
  };
  $("#wxVar").onchange = drawWx; drawWx();

  const cols = wx.corr.cols, P = wx.corr.pearson, S = wx.corr.spearman, wv = cols.slice(1);
  const lab = c => c === "nat_demand" ? "Beban" : varName(c);
  $("#scVar").innerHTML = wv.map(v => `<option value="${v}">${varName(v)}</option>`).join("");
  const drawSc = () => {
    const v = $("#scVar").value, j = cols.indexOf(v), byHour = $("#scColor").value === "hour", sc = scale(v);
    $("#scStats").innerHTML = `<span class="chip">Pearson: <b class="ms-1">${fmt(P[0][j], 2)}</b></span><span class="chip">Spearman: <b class="ms-1">${fmt(S[0][j], 2)}</b></span>`;
    plot("chScatter", [{ x: wx.scatter[v].map(x => x * sc), y: wx.scatter.nat_demand, mode: "markers", type: "scattergl",
      marker: byHour ? { color: wx.scatter_hour, colorscale: "Turbo", size: 5, opacity: .6, colorbar: { title: "jam", thickness: 10 } } : { color: C.cyan, size: 5, opacity: .4 },
      hovertemplate: `%{x:.2f} ${unitOf(v)}<br>%{y:,.1f} MWh<extra></extra>` }],
      { xaxis: { title: `${varName(v)} (${unitOf(v)})` }, yaxis: { title: "Beban (MWh)" }, hovermode: "closest" });
  };
  $("#scVar").onchange = drawSc; $("#scColor").onchange = drawSc; drawSc();

  const drawCorr = which => {
    const M = which === "spearman" ? S : P, names = cols.map(lab);
    plot("chCorr", [{ z: M, x: names, y: names, type: "heatmap", zmin: -1, zmax: 1, colorscale: [[0, "#e11d48"], [.5, "#ffffff"], [1, "#0891b2"]], text: M.map(r => r.map(v => v.toFixed(2))), texttemplate: "%{text}", textfont: { size: 9 },
      hovertemplate: "%{y} × %{x}: %{z:.2f}<extra></extra>", colorbar: { thickness: 10 } }],
      { yaxis: { autorange: "reversed" }, hovermode: "closest", margin: { l: 120, r: 10, t: 10, b: 110 } });
  };
  $$("[data-corr]").forEach(b => b.onclick = () => { $$("[data-corr]").forEach(x => x.classList.remove("active")); b.classList.add("active"); drawCorr(b.dataset.corr); });
  drawCorr("pearson");

  const strength = r => { const a = Math.abs(r); return a < .1 ? "sangat lemah" : a < .3 ? "lemah" : a < .5 ? "sedang" : a < .7 ? "kuat" : "sangat kuat"; };
  const ranked = wv.map(v => ({ v, r: P[0][cols.indexOf(v)] })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  $("#corrInsights").innerHTML = [
    `Biru = jika satu naik, yang lain cenderung naik. Merah = jika satu naik, yang lain cenderung turun.`,
    ...ranked.slice(0, 3).map(o => `<b>${varName(o.v)}</b> vs beban: ${fmt(o.r, 2)} (${strength(o.r)}, ${o.r >= 0 ? "searah" : "berlawanan arah"}).`),
    `Paling lemah: <b>${varName(ranked.at(-1).v)}</b> (${fmt(ranked.at(-1).r, 2)}).`,
  ].map(t => `<li><i class="bi bi-link-45deg"></i><span>${t}</span></li>`).join("");

  const base = ["T2M", "QV2M", "TQL", "W2M"].map(b => ({ b, r: mean(Object.keys(LOC).map(l => P[0][cols.indexOf(`${b}_${l}`)])) })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const tPair = mean([["T2M_toc", "T2M_san"], ["T2M_toc", "T2M_dav"], ["T2M_san", "T2M_dav"]].map(([a, b]) => P[cols.indexOf(a)][cols.indexOf(b)]));
  $("#wxInsights").innerHTML = [
    `Urutan kekuatan hubungan dengan beban (rata-rata tiga wilayah): ${base.map(o => `${BASE_NAME[o.b]} ${fmt(o.r, 2)}`).join(" · ")}.`,
    `Suhu di ketiga wilayah bergerak hampir bersamaan (korelasi rata-rata ${fmt(tPair, 2)}), sehingga informasi dari ketiganya banyak yang tumpang tindih.`,
    `Hubungan ini sebagian besar karena siklus harian: siang hari lebih panas dan aktivitas lebih tinggi. Dalam percobaan prediksi, menambahkan cuaca tidak membuat prediksi beban jauh lebih tepat (lihat <a href="#performa">Performa Model</a>).`,
  ].map(t => `<li><i class="bi bi-lightbulb"></i><span>${t}</span></li>`).join("");
}

/* ================= PERFORMA ================= */
async function initPerformance() {
  $$("#perfTabs .nav-link").forEach(b => b.onclick = () => {
    $$("#perfTabs .nav-link").forEach(x => x.classList.remove("active")); b.classList.add("active");
    $$(".ptab").forEach(t => t.classList.add("d-none")); $(`#tab-${b.dataset.tab}`).classList.remove("d-none");
    $$(`#tab-${b.dataset.tab} .js-plotly-plot`).forEach(el => Plotly.Plots.resize(el));
    const fn = { ps: initPerfSel, pw: initPerfWeather, pi: initPerfImp }[b.dataset.tab];
    if (fn && !inited[b.dataset.tab]) { inited[b.dataset.tab] = true; fn(); }
  });
  await initPerfLoad();
}

async function initPerfLoad() {
  const lp = await load("load_perf");
  const SCN = { "Tanpa cuaca": "A", "Prediksi cuaca": "B", "Oracle weather": "C" };
  const avail = [...new Set(lp.main.filter(r => r.Skenario !== "Baseline" && r["Val MAE"] !== null).map(r => SCN[r.Skenario]))];
  $("#plScen").innerHTML = avail.map(s => `<div class="form-check"><input class="form-check-input sc-chk" type="checkbox" value="${s}" id="sc${s}" ${s !== "C" ? "checked" : ""}><label class="form-check-label small" for="sc${s}">${SC_LABEL[s]}</label></div>`).join("");
  $("#plSc").innerHTML = avail.map(s => `<option value="${s}">${SC_LABEL[s]}</option>`).join("");
  const draw = () => {
    const on = $$(".sc-chk").filter(c => c.checked).map(c => c.value);
    const rows = lp.main.filter(r => r.Skenario === "Baseline" || on.includes(SCN[r.Skenario]));
    const minV = Math.min(...rows.filter(r => r.Skenario !== "Baseline").map(r => r["Val MAE"]));
    table("plTable", [{ label: "Model", get: r => r.Model, left: true }, { label: "Percobaan", get: r => r.Skenario === "Baseline" ? "pembanding sederhana" : SC_LABEL[SCN[r.Skenario]], left: true },
      { key: "Train rolling MAE", label: "MAE data latih" }, { key: "Val MAE", label: "MAE 2019" }, { key: "Val RMSE", label: "RMSE 2019" },
      { key: "Test MAE", label: "MAE 2020" }, { key: "Test RMSE", label: "RMSE 2020" }, { key: "Test MAPE", label: "MAPE 2020 (%)" }],
      rows, { best: (r, c) => c.key === "Val MAE" && r["Val MAE"] === minV });
    const mr = rows.filter(r => r.Skenario !== "Baseline"), labs = mr.map(r => `${r.Model}<br>${SC_SHORT[SCN[r.Skenario]]}`);
    for (const [id, met] of [["chPlMae", "MAE"], ["chPlRmse", "RMSE"]]) {
      plot(id, [{ x: labs, y: mr.map(r => r[`Val ${met}`]), name: "2019", type: "bar", marker: { color: C.cyan } }, { x: labs, y: mr.map(r => r[`Test ${met}`]), name: "2020", type: "bar", marker: { color: C.orange } }],
        { hovermode: "closest", yaxis: { title: "MWh" }, margin: { l: 56, r: 10, t: 18, b: 70 } });
    }
    const ov = lp.overfit.filter(r => on.includes(r.skenario) && ["SARIMAX", "XGBoost", "TimesFM"].includes(r.model));
    plot("chPlOvf", [["Train rolling", "Data latih"], ["Val", "2019"], ["Test", "2020"]].map(([s, n], i) => ({ x: ov.map(r => `${r.model}<br>${SC_SHORT[r.skenario]}`), y: ov.map(r => r[s]), name: n, type: "bar", marker: { color: [C.green, C.cyan, C.orange][i] } })),
      { hovermode: "closest", yaxis: { title: "MAE (MWh)" }, margin: { l: 56, r: 10, t: 18, b: 70 } });
  };
  const drawH = () => {
    const on = $$(".sc-chk").filter(c => c.checked).map(c => c.value), set = $("#plSet").value;
    const tr = Object.entries(lp.horizon).filter(([k]) => { const [, s, h] = k.split("|"); return h === set && on.includes(s); })
      .map(([k, o]) => { const [m, s] = k.split("|"); return { x: [...Array(24).keys()].map(i => i + 1), y: o.MAE, name: `${m} · ${SC_SHORT[s]}`, line: { color: MODEL_COLOR[m], width: 2.2, dash: { A: "solid", B: "dash", C: "dot" }[s] } }; });
    plot("chPlH", tr, { xaxis: { title: "jam ke depan", dtick: 2 }, yaxis: { title: `MAE ${SET_LABEL[set]} (MWh)` } });
  };
  const drawTs = async () => {
    const m = $("#plModel").value, s = $("#plSc").value, set = $("#plSet").value;
    const ts = await load(`load_ts_${set}`), se = ts.series[`${m}|${s}`], tt = ts.times.map(parseT);
    if (!se) return;
    const tr = [];
    if (se.lower) tr.push({ x: tt, y: se.upper, line: { width: 0 }, showlegend: false, hoverinfo: "skip" }, { x: tt, y: se.lower, fill: "tonexty", fillcolor: "rgba(8,145,178,.12)", line: { width: 0 }, name: "Rentang 80%", hoverinfo: "skip" });
    tr.push({ x: tt, y: ts.actual, name: "Sebenarnya", line: { color: C.ink, width: 1.1 } }, { x: tt, y: se.pred, name: `Prediksi ${m}`, line: { color: MODEL_COLOR[m], width: 1.5 } });
    plot("chPlTs", tr, { yaxis: { title: "MWh" }, xaxis: { rangeslider: { visible: true, thickness: .07, bgcolor: "#f1f5f9" }, range: [tt[0], tt[24 * 14]] } });
    const res = ts.actual.map((a, i) => a - se.pred[i]);
    plot("chPlRes", [{ x: tt, y: res, type: "scattergl", mode: "markers", marker: { size: 3, color: res.map(r => r >= 0 ? C.cyan : C.orange), opacity: .6 }, name: "selisih" }],
      { yaxis: { title: "MWh" }, hovermode: "closest", showlegend: false });
    plot("chPlResH", [{ x: res, type: "histogram", nbinsx: 70, marker: { color: "rgba(8,145,178,.5)" } }], { xaxis: { title: "selisih (MWh)" }, yaxis: { title: "jumlah jam" }, hovermode: "closest", showlegend: false });
  };
  $$(".sc-chk").forEach(c => c.onchange = () => { draw(); drawH(); });
  ["#plModel", "#plSc"].forEach(s => $(s).onchange = drawTs);
  $("#plSet").onchange = () => { drawTs(); drawH(); };
  draw(); drawH(); drawTs();
}

async function initPerfSel() {
  const lp = await load("load_perf"), r = lp.registry;
  const ba = lp.criteria.find(x => x.model === r.best_accuracy.model && x.skenario === r.best_accuracy.skenario);
  const bo = lp.criteria.find(x => x.model === r.best_operational.model && x.skenario === r.best_operational.skenario);
  const cand = Object.entries(lp.horizon).filter(([k]) => k.endsWith("|validation") && /\|(A|B)\|/.test(k)).map(([k, o]) => ({ k, wins: 0, o }));
  for (let h = 0; h < 24; h++) cand.reduce((a, c) => c.o.MAE[h] < a.o.MAE[h] ? c : a).wins++;
  const hw = cand.sort((a, b) => b.wins - a.wins)[0];
  $("#psCards").innerHTML = `
    <div class="col-lg-4"><div class="card-x"><span class="badge-best"><i class="bi bi-bullseye"></i> Paling tepat</span><div class="big-model mt-2">${r.best_accuracy.model}</div>
      <div class="sub">${SC_LABEL[r.best_accuracy.skenario]}</div>
      <div class="small">MAE 2019: <b>${fmt(ba["Val MAE"], 1)}</b> MWh · MAE 2020: <b>${fmt(ba["Test MAE"], 1)}</b> MWh</div></div></div>
    <div class="col-lg-4"><div class="card-x"><span class="badge-best badge-op"><i class="bi bi-gear"></i> Dipakai untuk prediksi</span><div class="big-model mt-2">${r.best_operational.model}</div>
      <div class="sub">${SC_LABEL[r.best_operational.skenario]}</div>
      <div class="small">${bo["butuh ramalan cuaca"] ? "Membutuhkan prediksi cuaca." : "Tidak perlu prediksi cuaca, sehingga lebih praktis."} Tetap stabil saat beban turun karena COVID-19 (MAE ${fmt(bo["MAE test penurunan"], 1)} MWh).</div></div></div>
    <div class="col-lg-4"><div class="card-x"><span class="badge-best" style="background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe"><i class="bi bi-clock"></i> Paling tepat per jam</span>
      <div class="big-model mt-2">${hw.k.split("|")[0]}</div><div class="sub">Unggul di <b>${hw.wins} dari 24</b> jam ke depan (data 2019).</div></div></div>`;
  table("psTable", [{ key: "model", label: "Model", left: true }, { label: "Percobaan", get: x => SC_SHORT[x.skenario], left: true }, { key: "Val MAE", label: "MAE 2019" }, { key: "Val RMSE", label: "RMSE 2019" },
    { key: "Test MAE", label: "MAE 2020" }, { key: "Test RMSE", label: "RMSE 2020" }, { key: "MAE test penurunan", label: "MAE saat COVID" },
    { key: "MAE peak val", label: "MAE beban puncak" }, { label: "Butuh cuaca", get: x => x["butuh ramalan cuaca"] ? "ya" : "tidak" }, { key: "rank_Val_MAE", label: "Peringkat", d: 0 }],
    lp.criteria, { best: (x, c) => c.key === "rank_Val_MAE" && x.rank_Val_MAE === 1 });
  const sub = lp.subperiod.filter(x => ["SARIMAX", "XGBoost", "TimesFM"].includes(x.model) && ["A", "B"].includes(x.skenario));
  const labs = [...new Set(sub.map(x => `${x.model}<br>${SC_SHORT[x.skenario]}`))];
  plot("chPsSub", ["validation", "test_pra", "test_penurunan"].map((s, i) => ({ x: labs, y: labs.map(l => (sub.find(x => `${x.model}<br>${SC_SHORT[x.skenario]}` === l && x.subperiode === s) || {}).MAE), name: SET_LABEL[s], type: "bar", marker: { color: [C.cyan, C.green, C.orange][i] } })),
    { hovermode: "closest", yaxis: { title: "MAE (MWh)" }, margin: { l: 56, r: 10, t: 18, b: 70 } });
  const cmp = s => s.replace(" vs ", " vs ").replace("(B)", "(prediksi cuaca)").replace(": B vs A", ": prediksi cuaca vs tanpa cuaca");
  table("psDm", [{ label: "Data", get: x => SET_LABEL[x.himpunan], left: true }, { label: "Perbandingan", get: x => cmp(x.perbandingan), left: true }, { label: "Lebih tepat", get: x => x.selisih_MAE_harian < 0 ? "yang pertama" : "yang kedua" },
    { label: "Nyata?", get: x => x.p_value < 0.05 ? "ya" : "tidak" }], lp.dm);
  table("psPeak", [{ key: "model", label: "Model", left: true }, { label: "Percobaan", get: x => SC_SHORT[x.skenario] || "pembanding", left: true }, { label: "Data", get: x => SET_LABEL[x.himpunan], left: true },
    { key: "MAE_nilai_peak", label: "Meleset (MWh)" }, { key: "dalam_1jam_pct", label: "Jam puncak tepat ±1 jam (%)" }], lp.peak);
  table("psCov", [{ key: "model", label: "Model", left: true }, { label: "Percobaan", get: x => SC_SHORT[x.skenario], left: true }, { label: "Periode", get: x => SET_LABEL[x.subperiode], left: true },
    { key: "cakupan_PI80_%", label: "Masuk rentang (%)" }, { key: "lebar_rata2_MWh", label: "Lebar (MWh)" }], lp.coverage);
}

async function initPerfWeather() {
  const [wp, meta] = await Promise.all([load("weather_perf"), load("meta")]);
  const unitOf = v => v.startsWith("QV2M") ? "kg/kg" : (meta.units[v] || "").replace(/ \(.*\)/, "");
  $("#pwVar").innerHTML = wp.vars.map(v => `<option value="${v}">${varName(v)}</option>`).join("");
  const draw = async () => {
    const v = $("#pwVar").value, rows = wp.table.filter(r => r.Variabel === v), unit = unitOf(v);
    const sel = wp.selection.find(r => r.variabel === v);
    $("#pwSel").innerHTML = sel ? `Model dipilih: <b>${sel.model_terpilih}</b> · satuan ${unit}` : "";
    const dd = v.startsWith("QV2M") ? 6 : 3;
    table("pwTable", [{ key: "Model", label: "Model", left: true }, { label: "Dipilih", get: r => r.Terpilih ? "✔" : "", left: true },
      { key: "Train rolling MAE", label: "MAE data latih", d: dd }, { key: "Val MAE", label: "MAE 2019", d: dd }, { key: "Test MAE", label: "MAE 2020", d: dd },
      { key: "Test RMSE", label: "RMSE 2020", d: dd }, { key: "Test MASE", label: "MASE 2020", d: 2 }],
      rows, { best: (r, c) => c.key === "Val MAE" && r["Val MAE"] === Math.min(...rows.map(x => x["Val MAE"])) });
    plot("chPwMae", rows.map(r => ({ x: ["Data latih", "2019", "2020"], y: ["Train rolling MAE", "Val MAE", "Test MAE"].map(s => r[s]), name: r.Model, type: "bar", marker: { color: MODEL_COLOR[r.Model] } })), { yaxis: { title: unit }, hovermode: "closest" });
    plot("chPwH", Object.entries(wp.horizon[v]).map(([k, o]) => { const [m, s] = k.split("|"); return { x: [...Array(24).keys()].map(i => i + 1), y: o.MAE, name: `${m} · ${SET_LABEL[s]}`, line: { color: MODEL_COLOR[m], dash: s === "test" ? "solid" : "dot", width: 2 } }; }),
      { xaxis: { title: "jam ke depan", dtick: 2 }, yaxis: { title: `MAE (${unit})` } });
    const ts = await load(`wperf_ts_${v}`), tt = ts.times.map(parseT);
    plot("chPwTs", [{ x: tt, y: ts.actual, name: "Sebenarnya", line: { color: C.ink, width: 1 } }, ...["SARIMAX", "XGBoost"].filter(m => ts[m]).map(m => ({ x: tt, y: ts[m], name: m, line: { color: MODEL_COLOR[m], width: 1.2 } }))],
      { yaxis: { title: unit }, xaxis: { rangeslider: { visible: true, thickness: .07, bgcolor: "#f1f5f9" }, range: [tt[0], tt[24 * 14]] } });
  };
  $("#pwVar").onchange = draw; await draw();
  plot("chPwMase", ["SARIMAX", "XGBoost"].map(m => ({ x: wp.vars.map(varName), y: wp.vars.map(v => (wp.table.find(r => r.Variabel === v && r.Model === m) || {})["Test MASE"]), name: m, type: "bar", marker: { color: MODEL_COLOR[m] } })),
    { hovermode: "closest", shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 1, y1: 1, line: { color: C.red, dash: "dash" } }], yaxis: { title: "MASE" }, margin: { l: 50, r: 10, t: 18, b: 90 } });
}

async function initPerfImp() {
  const imp = await load("xgb_importance");
  const label = f => {
    let m;
    if ((m = f.match(/^lag_(\d+)$/))) return +m[1] === 1 ? "Beban jam terakhir" : `Beban ${+m[1] - 1} jam sebelumnya`;
    if ((m = f.match(/^tlag_(\d+)$/))) return +m[1] === 24 ? "Beban jam yang sama kemarin" : "Beban jam yang sama minggu lalu";
    const map = { hour_sin: "Jam (sin)", hour_cos: "Jam (cos)", dow_sin: "Hari (sin)", dow_cos: "Hari (cos)", doy_sin: "Hari ke- dalam tahun (sin)", doy_cos: "Hari ke- dalam tahun (cos)",
      month_sin: "Bulan (sin)", month_cos: "Bulan (cos)", weekend: "Akhir pekan", holiday: "Hari libur", school: "Masa sekolah", T2M_mean: "Suhu rata-rata", QV2M_mean: "Kelembapan rata-rata" };
    return map[f] || varName(f);
  };
  const syncH = () => { const m = $("#piMethod").value; $("#piH").innerHTML = (m === "gain" ? [["semua", "Semua jam"]] : (m === "gain_h" ? ["1", "6", "12", "18", "24"] : ["1", "12", "24"]).map(h => [h, `Jam ke-${h}`])).map(([v, t]) => `<option value="${v}">${t}</option>`).join(""); };
  const draw = () => {
    const M = $("#piModel").value, m = $("#piMethod").value, h = $("#piH").value;
    const obj = m === "gain" ? imp[M].mean : m === "gain_h" ? imp[M].by_h[h] : imp.shap[M][h];
    const ent = Object.entries(obj).sort((a, b) => b[1] - a[1]), top = ent.slice(0, 15).reverse();
    const unit = m === "shap" ? "MWh" : "bagian gain";
    plot("chImp", [{ x: top.map(e => e[1]), y: top.map(e => label(e[0])), type: "bar", orientation: "h", marker: { color: top.map(e => /^(T2M|QV2M|TQL|W2M)/.test(e[0]) ? C.orange : /lag/.test(e[0]) ? C.cyan : C.violet) }, hovertemplate: "%{y}: %{x:.3f}<extra></extra>" }],
      { hovermode: "closest", margin: { l: 210, r: 10, t: 10, b: 40 }, xaxis: { title: unit } });
    table("piTable", [{ label: "#", get: x => x.i }, { label: "Faktor", get: x => label(x.f), left: true }, { label: unit, get: x => x.v, d: 3 }], ent.map(([f, v], i) => ({ i: i + 1, f, v })));
  };
  $("#piMethod").onchange = () => { syncH(); draw(); }; $("#piModel").onchange = draw; $("#piH").onchange = draw;
  syncH(); draw();
}

/* ================= CARA KERJA ================= */
async function initExplanation() {
  renderMath($("#page-cara-kerja"));
  let s = "";
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 130;
    s += `<rect x="${x}" y="22" width="96" height="50" rx="10" fill="#fff7e6" stroke="#f59e0b"/><text x="${x + 48}" y="44" text-anchor="middle">Pohon ${i + 1}</text><text x="${x + 48}" y="61" text-anchor="middle" style="font-size:10px;fill:#64748b">${i ? "perbaiki kesalahan" : "tebakan awal"}</text>`;
    if (i < 3) s += `<path d="M${x + 98} 47 L${x + 128} 47" stroke="#0891b2" stroke-width="2" marker-end="url(#ar)"/>`;
  }
  s += `<text x="260" y="104" text-anchor="middle" style="font-size:11px;fill:#64748b">Prediksi akhir = gabungan semua pohon</text>`;
  $("#boostDiag").innerHTML = `<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#0891b2"/></marker></defs>` + s;

  const [lp, eda] = await Promise.all([load("load_perf"), load("eda")]);
  const r = lp.registry;
  $$("[data-bind=sarOrder]").forEach(e => e.textContent = `(${r.sarimax.order.join(",")})(${r.sarimax.seasonal_order.join(",")})`);
  $$("[data-bind=ctxL]").forEach(e => e.textContent = `${r.timesfm.context_L.toLocaleString("id-ID")} (±${Math.round(r.timesfm.context_L / 24)} hari)`);
  plot("chCtx", [{ x: lp.context.map(c => `${c.context_L} jam`), y: lp.context.map(c => c.MAE), type: "bar", marker: { color: C.violet }, text: lp.context.map(c => fmt(c.MAE)), textposition: "outside" }],
    { hovermode: "closest", xaxis: { type: "category" }, yaxis: { title: "MAE 2019" }, margin: { l: 48, r: 8, t: 14, b: 36 } });
  const Ls = lp.context.map(c => c.context_L), v = eda.values, T = hourSeq(eda.start, v.length), n = v.length;
  const demo = () => {
    const L = Ls[+$("#ctxSlider").value], from = n - L;
    plot("chCtxDemo", [{ x: T.slice(n - 2200), y: v.slice(n - 2200), name: "Data lama", line: { color: "#cbd5e1", width: 1 } },
      { x: T.slice(from), y: v.slice(from), name: `Dibaca TimesFM: ${L} jam (±${Math.round(L / 24)} hari)`, line: { color: C.violet, width: 1.2 } }],
      { yaxis: { title: "MWh" }, shapes: [{ type: "rect", xref: "x", yref: "paper", x0: T[from], x1: T[n - 1], y0: 0, y1: 1, fillcolor: "rgba(124,58,237,.06)", line: { width: 0 } }] });
  };
  $("#ctxSlider").max = Ls.length - 1; $("#ctxSlider").value = Ls.length - 1; $("#ctxSlider").oninput = demo; demo();
  table("cmpTable", [{ key: "Model", label: "Model", left: true }, { label: "Jenis", get: x => ({ "Statistical linear": "Statistik", "ML nonlinear": "Machine learning", "Foundation model": "Foundation model (AI)" })[x.Kategori] || x.Kategori, left: true },
    { label: "Dilatih dengan data Panama", get: x => x["Parameter dari Panama"].startsWith("0") ? "tidak" : "ya", left: true },
    { key: "MAE validation (B)", label: "MAE 2019" }, { key: "MAE test (B)", label: "MAE 2020" }, { key: "MAE test penurunan (B)", label: "MAE saat COVID" }, { key: "MAE peak val (MWh)", label: "MAE beban puncak" }], lp.three);
}

/* ================= PREDIKSI ================= */
async function initForecast() {
  const [fc, meta] = await Promise.all([load("forecast"), load("meta")]);
  const op = fc.best_operational;
  $("#fcModel").value = op.model; $("#fcSc").value = op.skenario;
  $("#fcOverview").innerHTML = [
    kpiCard("bi-database-check", "Data terakhir", nice(fc.last_obs), "", "", "", "col-6 col-lg"),
    kpiCard("bi-play-circle", "Prediksi mulai", nice(fc.start), "", "", "", "col-6 col-lg"),
    kpiCard("bi-stop-circle", "Prediksi sampai", nice(fc.end), "", "", "", "col-6 col-lg"),
    kpiCard("bi-cpu", "Model utama", op.model, "", SC_LABEL[op.skenario], "violet", "col-6 col-lg"),
    kpiCard("bi-arrow-repeat", "Diperbarui", meta.generated.slice(0, 10), "", "", "green", "col-12 col-lg"),
  ].join("");
  const HT = hourSeq(fc.history.start, fc.history.values.length);
  const draw = () => {
    const m = $("#fcModel").value, s = $("#fcSc").value, nH = +$("#fcHist").value, all = $("#fcAll").checked;
    const rows = fc.rows.filter(r => r.model === m && r.skenario === s).sort((a, b) => a.h - b.h);
    if (!rows.length) return;
    const x = rows.map(r => parseT(r.timestamp)), y = rows.map(r => r.predicted_load_MWh), ip = argmax(y), imn = argmin(y);
    $("#fcKpi").innerHTML = [
      kpiCard("bi-activity", "Rata-rata", mean(y), "MWh", "24 jam", "", "col-6 col-lg"),
      kpiCard("bi-arrow-up-circle", "Tertinggi", y[ip], "MWh", "", "orange", "col-6 col-lg"),
      kpiCard("bi-arrow-down-circle", "Terendah", y[imn], "MWh", `pukul ${rows[imn].timestamp.slice(11, 16)}`, "violet", "col-6 col-lg"),
      kpiCard("bi-alarm", "Jam puncak", rows[ip].timestamp.slice(11, 16), "", nice(rows[ip].timestamp).split(",")[0], "orange", "col-6 col-lg"),
      kpiCard("bi-lightning-charge", "Total 24 jam", y.reduce((a, b) => a + b, 0), "MWh", "perkiraan energi", "green", "col-12 col-lg"),
    ].join(""); animateCounters($("#fcKpi"));
    const hx = HT.slice(-nH), hy = fc.history.values.slice(-nH);
    const tr = [{ x: hx, y: hy, name: "Data historis", line: { color: C.navy, width: 2 }, hovertemplate: "%{y:,.1f} MWh<extra>historis</extra>" }];
    if ($("#fcCI").checked && rows[0].lower_PI80 !== null)
      tr.push({ x, y: rows.map(r => r.upper_PI80), line: { width: 0 }, showlegend: false, hoverinfo: "skip" }, { x, y: rows.map(r => r.lower_PI80), fill: "tonexty", fillcolor: "rgba(8,145,178,.15)", line: { width: 0 }, name: "Rentang 80%", hoverinfo: "skip" });
    if (all) ["SARIMAX", "XGBoost", "TimesFM"].filter(mm => mm !== m).forEach(mm => {
      const rr = fc.rows.filter(r => r.model === mm && r.skenario === s).sort((a, b) => a.h - b.h);
      tr.push({ x: rr.map(r => parseT(r.timestamp)), y: rr.map(r => r.predicted_load_MWh), name: mm, line: { color: MODEL_COLOR[mm], width: 1.5, dash: "dot" } });
    });
    tr.push({ x: [hx.at(-1), ...x], y: [hy.at(-1), ...y], name: `Prediksi ${m}`, line: { color: C.cyan, width: 3 }, hovertemplate: "%{y:,.1f} MWh<extra>prediksi</extra>" },
      { x: [x[ip]], y: [y[ip]], mode: "markers+text", marker: { color: C.orange, size: 13, symbol: "star" }, text: ["puncak"], textposition: "top center", textfont: { color: C.orange }, name: "Beban puncak" });
    plot("chFc", tr, { yaxis: { title: "MWh" }, shapes: [{ type: "line", x0: parseT(fc.last_obs), x1: parseT(fc.last_obs), yref: "paper", y0: 0, y1: 1, line: { color: C.orange, dash: "dash", width: 1.5 } }],
      annotations: [{ x: parseT(fc.last_obs), y: 1, yref: "paper", text: "mulai prediksi", showarrow: false, xanchor: "right", font: { color: C.orange, size: 11 } }] });
    $("#fcNote").textContent = `Data sebenarnya untuk 24 jam ini belum tersedia, jadi belum bisa dibandingkan. Rentang 80% artinya nilai sebenarnya diperkirakan berada di dalam area biru pada sekitar 8 dari 10 jam.`;
    table("fcTable", [{ label: "Waktu", get: r => nice(r.timestamp), left: true }, { key: "predicted_load_MWh", label: "Prediksi (MWh)" }, { key: "lower_PI80", label: "Batas bawah" }, { key: "upper_PI80", label: "Batas atas" }], rows,
      { best: (r, c) => c.key === "predicted_load_MWh" && r.h === rows[ip].h });
    $("#fcCsv").onclick = () => download(`prediksi_24jam_${m}.csv`, "timestamp,prediksi_MWh,batas_bawah,batas_atas\n" + rows.map(r => [r.timestamp, r.predicted_load_MWh, r.lower_PI80, r.upper_PI80].join(",")).join("\n"));
  };
  ["#fcModel", "#fcSc", "#fcHist", "#fcCI", "#fcAll"].forEach(s => $(s).onchange = draw); draw();
  initUserForecast();
}

/* ---- prediksi dengan data pengguna (XGBoost di browser) ---- */
function initUserForecast() {
  let U = null;                                         // { times: Date[], y: number[], sample: bool }
  const info = (html, cls = "") => $("#dataInfo").innerHTML = `<span class="${cls}">${html}</span>`;
  const accept = (times, y, sample = false) => {
    if (times.length < 168) return info(`Data hanya ${times.length} jam; dibutuhkan minimal 168 jam.`, "text-danger");
    for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] !== 3600e3)
      return info(`Ada jam yang hilang atau tidak berurutan di sekitar ${tstr(times[i - 1])}. Pastikan data per jam tanpa celah.`, "text-danger");
    if (y.some(v => !Number.isFinite(v))) return info("Ada nilai nat_demand yang kosong atau bukan angka.", "text-danger");
    U = { times, y, sample }; $("#runUser").disabled = false;
    info(`<i class="bi bi-check-circle text-success"></i> ${times.length} jam data siap (${tstr(times[0])} s.d. ${tstr(times.at(-1))}). Prediksi untuk 24 jam setelahnya.`);
  };
  $("#useSample").onclick = async () => {
    const [eda, meta] = await Promise.all([load("eda"), load("meta")]);
    const n = 24 * 14, T = hourSeq(eda.start, eda.values.length);
    $("#uSchool").checked = !!(await load("simulation")).school_last; $("#uHoliday").checked = false;
    accept(T.slice(-n), eda.values.slice(-n), true);
  };
  $("#dlTemplate").onclick = async () => {
    const eda = await load("eda"), T = hourSeq(eda.start, eda.values.length), n = 168;
    download("template_beban_listrik.csv", "datetime,nat_demand\n" + T.slice(-n).map((t, i) => `${tstr(t)},${eda.values[eda.values.length - n + i]}`).join("\n"));
  };
  const readFile = file => file.text().then(txt => {
    const lines = txt.trim().split(/\r?\n/), head = lines[0].split(/[,;]/).map(s => s.trim().toLowerCase());
    const it = head.indexOf("datetime"), iy = head.indexOf("nat_demand");
    if (it < 0 || iy < 0) return info("Kolom <span class='mono'>datetime</span> dan <span class='mono'>nat_demand</span> tidak ditemukan.", "text-danger");
    const rows = lines.slice(1).map(l => l.split(/[,;]/)).filter(c => c.length > Math.max(it, iy))
      .map(c => ({ t: new Date(c[it].trim().replace(" ", "T").slice(0, 16)), y: parseFloat(c[iy]) })).filter(r => !Number.isNaN(r.t.getTime())).sort((a, b) => a.t - b.t);
    rows.forEach(r => r.t.setMinutes(0, 0, 0));
    accept(rows.map(r => r.t), rows.map(r => r.y));
  });
  const dz = $("#dz"), fi = $("#fileIn");
  dz.onclick = () => fi.click(); fi.onchange = () => fi.files[0] && readFile(fi.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add("drag"); }; dz.ondragleave = () => dz.classList.remove("drag");
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove("drag"); e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]); };

  $("#runUser").onclick = async () => {
    if (!U) return;
    const btn = $("#runUser"), prog = $("#uProg"), bar = prog.querySelector(".progress-bar");
    btn.disabled = true; prog.classList.remove("d-none");
    try {
      await XGB.load(p => bar.style.width = `${Math.round(p * 90)}%`);
      bar.style.width = "95%"; await new Promise(r => setTimeout(r, 30));
      const hol = $("#uHoliday").checked ? 1 : 0, sch = $("#uSchool").checked ? 1 : 0;
      const out = XGB.forecast(U.y, U.times.at(-1), hol, sch);
      bar.style.width = "100%"; setTimeout(() => prog.classList.add("d-none"), 600);
      $("#uResultEmpty").classList.add("d-none"); $("#uResult").classList.remove("d-none");
      const yv = out.map(o => o.value), ip = argmax(yv);
      $("#uKpi").innerHTML = kpiCard("bi-activity", "Rata-rata", mean(yv), "MWh", "", "", "col-4") + kpiCard("bi-arrow-up-circle", "Tertinggi", yv[ip], "MWh", `pukul ${tstr(out[ip].time).slice(11)}`, "orange", "col-4")
        + kpiCard("bi-lightning-charge", "Total 24 jam", yv.reduce((a, b) => a + b, 0), "MWh", "", "green", "col-4");
      animateCounters($("#uKpi"));
      const nh = Math.min(168, U.y.length);
      plot("chUser", [{ x: U.times.slice(-nh), y: U.y.slice(-nh), name: "Data Anda", line: { color: C.navy, width: 2 } },
        { x: [U.times.at(-1), ...out.map(o => o.time)], y: [U.y.at(-1), ...yv], name: "Prediksi XGBoost", line: { color: C.cyan, width: 3 } },
        { x: [out[ip].time], y: [yv[ip]], mode: "markers", marker: { color: C.orange, size: 12, symbol: "star" }, name: "Puncak" }], { yaxis: { title: "MWh" } });
      const fcd = await load("forecast"), ck = XGB.meta.check;
      if (U.sample && tstr(U.times.at(-1)) === ck.origin && hol === ck.holiday && sch === ck.school) {
        const diff = Math.max(...yv.map((v, i) => Math.abs(v - ck.pred[i])));
        $("#uCheck").innerHTML = `<span class="text-success"><i class="bi bi-patch-check"></i> Hasil sama dengan perhitungan penelitian (selisih maksimum ${fmt(diff, 3)} MWh).</span>`;
      } else $("#uCheck").innerHTML = `<span class="text-muted2">Model: XGBoost tanpa cuaca (24 model, satu per jam).</span>`;
      $("#uCsv").onclick = () => download("prediksi_data_anda.csv", "timestamp,prediksi_MWh\n" + out.map(o => `${tstr(o.time)},${o.value.toFixed(2)}`).join("\n"));
    } catch (e) { console.error(e); info(`Gagal menjalankan prediksi: ${e.message}`, "text-danger"); prog.classList.add("d-none"); }
    btn.disabled = false;
  };
}

/* ================= SIMULASI ================= */
async function initSimulation() {
  const [sim, fc] = await Promise.all([load("simulation"), load("forecast")]);
  $("#simNote").innerHTML = `Simulasi memakai model <b>XGBoost dengan cuaca</b>, karena model utama (TimesFM) tidak memakai data cuaca. Garis ungu putus-putus adalah prediksi TimesFM sebagai pembanding. Hasil ini menunjukkan kepekaan model, bukan hubungan sebab-akibat yang pasti.`;
  $("#sSchool").value = String(sim.school_last);
  $("#qT").innerHTML = [-3, -2, -1, 0, 1, 2, 3].map(v => `<button class="btn btn-sm btn-ghost" data-t="${v}">${v > 0 ? "+" : ""}${v}°C</button>`).join("");
  $$("#qT [data-t]").forEach(b => b.onclick = () => { $("#sT").value = b.dataset.t; draw(); });
  const tx = sim.times.map(parseT), key = (cm, sc, dq, dt) => `${cm}|${sc}|${dq}|${Number(dt).toFixed(1)}`;
  const tfm = fc.rows.filter(r => r.model === "TimesFM" && r.skenario === "A").sort((a, b) => a.h - b.h).map(r => r.predicted_load_MWh);
  const draw = () => {
    const dT = +$("#sT").value, dQ = +$("#sQ").value, cm = $("#sCal").value, sc = +$("#sSchool").value;
    $("#vT").textContent = `${dT > 0 ? "+" : ""}${dT.toFixed(1)} °C`; $("#vQ").textContent = `${dQ > 0 ? "+" : ""}${dQ} %`;
    $$("#qT [data-t]").forEach(b => b.classList.toggle("active", +b.dataset.t === dT));
    const base = sim.grid[key("actual", sim.school_last, 0, 0)], scn = sim.grid[key(cm, sc, dQ, dT)];
    const ib = argmax(base), is = argmax(scn);
    $("#simKpi").innerHTML = [
      kpiCard("bi-activity", "Rata-rata awal", mean(base), "MWh", "", "", "col-6 col-xl-3"),
      kpiCard("bi-sliders", "Rata-rata skenario", mean(scn), "MWh", "", "violet", "col-6 col-xl-3"),
      kpiCard("bi-graph-up-arrow", "Puncak skenario", scn[is], "MWh", `awal: ${fmt(base[ib])} MWh`, "orange", "col-6 col-xl-3"),
      kpiCard("bi-alarm", "Jam puncak", sim.times[is].slice(11, 16), "", is === ib ? "sama dengan kondisi awal" : `awal: ${sim.times[ib].slice(11, 16)}`, "", "col-6 col-xl-3"),
    ].join(""); animateCounters($("#simKpi"));
    plot("chSim", [{ x: tx, y: base, name: "Kondisi awal", line: { color: C.navy, width: 2.5 } },
      { x: tx, y: scn, name: "Skenario", line: { color: C.cyan, width: 3 }, fill: "tonexty", fillcolor: "rgba(245,158,11,.10)" },
      { x: tx, y: tfm, name: "TimesFM (pembanding)", line: { color: C.violet, width: 1.5, dash: "dot" } },
      { x: [tx[is]], y: [scn[is]], mode: "markers", marker: { color: C.orange, size: 12, symbol: "star" }, name: "Puncak skenario" }], { yaxis: { title: "MWh" } });
  };
  ["#sT", "#sQ"].forEach(s => $(s).oninput = draw); ["#sCal", "#sSchool"].forEach(s => $(s).onchange = draw);
  $("#simReset").onclick = () => { $("#sT").value = 0; $("#sQ").value = 0; $("#sCal").value = "actual"; $("#sSchool").value = String(sim.school_last); draw(); };
  draw();
}

/* ---------------- start ---------------- */
route();
load("meta").then(m => $("#genTime").textContent = m.generated.slice(0, 10)).catch(() => {});
