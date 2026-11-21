"""Build data JSON untuk dashboard PANAMA POWER ANALYTICS (GitHub Pages, statis).

Tidak melakukan pemodelan ulang. Script hanya membaca hasil notebook BAB I dan BAB II dari
folder proyek (../outputs dan ../data), merangkum, lalu menulis JSON ke ./data.
Satu-satunya komputasi model adalah simulasi skenario dan SHAP, keduanya memakai model
XGBoost final yang sudah dilatih di BAB II (cache 13_final_alldata), tanpa fitting ulang.

Jalankan dari folder repo:  python scripts/build_data.py
"""
import json, sys, datetime as dt
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from scipy import stats

sys.stdout.reconfigure(encoding="utf-8")
REPO = Path(__file__).resolve().parents[1]
PROJ = REPO.parent                                   # folder Panama_Electricity_Forecasting
OUT = REPO / "data"; OUT.mkdir(exist_ok=True)
W_EVAL = PROJ / "outputs/weather_forecasting/evaluation"
W_PRED = PROJ / "outputs/weather_forecasting/predictions"
L_DIR = PROJ / "outputs/electricity_forecasting"
DASH = L_DIR / "dashboard"
LOCS = {"toc": "Tocumen", "san": "Santiago", "dav": "David"}
BASES = ["T2M", "QV2M", "TQL", "W2M"]
WVARS = [f"{b}_{l}" for l in LOCS for b in BASES]


