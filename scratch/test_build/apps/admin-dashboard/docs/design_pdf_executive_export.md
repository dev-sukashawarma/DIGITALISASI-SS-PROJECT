# Design Specification: Export PDF Eksekutif (Rekap Rincian Item Terjual)

## 1. Executive Summary & Purpose
Fitur ini menyediakan fasilitas pengunduhan langsung file laporan berformat `.pdf` berkualitas tinggi untuk **Rekap Rincian Penjualan Item / Performa Produk** di dashboard admin POS. Dokumen difokuskan untuk kebutuhan eksekutif/owner dalam mengevaluasi performa produk per cabang dan per periode tanggal.

---

## 2. User Experience & Layout Placement

### 2.1 Placement Tombol
Tombol **"Cetak / Download PDF Eksekutif"** ditempatkan di **Header Card Atas** dalam `ReportsView.tsx`, sejajar dengan kontrol filter utama:
- `BranchFilter` (Filter Cabang/Outlet)
- `ChannelFilter` (Filter Channel Penjualan)
- `DatePicker` / `DateRangePicker` (Filter Periode Tanggal)
- **[Tombol Download PDF Eksekutif]**

### 2.2 Behavior & Feedback
- **Disabled State**: Tombol disonaktifkan (*disabled*) jika tidak ada data transaksi sukses pada periode terpilih (`analytics.completedOrders.length === 0`).
- **Loading State**: Menampilkan indikator loading saat dokumen PDF sedang digenerasi.
- **Auto Download**: File terunduh otomatis dengan format nama `Laporan_Rincian_Item_[NamaOutlet]_[Periode].pdf`.

---

## 3. Architecture & PDF Layout Specification (A4 Portrait)

### 3.1 PDF Header / Kop Document
- **Nama Usaha**: SS Shawarma (Digital POS System)
- **Judul Laporan**: LAPORAN EKSEKUTIF - RINCIAN ITEM TERJUAL
- **Metadata**:
  - Cabang / Outlet: `selectedOutletName`
  - Periode: `RANGE_LABELS[range]` (atau custom date range)
  - Tanggal Unduh: Tanggal & jam generasi PDF.

### 3.2 Key Performance Indicators (KPI Bar)
- **Gross Revenue**: Total Omzet Kotor
- **Total Item Terjual**: Sum total unit/qty produk terjual
- **Total Transaksi Sukses**: Jumlah transaksi completed

### 3.3 Data Table (Rekap Item Terjual)
- **Kolom Tabel**:
  1. `#` (Peringkat Ranking)
  2. `Nama Item / Menu`
  3. `Qty Terjual`
  4. `Total Revenue (Rp)`
  5. `% Kontribusi Omzet`
- **Styling Tabel**: Clean executive table layout (zebra striping, header gelap, alignment rata kanan untuk angka).

---

## 4. Technical Stack & Data Flow

### 4.1 Libraries
- `jspdf`: Core PDF document generation engine.
- `jspdf-autotable`: Table generator plugin for jsPDF.

### 4.2 Data Source
Menggunakan React state yang sudah dikalkulasi di `ReportsView.tsx`:
- `analytics.bestSellers`: `[{ name, qty, revenue }]`
- `analytics.grossRevenue`
- `analytics.completedOrders`
- `selectedOutletName`
- `range` & custom dates.

---

## 5. Decision Log

| No | Decision Point | Selected Option | Alternatives Considered | Rationale |
|---|---|---|---|---|
| 1 | Focus Output Data | Rekap Rincian Item Terjual & Performa Produk | Raw Transaction History Logs | Manajemen membutuhkan ringkasan agregat produk terjual daripada ribuan baris log mentah. |
| 2 | Button Position | Top Header Card (Beside Filters) | Bottom Action Bar | Agar pengguna langsung menyadari dan menggunakan tombol cetak tepat setelah mengubah filter cabang/tanggal. |
| 3 | Export Engine | Client-side `jsPDF` + `jspdf-autotable` | Browser `window.print()` | Langsung menghasilkan file `.pdf` fisik tanpa memerlukan dialog print browser. |
| 4 | File Naming | Dynamic Filename | Static `report.pdf` | Memudahkan identifikasi file bagi owner & manajemen saat mengarsipkan dokumen. |
