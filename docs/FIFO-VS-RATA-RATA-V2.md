# FIFO atau Rata-rata? — Penjelasan dengan Bahasa Sehari-hari

**Dibuat:** 5 September 2026
**Untuk:** pemilik, pemegang pembukuan, dan siapa pun yang ikut memutuskan
**Pertanyaan yang dijawab:** kalau di gudang ada barang dari dua vendor dengan
harga berbeda, biaya yang dipakai untuk menghitung HPP itu yang mana?

---

> ## ⚠️ ANGKA DI DOKUMEN INI MASIH ILUSTRASI
>
> Semua angka rupiah dan jumlah di bawah adalah **contoh yang dibulatkan**, dipilih
> supaya mudah diikuti — **bukan data Suka Shawarma yang sebenarnya.**
>
> Dokumen ini menjelaskan **cara kerja** kedua metode. Untuk memutuskan, angka
> ilustrasi ini harus diganti dengan hasil pengukuran nyata — daftarnya ada di
> **Lampiran** di halaman terakhir.
>
> **Jangan mengutip angka mana pun dari dokumen ini ke laporan atau rapat.**

---

## Ringkasan tiga kalimat

Untuk perhitungan **HPP**, FIFO dan rata-rata praktis tidak berbeda — selisihnya
sekitar 1%, dan jadi **nol** kalau barang habis terkirim.

Yang benar-benar bermasalah bukan pilihan di antara keduanya, melainkan cara yang
**berjalan sekarang** — dan keduanya sama-sama memperbaikinya.

Pemilihan FIFO vs rata-rata akhirnya jatuh ke hal di luar HPP: beban kerja stokis,
dan apa yang terjadi saat stok tercatat minus.

---

## Bagian 1 — Kenapa pertanyaan ini muncul

Contoh yang ditanyakan:

> Di gudang ada 20 Kg sapi. 12 Kg dari vendor A, 8 Kg dari vendor B, harganya
> beda. Lalu ada outlet pesan 20 Kg. Kalau dikirim semua, HPP-nya pakai harga
> yang mana?

Ini pertanyaan yang tepat, dan setiap perusahaan yang punya persediaan harus
menjawabnya. Jawaban resminya ada dua, dan dua-duanya diakui standar akuntansi
persediaan:

| Nama | Anggapannya |
|---|---|
| **FIFO** | Barang yang datang duluan, keluar duluan |
| **Rata-rata** | Semua barang sejenis dianggap tercampur jadi satu harga |

Ada cara ketiga yang **berjalan di sistem sekarang**, dan itu bukan salah satu
dari keduanya — dibahas di Bagian 5.

---

## Bagian 2 — Satu aturan yang membuat semuanya gampang

Ada rumus dasar yang berlaku untuk metode apa pun:

```
HPP = persediaan awal + barang masuk − persediaan akhir
```

Artinya: biaya barang yang terjual = semua yang Anda punya, dikurangi yang masih
tersisa.

**FIFO dan rata-rata sepakat penuh** soal "persediaan awal" dan "barang masuk" —
itu fakta transaksi, bukan tafsiran. Yang berbeda hanya cara menilai **sisa**.

> **Seluruh perbedaan HPP antara FIFO dan rata-rata = perbedaan menilai barang
> yang tersisa. Tidak ada tempat lain selisih itu bisa muncul.**

Ini penting, karena artinya selisihnya bisa dihitung persis, bukan dikira-kira.
Dan kalau tidak ada sisa, selisihnya nol.

---

## Bagian 3 — Kasus demi kasus

Keadaan awal untuk semua kasus di bawah sama *(angka ilustrasi)*:

```
Gudang punya 20 Kg sapi
  12 Kg dari vendor A @ Rp50.000/Kg  →  Rp600.000
   8 Kg dari vendor B @ Rp52.500/Kg  →  Rp420.000
                        uang keluar   =  Rp1.020.000

Kalau dicampur: Rp1.020.000 ÷ 20 Kg  =  Rp51.000/Kg
```

### Kasus 1 — Outlet minta 20 Kg, dikirim semua

| Metode | Hitungan | Biaya |
|---|---|---|
| FIFO | 12×50.000 + 8×52.500 | **Rp1.020.000** |
| Rata-rata | 20 × 51.000 | **Rp1.020.000** |

**Hasilnya sama persis.** Masuk akal — kalau semua barang keluar, urutan siapa
duluan tidak lagi berpengaruh. Yang keluar ya semuanya.

