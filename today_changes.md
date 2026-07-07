# Ringkasan Perubahan (7 Juli 2026)

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

---

# Ringkasan Perubahan Sebelumnya (1 Juli 2026)
Fokus pada perkuatan sistem pencegahan kebocoran finansial (Loss Gap Prevention) di level operasional outlet dengan modul Shift Management & Blind Close.
- Penambahan tabel `shifts` untuk merekam modal awal dan hasil akhir (blind close).
- Relasi Petty Cash tipe `cash_drawer` yang otomatis memotong ekspektasi kas pada shift aktif.
- Implementasi fungsi RPC Supabase: `open_shift`, `get_expected_shift_cash`, dan `close_shift_blind`.
