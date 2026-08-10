# Fitur Data Validation Tool (SS Digitalisasi)

## 🎯 Tujuan Utama (Objective)
Fitur ini bertujuan untuk melakukan **rekonsiliasi (pencocokan) data penjualan** secara otomatis. Sistem akan membandingkan jumlah item (Quantity) yang terjual berdasarkan **File Export asli dari platform online** (seperti GoFood, GrabFood, ShopeeFood, TikTok Seller, TikTok GO) dengan data pesanan yang sudah tercatat di dalam **Database internal sistem (Supabase)**. 

Dengan fitur ini, admin dapat dengan cepat melihat jika ada selisih (discrepancy) antara laporan dari platform aplikasi dengan data internal perusahaan.

---

## ⚙️ Cara Kerja Sistem (Workflow)

1. **Pemilihan Parameter:**
   - Admin memilih **Channel** (Platform) penjualan, misalnya: `GrabFood`, `GoFood`, `ShopeeFood`, `TikTok Seller`, atau `TikTok GO`.
   - Admin menentukan rentang tanggal (**Start Date** & **End Date**) untuk data yang ingin dicocokkan.
   
2. **Upload File:**
   - Admin mengunggah file export mentah dari platform tersebut. Sistem mendukung format **CSV** dan **Excel (.xlsx)**.

3. **Proses Parsing File (Client-Side):**
   - Sistem membaca file yang diupload.
   - Sistem secara cerdas mendeteksi kolom yang berisi **Nama Item** (contoh: `Product Name`, `Item name`, `Nama Produk`) dan kolom **Kuantitas** (contoh: `Quantity`, `QTY`, `Jumlah`). 
   - *Catatan:* Untuk platform tertentu seperti TikTok GO yang tidak memiliki kolom QTY, sistem menghitung setiap baris transaksi sebagai 1 QTY.
   - Sistem membersihkan nama item dan memetakannya ke nama standar di database menggunakan **Whitelist / Mapping Rules** (karena penamaan di platform sering berbeda dengan di database).

4. **Pengambilan Data Database (Server-Side):**
   - Berdasarkan Channel dan rentang tanggal yang dipilih, sistem mengambil rekapitulasi data penjualan per menu dari database internal.

5. **Komparasi & Visualisasi:**
   - Sistem menampilkan tabel perbandingan yang berisi:
     - **NAMA MENU**
     - **QTY (FILE EXPORT)**
     - **QTY (DATABASE)**
     - **SELISIH** (QTY File - QTY Database)
   - Tabel dilengkapi dengan filter untuk menampilkan *All Data*, *Match* (Selisih 0), dan *Mismatch* (Ada selisih).

---

## 🛠️ Stack Teknologi
- **Framework:** Next.js (App Router), React, TypeScript.
- **Styling:** Tailwind CSS.
- **Library Parsing:** 
  - `papaparse` (untuk membaca file .csv).
  - `xlsx` (untuk membaca file Excel .xlsx).
- **Database:** Supabase (PostgreSQL).

---

## 🧩 Tantangan & Kompleksitas yang Dihadapi (Konteks Brainstorming)

Untuk membantu agent sebelah dalam brainstorming, berikut adalah beberapa tantangan yang kami hadapi saat mengembangkan fitur ini:

1. **Inkonsistensi Format File Export Antar Platform:**
   - Beberapa platform menggunakan CSV, lainnya menggunakan XLSX.
   - Beberapa platform meletakkan header langsung di baris pertama, sementara yang lain memiliki "Summary Rows" di bagian atas sehingga header tabel baru muncul di baris ke-5 atau lebih (membutuhkan deteksi header otomatis).
   - Nama kolom berbeda-beda (ada yang pakai Bahasa Inggris, ada yang Bahasa Indonesia).

2. **Inkonsistensi Penamaan Menu (Mapping Issue):**
   - Nama menu di aplikasi (contoh: `"SUKA DUO FAVORIT"`) sering kali berbeda sedikit ejaannya dengan di database internal (contoh: `"suka duo favorite"`).
   - Penamaan paket combo yang rumit di platform harus diubah menjadi nama item standar di database.
   - Sistem membutuhkan dictionary mapping khusus per channel (`TIKTOK_GO_NAME_MAP`, `SHOPEEFOOD_NAME_MAP`, dll).

3. **Human Error saat Upload:**
   - Admin terkadang memilih channel A (contoh: TikTok GO) di dropdown, tapi mengunggah file export dari channel B (contoh: TikTok Shop). Sistem harus bisa menangani dan memberikan feedback bahwa file tidak valid atau menghasilkan angka 0 karena nama item tidak ada yang cocok.

---

*Dokumen ini dapat kamu gunakan sebagai prompt/konteks awal untuk berdiskusi dengan AI Agent lain terkait arsitektur, UI/UX, atau peningkatan fitur validasi data ini.*
