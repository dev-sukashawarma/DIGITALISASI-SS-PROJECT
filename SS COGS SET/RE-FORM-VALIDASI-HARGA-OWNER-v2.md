# Form Validasi Bahan, Satuan, dan Harga Terupdate (Untuk Owner)

Dokumen ini dibuat agar Owner dapat memvalidasi langsung satuan pembelian, satuan pemakaian di resep, angka konversi, sumber harga, dan **harga beli terbaru** dari masing-masing bahan baku. Data ini akan menjadi dasar perhitungan COGS dan pemotongan stok otomatis (BOM) serta pelaporan keuangan (Opname).

**Instruksi untuk Owner:**
1. Mohon periksa kolom **Satuan Pembelian**, **Satuan Terkecil**, dan **Faktor Konversi**. Jika ada yang kurang tepat, silakan dicoret/diganti di kolom Catatan.
2. Mohon isi kolom **Harga Terupdate (Rp)** dengan harga beli aktual saat ini untuk 1 Satuan Pembelian.
3. Mohon isi kolom **Supplier** — jika ada lebih dari satu supplier untuk 1 bahan, tulis semua dan tandai mana yang jadi acuan harga.
4. Mohon isi kolom **Berlaku Sejak** dengan tanggal harga ini mulai berlaku (untuk keperluan riwayat harga/audit).
5. Beri tanda ✅ di kolom Catatan jika baris tersebut sudah benar semua.
6. Untuk bahan bertanda ⚠️ di kolom Catatan, mohon perhatian khusus — ada catatan tambahan dari tim finance yang perlu dikonfirmasi Owner.

**Library Satuan (Standar Sistem):**
Berikut adalah daftar satuan baku yang saat ini dikenali oleh sistem Suka Shawarma:
- **Berat / Massa:** `kg`, `gram`
- **Volume / Cairan:** `kompan`, `liter`
- **Satuan Lepas:** `pcs`, `lembar`, `crt` (karton/dus), `pack`, `cm` (centimeter untuk foil/kertas panjang)
*(Mohon merujuk ke satuan di atas apabila ingin mengubah satuan pada Catatan agar sesuai dengan sistem database)*

---

## 1. Item Core (Bahan Utama Resep Aktif)

| Nama Bahan | Satuan Pembelian (Stok) | Satuan Terkecil (Resep) | Faktor Konversi (1 Stok = ?) | Supplier | Harga Terupdate (Rp) | Berlaku Sejak | Catatan Owner / Revisi |
|---|---|---|---|---|---|---|---|
| AYAM | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| SAPI | pcs (blok) | gram | 2.000 | ............... | Rp ............... | .......... | ⚠️ Faktor konversi di-fix 2.000 gram/blok — mohon konfirmasi apakah berat blok aktual konsisten, atau perlu ditimbang ulang tiap kedatangan (rawan deviasi HPP) |
| KULIT 25 | pack | lembar | 20 | ............... | Rp ............... | .......... | |
| KULIT 28 | pack | lembar | 20 | ............... | Rp ............... | .......... | |
| KULIT 32 | pack | lembar | 20 | ............... | Rp ............... | .......... | |
| TUM | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| KENTANG | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| LETTUCE | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| TEPUNG | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| KEJU | crt | lembar | 240 | ............... | Rp ............... | .......... | |
| MIE | pcs | pcs | 1 | ............... | Rp ............... | .......... | |
| POWDER MIX | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| ES BATU | pcs | pcs | 1 | ............... | Rp ............... | .......... | |

---

## 2. Bumbu & Saos

