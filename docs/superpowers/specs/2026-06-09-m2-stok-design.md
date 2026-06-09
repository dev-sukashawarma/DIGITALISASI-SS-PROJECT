# M2 Stok — Design (Final, post Field Discovery)

> **Status:** Approved · **Date:** 2026-06-09 · **Dev:** Dev B
> **Basis:** M2-STOK-SPECIFICATION.md + M2-FIELD-DISCOVERY.md (62 jawaban lapangan)

---

## Ringkasan Keputusan

| # | Keputusan | Alasan (dari lapangan) |
|---|-----------|------------------------|
| 1 | Opname **1×/hari malam saat tutup**, oleh crew bertugas, crew finalize sendiri | #11-15: harian, malam, wajib, crew yang hitung; shift 1-4 orang |
| 2 | Tidak ada opname pagi | #3: pagi tidak hitung stok |
| 3 | **BOM/resep: struktur dibangun sekarang, auto-deduction ditunda** sampai POS feed siap (M4) | #31-32: pemakaian per-transaksi + resep tetap; POS = M4 |
| 4 | Auto-flag selisih: **threshold dulu (M2)**, presisi penjualan×resep nanti (M4) | #43: owner mau flag selisih mencurigakan |
| 5 | Tipe ledger tambah `transfer_keluar`/`transfer_masuk` | #33: transfer antar outlet conditional |
| 6 | Waste manual + alasan, masuk laporan owner | #34-37: basi/kadaluarsa, owner mau detail |
| 7 | Offline = **resilience ringan** (retry submit), bukan full offline-first | #49-51: WiFi stabil semua outlet |
| 8 | Target **Android 6**, mobile-web ringan, input angka manual | #52-58: HP pribadi Android min 6, melek app |
| 9 | Mitra = internal (tanpa logika khusus); owner lihat semua di M4 | #45-48: cara kerja sama, ambil dari pusat |
| 10 | Reporting harian + feed HPP ke M4 | #61-62 |

---

## Domain Model (Final)

### Master
**`bahan_baku`** (centralized, no outlet_id)
`id, nama, satuan(enum), kategori(enum), default_reorder_point, is_active, created_at`
> Satuan & kategori final menunggu dokumen bahan baku owner. Struktur siap tanpa rombak.

**`resep`** (BOM header — dibangun, belum aktif)
`id, menu_item_ref, nama, scope(global|outlet), outlet_id(nullable), is_active, created_at`

**`resep_item`** (BOM lines)
`id, resep_id, bahan_baku_id, qty_per_porsi, satuan`

### Transaksional
**`opname`**
`id, outlet_id, tanggal, tipe(harian|mingguan|ad_hoc), status(draft|finalized), created_by, created_at, updated_at, notes`

**`opname_item`**
`id, opname_id, bahan_baku_id, qty_fisik, qty_system, selisih(computed), flagged(bool), catatan`

**`ledger_stok`**
`id, outlet_id, bahan_baku_id, tipe(terima_kiriman|pemakaian|waste|adjustment|opname_selisih|transfer_keluar|transfer_masuk), qty, catatan, ref_shipment_id, ref_opname_id, ref_transfer_id, created_by, created_at, saldo_sebelum, saldo_sesudah`

**`stok_balance`** (materialized)
`id, outlet_id, bahan_baku_id, saldo, updated_at`
> Maintained: trigger on ledger INSERT + nightly pg_cron recompute (insurance).

---

## Aturan Bisnis

1. **qty_system** = `stok_balance.saldo` saat opname dibuka. Opname pertama (belum ada saldo) → qty_system=0, qty_fisik jadi saldo awal.
2. **Finalize opname** (atomic transaction): set status=finalized + INSERT ledger `opname_selisih` per item ber-selisih + trigger update stok_balance. Lock dari edit.
3. **Koreksi opname finalized**: tidak edit langsung; buat opname `ad_hoc` baru. Audit utuh.
4. **Selisih flag (M2)**: `|selisih| > 15% × qty_system` → flagged=true + wajib catatan (tidak block finalize).
5. **Terima kiriman (M3)**: via Edge Function `ledger/create-from-shipment` (M2 owns ledger).
6. **Transfer**: outlet A `transfer_keluar` + outlet B `transfer_masuk`, qty sama, ref_transfer_id sama.
7. **Pemakaian (BOM)**: tipe `pemakaian` disiapkan; pengisi otomatis = `penjualan × resep` aktif saat POS feed siap (M4). M2: kosong / manual opsional.
8. **Negatif diperbolehkan** (utang stok, koreksi manual).

---

## Integrasi
- **M3 → M2**: Edge Function `ledger/create-from-shipment` (tipe=terima_kiriman, ref_shipment_id).
- **M2 → M4**: ledger feed untuk HPP/COGS; stok_balance untuk status; expected-usage engine aktif saat POS nyambung.
- **POS (shawarma-kiosk) → M2**: future — penjualan×resep → ledger pemakaian + baseline auto-flag presisi.

---

## RLS
`opname, opname_item, ledger_stok, stok_balance`: staff lihat hanya outlet sendiri (`outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id=auth.uid())`). `bahan_baku`/`resep` global: read authenticated.

---

## UI Modules
| Modul | Entry | Users | Catatan |
|---|---|---|---|
| Opname | `/stok/opname` | crew, SPV, kepala | Optimasi hitung malam cepat; pre-populate; input angka; finalize → ledger |
| Ledger | `/stok/ledger` | crew, SPV, kepala | Riwayat + manual (waste/adjustment/transfer); pagination 50/page |
| Monitoring | `/stok/monitoring` | crew, SPV, kepala | Warna reorder_point; auto-refresh 30s; flag selisih; opname overdue |

**Teknis UI:** Android 6 compatible (cek polyfill, hindari API modern tak-didukung), mobile-first, full Bahasa Indonesia.

---

## Out of Scope M2 (ditunda)
- Auto-deduction BOM aktif (butuh POS feed → M4)
- Auto-flag selisih presisi berbasis penjualan (M4)
- Konversi satuan beli≠pakai
- Per-outlet reorder_point override (M4 owner dashboard)
- Push/WA notification (in-app dashboard dulu)
- Full offline-first (resilience ringan saja)
- Batch/lot/FIFO costing