Dan angkanya sama dengan uang yang betul-betul dikeluarkan. Ini yang seharusnya
terjadi.

**Jadi untuk pertanyaan yang diajukan — kirim semua 20 Kg — tidak ada yang perlu
dibingungkan. Kedua metode menjawab sama.**

### Kasus 2 — Outlet minta 15 Kg saja

Di sinilah, dan hanya di sini, keduanya mulai berbeda.

| Metode | Biaya 15 Kg keluar | Nilai sisa 5 Kg |
|---|---|---|
| FIFO | Rp757.500 | Rp262.500 |
| Rata-rata | Rp765.000 | Rp255.000 |
| **Selisih** | **Rp7.500** | **Rp7.500** |

FIFO menganggap yang keluar adalah 12 Kg murah dulu, baru 3 Kg mahal — sehingga
biayanya lebih rendah dan yang tersisa dinilai lebih mahal. Rata-rata
memperlakukan semuanya sebagai Rp51.000.

Perhatikan: selisihnya sama besar, arahnya berlawanan. **Total tetap
Rp1.020.000.** Tidak ada uang hilang atau muncul — hanya bergeser antara "sudah
jadi biaya bulan ini" dan "masih jadi aset".

Bedanya sekitar **1%**.

### Kasus 3 — Tidak ada barang bergerak, harga master diperbarui

Purchasing memperbarui harga sapi jadi Rp55.000/Kg karena nota berikutnya memang
segitu. Tidak ada daging masuk, keluar, atau rusak.

| Metode | Nilai 20 Kg di gudang |
|---|---|
| FIFO | Rp1.020.000 — tidak berubah |
| Rata-rata | Rp1.020.000 — tidak berubah |
| **Cara sekarang** | **Rp1.100.000 — naik Rp80.000 dari udara** |

**Keduanya lulus. Cara sekarang tidak.**

Perumpamaannya: Anda beli motor Rp20 juta tahun lalu. Tahun ini harga motor baru
Rp23 juta. Cara sekarang mencatat motor Anda jadi Rp23 juta — padahal Anda tidak
menerima tambahan Rp3 juta dari mana pun.

### Kasus 4 — Stok tercatat minus (ini yang menentukan)

Outlet menjual shawarma, tapi catatan stoknya sudah menunjukkan 0 Kg. Sistem
tetap memproses penjualan — memang disengaja, kasir tidak boleh gagal hanya
karena catatan stok telat menyusul.

| Metode | Apa yang terjadi |
|---|---|
| FIFO | **Buntu.** Tidak ada lagi "barang lama" untuk dikeluarkan. Harganya harus dikarang. |
| Rata-rata | Jalan normal. Harga pokoknya tetap melekat, saldo minus dinilai dengan harga yang sama, lalu pulih sendiri saat barang berikutnya masuk. |

Kalau ini kejadian langka, tidak jadi soal. Kalau sering, ini penentu — dan di
sistem ini **sering** (angka pastinya perlu diisi, lihat Lampiran).

Yang paling penting: **karangan yang paling wajar untuk FIFO saat buntu adalah
"pakai harga nota terakhir"** — yaitu persis cara yang sedang kita coba
tinggalkan. Jadi FIFO akan jatuh kembali ke perilaku lama setiap kali ini
terjadi.

### Kasus 5 — Opname menemukan barang lebih

Crew menghitung fisik, ternyata ada 3 Kg lebih banyak dari catatan.

| Metode | Apa yang terjadi |
|---|---|
| FIFO | 3 Kg ini masuk kelompok pembelian yang mana? Tidak ada jawabannya — harus dikarang lagi. |
| Rata-rata | Jalan normal — 3 Kg dinilai dengan harga pokok yang sedang berlaku. |

### Kasus 6 — Harga salah diinput (di sini FIFO yang menang)

Operator salah mengisi harga saat terima barang — misalnya mengisi harga per
Pack padahal kolomnya minta harga per Karung.

| Metode | Akibatnya |
|---|---|
| FIFO | Kesalahannya **terkurung** di satu kelompok pembelian itu saja. Bisa dibetulkan tanpa mengganggu yang lain. |
| Rata-rata | Angka salah itu **ikut dirata-rata**, jadi menular ke seluruh stok bahan tersebut, dan tidak bisa dicabut sebersih itu. |

Ini kelemahan rata-rata yang paling nyata, dan jenis kesalahan ini **sudah
pernah terjadi** di sistem ini lebih dari sekali (contohnya perlu diisi, lihat
Lampiran).

