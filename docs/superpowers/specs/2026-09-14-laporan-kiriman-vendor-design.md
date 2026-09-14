# Laporan Kiriman per Vendor + Label Vendor di Verifikasi Terima

**Tanggal:** 2026-09-14 · **Status:** desain disetujui owner, belum dibangun
**Asal:** celah 2 & 3 setelah fitur saldo vendor Gudang Pusat (spec 2026-09-11).

## 1. Masalah

Sejak 12 Sep 2026 setiap baris surat jalan bahan multi-vendor menyimpan `vendor_id`
dan `harga_snapshot` harga vendor. Datanya terkumpul, tapi tak ada layar yang
membacanya — padahal alasan utama fitur ini: menelusuri keluhan mutu ("daging alot
tgl 3") ke vendor, dan membandingkan biaya vendor per outlet.

Selain itu layar verifikasi terima outlet (`apps/distribusi` `VerifikasiForm`)
menampilkan bahan yang dipecah dua vendor sebagai dua baris bernama sama tanpa
keterangan vendor.

## 2. Keputusan owner

| # | Keputusan |
|---|---|
| L1 | Dipakai **dua pihak**: kitchen/purchasing menelusuri keluhan, owner/admin menganalisa biaya → satu halaman dua tampilan (Rincian & Rekap). |
| L2 | Tempat: **app stok**, `/stok/kiriman-vendor`, grup UTAMA. |
| L3 | Tanpa ekspor Excel, tanpa grafik, tanpa isi mundur vendor sebelum 12 Sep. |

## 3. Fakta data (diverifikasi 2026-09-14)

- `surat_jalan`: `id, outlet_id, status, created_at, document_number, …`. Status yang dikenal kode
  : `draft`, `dikirim`, `diterima_lengkap`, `diterima_sebagian`, `selesai`, `dibatalkan`.
- `surat_jalan_item`: `qty_dikirim`, `qty_terima` (satuan **besar**), `harga_snapshot`
  (per satuan besar), `vendor_id` (vendor induk, FK `surat_jalan_item_vendor_id_fkey`).
- Sejak 12 Sep: 188 baris SJ non-draft (dikirim 59, selesai 129), 158 bervendor. **Baris bahan multi-vendor
  semuanya bervendor**; yang kosong adalah bahan satu-vendor.
- Nama vendor tampil = `supplier.nama` tanpa akhiran " - Tempo N" (grup Pak Aziz),
  pola sama dengan `saldo_vendor_gudang`.

## 4. Desain

### 4.1 Akses

Role: `kitchen, purchasing, admin, owner, admin_finance, spv, regional_manager`
(= daftar `saldo_vendor_gudang`). Dicek di dalam RPC (`auth.jwt()` service_role atau
`peran_saya()`), menu sidebar & halaman memakai predikat TS yang sama.

### 4.2 Aturan baris

- Cakupan: `surat_jalan.status NOT IN ('draft','dibatalkan')`.
- Tanggal: `(surat_jalan.created_at AT TIME ZONE 'Asia/Jakarta')::date`.
- Vendor: `surat_jalan_item.vendor_id`; bila NULL dan bahan saat ini punya **tepat satu**
  vendor induk aktif → vendor itu, dengan penanda `vendor_otomatis = true` (ditampilkan
  "(katalog)"); selain itu NULL ("belum tercatat").
- Qty acuan: `qty_terima` bila tidak NULL, selain itu `qty_dikirim` dengan penanda
  `belum_diterima = true`.
- Nilai: `qty acuan × harga_snapshot` (NULL bila harga NULL).
- Outlet `type = 'test'`: **tampil di Rincian**, **tidak ikut Rekap** (aturan owner
  "outlet tes jangan masuk perhitungan").
- Halaman menyebut jelas: "Data vendor tercatat mulai 12 September 2026".

### 4.3 RPC

1. `laporan_kiriman_vendor_rincian(p_dari date, p_sampai date, p_outlet uuid,
   p_bahan uuid, p_vendor uuid, p_limit int, p_offset int)` → baris:
   `surat_jalan_item_id, surat_jalan_id, tanggal, document_number, status, outlet_id,
   outlet_nama, outlet_tes, bahan_baku_id, bahan_nama, satuan, vendor_id, vendor_nama,
   vendor_otomatis, qty_dikirim, qty_terima, qty_acuan, belum_diterima, harga, nilai,
   total_count`. Urut `tanggal DESC, document_number DESC, bahan_nama, id`
   (tiebreak unik). `p_limit` dibatasi 200. `total_count` via window sebelum LIMIT.
2. `laporan_kiriman_vendor_rekap(p_dari, p_sampai, p_outlet, p_bahan, p_vendor)` →
   dikelompokkan `(vendor_id, vendor_nama, bahan_baku_id, bahan_nama, satuan,
   outlet_id, outlet_nama)`: `qty, nilai, harga_rata (nilai/qty berharga),
   jumlah_sj, ada_belum_diterima`. Tanpa outlet tes. Grain ini (vendor×bahan×outlet)
   paling banyak ribuan baris per bulan → UI menandai bila hasil = 1.000 (pola
   `truncated` dashboard waste).
   Filter vendor pada kedua RPC mencocokkan vendor **setelah** fallback katalog.

Keduanya `SECURITY DEFINER SET search_path = public`, `REVOKE … FROM PUBLIC, anon`,
`GRANT EXECUTE … TO authenticated, service_role`. Rentang tanggal wajib, maks 93 hari.

### 4.4 Halaman `/stok/kiriman-vendor`

- Bar filter: dari–sampai (default 7 hari terakhir WIB), outlet, bahan, vendor.
- Tab **Rincian**: tabel/kartu per baris (mobile-first, pola layar stok lain), 50 per
  halaman, tombol sebelumnya/berikutnya, total baris.
- Tab **Rekap**: kelompok per vendor (subtotal qty per bahan & rupiah), di dalamnya baris
  per outlet. Total keseluruhan rupiah di atas.
- Fungsi murni (`src/lib/stok/kirimanVendor.ts`): pengelompokan rekap per vendor,
  subtotal, format label vendor (`(katalog)` / `belum tercatat`).
- Klik baris Rincian → tidak ada navigasi (di luar cakupan).

### 4.5 Label vendor di `VerifikasiForm` (distribusi)

- Query item memuat `vendor:supplier!surat_jalan_item_vendor_id_fkey(nama)`.
- Bila `bahan_baku_id` muncul lebih dari sekali dalam SJ yang sama, nama bahan ditampilkan
  `NAMA · Vendor` (nama vendor tanpa " - Tempo N"), di daftar maupun di kartu detail item.
- Bahan satu baris tidak berubah.

## 5. Pengujian

- **SQL** (`supabase/verifikasi/kiriman_vendor/t1_laporan.sql`, BEGIN…ROLLBACK, peran
  asli, kontrol negatif): crew ditolak; kitchen boleh; Σ nilai rekap = Σ nilai rincian
  non-tes untuk rentang sama; draft & dibatalkan tak muncul; fallback vendor satu-vendor
  terisi dengan penanda; filter vendor bekerja; rentang > 93 hari ditolak.
- **TS**: pengelompokan & label.
- **Build/type-check** stok & distribusi; **login sungguhan** setelah deploy.

## 6. Di luar cakupan

Ekspor, grafik, drill-down ke detail SJ, isi mundur vendor pra-12 Sep, pengisian
`vendor_id` otomatis pada jalur yang masih mengosongkannya untuk bahan satu-vendor
(dicatat sebagai temuan terpisah).
