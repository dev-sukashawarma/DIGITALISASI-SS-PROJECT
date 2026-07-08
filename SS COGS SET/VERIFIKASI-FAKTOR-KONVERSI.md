# Verifikasi Faktor Konversi Bahan Baku — Tahap C

Dokumen ini merangkum **semua bahan baku yang dipakai di 21 resep**, satuan stoknya, dan faktor konversi ke satuan resep (gram/lembar/cm/pcs). Ini dasar perhitungan sebelum sistem potong-stok-otomatis (BOM automation) diaktifkan. Mohon direview ulang sebelum simulasi & aktivasi.

## Definisi
`faktor_konversi` = **berapa satuan-pakai (dipakai di resep) setara dengan 1 satuan-stok (dibeli/dicatat gudang)**.
Contoh: AYAM satuan stok = kg, dipakai di resep dalam gram → faktor_konversi = 1000 (1 kg = 1000 gram).

Rumus potong stok nanti: `qty_potong (satuan stok) = qty_resep (satuan pakai) × jumlah_terjual ÷ faktor_konversi`

---

## Tabel lengkap — 25 bahan yang dipakai di resep

| Bahan | Satuan stok | Satuan pakai (resep) | Faktor konversi | Sumber angka | Status |
|---|---|---|---|---|---|
| AYAM | kg | gram | 1.000 | Konversi metrik standar (1kg=1000g) | ✅ Pasti |
| SAPI | pcs | gram | 2.000 | **Owner**: 1 pcs (blok) = 2 kg | ✅ Dikonfirmasi |
| KULIT 25 | pack | lembar | 20 | **Owner**: 1 pack = 20 lembar | ✅ Dikonfirmasi |
| KULIT 28 | pack | lembar | 20 | **Owner**: 1 pack = 20 lembar | ✅ Dikonfirmasi |
| KULIT 32 | pack | lembar | 20 | **Owner**: 1 pack = 20 lembar | ✅ Dikonfirmasi |
| SAOS CABE | **kg** (diubah dari crt) | gram | 1.000 | Konversi metrik + owner (kemasan variabel, dicatat per kg aktual) | ✅ Dikonfirmasi |
| MAYONES | **kg** (diubah dari crt) | gram | 1.000 | Konversi metrik + owner ("sama kaya saos", kemasan variabel) | ✅ Dikonfirmasi |
| TUM | kg | gram | 1.000 | Konversi metrik standar | ✅ Pasti |
| MINYAK SAYUR | kompan | gram | 16.000 | **Owner**: 1 kompan = 16 liter; asumsi densitas 1L≈1kg **dikonfirmasi owner OK** | ✅ Dikonfirmasi |
| KENTANG | **kg** (diubah dari pack) | gram | 1.000 | Konversi metrik + owner (kemasan variabel 1kg/2,5kg, dicatat per kg aktual) | ✅ Dikonfirmasi |
| PAPER WRAP | pcs | lembar | 1 | 1:1 (1 pcs = 1 lembar) | ✅ Pasti |
| PLASTIK MERAH | **pcs** (diubah dari pack) | lembar | 1 | Owner (kemasan pack variabel 20/50 lembar, dicatat per lembar) | ✅ Dikonfirmasi |
| GAS 3Kg | pcs | gram | 3.000 | **Owner konfirmasi**: sesuai nama, 1 tabung = 3000 gram | ✅ Dikonfirmasi |
| FOIL | **pcs** (diubah dari crt, mewakili 1 roll) | cm | 760 | **Owner**: per-roll tetap 30cm × 7,6m; karton (24/48 roll) variabel → dihitung per-roll | ✅ Dikonfirmasi |
| LETTUCE | kg | gram | 1.000 | Konversi metrik standar | ✅ Pasti |
| TEPUNG | kg | gram | 1.000 | Konversi metrik standar | ✅ Pasti |
| KEJU | crt | lembar | 240 | **Owner**: 1 karton = 24 pack × 10 slice = 240 lembar | ✅ Dikonfirmasi |
| MIE | pcs | pcs | 1 | 1:1 | ✅ Pasti |
| POWDER MIX | kg | gram | 1.000 | Konversi metrik standar | ✅ Pasti |
| CUP + TUTUP | pcs | pcs | 1 | 1:1 | ✅ Pasti |
| STIKER | pcs | lembar | 1 | 1:1 | ✅ Pasti |
| ES BATU | pcs | pcs | 1 | 1:1 (1 pcs = 1 balok es, asumsi dari kemasan 62pcs/box tapi dipakai satuan pcs individual) | ✅ Pasti |
| PLASTIK VACUM | pcs | lembar | 1 | 1:1 | ✅ Pasti |
| DUS PACKING | pcs | lembar | 1 | 1:1 | ✅ Pasti |
| SAOS SAMYANG | **kg** (diubah dari crt) | gram | 1.000 | Konversi metrik + owner (koreksi: kemasan ternyata variabel jg — pouch besar 1kg/kecil 250g) | ✅ Dikonfirmasi |

