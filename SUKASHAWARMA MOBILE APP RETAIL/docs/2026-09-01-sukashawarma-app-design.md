# SukaShawarma APP — Desain Aplikasi Mobile Pelanggan

**Tanggal:** 2026-09-01
**Status:** Disetujui untuk masuk tahap perencanaan implementasi
**Lingkup:** Aplikasi mobile pelanggan (Android dulu, iOS menyusul) + layanan gerbang di VPS Coolify

---

## 1. Ringkasan

SukaShawarma APP adalah aplikasi pemesanan **order-ahead / pickup** untuk pelanggan Suka Shawarma — pelanggan memesan dan membayar di aplikasi, lalu mengambil pesanan di outlet. Modelnya mengikuti pola Kopi Kenangan: katalog menu, promo, program loyalitas berbasis poin & tier, dan paket prabayar (bundle) sebagai mesin retensi.

Aplikasi ini **menumpang ekosistem yang sudah ada** (Supabase produksi, POS kasir, sistem stok/BOM 19 outlet), bukan membangun dari nol. Pesanan dari aplikasi menjadi baris `orders` yang sama dengan pesanan kasir, sehingga otomatis muncul di layar kasir dan memotong stok lewat mekanisme BOM yang sudah berjalan.

### Yang TIDAK termasuk lingkup v1

- Pengantaran (delivery) — pickup saja
- Dine-in QR meja
- Saldo/dompet internal (top-up) — pembayaran lewat gateway saja
- Langganan bulanan auto-debit
- Penjadwalan waktu pengambilan
- Pra-pesan sebelum outlet buka
- Hadiah bundle ke orang lain (gifting)

---

## 2. Keputusan Arsitektur

### 2.1 Pola "Satu Pintu"

```
┌─────────────────────────┐
│  App Android / iOS      │  tidak memegang kunci database apa pun
└───────────┬─────────────┘
            │ HTTPS + token sesi
            ▼
┌─────────────────────────┐
│  Retail Gateway         │  Coolify VPS
│  ("Resepsionis")        │  • cache katalog menu
│                         │  • hitung total & potongan (mengikat)
│                         │  • webhook payment gateway
│                         │  • proxy login (Google / WhatsApp OTP)
│                         │  • cron: expire poin, expire bundle, pengingat
└───────────┬─────────────┘
            │ service role
            ▼
┌─────────────────────────┐
│  Supabase Produksi      │  orders, order_items, menu, outlets, stok, BOM
│  + schema `retail`      │  profil pelanggan, poin, tier, bundle, referral
└─────────────────────────┘
```

**Prinsip yang tidak boleh dilanggar:**

1. **Aplikasi tidak pernah memegang kredensial database** (termasuk anon key). Seluruh komunikasi lewat Retail Gateway. Ini menghapus permukaan serang RLS publik terhadap database yang juga menyimpan data gaji, keuangan, dan operasional 19 outlet — terutama penting karena `orders` diketahui memiliki policy `USING(true)`.
2. **Logika bisnis tinggal di server**, bukan di aplikasi. Perhitungan harga, potongan, poin, dan validasi promo semuanya di Gateway/DB. Aplikasi Android & iOS bersifat tipis — fetch, render, kirim. Ini satu-satunya cara agar dua kodebase native tidak divergen.
3. **Beban baca ditahan Gateway.** Katalog menu disajikan dari cache; database produksi hanya diketuk saat ada urusan nyata (checkout, pembuatan pesanan, baca data pribadi pelanggan).

### 2.2 Kenapa bukan database terpisah

Opsi "satelit retail" (database kedua khusus pelanggan) sempat dipertimbangkan untuk melindungi database produksi dari beban. Ditolak karena:

- Beban baca publik sudah terselesaikan oleh cache di Gateway — database kedua tidak menambah perlindungan apa pun di atas itu.
- Sinkronisasi dua database adalah pekerjaan yang tidak pernah selesai dan sumber bug klasik "harga di app beda dengan kasir".
- Menambah satu komponen yang harus dirawat, tanpa manfaat tambahan pada tahap ini.

**Jalur peningkatan tetap terbuka:** karena aplikasi hanya bicara ke Gateway, pemecahan menjadi dua database di kemudian hari **tidak memerlukan perubahan apa pun di aplikasi Android/iOS**. Cukup ubah Gateway.

**Ambang untuk memecah:** kasir mulai terasa lambat DAN grafik CPU Supabase tinggi di jam sibuk, ATAU traffic tembus ±3.000 pengguna aktif harian.

### 2.3 Stack

