# Satuan Majemuk untuk Tampilan Stok (MINYAK SAYUR & FOIL)

**Status:** Approved
**Tanggal:** 2026-07-04
**Konteks:** Lanjutan sesi COGS/BOM Automation (2026-07-04). Lihat memory `cogs-bom-automation-2026-07-04`.

## Masalah

Setelah aktivasi BOM automation, beberapa bahan baku (MINYAK SAYUR: satuan `kompan`, faktor konversi 16.000 gram/kompan; FOIL: satuan `pcs` mewakili 1 roll, faktor konversi 760 cm/roll) menampilkan saldo/qty dalam desimal yang tidak intuitif, mis. `2.5 kompan` atau `-0.03 pcs`. Staff outlet berpikir dalam satuan fisik yang bisa mereka hitung langsung (jumlah kompan utuh + sisa dalam liter; jumlah roll utuh + sisa dalam cm), bukan pecahan desimal dari satuan stok.

Masalah ini juga menyentuh input opname: crew kesulitan mengukur presisi sisa stok dalam satuan kecil (kg/liter) sehingga cenderung membulatkan ke angka "enak" (mis. bulat 1,5 kg padahal sisa asli 1,2 kg). Solusi penuh untuk masalah pembulatan opname secara umum (semua bahan) **di luar scope sesi ini** — dicatat sebagai backlog. Sesi ini fokus pada MINYAK SAYUR & FOIL, di mana form input dua-field (kontainer utuh + sisa) sudah membantu signifikan karena crew menghitung per-kontainer yang mereka lihat langsung.

## Solusi

### 1. Data model
Tambah 2 kolom nullable di `bahan_baku` (migration baru):
- `satuan_kecil` (text, nullable) — satuan kecil untuk tampilan, mis. `liter`, `cm`. CHECK longgar ke set `('liter','ml','gram','cm','lembar')`.
- `faktor_tampilan` (numeric, nullable) — berapa `satuan_kecil` setara 1 `satuan` (satuan stok utama). MINYAK SAYUR: 16 (liter/kompan). FOIL: 760 (cm/roll).

Kolom ini **independen** dari `faktor_konversi` yang sudah ada (dipakai BOM automation untuk hitung potong stok dalam satuan resep — gram/cm). Pemisahan ini penting karena untuk MINYAK SAYUR, satuan resep (gram, via asumsi densitas 1L≈1kg) berbeda dari satuan tampilan yang diinginkan (liter, satuan fisik yang dipahami crew).

Migration seed nilai untuk 2 bahan ini saja. Kolom tetap nullable — bahan lain bisa menyusul kapan saja tanpa migration baru.

### 2. Aturan format tampilan
Dua konteks berbeda, format berbeda:
- **Saldo/stok tersisa** (`saldo_sebelum`, `saldo_sesudah` di ledger; angka stok di monitoring) → format majemuk: `whole = floor(qty)` satuan besar + `remainder = (qty - whole) * faktor_tampilan` satuan kecil. Contoh: `2.5 kompan` → `"2 kompan + 8 liter"`.
- **Qty pergerakan** (baris ledger individual — biasanya kecil, hasil BOM automation) → tampil dalam satuan kecil saja: `qty * faktor_tampilan` dengan label `satuan_kecil`. Contoh: `-0.03 kompan` → `"-480 ml"` (pembulatan wajar, 2 desimal cukup).
- Bahan tanpa `satuan_kecil`/`faktor_tampilan` (semua bahan lain) → tampilan tidak berubah dari sekarang (qty + `satuan` apa adanya).

Dua fungsi murni baru (unit-testable):
- `formatCompositeSaldo(qty, satuan, satuanKecil, faktorTampilan): string`
- `formatCompositeDelta(qty, satuan, satuanKecil, faktorTampilan): string`

Ditaruh di `apps/stok/src/lib/format/compositeUnit.ts` (baru).

### 3. Input opname — form dua-field
Untuk bahan dengan `satuan_kecil` terisi, form input opname (`apps/stok/src/components/stok/...` — form opname item) diganti jadi 2 field:
- `Jumlah {satuan} penuh` — integer ≥ 0
- `Sisa (perkiraan {satuan_kecil})` — angka ≥ 0, divalidasi harus `< faktor_tampilan` (kalau ≥, berarti seharusnya nambah 1 unit besar; tampilkan pesan validasi, jangan auto-koreksi diam-diam)

Sebelum submit, digabung jadi satu `qty_fisik` desimal: `containers + remainder / faktor_tampilan`. Skema `opname_item` **tidak berubah** — hanya UI input & konversi sebelum submit.

Fungsi murni baru: `combineOpnameInput(containers, remainder, faktorTampilan): number` di file yang sama.

Bahan tanpa `satuan_kecil` tetap pakai 1 field desimal seperti sekarang (tidak ada regresi).

### 4. Cakupan halaman
- **Ledger** — `LedgerList.tsx` (qty pergerakan → format delta) dan `LedgerDetail.tsx` (saldo_sebelum/sesudah → format saldo).
- **Monitoring stok** — papan monitoring-live & detail item outlet: stok saat ini → format saldo.
- **Opname** — form input item: dua-field khusus untuk bahan bersatuan kecil.

### 5. Error handling & edge case
- `qty` negatif kecil (delta pengurangan) → format delta tetap jalan, tanda minus dipertahankan di satuan kecil.
- `qty` saldo negatif (seharusnya tidak terjadi di operasi normal, tapi mungkin muncul dari data kotor) → `formatCompositeSaldo` tetap hitung floor secara matematis benar (mis. `-0.5` → `whole=-1, remainder=8` secara matematis) — TIDAK perlu ditangani khusus, ini kasus data-quality yang sudah di luar cakupan fitur ini.
- `faktor_tampilan` diisi tapi bernilai 0 atau `satuan_kecil` null sementara `faktor_tampilan` terisi (atau sebaliknya) → guard di formatter: kalau salah satu kosong, fallback ke tampilan lama (qty + satuan). Tidak perlu CHECK constraint DB untuk pasangan ini (kolom independen, tapi query yang perlu keduanya harus null-safe).

### 6. Testing
Unit test (vitest) untuk:
- `formatCompositeSaldo` — pas, sisa 0, sisa mendekati faktor_tampilan, saldo negatif, tanpa satuan_kecil (fallback).
- `formatCompositeDelta` — qty kecil positif/negatif, tanpa satuan_kecil (fallback).
- `combineOpnameInput` — kombinasi valid, remainder = 0, remainder mendekati batas.
- Validasi form: remainder ≥ faktor_tampilan harus ditolak dengan pesan jelas.

## Non-goals (sesi ini)
- Solusi umum untuk pembulatan opname di semua bahan (kasus SAPI) — backlog terpisah.
- Rollout `satuan_kecil` ke bahan lain (KULIT, KEJU, dll) — bisa menyusul kapan saja karena kolom nullable, tapi tidak dikerjakan sesi ini.
- Perubahan pada `faktor_konversi` / logika BOM automation — sepenuhnya tidak tersentuh.
