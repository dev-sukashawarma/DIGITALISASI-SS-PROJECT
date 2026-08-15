---
name: bom-scale-factor-two-columns
description: faktor_konversi vs faktor_tampilan tidak sinkron di 14+ bahan; tak ada satu kolom yang benar untuk semua — jangan samakan secara massal
metadata: 
  node_type: memory
  type: project
  originSessionId: dec0fc10-44d1-4828-b586-086c61dd2ecc
  modified: 2026-08-15T06:53:35.904Z
---

`bahan_baku` punya DUA faktor gram-per-satuan-besar yang **tidak sinkron** untuk 36 bahan
(14 di antaranya dipakai resep aktif): `faktor_konversi` vs `faktor_tampilan`.
Contoh rasio: KEJU 24x, ES BATU 20x, MINYAK 16x, MAYONES/SAOS TOMAT 12x, KENTANG 10x, SAPI 2x.

Bahaya: kalau satu jalur **membagi** dengan `faktor_konversi` lalu jalur lain
(`to_ledger_scale()`, dipakai 8 fungsi penulis ledger) **mengalikan** dengan
`faktor_tampilan`, hasilnya salah persis sebesar rasio kedua kolom — hanya di outlet
`saldo_is_gram`. Terjadi nyata 15 Aug 2026 lewat `20300108000002` (BOM dialihkan ke
waterfall): resep minta SAPI 120g, ledger mencatat -240.

**JANGAN samakan kedua kolom secara massal.** Riwayat migration membuktikan tak ada satu
kolom yang benar untuk semua bahan:
- `20260706110000` — SAPI `faktor_konversi` seharusnya 2000 gram/blok (live: 1000) → fk salah
- `20300105000002` — MAYONES `faktor_tampilan` 144000 dinyatakan SALAH (12x) → ft salah
- `20260716000009` — menyebut `faktor_konversi` "legacy", prioritaskan `faktor_tampilan`

**Why:** menyamakan ke salah satu arah pasti merusak sebagian bahan; nilai fisik per
bahan butuh konfirmasi owner.

**How to apply:** untuk penulisan ledger, **bagi dengan faktor yang SAMA dengan yang
nanti dikalikan** — outlet gram-scale bagi `faktor_tampilan` (hasil = persis gram resep,
benar secara aljabar berapa pun nilainya), outlet besar-scale tetap `faktor_konversi`.
Pola ini dipakai `20300108000004_fix_bom_scale_factor_mismatch.sql` dan `20300108000005_fix_bom_middle_tier_factor_universal.sql`. Rekonsiliasi nilai
fisik per bahan adalah pekerjaan TERPISAH dan masih TERBUKA.
Terkait: [[ledger-writers-scale-blind-to-saldo-is-gram]], [[stok-balance-ledger-invariant]]
