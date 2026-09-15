# HPP Dinamis berbasis Harga Kiriman Gudang — Design Spec

**Tanggal:** 2026-09-15
**Status:** Disepakati lewat sesi grilling (10 pertanyaan), belum dieksekusi
**Lingkup app:** DB (Supabase), `apps/stok` (papan HPP Menu)
**Tidak disentuh:** `apps/admin-dashboard`, `apps/finance`, `apps/manager`, mitra P&L, `hpp_override`, trigger BOM

---

## 1. Masalah

HPP hidup di dua sistem yang tidak saling kenal dan keduanya statis (diverifikasi
ke DB produksi 2026-09-15):

| Sistem | Sumber | Dipakai oleh | Sifat |
|---|---|---|---|
| A. `menu_items.hpp_override` / `channel_hpp` (56/79 menu) | diketik manual | Owner Dashboard, Profit, Finance, Mitra P&L | beku sampai diketik ulang |
| B. `get_hpp_periode` (resep × `bahan_baku_harga.harga_beli`) | harga master "terakhir diketik" | **nol UI** (dorman) | selalu harga *hari ini*, buta waktu |

Selisih A vs B untuk menu yang sama 6–24%. Sepuluh menu Online tanpa override
→ COGS nol di Owner Dashboard.

`surat_jalan_item.harga_snapshot` (911 baris September, nol kosong) dan
`vendor_id` (fitur saldo per vendor, 12 Sep) sudah menyimpan harga vendor
kiriman per outlet, tetapi **tidak satu pun fungsi HPP membacanya**.

## 2. Definisi yang disepakati

> HPP outlet mengikuti harga barang yang benar-benar dikirim gudang ke outlet
> itu; harga kiriman berasal dari vendor yang dipilih gudang saat membuat surat
> jalan. HPP per outlet, per kiriman — bukan satu angka global per bahan.

**Aturan harga campur (Q2 = a):** harga kiriman **terverifikasi terakhir** ke
outlet itu pada/sebelum tanggal T. Bukan rata-rata tertimbang, bukan FIFO —
keputusan owner 2026-07-01, 2026-09-03, 2026-09-08 tetap berlaku.

**Harga bertingkat (Q3 = a):** `harga_bahan_efektif(outlet, bahan, T)`

| Tingkat | Sumber | `sumber_harga` |
|---|---|---|
| 1 | `surat_jalan_item.harga_snapshot` SJ ke outlet, `qty_terima IS NOT NULL`, tanggal ≤ T, terbaru | `kiriman` |
| 2 | `terima_vendor_outlet.harga_snapshot` drop-ship, tanggal ≤ T, terbaru | `drop_ship` |
| 3 | `bahan_baku_harga_history.harga_baru` dengan `changed_at` ≤ T, terbaru, hanya baris yang benar-benar mengubah harga (`harga_lama IS DISTINCT FROM harga_baru`) | `master_historis` |
| 4 | `bahan_baku_harga.harga_beli` | `master_sekarang` |
| — | tidak ada satu pun | `tidak_ada` (harga 0, WAJIB tampil sebagai peringatan, bukan angka) |

Semua harga di atas per **satuan besar**. Pembagi ke satuan kecil selalu
`bahan_baku_harga.kemasan_qty` (basis kanonik 2 Sep 2026), fallback faktor
penuh (`faktor_tampilan` bila `faktor_tengah` terisi, selain itu
`faktor_konversi`).

**Sumber kuantitas (Q9 = D3):**

| Mode | Sumber qty | `sumber_hpp` |
|---|---|---|
| Aktual | baris `ledger_stok` `tipe='pemakaian'` (+ `adjustment` pembalik void ber-`ref_order_id`) per outlet per tanggal, **sadar skala** (`saldo_is_gram`) | `aktual` |
| Teoritis | `resep_item.qty_per_porsi × qty terjual` (logika `get_hpp_periode`) untuk outlet/periode tanpa baris pemakaian | `teoritis` |

Aktual menangkap substitusi waterfall (POUCH→KOMPAN) dan resep per-outlet;
teoritis tidak. Selisih aktual vs teoritis per outlet adalah angka pemantauan
baru.