| Komponen | Teknologi | Alasan |
|---|---|---|
| Android | Kotlin + Jetpack Compose | Native, pengalaman platform yang benar |
| iOS (fase berikutnya) | Swift + SwiftUI | Native, sesuai Human Interface Guidelines |
| Retail Gateway | Next.js / Node di Coolify | Konsisten dengan app existing, pola `CRON_SECRET` sudah ada |
| Auth | Supabase Auth (di-proxy Gateway) | Sudah teruji; JWT dipakai untuk RLS |
| Database | Supabase produksi + schema `retail` | Sumber kebenaran tunggal |
| Pembayaran | Payment gateway (Midtrans/Xendit) | QRIS, e-wallet, VA |

**Urutan rilis:** Android dulu sampai tahap 1 terbukti di pilot, baru iOS. Ini menghindari mengerjakan dua kali setiap keputusan produk yang berubah selama pilot.

### 2.4 Risiko yang diterima

**Gateway adalah titik tunggal kegagalan.** Kalau VPS Coolify mati, aplikasi mati total. Penanganan: health check + auto-restart di Coolify; katalog menu di-cache di perangkat sehingga aplikasi tetap bisa dibuka dan menampilkan menu saat gangguan (tanpa bisa memesan).

---

## 3. Autentikasi & Identitas

### 3.1 Dua pintu masuk, satu identitas

| Pintu | Alur |
|---|---|
| **Google** | Credential Manager (Android) / GoogleSignIn SDK (iOS) → ID token → dikirim ke Gateway → Gateway menukarkannya ke Supabase Auth → sesi dikembalikan ke aplikasi |
| **WhatsApp OTP** | Nomor HP → Gateway meminta penyedia WhatsApp Business API mengirim kode → pelanggan memasukkan kode → Gateway verifikasi → sesi dikembalikan |

Alur Google **wajib native** (bottom sheet di dalam aplikasi), bukan redirect browser.

**Kewajiban App Store (Guideline 4.8):** saat rilis iOS, **Sign in with Apple wajib tersedia** karena aplikasi menyediakan login pihak ketiga. Harus masuk rencana sejak awal, bukan ditemukan saat ditolak review.

### 3.2 Verifikasi nomor: opsional, dengan pagar

Verifikasi nomor WhatsApp **tidak wajib** untuk memesan. Bisa ditambahkan kapan saja dari halaman Profil.

**Yang tetap memerlukan nomor terverifikasi:**

- Mencairkan hadiah program referral (baik sebagai pengajak maupun yang diajak)

Alasan: akun Google gratis dan tidak terbatas. Tanpa pagar ini, program referral akan dikuras oleh pembuatan akun massal dalam hitungan hari.

**Dorongan verifikasi (bukan paksaan):**

- Setelah pesanan pertama selesai: tawaran bonus poin untuk menambahkan nomor
- Di halaman Dompet: peringatan halus "poinmu belum terlindungi" bila nomor belum ada
- Saat menukar poin dalam jumlah besar: tawaran verifikasi (menawarkan, bukan menghalangi)

### 3.3 Penggabungan akun — WAJIB dibangun

Karena verifikasi nomor bersifat opsional dan bisa menyusul, kasus akun terbelah **pasti terjadi**: pelanggan login Google, mengumpulkan poin, lalu belakangan menambahkan nomor HP yang ternyata sudah memiliki akun sendiri.

Perilaku yang diwajibkan saat nomor diverifikasi dan nomor itu sudah terpakai akun lain:

| Aspek | Perlakuan |
|---|---|
| Poin | Dijumlahkan |
| Kupon bundle | Digabung, masa berlaku masing-masing dipertahankan |
| Voucher | Digabung |
| Riwayat pesanan | Disatukan |
| Tier | Dihitung ulang dari gabungan belanja 90 hari |
| Kode referral | Kode akun tertua dipertahankan |
| Akun yang ditinggalkan | Dinonaktifkan, ditandai tergabung ke akun tujuan |

Operasi ini harus **atomik** (semua berhasil atau semua batal) dan **tercatat di jejak audit**. Ini salah satu bagian yang paling perlu diuji.

### 3.4 Pembatasan OTP

- Maksimal 3 permintaan OTP per nomor per jam
- Jeda minimal 60 detik antar permintaan
- Kode berlaku 5 menit, maksimal 5 percobaan salah
- Sesi login berumur panjang (30 hari) agar OTP tidak diminta berulang

**Vendor:** wajib WhatsApp Business API resmi lewat penyedia (BSP). Gateway tidak resmi dilarang — risiko pemblokiran nomor oleh Meta berarti **tidak ada satu pun pelanggan baru yang bisa mendaftar** saat itu terjadi.

