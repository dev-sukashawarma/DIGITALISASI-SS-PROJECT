# Ringkasan Perubahan (8 Juli 2026)

Hari ini kita melakukan penyederhanaan dan standardisasi kategori Master Bahan Baku untuk seluruh ekosistem Suka Shawarma, serta merapikan data ganda di dalam database.

Berikut rincian perubahan yang telah dilakukan:

## 1. Penyederhanaan Kategori Bahan Baku
Kategori yang sebelumnya terlalu banyak (seperti protein, sayur, dll.) telah disederhanakan menjadi **5 Kategori Utama**:
1. ⭐ **Item Core** (Prioritas utama operasional dapur)
2. 🌶️ **Bumbu**
3. 🥤 **Minuman**
4. 📦 **Kemasan**
5. 📋 **Lainnya**

**Perubahan Sistem:**
- Opsi kategori di form Master Bahan Baku / Supplier (`admin-dashboard`) telah dikunci ke 5 opsi ini.
- Tampilan Monitoring Stok (`stok` / dapur) diperbarui agar otomatis meletakkan semua bahan dengan kategori "Item Core" di urutan paling atas.

## 2. Pembersihan Data Database (Live)
Untuk menghindari kebingungan nama yang serupa, dilakukan penyesuaian (deduplikasi) data riil langsung ke database Supabase:
- `SAUS CABE/TOMAT` diubah menjadi **SAOS CABE**
- `SAUS TOMAT` diubah menjadi **SAOS TOMAT**
- `SAUS X HOT` telah dinonaktifkan (archived / is_active = false)
- `SAOS SAMYANG` tetap dipertahankan
Sistem kini secara seragam hanya mengenali 3 varian saos.

## 3. Sinkronisasi Antar Aplikasi
Karena data ditarik secara dinamis dari tabel `bahan_baku`, perubahan nama di atas otomatis tersinkronisasi tanpa memerlukan penyesuaian hardcode pada aplikasi POS, Owner Dashboard, maupun Admin.
Tambahan penyesuaian UI secara spesifik:
- **App Distribusi:** Form pembuatan Surat Jalan telah di-update agar dropdown pilihan barang dikelompokkan (Grouped) berdasarkan 5 Kategori Utama (Item Core, Bumbu, dll.) mengikuti standar yang sama dengan dapur.
- **App Stok:** Komponen `SPVTable.tsx` (tabel untuk Leader/SPV) kini ikut mengaplikasikan normalisasi 5 Kategori Utama agar tampilannya konsisten 100% dengan tampilan layar operasional (Crew).

## 4. Pemisahan Saos Cabe/Tomat
- Memisahkan bahan baku `SAUS CABE/TOMAT` menjadi dua bahan baku baru: `SAOS CABE` dan `SAOS TOMAT` (kategori_core: 'saos').
- Memperbarui 20 resep yang menggunakannya dengan membagi proporsi takaran menjadi tepat 50% / 50% masing-masing.
- Menonaktifkan bahan baku lama.
- Memperbaiki bug COGS (15 juta) dengan memastikan `faktor_konversi` SAOS CABE & TOMAT di-set ke 1000.
- Menghapus duplikasi `SAUS TOMAT (crt)` pada resep Original Mix Jumbo dan menggabungkannya ke `SAOS TOMAT (kg)`.
- Menambahkan sinkronisasi ulang `harga_beli_display` untuk mengatasi isu harga COGS yang terlampau tinggi akibat faktor konversi yang telat diperbarui.

## 5. Fitur Tampilan Konversi Satuan
- Menambahkan field `satuan_kecil` dan `faktor_konversi` ke tipe TypeScript untuk bahan baku.
- Menambahkan kolom baru **Konversi** pada tabel Master Bahan Baku di UI admin (`admin-dashboard`) agar dapat dengan mudah melihat konversi satuan (misal: `1 blok = 2000 gram`).
- Menambahkan informasi konversi di dropdown form Surat Jalan (`distribusi`), sehingga admin logistik bisa melihat `(1 kg = 1000 gram)` saat memilih bahan baku.

## 6. Perbaikan Typo Satuan
- Memperbaiki salah ketik `satuan_kecil` untuk bahan baku **SAPI** (menjadi gram), **MINYAK SAYUR** (menjadi ml), dan **GAS 3Kg** (menjadi gram) di database.

---

# Ringkasan Perubahan Sebelumnya (1 Juli 2026)
Fokus pada perkuatan sistem pencegahan kebocoran finansial (Loss Gap Prevention) di level operasional outlet dengan modul Shift Management & Blind Close.
- Penambahan tabel `shifts` untuk merekam modal awal dan hasil akhir (blind close).
- Relasi Petty Cash tipe `cash_drawer` yang otomatis memotong ekspektasi kas pada shift aktif.
- Implementasi fungsi RPC Supabase: `open_shift`, `get_expected_shift_cash`, dan `close_shift_blind`.