**Grain:** baris `pemakaian` dicatat per order (catatan "Penjualan Otomatis
#64 (Original Ayam Jumbo)"), bukan per menu yang bisa di-join andal. Maka
**aktual hanya ada di tingkat outlet dan bahan**; tingkat menu selalu teoritis
(resep × harga efektif outlet × qty terjual). Papan menampilkan: per menu →
override vs teoritis-dinamis; per outlet → override total vs teoritis total vs
aktual total; per bahan → qty pemakaian aktual × harga efektif.

## 3. Alur harga vendor (Q5 = a, bisa diedit)

`verifikasi_terima_po`, **hanya bila kedua guard lolos** (PO uji coba, salah
satuan), menulis `harga_terima` ke `bahan_baku_supplier` untuk (bahan, vendor
PO). Harga ditulis dalam `satuan_beli` katalog: bila `satuan_beli` = satuan
master → `harga_terima` apa adanya; bila berbeda (FOIL `roll` vs `Dus`) →
konversi lewat `isi_satuan_kecil` dan `kemasan_qty`. Bila baris katalog belum
ada → dibuat dengan `satuan_beli` = `bahan_baku.satuan`, `isi_satuan_kecil` =
`kemasan_qty`, `sumber='po'`, `perlu_ditinjau=false`. Trigger `bbs_tulis_riwayat`
mengisi `_history`.

Katalog tetap bisa disunting manual (layar `BarisVendor` sudah ada). Suntingan
berlaku **ke depan** saja; snapshot yang sudah tersimpan tidak berubah.

**Katalog `perlu_ditinjau` (44 baris) dibiarkan terisi alami dari PO (Q7 = a).**
Tidak ada pengisian massal dari ingatan/faktur lama.

`fill_harga_snapshot` **tidak diubah** — ia sudah membaca katalog vendor yang
dipilih gudang. Kecuali satu hal: pembagi dari `faktor_tampilan` diseragamkan ke
`kemasan_qty` (lihat §6).

## 4. Fase 1 = berdampingan, tidak mengganti (Q4 = c, Q6 = b)

- **Pelaporan tetap `hpp_override`**: Profit, Owner Dashboard, Finance, mitra.
  Nol perubahan di `apps/admin-dashboard`, `apps/finance`, `apps/manager`.
- **Satu permukaan baru:** panel "HPP Dinamis" di halaman HPP Menu `apps/stok`
  (`/stok/hpp-menu`): pemilih outlet + periode; ringkasan outlet (override
  total vs teoritis-dinamis total vs aktual total, porsi `sumber_harga`); tabel
  per menu (qty terjual, HPP override, HPP teoritis-dinamis, selisih %); tabel
  per bahan (qty pemakaian aktual, harga efektif, `sumber_harga`, tanggal &
  nomor SJ yang dipakai, nilai).
- Owner memantau sebulan; keputusan mengganti laporan mana = sesi terpisah.
- Menu tanpa resep (47/79) tampil `override` saja, tidak dihitung.
- Periode sebelum 1 Sep 2026: papan menampilkan banner "harga kiriman belum
  tersedia sebelum 1 September 2026; HPP periode ini memakai harga master".

## 5. Prasyarat data (Q10 = a, + Pamulang)

1. **`UPDATE outlets SET is_bom_enabled = true`** untuk MITRA CICURUG, MITRA
   SENTUL, MITRA CILEUNGSI. Ketiganya dibuat 17–31 Jul 2026 dengan bendera
   mati; 3.676 order September tidak pernah memotong stok; satu-satunya
   pergerakan keluar = `opname_selisih`. Sebelum UPDATE: verifikasi
   `stok_balance` ada untuk bahan resep & skala `saldo_is_gram` konsisten.
   Tidak ada koreksi mundur (Agustus dilewati; saldo hari ini dijaga opname).
2. **`UPDATE outlets SET type = 'mitra'`** untuk MITRA PAMULANG (sekarang
   `outlet`). Sebelum UPDATE: inventarisasi pembaca `type = 'mitra'` —
   `get_owner_dashboard_summary` (markup HPP 1,1×), `20300125000000` mitra
   P&L, `20260911140100`, penyaring korlap — dan laporkan dampak ke owner
   sebelum apply.

## 6. Pengerasan yang ikut (Q8 = a)

1. `DROP FUNCTION IF EXISTS public.po_on_verified()` — zombie dari
   `20300105000017`, tanpa guard, triggernya sudah di-drop sejak
   `20260828114500`.
2. `get_waste_breakdown`, `get_waste_incidents`, `get_waste_summary_v2`:
   `hpp_kecil = harga_beli / faktor_konversi` → `/ kemasan_qty` (fallback
   faktor penuh). **Tidak** menyentuh `get_waste_periode` (total waste Profit &
   mitra tetap).
3. `fill_harga_snapshot`: konversi katalog → satuan besar memakai `kemasan_qty`
   alih-alih `faktor_tampilan` (identik untuk bahan yang sudah dinormalkan;
   beda hanya untuk PLASTIK BESAR/SABUN/SEDOTAN/TUTUP PACK yang belum).
4. **Dicatat, tidak diubah:** `verifikasi_terima_po` tidak memperbarui
   `kemasan_qty` saat menimpa master.

## 7. Objek DB baru

| Objek | Jenis | Catatan |
|---|---|---|
| `harga_bahan_efektif(p_outlet uuid, p_bahan uuid, p_tanggal date)` | fn SQL STABLE, `RETURNS (harga_besar numeric, harga_kecil numeric, sumber_harga text, ref_id uuid, ref_tanggal date)` | §2 tingkat 1–4 |
| `get_hpp_dinamis_menu(p_outlet uuid, p_from date, p_to date)` | RPC SECURITY DEFINER, scope `outlet_ids_terhitung()` ∩ `accessible_outlet_ids()`, role gate = `canViewVendorPrices` (kitchen/purchasing/admin_finance/admin/owner/spv/regional_manager/leader/area_manager) | per menu: qty terjual, hpp_override, hpp_aktual, hpp_teoritis, sumber_hpp |
| `get_hpp_dinamis_bahan(p_outlet, p_from, p_to)` | RPC, gate sama | per bahan: qty pemakaian (satuan kecil), harga_kecil, nilai, sumber_harga, ref SJ |
| `get_hpp_dinamis_ringkas(p_outlet, p_from, p_to)` | RPC | porsi `sumber_harga`, total aktual vs teoritis vs override |

Semua `SET search_path = public`, EXECUTE dicabut dari PUBLIC/anon, GRANT ke
`authenticated`. Harga **diselesaikan saat dibaca**: tidak ada kolom harga di
`ledger_stok`, `trg_process_bom_stok` & `process_waterfall_deduction` tidak
disentuh.

## 8. Skala (wajib, bukan opsional)

`ledger_stok.qty` untuk `pemakaian` berada dalam skala yang ditentukan
`saldo_is_gram(outlet, bahan)`: bila gram-scale → qty sudah satuan kecil, kalikan
`harga_kecil`; bila tidak → qty satuan besar, kalikan `harga_besar`. Lihat
memori `migrasi-skala-satuan-stok-belum-selesai`. 141 baris "berisiko" audit
Agustus akan tampak sebagai HPP janggal — itu fitur (detektor), bukan bug spec.

## 9. Verifikasi

- Tiap migration: `DO`-block assertion + **kontrol negatif yang benar-benar
  melempar error**, verifikasi ground-truth `pg_get_functiondef`/katalog.
- `harga_bahan_efektif`: 5 kasus (kiriman ada; hanya drop-ship; hanya history;
  hanya master; tidak ada) dalam transaksi + ROLLBACK.
- Write-back katalog: FOIL Ekadharma (roll vs Dus) tidak salah 48×; PO uji
  `TEST/…` ditolak; guard salah-satuan menahan; tulisan klien tidak gagal 42501
  (uji dengan `SET LOCAL ROLE authenticated` + jwt claims).
- Regresi: `get_hpp_periode` tak berubah hasilnya; `get_waste_periode` identik
  20 desimal sebelum/sesudah; `fill_harga_snapshot` identik untuk 50 bahan
  ternormalisasi.
- Papan: vitest hook + `next build --webpack` `apps/stok`; smoke test login
  kitchen: pilih Empang, 1–14 Sep → kolom terisi, porsi `kiriman` > 0.
- Skrip pemantau `SS COGS SET/pemantau-hpp-dinamis-2026-09.sql`: Q1 selisih
  aktual vs override per menu per outlet; Q2 porsi `sumber_harga` per minggu;
  Q3 outlet dengan `sumber_hpp = teoritis`; Q4 bahan resep tanpa harga.

## 10. Risiko & batas

- Tiga migration 2030 (`20300103000010`, `20300105000017`, `20300132000000`)
  mendefinisikan fungsi terkait; replay dari nol bisa menimpa. Produksi aman
  (terstempel). Preseden 2026-09-09: didokumentasikan, tidak di-rename.
- Batas jujur snapshot = 1 Sep 2026. Tidak ada pemulihan Agustus.
- Katalog awal tipis (16/60 berharga) → minggu-minggu awal papan didominasi
  `master_*`. Itu kenyataan, ditampilkan apa adanya.
- Menyalakan BOM tiga outlet mengubah perilaku stok mereka mulai hari apply.
  Beri tahu leader outlet.
- `timestamp` migration: gunakan `20260915xxxxxx`; cek duplikat
  `ls supabase/migrations | cut -c1-14 | sort | uniq -d` (bentrok 10 Sep).

## 10a. Lubang tambahan yang ditemukan, sengaja ditunda

Logika pemilihan HPP di laporan (`channel_hpp` → `hpp_override` → jumlah
komponen paket → 0, plus markup mitra ×1,1) **tersalin di ≥6 tempat klien**
(`ReportsView.tsx`, `mitraPnl.ts`, `mitraRoi.ts`, `ownerDashboard.ts`,
`pawoon-import/profit/page.tsx`, `check_channels.ts`) **dan 1 di SQL**
(`get_owner_dashboard_summary`). Begitu fase 2 memutuskan mengganti laporan,
semua salinan harus diganti serentak lewat satu sumber (RPC), bukan satu per
satu — kalau tidak, dua laporan menampilkan HPP berbeda untuk periode sama.
Ini alasan tambahan fase 1 tidak menyentuh laporan mana pun.

## 11. Yang sengaja TIDAK dikerjakan

FIFO/WAC/kantong per PO · mengganti `hpp_override` di laporan mana pun ·
mengubah mitra P&L · menyentuh trigger BOM · mengisi katalog massal ·
memulihkan snapshot pra-1-Sep · mengubah `kemasan_qty` dari PO.