| Nama Bahan | Satuan Pembelian (Stok) | Satuan Terkecil (Resep) | Faktor Konversi (1 Stok = ?) | Supplier | Harga Terupdate (Rp) | Berlaku Sejak | Catatan Owner / Revisi |
|---|---|---|---|---|---|---|---|
| SAOS CABE | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| MAYONES | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| SAOS SAMYANG | kg | gram | 1.000 | ............... | Rp ............... | .......... | |
| BAWANG | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — mohon konfirmasi: sudah dipakai operasional tapi belum di-mapping ke BOM, atau memang belum digunakan?)* |
| SASA | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |
| GARAM | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |
| KUNYIT | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |
| KETUMBAR | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |
| KAYU MANIS | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |
| JINTEN | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |
| CENGKEH | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |
| SAOS TOMAT | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — sama seperti di atas)* |

---

## 3. Minuman & Lain-lain

| Nama Bahan | Satuan Pembelian (Stok) | Satuan Terkecil (Resep) | Faktor Konversi (1 Stok = ?) | Supplier | Harga Terupdate (Rp) | Berlaku Sejak | Catatan Owner / Revisi |
|---|---|---|---|---|---|---|---|
| MINYAK SAYUR | kompan | gram | 16.000 | ............... | Rp ............... | .......... | |
| GAS 3Kg | pcs | gram | 3.000 | ............... | Rp ............... | .......... | ⚠️ Saat ini faktor konversi pakai basis gram (berat isi tabung). Mohon konfirmasi apakah tim outlet mengukur pemakaian gas per gram secara akurat, atau lebih realistis pakai basis **porsi per tabung** (isi kemasan = jumlah porsi bisa dimasak/tabung) seperti di kalkulator COGS |
| SABUN | ......... | ......... | ......... | ............... | Rp ............... | .......... | *(Operasional)* |
| SARUNG TANGAN BENI | ......... | ......... | ......... | ............... | Rp ............... | .......... | *(Operasional)* |
| KERTAS STRUK | ......... | ......... | ......... | ............... | Rp ............... | .......... | *(Operasional)* |

---

## 4. Kemasan (Packaging)

| Nama Bahan | Satuan Pembelian (Stok) | Satuan Terkecil (Resep) | Faktor Konversi (1 Stok = ?) | Supplier | Harga Terupdate (Rp) | Berlaku Sejak | Catatan Owner / Revisi |
|---|---|---|---|---|---|---|---|
| PAPER WRAP | pcs | lembar | 1 | ............... | Rp ............... | .......... | |
| PLASTIK MERAH | pcs | lembar | 1 | ............... | Rp ............... | .......... | |
| FOIL | pcs (roll) | cm | 760 | ............... | Rp ............... | .......... | |
| CUP + TUTUP | pcs | pcs | 1 | ............... | Rp ............... | .......... | |
| STIKER | pcs | lembar | 1 | ............... | Rp ............... | .......... | |
| PLASTIK VACUM | pcs | lembar | 1 | ............... | Rp ............... | .......... | |
| DUS PACKING | pcs | lembar | 1 | ............... | Rp ............... | .......... | |
| POLYBAG | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — mohon konfirmasi)* |
| PLASTIK BESAR | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — mohon konfirmasi)* |
| PLASTIK KECIL | ......... | ......... | ......... | ............... | Rp ............... | .......... | ⚠️ *(Belum masuk resep — mohon konfirmasi)* |

---

## Catatan Tambahan untuk Tim Finance (Internal — hapus sebelum dikirim ke Owner jika perlu)

1. **Faktor konversi mengasumsikan yield 100%** — belum ada allowance untuk waste/shrinkage (trimming AYAM, sobekan KULIT, dll). Ini perlu dicek terpisah dari validasi harga, karena bisa jadi kontributor ke isu HPP overstatement yang sedang di-investigate.
2. **Riwayat harga**: kolom "Berlaku Sejak" penting dipertahankan di sistem (bukan cuma di form ini) untuk audit trail investor due diligence — pastikan field ini juga ada di database, bukan cuma di form kertas.
3. Item dengan status "Belum masuk resep" sebaiknya di-follow-up terpisah dengan tim ops/kitchen untuk konfirmasi pemakaian aktual di lapangan sebelum di-input ke BOM.

---
*Dokumen direvisi pada: 8 Juli 2026*