---

## 4. Alur Pesan → Bayar → Ambil

### 4.1 Alur utama

```
1.  Buka aplikasi        → katalog dari cache (cepat, tanpa menunggu)
2.  Pilih outlet         → urutkan terdekat; status Buka / Ramai / Tutup
3.  Susun keranjang      → varian, extra topping, catatan per item
4.  Terapkan insentif    → voucher / kode promo / kupon bundle / tukar poin
5.  Halaman bayar        → VALIDASI KE PRODUKSI (lihat 4.2)
6.  Bayar                → QRIS / e-wallet / VA
7.  Konfirmasi gateway   → webhook ke Gateway (bukan klaim dari aplikasi)
8.  Pesanan masuk kasir  → baris orders + order_items, stok terpotong BOM
9.  Notifikasi status    → Diterima → Sedang dibuat → Siap diambil
10. Pengambilan          → kode 4 digit / QR, ditandai selesai oleh KASIR
11. Selesai              → poin masuk, permintaan rating
```

### 4.2 Validasi pra-bayar (titik kritis)

Tepat sebelum tagihan dibuat, Gateway melakukan **satu panggilan** ke database produksi yang memeriksa empat hal:

| Diperiksa | Bila gagal |
|---|---|
| Outlet masih buka | Tawarkan outlet terdekat lain |
| Semua item tersedia | Tunjukkan item yang habis, minta hapus/ganti |
| Harga masih sama dengan cache | Tampilkan selisih, minta persetujuan ulang |
| Promo/voucher masih sah & berkuota | Batalkan promo tersebut, hitung ulang total |

Ketersediaan **selalu** dibaca langsung dari produksi di titik ini, tidak pernah dari cache — karena ketersediaan berubah kapan saja, sedangkan menu jarang berubah.

**Total yang dihitung Gateway adalah yang mengikat.** Aplikasi juga menghitung total, tetapi hanya untuk ditampilkan. Bila berbeda, nilai Gateway yang menang. Ini mencegah manipulasi harga lewat pembongkaran aplikasi.

### 4.3 Aturan uang

1. **Pesanan dikirim ke kasir hanya setelah webhook payment gateway mengonfirmasi pembayaran.** Klaim dari aplikasi ("saya sudah bayar") tidak pernah dipercaya.
2. **Idempotensi wajib.** Setiap pesanan memiliki kunci unik yang dibuat sekali di awal. Webhook duplikat dari gateway (hal yang lumrah) untuk kunci yang sama diabaikan — tidak ada pesanan kembar, tidak ada stok terpotong dua kali.
3. **Harga dikunci saat pesanan dibuat.** Perubahan harga setelahnya tidak memengaruhi pesanan yang sudah berjalan.

### 4.4 Penanganan kegagalan

| Kejadian | Perlakuan |
|---|---|
| Sudah bayar, pesanan gagal masuk ke kasir | Antrean coba-lagi otomatis + alarm ke admin. Uang pelanggan tidak boleh mengambang tanpa ada yang tahu. |
| Sudah bayar, outlet tidak bisa melayani | Batalkan + refund otomatis lewat gateway + notifikasi permintaan maaf |
| Belum bayar dalam 15 menit | Pesanan hangus; stok tidak pernah terpotong karena belum masuk kasir |
| Siap tapi tidak diambil | **Hangus penuh, tanpa kompensasi** (keputusan pemilik), dengan tiga pengingat sebelumnya |

---

## 5. Menu & Katalog

### 5.1 Sumber data

Menu bersumber dari tabel menu produksi yang dipakai kasir. Tiga kolom **aditif** ditambahkan (tidak mengubah perilaku kasir):

| Kolom | Guna |
|---|---|
| `tampil_di_app` | Sembunyikan item yang tidak layak dijual online tanpa menghapusnya dari kasir |
| `foto_app` | Foto berkualitas tinggi untuk aplikasi |
| `deskripsi_app` | Deskripsi menggugah selera; kasir tidak membutuhkannya |

### 5.2 Kesegaran cache

| Pemicu | Waktu |
|---|---|
| Berkala | Tiap 5 menit |
| Saat admin mengubah menu/harga | Segera (dashboard memberi tahu Gateway) |
| **Penyegaran paksa pra-buka** | **13:45**, 15 menit sebelum outlet buka |

Penyegaran 13:45 adalah jaring pengaman: apa pun yang diubah admin pagi hari dipastikan terpasang sebelum pelanggan pertama, tanpa bergantung pada keberhasilan notifikasi dashboard.

