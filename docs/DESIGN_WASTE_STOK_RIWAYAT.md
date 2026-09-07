# Desain Teknis: Modul Waste & Riwayat Waste Aplikasi Stok

**Status:** Validated / Final Design  
**Tanggal:** 2026-09-07  
**Aplikasi Terkait:** `apps/stok`  
**Target Pengguna:** Staff Outlet & Approver (Leader, SPV, Central Kitchen, Admin, Owner)

---

## 1. Understanding Summary (Ringkasan Pemahaman)

- **Latar Belakang & Masalah:**  
  Di aplikasi `apps/stok`, menu yang tersedia sebelumnya hanya **Persetujuan Waste** (`/stok/waste-approval`), yang secara eksklusif hanya menampilkan laporan berstatus `PENDING`. Begitu disetujui atau ditolak, laporan tersebut seketika hilang dari pandangan. Selain itu, halaman `waste-history` ("Riwayat Waste Saya") sebelumnya terisolasi dan tidak terhubung ke navigasi utama. Akibatnya, baik approver maupun staf outlet tidak memiliki rekam jejak historis untuk mengaudit bahan baku yang terbuang, memeriksa alasan penolakan, maupun meninjau foto bukti kerusakan.

- **Apa yang Dibangun:**
  1. **Restrukturisasi Navigasi Berhirarki:**
     - **Parent Menu:** `Waste`
     - **Child 1:** `Persetujuan Waste` (khusus role Approver, menampilkan daftar pending dengan badge jumlah antrean).
     - **Child 2:** `Riwayat Waste` (terbuka untuk seluruh staf; staf outlet melihat data outletnya, approver melihat outlet sesuai scope wilayah binaannya).
  2. **Sub-Routing Terpadu di Next.js App Router:**
     - `/stok/waste/approval` — Halaman persetujuan laporan pending.
     - `/stok/waste/history` — Halaman riwayat komprehensif.
     - Layout bersama (`/stok/waste/layout.tsx`) dengan **Tab Switcher** atas: `[ ⏳ Persetujuan Waste (N) ]` dan `[ 📋 Riwayat Waste ]`.
     - Redirect otomatis dari path lama (`/stok/waste-approval` dan `/stok/waste-history`) ke path baru.
  3. **Halaman Riwayat Komprehensif:**
     - Filter rentang tanggal (default: 30 hari terakhir).
     - Filter status instan (`Semua`, `Disetujui`, `Ditolak`, `Menunggu`).
     - Filter outlet (otomatis aktif untuk role multi-outlet).
     - Tampilan tabel desktop & kartu mobile responsif.
     - Modal pop-up penampil foto bukti resolusi penuh.
     - Pagination server-side (25 baris/halaman).

- **Target Pengguna & Wewenang:**
  - **Approver Resmi Waste (Hanya 5 Role):**
    1. `area_manager` (Area Manager — wilayah outlet binaan)
    2. `regional_manager` (Regional Manager — lintas semua outlet)
    3. `admin` (Admin Pusat — lintas semua outlet)
    4. `kitchen` (Central Kitchen — lintas semua outlet)
    5. `developer` (Developer / Tech Support — lintas semua outlet)
  - **Staf Outlet & Pengawas Non-Approver (`leader`, `spv`, `crew`, `kasir`, dll.):**
    - Tidak memiliki akses approval (menu/tab *Persetujuan Waste* disembunyikan).
    - Memiliki akses ke **Riwayat Waste** untuk memantau status laporan (staf melihat outletnya, leader/spv melihat outlet binaannya).

- **Key Constraints:**
  - Otorisasi outlet wajib divalidasi ketat di sisi server via Server Actions (`assertOutletAccessible` & `getAccessibleOutletIds`).
  - Tidak mengubah trigger pemotongan stok PostgreSQL yang sudah ada.

- **Non-Goals:**
  - Tidak menggantikan Dashboard Kerugian Finansial level eksekutif di `apps/admin-dashboard` (yang fokus ke gap HPP dan KPI finansial makro).
  - Tidak menyediakan form edit/revisi jumlah waste saat status sudah final.

---

## 2. Assumptions & Non-Functional Requirements (NFR)

1. **Performa:**  
   Query riwayat menggunakan server-side pagination dengan limit 25 item per halaman. Default tanggal otomatis membatasi pada 30 hari terakhir untuk mencegah beban query berlebih.
2. **Keamanan & Privasi:**  
   Staf outlet tidak dapat melihat data outlet lain. Validasi outlet id diperiksa langsung di server action berdasarkan `outlet_staff.outlet_id` dan `staff_outlets`.
3. **Respon Cepat Antarmuka (UX):**  
   Pengguna di mobile maupun desktop dapat berpindah antara tab Persetujuan dan tab Riwayat dengan satu ketukan melalui Tab Switcher di bagian atas halaman tanpa perlu membuka drawer navigasi utama.
4. **Penanganan Kasus Tanpa Foto:**  
   Jika sebuah laporan tidak menyertakan foto bukti (`photo_url` null), antarmuka menampilkan label informatif *"Tanpa Foto"* tanpa merusak layout atau memicu error.

---

## 3. Decision Log (Catatan Keputusan)