**Semua 25 bahan yang dipakai di resep = terkonfirmasi / pasti. Tidak ada asumsi tersisa untuk item yang aktif dipakai.**

---

## Bahan lain (belum dipakai resep saat ini) — faktor default 1
Berdasarkan sistem kategori yang baru, bahan-bahan ini dikelompokkan sebagai berikut:

- 🌶️ **Bumbu**: BAWANG, SASA, GARAM, KUNYIT, KETUMBAR, KAYU MANIS, JINTEN, CENGKEH, SAOS TOMAT
- 📦 **Kemasan**: POLYBAG, PLASTIK BESAR, PLASTIK KECIL
- 📋 **Lainnya**: SARUNG TANGAN BENI, KERTAS STRUK, SABUN

> Faktor 1 di sini **bukan berarti benar** — hanya karena belum ada resep yang memakainya, jadi belum ada urgensi dihitung. **WAJIB diisi dengan angka benar** sebelum bahan-bahan ini dipakai di resep baru nanti.

---

## Riwayat perubahan satuan (bukan cuma tambah kolom, tapi ubah tipe kemasan yang dicatat)
4 bahan **existing** (sudah ada sebelum kerjaan COGS ini) satuannya diubah karena kemasan dari supplier tidak konsisten:

| Bahan | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| PLASTIK MERAH | pack | pcs | Isi pack tidak tetap (20/50 lembar), harga per lembar tetap |
| SAOS CABE | crt | kg | Kemasan kadang kompan (5,5kg) kadang pouch (1kg) |
| KENTANG | pack | kg | Kemasan kadang 1kg kadang 2,5kg |
| MAYONES | crt | kg | Sama pola dgn saus (kompan/pouch variabel) |
| SAOS SAMYANG | crt | kg | Awalnya dikira tetap, ternyata pouch besar 1kg / kecil 250g |
| FOIL | crt | pcs (mewakili 1 roll) | Karton variabel (24/48 roll), tapi per-roll tetap (760cm) |

**Konsekuensi operasional:** staff outlet yang input surat jalan/opname untuk 6 bahan ini **perlu tahu** satuan pencatatan sudah berubah — misalnya PLASTIK MERAH sekarang dihitung per lembar, bukan per pack. Kalau ada SOP/pelatihan input stok, perlu diperbarui.

---

## Checklist konfirmasi akhir sebelum simulasi

- [ ] Semua 25 baris di tabel atas **sudah benar** (tidak ada yang perlu dikoreksi lagi)
- [ ] Staff outlet sudah/akan diberi tahu perubahan satuan pencatatan untuk 6 bahan di atas
- [ ] Setuju lanjut ke tahap **simulasi** (hitung manual pakai rumus yang sama, TANPA menyentuh order asli) sebelum trigger diaktifkan

---

*Dibuat: 2026-07-04 — bagian dari Tahap C (unit reconciliation) sebelum aktivasi BOM automation trigger.*
