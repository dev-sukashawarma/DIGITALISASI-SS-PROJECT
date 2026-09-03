# Bahan Baku Dua Vendor — Ceritanya dari Awal

**Diperiksa ulang:** 3 September 2026, langsung dari database yang berjalan
**Untuk siapa:** siapa pun yang perlu paham duduk perkaranya tanpa harus mengerti istilah teknis

---

## Pertanyaan yang dijawab dokumen ini

> "Ada bahan baku yang dipasok dua vendor dengan harga berbeda. Dari pemesanan
> sampai jadi angka HPP, bagaimana supaya tidak tumpang tindih?"

---

## Bagian 1 — Dulu: bagaimana sistem menghitung biaya bahan

Bayangkan tiga hal yang disimpan sistem untuk setiap bahan:

1. **Harga per kemasan** — misal sapi Rp103.000 per Blok
2. **Isi kemasan** — 1 Blok sapi = 2.000 gram
3. **Resep** — Original Sapi Jumbo butuh 170 gram sapi

Dari tiga angka itu, biaya sapi per porsi dihitung:

```
Rp103.000 ÷ 2.000 gram = Rp51,50 per gram
170 gram × Rp51,50     = Rp8.755
```

Jadi tiap kali satu Original Sapi Jumbo terjual (harga jual Rp42.000), sistem
mencatat Rp8.755 sebagai biaya sapinya.

**Yang penting dipahami:** angka itu **tidak diambil dari stok fisik**. Sistem
tidak melihat daging mana yang benar-benar dipakai. Ia hanya mengalikan resep
dengan harga yang tersimpan. Jadi kalau harga yang tersimpan salah, seluruh
laporan biaya ikut salah — tanpa gejala apa pun.

---

## Bagian 2 — Sekarang: apa yang terjadi kalau vendornya dua

### Keadaan nyata sapi hari ini

Riwayat pembelian sapi:

| Vendor | Tanggal | Jumlah | Harga |
|---|---|---|---|
| Bapak Aziz | 18 Agustus | 1.000 Blok | Rp100.000 |
| Bapak Aziz | 26 Agustus | 1.000 Blok | Rp100.000 |
| **Djafafood** | diverifikasi 3 September | 200 Blok | **Rp103.000** |

Sisa di gudang sekarang: **134 Blok**.

### Masalahnya di mana

Sistem hanya punya **satu kotak** untuk menyimpan harga sapi. Setiap kali barang
diterima, kotak itu **ditimpa** harga pembelian terbaru.

Jadi begitu kiriman Djafafood diverifikasi, harga sapi di sistem berubah dari
Rp100.000 menjadi Rp103.000 — dan sejak detik itu, **semua** perhitungan biaya
sapi di 19 outlet memakai Rp103.000.

Pertanyaan yang wajar muncul: adil tidak, kalau 200 Blok dari Djafafood
menentukan harga untuk daging yang sebagian besar dibeli Rp100.000?

---

## Bagian 3 — Skenario lengkap, langkah demi langkah

Mari ikuti satu potong daging dari nota vendor sampai struk pelanggan.

### Senin — Purchasing memesan

Bapak Aziz sedang kosong, jadi purchasing pesan ke Djafafood. Harga Djafafood
Rp103.000 per Blok.

Purchasing **menulis apa adanya di sistem: 103.000.** Tidak perlu menyamakan
dengan harga vendor lama.

### Rabu — Barang datang

Stokis gudang menerima 200 Blok, memeriksa fisiknya, lalu klik terima.

Dua hal terjadi otomatis:
- Stok sapi di gudang bertambah 200 Blok
- **Harga sapi di sistem berubah jadi Rp103.000** ← inilah langkah yang jadi bahan diskusi

### Kamis — Outlet minta barang

Kru outlet Empang mengajukan permintaan sapi. Kitchen memeriksa dan menyetujui
10 Blok.

Stokis mengambil 10 Blok dari tumpukan. **Ia tidak tahu — dan tidak perlu tahu —
mana daging Bapak Aziz dan mana daging Djafafood.** Di gudang, dagingnya memang
sudah tercampur secara fisik.