### 5.3 Kebijakan operasional jam

**Perubahan harga dilakukan sebelum jam 12:00; outlet buka jam 14:00.** Perubahan harga karenanya terjadi saat toko tutup — tidak ada pesanan aktif yang terpengaruh.

Karena "diusahakan" bukan jaminan, dashboard menampilkan konfirmasi bila admin mengubah harga saat outlet sedang buka, menyebutkan jumlah pesanan yang sedang berjalan dan menegaskan bahwa perubahan hanya berlaku untuk pesanan baru.

### 5.4 Sebelum outlet buka

Aplikasi tetap hidup penuh: menu bisa dilihat, promo dibaca, **keranjang bisa disusun**. Yang dinonaktifkan hanya tombol bayar, diganti tombol **"Ingatkan saya saat buka"** yang mengirim notifikasi jam 14:00 dengan keranjang masih utuh.

Ini menangkap niat beli pagi hari tanpa membangun mesin pra-pesan (yang identik dengan mesin penjadwalan yang sengaja ditunda), dan menghasilkan data untuk memutuskan apakah pra-pesan layak dibangun di v2.

### 5.5 Ketersediaan item

Sumber: sistem stok & BOM yang sudah ada — bahan baku habis menandai menu terkait sebagai habis. Ditambah tombol manual "kosongkan item" untuk kasir, karena alasannya kadang bukan stok (kompor rusak, antrean panjang).

**Penanggung jawab penekanan tombol ini harus ditetapkan sebelum pilot.**

### 5.6 Aturan bentuk pesanan

**Aplikasi tidak boleh menciptakan bentuk pesanan baru.** Pilihan varian, extra topping, dan catatan harus menghasilkan baris `order_items` yang bentuknya sama persis dengan yang dibuat kasir. Bentuk yang berbeda akan mengacaukan struk dapur dan membuat potongan stok BOM salah.

---

## 6. Sistem Insentif

### 6.1 Satu mesin, urutan terkunci

Seluruh potongan dihitung **di Gateway**, tidak pernah di aplikasi, dengan urutan tetap:

```
Subtotal (harga × jumlah)
  1. − Potongan tingkat item   (mis. beli 2 gratis 1)
  2. − Kupon bundle
  3. − Voucher / kode promo
  4. − Penukaran poin
  ──────────────────────────
  = Total bayar
  → Poin diperoleh dihitung dari TOTAL BAYAR, bukan subtotal
```

Poin dihitung dari uang yang benar-benar keluar. Bila tidak, pelanggan bisa memakai voucher gratis namun tetap memanen poin — mesin kerugian yang berputar sendiri.

**Pagar:**

- Maksimal **satu** voucher/kode promo per pesanan (boleh digabung dengan bundle dan poin)
- Total seluruh potongan **maksimal 50% dari subtotal** (nilai awal; dapat diatur) — rem darurat untuk kombinasi promo yang tidak terduga

### 6.2 Panel Ekonomi — semua angka dapat diatur

Seluruh parameter ekonomi diatur dari dashboard, **tidak tertanam di kode**, dan dapat diubah tanpa merilis ulang aplikasi:

| Parameter | Nilai awal (dapat diubah) |
|---|---|
| Rupiah per poin | Rp1.000 = 1 poin |
| Nilai tukar poin | 100 poin = Rp5.000 (≈5%) |
| Masa berlaku poin | 6 bulan sejak transaksi terakhir |
| Ambang tier | Silver Rp300.000 · Gold Rp750.000 (belanja 90 hari) |
| Pengali poin per tier | Bronze 1× · Silver 1,25× · Gold 1,5× |
| Periode hitung tier | 90 hari |
| Paket bundle | Jumlah, harga, masa berlaku, menu tercakup — bebas dibuat |
| Hadiah referral | Nilai pengajak & yang diajak, syarat pencairan |
| Batas maksimal potongan | 50% dari subtotal |
| Misi | Dibuat & diganti dari dashboard |

Nilai awal di atas adalah titik mulai, bukan ketetapan — pemilik menentukan angka finalnya sebelum rilis.

### 6.3 Aturan tidak berlaku surut — WAJIB

Perubahan parameter **tidak boleh berlaku surut**. Poin yang sudah terkumpul ditukar dengan nilai yang berlaku saat diperoleh. Bundle yang sudah terjual tunduk pada aturan saat dibeli.

Implikasi teknis: setiap bundle terjual dan setiap batch poin menyimpan **salinan aturan** yang berlaku saat ia dibuat.

