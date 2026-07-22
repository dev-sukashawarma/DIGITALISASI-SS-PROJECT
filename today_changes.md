# Ringkasan Perubahan (22 Juli 2026)

## Perbaikan UI Modal Persetujuan Permintaan (App Stok)
- **Z-index Modal:** Mengubah `z-index` dari `z-50` menjadi `z-[60]` pada `ApprovalModal.tsx` agar posisi modal selalu berada di atas navigasi bawah (bottom navbar).
- **Responsive Scrolling:** Menambahkan `max-h-[95vh]` dan `overflow-y-auto` agar modal bisa di-*scroll* dengan baik saat ukurannya melebihi tinggi layar (khususnya pada perangkat berukuran layar kecil), mencegah konten terpotong.

---

# Ringkasan Perubahan (9 Juli 2026)

## 1. Fitur Auto-Populate Item Purchase Order (PO)
- **Database:** Menambahkan kolom `bahan_baku_ids` (tipe `UUID[]`) pada tabel `supplier` melalui migrasi SQL `20260709000000_supplier_bahan_baku_ids.sql`.
- **Master Supplier UI:** Memodifikasi form Master Supplier di `admin-dashboard` agar admin dapat mencentang (checkbox) daftar item spesifik yang biasa disuplai oleh supplier tersebut.
- **New PO UI:** Mengubah logika pemilihan supplier pada halaman pembuatan Purchase Order. Kini saat supplier dipilih, form daftar item PO akan secara otomatis terisi (auto-populate) sesuai dengan item yang sudah di-*setting* di Master Supplier. Jika belum di-*setting*, form akan menampilkan satu baris kosong seperti biasa.

## 2. Fitur Permintaan Berdasarkan Item / Target Menu
- **Perubahan Konsep:** Crew dapur kini dapat me-request barang tidak hanya dengan menebak/melihat sisa stok, tetapi berpatokan pada target penjualan menu (misalnya target jualan 50 Shawarma Original, 20 Shawarma Mix).
- **Backend (Supabase RPC):** Dibuat fungsi SQL `calculate_bahan_baku_request` yang akan me-ledakan (BOM explosion) target porsi menu ke komposisi bahan baku penyusunnya, kemudian mengecek sisa `saldo` stok secara real-time, lalu memberikan `saran_qty` (saran request) dalam bentuk satuan besar (dengan pembulatan `CEIL` dari selisih konversi).
- **Frontend (App Stok):** Menambahkan `TargetMenuCalculator.tsx` dan memasukkannya ke dalam `PermintaanForm.tsx` dengan UI Tabbed (Tab "Target Menu" vs Tab "Draft / Manual").
- **Migrations & Bypass:** Membuat policy khusus `bypass_requests` untuk memastikan request bisa di-submit dari fitur baru ini.

## 3. Peningkatan UX & Rincian Form Permintaan Bahan Baku
- **Filter Menu Target:** Item yang masuk ke kategori `pos-kasir` (seperti air mineral, teh pucuk) disembunyikan dari daftar target menu di form permintaan, sehingga crew hanya fokus menargetkan menu racikan (Shawarma, dsb).
- **Notifikasi Stok Mencukupi:** Jika kalkulasi BOM menghasilkan kuantitas (qty) saran 0 (karena sisa stok masih mencukupi), sistem kini tetap memunculkan item tersebut di keranjang dalam bentuk *readonly* dengan label hijau "**Stok mencukupi (Butuh: X)**". Crew jadi paham mengapa sarannya 0.
- **Tab Riwayat:** Memisahkan daftar "Buat Permintaan" dan "Riwayat Permintaan" ke dalam 2 tab utama di halaman Permintaan agar UI lebih bersih.
- **Rincian Satuan di Approval:** Menambahkan unit satuan pada list & pop-up modal "Menunggu Persetujuan" (Approval) untuk SPV/Kitchen agar mereka tahu persis unit dari nominal yang diminta (misal: 10 *pack*, bukan cuma 10).
- **Estimasi Omzet Kotor & Target Penjualan:** 
  - Melakukan migrasi DB (`20260709044000_add_target_metadata_to_permintaan.sql`) untuk menambahkan kolom `target_metadata` bertipe JSON pada tabel `permintaan_bahan`.
  - Mengambil harga jual dari tabel `menu_items` lalu mengirim metadata pesanan (nama menu, qty, harga jual) ke backend saat crew me-submit permintaan.
  - Memodifikasi UI Dashboard SPV/Kitchen (`ApprovalList.tsx` & `ApprovalModal.tsx`) untuk memunculkan tabel Target Penjualan beserta **Potensi Omzet Kotor** (murni hasil dari Menu x Harga Jual, tanpa dipotong stok sisa) untuk membantu pengambilan keputusan persetujuan stok.

