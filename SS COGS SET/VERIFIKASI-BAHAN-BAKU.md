# Verifikasi Bahan Baku — Perlu Konfirmasi Atasan

> **[UPDATE 2026-07-08]**: Seluruh kategori bahan baku di database kini telah dirampingkan dan dikunci ke 5 opsi utama: **Item Core**, **Bumbu**, **Minuman**, **Kemasan**, dan **Lainnya**. Dokumen ini awalnya ditulis menggunakan pengelompokan lama (seperti 'saus', 'protein', 'sayur'). Referensi akhir kategori silakan merujuk ke perbaikan terbaru (contoh: Ayam, Sapi, Saos Cabe, Minyak Sayur, Gas 3Kg sekarang berada di **Item Core**).

Dokumen ini merangkum semua **asumsi & keputusan yang perlu dikonfirmasi** sebelum data COGS (dari 20 kartu WhatsApp) dimasukkan resmi ke database (`bahan_baku`, `resep`, `resep_item`). Isi ✅/❌ atau jawaban di kolom kanan.

## Status file SQL (hasil recheck teknis 2026-07-04)
Semua file draft sudah **diverifikasi ulang otomatis** — qty, satuan, dan referensi bahan di `resep-seed.sql` dicocokkan baris-per-baris dengan data sumber (`cogs-bom-normalized.json`) dan tidak ada selisih:

| File | Isi | Status teknis |
|---|---|---|
| `new-bahan-baku.sql` | 8 bahan baru | ✅ siap, cek satuan CHECK constraint OK |
| `update-plastik-merah-satuan.sql` | Ubah satuan PLASTIK MERAH (pack→pcs) | ✅ siap, reorder point masih **perkiraan** (lihat #8 di ringkasan) |
| `resep-seed.sql` | 21 resep + 21 resep_item (20 produk, Suka Drink pecah 2) | ✅ 100% cocok dgn sumber, 16 ter-link menu POS, 5 sengaja NULL |

**Masih terbuka (bukan bug, tapi keputusan/data yang belum ada):** 2 pertanyaan kecil di bagian 2 (gram per crt SAOS SAMYANG, reorder point PLASTIK MERAH pcs).

---

## 1. Bahan baku BARU — perlu disetujui isi & satuannya

8 bahan ini muncul di kartu COGS tapi **belum ada** di master `bahan_baku`. Satuan & kategori di bawah ini baru **tebakan** mengikuti gaya data yang sudah ada — perlu dicek benar/salah.

| Nama diusulkan | Satuan diusulkan | Kategori diusulkan | Dipakai di produk | Konfirmasi atasan |
|---|---|---|---|---|
| SAOS CABE | crt | item core | 11 produk (semua Shawarma/Suka) | [ ] Setuju &nbsp; [ ] Ubah: _______ |
| PLASTIK VACUM | pcs | kemasan | 2 produk Online | [ ] Setuju &nbsp; [ ] Ubah: _______ |
| CUP + TUTUP | pcs | kemasan | Suka Drink | [ ] Setuju &nbsp; [ ] Ubah: _______ |
| DUS PACKING | pcs | kemasan | 3 produk Online | [ ] Setuju &nbsp; [ ] Ubah: _______ |
| ES BATU | pcs | minuman | Suka Drink | [ ] Setuju &nbsp; [ ] Ubah: _______ |
| MIE | pcs | lainnya | Shawarmie Ayam/Sapi | [ ] Setuju &nbsp; [ ] Ubah: _______ |
| POWDER MIX | kg | minuman | Suka Drink | [ ] Setuju &nbsp; [ ] Ubah: _______ |
| STIKER | pcs | kemasan | Suka Drink | [ ] Setuju &nbsp; [ ] Ubah: _______ |

**Pertanyaan kunci:** Apakah 8 nama ini sudah benar cara penulisannya (biar konsisten dengan bahan lain di gudang), atau ada nama baku yang beda?

---

## 2. Konversi satuan

### ✅ Sudah dijawab (2026-07-04)
| Bahan | Jawaban owner |
|---|---|
| MINYAK SAYUR | 1 kompan = **16 liter** |
| MAYONES | 1 pouch = **1 kg** |

### ✅ Sudah diputuskan (2026-07-04, putaran 2)

**SAOS CABE** — kemasan datang tidak tetap (kompan 5,5kg / pouch 1kg).
[x] **Disetujui**: satuan stok diubah ke **kg**, dicatat berdasarkan berat aktual yang diterima (bukan per-pouch/per-kompan).

**SAOS SAMYANG** — dikonfirmasi **kemasannya TETAP** (beda dari SAOS CABE, tidak berubah-ubah). Satuan stok tetap `crt`, tidak diubah.
> Sisa pertanyaan kecil: 1 crt SAOS SAMYANG isi berapa gram persis? (masih asumsi 1000 gram, mohon konfirmasi kalau beda)
Jawaban: _______________________

**PLASTIK MERAH** — isi per pack tidak tetap (20 atau 50 lembar), harga per lembar tetap Rp200.
[x] **Disetujui**: satuan stok diubah dari `pack` → `pcs` (1 pcs = 1 lembar).
> Catatan teknis: `default_reorder_point` lama (50, dalam satuan pack) ikut disesuaikan ke ~1750 (dalam pcs/lembar) — ini **perkiraan**, mohon dikoreksi kalau angka reorder yang diinginkan beda.
Reorder point pcs yang benar (kalau bukan ~1750): _______________________

**Bahan lain yang masih diasumsikan tetap (mohon koreksi kalau ternyata juga variabel seperti saus lama):**
- SAPI (asumsi 1 pcs beli = 2000 gram / 2kg per blok)
- ES BATU (dibeli 62 pcs seharga Rp25.000 — apakah "pcs" di sini = 1 balok es standar?)

[ ] Semua asumsi di atas **benar, tetap (bukan variabel)** &nbsp; [ ] Ada yang variabel juga, koreksi: _______________________

---

## 3. Bahan yang digabung jadi satu (perlu konfirmasi ulang)

Kartu COGS menulis **"Saos cabe/tomat"** sebagai satu baris, padahal gudang biasanya punya 2 SKU terpisah: **SAUS X HOT** dan **SAOS TOMAT**.

**Keputusan sebelumnya:** dibuat SKU gabungan baru `SAOS CABE` (bukan salah satu dari yang lama).

[ ] Konfirmasi: ini memang **satu produk campuran** yang dibeli/dipakai sebagai satu, BUKAN salah ketik untuk salah satu saus yang sudah ada.

---

## 4. Baris "Loss" / "Lose" di kartu — bukan bahan fisik

Setiap kartu punya baris **Loss** (mis. "Loss Rp1.000, 1 lembar") — ini bukan bahan yang dibeli, tapi **buffer kerugian/pembulatan** dalam perhitungan COGS.

**Keputusan sebelumnya:** dikecualikan dari daftar bahan (tidak masuk resep, tidak dipotong dari stok gudang), tapi nilainya tetap dihitung sebagai bagian dari COGS per produk.

[ ] Setuju diperlakukan sebagai buffer saja (bukan bahan) &nbsp; [ ] Ternyata ini memang bahan fisik: _______________

---

## 5. Produk yang belum/sengaja tidak masuk menu POS

| Produk (nama di kartu COGS) | Status saat ini | Perlu konfirmasi |
|---|---|---|
| Suka Drink | ✅ **Selesai** — ternyata 1 kategori dgn 2 rasa (Ice Tea, Orange Jus), masing-masing sudah jadi menu terpisah di POS. Dipecah jadi 2 resep, bahan/qty identik (dikonfirmasi owner). | - |
| Shawarma Subsidi | Sengaja **tidak** dimasukkan ke POS (masuk resep/master saja) | [ ] Konfirmasi tetap begini |
| Ayam Sedang Subsidi | Sengaja **tidak** dimasukkan ke POS (masuk resep/master saja) | [ ] Konfirmasi tetap begini |
| Shawarma Online Reguler | Dijual di ShopeeFood/TikTok/GoFood, belum jelas tercatat sebagai menu_items atau tidak | [ ] Ditunda dulu, dicatat saja (belum perlu keputusan sekarang) |
| Shawarma Online Reguler Sapi | sda | [ ] Ditunda dulu |
| Shawarma Online Reguler Mix | sda | [ ] Ditunda dulu |

---

## 6. Ringkasan cepat — yang masih butuh jawaban SEKARANG

1. ~~Ukuran kemasan MINYAK SAYUR~~ ✅ terjawab: 16 liter/kompan
2. ~~1 pouch MAYONES~~ ✅ terjawab: 1kg/pouch
3. ~~Satuan stok SAUS diubah ke kg?~~ ✅ disetujui
4. ~~SAOS SAMYANG kemasannya variabel juga?~~ ✅ terjawab: tetap (tidak variabel)
5. ~~Satuan stok PLASTIK MERAH diubah ke pcs/lembar?~~ ✅ disetujui
6. ~~Nama asli menu POS untuk "Suka Drink"~~ ✅ terjawab: 2 menu terpisah (Ice Tea, Orange Jus)
7. **Isi pasti 1 crt SAOS SAMYANG dalam gram?** (masih asumsi 1000 gram)
8. **Reorder point PLASTIK MERAH dalam satuan pcs/lembar** — perkiraan saya 1750, mohon dikoreksi kalau salah

Sisanya (poin 1, 3, 4 di bagian atas dokumen — 8 bahan baru & bahan tetap seperti SAPI/ES BATU) bisa dijalankan dengan asumsi saat ini kalau atasan tidak keberatan — tapi sebaiknya tetap direview sebelum data masuk ke sistem produksi karena akan dipakai untuk potong stok otomatis setiap ada penjualan.

---

*Dibuat: 2026-07-04 — berdasarkan transkrip 20 kartu COGS di `SS COGS SET/` dan verifikasi silang dengan `bahan_baku` + `menu_items` di database.*
