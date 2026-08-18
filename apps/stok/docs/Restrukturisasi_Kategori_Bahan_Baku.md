# Dokumen Desain Restrukturisasi Kategori Bahan Baku

## 1. Ringkasan Kesepahaman (*Understanding Summary*)
- **Tujuan**: Merestrukturisasi kategori bahan baku di aplikasi stok agar lebih mudah dianalisa secara finansial (COGS/Supply Chain) tanpa terlalu rumit bagi operasional outlet.
- **Kondisi Sebelumnya**: Memiliki >5 kategori (`item core`, `bumbu`, `kemasan`, `minuman`, `lain-lain`) yang tercampur antara barang HPP dan Non-HPP.
- **Pendekatan Baru**: Mengelompokkan berdasarkan peran barang terhadap *customer* (HPP vs Non-HPP), namun memisahkan kemasan dari makanan agar analisa kebocoran/pemborosan lebih akurat.

## 2. Asumsi
- Plastik jinjing (Plastik Merah, Plastik Besar, Plastik Kecil) dan bungkus makanan diklasifikasikan sebagai *Packaging* karena secara fisik diberikan kepada pelanggan.
- Plastik penyimpanan seperti *Cling Wrap* dan *Plastik Vacum* diklasifikasikan sebagai *Operasional* karena tetap berada di dapur dan tidak diserahkan ke pelanggan.
- Minyak goreng masuk ke *Food & Beverage* karena terserap oleh makanan (berkontribusi langsung pada *food cost*).
- Gas 3Kg diklasifikasikan sebagai *Food & Beverage* karena digunakan langsung dalam proses pembuatan menu makanan/minuman dan dihitung sebagai bagian dari HPP.

## 3. Log Keputusan (*Decision Log*)
1. **Keputusan**: Memisahkan Kemasan (*Packaging*) dari Bahan Makanan (*Food & Beverage*).
   - *Alternatif yang dipertimbangkan*: Menggabungkan semua HPP (Bahan & Kemasan) menjadi satu kategori.
   - *Alasan pemilihan*: Kemasan memiliki harga stabil dan minim tingkat kerusakannya (*waste*) dibanding makanan yang harganya fluktuatif dan rentan basi. Pemisahan ini mempermudah mendeteksi sumber kebocoran biaya (apakah dari dapur atau area *packing*).
2. **Keputusan**: Menggabungkan Makanan dan Minuman menjadi satu kategori `FOOD & BEVERAGE`.
   - *Alternatif yang dipertimbangkan*: Memisahkan kategori `Food` dan `Beverage` secara spesifik.
   - *Alasan pemilihan*: Mengutamakan keringkasan *input* opname harian di outlet. Pemisahan *food* dan *beverage* dapat dilakukan di level laporan lain jika diperlukan, namun untuk kategori master *inventory*, penyederhanaan lebih efektif.

## 4. Desain Final Pemetaan Kategori

| No | Nama Bahan | Kategori Lama | Kategori Baru | Peran |
|:---|:---|:---|:---|:---|
| 1 | Ayam | item core | FOOD & BEVERAGE | Bahan makanan utama |
| 2 | Bawang | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 3 | Cengkeh | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 4 | Es Batu | minuman | FOOD & BEVERAGE | Bahan minuman |
| 5 | Garam | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 6 | Jinten | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 7 | Kayu Manis | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 8 | Keju | item core | FOOD & BEVERAGE | Bahan pelengkap makanan |
| 9 | Kentang | item core | FOOD & BEVERAGE | Bahan makanan |
| 10 | Ketumbar | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 11 | Kulit 25 | item core | FOOD & BEVERAGE | Bahan makanan utama |
| 12 | Kulit 28 | item core | FOOD & BEVERAGE | Bahan makanan utama |
| 13 | Kulit 32 | item core | FOOD & BEVERAGE | Bahan makanan utama |
| 14 | Kunyit | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 15 | Lettuce | item core | FOOD & BEVERAGE | Bahan makanan segar |
| 16 | Mayonaise | item core | FOOD & BEVERAGE | Saus makanan |
| 17 | Mie | lainnya | FOOD & BEVERAGE | Bahan makanan |
| 18 | Minyak | item core | FOOD & BEVERAGE | Terserap ke makanan (HPP) |
| 19 | Powder Jeruk | minuman | FOOD & BEVERAGE | Bahan minuman |
| 20 | Powder Teh | minuman | FOOD & BEVERAGE | Bahan minuman |
| 21 | Saos Cabe | item core | FOOD & BEVERAGE | Saus makanan |
| 22 | Saos Cabe Pouch | item core | FOOD & BEVERAGE | Saus makanan |
| 23 | Saos Samyang | bumbu | FOOD & BEVERAGE | Saus makanan |
| 24 | Saos Tomat Kompan | item core | FOOD & BEVERAGE | Saus makanan |
| 25 | Saos Tomat Pouch | item core | FOOD & BEVERAGE | Saus makanan |
| 26 | Sapi | item core | FOOD & BEVERAGE | Bahan makanan utama |
| 27 | Sasa | bumbu | FOOD & BEVERAGE | Bumbu masakan |
| 28 | Sayur | item core | FOOD & BEVERAGE | Bahan makanan segar |
| 29 | Tepung | bumbu | FOOD & BEVERAGE | Bumbu/Pelapis makanan |
| 30 | Tum | item core | FOOD & BEVERAGE | Bahan makanan |
| 31 | Cup | kemasan | PACKAGING | Wadah minuman ke customer |
| 32 | Dus Packing | kemasan | PACKAGING | Wadah makanan ke customer |
| 33 | Foil | kemasan | PACKAGING | Pembungkus makanan ke customer |
| 34 | Foil (48) | kemasan | PACKAGING | Pembungkus makanan ke customer |
| 35 | Paper Wrap | kemasan | PACKAGING | Pembungkus makanan ke customer |
| 36 | Plastik Besar | kemasan | PACKAGING | Plastik jinjing ke customer |
| 37 | Plastik Kecil | kemasan | PACKAGING | Plastik jinjing ke customer |
| 38 | Plastik Merah | kemasan | PACKAGING | Plastik jinjing ke customer |
| 39 | Plastik Suka Drink | Lain-lain | PACKAGING | Plastik minuman ke customer |
| 40 | Sedotan | minuman | PACKAGING | Diberikan ke customer |
| 41 | Stiker | kemasan | PACKAGING | Menempel di kemasan customer |
| 42 | Tutup Pack | kemasan | PACKAGING | Penutup wadah customer |
| 43 | Cling Wrap | Lain-lain | OPERASIONAL | Alat simpan dapur (Non-HPP) |
| 44 | Gas 3Kg | item core | FOOD & BEVERAGE | Bahan bakar pembuatan menu (HPP) |
| 45 | Hand Glove | kemasan | OPERASIONAL | Alat kebersihan dapur (Non-HPP) |
| 46 | Kertas Struk | kemasan | OPERASIONAL | Kebutuhan kasir (Non-HPP) |
| 47 | Plastik Vacum | kemasan | OPERASIONAL | Alat simpan/vakum daging (Non-HPP) |
| 48 | Plastik Vacuum Jumbo | Lain-lain | OPERASIONAL | Alat simpan/vakum daging (Non-HPP) |
| 49 | Polybag | kemasan | OPERASIONAL | Kantong sampah/simpan (Non-HPP) |
| 50 | Sabun | lainnya | OPERASIONAL | Alat kebersihan (Non-HPP) |
