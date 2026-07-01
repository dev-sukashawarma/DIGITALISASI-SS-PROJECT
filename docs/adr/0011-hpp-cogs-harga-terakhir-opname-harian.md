# ADR-011 — Model HPP/COGS: opname harian + valuasi harga terakhir + snapshot harga per Order Session

- Status: **Accepted**
- Tanggal: 2026-07-01
- Terkait: CONTEXT.md ("COGS / HPP", "Laba / Pemasukan Bersih", "Harga Bahan Baku", "Order Session"). Membangun di atas fitur **Master Harga Bahan Baku** (`bahan_baku_harga`, tabel harga master admin-only). Prasyarat untuk laporan **Laba presisi** di Owner Dashboard (halaman Profitabilitas). Dipakai oleh **ADR-012** (reorder threshold berbasis nilai stok).

## Konteks

Atasan/owner minta **laporan pemasukan yang presisi = Omzet − HPP** (laba kotor). Saat ini halaman Profitabilitas (`/dashboard/owner/profit`) hanya menghitung `Omzet − Expenses` (biaya operasional manual: sewa, gaji, listrik). **HPP bahan baku belum masuk sama sekali** — ini gap yang membuat laba tidak presisi.

Menghitung HPP butuh dua hal: **(1) berapa bahan terpakai** dan **(2) berharga berapa**. Beberapa kenyataan mengikat desain:

- **Auto-deduction BOM belum aktif.** Pemakaian per penjualan (resep × porsi terjual) = "fase lanjut"; POS Outlet belum transaksi nyata.
- **Opname dilakukan HARIAN per outlet.** Sumber "stok fisik" andal & sering. Namun opname hanya menghasilkan **total qty fisik** per bahan — **bukan** rincian "sisa ini dari batch mana".
- **Harga bahan berubah antar pemesanan.** Contoh nyata: pesan AYAM Senin @Rp36.000/kg, reorder Rabu @Rp40.000/kg.
- **Alur pemesanan:** `permintaan_bahan` → `surat_jalan` (punya `document_number` + tanggal) → verifikasi terima (qty → ledger `terima_kiriman` → stok).

## Keputusan

### 1. Metode perolehan HPP: opname periodik harian

Per outlet, per hari:

```
HPP_hari = nilai(stok awal hari) + nilai(barang masuk hari) − nilai(stok akhir hari)
stok awal hari  = stok akhir hari sebelumnya
```

HPP harian di-roll-up ke mingguan/bulanan di Owner Dashboard. Auto-deduction BOM per penjualan = **target akhir (fase lanjut)**, belum aktif. Proxy "total belanja periode" ditolak (tidak presisi saat menimbun stok).

### 2. Order Session = Surat Jalan; harga di-snapshot saat surat jalan dibuat

Satu **Order Session** = satu **Surat Jalan**. Saat surat jalan dibuat, **harga master terkini di-snapshot** ke tiap itemnya. Nilai barang masuk = `qty terverifikasi × harga snapshot`. Snapshot mengunci "harga hari itu": order Senin memakai harga Senin, reorder Rabu memakai harga Rabu, walau harga master berubah kemudian.

### 3. Valuasi stok akhir: **Metode B — Harga terakhir (last price)**

Stok akhir hasil opname dinilai memakai **harga snapshot Surat Jalan terbaru** untuk bahan itu (per outlet). Tidak memelihara rata-rata bergerak maupun lapisan batch — cukup lookup "harga snapshot terakhir per (outlet, bahan)".

```
nilai stok akhir (per bahan) = qty_opname × harga_snapshot_terakhir
```

**Contoh (AYAM, kg)** — snapshot Senin @36.000, Rabu @40.000; opname Senin 8 kg, Selasa 2 kg, Rabu 7 kg:

| Hari | Stok awal (nilai) | Barang masuk | Opname akhir | Harga dasar (terakhir) | Nilai stok akhir | HPP hari |
|---|--|--|--|--|--|--|
| Senin | 0 kg (0) | 30 kg @36.000 = 1.080.000 | 8 kg | 36.000 | 288.000 | **792.000** |
| Selasa | 8 kg (288.000) | — | 2 kg | 36.000 | 72.000 | **216.000** |
| Rabu | 2 kg (72.000) | 30 kg @40.000 = 1.200.000 | 7 kg | **40.000** | 280.000 | **992.000** |

