# Spesifikasi Desain: Modul Pusat Laporan pada Dashboard Finance

## 1. Ringkasan Kebutuhan (Understanding Summary)
* **Tujuan Proyek:** Mengintegrasikan modul **Pusat Laporan** lengkap dari Admin Dashboard ke Dashboard Finance (`apps/finance`).
* **Pengguna Utama:** Tim Finance, Finance Admin, dan Owner/Management. (Peran Purchasing tetap terisolasi pada modul operasional pembelian mereka).
* **Cakupan Sub-Laporan (8 Modul Lengkap):**
  1. **Rangkuman Penjualan (POS):** `/laporan/penjualan` — Monitoring omzet kotor/bersih, payment breakdown, sales channel, sales by category/item, shift cash summary.
  2. **Buku Kas (OPEX):** `/laporan/buku-kas` — Pencatatan buku kas harian & rekap biaya operasional per outlet.
  3. **Selisih Stok (Shrinkage):** `/laporan/selisih-stok` — Selisih stok fisik vs sistem dan kerugian nominal per bahan baku.
  4. **Target Harian:** `/laporan/target-harian` — Realisasi penjualan harian vs target outlet beserta progress bar pencapaian.
  5. **Bonus Crew:** `/laporan/bonus-crew` — Perhitungan bonus performa outlet berbasis omzet harian & absensi staf.
  6. **Kerugian Waste:** `/laporan/waste` — Kerugian bahan baku terbuang/rusak/expired per outlet.
  7. **Rekap Bulanan:** `/laporan/rekap-bulanan` — Rekapitulasi finansial bulanan (Gross Sales, Net Sales, Est. COGS, OPEX, Est. Net Margin).
  8. **Laporan Pembelian:** `/laporan/pembelian` — Laporan total belanja PO, status supplier, volume bahan baku.
* **Non-Goals:**
  - Tidak memodifikasi skema basis data, tabel, atau fungsi RPC Supabase yang sudah berjalan.
  - Tidak mengubah kode atau modul laporan di `apps/admin-dashboard`.

---

## 2. Decision Log (Log Keputusan Desain)

| # | Topik Pembahasan | Keputusan yang Diambil | Alternatif yang Dipertimbangkan | Alasan Pemilihan |
|---|---|---|---|---|
| 1 | **Cakupan Laporan** | Duplikasi Lengkap (Seluruh 8 Sub-Laporan) | Selektif (hanya penjualan & OPEX) | Tim Finance membutuhkan visibilitas menyeluruh mencakup penjualan, kas operasional, shrinkage stok, waste, hingga bonus karyawan. |
| 2 | **Hak Akses & Role** | Khusus Akun Finance & Management | Terbuka untuk Purchasing | Menjaga pemisahan tugas (*separation of duties*); staf purchasing hanya fokus pada operasional PO/PR. |
| 3 | **Navigasi Sidebar** | Grup Navigasi Baru `PUSAT LAPORAN` dengan Direct Links | Single Hub Page (Tabs) / Hybrid | Akses langsung 1-klik ke laporan spesifik lebih cepat dan seragam dengan navigasi Admin Dashboard. |
| 4 | **Skema URL Routing** | Format Bersih `/laporan/*` | Mengikuti path admin `/reports/*` & `/owner/*` | URL lebih ringkas, intuitif, dan sesuai hierarki rute di `apps/finance`. |
| 5 | **Pendekatan Arsitektur** | Modular Self-Contained Routes di `apps/finance` | Shared monorepo package (`@suka/reports`) | Menghindari risiko regresi (*zero side-effects*) pada Admin Dashboard dan memudahkan penyesuaian visual dengan tema Suka Finance. |

---

## 3. Asumsi & Persyaratan Non-Fungsional
* **Desain UI:** Memakai Suka Design System (`bg-suka-cream`, `text-suka-brown`, `suka-orange`, kartu rounded-2xl modern dengan border halus).
* **Paritas Fungsional:** Seluruh filter (multi-select cabang, date range picker) dan fitur ekspor (PDF, Excel, Print) berfungsi penuh.
* **Keamanan & Data:** Terproteksi otentikasi `@suka/auth`, dengan validasi transaksi batal (*void-aware*).
* **Performa:** Agregasi data di sisi client dengan loading skeleton dan proteksi nilai kosong (*empty states*).

---

## 4. Arsitektur File & Struktur Komponen

### Struktur Direktori:
```
apps/finance/src/
├── app/
│   └── laporan/
│       ├── layout.tsx                    # Shared container & header style
│       ├── page.tsx                      # Auto redirect to /laporan/penjualan
│       ├── penjualan/page.tsx
│       ├── buku-kas/page.tsx
│       ├── selisih-stok/page.tsx
│       ├── target-harian/page.tsx
│       ├── bonus-crew/page.tsx
│       ├── waste/page.tsx
│       ├── rekap-bulanan/page.tsx
│       └── pembelian/page.tsx
├── components/
│   ├── CashLayout.tsx                    # Tambah grup 'PUSAT LAPORAN'
│   └── laporan/                          # Komponen tampilan modular
│       ├── ReportsView.tsx
│       ├── BukuKasView.tsx
│       ├── ShrinkageView.tsx
│       ├── TargetHarianView.tsx
│       ├── CrewBonusView.tsx
│       ├── WasteView.tsx
│       ├── RekapBulananView.tsx
│       └── PembelianLaporanView.tsx
├── hooks/
│   └── useHppByChannel.ts
└── utils/
    ├── posReportKpi.ts
    └── pdfExporter.ts
```

---

## 5. Rencana Verifikasi (Testing Strategy)
1. **Pemeriksaan Paritas Angka (Parity Check):** Memastikan angka laporan di Finance identik 100% dengan Admin Dashboard.
2. **Uji Validitas Ekspor:** Menjalankan ekspor PDF dan Excel untuk memastikan format tabel dan kalkulasi tidak korup.
3. **Uji Responsivitas & Cetak:** Memverifikasi fungsionalitas di tampilan desktop, mobile browser, dan dialog cetak.
