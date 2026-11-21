# ⚡ PANAMA POWER ANALYTICS

**Electricity Demand & Weather Forecasting Dashboard (2015–2020)**

Dashboard analitik statis (GitHub Pages) untuk penelitian peramalan beban listrik nasional Panama per jam. Isinya:
- **BAB I · Weather forecasting:** 12 variabel cuaca di 3 wilayah, dengan model SARIMAX dan XGBoost.
- **BAB II · Load forecasting:** beban `nat_demand`, dengan model SARIMAX, XGBoost, dan TimesFM 3.0.

Semua angka di dashboard berasal dari hasil notebook penelitian. Dashboard **tidak** melakukan pemodelan ulang.

## Halaman

| Halaman | Isi |
|---|---|
| Beranda | Ringkasan data, alur penelitian, model terbaik (dari hasil evaluasi) |
| Eksplorasi Data | Grafik beban interaktif, pola jam/hari/bulan, heatmap, distribusi, temuan otomatis |
| Cuaca | Peta 3 wilayah, suhu, kelembapan, hujan, angin, hubungan dengan beban, korelasi |
| Performa Model | Ketepatan prediksi beban dan cuaca, model terbaik, uji Diebold–Mariano, faktor penting XGBoost |
| Cara Kerja Model | Penjelasan singkat SARIMAX, XGBoost, TimesFM |
| Prediksi 24 Jam | Prediksi 24 jam + rentang 80%, unduh CSV, dan **prediksi dari data pengguna** (XGBoost berjalan di browser) |
| Simulasi | Ubah suhu, kelembapan, dan jenis hari, lalu lihat perubahan prediksi |

**Prediksi di browser.** Prediksi dari data pengguna memakai 24 model XGBoost tanpa cuaca hasil penelitian.
- Model diekspor ke `data/xgb_model.json` dan `data/xgb_model.bin.gz` (±4 MB).
- Perhitungannya ada di `assets/js/xgb.js`.
- Dengan data contoh, hasilnya identik dengan perhitungan Python (selisih 0,000 MWh).
- TimesFM tidak dapat dijalankan di browser karena terlalu besar (331 juta parameter).

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