HPP minggu AYAM = **2.000.000**.

## Metode valuasi yang dipertimbangkan (untuk rekam jejak)

Tiga metode dibahas; **B dipilih** demi kesederhanaan implementasi. A & C tidak dipilih.

### A — Rata-rata bergerak (weighted moving average) — TIDAK dipilih
Simpan `qty` + `avg_cost` berjalan per (outlet, bahan); tiap barang masuk: `avg_baru = (qty_lama×avg_lama + qty_masuk×harga_snapshot)/(qty_lama+qty_masuk)`. Di contoh AYAM, Rabu avg = 39.750 (sisa 2 kg murah melebur), HPP minggu 2.001.750.
- **Pro:** paling presisi saat harga fluktuatif; konsisten lintas hari.
- **Kontra:** perlu memelihara state `avg_cost` yang selalu sinkron dengan ledger; koreksi retro harus hitung ulang.

### C — FIFO (batch layer) — TIDAK dipilih
Lacak lapisan batch; sisa = batch termuda.
- **Pro:** paling akurat secara teori.
- **Kontra:** butuh tahu "sisa dari batch mana" — opname cuma total qty, jadi tetap asumsi; berat (lapisan batch + logika deplesi + rekonsiliasi).

### Kenapa B dipilih
- **Paling sederhana:** tak ada state `avg_cost`/batch untuk dijaga — cukup snapshot harga per surat jalan (yang memang sudah diperlukan) + ambil yang terbaru per bahan.
- **Cukup untuk kebutuhan sekarang:** selisih vs A di kasus normal kecil (~Rp1.750/minggu/bahan di contoh AYAM).
- **Trade-off yang diterima:** B kurang presisi saat harga naik-turun tajam & stok sisa lama besar (sisa lama dinilai di harga terbaru). Bila kelak terbukti mengganggu, bisa naik ke A (rata-rata bergerak) tanpa mengubah metode perolehan HPP (opname harian) maupun snapshot Order Session — hanya mengganti cara menilai stok akhir.

> Catatan: rekomendasi awal penulis adalah A (rata-rata bergerak) demi presisi; owner memilih **B** demi kesederhanaan. Keputusan ini sengaja dicatat agar konteksnya jelas bila di masa depan dipertimbangkan untuk naik ke A.

## Alternatif metode perolehan HPP yang ditolak

- **Auto-deduction BOM per penjualan (paling akurat)** — butuh POS Outlet live + resep lengkap; belum ada. Ditunda, bukan dibuang.
- **Proxy belanja periode** — gampang tapi tidak presisi (menimbun stok → HPP melonjak padahal belum terjual).
- **HPP baca harga master `bahan_baku_harga` langsung (tanpa snapshot)** — HPP historis berubah tiap harga master di-update. Snapshot per Order Session memutus ketergantungan ini.

## Konsekuensi

- (+) **Implementasi paling ringan:** tak ada state valuasi berjalan; nilai stok = qty opname × harga snapshot terbaru.
- (+) Cocok dengan data yang ada: opname harian (total qty) + surat jalan + harga snapshot.
- (+) Jalur ke fase lanjut jelas (auto-deduction) & jalur upgrade valuasi ke A jelas bila diperlukan.
- (−) **Kurang presisi saat harga fluktuatif** dan stok sisa lama besar (sisa lama dinilai di harga terbaru) — trade-off yang diterima owner.
- (−) Bergantung disiplin opname harian; hari tanpa opname → HPP harian bolong (perlu kebijakan fallback).
- (−) Butuh snapshot harga di skema surat jalan (kolom harga per item).

## Belum diputuskan (di luar ADR ini)

- Kebijakan fallback bila opname harian terlewat.
- Lokasi implementasi (skema `surat_jalan_item` vs tabel valuasi terpisah) — level spec.
- Threshold & kode unik per pesanan (topik terpisah; threshold di ADR-012).