Tanpa ini, satu perubahan angka di dashboard dapat diam-diam merugikan ribuan pelanggan sekaligus.

### 6.4 Promo

| Bentuk | Cara diperoleh | Tujuan |
|---|---|---|
| Otomatis | Berlaku sendiri bila syarat terpenuhi | Menaikkan nilai keranjang |
| Kode | Diketik pelanggan | Kampanye marketing, influencer, kerja sama |
| Voucher pribadi | Masuk ke akun pelanggan | Referral, kompensasi, ulang tahun, menarik kembali pelanggan hilang |

Atribut wajib setiap promo: periode berlaku · outlet berlaku · segmen sasaran · kuota total · kuota per pelanggan · minimal belanja · boleh digabung atau tidak.

Promo aplikasi dan promo kasir memakai **tabel yang sama** dengan penanda kanal (app / kasir / keduanya), sehingga tidak ada dua sistem promo yang harus disamakan manual.

**Kuota harus aman terhadap perebutan bersamaan** — dua pelanggan dapat menukarkan kuota terakhir di detik yang sama; hanya satu boleh berhasil. Bila pembayaran akhirnya gagal, kuota dikembalikan.

> **Prasyarat rilis:** audit mencatat bahwa ketiga pemanggil `increment_promo_usage` membuang nilai balik fungsi, sehingga ada pesanan yang mendapat diskon tanpa tercatat. **Bug ini harus diperbaiki sebelum aplikasi rilis** — volume aplikasi akan melipatgandakan kebocorannya.

### 6.5 Poin & Tier

- Poin masuk **setelah pesanan diambil**, bukan setelah dibayar — pesanan batal tidak menghasilkan poin
- Poin kedaluwarsa 6 bulan sejak transaksi terakhir; pengingat "poinmu hangus 7 hari lagi" adalah salah satu notifikasi paling efektif untuk menarik pelanggan kembali
- Tier dihitung dari belanja **90 hari terakhir**, bukan seumur hidup — status harus bisa turun, jika tidak semua orang akhirnya Gold dan tier kehilangan arti
- Benefit tier berupa **percepatan poin dan akses**, bukan diskon langsung. Diskon langsung menggerus setiap transaksi; poin hanya menjadi biaya bila ditukarkan

### 6.6 Bundle Prabayar

Pelanggan membayar sekali di muka dan menerima sejumlah kupon di dompet aplikasi. Tiap pemesanan, satu kupon ditukar dan item tercakup menjadi Rp0.

**Nilai bisnis:** uang masuk di depan · mengunci pelanggan (yang punya sisa kupon tidak beli di tempat lain) · kupon tidak terpakai menjadi margin · membawa belanja lain (minuman tetap dibayar penuh dan mendapat poin penuh).

| Aturan | Ketetapan |
|---|---|
| Paket (jumlah/harga/masa berlaku/menu) | Ditentukan pemilik dari dashboard |
| Berlaku di outlet mana | **Semua outlet yang ikut program** |
| Refund | **Tidak**, setelah kupon pertama dipakai |
| Hadiah ke orang lain | Tidak di v1 |
| Poin saat membeli bundle | **Tidak** — poin hanya dari belanja di luar kupon |
| Kupon hangus | Tanpa kompensasi; masa berlaku tertulis jelas saat pembelian |

Bundle dijual dengan **penghematan terpampang jelas** (nominal dan persentase), karena itulah alasan pelanggan membayar di muka.

**Konsekuensi akuntansi lintas outlet:** uang masuk di outlet A namun bahan keluar di outlet B. Diperlukan pencatatan pembagian pendapatan antar outlet — setiap penukaran kupon mencatat outlet penukar dan outlet penjual bundle, sehingga rekonsiliasi dapat dilakukan di laporan.

### 6.7 Referral

Setiap pelanggan memiliki kode unik. Pengajak dan yang diajak masing-masing menerima hadiah (nilai ditentukan pemilik) — **dicairkan hanya setelah yang diajak menyelesaikan dan mengambil pesanan pertamanya.**

Bila hadiah cair saat pendaftaran, program akan menjadi bancakan akun massal.

**Pagar wajib:**

- Kedua pihak harus memiliki nomor WhatsApp terverifikasi
- Satu perangkat maksimal satu akun referral
- Maksimal 10 referral berhasil per pelanggan per bulan
- Pengajak tidak menerima apa pun bila pesanan yang diajak dibatalkan atau di-refund

### 6.8 Misi