Surat jalan dibuat, barang berangkat ke Empang.

### Jumat — Pelanggan membeli

Kasir Empang input pesanan Original Sapi Jumbo. Otomatis:
- Stok sapi di Empang berkurang 170 gram
- Biaya sapi dicatat Rp8.755

Selesai. Itulah perjalanan lengkapnya.

---

## Bagian 4 — Jadi, apakah Rp8.755 itu salah?

Ini pertanyaan intinya, dan jawabannya **tidak seperti dugaan awal**.

### Dugaan awal

Karena stok gudang campuran dua harga, harga yang "adil" mestinya rata-ratanya:

```
2.000 Blok × Rp100.000 = Rp200.000.000
  200 Blok × Rp103.000 =  Rp20.600.000
─────────────────────────────────────────
2.200 Blok               Rp220.600.000  →  Rp100.273 per Blok
```

Kalau begitu, harga Rp103.000 kemahalan 2,7%, dan biaya per porsi mestinya
Rp8.523 bukan Rp8.755.

### Kenapa dugaan itu keliru

Perhitungan di atas memakai **semua pembelian sejak Agustus** — termasuk daging
yang sudah lama habis terjual.

Sisa sapi di gudang sekarang cuma **134 Blok**. Sementara Djafafood baru mengirim
200 Blok. Artinya: **daging Bapak Aziz sudah habis terpakai.** Yang tersisa di
gudang seluruhnya dari Djafafood.

Kalau isi gudang memang semuanya daging Rp103.000, maka **harga Rp103.000 itu
benar** — dan Rp8.755 juga benar.

### Kenapa bisa begitu

Karena **perputaran barang Anda cepat.** Daging lama habis terjual sebelum
kiriman baru datang. Tidak pernah ada tumpukan dua harga yang benar-benar
menganggur bersamaan di gudang.

Ini kabar baik, dan sekaligus alasan kenapa masalah "dua vendor" ternyata
belum menimbulkan kerugian.

### Diperiksa untuk semua bahan, bukan cuma sapi

| Bahan | Harga di sistem | Harga stok yang benar-benar ada | Selisih |
|---|---|---|---|
| SAPI | Rp103.000 | Rp103.000 | **nol** |
| FOIL | Rp11.554 | Rp11.554 | **nol** |
| AYAM | Rp53.500 | Rp53.500 | **nol** |
| MINYAK | Rp376.000 | Rp376.000 | **nol** |

Semua bahan yang punya lebih dari satu vendor: **selisihnya nol.**

---

## Bagian 5 — Lalu apa yang sebenarnya rusak

Selama pemeriksaan, ditemukan dua hal yang benar-benar bermasalah — dan keduanya
**bukan** soal dua vendor.

### Masalah 1 — Foil dicatat sebagai dua barang berbeda

Foil dipasok dua vendor, dan seseorang mencatatnya sebagai **dua bahan terpisah**:
"FOIL" dan "FOIL (48)". Barangnya sama, cuma vendornya beda.

Akibatnya rantainya putus:

- **Resep** memotong stok "FOIL" — 16 menu memakainya
- **Gudang** mengirim ke outlet sebagai "FOIL (48)"
- "FOIL (48)" tidak dipakai satu resep pun

Jadi tiap penjualan menggerus foil yang tak pernah dikirim, sementara foil yang
benar-benar datang tak pernah berkurang.

Keadaan hari ini:

```
FOIL        : saldo -13.540, minus di 17 outlet, dipakai 16 resep
FOIL (48)   : saldo +1.254.120, dipakai 0 resep
```

Kemarin masih minus di 12 outlet. Hari ini 17. **Ia melebar setiap hari.**

Selisihnya selama ini ditambal lewat opname — jadi angka stok "terlihat"
dibetulkan, padahal sumber masalahnya tidak pernah disentuh.