Kabar baiknya, sumber kesalahan ini sudah setengah ditutup: sejak 4 September ada
penjagaan di layar penerimaan PO yang menolak harga baru bila rasionya persis
sama dengan faktor kemasan — yaitu pola persis kesalahan-kesalahan itu.

Yang belum ada adalah cara **membetulkan** rata-rata yang terlanjur tercemar. Itu
harus ikut dirancang kalau rata-rata yang dipilih.

---

## Bagian 4 — Seberapa besar bedanya

*(Semua angka di bagian ini ilustrasi.)*

Hanya bahan yang **harga vendornya benar-benar berbeda** yang bisa menghasilkan
selisih sama sekali. Kalau dua vendor menjual di harga yang sama, metode apa pun
tidak mengubah apa-apa.

| Bahan | Sisa stok | Beda harga vendor | Batas maksimum selisih HPP |
|---|---|---|---|
| SAPI | 300 blok | Rp2.500 | Rp750.000 |
| FOIL | 1.400 roll | Rp2.500 | Rp3.500.000 |
| | | **Plafon** | **± Rp4,25 juta per periode** |

Dua catatan supaya angka semacam ini tidak dibaca berlebihan:

1. **Itu plafon teoretis.** Tercapai hanya kalau sisa stok kebetulan 100% dari
   vendor termurah di satu metode dan 100% dari vendor termahal di metode lain.
   Tidak pernah terjadi.
2. **Kalau barang berputar cepat, angka nyatanya mendekati nol** — sebab stok
   sisa seluruhnya berasal dari kiriman terakhir, sehingga FIFO dan rata-rata
   menilainya dengan harga yang sama.

Sebagai gambaran: kalau HPP sebulan sekitar Rp800 juta, plafon selisih Rp4,25
juta itu berarti **sekitar 0,5%**.

---

## Bagian 5 — Yang jauh lebih besar, dan sama-sama ditutup keduanya

Cara yang berjalan sekarang bukan FIFO, bukan rata-rata, dan sebetulnya bukan
metode biaya sama sekali. Nilai persediaan dan HPP **tidak pernah disimpan** —
keduanya dihitung ulang setiap kali dibuka, dengan rumus:

```
jumlah barang × harga master HARI INI
```

Akibatnya, **laporan bulan yang sudah tutup bisa berubah sendiri.** Gambarannya
*(angka ilustrasi)*:

```
HPP bulan lalu, dibaca di akhir bulan  :  Rp800 juta
HPP bulan lalu, dibaca hari ini        :  Rp850 juta
                              selisih  :  Rp 50 juta   (+6%)
```

Tidak ada satu pun penjualan yang berubah. Yang berubah hanya beberapa angka
harga yang diketik ulang di bulan berikutnya.

Ini adalah masalah **yang paling besar**, dan ukurannya jauh melampaui selisih
FIFO-vs-rata-rata:

```
Rp50 juta   ← ditutup oleh FIFO maupun rata-rata
Rp 0        ← selisih antara FIFO dan rata-rata (kalau barang habis terkirim)
```

**FIFO dan rata-rata sama-sama menghentikan ini,** karena keduanya menyimpan
biaya pada saat barang bergerak, lalu tidak menyentuhnya lagi.

**Satu catatan jujur:** kalau harga master yang baru itu ternyata yang *benar*
(misalnya harga lama salah input), maka laba bulan lalu yang dibaca di akhir
bulan justru **terlalu tinggi**. Tapi itu bukan penghiburan — masalahnya bukan
versi mana yang benar, melainkan bahwa laporan bulan tertutup menulis ulang
dirinya sendiri tanpa memberi tahu siapa pun, dan tidak ada cara membedakan
mana yang benar.

---

## Bagian 6 — Tabel ringkas

| | FIFO | Rata-rata |
|---|---|---|
| Kirim semua, tak ada sisa | sama | sama |
| Kirim sebagian | beda ±1% | beda ±1% |
| Harga master diubah tanpa barang bergerak | tidak terpengaruh ✅ | tidak terpengaruh ✅ |
| HPP bulan lalu berubah sendiri | berhenti ✅ | berhenti ✅ |
| **Stok minus** | **buntu** ❌ | jalan normal ✅ |
| Opname menemukan selisih | buntu ❌ | jalan normal ✅ |
| **Harga salah diinput** | terkurung ✅ | **mencemari rata-rata** ❌ |
| Beban stokis | pilih kelompok tiap kirim | nol |
| Ukuran perubahan sistem | tabel baru + logika berurutan di tiap lokasi | satu kolom di satu tempat |
| Diakui standar persediaan | ya | ya |

