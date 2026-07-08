# Normalisasi Nama Bahan — COGS Cards → `bahan_baku` (DB master)

Sumber master: `supabase/migrations/20260609001800_seed_sample_stok.sql` (tabel `bahan_baku`, `nama` UNIQUE).
Data COGS: `cogs-bom.json` (20 produk). Hasil normalisasi: `cogs-bom-normalized.json` / `.csv` (field `bahan_db`, `match`, `is_material`).

## Ringkasan
- **188** baris item → cocok dengan bahan **existing** di master.
- **31** baris → bahan **baru** (8 SKU, perlu di-insert; lihat `new-bahan-baku.sql`).
- **19** baris → `Loss`/`Lose` = **buffer** (bukan material; `is_material: false`, tidak masuk BOM).

## Peta nama (card → DB)

### ✅ Cocok dengan master (existing)
| Label di card | → `bahan_baku.nama` |
|---|---|
| Ayam, Ayam marinasi | AYAM |
| Sapi, Sapi slice | SAPI |
| Kulit 25, Kulit 25cm | KULIT 25 |
| Kulit 28, Kulit 28cm | KULIT 28 |
| Kulit 32cm | KULIT 32 |
| Mayo | MAYONES |
| Tum, Tum Putih | TUM |
| Minyak | MINYAK SAYUR |
| Kentang, Kentang goreng | KENTANG |
| Tepung | TEPUNG |
| Kertas wrap | PAPER WRAP |
| Foil | FOIL |
| Lettuce | LETTUCE |
| Keju Slice | KEJU |
| Saos Samyang | SAOS SAMYANG |
| Gas, Gas melon, Gas Melon, Isi gas melon | GAS 3Kg |
| Plastik | PLASTIK MERAH |

### 🆕 Bahan baru (perlu di-insert ke master)
| Label di card | → `bahan_baku.nama` (baru) | satuan | kategori |
|---|---|---|---|
| Saos cabe/tomat (+varian ejaan) | SAOS CABE | crt | saus |
| Plastik vacum / Plastik Vacum | PLASTIK VACUM | pcs | kemasan |
| Cup+tutup | CUP + TUTUP | pcs | kemasan |
| Dus packing | DUS PACKING | pcs | kemasan |
| Es Batu | ES BATU | pcs | minuman |
| Mie | MIE | pcs | lainnya |
| Powder mix | POWDER MIX | kg | minuman |
| Stiker | STIKER | pcs | kemasan |

> satuan/kategori bahan baru = **provisional** (ikut gaya master). Sesuaikan bila owner punya standar lain.

### ⛔ Bukan material (buffer)
| Label di card | Perlakuan |
|---|---|
| Loss, Lose | Buffer loss/pembulatan (Rp). `is_material: false`, **tidak** jadi `bahan_baku`, **tidak** masuk resep_item. Tetap terhitung di COGS. |

## Keputusan (dari owner)
1. `Saos cabe/tomat` → **1 SKU gabungan** `SAOS CABE` (master punya SAUS X HOT + SAOS TOMAT terpisah, tapi card menggabung → dibuat SKU sendiri).
2. `Plastik` generik → **PLASTIK MERAH**.
3. `Loss`/`Lose` → **exclude dari BOM** (buffer).
4. 7 item tak-terdaftar → **ditambah** sebagai `bahan_baku` baru.

## ⚠️ Catatan lanjutan (di luar scope normalisasi nama)
- **Ketidakcocokan satuan:** card memakai gram/lembar/cm untuk *pemakaian*, sedang master pakai satuan stok (crt/pack/kg). Contoh: MAYONES master = `crt`, card = `gram`. Saat menyusun `resep_item.qty_per_porsi`, unit harus direkonsiliasi (konversi crt→gram, pack→lembar, dst). Ini **belum** dikerjakan.
- Master seed di repo = 33 item. Jika DB produksi sudah ditambah item lain via UI, verifikasi ulang sebelum insert `new-bahan-baku.sql` agar tak bentrok `nama UNIQUE`.
