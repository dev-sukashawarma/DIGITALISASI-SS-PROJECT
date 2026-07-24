# Spec 1 — Role Purchase & Pengadaan (apps/admin-dashboard + apps/finance)

**Tanggal:** 2026-07-23
**Status:** Design — menunggu review sebelum plan
**Scope:** Role `purchase` baru + alur pengadaan bahan baku end-to-end sampai stok masuk gudang. **TIDAK** termasuk mekanik pembayaran bertermin/cicilan/faktur pajak → itu **Spec 2** (menyusul, di `apps/finance`).

---

## 1. Latar & Masalah

Modul Purchase Order sudah jalan di `apps/admin-dashboard` (`/dashboard/pembelian`): buat PO, verifikasi terima (→ ledger + FIFO + harga master), master supplier, laporan pembelian, alert selisih harga. Tapi:

1. **Tidak ada role pembelian dedicated.** Akses PO hari ini = `admin` atau `kitchen` (`can_manage_po()`). Belum ada orang khusus yang bertanggung jawab atas pengadaan.
2. **Hulu kosong.** Data untuk memutuskan "harus beli apa" sudah ada (`monitoring_view_spv`, `stockout_forecast_spv`, `permintaan_bahan`), tapi tidak ada satu pun yang disajikan ke orang pembelian. Keputusan beli hidup di kepala orang.
3. **Tidak ada gerbang approval.** PO bisa langsung dikirim tanpa persetujuan finance.
4. **Pemisahan tugas lemah.** `verifikasi_terima_po` (yang benar-benar menambah stok & menetapkan harga beli) bisa dijalankan siapa saja yang lolos `can_manage_po()` — termasuk orang yang memesan.
5. **Harga master ditimpa tanpa jejak.** `po_on_verified()` meng-upsert `bahan_baku_harga.harga_beli` = harga terima; nilai lama hilang, tidak ada riwayat.
6. **Termin supplier tidak terstruktur.** Cuma teks bebas di `supplier.catatan`; tidak bisa dihitung jadi tanggal jatuh tempo.

## 2. Pelaku & Pemetaan Role

| Pelaku lapangan | Role sistem | App |
|---|---|---|
| Vendor / supplier | — (eksternal, bukan user) | — |
| Purchasing | `purchase` (**baru**) | admin-dashboard |
| Stokis / admin kitchen gudang | `kitchen` (sudah ada) | stok, distribusi |
| Finance | `admin_finance` (sudah ada) | finance |
| Owner / Admin | `owner` / `admin` | info only, **tanpa aksi approval** |

## 3. Alur Pengadaan (end-to-end)

1. **Stokis** cek stok; bila kurang → ajukan permintaan ke purchasing (jalur PR manual **atau** muncul otomatis di halaman "Perlu Dibeli").
2. **Purchasing** hubungi vendor, susun draft PO (pilih vendor, qty, harga).
3. **Finance approve komitmen** (gerbang tunggal, **sebelum** PO dikirim). Tolak → PO balik ke draft.
4. **Purchasing** kirim PO ke vendor; PO terkunci.
5. **Vendor** kirim barang + invoice (driver bawa invoice fisik ke gudang).
6. **Stokis** verifikasi terima (purchasing mendampingi, cek fisik); **stokis yang commit** di sistem.
7. **Sistem** catat otomatis: ledger stok, batch FIFO, update harga master + tulis riwayat.
8. *(Spec 2)* Finance transfer per termin dari tanggal barang datang; purchasing teruskan bukti transfer ke vendor.
9. *(Spec 2)* Vendor kirim faktur pajak setelah lunas.

**Keputusan kunci yang membentuk desain:**
- **Approval = finance, tunggal.** Owner/admin hanya melihat, tidak ada tombol approve. (Menggantikan asumsi awal "owner/admin approve".)
- **Terima = stokis commit, purchasing dampingi.** Purchasing **tidak boleh** jadi hakim atas barangnya sendiri — ditegakkan **di dalam RPC**, bukan sekadar menyembunyikan tombol.
- **Purchasing tidak pernah pegang uang.** Read-only atas status bayar; finance yang eksekusi transfer (Spec 2).
- **Cakupan belanja:** bahan baku (→ ledger) + non-stok/ATK/galon/servis (→ `expenses`). Aset/barang modal **ditunda** (YAGNI).
- **Rumah aplikasi:** perluas `admin-dashboard` (pola `mitra`), bukan app baru.

## 4. Perubahan Data (DB)

