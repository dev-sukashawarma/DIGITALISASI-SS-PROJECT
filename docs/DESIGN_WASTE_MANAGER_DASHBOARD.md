# Desain Teknis: Integrasi Data Waste & Modul Persetujuan Manager Dashboard

**Status:** Validated / Final Design  
**Tanggal:** 2026-09-03  
**Aplikasi Terkait:** `apps/manager`  
**Target Pengguna:** Area Manager (AM) & Regional Manager (RM)

---

## 1. Understanding Summary (Ringkasan Pemahaman)

- **Apa yang Dibangun:**
  1. Halaman khusus **Waste Stok** (`/waste`) di aplikasi Manager dengan 2 tab:
     - **Tab 1: Menunggu Persetujuan (`PendingWasteTab`):** Daftar pengajuan waste `PENDING` dari outlet, kartu detail bahan baku, foto bukti fisik kerusakan, kuantitas terbuang, estimasi kerugian nominal (Rp), staf pelapor, tombol aksi **Setujui** (full approve) dan **Tolak** (full reject dengan dialog alasan penolakan).
     - **Tab 2: Riwayat & Analitik (`WasteHistoryTab`):** Kartu ringkasan metrik (Total Kerugian Rp, Total Insiden Laporan, Top 3 Bahan Paling Sering Terbuang), filter rentang tanggal, filter outlet, dan tabel riwayat lengkap (Approved / Rejected) beserta identitas pelapor dan approver.
  2. **Widget Ringkasan di Dashboard Overview (`/`):** Card metrik kerugian waste hari ini + badge pengingat request pending dengan link pintas ke `/waste`.
  3. **Badge Dinamis di Menu Sidebar:** Badge angka merah pada menu *Waste Stok* yang merefleksikan jumlah request pending.
- **Tujuan Fitur:** Memberikan kendali penuh kepada manajer (AM & RM) untuk memverifikasi bukti fisik limbah/kerusakan sebelum stok bahan baku dipotong dari kartu stok, serta memonitor tingkat kerugian bahan baku di setiap outlet.
- **Target Pengguna & Wewenang:**
  - **Area Manager (AM):** Hanya dapat memantau data dan menyetujui request dari outlet-outlet yang ditugaskan kepadanya (`staff_outlets`).
  - **Regional Manager (RM):** Dapat memantau data dan menyetujui request dari seluruh outlet aktif.
- **Batasan Utama (Key Constraints):**
  - Otorisasi outlet wajib divalidasi ketat di sisi server (*server-side authorization*) pada setiap Server Action.
  - Pemotongan stok otomatis ke `ledger_stok` memanfaatkan trigger Postgres yang sudah ada (`trg_waste_report_approval`) saat status berubah menjadi `APPROVED`.
  - Tidak ada revisi kuantitas pada saat approval; hanya pilihan Setujui Penuh atau Tolak Penuh (disertai alasan penolakan).
- **Non-Goals:**
  - Tidak menyediakan form input laporan waste baru di sisi aplikasi Manager (input dilakukan oleh kru outlet di aplikasi POS/Stok).
  - Tidak menggunakan approval berjenjang (cukup 1 kali persetujuan mandiri oleh AM atau RM).

---

## 2. Assumptions & Non-Functional Requirements (NFR)

- **Performa:** Query riwayat menggunakan pembatasan data dan pagination (default 25–50 baris per halaman) dengan filter tanggal bawaan (default: Hari Ini / 30 Hari Terakhir) agar respons query < 1 detik.
- **Keamanan:** Sesi pengguna diverifikasi menggunakan `@suka/auth` dan pencocokan outlet AM dilakukan sebelum update DB pada Server Action.
- **Kalkulasi Nilai Rupiah:** Nilai nominal kerugian dihitung otomatis dari relasi harga beli bahan baku (`bahan_baku_harga` / HPP).
- **Integritas Data:** Aksi approval mencegah race condition dengan mengunci status awal `.eq('status', 'PENDING')`.

---

## 3. Decision Log (Catatan Keputusan)

| # | Keputusan | Alternatif yang Dipertimbangkan | Alasan Pemilihan |
|---|-----------|----------------------------------|-------------------|
| 1 | **Halaman Khusus `/waste` di Sidebar** | Tab di dalam `/approvals` atau langsung ditaruh di Overview (`/`) | Memberikan ruang yang luas untuk analitik data dan foto bukti tanpa membuat halaman persetujuan kasir (Void/Bypass) menjadi terlalu padat. |
| 2 | **1-Level Approval Mandiri** | Berjenjang berdasarkan nominal (Threshold) atau 2-Tier wajib (AM lalu RM) | Menghindari kemacetan operasional di outlet; AM dapat langsung mengeksekusi outlet binaannya, sementara RM memiliki wewenang penuh lintas outlet. |
| 3 | **Struktur 2 Tab Terpisah** | Split-view 2 kolom atau single table dengan filter status | Memisahkan dengan tegas antara tugas operasional cepat (Approval antrean) dengan tugas evaluasi berkala (Analitik & Riwayat). |
| 4 | **Badge Angka di Sidebar + Card Ringkasan di Overview** | Hanya badge sidebar atau tanpa notifikasi | Memastikan manager langsung sadar ada limbah/kerusakan yang butuh diverifikasi begitu membuka aplikasi. |
| 5 | **Setujui Penuh / Tolak Penuh** | Edit kuantitas langsung di form approval | Menjaga akuntabilitas pelaporan kru outlet; jika ada selisih fisik, laporan ditolak agar kru merevisi dengan data faktual. |
| 6 | **Arsitektur Opsi 1 (Server Actions + Realtime Context)** | Penambahan View SQL baru dan RPC Stored Procedure di database | Memaksimalkan trigger dan tabel database yang sudah siap tanpa perlu migrasi DB berisiko, serta menjaga pola kode tetap seragam di Next.js App Router. |

