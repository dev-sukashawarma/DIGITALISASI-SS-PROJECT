# Panduan Persiapan Data BOM (Bill of Materials)

Dokumen ini berfungsi sebagai panduan bagi tim operasional dan dapur Suka Shawarma untuk menyusun standar resep (BOM) sebelum diinput ke dalam sistem digital.

> [!IMPORTANT]
> **Mengapa Ini Penting?** 
> Sistem stok kita sekarang sudah terotomatisasi. Jika data BOM yang Anda masukkan di sini akurat, maka selisih pada **Shrinkage Dashboard** akan benar-benar merepresentasikan barang yang hilang/terbuang/dicuri, bukan karena salah takaran di sistem.

---

## Tahap 1: Inventarisasi Master Bahan Baku
Pastikan seluruh komponen penyusun makanan sudah terdaftar di sistem dengan satuan terkecilnya. Jika ada yang belum, harap daftarkan terlebih dahulu di halaman `Master Bahan Baku` pada Admin Dashboard.

**Contoh Ceklist Bahan Pokok:**
| Nama Bahan Baku | Satuan Sistem | Digunakan Untuk Menu Apa? |
| :--- | :--- | :--- |
| Daging Sapi (Raw) | Gram | Shawarma Sapi, Kebab Sapi |
| Daging Ayam (Raw) | Gram | Shawarma Ayam |
| Roti Pita | Pcs | Semua Varian Shawarma |
| Saus X Hot | Crt (Cartridge) | Menu Spicy / Mix |
| Kertas Pembungkus | Pcs | Semua Menu |

---

## Tahap 2: Penentuan "Takaran Pasti" per Porsi (SOP)
Ini adalah tahap paling krusial. Silakan cetak tabel di bawah ini (atau gunakan Excel) dan diskusikan dengan Kepala Dapur (SPV Kitchen). Tetapkan angka pasti mutlak untuk 1 Porsi.

> [!TIP]
> **Cara Menghitung Takaran Sulit:** Jika sulit mengukur 1 porsi (misal Saus), ukurlah dari **total pemakaian**. 
> *Contoh:* 1 Cartridge Saus X Hot biasanya habis untuk 50 porsi Shawarma. Maka takaran 1 porsinya adalah: `1 / 50 = 0.02 Crt`.

### Template Penyusunan Resep (Bisa disalin ke Excel)

**Kategori Menu: SHAWARMA**

| Nama Menu di POS | Nama Bahan Baku Terpakai | Takaran per 1 Porsi | Satuan |
| :--- | :--- | :--- | :--- |
| **Original Mix Reguler** | KULIT 25 | 1 | pack |
| | SAUS X HOT | 0.02 | crt |
| | MAYONES | 0.05 | crt |
| | Kertas Pembungkus | 1 | Pcs |
| **Original Mix Jumbo** | KULIT 25 | 1.5 | pack |
| | SAUS X HOT | 0.04 | crt |
| | MAYONES | 0.08 | crt |
| | Kertas Pembungkus | 1 | Pcs |

---

## Tahap 3: Input ke Sistem Admin
Setelah data di Excel/buku catatan Anda sudah disepakati, satu orang Admin Pusat (atau Owner) akan bertugas memindahkannya ke sistem.

**Langkah Input:**
1. Buka aplikasi **Admin Dashboard**.
2. Masuk ke menu **Laporan & Audit** -> **Manajemen Resep (BOM)**.
3. Cari menu yang ingin diisi (misal: "Shawarma Sapi Reguler"), lalu klik tombol **"Buat Resep"**.
4. Masukkan bahan-bahan sesuai tabel Tahap 2 yang sudah Anda buat.
5. Pastikan tombol sakelar (checkbox) **"Resep Aktif (Memotong Stok)"** dalam keadaan tercentang, lalu tekan **Simpan**.

> [!WARNING]
> Selalu pastikan dapur dilatih (training) untuk memasak **mengikuti pedoman berat/takaran** yang sudah Anda tetapkan di sistem ini. Ketidakpatuhan dapur terhadap takaran (memasak *feeling*) akan menyebabkan peringatan selisih stok warna merah di laporan *Blind Opname*.