### 4.1 Role
- `outlet_staff.role` CHECK constraint → tambah `'purchase'` (migration, pola sama seperti `mitra` di `20260629100000`).
- `packages/auth`: tambah `'purchase'` ke union `Role`; `ROLE_APP_ACCESS.purchase = ['admin-dashboard']`.
  - ⚠️ **Wajib `yarn build` di `packages/auth`** — consumer import `dist/`, perubahan `src` tidak berlaku tanpa rebuild.
  - ⚠️ **Ranjau `spv → admin-dashboard`** (tercatat sesi 2026-07-20 di `packages/auth/src/access.ts`) akan ikut aktif saat rebuild. **Harus diputuskan di task yang sama** (buang atau sengaja), jangan menyala diam-diam.
- Akun `purchase` di-assign ke outlet dummy **Kantor Pusat** (bekerja untuk Gudang Pusat, bukan satu outlet ritel).

### 4.2 Riwayat harga master
- Tabel baru `bahan_baku_harga_history` — 1 baris tiap `po_on_verified()` menimpa harga master:
  `bahan_baku_id, harga_lama, harga_baru, ref_po_id, changed_by, changed_at`.
- `po_on_verified()` diperluas: sebelum upsert `bahan_baku_harga`, INSERT baris history (ambil `harga_lama` dari nilai existing). Perilaku harga master **tidak berubah** (tetap otomatis ikut harga terima) — hanya ditambah jejak.

### 4.3 Permintaan Pembelian (PR)
- Tabel baru `purchase_request`:
  `id, requested_by, bahan_baku_id (nullable — boleh teks bebas non-stok), nama_bebas (text, nullable), qty, satuan, alasan, urgensi (rendah/normal/mendesak), status (pending/jadi_po/ditolak), linked_po_id (nullable), created_at, updated_at`.
- **Pengaju:** `kitchen` (stokis, utama) + `spv`. Leader outlet **tidak** lewat PR — kebutuhan mereka sudah tercakup jalur `permintaan_bahan` existing yang muncul otomatis di halaman "Perlu Dibeli".
- Saat purchasing ubah PR → draft PO: set `status='jadi_po'` + `linked_po_id`. Pengaju bisa lihat progres tanpa bertanya manual.
- **PR ≠ approval.** PR disetujui purchasing = "saya akan belikan"; PO hasilnya tetap wajib lewat approval finance.

### 4.4 Termin & tanggal
- `supplier.termin_hari` — integer, nullable (belum semua supplier punya kesepakatan tertulis). Default termin per supplier.
- `purchase_order`:
  - `jatuh_tempo` (date, nullable) — dihitung otomatis saat `diverifikasi_at` terisi: `diverifikasi_at::date + supplier.termin_hari`. Boleh **ditimpa manual** per PO untuk kesepakatan khusus.
  - Tiga tanggal eksplisit: **date of issue** = `tanggal_po` (PO dikirim, sudah ada); **date of arrival** = `diverifikasi_at` (sudah ada); **payment due** = `jatuh_tempo` (baru).
- Status PO — sisipkan gerbang approval finance antara draft dan kirim:
  - `draft` → `menunggu_approval_finance` → `dikirim_ke_supplier` → `sebagian_diterima`/`diterima_lengkap` → (`dibatalkan`).
  - Tolak finance: `menunggu_approval_finance` → `draft`.
  - Tambah kolom audit: `disetujui_finance_oleh`, `disetujui_finance_at`.

### 4.5 View usulan beli
- `purchase_suggestion_spv` — scope **Gudang Pusat saja** (`550e8400-e29b-41d4-a716-446655440001`), gabungan:
  - `monitoring_view_spv` — stok sekarang vs threshold.
  - `stockout_forecast_spv` — `days_left` (laju pakai 7 hari).
  - `permintaan_bahan` (status pending) — permintaan outlet belum terpenuhi.
  - `purchase_order_item` di PO berstatus terkirim/belum-datang — **sudah dipesan** (mencegah saran dobel).
- View menyajikan **data mentah** per bahan. **Aritmetika qty saran ada di TypeScript (fungsi murni), bukan di SQL** — supaya bisa di-unit-test dengan angka nyata & diperbaiki tanpa migration.

## 5. RLS / RPC (perluas yang ada, bukan baru)