def r(x, d=3):
    """Pembulatan rekursif agar JSON ringkas."""
    if isinstance(x, dict):
        return {str(k): r(v, d) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [r(v, d) for v in x]
    if isinstance(x, (np.floating, float)):
        return None if not np.isfinite(x) else round(float(x), d)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    if isinstance(x, (pd.Timestamp, dt.datetime)):
        return x.strftime("%Y-%m-%d %H:%M")
    return x


def recs(df, d=3):
    return r(df.replace({np.nan: None}).to_dict(orient="records"), d)


def save(name, obj, d=3):
    p = OUT / f"{name}.json"
    p.write_text(json.dumps(r(obj, d), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {name}.json  {p.stat().st_size / 1024:.0f} KB")


# ---------------------------------------------------------------- data dasar
lw = pd.read_parquet(DASH / "load_weather_hourly.parquet")
lw["datetime"] = pd.to_datetime(lw["datetime"]); lw = lw.set_index("datetime").sort_index()
y = lw["nat_demand"]
desc = pd.read_excel(PROJ / "data/Panama_beban_listrik_per_jam_2015-2020_.xlsx", sheet_name="deskripsi")
registry = json.loads((DASH / "model_registry.json").read_text(encoding="utf-8"))
units = dict(zip(desc["kolom"], desc["satuan"]))
# QV2M: nilai data ±0,018 (bukan %), konsisten dengan BAB I yang memakai satuan kg/kg (kelembapan spesifik)
for l in LOCS:
    units[f"QV2M_{l}"] = "kg/kg (README: %)"
print("Membangun data dashboard ...")

# ---------------------------------------------------------------- meta / overview
imax, imin = y.idxmax(), y.idxmin()
meta = {
    "title": "PANAMA POWER ANALYTICS",
    "generated": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
    "kpi": {"n_obs": int(len(y)), "start": y.index[0], "end": y.index[-1], "mean": y.mean(), "max": y.max(), "max_time": imax,
            "min": y.min(), "min_time": imin, "n_weather": len(WVARS), "freq": "Hourly (per jam)", "n_cols": int(len(desc))},
    "variables": recs(desc),
    "units": units,
    "locations": [{"code": "toc", "name": "Tocumen (Kota Panama)", "lat": 9.07, "lon": -79.38},
                  {"code": "san", "name": "Santiago", "lat": 8.10, "lon": -80.98},
                  {"code": "dav", "name": "David", "lat": 8.43, "lon": -82.43}],
    "split": registry.get("split"),
    "registry": registry,
}
save("meta", meta)

# ---------------------------------------------------------------- EDA beban
t0 = y.index[0]
q = y.quantile([0.25, 0.5, 0.75])
dfe = pd.DataFrame({"y": y, "hour": y.index.hour, "dow": y.index.dayofweek, "month": y.index.month, "year": y.index.year})
dfe["weekend"] = dfe.dow >= 5
box_m = []
for m, g in dfe.groupby("month").y:
    q1, q2, q3 = g.quantile([0.25, 0.5, 0.75]); iqr = q3 - q1
    box_m.append({"month": m, "q1": q1, "median": q2, "q3": q3, "lower": g[g >= q1 - 1.5 * iqr].min(), "upper": g[g <= q3 + 1.5 * iqr].max(),
                  "mean": g.mean()})
cnt, edges = np.histogram(y, bins=60)
kde = stats.gaussian_kde(y.sample(8000, random_state=0).values)
grid = np.linspace(y.min(), y.max(), 200)
eda = {
    "start": t0, "values": np.round(y.values, 1).tolist(),
    "hourly": dfe.groupby("hour").y.mean().tolist(),
    "hourly_wd": dfe[~dfe.weekend].groupby("hour").y.mean().tolist(),
    "hourly_we": dfe[dfe.weekend].groupby("hour").y.mean().tolist(),
    "dow": dfe.groupby("dow").y.mean().tolist(),
    "month": dfe.groupby("month").y.mean().tolist(),
    "year": {str(k): v for k, v in dfe.groupby("year").y.mean().items()},
    "year_n": {str(k): int(v) for k, v in dfe.groupby("year").y.size().items()},
    "heat": dfe.pivot_table(index="dow", columns="hour", values="y", aggfunc="mean").values.tolist(),
    "box_month": box_m,
    "hist": {"counts": cnt.tolist(), "edges": edges.tolist()},
    "kde": {"x": grid.tolist(), "y": (kde(grid) * len(y) * (edges[1] - edges[0])).tolist()},
    "stats": {"mean": y.mean(), "median": q[0.5], "std": y.std(), "min": y.min(), "max": y.max(), "q1": q[0.25], "q3": q[0.75],
              "skew": y.skew(), "kurtosis": y.kurt(), "cv": y.std() / y.mean()},
    "weekday_mean": dfe[~dfe.weekend].y.mean(), "weekend_mean": dfe[dfe.weekend].y.mean(),
    "holiday_mean": y[lw.holiday == 1].mean(), "nonholiday_mean": y[lw.holiday == 0].mean(),
    "anomalies": recs(pd.read_csv(DASH / "load_anomalies.csv")) if (DASH / "load_anomalies.csv").stat().st_size > 5 else [],
}
save("eda", eda, 2)

# ---------------------------------------------------------------- cuaca
W = lw[WVARS]
daily = W.resample("D").mean()
wx = {
    "daily_start": daily.index[0], "daily": {v: np.round(daily[v].values, 5 if v.startswith("QV2M") else 3).tolist() for v in WVARS},
    "load_daily": np.round(y.resample("D").mean().values, 1).tolist(),
    "hourly": {v: W.groupby(W.index.hour)[v].mean().tolist() for v in WVARS},
    "monthly": {v: W.groupby(W.index.month)[v].mean().tolist() for v in WVARS},
    "hist": {}, "kpi": {},
}
for v in WVARS:
    c_, e_ = np.histogram(W[v], bins=40); wx["hist"][v] = {"counts": c_.tolist(), "edges": e_.tolist()}
T = W[[f"T2M_{l}" for l in LOCS]]
tmax_col = T.max().idxmax()
wx["kpi"] = {"T2M_mean": T.values.mean(), "T2M_max": T.values.max(), "T2M_max_loc": LOCS[tmax_col.split("_")[1]], "T2M_max_time": T[tmax_col].idxmax(),
             "QV2M_mean": W[[f"QV2M_{l}" for l in LOCS]].values.mean(), "TQL_mean": W[[f"TQL_{l}" for l in LOCS]].values.mean(),
             "W2M_mean": W[[f"W2M_{l}" for l in LOCS]].values.mean(),
             "per_loc": {l: {b: W[f"{b}_{l}"].mean() for b in BASES} for l in LOCS}}
S = lw[["nat_demand"] + WVARS].sample(4000, random_state=1).sort_index()
wx["scatter"] = {c: np.round(S[c].values, 5).tolist() for c in S.columns}
wx["scatter_hour"] = S.index.hour.tolist()
C = lw[["nat_demand"] + WVARS]
wx["corr"] = {"cols": list(C.columns), "pearson": C.corr("pearson").values.tolist(), "spearman": C.corr("spearman").values.tolist()}
f_ = L_DIR / "evaluation/02_korelasi_beban_cuaca.csv"
wx["corr_within_hour"] = recs(pd.read_csv(f_)) if f_.exists() else []
save("weather", wx, 5)

# ---------------------------------------------------------------- performa cuaca (BAB I)
ev = pd.read_csv(W_EVAL / "09_evaluasi_train_val_test.csv")
summ = pd.read_csv(W_EVAL / "10_ringkasan_bab1.csv").rename(columns={"Unnamed: 0": "Variabel"})
sel = pd.read_csv(W_EVAL / "09_pemilihan_model_validasi.csv")
wp = {"table": recs(ev, 6), "summary": recs(summ, 6), "selection": recs(sel, 6), "horizon": {}, "vars": WVARS}
ph = []
for f in ["weather_forecast_validation.parquet", "weather_forecast_test.parquet"]:
    d = pd.read_parquet(W_PRED / f)
    d["ae"] = (d.y_true - d.y_pred).abs(); d["se"] = (d.y_true - d.y_pred) ** 2
    g = d.groupby(["variabel", "model", "himpunan", "h"]).agg(MAE=("ae", "mean"), MSE=("se", "mean")).reset_index()
    ph.append(g)
    if "test" in f:
        for v in WVARS:                      # deret actual vs predicted (gabungan 24 jam setiap origin) -> file per variabel
            dv = d[d.variabel == v].sort_values("target_time")
            out = {"start": dv.target_time.min(), "actual": None}
            for m_, g_ in dv.groupby("model"):
                g_ = g_.drop_duplicates("target_time").sort_values("target_time")
                out["actual"] = np.round(g_.y_true.values, 6).tolist(); out[m_] = np.round(g_.y_pred.values, 6).tolist()
                out["times"] = g_.target_time.dt.strftime("%Y-%m-%d %H:%M").tolist()
            save(f"wperf_ts_{v}", out, 6)
ph = pd.concat(ph); ph["RMSE"] = np.sqrt(ph.MSE)
for v in WVARS:
    wp["horizon"][v] = {f"{m}|{k}": {"MAE": g.sort_values("h").MAE.tolist(), "RMSE": g.sort_values("h").RMSE.tolist()}
                        for (m, k), g in ph[ph.variabel == v].groupby(["model", "himpunan"])}
f_ = W_EVAL / "07_xgb_feature_importance_gain.csv"
wp["xgb_importance"] = recs(pd.read_csv(f_), 5) if f_.exists() else []
save("weather_perf", wp, 6)

# ---------------------------------------------------------------- performa beban (BAB II)
fc = pd.read_parquet(DASH / "forecasts_all_models.parquet")
lp = {
    "main": recs(pd.read_csv(DASH / "metrics_summary.csv")),
    "subperiod": recs(pd.read_csv(DASH / "metrics_by_subperiod.csv")),
    "coverage": recs(pd.read_csv(DASH / "interval_coverage.csv")),
    "dm": recs(pd.read_csv(DASH / "diebold_mariano.csv"), 4),
    "benefit": recs(pd.read_csv(DASH / "weather_benefit.csv")),
    "criteria": recs(pd.read_csv(DASH / "model_selection_criteria.csv")),
    "overfit": recs(pd.read_csv(L_DIR / "evaluation/11_overfitting_generalisasi.csv")),
    "three": recs(pd.read_csv(L_DIR / "evaluation/12_perbandingan_tiga_model.csv")),
    "peak": recs(pd.read_csv(L_DIR / "evaluation/11_peak_load.csv")),
    "context": recs(pd.read_csv(L_DIR / "evaluation/08_timesfm_context.csv")),
    "horizon": {}, "registry": registry,
}
mh = pd.read_parquet(DASH / "metrics_per_horizon.parquet")
for (m, s, k), g in mh.groupby(["model", "skenario", "himpunan"]):
    g = g.sort_values("h"); lp["horizon"][f"{m}|{s}|{k}"] = {c: g[c].tolist() for c in ["MAE", "RMSE", "MAPE", "sMAPE"]}
save("load_perf", lp)
for k in ["validation", "test"]:
    d = fc[(fc.himpunan == k) & fc.model.isin(["SARIMAX", "XGBoost", "TimesFM"])]
    act = d.drop_duplicates("target_time").sort_values("target_time")
    out = {"times": act.target_time.dt.strftime("%Y-%m-%d %H:%M").tolist(), "actual": np.round(act.y_true.values, 1).tolist(), "series": {}}
    for (m, s), g in d.groupby(["model", "skenario"]):
        g = g.sort_values("target_time")
        assert (g.target_time.values == act.target_time.values).all()
        se = {"pred": np.round(g.y_pred.values, 1).tolist()}
        if g.lower.notna().all():
            se["lower"] = np.round(g.lower.values, 1).tolist(); se["upper"] = np.round(g.upper.values, 1).tolist()
        out["series"][f"{m}|{s}"] = se
    save(f"load_ts_{k}", out, 1)

# ---------------------------------------------------------------- XGBoost final: importance, SHAP, simulasi
FIN = joblib.load(L_DIR / "cache/13_final_alldata.joblib")
FEAT = json.loads((L_DIR / "models/xgb_feature_config.json").read_text())
H = 24
O = pd.DataFrame({f"lag_{k}": y.shift(k - 1) for k in FEAT["lags"]})


def calendar(idx, holiday=None, school=None):
    cal = pd.DataFrame(index=idx)
    for nm, val, per in [("hour", idx.hour, 24), ("dow", idx.dayofweek, 7), ("doy", idx.dayofyear - 1, 365.25), ("month", idx.month - 1, 12)]:
        cal[f"{nm}_sin"], cal[f"{nm}_cos"] = np.sin(2 * np.pi * val / per), np.cos(2 * np.pi * val / per)
    cal["weekend"] = (idx.dayofweek >= 5).astype(int)
    cal["holiday"] = lw.holiday.reindex(idx).values if holiday is None else holiday
    cal["school"] = lw.school.reindex(idx).values if school is None else school
    return cal


def wset_c(Wd):
    out = Wd[[f"{b}_{l}" for l in LOCS for b in ["TQL", "W2M"]]].copy()
    for b in ["T2M", "QV2M"]:
        out[f"{b}_mean"] = Wd[[f"{b}_{l}" for l in LOCS]].mean(axis=1).values
    return out


CAL = calendar(lw.index); WC = wset_c(W)
models = FIN["models"]
imp = {"features": None}
for key in ["XGB_A", "XGB_W"]:
    M = models[key]; gains = []
    for h in range(1, H + 1):
        b = M["models"][h].get_booster(); sc = b.get_score(importance_type="gain"); tot = sum(sc.values())
        gains.append({f: sc.get(f, 0) / tot for f in b.feature_names})
    G = pd.DataFrame(gains, index=range(1, H + 1))
    imp[key] = {"mean": G.mean().sort_values(ascending=False).to_dict(), "by_h": {str(h): G.loc[h].to_dict() for h in [1, 6, 12, 18, 24]}}
# SHAP (pred_contribs) pada 365 origin validasi 2019 - deskriptif, model final
import xgboost as xgb
orig = pd.date_range("2018-12-31 23:00", "2019-12-30 23:00", freq="24h")
shap_out = {}
for key in ["XGB_A", "XGB_W"]:
    M = models[key]; shap_out[key] = {}
    for h in [1, 12, 24]:
        b = M["models"][h].get_booster(); cols = b.feature_names
        X = O.copy()
        for k in FEAT["tgt_lags"]: X[f"tlag_{k}"] = y.shift(k - h)
        X = X.join(CAL[FEAT["cal_cols"]].shift(-h))
        if M["wset"]: X = X.join(WC.shift(-h))
        Xo = X.loc[orig, cols]
        contrib = b.predict(xgb.DMatrix(Xo, feature_names=cols), pred_contribs=True)[:, :-1] * M["stats"][h]["sd"]
        shap_out[key][str(h)] = dict(sorted(zip(cols, np.abs(contrib).mean(0)), key=lambda t: -t[1]))
imp["shap"] = shap_out
imp["note"] = ("Importance = gain ternormalisasi dari 24 model XGBoost final (dilatih s.d. data terakhir). "
               "SHAP = rata-rata |kontribusi| (MWh) via pred_contribs XGBoost pada 365 origin 2019 (deskriptif).")
save("xgb_importance", imp, 4)

# simulasi skenario: XGBoost-W final (satu-satunya model final yang memakai cuaca + kalender sebagai fitur langsung)
LAST_T = y.index[-1]; FUT = pd.date_range(LAST_T + pd.Timedelta(hours=1), periods=H, freq="h")
WN = pd.read_csv(W_PRED / "weather_forecast_next24h.csv", parse_dates=["timestamp"]).set_index("timestamp")[WVARS]
SCHOOL_LAST = int(lw.school.iloc[-1])
MW = models["XGB_W"]


def predict_w(dT=0.0, dQ=0.0, cal_mode="actual", school=SCHOOL_LAST):
    Wd = WN.copy()
    for l in LOCS:
        Wd[f"T2M_{l}"] += dT; Wd[f"QV2M_{l}"] *= (1 + dQ / 100)
    wc = wset_c(Wd)
    idx = FUT
    if cal_mode == "weekday":
        idx_cal = calendar(FUT, holiday=0, school=school)
        for c_, v_ in [("dow_sin", np.sin(2 * np.pi * 2 / 7)), ("dow_cos", np.cos(2 * np.pi * 2 / 7)), ("weekend", 0)]: idx_cal[c_] = v_
    elif cal_mode == "weekend":
        idx_cal = calendar(FUT, holiday=0, school=school)
        for c_, v_ in [("dow_sin", np.sin(2 * np.pi * 6 / 7)), ("dow_cos", np.cos(2 * np.pi * 6 / 7)), ("weekend", 1)]: idx_cal[c_] = v_
    elif cal_mode == "holiday":
        idx_cal = calendar(FUT, holiday=1, school=school)
    else:
        idx_cal = calendar(FUT, holiday=0, school=school)
    out = []
    for h in range(1, H + 1):
        b = MW["models"][h]; cols = b.get_booster().feature_names; t_ = FUT[h - 1]
        row = O.loc[[LAST_T]].copy()
        for k in FEAT["tgt_lags"]: row[f"tlag_{k}"] = y.loc[t_ - pd.Timedelta(hours=k)]
        for c_ in FEAT["cal_cols"]: row[c_] = idx_cal[c_].iloc[h - 1]
        for c_ in wc.columns: row[c_] = wc[c_].iloc[h - 1]
        st = MW["stats"][h]; out.append(float(b.predict(row[cols])[0] * st["sd"] + st["mu"]))
    return np.array(out)


base = predict_w()
ref = np.asarray(FIN[("XGBoost", "B")]).ravel()
err = float(np.max(np.abs(base - ref)))
print(f"  verifikasi rekonstruksi fitur XGBoost-W vs ramalan final notebook: selisih maks {err:.4f} MWh")
assert err < 0.05, "Rekonstruksi fitur tidak cocok dengan notebook BAB II"
DT = [round(x, 1) for x in np.arange(-3, 3.01, 0.5)]; DQ = [-10, -5, 0, 5, 10]; CM = ["actual", "weekday", "weekend", "holiday"]; SC = [0, 1]
grid = {}
for cm in CM:
    for s_ in SC:
        for dq in DQ:
            for dT in DT:
                grid[f"{cm}|{s_}|{dq}|{dT}"] = np.round(predict_w(dT, dq, cm, s_), 1).tolist()
sim = {"times": [t.strftime("%Y-%m-%d %H:%M") for t in FUT], "dT": DT, "dQ": DQ, "cal_modes": CM, "school": SC, "school_last": SCHOOL_LAST,
       "dow_actual": [int(t.dayofweek) for t in FUT], "grid": grid, "verify_max_diff": err,
       "weather_baseline": {"T2M_mean": wset_c(WN)["T2M_mean"].tolist(), "QV2M_mean": wset_c(WN)["QV2M_mean"].tolist()},
       "timesfm": np.asarray(FIN.get(("TimesFM", "A"), [])).ravel().tolist() if ("TimesFM", "A") in FIN else None}
save("simulation", sim, 4)

# ---------------------------------------------------------------- ekspor XGBoost-A final untuk prediksi di browser
import gzip
CONDS, LEFTS, FEATS, META_H = [], [], [], {}
MA = models["XGB_A"]
for h in range(1, H + 1):
    m = json.loads(MA["models"][h].get_booster().save_raw("json").decode())
    bs = m["learner"]["learner_model_param"]["base_score"]
    base = float(json.loads(bs)[0]) if bs.strip().startswith("[") else float(bs)
    sizes = []
    for t in m["learner"]["gradient_booster"]["model"]["trees"]:
        L_, R_ = np.array(t["left_children"]), np.array(t["right_children"])
        inner = L_ >= 0
        assert (R_[inner] == L_[inner] + 1).all(), "asumsi right = left + 1 tidak berlaku"
        si = np.array(t["split_indices"]); assert si.max() < 128
        CONDS.append(np.array(t["split_conditions"], dtype=np.float32)); LEFTS.append(L_.astype(np.int16))
        FEATS.append((si | (np.array(t["default_left"]) > 0) * 128).astype(np.uint8)); sizes.append(len(L_))
    META_H[str(h)] = {"base": base, "sizes": sizes}
CONDS, LEFTS, FEATS = np.concatenate(CONDS), np.concatenate(LEFTS), np.concatenate(FEATS)
(OUT / "xgb_model.bin.gz").write_bytes(gzip.compress(CONDS.tobytes() + LEFTS.tobytes() + FEATS.tobytes(), 9))
print(f"  xgb_model.bin.gz  {(OUT / 'xgb_model.bin.gz').stat().st_size / 1024:.0f} KB · node {len(CONDS):,}")
xg = {"features": MA["models"][1].get_booster().feature_names, "lags": FEAT["lags"], "tgt_lags": FEAT["tgt_lags"],
      "cal_cols": FEAT["cal_cols"], "stats": {str(h): MA["stats"][h] for h in range(1, H + 1)},
      "n_nodes": int(len(CONDS)), "trees": META_H,
      "check": {"origin": LAST_T.strftime("%Y-%m-%d %H:%M"),"pred": np.asarray(FIN[("XGBoost", "A")]).ravel().tolist(),
                "holiday": 0, "school": SCHOOL_LAST}}
assert all(MA["models"][h].get_booster().feature_names == xg["features"] for h in range(1, H + 1))
p = OUT / "xgb_model.json"
p.write_text(json.dumps(xg, separators=(",", ":")), encoding="utf-8")
print(f"  xgb_model.json  {p.stat().st_size / 1024:.0f} KB")

# ---------------------------------------------------------------- forecast 24 jam
ff = pd.read_csv(DASH / "final_forecast_next24h.csv")
hist = y.iloc[-24 * 14:]
fore = {"last_obs": LAST_T, "origin": ff.forecast_origin.iloc[0], "start": FUT[0], "end": FUT[-1], "generated": registry.get("generated", meta["generated"]),
        "best_accuracy": registry.get("best_accuracy"), "best_operational": registry.get("best_operational"),
        "rows": recs(ff, 2), "history": {"start": hist.index[0], "values": np.round(hist.values, 1).tolist()},
        "weather_next24": recs(WN.reset_index(), 5)}
save("forecast", fore, 2)
print("Selesai.")
