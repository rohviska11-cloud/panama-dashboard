/* PANAMA POWER ANALYTICS — static dashboard (GitHub Pages).
   Semua angka dibaca dari ./data/*.json yang dibangun oleh scripts/build_data.py dari hasil notebook BAB I & II. */
"use strict";

const C = { navy: "#1e3a8a", hist: "#60a5fa", cyan: "#22d3ee", orange: "#f59e0b", violet: "#8b5cf6", green: "#10b981", red: "#f43f5e", muted: "#93a3c7", text: "#e6ecff" };
const MODEL_COLOR = { SARIMAX: "#60a5fa", XGBoost: "#f59e0b", TimesFM: "#a78bfa", "Naive-24": "#64748b", "Naive-168": "#94a3b8" };
const SC_LABEL = { A: "A · tanpa cuaca", B: "B · ramalan cuaca", C: "C · cuaca aktual (oracle)", "-": "baseline" };
const LOC = { toc: "Tocumen", san: "Santiago", dav: "David" };
const LOC_COLOR = { toc: "#22d3ee", san: "#a78bfa", dav: "#f59e0b" };
const BASE_NAME = { T2M: "Suhu", QV2M: "Kelembapan (QV2M)", TQL: "Presipitasi cair (TQL)", W2M: "Kecepatan angin" };
const DOW = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HOURS = [...Array(24).keys()].map(h => `${String(h).padStart(2, "0")}:00`);
const D = {};                       // cache data JSON
const inited = {};                  // halaman yang sudah dirender

