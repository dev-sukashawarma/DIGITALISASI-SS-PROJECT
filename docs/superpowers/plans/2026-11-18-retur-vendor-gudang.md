# Retur Bahan Baku ke Vendor (Gudang Pusat) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gudang Pusat bisa meretur bahan yang masuk lewat PO ke vendornya, dengan persetujuan finance, pengurangan stok + saldo vendor, dan penyelesaian ganti barang / kredit vendor / uang kembali; plus barang yang ditolak saat terima PO tidak lagi ikut ditagih.

**Architecture:** Semua aturan di database: tabel baru + RPC `SECURITY DEFINER` (cek role via `auth.uid()` di dalam fungsi), diverifikasi dengan skrip SQL `supabase/verifikasi/retur_vendor/` yang berakhir ROLLBACK. App `finance` hanya memanggil RPC: halaman baru `/pembelian/retur-vendor`, jenis baru di Hub Approval, opsi pakai kredit di Pembayaran Vendor, kolom tolak di form terima PO.

**Tech Stack:** Supabase Postgres (PL/pgSQL), Next.js app router + React Query + Tailwind (`apps/finance`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-retur-vendor-gudang-design.md` — baca dulu; plan ini tidak mengulang alasannya.

## Global Constraints

- Gudang Pusat = `d23e11b3-23f1-4f9a-b428-cc73e1aa9b90` (sudah di-hardcode di `verifikasi_terima_po`).
- Hanya barang ber-PO yang bisa diretur: setiap item wajib `purchase_order_item_id`.
- Qty dokumen dalam **satuan besar** bahan (sama dengan `purchase_order_item.qty_terima`); ke ledger selalu lewat `to_ledger_scale(gudang, bahan, qty)`.
- Harga retur = `purchase_order_item.harga_terima` (fallback `harga_pesan`), dibekukan saat diajukan.
- Alasan: `rusak | kualitas_tidak_sesuai | salah_kirim | kadaluarsa | lainnya`; `lainnya` wajib catatan. Dipakai bersama oleh retur dan penolakan saat terima.
- Role ajukan: `purchasing, kitchen, admin, owner, admin_finance, developer`. Role setujui/tolak: `admin, owner, admin_finance, developer`, **bukan pengaju**. Serahkan & terima pengganti: `purchasing, kitchen, admin, owner, developer`. Catat penyelesaian & tutup sisa: `purchasing, admin, owner, admin_finance, developer`. Konfirmasi uang kembali: `admin_finance, admin, owner, developer`.
- **Jangan** pakai `is_finance()` / `can_manage_po()` (selalu true). Cek `outlet_staff` (`id = auth.uid() AND status = 'active' AND role IN (...)`), pola `ajukan_bayar_po`.
- Kredit vendor = buku baris bertanda, dikunci per **`vendor_induk(supplier_id)`**. Saldo = SUM, tidak pernah satu angka yang di-UPDATE.
- Satu cara penyelesaian per dokumen. Sisa tak terselesaikan ditutup "sisa tidak dikompensasi" (alasan wajib), **tidak** jadi kredit, **tidak** jadi biaya di laporan laba.
- Ganti barang: ledger `pembelian_supplier` **tanpa `ref_po_id`** (agar `cek_isi_kemasan_vendor` & penulisan harga/katalog tidak terpicu), tidak ada tagihan, tidak ada perubahan harga.
- Uang kembali: `cash_transaction` `direction='in'`, `source_type='retur_vendor'`; bukan pendapatan.
- Tabel baru: `REVOKE ALL FROM anon, authenticated`; SELECT lewat policy untuk role di atas; tulis hanya lewat RPC. View baru `security_invoker = true`.
- Migration bertimestamp **2026-11-18 atau 2026-11-19** (lint menolak >2 hari). Cek bentrok: `ls supabase/migrations | cut -c1-14 | sort | uniq -d` dan `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '2026111%'`. Sesudah apply: stempel + verifikasi `SELECT` stempelnya.
- Fungsi yang diubah (`verifikasi_terima_po`, `ajukan_bayar_po`, `setujui_bayar_po`, `tolak_bayar_po`, view `po_payable_spv`) diubah **terarah dari `pg_get_functiondef`/`pg_get_viewdef` live**, bukan ditulis ulang dari ingatan. Pengaman yang wajib bertahan di `verifikasi_terima_po`: PO uji coba (`v_po_uji`), salah satuan (`v_salah_satuan`), dan trigger `trg_cek_isi_kemasan_vendor` (tidak disentuh). Semua `SET search_path` / opsi fungsi dipertahankan.
- Push ke `main` = deploy `finance` otomatis. Apply migration ke DB produksi **hanya setelah OK owner** per task DB.

## Review Focus

1. **Stok bergerak antara ajukan dan serah** (outlet dikirim SJ, opname): serah harus menolak bila qty > saldo gudang atau > sisa vendor saat itu, bukan saat diajukan — `ledger_stamp_saldo` mengecualikan `retur_ke_vendor` dari larangan minus, jadi RPC satu-satunya penjaga. → Task 2, uji T2e.
2. **Retur ganda atas PO yang sama**: dua dokumen aktif untuk satu `purchase_order_item` tidak boleh total melebihi `qty_terima`. → Task 2, uji T2c.
3. **Kredit dipakai dua kali**: dua pengajuan bayar bersamaan untuk PO berbeda vendor sama tidak boleh sama-sama mencadangkan kredit yang sama. → Task 4, uji T4d (kunci `pg_advisory_xact_lock(hashtext('kredit:'||vendor_induk))`).
4. **Pembayaran ditolak setelah kredit dicadangkan**: cadangan harus lepas, saldo kredit kembali utuh. → Task 4, uji T4c.
5. **Terima PO dengan tolak sebagian lalu terima lagi**: `qty_terima` tidak boleh menghitung barang ditolak, status `diterima_lengkap` bila `qty_terima + qty_ditolak >= qty_pesan`, tagihan = qty_terima × harga. → Task 5, uji T5b.

---

## File Structure

| Path | Tanggung jawab |
|---|---|
| `supabase/migrations/20261118110000_retur_vendor_skema.sql` | Tabel, kolom, CHECK, RLS |
| `supabase/migrations/20261118111000_retur_vendor_alur.sql` | RPC ajukan/setujui/tolak/batal/serahkan |
| `supabase/migrations/20261118112000_retur_vendor_penyelesaian.sql` | RPC penyelesaian, uang masuk, terima pengganti, tutup sisa |
| `supabase/migrations/20261118113000_bayar_po_pakai_kredit.sql` | Kredit vendor di alur bayar PO + `po_payable_spv` |
| `supabase/migrations/20261118114000_terima_po_qty_ditolak.sql` | `verifikasi_terima_po` + `qty_ditolak` |
| `supabase/migrations/20261118115000_retur_vendor_ringkasan.sql` | RPC ringkasan kualitas vendor |
| `supabase/verifikasi/retur_vendor/t1…t6_*.sql`, `pemantau.sql` | Uji DB (ROLLBACK) |
| `apps/finance/src/lib/returVendor/aturan.ts` (+ `.test.ts`) | Label alasan, label status, hitung sisa & total — murni |
| `apps/finance/src/hooks/useReturVendor.ts` | React Query: daftar, detail, mutasi RPC |
| `apps/finance/src/app/pembelian/retur-vendor/page.tsx`, `ReturVendorView.tsx` | Daftar + tab + ringkasan |
| `apps/finance/src/app/pembelian/retur-vendor/baru/page.tsx`, `FormAjukanRetur.tsx` | Form ajukan |
| `apps/finance/src/app/pembelian/retur-vendor/[id]/page.tsx`, `DetailReturVendor.tsx` | Detail + aksi per status |
| `apps/finance/src/lib/approval/hub.ts`, `hooks/useHubApproval.ts`, `app/approval/*` | Jenis `retur_vendor` |
| `apps/finance/src/app/supplier/components/SupplierView.tsx`, `hooks/useSupplierSettlement.ts` | Saldo & pakai kredit |
| `apps/finance/src/app/pembelian/[id]/components/VerifikasiTerimaModal.tsx`, `hooks/usePurchaseOrder.ts`, `PODetailView.tsx` | Qty ditolak + retur terkait |
| `apps/finance/src/components/CashLayout.tsx` | Menu "Retur Vendor" |

**Catatan cakupan:** role `kitchen` tidak punya akses app finance (`packages/auth/src/access.ts`). RPC tetap mengizinkan kitchen, tapi di versi ini semua layar ada di finance, jadi kitchen bekerja lewat purchasing. Layar kitchen di app stok = pekerjaan lanjutan.

---

### Task 1: Skema

**Files:**
- Create: `supabase/migrations/20261118110000_retur_vendor_skema.sql`
- Test: `supabase/verifikasi/retur_vendor/t1_skema.sql`

**Interfaces — Produces:**
- `retur_vendor(id uuid pk, nomor text unique not null, supplier_id uuid not null → supplier, vendor_induk uuid not null, status text not null default 'diajukan' CHECK in ('diajukan','disetujui','ditolak','dibatalkan','diserahkan','selesai'), alasan text not null CHECK alasan list, catatan text, bukti_urls text[] not null default '{}', diajukan_oleh uuid, diajukan_at timestamptz, diputuskan_oleh uuid, diputuskan_at timestamptz, alasan_tolak text, dibatalkan_oleh uuid, dibatalkan_at timestamptz, alasan_batal text, diserahkan_oleh uuid, diserahkan_at timestamptz, penerima_vendor text, bukti_serah_url text, cara_penyelesaian text CHECK in ('ganti_barang','potong_tagihan','uang_kembali'), catatan_penyelesaian text, bukti_vendor_url text, uang_dijanjikan numeric, uang_diterima numeric, cash_transaction_id uuid, nilai_tidak_dikompensasi numeric not null default 0, alasan_tutup_sisa text, selesai_oleh uuid, selesai_at timestamptz, created_at, updated_at)` + CHECK `alasan <> 'lainnya' OR length(btrim(coalesce(catatan,''))) > 0`.
- `retur_vendor_item(id, retur_vendor_id → retur_vendor ON DELETE CASCADE, bahan_baku_id not null, purchase_order_item_id not null → purchase_order_item, qty numeric not null CHECK > 0, harga numeric not null CHECK >= 0, subtotal numeric GENERATED ALWAYS AS (qty*harga) STORED, alasan text not null, catatan text, qty_pengganti_diterima numeric not null default 0, ledger_serah_id uuid, UNIQUE(retur_vendor_id, purchase_order_item_id))`.
- `vendor_kredit(id, vendor_induk uuid not null, supplier_id uuid not null, jumlah numeric not null CHECK <> 0, status text not null CHECK in ('aktif','dicadangkan'), retur_vendor_id uuid, purchase_order_id uuid, catatan text, dibuat_oleh uuid, created_at)` — `+` dari retur (`aktif`), `−` pemakaian (`dicadangkan` saat bayar diajukan → `aktif` saat disetujui; baris `dicadangkan` dihapus saat ditolak). Saldo tersedia = SUM(jumlah) semua baris.
- `purchase_order_item.qty_ditolak numeric not null default 0 CHECK >= 0`, `purchase_order_item.alasan_tolak text` (CHECK alasan list or null).
- `ledger_stok.ref_retur_vendor_id uuid` (index parsial `WHERE ref_retur_vendor_id IS NOT NULL`).
- CHECK diperluas: `stok_vendor_gudang_mutasi.sumber` + `'retur_vendor'`; `cash_transaction.source_type` + `'retur_vendor'`; `approval_log.jenis` + `'retur_vendor'`.
- Fungsi `retur_vendor_peran_ok(p_lingkup text) returns boolean` (SECURITY DEFINER, STABLE) dengan lingkup `ajukan | putus | serah | selesaikan | uang` → daftar role Global Constraints.
- RLS SELECT ketiga tabel baru: `retur_vendor_peran_ok('ajukan') OR retur_vendor_peran_ok('putus')`.

Ganti CHECK dengan `DROP CONSTRAINT … ADD CONSTRAINT … NOT VALID` lalu `VALIDATE` (pola CHECK ledger). Sebelum mengubah CHECK `ledger_stok`/`cash_transaction`, set `lock_timeout = '5s'` (tabel di publication realtime; insiden deadlock drop-ship).

- [ ] **Step 1: Tulis `t1_skema.sql`** — BEGIN … ROLLBACK, assersi: ketiga tabel ada; `anon`/`authenticated` tanpa INSERT/UPDATE/DELETE (`has_table_privilege`); crew (fixture role `crew`) SELECT `retur_vendor` → 0 baris walau ada baris yang disisipkan sebagai postgres; admin_finance SELECT → 1; CHECK `alasan='lainnya'` tanpa catatan ditolak; `cash_transaction` dengan `source_type='retur_vendor'` diterima; `qty_ditolak` default 0. Penanda gagal `RAISE EXCEPTION 'T1x …'`.
- [ ] **Step 2: Jalankan t1 sebelum migration** → harus gagal di asersi pertama (tabel belum ada).
- [ ] **Step 3: Tulis migration** sesuai Interfaces.
- [ ] **Step 4: Minta OK owner, apply, stempel, jalankan t1** → lulus. Kontrol negatif: ubah satu asersi agar salah (mis. harapkan crew melihat 1 baris) → harus `RAISE`.
- [ ] **Step 5: Commit** `feat(db): skema retur vendor & kredit vendor`

### Task 2: RPC alur retur (ajukan → serah)

**Files:**
- Create: `supabase/migrations/20261118111000_retur_vendor_alur.sql`
- Test: `supabase/verifikasi/retur_vendor/t2_alur.sql`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `ajukan_retur_vendor(p_supplier_id uuid, p_alasan text, p_catatan text, p_bukti_urls text[], p_items jsonb) returns uuid` — `p_items`: `[{purchase_order_item_id, qty, alasan, catatan}]`; `bahan_baku_id` & `harga` diambil dari item PO. Nomor `RV/YYYY/MM/NNN` dari `nomor_urut_berikut('RV', tanggal WIB)` (nomor urut per bulan: pakai tanggal hari pertama bulan WIB).
  - `putuskan_retur_vendor(p_id uuid, p_setuju boolean, p_alasan text default null) returns void` — tolak wajib alasan; pemutus ≠ `diajukan_oleh`; tulis `approval_log` (jenis `retur_vendor`, keputusan `setuju|tolak`, nominal = SUM subtotal).
  - `batalkan_retur_vendor(p_id uuid, p_alasan text) returns void` — hanya status `diajukan|disetujui`, oleh pengaju atau role `putus`.
  - `serahkan_retur_vendor(p_id uuid, p_penerima_vendor text, p_bukti_url text) returns void` — status `disetujui` → `diserahkan`; bukti wajib.

Aturan validasi (spec §5.4): semua PO milik `vendor_induk` yang sama dengan `vendor_induk(p_supplier_id)`, status PO `sebagian_diterima|diterima_lengkap`; qty ≤ `qty_terima` − SUM qty retur lain berstatus selain `ditolak|dibatalkan` untuk item PO yang sama (dicek saat ajukan dan diulang saat serah). Saat serah, di bawah kunci `pg_advisory_xact_lock(hashtext('svgm:'||bahan||':'||vendor))` untuk tiap pasangan, urut `bahan::text, vendor::text`: `to_ledger_scale(gudang, bahan, qty)` ≤ saldo `stok_balance` gudang; bila `saldo_vendor_gudang(array[bahan])` mengembalikan `multi = true AND aktif = true`, qty ≤ `sisa` baris vendor itu. Urutan tulis: mutasi vendor (`sumber='retur_vendor'`, qty negatif, `ref_ledger_id` = id ledger yang sudah ditentukan lewat `gen_random_uuid()`) **lalu** ledger (`tipe='retur_ke_vendor'`, qty negatif, `ref_retur_vendor_id`, catatan `'Retur ' || nomor || ' — ' || nama bahan`), pola `catat_penyesuaian_gudang_vendor`. Simpan `ledger_serah_id` di item.

- [ ] **Step 1: Tulis `t2_alur.sql`** dengan fixture PO `diterima_lengkap` nyata milik satu supplier (ambil PO terbaru yang punya item ber-bahan), set saldo gudang cukup lewat `catat_penyesuaian_gudang_vendor` atau ledger `adjustment` dalam transaksi. Kasus:
  - T2a crew `ajukan_retur_vendor` → `insufficient_privilege`.
  - T2b purchasing ajukan 1 item qty 1 → status `diajukan`, nomor diawali `RV/`, harga = `harga_terima` item PO.
  - T2c ajukan dokumen kedua untuk item PO sama dengan qty = `qty_terima` → ditolak (`check_violation`, pesan memuat "melebihi").
  - T2d pengaju yang sama memutuskan → ditolak; admin_finance setuju → `disetujui` + 1 baris `approval_log` jenis `retur_vendor`.
  - T2e kurangi saldo gudang bahan itu sampai < qty (ledger `adjustment` negatif), lalu serah → ditolak dan **nol** baris ledger `retur_ke_vendor` lahir.
  - T2f kembalikan saldo, serah → `diserahkan`; ledger gudang berkurang tepat `to_ledger_scale(gudang, bahan, qty)`; bila bahan multi-vendor, satu mutasi `retur_vendor` dengan `ref_ledger_id` = baris ledger.
  - T2g PO milik vendor lain dalam `p_items` → ditolak.
  - T2h tolak tanpa alasan → ditolak; batal setelah `diserahkan` → ditolak.
- [ ] **Step 2: Jalankan sebelum migration** → gagal (fungsi tidak ada).
- [ ] **Step 3: Tulis migration.**
- [ ] **Step 4: OK owner → apply → stempel → t2 lulus**; kontrol negatif T2e: jalankan dengan validasi saldo dikomentari di salinan lokal skrip uji (bukan migration) dalam transaksi → harus mendeteksi baris ledger lahir.
- [ ] **Step 5: Commit** `feat(db): RPC alur retur vendor`

### Task 3: RPC penyelesaian

**Files:**
- Create: `supabase/migrations/20261118112000_retur_vendor_penyelesaian.sql`
- Test: `supabase/verifikasi/retur_vendor/t3_penyelesaian.sql`

**Interfaces — Produces:**
- `catat_penyelesaian_retur_vendor(p_id uuid, p_cara text, p_catatan text, p_bukti_vendor_url text, p_uang_dijanjikan numeric default null) returns void` — hanya status `diserahkan` dan `cara_penyelesaian IS NULL`. `potong_tagihan`: sisipkan `vendor_kredit` `+SUM(subtotal)` status `aktif` → status `selesai`. `uang_kembali`: wajib `p_uang_dijanjikan > 0`, status tetap `diserahkan`. `ganti_barang`: status tetap `diserahkan`.
- `konfirmasi_uang_retur_vendor(p_id uuid, p_cash_location_id uuid, p_jumlah numeric, p_bukti_url text, p_catatan text default null) returns uuid` — role `uang`; rekening = rekening pusat aktif (`grup IS NOT NULL AND is_active`); `cash_transaction` in, `source_type='retur_vendor'`, `source_id=p_id`, status `approved`; isi `uang_diterima`, `cash_transaction_id`; `nilai_tidak_dikompensasi = GREATEST(0, SUM(subtotal) − p_jumlah)`; status `selesai`.
- `terima_pengganti_retur_vendor(p_id uuid, p_items jsonb) returns void` — `[{retur_vendor_item_id, qty}]`; qty_pengganti_diterima + qty ≤ qty item; ledger gudang `pembelian_supplier` qty `to_ledger_scale(...)`, `ref_po_id` NULL, `ref_retur_vendor_id`, catatan `'Pengganti retur ' || nomor`; bahan multi-vendor → mutasi `retur_vendor` positif untuk `vendor_induk` dokumen (urutan mutasi lalu ledger, kunci sama Task 2). Bila semua item terpenuhi → `selesai`.
- `tutup_sisa_retur_vendor(p_id uuid, p_alasan text) returns void` — status `diserahkan` (cara apa pun atau belum ada cara); alasan wajib; `nilai_tidak_dikompensasi` = nilai yang belum terselesaikan (ganti barang: SUM((qty − qty_pengganti_diterima) × harga); uang: SUM(subtotal) − coalesce(uang_diterima,0); belum ada cara: SUM(subtotal)); status `selesai`.
- Semua: isi `selesai_oleh/selesai_at` saat menjadi `selesai`.

- [ ] **Step 1: Tulis `t3_penyelesaian.sql`** (fixture: buat dokumen sampai `diserahkan` memakai RPC Task 2). Kasus:
  - T3a potong_tagihan → `selesai`, 1 baris `vendor_kredit` +subtotal, `aktif`, `vendor_induk` = induk dokumen.
  - T3b uang_kembali dijanjikan, purchasing konfirmasi → `insufficient_privilege`; admin_finance konfirmasi jumlah lebih kecil → `selesai`, `nilai_tidak_dikompensasi` = selisih, saldo rekening naik tepat `p_jumlah`, tidak ada `vendor_kredit` baru.
  - T3c ganti_barang dua tahap (setengah, lalu sisa) → setelah tahap 1 masih `diserahkan`, setelah tahap 2 `selesai`; ledger gudang naik total = qty retur skala ledger; tidak ada baris `bahan_baku_harga_history`/`bahan_baku_supplier` berubah (bandingkan `updated_at`/count sebelum-sesudah).
  - T3d terima pengganti melebihi qty → ditolak.
  - T3e tutup sisa tanpa alasan → ditolak; ganti barang setengah lalu tutup sisa → `selesai`, `nilai_tidak_dikompensasi` = setengah subtotal, nol `vendor_kredit`.
  - T3f catat penyelesaian kedua kali → ditolak.
- [ ] **Step 2: Jalankan sebelum migration** → gagal.
- [ ] **Step 3: Tulis migration.**
- [ ] **Step 4: OK owner → apply → stempel → t3 lulus** + kontrol negatif (salah satu asersi dibalik → `RAISE`).
- [ ] **Step 5: Commit** `feat(db): penyelesaian retur vendor`

### Task 4: Bayar PO dengan kredit vendor

**Files:**
- Create: `supabase/migrations/20261118113000_bayar_po_pakai_kredit.sql`
- Test: `supabase/verifikasi/retur_vendor/t4_bayar_kredit.sql`

**Interfaces:**
- Consumes: `vendor_kredit` (Task 1), kredit `+` dari Task 3.
- Produces:
  - `saldo_kredit_vendor(p_supplier_id uuid) returns numeric` — SUM `vendor_kredit.jumlah` untuk `vendor_induk(p_supplier_id)`; role `ajukan` atau `putus`.
  - `ajukan_bayar_po(p_po_id uuid, p_catatan text default null, p_pakai_kredit numeric default 0)` — **tambah parameter**, signature lama tetap jalan (default 0). Bila `p_pakai_kredit > 0`: kunci `pg_advisory_xact_lock(hashtext('kredit:'||vendor_induk))`, tolak bila > saldo kredit atau > total; sisipkan `vendor_kredit` `−p_pakai_kredit` status `dicadangkan` dengan `purchase_order_id`. Transaksi kas `pending_approval` dibuat sebesar `total − kredit` hanya bila > 0. Bila kredit = total: tidak ada transaksi kas; PO `payment_status='pending'` tetap di-set (pegangan persetujuan = baris kredit `dicadangkan` + `payment_status='pending'`).
  - `setujui_bayar_po(...)` — signature tetap. Ubah: baris `vendor_kredit` `dicadangkan` milik PO → `aktif`. Kalau tidak ada transaksi kas (kredit penuh): bukti tetap wajib (bukti = dokumen kesepakatan), PO jadi `paid`, `paid_amount = total`, `paid_at = now()` — tulis kolom bayar di dalam RPC (penjaga `trg_po_jaga_kolom_bayar` sudah mengizinkan jalur RPC; ikuti mekanismenya di definisi live).
  - `tolak_bayar_po(...)` — hapus baris `vendor_kredit` `dicadangkan` milik PO.
  - `po_payable_spv` + kolom `dibayar_kredit numeric` (SUM `−jumlah` baris `aktif`/`dicadangkan` untuk PO itu). Pertahankan `security_invoker`/gate peran view seperti definisi live (`20260922200000`).

- [ ] **Step 1: Tulis `t4_bayar_kredit.sql`**. Kasus:
  - T4a kredit 0: `ajukan_bayar_po(po)` perilaku lama (transaksi kas = total).
  - T4b kredit sebagian: transaksi kas = total − kredit; `saldo_kredit_vendor` turun; setujui → kredit `aktif`, PO `paid`.
  - T4c tolak setelah cadang → baris `dicadangkan` hilang, saldo kredit kembali utuh.
  - T4d dua PO vendor sama, masing-masing pakai kredit = saldo → yang kedua ditolak.
  - T4e kredit penuh → nol transaksi kas baru, `payment_status='pending'`; setujui dengan bukti → `paid`, `paid_amount = total`; saldo Rekening Bahan Baku tidak berubah.
  - T4f kredit vendor Pak Aziz Tempo 15 dipakai di PO Tempo 30 → diterima (fixture: dua supplier ber-`vendor_induk` sama).
  - T4g `p_pakai_kredit` > total → ditolak.
- [ ] **Step 2: Jalankan sebelum migration** → gagal.
- [ ] **Step 3: Tulis migration** (mulai dari `pg_get_functiondef` live ketiga fungsi + `pg_get_viewdef`).
- [ ] **Step 4: OK owner → apply → stempel → t4 lulus**; jalankan juga ulang uji bayar vendor yang ada bila tersedia di `supabase/verifikasi/` (cari `ajukan_bayar_po`).
- [ ] **Step 5: Commit** `feat(db): bayar PO memakai kredit vendor`

### Task 5: Terima PO — qty ditolak tidak ditagih

**Files:**
- Create: `supabase/migrations/20261118114000_terima_po_qty_ditolak.sql`
- Test: `supabase/verifikasi/retur_vendor/t5_terima_tolak.sql`

**Interfaces — Produces:** `verifikasi_terima_po(p_po_id uuid, p_items jsonb)` signature tetap. Tiap item boleh membawa `qty_ditolak` (≥ 0, delta kedatangan ini) dan `alasan_tolak` (wajib bila `qty_ditolak > 0`). `v_incoming` = barang baik yang masuk stok = datang − ditolak; `qty_terima` += barang baik; `qty_ditolak` += ditolak. Status `diterima_lengkap` bila semua baris `qty_terima + qty_ditolak >= qty_pesan`. Payload lama tanpa `qty_ditolak` berperilaku persis seperti sekarang (termasuk `kondisi='rusak'` lama: ledger tidak ditulis — biarkan).

- [ ] **Step 1: Tulis `t5_terima_tolak.sql`** dengan PO fixture `dikirim_ke_supplier` dibuat di transaksi. Kasus:
  - T5a datang 10, ditolak 3 (`kualitas_tidak_sesuai`) dari pesan 10 → `qty_terima=7`, `qty_ditolak=3`, ledger +7 (skala ledger), subtotal = 7 × harga, status `diterima_lengkap`.
  - T5b pesan 10: datang 6 tolak 1, lalu datang 4 tolak 0 → `qty_terima=9`, `qty_ditolak=1`, `diterima_lengkap`.
  - T5c `qty_ditolak > 0` tanpa alasan → ditolak.
  - T5d payload lama (`qty_terima` total, tanpa `qty_ditolak`) → hasil identik dengan perilaku sebelumnya.
  - T5e PO bernomor `TEST/...` tetap tidak menulis harga master (pengaman uji coba bertahan).
- [ ] **Step 2: Jalankan sebelum migration** → T5a gagal.
- [ ] **Step 3: Tulis migration** dari `pg_get_functiondef` live; diff terhadap definisi live harus hanya menyentuh perhitungan incoming/qty_ditolak/status.
- [ ] **Step 4: OK owner → apply → stempel → t5 lulus.**
- [ ] **Step 5: Commit** `fix(db): barang ditolak saat terima PO tidak ditagih`

### Task 6: Aturan murni di app finance

**Files:**
- Create: `apps/finance/src/lib/returVendor/aturan.ts`, `apps/finance/src/lib/returVendor/aturan.test.ts`

**Interfaces — Produces:**
- `export const ALASAN_RETUR = ['rusak','kualitas_tidak_sesuai','salah_kirim','kadaluarsa','lainnya'] as const; export type AlasanRetur = typeof ALASAN_RETUR[number]`
- `export const LABEL_ALASAN: Record<AlasanRetur,string>` — `Rusak / cacat`, `Kualitas tidak sesuai`, `Salah kirim`, `Kadaluarsa`, `Lainnya`.
- `export type StatusRetur = 'diajukan'|'disetujui'|'ditolak'|'dibatalkan'|'diserahkan'|'selesai'`; `LABEL_STATUS` — `Menunggu persetujuan`, `Disetujui`, `Ditolak`, `Dibatalkan`, `Menunggu penyelesaian vendor`, `Selesai`.
- `export type CaraPenyelesaian = 'ganti_barang'|'potong_tagihan'|'uang_kembali'`; `LABEL_CARA` — `Ganti barang`, `Potong tagihan`, `Uang kembali`.
- `export function sisaBisaDiretur(qtyTerima: number, qtyReturAktif: number): number` — `max(0, qtyTerima − qtyReturAktif)`.
- `export function totalRetur(items: {qty:number;harga:number}[]): number`
- `export function aksiTersedia(status: StatusRetur, cara: CaraPenyelesaian|null, peran: string, adalahPengaju: boolean): Array<'setujui'|'tolak'|'batal'|'serahkan'|'catat_penyelesaian'|'konfirmasi_uang'|'terima_pengganti'|'tutup_sisa'>` — cermin aturan role di Global Constraints; UI hanya menampilkan, DB tetap penentu.

- [ ] **Step 1: Tes** (Vitest): `sisaBisaDiretur(10, 4) === 6`, `sisaBisaDiretur(3, 5) === 0`; `totalRetur([{qty:2,harga:51000},{qty:0.5,harga:20000}]) === 112000`; `aksiTersedia('diajukan', null, 'admin_finance', true)` tidak memuat `setujui`/`tolak` tapi memuat `batal`; `aksiTersedia('diajukan', null, 'admin_finance', false)` memuat `setujui`,`tolak`; `aksiTersedia('diserahkan','uang_kembali','purchasing',false)` memuat `tutup_sisa`, tidak memuat `konfirmasi_uang`; `aksiTersedia('diserahkan','ganti_barang','purchasing',false)` memuat `terima_pengganti`; `aksiTersedia('selesai','potong_tagihan','admin',false)` = `[]`; `aksiTersedia('diserahkan', null, 'purchasing', false)` memuat `catat_penyelesaian` dan `tutup_sisa`.
- [ ] **Step 2:** `cd apps/finance && yarn vitest run src/lib/returVendor` → FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4:** jalankan lagi → PASS.
- [ ] **Step 5: Commit** `feat(finance): aturan retur vendor`

### Task 7: Halaman Retur Vendor + Hub Approval

**Files:**
- Create: `apps/finance/src/hooks/useReturVendor.ts`, `apps/finance/src/app/pembelian/retur-vendor/{page.tsx,ReturVendorView.tsx}`, `.../baru/{page.tsx,FormAjukanRetur.tsx}`, `.../[id]/{page.tsx,DetailReturVendor.tsx}`
- Modify: `apps/finance/src/components/CashLayout.tsx` (menu "Retur Vendor" `href: '/pembelian/retur-vendor'` di grup PURCHASING & PO dan di grup nav purchasing), `apps/finance/src/lib/approval/hub.ts` (+`hub.test.ts`), `apps/finance/src/hooks/useHubApproval.ts`, `apps/finance/src/app/approval/BarisHub.tsx`
- Test: `apps/finance/src/lib/approval/hub.test.ts`, `apps/finance/src/app/approval/BarisHub.test.tsx`

**Interfaces:**
- Consumes: RPC Task 2–3, `aturan.ts` (Task 6).
- Produces (`useReturVendor.ts`): `useDaftarReturVendor(filter: {status?: StatusRetur[]; supplierId?: string})`, `useDetailReturVendor(id)`, `useItemPoBisaDiretur(supplierId)` (item PO vendor induk itu berstatus diterima, dengan `qty_terima`, sisa bisa diretur, tanggal terima, saldo gudang — saldo dari `saldo_vendor_gudang` untuk multi-vendor), dan `useMutasiReturVendor()` yang membungkus keenam RPC; semua invalidate `['retur-vendor']`.
- Hub: `HubItem` jenis baru `{ jenis: 'retur_vendor'; data: ReturVendorMenunggu }`, nominal = total retur, judul `nomor · supplier`, aksi setujui/tolak memanggil `putuskan_retur_vendor`; hitungan badge ikut.
- Hub bayar vendor: PO yang dibayar penuh dengan kredit tidak punya `cash_transaction` `pending_approval`. Kalau sumber `bayar_vendor` di `useHubApproval.ts` menyaring lewat transaksi kas, tambahkan PO `payment_status='pending'` tanpa transaksi kas supaya tetap muncul. Uji di `hub.test.ts`.

Unggah bukti memakai `unggahDenganSesi` dari `@suka/auth` (pola `useSupplierSettlement`) ke bucket yang sudah dipakai bukti bayar vendor, folder `retur-vendor/`.

- [ ] **Step 1: Tes hub** — `hub.test.ts`: item `retur_vendor` dipetakan dengan `key = 'retur_vendor:<id>'`, nominal = total, dan ikut dihitung di ringkasan per jenis; `BarisHub.test.tsx`: tombol Tolak meminta alasan sebelum memanggil mutasi.
- [ ] **Step 2: Jalankan** `yarn vitest run src/lib/approval src/app/approval` → FAIL.
- [ ] **Step 3: Implementasi hook, hub, dan tiga halaman.** Daftar: tab `Menunggu persetujuan | Menunggu penyelesaian vendor | Selesai | Semua`, urut tertua dulu untuk dua tab pertama. Form: pilih supplier → tabel item PO (bahan, nomor PO, tgl terima, diterima, sisa bisa diretur, qty input dibatasi sisa, alasan) + alasan utama, catatan, bukti. Detail: ringkasan, item, riwayat waktu, tombol dari `aksiTersedia`; tolak/batal/tutup sisa minta alasan; konfirmasi uang memilih rekening pusat (default Rekening Bahan Baku Bank) + jumlah + bukti.
- [ ] **Step 4:** tes lulus; `yarn type-check` di `apps/finance` 0 error; `next build --webpack` sukses.
- [ ] **Step 5: Uji browser** (dev server finance, akun purchasing & admin_finance sungguhan di DB setelah Task 2–3 live): ajukan → muncul di Hub → setujui → serahkan → potong tagihan → selesai. Gunakan PO outlet/gudang nyata **dalam dokumen yang kemudian dibatalkan** sebelum serah, atau koordinasikan dengan owner sebelum menyerahkan sungguhan (serah = stok produksi berkurang).
- [ ] **Step 6: Commit** `feat(finance): halaman retur vendor & approval`

### Task 8: Pembayaran Vendor pakai kredit + form terima PO

**Files:**
- Modify: `apps/finance/src/hooks/useSupplierSettlement.ts`, `apps/finance/src/app/supplier/components/SupplierView.tsx`, `apps/finance/src/app/pembelian/[id]/components/VerifikasiTerimaModal.tsx`, `apps/finance/src/hooks/usePurchaseOrder.ts`, `apps/finance/src/app/pembelian/[id]/PODetailView.tsx`
- Create: `apps/finance/src/lib/returVendor/terimaPo.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: Task 4 (`saldo_kredit_vendor`, `ajukan_bayar_po(..., p_pakai_kredit)`, kolom `dibayar_kredit`), Task 5 payload, `ALASAN_RETUR`.
- Produces: `export function barangMasukStok(datang: number, ditolak: number): number` (= `max(0, datang − ditolak)`) dan `export function validasiBarisTerima(b: {datang:number; ditolak:number; alasanTolak: AlasanRetur|null}): string|null` — pesan galat Bahasa Indonesia: ditolak > datang → `'Jumlah ditolak melebihi jumlah datang'`; ditolak > 0 tanpa alasan → `'Pilih alasan penolakan'`.

- [ ] **Step 1: Tes** `terimaPo.test.ts`: `barangMasukStok(10,3) === 7`, `barangMasukStok(2,5) === 0`, dua pesan validasi di atas, baris valid → `null`.
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3: Implementasi.** Modal terima: kolom "Datang", "Ditolak", "Alasan" (muncul bila ditolak > 0), baris info "Masuk stok: N · Ditagih: N × harga"; kirim `qty_datang` = datang − ditolak dan `qty_ditolak`, `alasan_tolak`; dropdown kondisi baik/rusak dihapus. Pembayaran Vendor: tampilkan saldo kredit vendor per baris PO bila > 0; saat ajukan, input "Pakai kredit" (default min(saldo, total)), ringkasan "Dibayar kas: X · Dibayar kredit: Y". Detail PO: kolom ditolak + alasan, daftar retur terkait (link ke detail retur), dan baris "Dibayar kredit".
- [ ] **Step 4:** tes lulus, type-check 0, build sukses; uji browser: ajukan bayar PO dengan kredit sebagian (setelah Task 3–4 live, gunakan kredit dari uji yang disetujui owner atau lewati dan catat).
- [ ] **Step 5: Commit** `feat(finance): pakai kredit vendor & tolak barang saat terima PO`

### Task 9: Ringkasan kualitas vendor + pemantau

**Files:**
- Create: `supabase/migrations/20261118115000_retur_vendor_ringkasan.sql`, `supabase/verifikasi/retur_vendor/t6_ringkasan.sql`, `supabase/verifikasi/retur_vendor/pemantau.sql`
- Modify: `apps/finance/src/app/pembelian/retur-vendor/ReturVendorView.tsx` (tab "Kualitas Vendor"), `apps/finance/src/hooks/useReturVendor.ts`

**Interfaces — Produces:** `ringkasan_kualitas_vendor(p_dari date, p_sampai date) returns table(vendor_induk uuid, vendor_nama text, alasan text, jumlah_retur int, nilai_retur numeric, nilai_tidak_dikompensasi numeric, jumlah_baris_tolak int, nilai_tolak numeric)` — SECURITY INVOKER-aman atau DEFINER dengan cek `retur_vendor_peran_ok('ajukan') OR retur_vendor_peran_ok('putus')`; retur dihitung per `diajukan_at` WIB, status selain `ditolak|dibatalkan`; tolak dari `purchase_order_item.qty_ditolak > 0` per `purchase_order.tanggal_po`, nilai = `qty_ditolak × coalesce(harga_terima, harga_pesan)`.

`pemantau.sql` (satu kueri per giliran): Q1 retur `diserahkan` > 14 hari; Q2 ledger `retur_ke_vendor` tanpa dokumen `diserahkan|selesai` (harus 0); Q3 saldo kredit per vendor induk (tak boleh negatif); Q4 baris `vendor_kredit` `dicadangkan` > 7 hari (pengajuan bayar menggantung).

- [ ] **Step 1: Tulis `t6_ringkasan.sql`** — buat 1 retur `selesai` + 1 PO dengan tolak dalam transaksi, cek angka; crew → ditolak.
- [ ] **Step 2:** jalankan → gagal. **Step 3:** migration. **Step 4:** OK owner → apply → stempel → lulus; jalankan `pemantau.sql` Q2/Q3 = 0 baris.
- [ ] **Step 5:** tab UI (tabel per vendor, filter periode 30 hari default), type-check + build.
- [ ] **Step 6: Commit** `feat: ringkasan kualitas vendor & pemantau retur`

### Task 10: Dokumentasi & penutup

**Files:** Modify `CLAUDE.md` (entri Session 2026-11-18 ringkas: tabel, RPC, keputusan owner, gotcha `ledger_stamp_saldo` mengecualikan `retur_ke_vendor`, kitchen belum punya layar), `docs/superpowers/specs/2026-11-18-retur-vendor-gudang-design.md` (status → disetujui & dibangun).

- [ ] **Step 1:** tulis entri; **Step 2:** jalankan seluruh uji `supabase/verifikasi/retur_vendor/t1…t6` sekali lagi terhadap DB live (ROLLBACK) dan `yarn test` finance; **Step 3:** commit `docs: retur vendor`.
