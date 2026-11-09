# Ganti Satuan Bahan Baku Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tombol "Ganti Satuan" di Master Bahan Baku yang mengganti satuan bahan ber-riwayat stok
(termasuk satuan terkecil) dan mengonversi saldo, riwayat, opname, resep, katalog vendor, harga, dan
dokumen lama dalam satu transaksi, nilai rupiah tetap.

**Architecture:** Tiga fungsi Postgres: `_rencana_ganti_satuan` (faktor + penghalang, satu sumber
rumus), `pratinjau_ganti_satuan` (read-only) dan `ganti_satuan_bahan` (eksekusi, satu transaksi,
`SET LOCAL app.ganti_satuan='on'`). Trigger efek samping di `stok_balance`/`stok_waste_reports`/
`terima_vendor_outlet` diberi `WHEN` agar diam saat bendera menyala. Admin-dashboard: modal di
`SeksiSatuan` + seksi Vendor di `PanelBahan`. App stok: buang isian draft lokal yang basi.

**Tech Stack:** Supabase Postgres (plpgsql), Next.js App Router + React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-ganti-satuan-bahan-baku-design.md`

## Global Constraints

- Hak akses: `PERFORM public._peran_master('data')` (admin, owner, developer). Fungsi
  `SECURITY DEFINER SET search_path = public`, `REVOKE ALL … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated`.
- Jembatan = satuan kecil BARU per 1 satuan kecil LAMA, > 0, finite. `k_kecil = jembatan`;
  `k_besar = faktor_tampilan_lama × jembatan ÷ faktor_tampilan_baru`.
- Lama dan baru WAJIB sama-sama punya satuan kecil (`faktor_tampilan` NOT NULL di kedua sisi), selain itu tolak.
- Alasan wajib (trim ≠ '').
- Skala baris ledger: `transisi(outlet,bahan)` = `min(created_at)` baris `opname_selisih` dengan
  `created_at >= '2026-08-01 20:32:00+07'`. Baris sebelum transisi = besar (`k_besar`), sesudah = kecil
  (`k_kecil`), baris transisi itu sendiri: `saldo_sebelum×k_besar`, `saldo_sesudah×k_kecil`,
  `qty = saldo_sesudah_baru − saldo_sebelum_baru`. Tanpa transisi → semua besar.
- Format galat: `RAISE EXCEPTION … USING ERRCODE` `'42501'` (akses), `'22023'` (masukan), `'P0001'` (penghalang).
- Migration: timestamp `20261109HHMMSS`, cek `ls supabase/migrations | cut -c1-14 | sort | uniq -d`
  kosong dan versi belum ada di `supabase_migrations.schema_migrations`. Terapkan via konektor
  Supabase `apply_migration`, lalu **rename berkas ke versi yang distempel** dan verifikasi stempel dengan SELECT.
- Semua uji SQL dalam `BEGIN … ROLLBACK`, dengan kontrol negatif yang benar-benar gagal saat dijalankan sebelum implementasi.
- Bahan uji nyata: BAWANG PUTIH BUBUK `516dd4a9-65df-4e58-adf6-d0e1f15ad9b5` (Dus/Bungkus 6/Sachet,
  `faktor_tampilan` 432, harga 400.000). Target: Kg/gram 1000, PO `Kg`, distribusi `Kg`, jembatan 6.
  Harapan: `k_besar` = 2,592; Sawangan (Internal) 144 → 864; BNR 0,16666… → 0,432; harga master ≈ 154.320,99.

## Review Focus

1. **Trigger efek samping** — UPDATE `stok_balance` saat konversi tak boleh mengirim notifikasi stok/bot, dan UPDATE waste/terima-vendor tak boleh menulis baris ledger baru. Diuji di Task 3 (`jumlah ledger sebelum = sesudah`, tabel antrean bot tak bertambah).
2. **Saldo minus / desimal** — saldo negatif dan pecahan (BNR 0,1666…) dikalikan apa adanya, tanpa pembulatan dan tanpa penolakan. Task 3 fixture memuat saldo −5.
3. **Ganti satuan dua kali** pada bahan yang sama — konversi kedua memakai skala per-baris yang sama; Task 3 menjalankan dua kali (jembatan 6 lalu 1/6) dan saldo kembali ke semula ±1e-9.
4. **Bahan dipakai substitusi waterfall** dengan satuan kecil berganti → ditolak (Task 2 penghalang `substitusi`).
5. **Draft opname lokal tanpa `savedAt`** (dibuat sebelum deploy) → isian bahan yang pernah diganti satuannya tetap dibuang (Task 6 test).

---

### Task 1: Skema — kolom, tabel log, penjaga trigger

**Files:**
- Create: `supabase/migrations/20261109120000_ganti_satuan_skema.sql`
- Test: `supabase/verifikasi/ganti_satuan/t1_skema.sql`

**Interfaces:**
- Produces: kolom `bahan_baku.satuan_diganti_at timestamptz NULL`; tabel
  `public.bahan_baku_ganti_satuan(id uuid pk default gen_random_uuid(), bahan_baku_id uuid not null references bahan_baku(id), satuan_lama jsonb not null, satuan_baru jsonb not null, jembatan numeric not null, k_kecil numeric not null, k_besar numeric not null, jumlah_baris jsonb not null, alasan text not null, dibuat_oleh uuid, created_at timestamptz not null default now())`.
  RLS on; SELECT `TO authenticated USING (public.is_owner_or_admin())`; `REVOKE ALL FROM anon, authenticated` lalu `GRANT SELECT TO authenticated`.
- Produces: trigger berikut berperilaku sama, kecuali diam bila `current_setting('app.ganti_satuan', true) = 'on'`:
  `stok_balance`: `on_stok_balance_update_send_push`, `trg_bot_manager_stok_drop50`, `trg_bot_manager_stok_kritis`,
  `trg_bot_telegram_penurunan_stok_tidak_wajar`, `trg_bot_telegram_stok_kritis`;
  `stok_waste_reports`: `trg_sync_waste_ledger`, `trg_validate_stok_waste_report_input`, `trg_waste_report_approval`,
  `trg_stok_push_waste_pending_approval`; `terima_vendor_outlet`: `trg_sync_terima_vendor_ledger`.

- [ ] **Step 1: Tulis uji `t1_skema.sql`** — asersi `DO` block: kolom & tabel ada; untuk tiap trigger di atas
  `pg_get_triggerdef(oid)` memuat `app.ganti_satuan`; crew (simulasi `request.jwt.claims` + `SET LOCAL ROLE authenticated`)
  tidak bisa SELECT `bahan_baku_ganti_satuan`; perilaku: dengan bendera menyala, `UPDATE stok_waste_reports SET qty = qty*2`
  pada satu laporan APPROVED tidak menambah baris `ledger_stok` (`count` sebelum = sesudah); tanpa bendera, sama
  UPDATE menambah ≥1 baris (kontrol).
- [ ] **Step 2: Jalankan t1 sebelum migration** → gagal pada asersi kolom.
- [ ] **Step 3: Tulis migration.** `SET lock_timeout = '5s'`. Penjaga trigger dibuat ulang dari definisinya sendiri,
  tanpa mengetik ulang event/fungsinya:

```sql
DO $$
DECLARE r record; v_def text;
BEGIN
  FOR r IN SELECT t.oid, t.tgname, c.relname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
           WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal
             AND (c.relname, t.tgname) IN (('stok_balance','on_stok_balance_update_send_push'), /* … daftar di atas … */)
  LOOP
    v_def := pg_get_triggerdef(r.oid);
    IF v_def ~ 'app\.ganti_satuan' THEN CONTINUE; END IF;
    IF v_def ~ ' WHEN \(' THEN
      v_def := regexp_replace(v_def, ' WHEN \((.*)\) EXECUTE ', ' WHEN ((\1) AND COALESCE(current_setting(''app.ganti_satuan'', true), '''') <> ''on'') EXECUTE ');
    ELSE
      v_def := replace(v_def, ' EXECUTE ', ' WHEN (COALESCE(current_setting(''app.ganti_satuan'', true), '''') <> ''on'') EXECUTE ');
    END IF;
    EXECUTE format('DROP TRIGGER %I ON public.%I', r.tgname, r.relname);
    EXECUTE v_def;
  END LOOP;