Tantangan berputar yang menaikkan frekuensi (contoh: "pesan 3× minggu ini", "coba menu baru", "pesan 2 hari berturut-turut"). Hadiah keluar **setelah** perilaku yang diinginkan terjadi, sehingga lebih murah dari diskon di muka. Dibuat dan diganti dari dashboard tanpa merilis ulang aplikasi.

### 6.9 Dompet — satu layar

Poin & tier, kupon bundle, voucher, kode referral, dan misi disajikan dalam **satu layar Dompet**, bukan tersebar. Termasuk peringatan poin yang akan hangus dan masa berlaku kupon.

---

## 7. Sisi Outlet

Aplikasi pelanggan yang sempurna tetap gagal bila kasir tidak menyadari pesanan masuk. Bagian ini menentukan keberhasilan pilot sama besarnya dengan aplikasinya sendiri.

### 7.1 Yang ditambahkan di sisi kasir

- **Penanda sumber "APP"** pada pesanan
- **Bunyi + notifikasi** saat pesanan aplikasi masuk — tidak ada orang yang berdiri menagih, sehingga mudah terlewat
- **Papan pesanan aplikasi** dengan alur status: Terima → Sedang dibuat → Siap diambil → Diserahkan
- **Pencarian kode ambil** — pelanggan menyebut kode, kasir mengetik, pesanan muncul

### 7.2 Kode pengambilan

Kode 4 digit ditampilkan besar di aplikasi, **dan** dalam bentuk QR. Kasir dapat memindai QR atau mengetik angka — layar HP retak atau redup sering terjadi, jangan hanya mengandalkan QR.

Status **"Diserahkan" ditandai oleh kasir**, bukan pelanggan. Bila pelanggan yang menandai, akan ada yang menandainya dari rumah.

### 7.3 Kesiapan operasional sebelum pilot

1. Pelatihan staf 2-3 outlet pilot, termasuk penanganan saat pesanan aplikasi masuk bersamaan antrean panjang
2. **Aturan prioritas ditetapkan** — usulan: pesanan aplikasi mengantre normal, karena pelanggan sudah diberi tahu perkiraan waktu
3. **Penanggung jawab "kosongkan item"** ditetapkan per outlet

### 7.4 Notifikasi ke pelanggan

Notifikasi transaksional dibatasi empat, agar tidak dimatikan pelanggan:

| Kapan | Isi |
|---|---|
| Pesanan diterima | Konfirmasi + perkiraan waktu siap |
| Siap diambil | Pemberitahuan + kode pengambilan |
| Belum diambil (30 menit) | Pengingat |
| Outlet tutup 1 jam lagi | Peringatan terakhir sebelum hangus |

Notifikasi pemasaran (promo, poin hangus, misi) **harus dapat dimatikan terpisah** dari notifikasi pesanan.

---

## 8. Data

### 8.1 Perubahan pada tabel existing (aditif)

| Tabel | Tambahan |
|---|---|
| menu | `tampil_di_app`, `foto_app`, `deskripsi_app` |
| orders | penanda sumber aplikasi, kunci idempotensi, kode pengambilan, rujukan pelanggan retail |
| outlets | penanda keikutsertaan program aplikasi |
| promo | penanda kanal berlaku (app / kasir / keduanya) |

Seluruhnya aditif — tidak mengubah perilaku POS, stok, atau BOM yang sudah berjalan.

### 8.2 Entitas baru (schema `retail`)

| Entitas | Isi |
|---|---|
| Profil pelanggan | identitas, nomor terverifikasi, kode referral, tier, preferensi notifikasi |
| Batch poin | jumlah, sumber, tanggal kedaluwarsa, salinan aturan saat diperoleh |
| Riwayat poin | perolehan & penukaran, terhubung ke pesanan |
| Paket bundle | definisi paket yang dijual |
| Bundle terbeli | pembelian, salinan aturan, sisa kupon, masa berlaku |
| Penukaran kupon | kupon mana, pesanan mana, outlet penukar vs outlet penjual |
| Voucher pelanggan | voucher pribadi & statusnya |
| Referral | pengajak, yang diajak, status pencairan |
| Misi & progres | definisi misi dan kemajuan per pelanggan |
| Jejak penggabungan akun | audit penggabungan |
| Pengaturan ekonomi | seluruh parameter di §6.2 |

### 8.3 Keamanan data

- Aplikasi tidak memiliki akses langsung; seluruh akses lewat Gateway dengan service role
- Gateway memvalidasi token sesi pada setiap permintaan dan **selalu** menurunkan identitas pelanggan dari token, tidak pernah dari isi permintaan
- Data pribadi pelanggan tidak boleh terbaca oleh aplikasi operasional lain di luar kebutuhan (kasir hanya perlu nama depan, kode ambil, dan isi pesanan)

