# Grouping Ledger per Transaksi (bukan per Bahan)

**Status:** Approved
**Tanggal:** 2026-07-04
**Konteks:** Lanjutan sesi COGS/BOM Automation. Terkait [[2026-07-04-ledger-composite-unit-display-design]] (satuan majemuk dipakai di detail expand kalau berlaku).

## Masalah

Sejak BOM automation aktif, satu order bisa menghasilkan belasan baris `ledger_stok` sekaligus (1 baris per bahan resep). Halaman ledger (`apps/stok/src/app/stok/ledger/page.tsx`) menampilkan tiap baris sebagai card sendiri — daftar jadi sangat panjang & sulit dibaca ("order Ayam" tersebar jadi 12 card terpisah, bukan 1 unit yang jelas).

## Solusi

### 1. Kunci pengelompokan
`ledger_stok` sudah punya `ref_order_id`, `ref_opname_id`, `ref_shipment_id`, `ref_transfer_id` — baris-baris dari satu event (order selesai, opname difinalisasi, dll) sudah berbagi nilai yang sama di salah satu kolom ini. Kunci grup: `COALESCE(ref_order_id, ref_opname_id, ref_shipment_id, ref_transfer_id, id)` — kalau tidak ada satupun ref (adjustment/waste manual), fallback ke `id` sendiri sehingga baris itu jadi grup 1-anggota (perilaku sama seperti sekarang, 1 card per baris, **tidak ada perubahan** untuk tipe manual).

Catatan: void/cancel order menulis baris `pemakaian` (asli) + `adjustment` (reversal) dengan `ref_order_id` yang sama → keduanya masuk 1 card yang sama (order tsb), ditampilkan kronologis saat expand.

### 2. View database baru: `ledger_transaksi_ringkas`
View biasa (bukan `security_definer` — tetap tunduk RLS `ledger_read` yang sudah ada, tidak ada perubahan akses):

```sql
CREATE VIEW ledger_transaksi_ringkas AS
SELECT
  COALESCE(ref_order_id::text, ref_opname_id::text, ref_shipment_id::text, ref_transfer_id::text, id::text) AS transaksi_key,
  outlet_id,
  MIN(created_at) AS created_at,
  COUNT(*) AS jumlah_bahan,
  MAX(ref_order_id) AS ref_order_id,
  MAX(ref_opname_id) AS ref_opname_id,
  MAX(ref_shipment_id) AS ref_shipment_id,
  MAX(ref_transfer_id) AS ref_transfer_id
FROM ledger_stok
GROUP BY 1, outlet_id;
```

List page query & paginasi (`page size`) sekarang jalan di atas view ini — **paginasi per transaksi**, bukan per baris seperti sekarang (menyelesaikan masalah "1 order habiskan banyak slot page").

### 3. Label card (jenis transaksi + nama/referensi)
Ditentukan dari kolom `ref_*` mana yang terisi (bukan dari `tipe`, karena 1 grup bisa berisi >1 `tipe` saat void):
| Ref terisi | Label | Sumber nama tambahan |
|---|---|---|
| `ref_order_id` | "Order Selesai" | JOIN `orders.order_number` → "Order #123" |
| `ref_opname_id` | "Opname" | JOIN `opname.tanggal` + `tipe` → "Opname Harian — 4 Jul 2026" |
| `ref_shipment_id` | "Terima Kiriman" | (tidak ada tabel referensi saat ini — label + waktu saja) |
| `ref_transfer_id` | "Transfer Stok" | (tidak ada tabel referensi saat ini — label + waktu saja) |
| tidak ada (manual) | label existing (`tipe` mentah: adjustment/waste/dst) | seperti sekarang |

Card collapsed menampilkan: label transaksi + waktu + (nama/referensi kalau ada). Field JOIN order/opname diambil lewat query terpisah per-item saat render (react-query, di-cache per id) — bukan ditambahkan ke view (biar view tetap ringan & tidak coupling ke tabel lain yang mungkin berubah).

### 4. Interaksi: expand inline (accordion)
Klik card → expand di tempat (tidak pindah halaman), menampilkan daftar bahan dalam grup:
```
Ayam: -500 gram → sisa 4.5 kg
Kulit 25: -20 lembar → sisa 3 pack
...
```
Qty & sisa pakai formatter dari spec satuan majemuk (`formatCompositeDelta`/`formatCompositeSaldo`) untuk bahan yang punya `satuan_kecil` (MINYAK SAYUR, FOIL); bahan lain tampil apa adanya.

Detail per-grup di-fetch lazy (baru query saat pertama kali di-expand), lewat hook baru `useLedgerTransaksiDetail(outletId, transaksiKey)` — query `ledger_stok` + join `bahan_baku(nama, satuan, satuan_kecil, faktor_tampilan)` filter `COALESCE(...) = transaksiKey`. Hasil di-cache react-query per key, jadi expand/collapse berulang tidak refetch.

Card manual (grup 1-anggota) **tidak punya expand** — sudah menampilkan semua info yang relevan di collapsed state, sama seperti sekarang.

### 5. Halaman detail lama (`/stok/ledger/[id]`)
Tetap ada, tidak dihapus — dipakai untuk baris manual (link dari card manual, kalau perlu lihat detail penuh: `catatan`, `created_by`, dll yang tidak cukup di card ringkas). Order/opname/dll tidak lagi punya link ke halaman ini karena sudah bisa dilihat lewat expand inline.

### 6. Perubahan file
- Migration baru: `supabase/migrations/20260704210000_ledger_transaksi_ringkas_view.sql`
- `apps/stok/src/hooks/useLedger.ts` — tambah `useLedgerTransaksiList` (ganti `useLedgerList` sbg sumber data list page) + `useLedgerTransaksiDetail`
- `apps/stok/src/components/stok/LedgerList.tsx` — rombak jadi accordion per transaksi (state expandedKey lokal), reuse card styling yg ada
- `apps/stok/src/lib/format/compositeUnit.ts` — dipakai di sini juga (dependency ke spec satuan majemuk)

### 7. Testing
- Unit test util pengelompokan label (given ref combination → expected label + join type)
- Manual smoke test: buka ledger, pastikan 1 order = 1 card (bukan 12), expand tampilkan semua bahan + sisa stok benar, card manual tetap seperti sekarang, paginasi jalan per-transaksi bukan per-baris.

## Non-goals (sesi ini)
- Tidak menambah tabel `shipment`/`transfer` (belum ada) — label untuk 2 tipe ini tetap generik (tanpa nama referensi tambahan) sampai tabelnya ada.
- Tidak mengubah RLS `ledger_read` — view baru murni agregasi, akses tetap sama persis dengan sekarang.
- Tidak menghapus halaman detail lama, hanya mengurangi penggunaannya untuk baris manual saja.
