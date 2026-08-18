# Spesifikasi Desain: Board Informasi Fluktuasi & Riwayat Harga Bahan Baku

## 1. Ringkasan & Tujuan (Overview & Purpose)
Modul **Board Informasi Harga Bahan Baku** pada aplikasi Stok (`apps/stok`) dibangun untuk memberikan visibilitas instan dan transparan kepada tim operasional (Kitchen, Gudang), Purchasing, Finance, dan Admin mengenai pergerakan harga beli aktual bahan baku dari supplier setelah proses penerimaan barang (PO Diterima).

Dengan board ini, anomali kenaikan biaya dan fluktuasi harga bahan dapat terdeteksi lebih awal, serta memudahkan penyelarasan Harga Master HPP secara akurat.

---

## 2. Decision Log (Keputusan Desain)

| # | Aspek Desain | Keputusan yang Disepakati | Rasional & Manfaat |
|---|---|---|---|
| **D1** | **Entry Point & Navigasi** | Halaman Mandiri (`/stok/harga-bahan`) + Tab Pintasan di `SPVDashboard` (`SPVTabs`) | Memudahkan akses langsung bagi tim kitchen & SPV gudang, sekaligus memberi rute permanen via URL/Header. |
| **D2** | **Format Komparasi Harga** | Dual Comparison: *vs Pembelian Sebelumnya* (fluktuasi riil antar PO) + *vs Harga Master* (deviasi standar) | Memberikan konteks lengkap: apakah harga naik dibanding transaksi terakhir vendor, dan apakah melebihi standar HPP master. |
| **D3** | **Detail Drilldown Modal** | Grafik Tren Interaktif + Tabel Riwayat PO Lengkap + Tombol Sinkronisasi Master | Memungkinkan investigasi mendalam pergerakan harga lintas vendor dari waktu ke waktu. |
| **D4** | **Mekanisme Update Master** | Modal Konfirmasi Individual & Dukungan Batch Update + Pencatatan Audit History | Mencegah kekeliruan update harga tidak sengaja dan menjaga integritas data log riwayat perubahan harga. |
| **D5** | **Filter, Sort & Export** | Filter Status (Naik/Turun/Stabil), Kategori, Rentang Waktu, Smart Sorting & Export CSV | Mempercepat penemuan anomali harga dan memfasilitasi pelaporan periodik ke manajemen. |
| **D6** | **Hak Akses (Role)** | Kitchen (View-only), Admin/Purchasing/Finance (View + Update Master) | Menjaga keamanan data master sekaligus menjaga transparansi bagi operasional kitchen. |

---

## 3. Asumsi Teknis & Arsitektur Data

### 3.1 Skema Database & Sumber Data
* `purchase_order` & `purchase_order_item`: Sumber data riil transaksi pembelian yang berstatus `diterima_lengkap` atau `sebagian_diterima`.
* `bahan_baku` & `kategori_bahan_baku`: Data master katalog bahan baku.
* `bahan_baku_harga`: Data patokan harga master saat ini (`harga_beli`).
* `bahan_baku_harga_history`: Log riwayat perubahan harga master (`harga_lama`, `harga_baru`, `ref_po_id`, `changed_at`, `changed_by`).

### 3.2 Supabase RPC Function: `get_fluktuasi_harga_bahan_baku`
Menggunakan *Window Functions* (`LAG()` & `ROW_NUMBER()`) untuk menghitung:
* `harga_terakhir` (dari PO diterima terbaru)
* `harga_sebelumnya` (dari PO diterima 1 transaksi sebelumnya)
* `selisih_nominal_prev` & `selisih_pct_prev`
* `selisih_nominal_master` & `selisih_pct_master`
* `trend_points` (5-10 titik harga historis terakhir untuk mini sparkline)

### 3.3 Server Action: `syncMasterPriceAction`
* Menerima input: array `{ bahan_baku_id, harga_baru, ref_po_id, catatan }`.
* Melakukan validasi hak akses pengguna (`admin`, `finance`, `purchasing`).
* Mengupdate tabel `bahan_baku_harga` dan mencatat entri log di `bahan_baku_harga_history`.
* Memicu revalidasi cache React Query.

---

## 4. Struktur Antarmuka & Komponen Frontend

```
apps/stok/src/
├── app/
│   └── stok/
│       └── harga-bahan/
│           └── page.tsx                    # Halaman Utama Board Informasi Harga
├── components/
│   └── harga-bahan/
│       ├── HargaBahanSummaryCards.tsx       # KPI Metric Cards (Total, Naik, Turun, Stabil)
│       ├── HargaBahanFilterBar.tsx          # Filter Kategori, Status, Range & Search
│       ├── HargaBahanTable.tsx              # Tabel Utama dengan Sparkline & Dual Comparison
│       ├── HargaBahanDetailModal.tsx        # Modal Drilldown Grafik & Riwayat PO Vendor
│       ├── SyncMasterModal.tsx              # Modal Konfirmasi Sinkronisasi Harga Master
│       ├── BatchActionBar.tsx               # Floating Action Bar untuk Batch Update
│       └── SparklineSvg.tsx                 # Mini SVG Sparkline Ringan
└── hooks/
    └── useFluktuasiHarga.ts                 # React Query Hook untuk fetch & caching
```

---

## 5. Penanganan Edge Cases

1. **Bahan Baru Belum Ada Pembelian PO**: Ditampilkan dengan indikator *"Belum Ada Pembelian"*, harga strip (`—`), dan sparkline kosong yang rapi.
2. **Bahan Tanpa Harga Master**: Ditandai dengan badge peringatan *"Belum Ada Master"*, mempermudah inisialisasi harga master dari PO pertama.
3. **PO Batal / Draft**: Diabaikan dari perhitungan, hanya PO dengan status penerimaan valid yang dihitung.
4. **Role Kitchen**: Tampilan dashboard, filter, grafik, dan export CSV tetap aktif 100%, namun tombol update harga master dinonaktifkan dengan visual yang jelas.

---

## 6. Rencana Verifikasi (Verification Plan)
* [ ] Uji query RPC database dengan data PO riil (verifikasi kalkulasi selisih nominal dan %).
* [ ] Uji interaktivitas filter (pencarian teks, multi-kategori, status naik/turun/stabil).
* [ ] Uji modal drilldown (grafik tren dan detail riwayat transaksi per supplier).
* [ ] Uji eksekusi sinkronisasi harga master (individual dan batch) serta pengecekan record `bahan_baku_harga_history`.
* [ ] Uji ekspor data ke file CSV.