---

## 4. Final Architecture & Technical Design

### A. Komponen Antarmuka (UI Layer)
1. **`src/app/waste/page.tsx` & `WasteClient.tsx`:**
   - Server Component memuat data awal server-side lalu mengoper ke Client Component.
   - Mengelola state tab aktif (`pending` vs `history`), filter outlet, dan filter tanggal.
2. **`PendingWasteTab.tsx`:**
   - Menampilkan grid/list card request pending:
     - Badge nama outlet & timestamp laporan.
     - Nama bahan baku, qty & satuan, estimasi nilai nominal kerugian (Rp).
     - Alasan/catatan dari kru pelapor & nama kru pelapor.
     - Thumbnail foto bukti fisik (klik untuk modal lightbox / zoom preview).
     - Tombol aksi **Setujui** (loading state & optimis UI) dan **Tolak** (dialog alasan penolakan).
3. **`WasteHistoryTab.tsx`:**
   - KPI Summary Cards:
     - Total Kerugian Periode Ini (Rp)
     - Total Insiden Pelaporan Waste
     - Top Bahan Baku Paling Sering Terbuang
   - Filter bar: PeriodFilter (Hari ini, 7 hari, 30 hari, kustom) & StatusFilter (Semua, Approved, Rejected).
   - Tabel riwayat transaksi dengan detail status (badge hijau APPROVED / merah REJECTED) beserta alasan penolakan dan nama approver.
4. **`src/app/page.tsx` (Dashboard Overview):**
   - Menambahkan card ringkasan di jajaran metrik atas: Total Nilai Waste Hari Ini + jumlah antrean pending dengan tombol tautan langsung ke `/waste`.
5. **`ManagerLayout.tsx` & `ApprovalsContext.tsx`:**
   - Menambahkan item menu `Waste Stok` di grup Manajemen dengan ikon `AlertOctagon` / `Trash2`.
   - Mengintegrasikan hitungan pending waste report ke dalam context untuk menampilkan badge angka merah di sidebar dan bottom nav bar.

### B. Server Actions Layer (`src/app/actions/waste.ts`)
- **`getPendingWasteReports(outletId?: string)`**:
  - Mengambil daftar request berstatus `PENDING`.
  - Filter AM: hanya outlet dari `staff_outlets`.
  - Filter RM: semua outlet atau outlet terpilih.
  - Join dengan `bahan_baku`, `bahan_baku_harga`, `outlets`, dan `outlet_staff` (pelapor).
- **`getWasteHistory(params: { from: string, to: string, outletId?: string, status?: string, page?: number, limit?: number })`**:
  - Mengambil data riwayat approved/rejected dengan pagination dan filter tanggal.
- **`getWasteSummary(params: { from: string, to: string, outletId?: string })`**:
  - Menghitung agregasi KPI kerugian nominal (Rp), total insiden, dan top bahan terbuang.
- **`processWasteApproval(id: string, action: 'approve' | 'reject', rejectionReason?: string)`**:
  - Memverifikasi otorisasi outlet: memastikan pemroses memiliki wewenang atas outlet terkait.
  - Mengunci pembaruan dengan `.eq('status', 'PENDING')`.
  - Update status menjadi `APPROVED` atau `REJECTED`, `approved_by` = current manager ID, dan `rejection_reason`.
  - Trigger DB Postgres secara atomik mencatat mutasi stok keluar di `ledger_stok` bila disetujui.

---

## 5. Rencana Verifikasi (Verification Plan)

1. **Uji Otorisasi Role:**
   - Login akun AM: pastikan hanya melihat data & request dari outlet binaannya.
   - Login akun RM: pastikan dapat mengakses seluruh outlet.
2. **Uji Siklus Aksi Persetujuan:**
   - Approve: verifikasi status menjadi `APPROVED`, `approved_by` terisi, dan baris baru tercatat di `ledger_stok`.
   - Reject: verifikasi status menjadi `REJECTED`, `rejection_reason` tersimpan, dan tidak ada pengurangan stok di `ledger_stok`.
3. **Uji Reaktivitas UI:**
   - Pastikan badge counter berkurang seketika setelah approval dilakukan.
   - Pastikan angka ringkasan di dashboard overview mencerminkan data aktual secara akurat.