---

## Bagian 7 — Rekomendasi

**Rata-rata bergerak.**

Bukan karena lebih akurat — untuk pola usaha ini hasilnya identik dengan FIFO.
Melainkan karena:

1. FIFO gagal justru di kondisi yang paling sering terjadi di sistem ini (stok
   minus) — dan cara ia gagal adalah dengan jatuh kembali ke metode lama yang
   sedang kita tinggalkan.
2. Kelebihan FIFO yang tersisa (selisih ±1% dan ketertelusuran ke nota) tidak
   sepadan dengan membangun sistem lapisan biaya di setiap lokasi.
3. Rata-rata tidak menambah pekerjaan apa pun untuk stokis — ia mengetik "kirim
   20 Kg" seperti biasa, dan tidak perlu tahu bahwa di dalamnya ada dua vendor.

### Yang belum terjawab, dan harus dibereskan sebelum apa pun ditulis

1. **Cara membetulkan rata-rata yang tercemar harga salah.** Ini kelemahan nyata
   rata-rata (Kasus 6) dan belum ada rancangannya.
2. **Pintu masuk barang belum membawa harga.** Sebagian besar barang masuk gudang
   lewat penyesuaian manual, bukan penerimaan PO — barangnya nyata, notanya tidak
   ikut. **Selama ini belum berubah, metode biaya apa pun akan mengarang harga
   untuk sebagian besar barang yang masuk.** Ini bukan pekerjaan pemrograman,
   melainkan kesepakatan cara kerja purchasing.
3. **Konfirmasi ke pemegang pembukuan.** Pertanyaannya bukan "FIFO atau
   rata-rata" — keduanya sah. Pertanyaannya: *"persediaan kami sekarang dinilai
   pada harga kini, bukan pada biaya perolehan. Apakah itu bisa diterima?"*

### Satu hal yang berlaku untuk pilihan mana pun

Sekali dipilih, **jangan berganti-ganti**. Berpindah metode di tengah jalan
membuat laba antar-bulan tidak bisa dibandingkan, dan itu kerugian yang jauh
lebih besar daripada selisih 1% mana pun.

---

## Lampiran — Angka yang harus diganti sebelum dokumen ini dipakai memutuskan

Sembilan angka berikut sudah pernah diukur dari database produksi. Semuanya
diganti dengan ilustrasi di dokumen ini, dan harus dikembalikan sebelum dokumen
dipakai untuk mengambil keputusan atau dibawa ke rapat.

| # | Bagian | Angka yang perlu diisi |
|---|---|---|
| 1 | Bagian 3, Kasus 3 | Nilai persediaan yang bergeser saat harga SAPI ditimpa 3 September |
| 2 | Bagian 3, Kasus 4 | Berapa kali penjualan memotong stok menembus nol, dan di berapa bahan/outlet |
| 3 | Bagian 3, Kasus 4 | Berapa baris stok yang saldonya minus saat ini |
| 4 | Bagian 3, Kasus 6 | Contoh nyata harga salah input beserta nilainya |
| 5 | Bagian 4 | Sisa stok SAPI dan FOIL, serta beda harga vendornya |
| 6 | Bagian 4 | Berapa bahan yang harga vendornya memang berbeda |
| 7 | Bagian 4 | HPP bulanan sebenarnya, untuk menghitung persentase selisih |
| 8 | Bagian 5 | HPP bulan lalu versi akhir bulan vs versi hari ini, dan selisihnya |
| 9 | Bagian 5 | Rincian bahan mana saja yang harganya diubah dan berapa dampaknya |
| 10 | Bagian 7 | Berapa kali barang masuk gudang, dan berapa yang lewat penerimaan PO |

---

## Catatan penutup

Dokumen ini menjelaskan pilihan dan cara kerjanya. **Ini bukan nasihat
akuntansi** — keputusan metode penilaian persediaan sebaiknya dikonfirmasi ke
pihak yang memegang pembukuan, terutama bila pembukuan ini akan diperiksa pihak
luar.

**Rujukan teknis:**

- `docs/AUDIT-2026-09-02-HARGA-BAHAN-DUA-VENDOR.md` Bagian IV — pengukuran dua vendor
- `docs/SKENARIO-BAHAN-DUA-VENDOR-BAHASA-AWAM.md` Bagian 7 — sisi neraca
- `docs/CATATAN-LANJUTAN-HARGA-STOK.md` — daftar pekerjaan yang masih terbuka