/* ---------------- util ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x)) ? "—" : Number(x).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const load = async name => D[name] ?? (D[name] = await fetch(`data/${name}.json`).then(r => { if (!r.ok) throw new Error(name); return r.json(); }));
const parseT = s => new Date(s.replace(" ", "T"));
const tstr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
const hourSeq = (start, n, stepH = 1) => { const t0 = parseT(start).getTime(); return Array.from({ length: n }, (_, i) => new Date(t0 + i * stepH * 3600e3)); };
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const argmax = a => a.reduce((b, v, i) => v > a[b] ? i : b, 0);
const argmin = a => a.reduce((b, v, i) => v < a[b] ? i : b, 0);
const varName = v => { const [b, l] = v.split("_"); return `${BASE_NAME[b] || b} · ${LOC[l] || l}`; };

const baseLayout = (extra = {}) => Object.assign({
  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { family: "Inter, sans-serif", color: C.text, size: 12 },
  margin: { l: 56, r: 18, t: 18, b: 44 }, hovermode: "x unified",
  hoverlabel: { bgcolor: "#0e1832", bordercolor: "#22d3ee", font: { color: "#e6ecff" } },
  xaxis: { gridcolor: "rgba(148,178,255,.08)", zerolinecolor: "rgba(148,178,255,.15)", linecolor: "rgba(148,178,255,.2)" },
  yaxis: { gridcolor: "rgba(148,178,255,.08)", zerolinecolor: "rgba(148,178,255,.15)", linecolor: "rgba(148,178,255,.2)" },
  legend: { orientation: "h", y: 1.12, x: 0, bgcolor: "rgba(0,0,0,0)" },
  transition: { duration: 500, easing: "cubic-in-out" },
}, extra);
const cfg = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] };
function plot(id, traces, layout) {
  const el = document.getElementById(id);
  el.classList.remove("skeleton"); el.classList.add("fade-swap");
  setTimeout(() => el.classList.remove("fade-swap"), 500);
  return Plotly.react(el, traces, baseLayout(layout), cfg);
}
function kpiCard(icon, label, value, unit = "", note = "", cls = "", col = "col-6 col-md-4 col-xl") {
  return `<div class="${col}"><div class="card-x kpi ${cls}"><div class="label"><i class="bi ${icon}"></i>${label}</div>
    <div class="value" ${typeof value === "string" && value.length > 9 ? 'style="font-size:17px"' : ""}><span class="count" data-v="${typeof value === "number" ? value : ""}">${typeof value === "number" ? "0" : value}</span>${unit ? `<small>${unit}</small>` : ""}</div>
    <div class="note">${note}</div></div></div>`;
}
function animateCounters(root) {
  root.querySelectorAll(".count[data-v]").forEach(el => {
    const v = parseFloat(el.dataset.v); if (Number.isNaN(v)) return;
    const dec = Math.abs(v) < 10 && v % 1 !== 0 ? 2 : (v % 1 !== 0 && Math.abs(v) < 1000 ? 1 : 0);
    const t0 = performance.now(), dur = 1100;
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(v * e, dec); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function table(id, cols, rows, opts = {}) {
  const head = `<thead><tr>${cols.map(c => `<th class="${c.left ? "tl" : ""}">${c.label}</th>`).join("")}</tr></thead>`;
  const body = rows.map(r => `<tr>${cols.map(c => {
    const v = typeof c.get === "function" ? c.get(r) : r[c.key];
    const best = opts.best && opts.best(r, c) ? "best" : "";
    return `<td class="${c.left ? "tl" : ""} ${best}">${typeof v === "number" ? fmt(v, c.d ?? 2) : (v ?? "—")}</td>`;
  }).join("")}</tr>`).join("");
  document.getElementById(id).innerHTML = head + `<tbody>${body}</tbody>`;
}
const renderMath = el => window.renderMathInElement && renderMathInElement(el, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }], throwOnError: false });

/* ---------------- router & nav ---------------- */
const PAGES = { overview: initOverview, exploration: initExploration, weather: initWeather, performance: initPerformance, explanation: initExplanation, forecast: initForecast, simulation: initSimulation };
function moveIndicator() {
  const a = $(".nav-list a.active"); if (!a) return;
  $("#navInd").style.transform = `translateY(${a.parentElement.offsetTop}px)`;
}
async function route() {
  const page = (location.hash || "#overview").slice(1).split("/")[0];
  const key = PAGES[page] ? page : "overview";
  $$(".page").forEach(p => p.classList.remove("show"));
  $(`#page-${key}`).classList.add("show");
  $$(".nav-list a").forEach(a => a.classList.toggle("active", a.dataset.page === key));
  moveIndicator(); $("#sidebar").classList.remove("open"); window.scrollTo({ top: 0, behavior: "smooth" });
  if (!inited[key]) {
    inited[key] = true;
    try { await PAGES[key](); } catch (e) { console.error(e); $(`#page-${key}`).insertAdjacentHTML("beforeend", `<div class="callout mt-3">Data halaman ini belum tersedia (${e.message}). Jalankan <span class="mono">scripts/build_data.py</span>.</div>`); }
  } else { $$(`#page-${key} .js-plotly-plot`).forEach(el => Plotly.Plots.resize(el)); }
}
window.addEventListener("hashchange", route);
window.addEventListener("resize", moveIndicator);
$("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

/* ================= 1. OVERVIEW ================= */
async function initOverview() {
  const [meta, eda, lp, wp] = await Promise.all([load("meta"), load("eda"), load("load_perf"), load("weather_perf")]);
  $("#genTime").textContent = meta.generated;
  const k = meta.kpi;
  $("#chipPeriod").textContent = `${k.start.slice(0, 10)} – ${k.end.slice(0, 10)}`;
  // hero line dari profil rata-rata 2 minggu terakhir data aktual
  const v = eda.values.slice(-24 * 7 * 2), mn = Math.min(...v), mx = Math.max(...v);
  const pts = v.map((y, i) => [i / (v.length - 1) * 1200, 280 - (y - mn) / (mx - mn) * 190]);
  const dLine = "M" + pts.map(p => p.map(n => n.toFixed(1)).join(",")).join(" L");
  $("#heroLine").setAttribute("d", dLine); $("#heroArea").setAttribute("d", dLine + " L1200,300 L0,300 Z");
  $("#heroGrid").innerHTML = [...Array(12).keys()].map(i => `<line class="grid-pulse" x1="${i * 100}" y1="0" x2="${i * 100}" y2="300"/>`).join("");

  $("#kpiOverview").innerHTML = [
    kpiCard("bi-collection", "Total observasi", k.n_obs, "jam", `${meta.variables.length} kolom data`),
    kpiCard("bi-calendar-range", "Periode", `${k.start.slice(0, 4)}–${k.end.slice(0, 4)}`, "", `${k.start} s.d. ${k.end}`),
    kpiCard("bi-activity", "Rata-rata beban", k.mean, "MWh", "nat_demand per jam"),
    kpiCard("bi-arrow-up-circle", "Beban maksimum", k.max, "MWh", k.max_time, "orange"),
    kpiCard("bi-arrow-down-circle", "Beban minimum", k.min, "MWh", `${k.min_time} (lihat anomali)`, "violet"),
    kpiCard("bi-cloud-sun", "Variabel cuaca", k.n_weather, "", "4 variabel × 3 wilayah", "green"),
    kpiCard("bi-clock-history", "Frekuensi", "Hourly", "", "1 observasi / jam"),
  ].join("");
  animateCounters($("#kpiOverview"));

  const nX = wp.summary.filter(r => r["Model terpilih"] === "XGBoost").length;
  $("#ovWeatherSel").innerHTML = `Model terpilih (validasi): <b>XGBoost</b> untuk ${nX} variabel, <b>SARIMAX</b> untuk ${wp.summary.length - nX} variabel.`;
  const ba = lp.registry.best_accuracy, bo = lp.registry.best_operational;
  $("#ovLoadSel").innerHTML = `Terbaik berdasarkan akurasi: <b>${ba.model} (${SC_LABEL[ba.skenario]})</b> · operasional: <b>${bo.model} (${SC_LABEL[bo.skenario]})</b>.`;

  const crit = lp.criteria.find(r => r.model === ba.model && r.skenario === ba.skenario);
  const op = lp.criteria.find(r => r.model === bo.model && r.skenario === bo.skenario);
  const el = $("#ovHighlight");
  if (!crit) { el.innerHTML = `<div class="col-12"><div class="callout">Hasil evaluasi belum dipublikasikan.</div></div>`; return; }
  el.innerHTML = `
    <div class="col-lg-4"><div class="card-x"><span class="badge-best"><i class="bi bi-trophy"></i> Terbaik · akurasi</span>
      <div class="big-model mt-2">${ba.model}</div><div class="sub">${SC_LABEL[ba.skenario]} · dipilih dengan MAE validasi 2019</div>
      <div class="small">Test MAE ${fmt(crit["Test MAE"], 2)} MWh · Test/Val ${fmt(crit["Test/Val"], 3)}</div></div></div>
    ${kpiCard("bi-bullseye", "MAE terbaik (validasi)", crit["Val MAE"], "MWh", `test ${fmt(crit["Test MAE"], 2)} MWh`, "", "col-6 col-lg-2")}
    ${kpiCard("bi-graph-down", "RMSE terbaik (validasi)", crit["Val RMSE"], "MWh", `test ${fmt(crit["Test RMSE"], 2)} MWh`, "", "col-6 col-lg-2")}
    <div class="col-lg-4"><div class="card-x"><span class="badge-best badge-op"><i class="bi bi-gear"></i> Operasional</span>
      <div class="big-model mt-2">${bo.model}</div><div class="sub">${SC_LABEL[bo.skenario]} · ${op && op["butuh ramalan cuaca"] ? "butuh ramalan cuaca" : "tidak butuh ramalan cuaca"}</div>
      <div class="small">Dipakai untuk ramalan 24 jam (Halaman 6).</div></div></div>`;
  animateCounters(el);
}

/* ================= 2. EXPLORATION ================= */
async function initExploration() {
  const eda = await load("eda");
  const T = hourSeq(eda.start, eda.values.length);
  const years = [...new Set(T.map(t => t.getFullYear()))];
  $("#exYear").innerHTML = `<option value="">Semua</option>` + years.map(y => `<option>${y}</option>`).join("");
  $("#exMonth").innerHTML = `<option value="">Semua</option>` + MON.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  const drawTs = () => {
    const yr = $("#exYear").value, mo = $("#exMonth").value;
    const f = $("#exFrom").value ? new Date($("#exFrom").value) : null, t = $("#exTo").value ? new Date($("#exTo").value + "T23:59") : null;
    const x = [], y = [];
    for (let i = 0; i < T.length; i++) {
      const d = T[i];
      if (yr && d.getFullYear() !== +yr) continue; if (mo && d.getMonth() + 1 !== +mo) continue;
      if (f && d < f) continue; if (t && d > t) continue;
      x.push(d); y.push(eda.values[i]);
    }
    plot("chTs", [{ x, y, type: "scattergl", mode: "lines", line: { color: C.cyan, width: 1 }, name: "nat_demand", hovertemplate: "%{y:,.1f} MWh<extra></extra>" }],
      { yaxis: { title: "MWh", gridcolor: "rgba(148,178,255,.08)" }, xaxis: { rangeslider: { visible: true, bgcolor: "rgba(19,32,63,.6)", thickness: .08 }, gridcolor: "rgba(148,178,255,.08)",
        rangeselector: { buttons: [{ count: 7, label: "1m", step: "day", stepmode: "backward" }, { count: 1, label: "1b", step: "month", stepmode: "backward" }, { count: 1, label: "1t", step: "year", stepmode: "backward" }, { step: "all", label: "semua" }], bgcolor: "#13203f", activecolor: "#22d3ee", font: { color: "#e6ecff" } } } });
  };
  drawTs();
  $("#exApply").onclick = drawTs;
  $("#exReset").onclick = () => { ["#exYear", "#exMonth", "#exFrom", "#exTo"].forEach(s => $(s).value = ""); drawTs(); };

  const hmax = argmax(eda.hourly), hmin = argmin(eda.hourly);
  plot("chHourly", [{ x: HOURS, y: eda.hourly, type: "scatter", mode: "lines+markers", fill: "tozeroy", fillcolor: "rgba(34,211,238,.08)", line: { color: C.cyan, width: 3, shape: "spline" }, name: "Rata-rata", hovertemplate: "%{x}: %{y:,.1f} MWh<extra></extra>" },
    { x: [HOURS[hmax]], y: [eda.hourly[hmax]], mode: "markers", marker: { color: C.orange, size: 14, symbol: "star" }, name: "Tertinggi" },
    { x: [HOURS[hmin]], y: [eda.hourly[hmin]], mode: "markers", marker: { color: C.violet, size: 12, symbol: "diamond" }, name: "Terendah" }],
    { yaxis: { title: "MWh", range: [Math.min(...eda.hourly) * 0.92, Math.max(...eda.hourly) * 1.04] } });
  $("#kpiHourly").innerHTML = kpiCard("bi-sunrise", "Jam beban tertinggi", HOURS[hmax], "", `${fmt(eda.hourly[hmax])} MWh rata-rata`, "orange", "col-12")
    + kpiCard("bi-moon-stars", "Jam beban terendah", HOURS[hmin], "", `${fmt(eda.hourly[hmin])} MWh rata-rata`, "violet", "col-12")
    + kpiCard("bi-arrows-expand", "Rentang harian", eda.hourly[hmax] - eda.hourly[hmin], "MWh", `${fmt((eda.hourly[hmax] / eda.hourly[hmin] - 1) * 100)}% di atas jam terendah`, "", "col-12");
  animateCounters($("#kpiHourly"));

  plot("chDow", [{ x: DOW, y: eda.dow, type: "bar", marker: { color: eda.dow.map((_, i) => i >= 5 ? C.violet : C.cyan) }, hovertemplate: "%{x}: %{y:,.1f} MWh<extra></extra>" }],
    { yaxis: { title: "MWh", range: [Math.min(...eda.dow) * 0.9, Math.max(...eda.dow) * 1.03] }, hovermode: "closest" });
  plot("chWdWe", [{ x: HOURS, y: eda.hourly_wd, name: "Hari kerja", line: { color: C.cyan, width: 3, shape: "spline" } },
    { x: HOURS, y: eda.hourly_we, name: "Akhir pekan", line: { color: C.violet, width: 3, shape: "spline", dash: "dot" } }], { yaxis: { title: "MWh" } });
  plot("chHeat", [{ z: eda.heat, x: HOURS, y: DOW, type: "heatmap", colorscale: [[0, "#0b1736"], [.5, "#1d4ed8"], [.8, "#22d3ee"], [1, "#f59e0b"]], hovertemplate: "%{y} %{x}<br>%{z:,.1f} MWh<extra></extra>", colorbar: { title: "MWh", thickness: 10 } }],
    { yaxis: { autorange: "reversed" }, hovermode: "closest", margin: { l: 64, r: 10, t: 10, b: 44 } });
  plot("chBoxMonth", [{ type: "box", x: MON, q1: eda.box_month.map(b => b.q1), median: eda.box_month.map(b => b.median), q3: eda.box_month.map(b => b.q3), lowerfence: eda.box_month.map(b => b.lower),
    upperfence: eda.box_month.map(b => b.upper), mean: eda.box_month.map(b => b.mean), marker: { color: C.cyan }, line: { color: C.cyan }, fillcolor: "rgba(34,211,238,.15)", name: "nat_demand" }],
    { yaxis: { title: "MWh" }, hovermode: "closest", showlegend: false });

  const s = eda.stats;
  $("#kpiStats").innerHTML = [["Mean", s.mean], ["Median", s.median], ["Std. dev.", s.std], ["Minimum", s.min], ["Maximum", s.max], ["Q1", s.q1], ["Q3", s.q3]]
    .map(([l, v]) => kpiCard("bi-bar-chart", l, v, "MWh", "", "", "col-6 col-md-3 col-xl")).join("");
  animateCounters($("#kpiStats"));
  const mid = eda.hist.edges.slice(0, -1).map((e, i) => (e + eda.hist.edges[i + 1]) / 2);
  plot("chHist", [{ x: mid, y: eda.hist.counts, type: "bar", marker: { color: "rgba(96,165,250,.55)", line: { color: "#60a5fa", width: .5 } }, name: "Frekuensi", hovertemplate: "%{x:,.0f} MWh: %{y} jam<extra></extra>" },
    { x: eda.kde.x, y: eda.kde.y, mode: "lines", line: { color: C.orange, width: 2.5 }, name: "Density (KDE)" }],
    { bargap: .02, xaxis: { title: "MWh" }, yaxis: { title: "jumlah jam" }, hovermode: "closest" });
  plot("chBoxAll", [{ type: "box", y: [s.median], q1: [s.q1], median: [s.median], q3: [s.q3], lowerfence: [Math.max(s.min, s.q1 - 1.5 * (s.q3 - s.q1))], upperfence: [Math.min(s.max, s.q3 + 1.5 * (s.q3 - s.q1))],
    mean: [s.mean], x: ["nat_demand"], marker: { color: C.cyan }, fillcolor: "rgba(34,211,238,.15)", line: { color: C.cyan } }], { hovermode: "closest", showlegend: false, yaxis: { title: "MWh" } });

  const mmax = argmax(eda.month), mmin = argmin(eda.month);
  const yrs = Object.entries(eda.year);
  const ins = [
    ["bi-clock", `Beban rata-rata tertinggi terjadi pukul <b>${HOURS[hmax]}</b> (${fmt(eda.hourly[hmax])} MWh) dan terendah pukul <b>${HOURS[hmin]}</b> (${fmt(eda.hourly[hmin])} MWh), selisih ${fmt(eda.hourly[hmax] - eda.hourly[hmin])} MWh.`],
    ["bi-calendar-month", `Bulan dengan rata-rata tertinggi: <b>${MON[mmax]}</b> (${fmt(eda.month[mmax])} MWh); terendah: <b>${MON[mmin]}</b> (${fmt(eda.month[mmin])} MWh).`],
    ["bi-briefcase", `Rata-rata hari kerja ${fmt(eda.weekday_mean)} MWh vs akhir pekan ${fmt(eda.weekend_mean)} MWh: akhir pekan <b>${fmt((eda.weekend_mean / eda.weekday_mean - 1) * 100)}%</b> terhadap hari kerja.`],
    ["bi-flag", `Hari libur rata-rata ${fmt(eda.holiday_mean)} MWh, atau <b>${fmt((eda.holiday_mean / eda.nonholiday_mean - 1) * 100)}%</b> terhadap hari non-libur.`],
    ["bi-arrows-angle-expand", `Variasi beban: simpangan baku ${fmt(s.std)} MWh, koefisien variasi <b>${fmt(s.cv * 100)}%</b>; IQR ${fmt(s.q3 - s.q1)} MWh.`],
    ["bi-graph-up-arrow", `Rata-rata per tahun: ${yrs.map(([y, v]) => `${y} ${fmt(v, 0)}`).join(" · ")} MWh (2015 dan 2020 tidak satu tahun penuh: ${yrs.map(([y]) => `${y} ${fmt(eda.year_n[y], 0)} jam`).filter((_, i) => i === 0 || i === yrs.length - 1).join(", ")}).`],
  ];
  $("#exInsights").innerHTML = ins.map(([i, t]) => `<li><i class="bi ${i}"></i><span>${t}</span></li>`).join("");
}

/* ================= 3. WEATHER ================= */
async function initWeather() {
  const [wx, meta] = await Promise.all([load("weather"), load("meta")]);
  const u = meta.units;
  if (window.L) {
    const map = L.map("map", { scrollWheelZoom: false, attributionControl: true }).setView([8.6, -80.9], 7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap © CARTO", maxZoom: 12 }).addTo(map);
    meta.locations.forEach(l => {
      const pl = wx.kpi.per_loc[l.code];
      L.circleMarker([l.lat, l.lon], { radius: 10, color: LOC_COLOR[l.code], fillColor: LOC_COLOR[l.code], fillOpacity: .55, weight: 2 }).addTo(map)
        .bindPopup(`<b>${l.name}</b><br>T2M rata-rata ${fmt(pl.T2M, 2)} °C<br>W2M rata-rata ${fmt(pl.W2M, 2)} m/s`);
    });
  } else { $("#map").innerHTML = `<div class="p-3 small text-muted2">Peta tidak dapat dimuat (offline).</div>`; }
  const k = wx.kpi;
  $("#kpiWeather").innerHTML = [
    kpiCard("bi-thermometer-half", "Rata-rata suhu", k.T2M_mean, "°C", "3 wilayah, T2M", "orange", "col-6 col-md-4"),
    kpiCard("bi-thermometer-sun", "Suhu maksimum", k.T2M_max, "°C", `${k.T2M_max_loc}, ${k.T2M_max_time}`, "orange", "col-6 col-md-4"),
    kpiCard("bi-droplet", "Rata-rata QV2M", `${fmt(k.QV2M_mean * 1000, 2)}`, "g/kg", "kelembapan spesifik (data: kg/kg)", "", "col-6 col-md-4"),
    kpiCard("bi-cloud-rain", "Rata-rata TQL", `${fmt(k.TQL_mean, 3)}`, "l/m²", "presipitasi cair (satuan README)", "violet", "col-6 col-md-4"),
    kpiCard("bi-wind", "Kecepatan angin rata-rata", k.W2M_mean, "m/s", "W2M, 3 wilayah", "green", "col-6 col-md-4"),
    kpiCard("bi-geo", "Wilayah", 3, "", "Tocumen · Santiago · David", "", "col-6 col-md-4"),
  ].join("");
  animateCounters($("#kpiWeather"));

  const Td = hourSeq(wx.daily_start, wx.daily.T2M_toc.length, 24);
  plot("chTemp", Object.keys(LOC).map(l => ({ x: Td, y: wx.daily[`T2M_${l}`], name: LOC[l], mode: "lines", line: { color: LOC_COLOR[l], width: 1.2 } })),
    { yaxis: { title: "°C" }, xaxis: { rangeslider: { visible: true, thickness: .07, bgcolor: "rgba(19,32,63,.6)" } } });
  plot("chTempHour", Object.keys(LOC).map(l => ({ x: HOURS, y: wx.hourly[`T2M_${l}`], name: LOC[l], line: { color: LOC_COLOR[l], width: 2.5, shape: "spline" } })), { yaxis: { title: "°C" } });
  plot("chTempMonth", Object.keys(LOC).map(l => ({ x: MON, y: wx.monthly[`T2M_${l}`], name: LOC[l], line: { color: LOC_COLOR[l], width: 2.5, shape: "spline" }, mode: "lines+markers" })), { yaxis: { title: "°C" } });

  const drawWx = () => {
    const b = $("#wxVar").value, unit = u[`${b}_toc`] || "";
    $("#wxUnit").textContent = `Satuan: ${unit}`;
    plot("chWxTrend", Object.keys(LOC).map(l => ({ x: Td, y: wx.daily[`${b}_${l}`], name: LOC[l], mode: "lines", line: { color: LOC_COLOR[l], width: 1.1 } })),
      { yaxis: { title: unit }, xaxis: { rangeslider: { visible: true, thickness: .07, bgcolor: "rgba(19,32,63,.6)" } } });
    plot("chWxDist", Object.keys(LOC).map(l => { const h = wx.hist[`${b}_${l}`]; return { x: h.edges.slice(0, -1).map((e, i) => (e + h.edges[i + 1]) / 2), y: h.counts, name: LOC[l], mode: "lines", line: { color: LOC_COLOR[l], width: 2, shape: "hvh" }, fill: "tozeroy", fillcolor: LOC_COLOR[l] + "22" }; }),
      { xaxis: { title: unit }, yaxis: { title: "jumlah jam" }, hovermode: "closest" });
  };
  $("#wxVar").onchange = drawWx; drawWx();

  const cols = wx.corr.cols, P = wx.corr.pearson, S = wx.corr.spearman;
  const wv = cols.slice(1);
  $("#scVar").innerHTML = wv.map(v => `<option value="${v}">${varName(v)}</option>`).join("");
  const drawSc = () => {
    const v = $("#scVar").value, j = cols.indexOf(v), byHour = $("#scColor").value === "hour";
    $("#scStats").innerHTML = `<span class="chip">Pearson r = <b class="ms-1">${fmt(P[0][j], 3)}</b></span><span class="chip">Spearman ρ = <b class="ms-1">${fmt(S[0][j], 3)}</b></span>`;
    plot("chScatter", [{ x: wx.scatter[v], y: wx.scatter.nat_demand, mode: "markers", type: "scattergl",
      marker: byHour ? { color: wx.scatter_hour, colorscale: "Turbo", size: 5, opacity: .65, colorbar: { title: "jam", thickness: 10 } } : { color: C.cyan, size: 5, opacity: .45 },
      hovertemplate: `${v}: %{x}<br>beban: %{y:,.1f} MWh<extra></extra>` }],
      { xaxis: { title: `${varName(v)} (${u[v] || ""})` }, yaxis: { title: "nat_demand (MWh)" }, hovermode: "closest" });
  };
  $("#scVar").onchange = drawSc; $("#scColor").onchange = drawSc; drawSc();

  const drawCorr = which => {
    const M = which === "spearman" ? S : P;
    plot("chCorr", [{ z: M, x: cols, y: cols, type: "heatmap", zmin: -1, zmax: 1, colorscale: [[0, "#f43f5e"], [.5, "#0e1832"], [1, "#22d3ee"]], text: M.map(r => r.map(v => v.toFixed(2))), texttemplate: "%{text}", textfont: { size: 9 },
      hovertemplate: "%{y} × %{x}: %{z:.3f}<extra></extra>", colorbar: { thickness: 10 } }],
      { yaxis: { autorange: "reversed" }, hovermode: "closest", margin: { l: 80, r: 10, t: 10, b: 80 } });
  };
  $$("[data-corr]").forEach(b => b.onclick = () => { $$("[data-corr]").forEach(x => x.classList.remove("active")); b.classList.add("active"); drawCorr(b.dataset.corr); });
  drawCorr("pearson");

  const strength = r => { const a = Math.abs(r); return a < .1 ? "sangat lemah" : a < .3 ? "lemah" : a < .5 ? "sedang" : a < .7 ? "kuat" : "sangat kuat"; };
  const ranked = wv.map(v => ({ v, r: P[0][cols.indexOf(v)], s: S[0][cols.indexOf(v)] })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  $("#corrInsights").innerHTML = ranked.slice(0, 4).map(o => `<li><i class="bi bi-link-45deg"></i><span><b>${varName(o.v)}</b>: Pearson ${fmt(o.r, 3)} (${strength(o.r)}, ${o.r >= 0 ? "positif" : "negatif"}), Spearman ${fmt(o.s, 3)}.</span></li>`).join("")
    + `<li><i class="bi bi-arrow-down-short"></i><span>Paling lemah: <b>${varName(ranked.at(-1).v)}</b> (Pearson ${fmt(ranked.at(-1).r, 3)}).</span></li>`;

  const base = ["T2M", "QV2M", "TQL", "W2M"].map(b => ({ b, r: mean(Object.keys(LOC).map(l => P[0][cols.indexOf(`${b}_${l}`)])) }));
  const tPair = mean([[1, 5], [1, 9], [5, 9]].map(([i, j]) => P[i][j]));
  const wi = wx.corr_within_hour || [];
  $("#wxInsights").innerHTML = [
    `Rata-rata korelasi Pearson tiap kelompok variabel dengan beban: ${base.map(o => `${BASE_NAME[o.b]} ${fmt(o.r, 3)}`).join(" · ")}.`,
    `Variabel dengan |r| terbesar: <b>${varName(ranked[0].v)}</b> (${fmt(ranked[0].r, 3)}).`,
    `Suhu antarwilayah saling berkorelasi (rata-rata r = ${fmt(tPair, 3)}), sehingga ketiga deret membawa informasi yang tumpang tindih (multikolinearitas).`,
    wi.length ? `Analisis BAB II: setelah membandingkan pada jam yang sama (menghilangkan siklus harian), korelasi beban–cuaca jauh lebih kecil daripada korelasi per jam di atas. Lihat tabel evaluasi BAB II.` : null,
    `Sejalan dengan itu, pada BAB II penambahan cuaca tidak memperbaiki akurasi ramalan beban secara signifikan (Halaman 4-B).`,
  ].filter(Boolean).map(t => `<li><i class="bi bi-lightbulb"></i><span>${t}</span></li>`).join("");
}

/* ================= 4. PERFORMANCE ================= */
async function initPerformance() {
  $$("#perfTabs .nav-link").forEach(b => b.onclick = () => {
    $$("#perfTabs .nav-link").forEach(x => x.classList.remove("active")); b.classList.add("active");
    $$(".ptab").forEach(t => t.classList.add("d-none")); $(`#tab-${b.dataset.tab}`).classList.remove("d-none");
    $$(`#tab-${b.dataset.tab} .js-plotly-plot`).forEach(el => Plotly.Plots.resize(el));
    if (b.dataset.tab === "pl" && !inited.pl) { inited.pl = true; initPerfLoad(); }
    if (b.dataset.tab === "ps" && !inited.ps) { inited.ps = true; initPerfSel(); }
    if (b.dataset.tab === "pi" && !inited.pi) { inited.pi = true; initPerfImp(); }
  });
  const wp = await load("weather_perf"); const meta = await load("meta");
  $("#pwVar").innerHTML = wp.vars.map(v => `<option value="${v}">${varName(v)} (${v})</option>`).join("");
  const draw = async () => {
    const v = $("#pwVar").value, rows = wp.table.filter(r => r.Variabel === v), unit = meta.units[v] || "";
    const sel = wp.selection.find(r => r.variabel === v);
    $("#pwSel").innerHTML = sel ? `Terpilih: <b>${sel.model_terpilih}</b> (${sel.dasar}) · satuan ${unit}` : "";
    const dd = v.startsWith("QV2M") ? 6 : 4;
    table("pwTable", [{ key: "Model", label: "Model", left: true }, { label: "Terpilih", get: r => r.Terpilih ? "✔" : "", left: true },
      { key: "Train fit MAE", label: "Train fit MAE", d: dd }, { key: "Train rolling MAE", label: "Train rolling MAE", d: dd }, { key: "Val MAE", label: "Val MAE", d: dd },
      { key: "Test MAE", label: "Test MAE", d: dd }, { key: "Test RMSE", label: "Test RMSE", d: dd }, { key: "Test sMAPE", label: "Test sMAPE (%)", d: 3 }, { key: "Test MASE", label: "Test MASE", d: 3 }],
      rows, { best: (r, c) => c.key === "Val MAE" && r["Val MAE"] === Math.min(...rows.map(x => x["Val MAE"])) });
    const sets = ["Train rolling MAE", "Val MAE", "Test MAE"];
    plot("chPwMae", rows.map(r => ({ x: ["Train rolling", "Validasi", "Test"], y: sets.map(s => r[s]), name: r.Model, type: "bar", marker: { color: MODEL_COLOR[r.Model] } })), { yaxis: { title: unit }, hovermode: "closest" });
    plot("chPwRmse", rows.map(r => ({ x: ["Test RMSE", "Test MASE ×scale"], y: [r["Test RMSE"], r["Test MASE"] * rows[0]["Test RMSE"]], customdata: [r["Test RMSE"], r["Test MASE"]], name: r.Model, type: "bar", marker: { color: MODEL_COLOR[r.Model] },
      hovertemplate: "%{customdata:.4f}<extra>" + r.Model + "</extra>" })), { hovermode: "closest", yaxis: { title: unit + " (MASE diskalakan agar sebanding)" } });
    const hz = wp.horizon[v];
    plot("chPwH", Object.entries(hz).map(([k, o]) => { const [m, s] = k.split("|"); return { x: [...Array(24).keys()].map(i => i + 1), y: o.MAE, name: `${m} · ${s === "test" ? "test" : "val"}`, line: { color: MODEL_COLOR[m], dash: s === "test" ? "solid" : "dot", width: 2 } }; }),
      { xaxis: { title: "horizon (jam)", dtick: 2 }, yaxis: { title: `MAE (${unit})` } });
    const ts = await load(`wperf_ts_${v}`);
    const tt = ts.times.map(parseT);
    plot("chPwTs", [{ x: tt, y: ts.actual, name: "Aktual", line: { color: "#e6ecff", width: 1 } },
      ...["SARIMAX", "XGBoost"].filter(m => ts[m]).map(m => ({ x: tt, y: ts[m], name: m, line: { color: MODEL_COLOR[m], width: 1 } }))],
      { yaxis: { title: unit }, xaxis: { rangeslider: { visible: true, thickness: .07, bgcolor: "rgba(19,32,63,.6)" }, range: [tt[0], tt[24 * 14]] } });
  };
  $("#pwVar").onchange = draw; await draw();
  const ms = ["SARIMAX", "XGBoost"].map(m => ({ x: wp.vars, y: wp.vars.map(v => (wp.table.find(r => r.Variabel === v && r.Model === m) || {})["Test MASE"]), name: m, type: "bar", marker: { color: MODEL_COLOR[m] } }));
  plot("chPwMase", ms, { hovermode: "closest", shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 1, y1: 1, line: { color: C.red, dash: "dash" } }], yaxis: { title: "MASE" } });
}

async function initPerfLoad() {
  const lp = await load("load_perf");
  const main = lp.main.filter(r => r.Skenario !== "Baseline");
  const SCN = { "Tanpa cuaca": "A", "Prediksi cuaca": "B", "Oracle weather": "C" };
  const avail = [...new Set(main.filter(r => r["Val MAE"] !== null).map(r => SCN[r.Skenario]))];
  $("#plScen").innerHTML = avail.map(s => `<div class="form-check"><input class="form-check-input sc-chk" type="checkbox" value="${s}" id="sc${s}" checked><label class="form-check-label small" for="sc${s}">${SC_LABEL[s]}</label></div>`).join("");
  const draw = () => {
    const on = $$(".sc-chk").filter(c => c.checked).map(c => c.value);
    const rows = lp.main.filter(r => r.Skenario === "Baseline" || on.includes(SCN[r.Skenario]));
    const minV = Math.min(...rows.filter(r => r.Skenario !== "Baseline").map(r => r["Val MAE"]));
    table("plTable", [{ key: "Skenario", label: "Skenario", left: true }, { key: "Model", label: "Model", left: true }, { key: "Train MAE (fit)", label: "Train MAE (fit)" }, { key: "Train rolling MAE", label: "Train rolling MAE" },
      { key: "Val MAE", label: "Val MAE" }, { key: "Val RMSE", label: "Val RMSE" }, { key: "Test MAE", label: "Test MAE" }, { key: "Test RMSE", label: "Test RMSE" }, { key: "Test MAPE", label: "Test MAPE (%)" }, { key: "Test sMAPE", label: "Test sMAPE (%)" }],
      rows, { best: (r, c) => c.key === "Val MAE" && r["Val MAE"] === minV });
    const mr = rows.filter(r => r.Skenario !== "Baseline");
    const lab = mr.map(r => `${r.Model} · ${SCN[r.Skenario]}`);
    for (const [id, met] of [["chPlMae", "MAE"], ["chPlRmse", "RMSE"]]) {
      plot(id, [{ x: lab, y: mr.map(r => r[`Val ${met}`]), name: "Validasi", type: "bar", marker: { color: C.cyan } }, { x: lab, y: mr.map(r => r[`Test ${met}`]), name: "Test", type: "bar", marker: { color: C.orange } }],
        { hovermode: "closest", yaxis: { title: `${met} (MWh)` }, xaxis: { tickangle: -30 }, margin: { l: 56, r: 10, t: 18, b: 90 } });
    }
    const ov = lp.overfit.filter(r => on.includes(r.skenario) || r.skenario === "-");
    plot("chPlOvf", ["Train rolling", "Val", "Test"].map((s, i) => ({ x: ov.map(r => `${r.model} · ${r.skenario}`), y: ov.map(r => r[s]), name: s === "Val" ? "Validasi" : s, type: "bar", marker: { color: [C.green, C.cyan, C.orange][i] } })),
      { hovermode: "closest", yaxis: { title: "MAE (MWh)" }, xaxis: { tickangle: -30 }, margin: { l: 56, r: 10, t: 18, b: 90 } });
  };
  $$(".sc-chk").forEach(c => c.onchange = () => { draw(); drawH(); });
  const drawH = () => {
    const on = $$(".sc-chk").filter(c => c.checked).map(c => c.value), set = $("#plSet").value;
    const tr = Object.entries(lp.horizon).filter(([k]) => { const [m, s, h] = k.split("|"); return h === set && (on.includes(s) || s === "-"); })
      .map(([k, o]) => { const [m, s] = k.split("|"); return { x: [...Array(24).keys()].map(i => i + 1), y: o.MAE, name: s === "-" ? m : `${m} · ${s}`, line: { color: MODEL_COLOR[m], width: s === "-" ? 1 : 2.2, dash: { A: "solid", B: "dash", C: "dot", "-": "dot" }[s] } }; });
    plot("chPlH", tr, { xaxis: { title: "horizon (jam)", dtick: 2 }, yaxis: { title: `MAE ${set === "test" ? "test" : "validasi"} (MWh)` } });
  };
  const drawTs = async () => {
    const m = $("#plModel").value, s = $("#plSc").value, set = $("#plSet").value;
    const ts = await load(`load_ts_${set}`); const se = ts.series[`${m}|${s}`];
    const tt = ts.times.map(parseT);
    if (!se) { $("#chPlTs").innerHTML = `<div class="callout">Kombinasi ${m} skenario ${s} tidak tersedia.</div>`; return; }
    const tr = [];
    if (se.lower) tr.push({ x: tt, y: se.upper, line: { width: 0 }, showlegend: false, hoverinfo: "skip" }, { x: tt, y: se.lower, fill: "tonexty", fillcolor: "rgba(34,211,238,.13)", line: { width: 0 }, name: "PI 80%", hoverinfo: "skip" });
    tr.push({ x: tt, y: ts.actual, name: "Aktual", line: { color: "#e6ecff", width: 1.1 } }, { x: tt, y: se.pred, name: `${m} · ${s}`, line: { color: MODEL_COLOR[m], width: 1.4 } });
    plot("chPlTs", tr, { yaxis: { title: "MWh" }, xaxis: { rangeslider: { visible: true, thickness: .07, bgcolor: "rgba(19,32,63,.6)" }, range: [tt[0], tt[24 * 14]] } });
    const res = ts.actual.map((a, i) => a - se.pred[i]);
    plot("chPlRes", [{ x: tt, y: res, type: "scattergl", mode: "markers", marker: { size: 2.5, color: res.map(r => r >= 0 ? C.cyan : C.orange), opacity: .6 }, name: "residual" }],
      { yaxis: { title: "MWh", zeroline: true }, hovermode: "closest", showlegend: false });
    plot("chPlResH", [{ x: res, type: "histogram", nbinsx: 70, marker: { color: "rgba(34,211,238,.55)" } }], { xaxis: { title: "residual (MWh)" }, yaxis: { title: "jumlah jam" }, hovermode: "closest", showlegend: false });
  };
  ["#plModel", "#plSc"].forEach(s => $(s).onchange = drawTs);
  $("#plSet").onchange = () => { drawTs(); drawH(); };
  draw(); drawH(); drawTs();
}

async function initPerfSel() {
  const lp = await load("load_perf"), r = lp.registry;
  const ba = lp.criteria.find(x => x.model === r.best_accuracy.model && x.skenario === r.best_accuracy.skenario);
  const bo = lp.criteria.find(x => x.model === r.best_operational.model && x.skenario === r.best_operational.skenario);
  const bestH = Object.entries(lp.horizon).filter(([k]) => k.endsWith("|validation") && !k.includes("|-|") && !k.includes("|C|"))
    .map(([k, o]) => ({ k, wins: 0, o })); for (let h = 0; h < 24; h++) { const b = bestH.reduce((a, c) => c.o.MAE[h] < a.o.MAE[h] ? c : a); b.wins++; }
  const hw = bestH.sort((a, b) => b.wins - a.wins)[0];
  $("#psCards").innerHTML = `
    <div class="col-lg-4"><div class="card-x"><span class="badge-best"><i class="bi bi-bullseye"></i> Terbaik · akurasi</span><div class="big-model mt-2">${r.best_accuracy.model}</div>
      <div class="sub">${SC_LABEL[r.best_accuracy.skenario]} · MAE validasi terkecil (${fmt(ba["Val MAE"], 2)} MWh), RMSE validasi ${fmt(ba["Val RMSE"], 2)}</div>
      <div class="small">Evaluasi final (test): MAE ${fmt(ba["Test MAE"], 2)} · RMSE ${fmt(ba["Test RMSE"], 2)} MWh</div></div></div>
    <div class="col-lg-4"><div class="card-x"><span class="badge-best badge-op"><i class="bi bi-gear"></i> Terbaik · operasional</span><div class="big-model mt-2">${r.best_operational.model}</div>
      <div class="sub">${SC_LABEL[r.best_operational.skenario]} · ${bo["butuh ramalan cuaca"] ? "butuh" : "tidak butuh"} ramalan cuaca; skenario B diganti A bila tidak signifikan lebih baik (uji DM).</div>
      <div class="small">Test/Val ${fmt(bo["Test/Val"], 3)} · MAE periode penurunan COVID ${fmt(bo["MAE test penurunan"], 2)} MWh</div></div></div>
    <div class="col-lg-4"><div class="card-x"><span class="badge-best" style="background:rgba(139,92,246,.15);color:#c4b5fd;border-color:rgba(139,92,246,.4)"><i class="bi bi-clock"></i> Error per horizon</span>
      <div class="big-model mt-2">${hw.k.split("|")[0]}</div><div class="sub">MAE validasi terkecil pada <b>${hw.wins} dari 24</b> horizon (skenario ${hw.k.split("|")[1]}).</div>
      <div class="small">Pemilihan tidak memakai training error.</div></div></div>`;
  table("psTable", [{ key: "model", label: "Model", left: true }, { key: "skenario", label: "Skenario", left: true }, { key: "Val MAE", label: "Val MAE" }, { key: "Val RMSE", label: "Val RMSE" },
    { key: "Test MAE", label: "Test MAE" }, { key: "Test RMSE", label: "Test RMSE" }, { key: "Test/Val", label: "Test/Val", d: 3 }, { key: "MAE test penurunan", label: "MAE penurunan" },
    { key: "MAE peak val", label: "MAE puncak val" }, { key: "jam peak ±1 val %", label: "Jam puncak ±1 (%)" }, { label: "Butuh cuaca", get: x => x["butuh ramalan cuaca"] ? "ya" : "tidak" },
    { key: "rank_Val_MAE", label: "Rank val", d: 0 }, { key: "rank_Test_MAE", label: "Rank test", d: 0 }], lp.criteria, { best: (x, c) => c.key === "rank_Val_MAE" && x.rank_Val_MAE === 1 });
  const sub = lp.subperiod.filter(x => ["SARIMAX", "XGBoost", "TimesFM"].includes(x.model) && x.skenario !== "C");
  const labs = [...new Set(sub.map(x => `${x.model} · ${x.skenario}`))];
  plot("chPsSub", ["validation", "test_pra", "test_penurunan"].map((s, i) => ({ x: labs, y: labs.map(l => (sub.find(x => `${x.model} · ${x.skenario}` === l && x.subperiode === s) || {}).MAE), name: { validation: "Validasi 2019", test_pra: "Test pra-COVID", test_penurunan: "Test periode penurunan" }[s], type: "bar", marker: { color: [C.cyan, C.green, C.orange][i] } })),
    { hovermode: "closest", yaxis: { title: "MAE (MWh)" } });
  table("psDm", [{ key: "himpunan", label: "Himpunan", left: true }, { key: "perbandingan", label: "Perbandingan", left: true }, { key: "selisih_MAE_harian", label: "Δ MAE harian" }, { key: "DM", label: "DM" }, { label: "p-value", get: x => x.p_value < 0.001 ? "<0,001" : fmt(x.p_value, 3) }, { label: "Signifikan 5%", get: x => x.p_value < 0.05 ? "ya" : "tidak" }], lp.dm);
  table("psPeak", [{ key: "model", label: "Model", left: true }, { key: "skenario", label: "Sk.", left: true }, { key: "himpunan", label: "Himpunan", left: true }, { key: "MAE_nilai_peak", label: "MAE nilai puncak" }, { key: "bias_nilai_peak", label: "Bias" }, { key: "dalam_1jam_pct", label: "Jam ±1 (%)" }], lp.peak);
  table("psCov", [{ key: "model", label: "Model", left: true }, { key: "skenario", label: "Sk.", left: true }, { key: "subperiode", label: "Subperiode", left: true }, { key: "cakupan_PI80_%", label: "Cakupan (%)" }, { key: "lebar_rata2_MWh", label: "Lebar (MWh)" }], lp.coverage);
}

async function initPerfImp() {
  const imp = await load("xgb_importance");
  $("#piNote").textContent = imp.note + " Feature importance hanya untuk XGBoost; SARIMAX dan TimesFM tidak memakai metode ini.";
  const label = f => f.replace(/^lag_(\d+)$/, "lag $1 jam (y_t−$1+1)").replace(/^tlag_(\d+)$/, "beban jam sama −$1 jam").replace("_mean", " rata-rata 3 wilayah");
  const syncH = () => { const m = $("#piMethod").value; $("#piH").innerHTML = (m === "gain" ? ["semua"] : m === "gain_h" ? ["1", "6", "12", "18", "24"] : ["1", "12", "24"]).map(h => `<option>${h}</option>`).join(""); };
  const draw = () => {
    const M = $("#piModel").value, m = $("#piMethod").value, h = $("#piH").value;
    const obj = m === "gain" ? imp[M].mean : m === "gain_h" ? imp[M].by_h[h] : imp.shap[M][h];
    const ent = Object.entries(obj).sort((a, b) => b[1] - a[1]); const top = ent.slice(0, 20).reverse();
    const unit = m === "shap" ? "MWh" : "proporsi gain";
    plot("chImp", [{ x: top.map(e => e[1]), y: top.map(e => label(e[0])), type: "bar", orientation: "h", marker: { color: top.map(e => /^(T2M|QV2M|TQL|W2M)/.test(e[0]) ? C.orange : /lag/.test(e[0]) ? C.cyan : C.violet) }, hovertemplate: "%{y}: %{x:.4f}<extra></extra>" }],
      { hovermode: "closest", margin: { l: 210, r: 10, t: 10, b: 40 }, xaxis: { title: unit } });
    table("piTable", [{ label: "#", get: x => x.i }, { label: "Fitur", get: x => x.f, left: true }, { label: unit, get: x => x.v }], ent.map(([f, v], i) => ({ i: i + 1, f, v })));
  };
  $("#piMethod").onchange = () => { syncH(); draw(); }; $("#piModel").onchange = draw; $("#piH").onchange = draw;
  syncH(); draw();
}

/* ================= 5. EXPLANATION ================= */
async function initExplanation() {
  $$("#exTabs .nav-link").forEach(b => b.onclick = () => {
    $$("#exTabs .nav-link").forEach(x => x.classList.remove("active")); b.classList.add("active");
    $$(".etab").forEach(t => t.classList.add("d-none")); $(`#tab-${b.dataset.tab}`).classList.remove("d-none");
    $$(`#tab-${b.dataset.tab} .js-plotly-plot`).forEach(el => Plotly.Plots.resize(el));
  });
  renderMath($("#page-explanation"));
  // diagram boosting
  const g = $("#boostDiag"); let s = "";
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 130;
    s += `<rect x="${x}" y="22" width="96" height="50" rx="10" fill="rgba(245,158,11,.12)" stroke="#f59e0b"/><text x="${x + 48}" y="44" text-anchor="middle">Pohon ${i + 1}</text><text x="${x + 48}" y="61" text-anchor="middle" style="font-size:10px;fill:#93a3c7">${i ? "fit residual" : "fit y"}</text>`;
    if (i < 3) s += `<path d="M${x + 98} 47 L${x + 128} 47" stroke="#22d3ee" stroke-width="2" marker-end="url(#ar)"/><text x="${x + 113}" y="40" text-anchor="middle" style="font-size:10px;fill:#22d3ee">+η</text>`;
  }
  s += `<text x="260" y="104" text-anchor="middle" style="font-size:11px;fill:#93a3c7">Prediksi = Σ η·pohonₘ(x) — setiap pohon mengurangi galat pohon sebelumnya</text>`;
  g.innerHTML = `<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#22d3ee"/></marker></defs>` + s;

  const [lp, eda] = await Promise.all([load("load_perf"), load("eda")]);
  const r = lp.registry;
  $$("[data-bind=sarOrder]").forEach(e => e.textContent = `(${r.sarimax.order.join(",")})(${r.sarimax.seasonal_order.join(",")})`);
  $$("[data-bind=ctxL]").forEach(e => e.textContent = r.timesfm.context_L.toLocaleString("id-ID"));
  plot("chCtx", [{ x: lp.context.map(c => String(c.context_L)), y: lp.context.map(c => c.MAE), type: "bar", marker: { color: C.violet }, text: lp.context.map(c => fmt(c.MAE)), textposition: "outside" }],
    { hovermode: "closest", xaxis: { title: "context L (jam)", type: "category" }, yaxis: { title: "MAE validasi" }, margin: { l: 48, r: 8, t: 10, b: 40 } });
  const Ls = lp.context.map(c => c.context_L), v = eda.values, T = hourSeq(eda.start, v.length);
  const demo = () => {
    const L = Ls[+$("#ctxSlider").value], n = v.length, from = n - L;
    plot("chCtxDemo", [{ x: T.slice(Math.max(0, n - 2200)), y: v.slice(Math.max(0, n - 2200)), name: "riwayat", line: { color: "rgba(148,163,184,.35)", width: 1 } },
      { x: T.slice(from), y: v.slice(from), name: `context L = ${L} jam`, line: { color: C.violet, width: 1.2 } }],
      { yaxis: { title: "MWh" }, shapes: [{ type: "rect", xref: "x", yref: "paper", x0: T[from], x1: T[n - 1], y0: 0, y1: 1, fillcolor: "rgba(139,92,246,.08)", line: { width: 0 } }],
        annotations: [{ x: T[n - 1], y: 1, yref: "paper", text: "origin → ramal 24 jam", showarrow: false, xanchor: "right", font: { color: C.cyan } }] });
  };
  $("#ctxSlider").max = Ls.length - 1; $("#ctxSlider").value = Ls.length - 1; $("#ctxSlider").oninput = demo; demo();
  table("cmpTable", [{ key: "Model", label: "Model", left: true }, { key: "Kategori", label: "Kategori", left: true }, { key: "Parameter dari Panama", label: "Parameter dari data Panama", left: true },
    { key: "MAE validation (B)", label: "MAE val (B)" }, { key: "MAE test (B)", label: "MAE test (B)" }, { key: "MAE test pra (B)", label: "MAE test pra" }, { key: "MAE test penurunan (B)", label: "MAE penurunan" },
    { key: "MAE peak val (MWh)", label: "MAE puncak" }, { key: "Jam peak ±1 val (%)", label: "Jam puncak ±1 (%)" }], lp.three);
}