END $$;
```
  Asersi di akhir migration: kesepuluh trigger ada dan memuat `app.ganti_satuan` (`RAISE` bila tidak).
- [ ] **Step 4: Terapkan, rename berkas ke versi stempel, jalankan t1** → LULUS.
- [ ] **Step 5: Commit** `feat(db): skema ganti satuan + penjaga trigger efek samping`.

### Task 2: Rencana & pratinjau (read-only)

**Files:**
- Create: `supabase/migrations/20261109121000_ganti_satuan_pratinjau.sql`
- Test: `supabase/verifikasi/ganti_satuan/t2_pratinjau.sql`

**Interfaces:**
- Produces `public._rencana_ganti_satuan(p_bahan uuid, p_baru jsonb, p_jembatan numeric) RETURNS jsonb` (REVOKE semua role; dipakai Task 3):
  `{faktor_tampilan_lama, faktor_tampilan_baru, k_kecil, k_besar, satuan_lama:{satuan,satuan_tengah,faktor_tengah,satuan_kecil,faktor_tampilan,satuan_po,satuan_distribusi}, satuan_baru:{…sama…}, penghalang:[{jenis, id, nomor, outlet}]}`.
  Kunci `p_baru` = `satuan, satuan_tengah, faktor_tengah, satuan_kecil, isi_kecil_per_tengah, satuan_po, satuan_distribusi`
  (kunci lain → `22023`). Turunan `faktor_tampilan_baru` sama dengan `simpan_bahan_baku`: tanpa tengah → `isi`, dengan tengah → `faktor_tengah × isi`.
  Validasi `22023`: jembatan ≤ 0/NaN; satuan kecil lama atau baru kosong; satuan besar baru kosong; isian tak lengkap.
  Validasi label PO/distribusi diserahkan ke trigger `bahan_baku_tegakkan_faktor` saat eksekusi (Task 3), tapi
  pratinjau mengembalikan `peringatan_label` bila label bukan tingkat baru (kanon `public._kanon_satuan`), pengecualian `kg` distribusi untuk kecil `gram`.
- Penghalang (`jenis`): `opname_draft` (opname status `draft`/`pending_approval` yang punya `opname_item` bahan ini),
  `surat_jalan` (status `draft`,`dikirim`), `purchase_order` (status NOT IN `diterima_lengkap`,`dibatalkan`,`ditolak`),
  `permintaan` (status NOT IN `disetujui`,`ditolak`,`dibatalkan`), `terima_vendor` (status `dicatat`),
  `waste` (status `PENDING`), `mutasi` (status NOT IN `selesai`,`ditolak`), `retur` (status NOT IN `selesai`,`ditolak`,`dibatalkan`),
  `substitusi` (bahan ada di `bahan_baku_substitusi` sebagai utama/pengganti DAN `k_kecil <> 1`).
  `nomor` = nomor dokumen bila tabel punya kolom nomor (verifikasi nama kolom), else `id::text`.
- Produces `public.pratinjau_ganti_satuan(p_bahan uuid, p_baru jsonb, p_jembatan numeric) RETURNS jsonb` (`_peran_master('data')`):
  hasil `_rencana…` ditambah `saldo:[{outlet_id, outlet, skala:'besar'|'kecil', saldo_lama, saldo_baru}]` (urut saldo_lama desc,
  skala dari `saldo_is_gram(sb)`), `jumlah:{ledger, opname_item, resep_item, katalog, sj_item, po_item, permintaan_item, waste, terima_vendor, retur_item, mutasi_item, svgm, opname_item_vendor, inbound_outbound, purchase_request, sku}`,
  `harga_master_lama`, `harga_master_baru` (= lama ÷ k_besar).

- [ ] **Step 1: Tulis t2** — sebagai admin (klaim JWT admin aktif): pratinjau BAWANG (jembatan 6, Kg/gram 1000) →
  `k_besar` = 2.592 (±1e-9), `penghalang` berisi ≥1 `opname_draft` selama 4 draft masih ada (ambil hitungan aktual di awal uji, bandingkan),
  baris Sawangan (Internal) `saldo_baru` = `saldo_lama × 6`, BNR `skala='besar'` dan `saldo_baru = saldo_lama × 2.592`,
  `harga_master_baru` ≈ 154320.99. Jembatan 0 → `22023`. Satuan kecil baru kosong → `22023`. Crew → `42501`.
  Fixture (dibuat di transaksi): bahan baru + `bahan_baku_substitusi` → penghalang `substitusi` muncul untuk jembatan 6, tidak untuk jembatan 1.
- [ ] **Step 2: Jalankan t2** → gagal (fungsi belum ada).
- [ ] **Step 3: Tulis migration** — fungsi read-only; `pratinjau` tidak menulis apa pun (uji di t2: `count(*)` ledger & `bahan_baku.updated` tidak berubah).
- [ ] **Step 4: Terapkan, rename, stempel, jalankan t2** → LULUS.
- [ ] **Step 5: Commit** `feat(db): pratinjau ganti satuan bahan`.

### Task 3: Eksekusi `ganti_satuan_bahan`

**Files:**
- Create: `supabase/migrations/20261109122000_ganti_satuan_eksekusi.sql`
- Test: `supabase/verifikasi/ganti_satuan/t3_eksekusi.sql`

**Interfaces:**
- Consumes: `_rencana_ganti_satuan` (Task 2), tabel log & penjaga trigger (Task 1).
- Produces `public.ganti_satuan_bahan(p_bahan uuid, p_baru jsonb, p_jembatan numeric, p_alasan text) RETURNS uuid` (id log).

Urutan di dalam fungsi (satu transaksi):
1. `_peran_master('data')`; alasan wajib; `SELECT … FROM bahan_baku WHERE id = p_bahan FOR UPDATE`;
   `SET LOCAL lock_timeout = '5s'`, `SET LOCAL statement_timeout = '60s'`; tolak bila `count(ledger_stok)` bahan > 200000 (`22023`, pesan jelas).
2. `v_r := _rencana_ganti_satuan(…)`; bila `penghalang` tak kosong → `P0001` dengan daftar `jenis nomor (outlet)` di pesan.
3. Rekam skala sebelum menulis apa pun: tabel sementara `ON COMMIT DROP` berisi `transisi_at` per outlet dan `is_gram` per baris `stok_balance`.
4. Rekam metrik rantai sebelum: jumlah outlet dengan `saldo_sesudah` terakhir ≠ `stok_balance.saldo` (toleransi 1e-6) dan jumlah putus rantai `saldo_sebelum(n) ≠ saldo_sesudah(n-1)` (urut `created_at, id`).
5. `PERFORM set_config('app.ganti_satuan','on', true)`; `set_config('app.alasan', 'Ganti satuan: <lama> → <baru> (1 <kecil lama> = <jembatan> <kecil baru>). ' || p_alasan, true)`.
6. `UPDATE bahan_baku` set satuan/tengah/faktor_tengah/kecil/faktor_tampilan/satuan_po/satuan_distribusi dari `satuan_baru`,
   `default_reorder_point *= k_besar`, `stok_ideal *= k_besar`, `satuan_diganti_at = now()`.
7. Konversi sesuai tabel berikut (faktor per kolom):

| Tabel | Kolom | Faktor |
|---|---|---|
| `stok_balance` | `saldo` | `k_kecil` bila `is_gram` (langkah 3) else `k_besar` |
| `ledger_stok` | `qty`,`saldo_sebelum`,`saldo_sesudah` | aturan skala baris (Global Constraints) |
| `opname_item` | `qty_system`,`qty_fisik` | opname dengan baris ledger `opname_selisih` ber-`ref_opname_id`: `qty_system` ikut skala `saldo_sebelum` baris itu, `qty_fisik` ikut skala `saldo_sesudah`; tanpa baris itu: skala menurut `opname.created_at` vs `transisi_at` outletnya |
| `stok_vendor_gudang_mutasi` | `qty` | aturan skala baris memakai `transisi_at` Gudang Pusat (`public.gudang_pusat_id()`) |
| `inbound_outbound` | `qty` ×, `harga_satuan` ÷ | aturan skala baris (outlet baris itu) |
| `opname_item_vendor` | `qty_besar` | `k_besar` |
| `resep_item` | `qty_per_porsi` ×; `satuan` := satuan kecil baru | `k_kecil` |
| `outlet_reorder_point` | `reorder_point`,`stok_ideal` | `k_besar` |
| `surat_jalan_item` | `qty_dikirim`,`qty_terima` ×; `harga_snapshot` ÷ | `k_besar` |
| `purchase_order_item` | `qty_pesan`,`qty_terima` ×; `harga_pesan`,`harga_terima` ÷ | `k_besar` |
| `permintaan_bahan_item` | `qty_diminta`,`qty_disetujui` ×; `harga_snapshot` ÷ | `k_besar` |
| `stok_waste_reports` | `qty` | `k_besar` |
| `terima_vendor_outlet` | `qty` ×; `harga_snapshot` ÷ | `k_besar` |
| `retur_stok_item` | `qty_klaim`,`qty_diterima_kitchen` | `k_besar` |
| `mutasi_antar_outlet_item` | `qty_diajukan`,`qty_dikirim`,`qty_diterima` | `k_besar` |
| `purchase_request` | `qty` × isi-kecil-lama-per-label × `k_kecil`; `satuan` := satuan kecil baru | label dicocokkan via `_kanon_satuan` ke besar/tengah/kecil lama; label tak cocok → biarkan, catat di `jumlah_baris.purchase_request_dilewati` |
| `bahan_baku_supplier` | `isi_satuan_kecil` | `k_kecil` (`harga`, `satuan_beli` tetap) |
| `bahan_baku_sku` | `qty_isi` | `k_kecil` — **sebelum menulis**, baca `simpan_sku` dan konfirmasi `qty_isi` berskala satuan kecil; bila tidak, ganti faktor dan catat di commit |
| `bahan_baku_harga` | `harga_beli` | `÷ k_besar`, ditulis **setelah** `bahan_baku` (langkah 6) dan **sebelum** `bahan_baku_supplier` |

   Kolom NULL tetap NULL. Kolom generated (`selisih`, `subtotal`, `harga_per_satuan_kecil`) tidak ditulis.
8. Asersi relatif: metrik langkah 4 dihitung ulang; bila salah satunya bertambah → `RAISE` (seluruh transaksi batal).
   Asersi: `count(ledger_stok)` bahan sama sebelum/sesudah.
9. `INSERT bahan_baku_ganti_satuan` (jumlah baris per tabel dari `GET DIAGNOSTICS`), kembalikan id.

- [ ] **Step 1: Tulis t3** (semua dalam `BEGIN … ROLLBACK`, peran admin):
  - Fixture bahan `Uji Kotak` Dus/Bks 6/Pcs (faktor 432) di 2 outlet uji: outlet A: `adjustment` +2 (skala besar, `created_at` sebelum cutoff), lalu `opname_selisih` sesudah cutoff dengan `saldo_sebelum` 2 → `saldo_sesudah` 800 (baris transisi), lalu `adjustment` −805 (kecil) sehingga saldo −5 (Review Focus 2); outlet B hanya baris besar 0,5 Dus. Satu SJ selesai 1 Dus harga 400000, satu waste APPROVED qty 1, satu resep_item 12 pcs, katalog vendor isi 432.
  - Ganti ke Kg/gram 1000, jembatan 6 → asersi: saldo A ×6, B ×2.592; baris ledger besar ×2.592, kecil ×6; baris transisi `saldo_sebelum×2.592`, `saldo_sesudah×6`; SJ qty 2.592 & harga 154320.99 (qty×harga sama ±0.01); waste 2.592; resep 72 `gram`; katalog isi 2592; harga master ÷2.592; `count(ledger)` tetap; tak ada baris baru di `bot_telegram_stock_drop_alert_state` (count tetap).
  - Ganti lagi ke Dus/Bks 6/Pcs jembatan 1/6 → saldo kembali ±1e-9 (Review Focus 3).
  - Penghalang: tambah opname draft fixture → `P0001`. Crew → `42501`. Lama tanpa satuan kecil → `22023`.
  - Uji kering BAWANG di akhir: hapus/selesaikan draft opname BAWANG **di dalam transaksi uji** (`UPDATE opname … status='finalized'` di fixture rollback) lalu jalankan, cocokkan Sawangan 864, BNR 0.432, harga ≈154320.99, katalog Marwan isi 2592; ROLLBACK.
- [ ] **Step 2: Jalankan t3** → gagal (fungsi belum ada).
- [ ] **Step 3: Tulis migration** sesuai urutan di atas.
- [ ] **Step 4: Terapkan, rename, stempel, jalankan t1+t2+t3** → semua LULUS; jalankan juga `supabase/verifikasi/master_bahan/t3_invarian.sql` dan `t7_regresi_jalur_lama.sql` → tetap LULUS.
- [ ] **Step 5: Commit** `feat(db): eksekusi ganti satuan bahan`.

### Task 4: Modal Ganti Satuan (admin-dashboard)

**Files:**
- Create: `apps/admin-dashboard/src/lib/masterBahan/gantiSatuan.ts`, `gantiSatuan.test.ts`
- Create: `apps/admin-dashboard/src/components/master-bahan/ModalGantiSatuan.tsx`
- Modify: `apps/admin-dashboard/src/hooks/masterBahan/useMutasiMasterBahan.ts` (+ `pratinjauGantiSatuan`, `gantiSatuan`)
- Modify: `apps/admin-dashboard/src/components/master-bahan/SeksiSatuan.tsx`
- Modify: `apps/admin-dashboard/src/lib/bahanBaku.ts` (tipe `BahanBakuWithHarga` + `satuan_diganti_at`, select kolomnya bila select eksplisit)

**Interfaces:**
- Consumes: RPC Task 2 & 3.
- Produces (`gantiSatuan.ts`):
  - `type PratinjauGantiSatuan` = bentuk JSON Task 2 (camel/snake sama persis dengan RPC).
  - `faktorGanti(lamaTampilan: number, baruTampilan: number, jembatan: number): { kKecil: number; kBesar: number } | null` — null bila input tak positif/finite.
  - `kalimatJembatan(kecilLama: string, kecilBaru: string, jembatan: number): string` → `"1 Sachet lama = 6 gram baru"`.
  - `labelPenghalang(p: { jenis: string; nomor: string; outlet: string | null }): string` → mis. `"Draft opname · SUKA SHAWARMA BEJI"`, `"Surat jalan SJ/… · <outlet>"`.
  - Tombol Ganti Satuan selalu tampil untuk `bolehData` (tanpa cek riwayat di klien); isian langsung di SeksiSatuan tetap ada dan tetap ditolak server untuk bahan ber-riwayat.
  - Hook (`DataSatuan` dari `lib/masterBahan/isianSatuan.ts`): `pratinjauGantiSatuan: useMutation<PratinjauGantiSatuan, Error, {bahanId: string; baru: DataSatuan & {satuan_po: string|null; satuan_distribusi: string|null}; jembatan: number}>`;
    `gantiSatuan: useMutation<string, Error, {…sama…; alasan: string}>` (onSuccess `segarkan` + invalidasi `['bahan_baku']`).

- [ ] **Step 1: Test `gantiSatuan.test.ts`:** `faktorGanti(432, 1000, 6)` → `{kKecil: 6, kBesar: 2.592}`; `faktorGanti(432,1000,0)` → null; `faktorGanti(432,1000,NaN)` → null; `kalimatJembatan('Sachet','gram',6)` → `'1 Sachet lama = 6 gram baru'`; `kalimatJembatan('Pcs','Pcs',1)` → `'1 Pcs lama = 1 Pcs baru'`; `labelPenghalang({jenis:'opname_draft', nomor:'x', outlet:'BEJI'})` → `'Draft opname · BEJI'`.
- [ ] **Step 2: `yarn vitest run src/lib/masterBahan/gantiSatuan.test.ts`** → FAIL.
- [ ] **Step 3: Implementasi `gantiSatuan.ts`** (angka jembatan dibaca dengan `bacaIsian` dari `angka.ts` di modal, bukan `Number()`).
- [ ] **Step 4: Test lulus.**
- [ ] **Step 5: `ModalGantiSatuan`** (`{ bahan: BahanBakuWithHarga; onTutup: () => void }`), tiga tahap: (1) `IsianSatuanFields` + select PO & distribusi (pilihan = tingkat satuan **baru** + `kg` distribusi bila kecil `gram`, pola `SeksiSatuan`) + input jembatan dengan kalimat `kalimatJembatan` + alasan wajib; (2) "Lihat pratinjau": penghalang (merah, daftar `labelPenghalang`, berhenti di sini) atau tabel saldo per lokasi `outlet | sekarang | sesudah` diformat dengan formatter saldo yang sudah ada di admin-dashboard (`compositeUnit.ts`, satuan lama untuk kolom "sekarang", satuan baru untuk "sesudah"), ringkasan `jumlah`, harga master lama → baru (`rupiah`); (3) input "ketik nama bahan untuk konfirmasi" (case-insensitive trim sama dengan `bahan.nama`) → tombol "Ganti satuan". Galat lewat `bacaGalatRpc`. Sukses: toast `'Satuan diganti'` + tombol "Tambah harga vendor baru" (buka `FormHargaVendor` dengan bahan hasil refetch).
- [ ] **Step 6: `SeksiSatuan`**: ganti paragraf amber "fitur Ganti Satuan menyusul" dengan teks `"Bahan yang sudah punya riwayat stok diganti satuannya lewat tombol Ganti Satuan (stok, riwayat, dan dokumen ikut dikonversi)."` + tombol sekunder "Ganti Satuan" (hanya `bolehData`) yang membuka modal.
- [ ] **Step 7: `yarn type-check` & `yarn vitest run src/lib/masterBahan`** di `apps/admin-dashboard` → 0 error / lulus.
- [ ] **Step 8: Commit** `feat(admin): modal Ganti Satuan di master bahan`.

### Task 5: Seksi Vendor di panel detail bahan

**Files:**
- Create: `apps/admin-dashboard/src/components/master-bahan/SeksiVendor.tsx`
- Create: `apps/admin-dashboard/src/hooks/masterBahan/useVendorBahan.ts`
- Modify: `apps/admin-dashboard/src/components/master-bahan/PanelBahan.tsx` (sisipkan setelah `SeksiSatuan`)

**Interfaces:**
- Produces `useVendorBahan(bahanId: string)` → React Query `['katalog_vendor','bahan',bahanId]` (prefix `katalog_vendor` agar ikut `segarkan`), select `id, supplier_id, satuan_beli, isi_satuan_kecil, harga, perlu_ditinjau, is_active, harga_updated_at, supplier:supplier_id(nama)` dari `bahan_baku_supplier` where `bahan_baku_id`.
- `SeksiVendor({ bahan }: { bahan: BahanBakuWithHarga })`: daftar (vendor, `Dibeli per {satuan_beli} isi {isi} {satuan_kecil}`, `rupiah(harga)`, lencana aktif/ditinjau/nonaktif); tombol "Tambah harga vendor" → `FormHargaVendor bahan={bahan}`; per baris aktif tombol "Nonaktifkan" → `DialogAlasan` → `nonaktifkanHargaVendor`. Aksi hanya bila `bolehUbahHarga(role)`; selain itu daftar read-only.

- [ ] **Step 1:** Implementasi hook + komponen.
- [ ] **Step 2:** `yarn type-check` → 0 error.
- [ ] **Step 3: Commit** `feat(admin): seksi vendor di panel detail bahan`.

### Task 6: Buang isian draft opname lokal yang basi (apps/stok)

**Files:**
- Create: `apps/stok/src/lib/stok/draftOpnameLokal.ts`, `draftOpnameLokal.test.ts`
- Modify: `apps/stok/src/components/stok/OpnameForm.tsx:117-170` (pembacaan & penulisan `opname_draft_${outletId}`)
- Modify: `apps/stok/src/types/stok.ts` (`BahanBaku.satuan_diganti_at?: string | null`; `useBahanBaku` sudah `select('*')`)

**Interfaces:**
- Produces `saringDraftBasi<T extends Record<string, unknown>>(draft: { savedAt?: number; inputs?: Record<string,T>; targets?: Record<string,T>; vendor?: Record<string,unknown> }, bahan: { id: string; nama: string; satuan_diganti_at?: string | null }[]): { draft: typeof draft; dibuang: string[] }` — buang kunci `inputs`/`targets`/`vendor` milik bahan yang `satuan_diganti_at` ≥ `savedAt` (savedAt tak ada → 0); `dibuang` = nama bahan.

- [ ] **Step 1: Test:** draft `savedAt` = 1000 (ms), bahan A `satuan_diganti_at` = ISO 2000ms → isian A dibuang, `dibuang=['A']`; bahan B tanpa `satuan_diganti_at` → tetap; draft tanpa `savedAt` + bahan A berganti kapan pun → dibuang (Review Focus 5); bahan C `satuan_diganti_at` < savedAt → tetap.
- [ ] **Step 2:** Jalankan → FAIL. **Step 3:** Implementasi. **Step 4:** Lulus.
- [ ] **Step 5: OpnameForm:** penulisan draft menambah `savedAt: Date.now()`; setelah `bahanBaku` termuat, satu `useEffect` memanggil `saringDraftBasi` atas isi state (inputs/targets/subInputs), menulis balik bila `dibuang.length > 0`, dan `toast.warning('Satuan ' + dibuang.join(', ') + ' baru diganti — hitung ulang bahan ini.')`. Inisialisasi state yang sudah ada jangan diubah selain itu.
- [ ] **Step 6:** `yarn type-check` & `yarn vitest run src/lib/stok/draftOpnameLokal.test.ts` di `apps/stok` → bersih.
- [ ] **Step 7: Commit** `feat(stok): buang isian draft opname lokal setelah ganti satuan`.

### Task 7: Dokumentasi & runbook

**Files:**
- Modify: `CLAUDE.md` (entri sesi baru: fitur, migration, gotcha WHEN trigger + utang replay 2030, redeploy `admin-dashboard` + `stok`)
- Modify: `docs/MASTER-SATUAN-PO-DAN-DISTRIBUSI.md` (bagian Ganti Satuan)
- Create: `docs/RUNBOOK-GANTI-SATUAN-BAWANG-PUTIH-BUBUK.md` (spec §7 langkah 1–5, plus query cek sesudahnya: saldo per outlet, harga master, katalog)
- Modify: spec §4.4a — ganti kalimat penjaga `finalize_opname` dengan: "Penjaga server tidak ditambahkan: draft opname di server sudah menjadi penghalang (Task 2); yang tersisa hanya draft lokal, ditangani Task 6."

- [ ] **Step 1:** Tulis. **Step 2: Commit** `docs: ganti satuan bahan baku`.

---

## Catatan eksekusi
- Native superapp **tidak** punya form opname (dicek: hanya test e2e menyebut opname) → di luar cakupan.
- Trigger yang diberi `WHEN` juga didefinisikan ulang oleh beberapa migration bertimestamp 2030; replay dari nol akan membuang `WHEN`. Produksi aman (sudah terstempel). Catat di CLAUDE.md.
- Menjalankan ganti satuan BAWANG sungguhan **bukan** bagian plan ini — dilakukan owner/admin lewat tombol setelah deploy, mengikuti runbook.