| # | Keputusan | Alternatif yang Dipertimbangkan | Alasan Pemilihan |
|---|-----------|----------------------------------|-------------------|
| 1 | **Hirarki Menu Parent: Waste, Child: Persetujuan & Riwayat** | Menu datar (flat) atau halaman riwayat tersembunyi | Memberikan kejelasan navigasi dan mengelompokkan fungsionalitas pengelolaan waste dalam satu payung logis. |
| 2 | **Hak Akses Terbuka dengan Batasan Role** | Hanya untuk Approver, atau Semua role tanpa batasan | Memberikan transparansi kepada kru outlet agar tahu apakah laporan mereka disetujui atau ditolak (beserta alasannya), tanpa memberi mereka wewenang approval. |
| 3 | **Opsi 1: Sub-routing dengan Tab Switcher Terpadu (`/stok/waste/...`)** | Single route dengan query param (Opsi 2) atau Halaman terpisah tanpa tab (Opsi 3) | URL menjadi bersih dan bookmarkable, UX berpindah antar tab sangat mulus di mobile & desktop, serta kode modular dan mudah dipelihara. |
| 4 | **Filter Lengkap & Modal Foto Bukti** | Hanya kartu sederhana tanpa filter | Memudahkan supervisor dan staf dalam mencari rekam jejak insiden tertentu dan memverifikasi bukti fisik secara cepat. |
| 5 | **Redirect Otomatis dari Path Lama** | Menghapus langsung route lama | Mencegah error 404 pada bookmark browser atau link histori pengguna yang tersimpan. |

---

## 4. Spesifikasi Arsitektur & Komponen

### 4.1 Struktur File & Routing
```
apps/stok/src/
├── app/
│   ├── actions/
│   │   └── waste.ts                # Penambahan fetchWasteHistory & filter helpers
│   └── stok/
│       ├── waste/
│       │   ├── layout.tsx           # Layout bersama + Tab Switcher ([Persetujuan] | [Riwayat])
│       │   ├── approval/
│       │   │   └── page.tsx         # Halaman antrean pending approval
│       │   └── history/
│       │       └── page.tsx         # Halaman riwayat laporan waste
│       ├── waste-approval/
│       │   └── page.tsx             # Redirect ke /stok/waste/approval
│       └── waste-history/
│           └── page.tsx             # Redirect ke /stok/waste/history
├── components/
│   ├── common/
│   │   └── BottomNav.tsx            # Penyesuaian navigasi mobile cerdas
│   ├── layout/
│   │   └── AppSidebar.tsx           # Penyesuaian grup menu sidebar desktop
│   └── waste/
│       ├── WasteHistoryFilterBar.tsx # Komponen filter tanggal, status, outlet
│       ├── WasteHistoryList.tsx      # Komponen tabel desktop & list kartu mobile
│       └── WastePhotoModal.tsx       # Modal preview foto bukti
└── hooks/
    └── useWaste.ts                  # Hook useWasteHistory dengan TanStack Query
```

### 4.2 Spesifikasi Server Action (`fetchWasteHistory`)
```typescript
export interface WasteHistoryFilter {
  outletId?: string
  status?: 'ALL' | 'APPROVED' | 'REJECTED' | 'PENDING'
  from?: string // YYYY-MM-DD
  to?: string   // YYYY-MM-DD
  page?: number // default 1
  limit?: number // default 25
}

export interface WasteHistoryResult {
  data: WasteReportItem[]
  totalCount: number
  totalPages: number
  page: number
}
```

### 4.3 Data Relasi yang Ditampilkan
- **Bahan Baku:** Nama, satuan besar, satuan tengah, satuan kecil, faktor konversi.
- **Kuantitas Terbuang:** Diformat menggunakan `formatTriUnitSaldo`.
- **Status Laporan:**
  - `APPROVED`: Disetujui (badge hijau) + nama penyetuju + waktu approve.
  - `REJECTED`: Ditolak (badge merah) + nama penolak + catatan alasan penolakan.
  - `PENDING`: Menunggu (badge kuning).
- **Foto Bukti:** Tombol lihat foto yang membuka `WastePhotoModal`.

---

## 5. Rencana Pengujian & Verifikasi

1. **Uji Navigasi & Hak Akses:**
   - Login sebagai kru outlet: Pastikan hanya melihat tab `Riwayat Waste` dan data terbatas pada outlet tempatnya bertugas.
   - Login sebagai Leader/SPV: Pastikan melihat kedua tab (`Persetujuan Waste` dan `Riwayat Waste`) dan dapat memfilter outlet binaannya.
2. **Uji Filter Riwayat:**
   - Verifikasi filter tanggal (mengubah rentang tanggal).
   - Verifikasi filter status (memilih Disetujui, Ditolak, Menunggu, atau Semua).
   - Verifikasi pagination (pindah halaman 1, 2, dst.).
3. **Uji Preview Foto:**
   - Klik laporan yang memiliki foto bukti: pastikan gambar tampil jelas di dalam modal.
   - Klik laporan tanpa foto: pastikan menampilkan placeholder yang rapi tanpa error.
4. **Uji Typecheck & Build:**
   - Jalankan `yarn type-check` atau `npm run type-check` untuk memastikan tidak ada kesalahan tipe data.