---

# Ringkasan Perubahan Sebelumnya (8 Juli 2026)

Hari ini kita melakukan penyederhanaan dan standardisasi kategori Master Bahan Baku untuk seluruh ekosistem Suka Shawarma, serta merapikan data ganda di dalam database.

Berikut rincian perubahan yang telah dilakukan:

## 1. Penyederhanaan Kategori Bahan Baku
Kategori yang sebelumnya terlalu banyak (seperti protein, sayur, dll.) telah disederhanakan menjadi **5 Kategori Utama**:
1. ⭐ **Item Core** (Prioritas utama operasional dapur)
2. 🌶️ **Bumbu**
3. 🥤 **Minuman**
4. 📦 **Kemasan**
5. 📋 **Lainnya**

**Perubahan Sistem & UI:**
- Opsi kategori di form Master Bahan Baku / Supplier (`admin-dashboard`) telah dikunci ke 5 opsi ini.
- Tampilan Monitoring Stok (`stok` / dapur) komponen `CrewList` telah dirombak menjadi **tabel dengan 5 kolom eksplisit** agar informasinya lebih jelas:
  1. Nama Item & Storage Location
  2. Threshold
  3. Sat. Besar (Kemasan utuh)
  4. Sat. Kecil (Pecahan, ditandai `-` jika kosong)
  5. Status (Ready / Warning / Kritis)
- Otomatis meletakkan semua bahan dengan kategori "Item Core" di urutan paling atas.

## 2. Pembersihan Data Database (Live)
Untuk menghindari kebingungan nama yang serupa, dilakukan penyesuaian (deduplikasi) data riil langsung ke database Supabase:
- `SAUS CABE/TOMAT` diubah menjadi **SAOS CABE**
- `SAUS TOMAT` diubah menjadi **SAOS TOMAT**
- `SAUS X HOT` telah dinonaktifkan (archived / is_active = false)
- `SAOS SAMYANG` tetap dipertahankan
Sistem kini secara seragam hanya mengenali 3 varian saos.

**Perbaikan Database (Force Migration & Patching Kategori)**
- Menemukan dan menghapus *Check Constraint* lama (`bahan_baku_kategori_check`) di database yang sebelumnya memblokir transisi kategori.
- Melakukan *data patching* secara permanen di database, memindahkan item secara definitif:
  - **Item Core** kini mencakup 13 item (termasuk *Kulit, Ayam, Sapi, Kentang, Lettuce, Keju, Mayones, Minyak Sayur, Saos Cabe, Saos Tomat, Tum, Gas 3Kg*).
  - **Bumbu** kini mencakup *Bawang* beserta rempah dan tepung.

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



# Ringkasan Perubahan Sebelumnya (1 Juli 2026)
Fokus pada perkuatan sistem pencegahan kebocoran finansial (Loss Gap Prevention) di level operasional outlet dengan modul Shift Management & Blind Close.
- Penambahan tabel `shifts` untuk merekam modal awal dan hasil akhir (blind close).
- Relasi Petty Cash tipe `cash_drawer` yang otomatis memotong ekspektasi kas pada shift aktif.
- Implementasi fungsi RPC Supabase: `open_shift`, `get_expected_shift_cash`, dan `close_shift_blind`.
