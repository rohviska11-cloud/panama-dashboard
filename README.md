# ⚡ PANAMA POWER ANALYTICS

**Electricity Demand & Weather Forecasting Dashboard (2015–2020)**

Dashboard analitik statis (GitHub Pages) untuk penelitian peramalan beban listrik nasional Panama per jam. Isinya:
- **BAB I · Weather forecasting:** 12 variabel cuaca di 3 wilayah, dengan model SARIMAX dan XGBoost.
- **BAB II · Load forecasting:** beban `nat_demand`, dengan model SARIMAX, XGBoost, dan TimesFM 3.0.

Semua angka di dashboard berasal dari hasil notebook penelitian. Dashboard **tidak** melakukan pemodelan ulang.

## Halaman

| # | Halaman | Isi |
|---|---|---|
| 1 | Overview | Hero, KPI dataset, alur penelitian, highlight model terbaik (dari evaluasi) |
| 2 | Data Exploration | Time series interaktif (filter tahun/bulan/tanggal, zoom), pola jam/hari/bulan, heatmap, distribusi, insight otomatis |
| 3 | Weather Analysis | Peta 3 wilayah, KPI cuaca, tren suhu, kelembapan/presipitasi/angin, scatter vs beban, korelasi Pearson/Spearman |
| 4 | Model Performance | Performa cuaca (BAB I), performa beban per skenario A/B/C, pemilihan model, uji Diebold–Mariano, feature importance & SHAP XGBoost |
| 5 | Model Explanation | SARIMAX, XGBoost, dan TimesFM: rumus, diagram, context window |
| 6 | Load Forecasting | Ramalan 24 jam, interval 80%, kontrol model/skenario, tabel dan unduh CSV |
| 7 | Scenario Simulation | Slider suhu dan kelembapan, skenario kalender, ΔLoad dan %ΔLoad |

## Struktur repo

```
index.html              # satu halaman, 7 "page" dengan hash routing (#overview, #forecast, ...)
assets/css/style.css    # tema & animasi
assets/js/app.js        # logika grafik (Plotly.js), KPI, insight, simulasi
data/*.json             # data siap pakai hasil build (di-commit agar Pages langsung jalan)
scripts/build_data.py   # membangun data/*.json dari output notebook BAB I & II
```

Teknologi: HTML5, CSS3, JavaScript, Bootstrap 5, Plotly.js, KaTeX, dan Leaflet.js (semua lewat CDN, tanpa proses build front-end).

## Memperbarui data

Script build membaca folder proyek penelitian, yaitu folder induk repo ini:

```
Panama_Electricity_Forecasting/
├── data/Panama_beban_listrik_per_jam_2015-2020_.xlsx
├── outputs/weather_forecasting/...           (BAB I)
├── outputs/electricity_forecasting/...       (BAB II, termasuk dashboard/ dan cache/13_final_alldata.joblib)
└── panama-dashboard/   <- repo ini
```

Jalankan perintah berikut, lalu commit dan push folder `data/`:

```bash
python scripts/build_data.py
```

Kebutuhan Python: pandas, numpy, scipy, pyarrow, joblib, xgboost, openpyxl.

Script juga memverifikasi bahwa rekonstruksi fitur XGBoost-W menghasilkan ramalan yang identik dengan notebook BAB II (selisih 0 MWh) sebelum menghitung simulasi.

## Menjalankan lokal

```bash
python -m http.server 8000
# buka http://localhost:8000
```

Dashboard harus dibuka lewat server HTTP, bukan dengan klik ganda file `index.html`, karena data dimuat dengan `fetch`.

## Deploy GitHub Pages

1. Buka **Settings → Pages**.
2. Pada *Source*, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Situs akan tersedia di `https://<username>.github.io/panama-dashboard/`.

## Catatan metodologis

- **Model terbaik dan operasional** dibaca dari `model_registry.json` hasil BAB II, bukan ditentukan manual.
- **Skenario C** (cuaca aktual) adalah *oracle benchmark* dan tidak dipakai untuk memilih model.
- **Simulasi skenario** memakai XGBoost-W final, satu-satunya model final yang menerima cuaca dan kalender sebagai fitur langsung.
  - Hasilnya adalah analisis sensitivitas, bukan efek kausal.
  - Model operasional (TimesFM skenario A) tidak memakai cuaca, sehingga hanya ditampilkan sebagai referensi.
- **Satuan QV2M:** nilai data berorde 0,02, sehingga diperlakukan sebagai kelembapan spesifik (kg/kg) seperti di BAB I, walaupun README dataset menyebut %.
- **TimesFM 3.0** memakai bobot dengan lisensi non-komersial.