---

## 9. Tahapan Pembangunan

| Tahap | Isi | Hasil |
|---|---|---|
| **0. Desain** | Sistem desain mobile · wireframe alur · 16 layar Tahap 1 · keadaan tak-normal · prototipe uji | Acuan visual yang siap dikoding, dipakai dua platform |
| **1. Fondasi** | Login Google + WhatsApp · katalog · pilih outlet · keranjang · validasi pra-bayar · pembayaran · pesanan masuk kasir · kode ambil · notifikasi status · papan pesanan kasir | **Aplikasi sudah bisa dipakai jualan.** Uji di 2-3 outlet pilot |
| **2. Retensi** | Poin & tier · Dompet · promo & voucher · riwayat & pesan ulang · Panel Ekonomi di dashboard · penggabungan akun | Pelanggan punya alasan kembali |
| **3. Pertumbuhan** | Bundle prabayar · referral · misi · banner dikelola marketing | Mesin uang-di-depan & akuisisi |

**Alasan urutan:** tahap 1 harus terbukti dulu. Bila pesanan aplikasi sering terlewat di kasir, atau pelanggan enggan membayar di aplikasi, maka poin dan bundle yang dibangun lebih dulu menjadi sia-sia. Setiap tahap adalah taruhan yang lebih besar dari sebelumnya.

**iOS dimulai setelah tahap 1 terbukti di Android.**

**Lingkup rencana implementasi pertama: Tahap 1 saja.** Tahap 2 dan 3 mendapat rencana tersendiri setelah pilot Tahap 1 memenuhi kriteria di §10. Menuliskan rencana untuk ketiganya sekarang berarti merencanakan di atas asumsi yang belum diuji.

---

### 9.1 Tahap 0 — Desain (sebelum satu baris kode Android)

Desain dikerjakan **sebelum** implementasi, bukan bersamaan. Alasannya menyangkut biaya langsung: aplikasi ini dibangun native di dua platform. Setiap perubahan tampilan yang terjadi saat sudah ngoding harus dikerjakan dua kali — sekali di Compose, sekali di SwiftUI. Desain yang matang di depan adalah satu-satunya cara membuat iOS menjadi murah.

Tahap 0 juga dibatasi agar tidak menjadi lubang waktu: **hanya layar Tahap 1**, dan hasilnya harus cukup tegas untuk langsung dikoding — bukan galeri konsep.

#### Arah desain

Pola navigasi, struktur layar, dan alur **mengikuti aplikasi F&B order-ahead yang sudah terbukti** (rujukan: Kopi Kenangan), sehingga pelanggan tidak perlu belajar cara pakai yang baru.

**Batas yang tidak dilewati:** tidak ada aset atau identitas visual merek lain yang disalin — logo, palet khas, foto, maupun ikon. Kerangka boleh sangat mirip; kulitnya murni Suka Shawarma. Ini risiko hukum nyata untuk merek yang terbit di Play Store, bukan sekadar kehati-hatian.

#### Keluaran

1. **Sistem Desain Mobile** — diturunkan dari `packages/design-system` yang sudah ada (Suka Orange `#f29744`, Suka Brown `#701604`, Lilita One + Plus Jakarta Sans), ditambah yang khas mobile: sasaran sentuh minimal 44pt, skala tipografi layar kecil, komponen kartu menu, tombol, bottom sheet, keadaan kosong & error, mode gelap.
   Dikerjakan **sekali**, diterjemahkan ke dua tema: Compose (Android) dan SwiftUI (iOS). Token yang sama membuat kedua aplikasi terlihat bersaudara tanpa memaksa keduanya identik.

2. **Wireframe alur** — kerangka hitam-putih: urutan layar dan isi tiap layar. Murah diubah, murah salah.

3. **16 layar Tahap 1**

   | Kelompok | Layar |
   |---|---|
   | Masuk | Onboarding · Pilihan login · Input nomor · Input OTP |
   | Belanja | Beranda/katalog · Pilih outlet · Detail item · Keranjang |
   | Bayar | Ringkasan & validasi · Pilih metode · Menunggu pembayaran (QRIS) |
   | Setelah | Sukses + kode ambil · Status pesanan · Riwayat |
   | Lainnya | Profil · Outlet tutup / belum buka |

4. **Keadaan tak-normal** — wajib didesain, bukan disisakan: memuat, kosong, gagal jaringan, item habis, harga berubah saat checkout, pembayaran gagal, outlet tutup mendadak. Setiap keadaan yang tidak didesain akan muncul sebagai layar putih atau pesan error mentah di depan pelanggan.

