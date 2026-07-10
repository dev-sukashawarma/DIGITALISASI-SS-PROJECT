# Implementation Plan: Fitur Input Waste (Stock Page)

Fitur ini memungkinkan *crew* mencatat barang *waste* (rusak/terbuang) beserta foto bukti, yang kemudian akan divalidasi oleh SPV untuk memotong stok fisik.

## Open Questions (Untuk Diputuskan Sebelum Eksekusi)
> [!IMPORTANT]
> - **Bucket Foto:** Apakah kita akan menggunakan *bucket* Supabase yang sudah ada (misal `kiosk_assets`) untuk menyimpan foto waste, atau membuat *bucket* baru khusus `waste_evidence`?
> - **Halaman Approval SPV:** Apakah fitur persetujuan (Approve/Reject) untuk SPV akan ditaruh di dalam aplikasi `stok` (sebagai menu terpisah yang diproteksi) atau diletakkan di aplikasi `owner-dashboard` / `admin-dashboard`?
> - **Tabel DB:** Rencana saya adalah membuat tabel baru `stok_waste_reports`. Apakah ini disetujui, atau Anda lebih memilih memakai tabel `stok_ledger` yang sudah ada namun ditambahkan kolom status dan foto?

## Proposed Changes

### 1. Database Migrations (Supabase)

#### [NEW] `supabase/migrations/[timestamp]_create_stok_waste_reports.sql`
- Membuat tabel baru `stok_waste_reports`:
  - `id` (uuid, primary key)
  - `outlet_id` (uuid, FK ke outlets)
  - `bahan_baku_id` (uuid, FK ke bahan_baku)
  - `qty` (numeric)
  - `reason` (text - e.g., 'gosong', 'jatuh', 'basi')
  - `photo_url` (text)
  - `status` (enum: 'PENDING', 'APPROVED', 'REJECTED')
  - `reported_by` (uuid)
  - `approved_by` (uuid)
  - `created_at`, `updated_at` (timestamp)
- Membuat RLS (Row Level Security) *policies* agar *crew* bisa melakukan `INSERT` dan SPV bisa melakukan `UPDATE`.
- Membuat *Trigger* atau *Database Function*: 
  - Jika `status` di-update menjadi `APPROVED`, sistem akan otomatis meng-*insert* data ke `stok_ledger` dengan jenis transaksi `WASTE` dan mengurangi nilai `stok_balance`.

---

### 2. Frontend - Aplikasi Stok (`apps/stok`)

#### [NEW] `apps/stok/src/components/stok/WasteModal.tsx`
- Komponen *pop-up* (Modal) baru yang berisi *form*:
  - **Qty**: Input angka jumlah barang.
  - **Reason**: Dropdown alasan waste.
  - **Kamera/Upload**: Fitur mengambil/mengunggah foto bukti fisik.
- Logika penyimpanan gambar ke Supabase Storage.
- Pemanggilan aksi (Server Action) untuk menyimpan data ke `stok_waste_reports` dengan status `PENDING`.

#### [MODIFY] `apps/stok/src/components/stok/MonitoringDashboard.tsx`
- Menambahkan tombol **"Lapor Waste"** di setiap baris item (Bahan Baku) pada halaman Monitoring atau Opname.
- Jika tombol diklik, akan memicu `WasteModal` untuk item tersebut.
- Memberikan indikator (misal *badge* kuning) jika suatu bahan memiliki laporan waste yang masih berstatus "Pending".

#### [NEW] `apps/stok/src/app/actions/waste.ts`
- *Server Actions* untuk Next.js:
  - `submitWasteReport(data)`: Memasukkan data waste ke DB.
  - `uploadWasteEvidence(file)`: Fungsi *upload* foto.
  - `approveWasteReport(id)`: Fungsi untuk SPV mengubah status jadi `APPROVED` (akan dibahas di poin 3).

---

### 3. Frontend - Approval Page (Aplikasi SPV / Owner)

#### [NEW] `apps/owner-dashboard/src/app/waste-approval/page.tsx` (atau di app admin)
- Halaman khusus SPV/Owner untuk melihat daftar *waste* yang berstatus `PENDING`.
- Menampilkan foto bukti, jumlah, dan alasan.
- Terdapat tombol **Approve** dan **Reject**.
- Saat di-*approve*, memanggil server action yang akan memperbarui status DB, dan otomatis trigger DB memotong *stok balance*.

## Verification Plan

### Automated / Manual Tests
1. **Simulasi Input Waste:** *Login* sebagai kru, buka aplikasi stok, klik tombol Lapor Waste pada daging sapi, isi kuantitas, pilih alasan, dan unggah foto *dummy*. Verifikasi bahwa *stok balance* **BELUM** berkurang.
2. **Validasi Tabel PENDING:** Cek tabel `stok_waste_reports` di Supabase untuk memastikan data masuk dengan status `PENDING` beserta URL foto.
3. **Simulasi Approval:** *Login* sebagai SPV, buka halaman Approval, lihat foto dan laporan, lalu klik **Approve**.
4. **Verifikasi Stok Berkurang:** Cek *stok balance* daging sapi. Harusnya berkurang sesuai QTY yang diinput. Cek tabel `stok_ledger` terdapat catatan transaksi jenis "WASTE".
