# Panduan Satuan Distribusi (Distribution Units)

Dokumen ini menjelaskan tentang implementasi **Satuan Distribusi** yang digunakan untuk menjembatani komunikasi antara **Outlet (SPV/Kitchen)** dan **Gudang Pusat (Logistik)** tanpa merusak integritas *Ledger Stok / COGS* yang berbasis **Satuan Besar**.

## 1. Konsep Dasar
- **Satuan Besar (Base Unit):** Satuan paten di database (`bahan_baku.satuan`) yang digunakan untuk menghitung nilai aset (COGS) dan menyimpan riwayat mutasi (Ledger). Contoh: `Dus`, `Karton`, `Blok`.
- **Satuan Terkecil (Small Unit):** Satuan yang mutlak digunakan untuk **Resep (BOM)**. Contoh: `Gram`, `Lembar`, `ml`.
- **Satuan Distribusi:** Satuan alias/tengah yang digunakan oleh manusia (Gudang & SPV) untuk bertransaksi harian agar tidak pusing dengan angka desimal kardus. Contoh: `Pack`, `Kg`.

## 2. Cara Kerja Konversi (UI-Side Conversion)
Seluruh konversi terjadi secara *on-the-fly* di sisi Frontend (Aplikasi) agar Database tetap bersih.

1. **Permintaan (Outlet) & Approval (SPV):**
   - Layar menampilkan `satuan_distribusi`.
   - Jika SPV input **"2 Kg Kentang"**, aplikasi tahu bahwa 1 Karton = 4 Kg.
   - Aplikasi membagi `2 / 4 = 0.5 Karton`.
   - Yang **disimpan di tabel** `permintaan_item` adalah `0.5` (Base Unit).

2. **Surat Jalan (Gudang Pusat):**
   - Aplikasi Gudang membaca `0.5 Karton` dari database.
   - Layar Gudang mengalikannya kembali `0.5 x 4 = 2 Kg`. Gudang melihat **"2 Kg Kentang"**.
   - Gudang input persetujuan pengiriman `2` (Kg), lalu aplikasi mengubahnya lagi menjadi `0.5` sebelum menyimpan ke `surat_jalan_item`.

3. **Penerimaan & Saldo Fisik (Outlet):**
   - Outlet melihat barang tiba sebesar `0.5 Karton`.
   - Fungsi formatter aplikasi akan merendernya dengan cantik menjadi teks: **"0 Karton + 2 Kg"**.

## 3. Daftar Satuan Khusus (Telah Dikonfigurasi)
Daftar bahan baku yang menggunakan Satuan Distribusi khusus:
* *SAOS CABE (Kg)*
* *SAOS TOMAT (Kg)*
* *SAOS SAMYANG (Kg)*
* *MAYONAISE (Kg)*
* *KULIT 25 (Pack)*
* *KULIT 28 (Pack)*
* *KULIT 32 (Pack)*
* *AYAM (Kg)*
* *SAPI (Blok)*
* *KENTANG (Kg)*
* *KEJU (Pack)*
* *TUM (Kg)*
* *BAWANG (Kg)*
* *TEPUNG (Kg)*
* *MINYAK SAYUR (Kompan)*
* *FOIL (Roll)*
* *SARUNG TANGAN BENING (Pack)*
* *KERTAS STRUK (Roll)*
* *PLASTIK BESAR (Pack)*
* *PLASTIK KECIL (Pack)*
* *POLYBAG (Pack)*
* *PLASTIK MERAH (Pack)*
* *PAPER WRAP (Pack)*
* *POWDER TEH (Kg)*
* *POWDER JERUK (Kg)*
* *CUP + TUTUP (Pcs)*
* *SEDOTAN (Pack)*
* *STIKER (Lembar)*
* *MIE (Bungkus)*
* *LETTUCE (Kg)*
* *ES BATU (Bal)*

*(Catatan: Bahan baku di luar daftar di atas akan otomatis menggunakan **Satuan Besar** sebagai fallback).*

## 4. SOP Perubahan Ukuran Kemasan
**DILARANG KERAS** mengubah nilai faktor konversi (`faktor_tengah` atau `faktor_tampilan`) pada item bahan baku yang sudah berjalan transaksinya, karena akan **merusak pembacaan data historis (riwayat lama)**.

**SOP yang benar:**
Jika Supplier mengubah kemasan (Misal Mayonnaise dari 12 Kg menjadi 10 Kg per Dus):
1. Ubah status item Mayonnaise lama menjadi non-aktif (`is_active = false`).
2. Buat Master Item baru (Misal: "Mayonnaise (Karton 10Kg)") dengan perhitungan faktor yang baru.