**Kabar baiknya:** barangnya tidak hilang. Ia ada, cuma tercatat di kolom
sebelah. Kalau kedua catatan digabung, hampir semua outlet langsung wajar.

**Pelajaran pentingnya:** memisahkan bahan per vendor terlihat solusi mudah,
tapi sudah dicoba di sistem ini sendiri dan gagal — karena resepnya tidak ikut
dipindahkan.

### Masalah 2 — Dua nota lama salah tingkat kemasan

Dua pembelian lama diinput pada tingkat kemasan yang berbeda dari catatan induk:

| Bahan | Di nota | Di catatan induk | Beda |
|---|---|---|---|
| PLASTIK MERAH | Rp18.000 per Pack | Rp90.000 per Ikat | 5× |
| POLYBAG | Rp600.000 per Bal | Rp25.000 per Pack | 24× |

Harganya sebenarnya sama — cuma dihitung per satuan berbeda, seperti menulis
harga telur "per butir" di kolom yang seharusnya "per peti".

Ini berbahaya karena PLASTIK MERAH dipakai **18 resep**. Kalau nota berikutnya
diinput dengan cara yang sama, harga plastik di sistem terjun dari Rp90.000 ke
Rp18.000, dan biaya 18 menu ikut anjlok 80% — tanpa peringatan apa pun.

**Kabar baiknya:** ini cuma di dokumen lama. Pemesanan yang dibuat lewat sistem
sekarang **10 dari 10 benar**. Formulirnya tidak bermasalah.

---

## Bagian 6 — Ringkasan untuk keputusan

**Yang dikira masalah:** bahan dua vendor membuat HPP salah.
**Kenyataannya:** selisihnya nol, karena barang berputar cepat.

**Yang benar-benar merugikan hari ini:**
1. Foil tercatat sebagai dua barang → 17 outlet bersaldo minus, melebar tiap hari
2. Dua nota lama salah tingkat kemasan → ranjau untuk pembelian berikutnya

**Tiga arah yang bisa dipilih:**

| Pilihan | Artinya | Konsekuensi |
|---|---|---|
| **Terima temuan** | Tidak mengubah cara hitung harga. Perbaiki foil dan dua nota lama. | Paling cepat memberi hasil. Kalau suatu saat ada barang berputar lambat dengan dua vendor menumpuk, perlu ditinjau lagi. |
| **Bangun rata-rata** | Ubah cara hitung jadi mencampur harga sesuai stok, meski hari ini selisihnya nol. | Jaga-jaga untuk masa depan. Menambah mekanisme baru ke sistem yang sedang distabilkan. |
| **Tunda** | Kumpulkan data beberapa minggu, ukur ulang, baru putuskan. | Tidak ada yang dikerjakan sekarang — termasuk foil, yang terus melebar. |

**Catatan jujur soal batas pengukuran ini.** Angka "nol" bersandar pada satu
asumsi: barang lama terpakai lebih dulu. Untuk bahan segar itu wajar, tapi
sistem tidak mencatat asal-usul tiap kiriman, jadi tak bisa dibuktikan mutlak.
Kalau ternyata stok benar-benar bercampur, selisihnya paling besar sekitar
Rp9,8 juta sebulan — sekitar 1,1% dari total biaya bahan.

Untuk mengukurnya lebih pasti, sistem harus mencatat tiap kedatangan barang
secara terpisah dan stokis harus memilih tumpukan mana yang dikirim, setiap
hari, di 19 outlet. Beban itu dinilai belum sepadan untuk mengejar selisih yang
batas atasnya 1,1%.

**Kapan keputusan ini perlu ditinjau ulang:** begitu ada bahan berputar lambat
yang stok dua vendornya benar-benar menumpuk bersamaan di gudang. Memantaunya
tidak perlu membangun apa pun — cukup jalankan ulang perbandingan yang sama
secara berkala.

---

*Rincian teknis, angka mentah, dan jejak pemeriksaannya ada di
`docs/AUDIT-2026-09-02-HARGA-BAHAN-DUA-VENDOR.md`.*