5. **Prototipe yang bisa diklik** — diuji ke 5-10 orang nyata **sebelum** dikoding. Menemukan kebingungan di prototipe berbiaya satu jam; menemukannya setelah rilis berbiaya ulasan bintang satu.

#### Cara kerja

Kanvas desain (skill `design`) sebagai wadah mockup, dengan `mobile-design` dan `high-end-visual-design` sebagai standar mutu, lalu `ui-review` dan `ui-a11y` sebagai pemeriksaan sebelum diterjemahkan ke Compose.

#### Batas lingkup

**Desain Tahap 2 & 3 dikerjakan saat tahapnya tiba**, bukan sekarang. Mendesain layar Dompet dan Bundle hari ini berarti mendesain di atas asumsi yang belum diuji pilot.

---

## 10. Kriteria Keberhasilan Pilot

Pilot 2-3 outlet dinyatakan berhasil dan layak disebar ke 19 outlet bila selama minimal dua minggu berturut-turut:

| Kriteria | Ambang |
|---|---|
| Pesanan terbayar yang gagal masuk ke kasir | 0 kasus tak tertangani |
| Selisih harga aplikasi vs kasir | 0 kasus |
| Pesanan kembar akibat webhook duplikat | 0 kasus |
| Pesanan dibayar untuk item yang ternyata habis | 0 kasus |
| Pesanan aplikasi terlewat lebih dari 15 menit di kasir | di bawah 2% |
| Staf outlet dapat menjalankan alur tanpa bantuan | Ya |

Kriteria ini sengaja berfokus pada **integritas transaksi dan operasional**, bukan jumlah unduhan — karena kegagalan pada baris-baris di atas adalah yang merusak kepercayaan secara permanen.

---

## 11. Risiko

| Risiko | Dampak | Penanganan |
|---|---|---|
| Gateway (VPS) mati | Aplikasi mati total | Health check + auto-restart; katalog di-cache di perangkat agar aplikasi tetap terbuka |
| Bug `increment_promo_usage` | Diskon tanpa tercatat, kebocoran berlipat karena volume | **Perbaiki sebelum rilis** (prasyarat) |
| `orders` memiliki policy `USING(true)` | Kebocoran data bila aplikasi diberi akses DB | Diselesaikan arsitektur: aplikasi tidak memegang kunci DB sama sekali |
| Akun terbelah (Google vs WhatsApp) | Poin & bundle pelanggan hilang | Penggabungan akun wajib dibangun (§3.3) |
| Kecurangan referral | Program terkuras | Wajib nomor terverifikasi + batas per perangkat & per bulan + cair setelah pesanan diambil |
| Nomor WhatsApp diblokir Meta | Pendaftaran baru mati total | Wajib memakai BSP resmi; larang gateway tidak resmi |
| Dua kodebase native divergen | Perilaku Android & iOS berbeda | Logika bisnis di server; aplikasi tipis; iOS dibangun dari spesifikasi yang sudah terbukti |
| Kasir kewalahan pesanan aplikasi | Pesanan terlewat, ulasan buruk | Pilot kecil dulu; bunyi notifikasi; pelatihan; aturan prioritas ditetapkan di awal |
| Perubahan parameter ekonomi berlaku surut | Pelanggan dirugikan diam-diam | Salinan aturan melekat pada poin & bundle (§6.3) |
| Sign in with Apple terlewat | Aplikasi iOS ditolak review | Masuk rencana sejak awal, bukan temuan saat submit |

---

## 12. Keputusan yang Ditunda

| Hal | Ditunda karena |
|---|---|
| Pengantaran (delivery) | Subsistem besar tersendiri (kurir, zona, ongkir, pelacakan) |
| Penjadwalan waktu ambil & pra-pesan | Mesin yang sama; tunggu data dari tombol "Ingatkan saya saat buka" |
| Saldo/dompet top-up | Menghindari ledger uang pelanggan & implikasi regulasinya di v1 |
| Langganan bulanan auto-debit | Butuh tokenisasi berulang, alur pembatalan & masa tenggang |
| Bundle sebagai hadiah | Menambah permukaan penyalahgunaan sebelum bundle terbukti |
| Pemecahan menjadi dua database | Hanya bila ambang di §2.2 tercapai; tidak memerlukan perubahan aplikasi |

---

**Pemilik keputusan:** Dev Suka Shawarma
**Berikutnya:** rencana implementasi (`docs/superpowers/plans/`)
