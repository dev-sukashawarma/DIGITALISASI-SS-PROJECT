# Rekonsiliasi Satuan — Resep (pemakaian) vs `bahan_baku.satuan` (stok)

**Masalah inti:** kartu COGS mencatat pemakaian dalam **gram/lembar/cm/pcs**, sedangkan master `bahan_baku.satuan` memakai **satuan stok** (kg/pack/crt/pcs/kompan). Trigger `bom_automation` (`trg_process_bom_stok`) memotong `qty_per_porsi * quantity` **langsung ke `ledger_stok` tanpa konversi**.

**Keputusan:** `resep-seed.sql` menyimpan `qty_per_porsi` dalam **satuan pemakaian asli** (paling faithful terhadap resep). Konversi ke satuan stok **belum** diterapkan — lihat tabel di bawah.

## ⚠️ WAJIB sebelum mengaktifkan auto-deduct
Pastikan **satuan `ledger_stok`/opname/surat jalan == satuan `resep_item`**, atau tambahkan layer konversi. Kalau stok dicatat dalam `kg` tapi resep memotong `100` (gram), stok akan terpotong 100 kg — salah 1000×.

Dua opsi:
1. **Samakan resep ke satuan stok** — ubah `qty_per_porsi` pakai faktor kolom "Konversi" (mis. AYAM 100 gram → 0,1 kg).
2. **Samakan stok ke satuan pemakaian** — ubah `bahan_baku.satuan` (mis. AYAM → gram) dan pastikan surat jalan/opname ikut.

## Tabel konversi (usage → stok)

| bahan_baku.nama | satuan stok | satuan pemakaian (card) | Konversi (1 satuan stok = ?) |
|---|---|---|---|
| AYAM | kg | gram | 1 kg = 1000 gram |
| CUP + TUTUP | pcs | pcs | 1 pcs = 1 pcs |
| DUS PACKING | pcs | lembar | 1 pcs = 1 lembar |
| ES BATU | pcs | pcs | 1 pcs = 1 pcs (kemasan 62 pcs) |
| FOIL | crt | cm | 1 crt = 750 cm |
| GAS 3Kg | pcs | gram | 1 pcs = 3000 gram |
| KEJU | crt | lembar | 1 crt = 10 lembar |
| KENTANG | pack | gram | 1 pack = 1000 gram |
| KULIT 25 | pack | lembar | 1 pack = 20 lembar |
| KULIT 28 | pack | lembar | 1 pack = 20 lembar |
| KULIT 32 | pack | lembar | 1 pack = 20 lembar |
| LETTUCE | kg | gram | 1 kg = 1000 gram |
| MAYONES | crt | gram | **1 pouch = 1 kg** (konfirmasi owner 2026-07-04) |
| MIE | pcs | pcs | 1 pcs = 1 pcs |
| MINYAK SAYUR | kompan | gram | **1 kompan = 16 liter** (konfirmasi owner 2026-07-04) |
| PAPER WRAP | pcs | lembar | 1 pcs = 1 lembar |
| PLASTIK MERAH | **pcs** (diubah dari pack; DB tak izinkan "lembar" — lihat catatan) | lembar | **1:1** — disetujui owner 2026-07-04, satuan stok diubah ke pcs (=1 lembar) |
| PLASTIK VACUM | pcs | lembar | 1 pcs = 1 lembar |
| POWDER MIX | kg | gram | 1 kg = 1000 gram |
| SAOS SAMYANG | crt | gram | **Kemasan TETAP** (dikonfirmasi owner 2026-07-04, tidak seperti SAOS CABE) — perlu angka isi 1 crt (masih diasumsikan 1000 gram, mohon dipastikan) |
| SAPI | pcs | gram | 1 pcs = 2000 gram |
| SAOS CABE | **kg** (diubah dari crt) | gram | **1:1** (gram/1000) — disetujui owner 2026-07-04, satuan stok diubah ke kg karena kemasan datang tidak tetap (kompan 5,5kg / pouch 1kg) |
| STIKER | pcs | lembar | 1 pcs = 1 lembar |
| TEPUNG | kg | gram | 1 kg = 1000 gram |
| TUM | kg | gram | 1 kg = 1000 gram |

## ✅ Terkonfirmasi owner (2026-07-04)
- **MINYAK SAYUR** — 1 kompan = **16 liter**. Faktor konversi resep→stok: `qty_gram_resep / 1000 (asumsi densitas ≈ air, cek ke supplier bila perlu presisi lebih) / 16` per porsi terhadap 1 kompan. *(Catatan: minyak biasa dijual per liter/kg hampir 1:1, tapi kalau ada densitas resmi dari supplier sebaiknya dipakai, bukan asumsi 1L≈1kg.)*
- **MAYONES** — 1 pouch = **1 kg**. Konversi: `qty_gram_resep / 1000` per pouch.

## ✅ Keputusan owner (2026-07-04, putaran 2)
1. **SAOS CABE** — `bahan_baku.satuan` diubah dari `crt` → **`kg`**. Stok dicatat berdasarkan berat aktual (kg) yang diterima, apapun kemasannya (kompan 5,5kg atau pouch 1kg) — **disetujui**.
2. **SAOS SAMYANG** — kemasannya **TETAP** (bukan variabel seperti SAOS CABE). Satuan stok `crt` **tidak diubah**. Ukuran pasti 1 crt masih diasumsikan 1000 gram (belum dikonfirmasi eksplisit) — lihat catatan.
3. **PLASTIK MERAH** — `bahan_baku.satuan` diubah dari `pack` → **`pcs`** (1 pcs = 1 lembar; DB tidak mengizinkan nilai "lembar" karena CHECK constraint kolom `satuan` hanya izinkan kg/gram/liter/ml/pcs/box/pack/ikat/botol/crt/kompan). Stok dicatat per-lembar langsung (cocok dengan qty resep, tanpa konversi) — **disetujui**. SQL: `update-plastik-merah-satuan.sql`.

## Catatan lain
- `SAPI` — 1 pcs = 2000 gram (blok 2 kg) sesuai isi kemasan card.
- `ES BATU` — dibeli 62 pcs/kemasan (Rp25.000), tapi satuan stok = pcs; pemakaian 1 pcs → resep 1 pcs (bukan 1/62).
- `SAOS SAMYANG` — kemasan tetap (dikonfirmasi), tapi ukuran pasti 1 crt = ? gram masih **asumsi 1000 gram**, belum ada angka resmi dari owner.