/* ================= 6. FORECAST ================= */
async function initForecast() {
  const fc = await load("forecast");
  const op = fc.best_operational;
  $("#fcModel").value = op.model; $("#fcSc").value = op.skenario;
  $("#fcOverview").innerHTML = [
    kpiCard("bi-database-check", "Data historis terakhir", fc.last_obs, "", "timestamp observasi terakhir", "", "col-6 col-lg"),
    kpiCard("bi-play-circle", "Awal prediksi", fc.start, "", "h = 1", "", "col-6 col-lg"),
    kpiCard("bi-stop-circle", "Akhir prediksi", fc.end, "", "h = 24", "", "col-6 col-lg"),
    kpiCard("bi-cpu", "Model operasional", op.model, "", SC_LABEL[op.skenario], "violet", "col-6 col-lg"),
    kpiCard("bi-arrow-repeat", "Pembaruan hasil", (await load("meta")).generated, "", "waktu build data", "green", "col-12 col-lg"),
  ].join("");
  const hist = fc.history, HT = hourSeq(hist.start, hist.values.length);
  const draw = () => {
    const m = $("#fcModel").value, s = $("#fcSc").value, nH = +$("#fcHist").value, all = $("#fcAll").checked;
    const rows = fc.rows.filter(r => r.model === m && r.skenario === s).sort((a, b) => a.h - b.h);
    if (!rows.length) return;
    const x = rows.map(r => parseT(r.timestamp)), y = rows.map(r => r.predicted_load_MWh);
    const ip = argmax(y), imn = argmin(y);
    $("#fcKpi").innerHTML = [
      kpiCard("bi-activity", "Predicted average load", mean(y), "MWh", "rata-rata 24 jam", "", "col-6 col-lg"),
      kpiCard("bi-arrow-up-circle", "Predicted maximum load", y[ip], "MWh", "", "orange", "col-6 col-lg"),
      kpiCard("bi-arrow-down-circle", "Predicted minimum load", y[imn], "MWh", rows[imn].timestamp.slice(11, 16), "violet", "col-6 col-lg"),
      kpiCard("bi-alarm", "Peak load time", rows[ip].timestamp.slice(11, 16), "", rows[ip].timestamp.slice(0, 10), "orange", "col-6 col-lg"),
      kpiCard("bi-lightning-charge", "Total estimated load", y.reduce((a, b) => a + b, 0), "MWh", "Σ beban per jam = energi 24 jam", "green", "col-12 col-lg"),
    ].join(""); animateCounters($("#fcKpi"));
    const hx = HT.slice(-nH), hy = hist.values.slice(-nH);
    const tr = [{ x: hx, y: hy, name: "Historis", line: { color: "#3b5bdb", width: 2 }, hovertemplate: "%{y:,.1f} MWh<extra>historis</extra>" }];
    if ($("#fcCI").checked && rows[0].lower_PI80 !== null) {
      tr.push({ x, y: rows.map(r => r.upper_PI80), line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
        { x, y: rows.map(r => r.lower_PI80), fill: "tonexty", fillcolor: "rgba(34,211,238,.16)", line: { width: 0 }, name: "Interval 80%", hoverinfo: "skip" });
    }
    if (all) ["SARIMAX", "XGBoost", "TimesFM"].filter(mm => mm !== m).forEach(mm => {
      const rr = fc.rows.filter(r => r.model === mm && r.skenario === s).sort((a, b) => a.h - b.h);
      tr.push({ x: rr.map(r => parseT(r.timestamp)), y: rr.map(r => r.predicted_load_MWh), name: mm, line: { color: MODEL_COLOR[mm], width: 1.5, dash: "dot" } });
    });
    tr.push({ x: [hx.at(-1), ...x], y: [hy.at(-1), ...y], name: `Forecast · ${m} ${s}`, line: { color: C.cyan, width: 3 }, hovertemplate: "%{y:,.1f} MWh<extra>forecast</extra>" },
      { x: [x[ip]], y: [y[ip]], mode: "markers+text", marker: { color: C.orange, size: 13, symbol: "star" }, text: ["peak"], textposition: "top center", textfont: { color: C.orange }, name: "Peak load" });
    plot("chFc", tr, { yaxis: { title: "MWh" }, shapes: [{ type: "line", x0: parseT(fc.last_obs), x1: parseT(fc.last_obs), yref: "paper", y0: 0, y1: 1, line: { color: C.orange, dash: "dash", width: 1.5 } }],
      annotations: [{ x: parseT(fc.last_obs), y: 1, yref: "paper", text: "forecast origin", showarrow: false, xanchor: "right", font: { color: C.orange, size: 11 } }] });
    $("#fcNote").textContent = `Data aktual untuk periode prediksi tidak tersedia di dataset (data berakhir ${fc.last_obs}), sehingga actual vs predicted belum dapat ditampilkan. Interval 80%: ${m === "TimesFM" ? "kuantil 0,1–0,9 dari TimesFM" : "split-conformal dari galat validasi"}.`;
    table("fcTable", [{ key: "timestamp", label: "Timestamp", left: true }, { key: "h", label: "h", d: 0 }, { key: "predicted_load_MWh", label: "Predicted load (MWh)" }, { key: "lower_PI80", label: "Lower 80%" }, { key: "upper_PI80", label: "Upper 80%" }], rows,
      { best: (r, c) => c.key === "predicted_load_MWh" && r.h === rows[ip].h });
    $("#fcCsv").onclick = () => {
      const csv = "timestamp,h,model,skenario,predicted_load_MWh,lower_PI80,upper_PI80\n" + rows.map(r => [r.timestamp, r.h, r.model, r.skenario, r.predicted_load_MWh, r.lower_PI80, r.upper_PI80].join(",")).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `forecast_24h_${m}_${s}.csv`; a.click();
    };
  };
  ["#fcModel", "#fcSc", "#fcHist", "#fcCI", "#fcAll"].forEach(s => $(s).onchange = draw); draw();
}

/* ================= 7. SIMULATION ================= */
async function initSimulation() {
  const [sim, fc] = await Promise.all([load("simulation"), load("forecast")]);
  renderMath($("#simFormula"));
  $("#simNote").innerHTML = `Simulasi memakai <b>XGBoost-W final</b> (BAB II), satu-satunya model final yang menerima cuaca dan kalender sebagai fitur langsung. Model operasional (TimesFM skenario A) tidak memakai cuaca, sehingga ditampilkan hanya sebagai garis referensi.
    Baseline = ramalan XGBoost-W dengan ramalan cuaca BAB I (verifikasi: selisih ${fmt(sim.verify_max_diff, 4)} MWh terhadap notebook). Hasil adalah <b>analisis sensitivitas model</b>, bukan efek kausal. Model pohon bersifat bertingkat (piecewise), sehingga perubahan kecil bisa tidak mengubah prediksi.`;
  $("#sSchool").value = String(sim.school_last);
  $("#qT").innerHTML = [-3, -2, -1, 0, 1, 2, 3].map(v => `<button class="btn btn-sm btn-ghost" data-t="${v}">${v > 0 ? "+" : ""}${v}°C</button>`).join("");
  $$("#qT [data-t]").forEach(b => b.onclick = () => { $("#sT").value = b.dataset.t; draw(); });
  const tx = sim.times.map(parseT);
  const key = (cm, sc, dq, dt) => `${cm}|${sc}|${dq}|${Number(dt).toFixed(1)}`;
  const tfm = fc.rows.filter(r => r.model === "TimesFM" && r.skenario === "A").sort((a, b) => a.h - b.h).map(r => r.predicted_load_MWh);
  const draw = () => {
    const dT = +$("#sT").value, dQ = +$("#sQ").value, cm = $("#sCal").value, sc = +$("#sSchool").value;
    $("#vT").textContent = `${dT > 0 ? "+" : ""}${dT.toFixed(1)} °C`; $("#vQ").textContent = `${dQ > 0 ? "+" : ""}${dQ} %`;
    $$("#qT [data-t]").forEach(b => b.classList.toggle("active", +b.dataset.t === dT));
    const base = sim.grid[key("actual", sim.school_last, 0, 0)], scn = sim.grid[key(cm, sc, dQ, dT)];
    const mb = mean(base), ms = mean(scn), ib = argmax(base), is = argmax(scn);
    const d = ms - mb, pct = d / mb * 100;
    $("#simKpi").innerHTML = [
      kpiCard("bi-activity", "Baseline load", mb, "MWh", "rata-rata 24 jam", "", "col-6 col-xl"),
      kpiCard("bi-sliders", "Scenario load", ms, "MWh", "rata-rata 24 jam", "violet", "col-6 col-xl"),
      kpiCard("bi-plus-slash-minus", "ΔLoad", d, "MWh", "skenario − baseline", d >= 0 ? "orange" : "green", "col-6 col-xl"),
      kpiCard("bi-percent", "%ΔLoad", pct, "%", "terhadap baseline", d >= 0 ? "orange" : "green", "col-6 col-xl"),
      kpiCard("bi-graph-up-arrow", "Δ Peak load", scn[is] - base[ib], "MWh", `${fmt(base[ib])} → ${fmt(scn[is])}`, "orange", "col-6 col-xl"),
      kpiCard("bi-alarm", "Waktu peak", `${sim.times[ib].slice(11, 16)} → ${sim.times[is].slice(11, 16)}`, "", is === ib ? "tidak bergeser" : "bergeser", "", "col-6 col-xl"),
    ].join(""); animateCounters($("#simKpi"));
    plot("chSim", [{ x: tx, y: base, name: "Baseline (XGBoost-W)", line: { color: "#3b5bdb", width: 2.5 } },
      { x: tx, y: scn, name: "Scenario", line: { color: C.cyan, width: 3 }, fill: "tonexty", fillcolor: d >= 0 ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.12)" },
      { x: tx, y: tfm, name: "Referensi: TimesFM operasional", line: { color: C.violet, width: 1.5, dash: "dot" } },
      { x: [tx[is]], y: [scn[is]], mode: "markers", marker: { color: C.orange, size: 12, symbol: "star" }, name: "Peak skenario" }],
      { yaxis: { title: "MWh" } });
  };
  ["#sT", "#sQ"].forEach(s => $(s).oninput = draw); ["#sCal", "#sSchool"].forEach(s => $(s).onchange = draw);
  $("#simReset").onclick = () => { $("#sT").value = 0; $("#sQ").value = 0; $("#sCal").value = "actual"; $("#sSchool").value = String(sim.school_last); draw(); };
  draw();
}

/* ---------------- start ---------------- */
route();
load("meta").then(m => $("#genTime").textContent = m.generated).catch(() => {});