- `can_manage_po()` → tambah role `purchase` (boleh buat/ubah draft PO, kirim PO).
- **`verifikasi_terima_po`** → tambah guard **eksplisit menolak** role `purchase` (fail-closed di dalam RPC). Hanya `kitchen`/`admin`/`owner` yang boleh commit terima. Ini pelajaran langsung dari lubang otorisasi 2026-07-20 — jangan andalkan UI menyembunyikan tombol.
- **Approval finance:** RPC baru `approve_po_finance(p_po_id)` / `reject_po_finance(p_po_id, alasan)` — guard `is_finance()`, transisi status + tulis kolom audit. Dipanggil dari `apps/finance`.
- `po_payable_spv` / status bayar → tambah policy SELECT untuk `purchase` (**read-only**). Purchasing perlu tahu "supplier ini belum dibayar N PO" untuk jaga hubungan, tapi tidak menyentuh uang.
- **Tabel keuangan lain** (`expenses` scope Pusat, payroll, setoran, `cash_transaction`) → **tidak** membuka policy untuk `purchase`.

## 6. Surface UI

### admin-dashboard (role `purchase`)
Nav grup "Pembelian" (guard 3 lapis: nav filter + `RoleContext`/route guard `'PURCHASE'` redirect ke `/dashboard/pembelian` + RLS):
1. **Perlu Dibeli** — layar utama. Baris dari `purchase_suggestion_spv`; urut: mendesak (di bawah threshold **atau** `days_left ≤ 3`) → menipis → aman. Qty saran = kebutuhan **7 hari** ke depan (default, mudah diubah). Centang baris → tombol → draft PO, dikelompokkan per supplier via `supplier.bahan_baku_ids`. Qty saran boleh diedit.
2. **Purchase Order** — existing, diperluas: status `menunggu_approval_finance`, tanggal jatuh tempo, badge status bayar (read-only).
3. **Permintaan Pembelian (PR)** — antrean PR masuk; ubah jadi draft PO.
4. **Supplier** — existing + field `termin_hari`.
5. **Harga & Bahan Baku** — tren/riwayat harga per bahan (dari `bahan_baku_harga_history`); alert selisih harga (existing `usePOPriceAlerts`).
6. **Laporan Pembelian** — existing.

### finance (role `admin_finance`)
- Antrean **"PO menunggu approval"** di `apps/finance` (area yang sudah baca `po_payable_spv`). Approve/tolak via RPC di §5. Batas aplikasi tetap bersih — tidak ada role yang dapat akses app baru.

## 7. Yang TIDAK Disentuh (milik Spec 2)

`settle_purchase_order()`, `cash_transaction`, tabel finance lain, mekanik cicilan/pembayaran sebagian, `payment_status` multi-nilai, antrean jatuh tempo terurut + aging, faktur pajak, arus kas. Spec 1 hanya **melahirkan kolom** `jatuh_tempo`/`termin_hari` yang jadi fondasi Spec 2.

## 8. Pengujian

Proyek tanpa e2e (sesuai CLAUDE.md). Strategi:
- **Fungsi murni + unit test** (pola `approver.ts`, `wasteGap.ts`):
  - Aritmetika qty saran (`purchase_suggestion` → qty).
  - Hitung `jatuh_tempo` dari arrival + termin.
  - Predikat siapa-boleh-apa (`canComposePO`, `canApprovePOFinance`, `canVerifyReceipt` — yang terakhir **harus menolak** `purchase`).
- **UI pakai predikat yang SAMA** dengan RPC (hindari dua tempat menebak aturan role sendiri-sendiri — penyakit asli lubang 2026-07-20).
- **Verifikasi manual RLS/RPC:** login sebagai `purchase` → coba akses halaman owner (harus ditolak) → panggil `verifikasi_terima_po` langsung (harus ditolak) → panggil `approve_po_finance` (harus ditolak, bukan finance).

## 9. Risiko & Catatan

- **Rebuild `packages/auth`** memicu ranjau `spv → admin-dashboard` — putuskan bersamaan.
- **Migration drift** rutin di DB shared ini — verifikasi ground-truth (`pg_get_functiondef`, `supabase db query --linked`) sebelum `migration repair`, jangan andalkan `migration list`.
- **Isolasi role baru:** ikuti pola `mitra` (scoped views + RoleContext + guard berlapis). Nav-hiding saja tidak cukup — RLS adalah penjaga sesungguhnya.
- Guard `verifikasi_terima_po` menolak `purchase` = inti pemisahan tugas; jangan dilewati demi kemudahan.

---

**Artefak turunan:** plan implementasi → `docs/superpowers/plans/2026-07-23-role-purchase-pengadaan.md` (menyusul).
**Spec 2 (menyusul):** Hutang Supplier Bertermin — `apps/finance`.
