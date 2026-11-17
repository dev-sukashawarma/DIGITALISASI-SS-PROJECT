# Project Silent Eye: Konsep CCTV Anti-Fraud Kasir

> Nama kode **Project Silent Eye**: mengawasi diam-diam tanpa mengganggu kerja. Sebelumnya disebut "Kasir Watch".

**Status:** Konsep, belum disetujui owner. Belum ada kode, database, atau perangkat yang disentuh.
**Tanggal:** 17 November 2026
**Lingkup:** CCTV saja. Data POS sengaja **tidak** disambungkan di tahap ini.
**Fokus kecurangan:** **mengambil uang dari laci kasir** (lihat bagian 3a).
**Fitur opsional (17 Nov 2026):** **SOP kebersihan crew**, misalnya penutup rambut dan masker (lihat bagian 3b). Fokus utama tetap laci kasir. Fitur ini dikerjakan setelah deteksi laci berjalan, bila disetujui.
**Keputusan (17 Nov 2026):** sistem **dibangun sendiri**, dan video **tidak dikirim ke cloud vendor luar**. Produk komersial sejenis hanya dipakai sebagai pembanding (bagian 19).

### Keputusan owner (17 Nov 2026)

| # | Topik | Keputusan |
|---|---|---|
| D1 | Siapa yang menilai kartu bukti | **Tim kantor, role admin/developer.** Kontrol dan keputusan di kantor. AM **tidak** dilibatkan. |
| D2 | Identitas kasir di kartu | **Dari data absensi**: crew yang clock-in di outlet itu pada jam kejadian. Tanpa pengenalan wajah, tanpa POS. |
| D3 | Notifikasi | **Tanpa WhatsApp.** Kartu dicek di dashboard "Perlu Dicek". |
| D4 | Pemberitahuan ke kasir/crew | **Setelah pilot.** Uji kantor tidak melibatkan kasir. Sebelum pilot di outlet, cek dulu ke HR/legal (bagian 12). |
| D5 | Masa simpan klip | Wajar 90 hari · Mencurigakan 1 tahun · Investigasi sampai kasus ditutup. |
| D6 | Kamera atas laci + SOP pendukung | **Disetujui keduanya.** |
| D7 | Jam operasional untuk K2 | **Jam buka/tutup outlet di sistem** (`outlets.open_hour` / `close_hour`) ditambah jeda persiapan. |
| D8 | Tindak lanjut kartu "Investigasi" | **Admin/developer**, dan hasilnya dicatat kembali di kartu. |
| D9 | Peran owner | **Tidak ada akses** ke sistem. Owner menerima laporan dari admin/developer di luar sistem. |
| D10 | Jeda persiapan untuk K2 | **Ditentukan saat uji kantor**, dari kebiasaan nyata buka/tutup laci. Selama uji, K2 dicatat tanpa jeda untuk mengukurnya. |
| D11 | Perangkat uji kantor | **Paket A**: 2× TP-Link Tapo C110 (±Rp 600 rb), diolah di PC kantor. Pembanding Dahua/Hikvision PoE dan harganya ada di bagian 14a. |
| D12 | Kapan POS disambungkan | **Setelah pilot outlet berhasil.** |
| D13 | Outlet pilot | **SUKA SHAWARMA BNR.** |
| D14 | Cek HR/legal untuk pilot tanpa pemberitahuan | Owner menjawab **"ya"** (17 Nov 2026). Bentuk persetujuan HR/legal sebaiknya dilampirkan sebelum pilot BNR dimulai. |
| D15 | Tempat mengolah & menyimpan video | **Perangkat lokal dulu, VPS nanti.** Uji kantor: PC kantor. Pilot BNR: mini PC di BNR, diakses dari kantor lewat VPN terenkripsi (Tailscale). Server pusat baru dibutuhkan saat sistem dipakai banyak outlet. **Perangkat di BNR diputuskan setelah uji kantor**: mini PC N100, PC/laptop bekas, atau diolah di PC kantor (tetap butuh alat jembatan VPN di BNR). Dasarnya beban PC dan besar arus video yang terukur saat uji. |
| D17 | Bahasa Silent Eye Agent | **Python** (ekosistem AI: RF-DETR, MediaPipe, PyOD, paho-mqtt, supabase-py). |
| D16 | Rekaman penuh (bukan hanya klip kartu) | **Disimpan 30 hari di outlet**, lalu terhapus otomatis. Tidak dikirim ke pusat. Klip kartu tetap mengikuti D5. |

---

## 1. Latar belakang

Outlet menerima uang tunai di konter, dan pengawasan saat ini bergantung pada rekaman CCTV yang hanya dibuka bila ada kecurigaan. Rekaman jarang dicek karena terlalu banyak untuk ditonton, dan sering sudah tertimpa sebelum sempat dicek.

Konsep ini membuat CCTV **menandai sendiri** kejadian janggal di area kasir, menyimpan klip buktinya, lalu menyerahkan keputusan ke manusia (tim kantor: admin/developer). Seiring waktu, sistem **belajar** dari penilaian tim kantor.

## 2. Tujuan dan bukan tujuan

**Tujuan**
1. Menandai perilaku janggal di area kasir secara otomatis, lengkap dengan klip dan foto bukti.
2. Menyimpan bukti di server pusat agar tidak hilang tertimpa rekaman kamera.
3. Mengurangi waktu tim kantor menonton rekaman: yang ditonton hanya klip yang ditandai.
4. Mengumpulkan penilaian tim kantor sebagai bahan untuk melatih model yang makin akurat.
5. Menyiapkan data (jumlah pembeli per waktu) yang nanti bisa dicocokkan dengan POS.

**Bukan tujuan (tahap ini)**
- Tidak menyambungkan data POS. Kecurangan "uang diterima, order tidak diinput" belum bisa dibuktikan.
- Tidak memberi sanksi otomatis. Sistem hanya menandai.
- Tidak memakai pengenalan wajah.
- Tidak menonton seluruh rekaman 24 jam secara manual.

## 3. Prinsip

1. **Sistem menandai, manusia memutuskan.** Setiap kejadian berakhir di keputusan admin/developer, dan kasir diberi kesempatan menjelaskan sebelum ada sanksi.
2. **Video membuktikan apa yang terjadi, bukan niatnya.** Kartu bukti tidak boleh ditulis sebagai tuduhan.
3. **Bukti harus utuh.** Klip disalin ke pusat, diberi sidik digital, dan setiap akses tercatat.
4. **Jam harus akurat.** Jam kamera disinkronkan otomatis ke internet (NTP), dan selisihnya dicek rutin.
5. **Patokan per outlet.** Outlet ramai dan outlet sepi tidak disamakan.
6. **Mulai kecil.** Satu outlet uji coba dulu sebelum diperluas.
7. **Video milik sendiri.** Video dan klip hanya diolah dan disimpan di perangkat milik sendiri: mini PC di outlet dan server milik perusahaan. Tidak ada layanan AI pihak ketiga yang menerima video. Konsekuensinya: kamera harus bisa ditarik streamnya secara lokal (RTSP/ONVIF), bukan lewat cloud merek kamera.

## 3a. Fokus: mengambil uang dari laci

Kecurangan yang paling dikhawatirkan adalah **uang diambil dari laci kasir**. Modusnya dan kejadian yang menangkapnya:

| Modus | Seperti apa di kamera | Kejadian |
|---|---|---|
| Ambil uang saat sepi | Laci dibuka tanpa pembeli di depan, tangan keluar membawa uang | K1, K12 |
| Ambil saat buka/tutup toko | Aktivitas di laci di luar jam operasional | K2 |
| Diselipkan saat memberi kembalian | Uang diambil lebih dari kembalian, sebagian masuk ke saku | K9, K12 (butuh kamera atas laci) |
| Dipindah ke saku, tas, celemek, atau bawah konter | Tangan bergerak dari laci ke badan atau ke bawah konter | K12, K13 |
| Diambil orang selain kasir | Orang kedua menjangkau laci | K3 |
| Kamera dihalangi dulu | Gambar gelap, tertutup, atau sudutnya berubah | K5, K6 |
| Diambil saat menghitung uang tutup shift | Penghitungan uang dilakukan di luar jangkauan kamera | K2, K14 |

**Kunci keberhasilannya adalah kamera di atas laci.** Kamera biasa yang menyorot konter dari jauh hanya bisa melihat "ada orang di dekat laci". Kamera yang dipasang tepat di atas laci, menghadap ke bawah, bisa melihat laci terbuka, uang di tangan, dan arah tangan setelahnya. Bukti dari kamera seperti ini jauh lebih kuat, dan model jauh lebih mudah dilatih karena sudutnya sama di semua outlet.

**SOP pendukung (murah, tanpa teknologi)** yang membuat deteksi jauh lebih mudah:
1. Laci hanya dibuka saat ada transaksi.
2. Tidak boleh ada tas, dompet, atau HP di area laci.
3. Penghitungan uang (buka toko, tutup shift, setoran) **wajib di bawah kamera atas laci**.
4. Hanya kasir yang bertugas yang boleh menjangkau laci.

Dengan SOP ini, setiap pelanggaran langsung menjadi kejadian yang terlihat di kamera, bahkan sebelum model canggih dipakai.

## 3b. Fitur opsional: SOP kebersihan crew

> **Opsional.** Fokus utama sistem tetap pengambilan uang dari laci kasir (bagian 3a). Fitur ini baru dikerjakan setelah deteksi laci berjalan, dan hanya bila disetujui.

Bila diaktifkan, sistem juga memantau kepatuhan SOP kebersihan di **area racik shawarma**:

| Pelanggaran SOP | Tingkat kesulitan deteksi | Catatan |
|---|---|---|
| Tanpa penutup rambut (haircap) | Mudah | Terlihat jelas dari atas dan samping |
| Tanpa masker | Mudah | Model deteksi masker sudah umum |
| Tanpa celemek / seragam | Sedang | Model dilatih dengan seragam crew sendiri |
| Main HP di area racik | Sedang | Butuh sudut kamera yang cukup dekat |
| Tanpa sarung tangan saat memegang makanan | Lebih sulit | Sarung tangan plastik tipis sulit terlihat di kamera |

**Yang dibutuhkan:**
- **1 kamera tambahan** yang menghadap area racik. Kamera atas laci tidak melihat area masak. Biaya ±Rp 0,48 jt per outlet (Dahua 2 MP) atau ±Rp 0,28 jt (Tapo C110) untuk uji kantor.
- **Model khusus.** Model deteksi orang standar (YOLO) tidak mengenali penutup rambut, masker, atau sarung tangan. Model harus dilatih atau disetel ulang dengan rekaman crew kita sendiri (Tahap C). Untuk uji kantor bisa dimulai dengan model deteksi alat pelindung diri yang tersedia publik, lalu diukur akurasinya.

**Alurnya sama dengan kejadian laci:** kartu bukti, penilaian admin/developer (D1), masa simpan klip (D5), dan crew bertugas dari absensi (D2). Sistem tetap **tanpa pengenalan wajah**.

## 4. Zona kamera

Kamera kasir dibagi menjadi zona yang digambar sekali per outlet:

```
┌──────────────────────────────┐
│  [Zona LACI]   [Zona KASIR]  │  ← sisi dalam konter
│ ─────────── konter ───────── │
│        [Zona PEMBELI]        │  ← sisi luar konter
└──────────────────────────────┘
```

| Zona | Isi |
|---|---|
| LACI | Laci uang dan tangan yang menjangkaunya |
| KASIR | Posisi berdiri kasir |
| PEMBELI | Area pembeli berdiri saat memesan atau membayar |

**Syarat sudut kamera:** laci, tangan kasir, dan sisi pembeli harus terlihat dalam satu gambar, idealnya dari atas atau serong belakang kasir. Kamera yang hanya menyorot antrean tidak cukup.

**Disarankan dua kamera di area kasir:**
1. **Kamera konter** (serong belakang kasir): melihat zona KASIR dan PEMBELI, untuk tahu apakah ada pembeli yang sedang dilayani.
2. **Kamera atas laci** (tepat di atas, menghadap ke bawah): melihat laci, uang, dan tangan. Ini kamera utama untuk modus mengambil uang.

## 5. Katalog kejadian

| Kode | Kejadian | Kenapa janggal | Tahap |
|---|---|---|---|
| K1 | Aktivitas di zona LACI saat zona PEMBELI kosong | Laci dibuka tanpa ada pembeli yang dilayani | A |
| K2 | Aktivitas di zona LACI di luar jam operasional (jam buka/tutup outlet di sistem + jeda persiapan, D7) | Tidak ada alasan membuka laci saat tutup | A |
| K3 | Lebih dari satu orang di zona LACI | Uang dipegang orang yang bukan kasir | A |
| K4 | Zona KASIR kosong lama saat ada pembeli menunggu | Pelayanan bermasalah atau kasir di tempat lain | A |
| K5 | Kamera tertutup, gelap, kabur, atau sudutnya bergeser | Ada yang ingin tidak terekam | A |
| K6 | Kamera atau stream mati | Rekaman hilang di jam itu | A |
| K7 | Pola aktivitas zona menyimpang dari kebiasaan outlet | Lonjakan atau penurunan tak wajar | B |
| K8 | Laci terbuka terdeteksi langsung (bukan lewat orang di zona) | Lebih presisi dari K1 | C |
| K9 | Uang tunai di tangan tanpa pembeli di depan | Penanganan uang di luar transaksi | C |
| K10 | HP lama dipegang di area laci | Bisa transfer QRIS pribadi, bisa juga sekadar main HP | C |
| K11 | Gerakan tubuh tidak biasa | Pola gerak yang menyimpang dari kebiasaan | D |
| K12 | **Tangan dari laci bergerak ke saku, badan, atau tas** | Inti modus mengambil uang | C (aturan arah tangan) → D (pose) |
| K13 | Uang atau benda dipindah dari laci ke bawah konter | Uang disembunyikan untuk diambil belakangan | C |
| K14 | Uang dihitung di luar jangkauan kamera atas laci | Melanggar SOP hitung uang di bawah kamera | A (laci kosong orang lama saat jam hitung) → C |

| K15 | Crew di area racik tanpa penutup rambut | SOP kebersihan (bagian 3b) | C |
| K16 | Crew di area racik tanpa masker | SOP kebersihan | C |
| K17 | Crew tanpa celemek / seragam | SOP kebersihan | C |
| K18 | HP dipegang di area racik | SOP kebersihan | C |
| K19 | Memegang makanan tanpa sarung tangan | SOP kebersihan, paling sulit dideteksi | C → D |

**Prioritas untuk modus mengambil uang:** K1, K2, K3, K5 (Tahap A) dulu, lalu K12 dan K9 sebagai target utama Tahap C.
**Prioritas SOP kebersihan (opsional, setelah laci berjalan):** K15 dan K16 dulu karena paling mudah, lalu K17–K19.

Ambang setiap kejadian (berapa detik, berapa lama "kosong lama") ditetapkan saat uji coba, berdasarkan rekaman nyata outlet uji.

## 6. Kartu bukti

Setiap kejadian menghasilkan satu kartu:

```
┌────────────────────────────────────────────────────┐
│ ⚠ K1 · Laci aktif tanpa pembeli — Outlet Empang    │
│ 12 Nov 2026, 19:42:10 · durasi 35 detik             │
├────────────────────────────────────────────────────┤
│   [ Video 19:41:40 – 19:42:45 ]                    │
│   ▶ ━━━━━━●━━━━━━━━   ● awal   ● akhir kejadian     │
├────────────────────────────────────────────────────┤
│ Foto diam: [19:42:10] [19:42:25] [19:42:45]        │
│ Crew bertugas (absensi): Andi, Budi                 │
│ Penilaian: [Wajar] [Mencurigakan] [Investigasi]     │
│ Catatan penilai: ________________________           │
└────────────────────────────────────────────────────┘
```

Isi kartu:
1. Klip video sekitar ±30–60 detik di sekitar kejadian.
2. Penanda awal dan akhir kejadian di garis waktu video.
3. Foto diam di detik penting, untuk lampiran teguran atau laporan.
4. **Crew yang bertugas**, diambil otomatis dari data absensi (D2).
5. Penilaian dan catatan admin/developer, serta hasil tindak lanjut bila kartu naik ke Investigasi (D8).

Nama kasir **tidak** diambil dari wajah. Sistem mencari crew yang **clock-in di outlet itu dan belum clock-out** pada jam kejadian. Kalau ada lebih dari satu crew yang bertugas, semuanya ditampilkan, karena sistem tidak tahu siapa yang berdiri di laci. Penilai yang menentukan dari rekaman. Kartu menulis "crew bertugas", **bukan** "pelaku".

## 7. Peran

| Peran | Yang dilihat dan dilakukan |
|---|---|
| **Admin / Developer** (kantor) | Satu-satunya penilai: menonton klip, memberi penilaian, menindaklanjuti kartu Investigasi, dan mencatat hasilnya (D1, D8). Developer juga mengatur zona dan memantau kesehatan kamera serta perangkat outlet |
| Owner | **Tidak ada akses** ke sistem (D9). Menerima laporan dari admin/developer |
| AM | **Tidak** melihat dan tidak terlibat di sistem ini (D1) |
| Kasir dan crew | Tidak melihat sistem ini. **Diberi tahu setelah pilot** bahwa area kasir direkam dan dianalisis untuk audit (D4) |

## 8. Bagaimana sistem belajar (tahapan)

### Tahap A — Aturan zona (tanpa melatih model)
- Model pendeteksi orang yang sudah jadi (YOLO) + zona.
- Menghasilkan K1–K6 dan klipnya.
- Mencatat aktivitas tiap zona per menit (jumlah orang, lama di zona) sebagai bahan Tahap B.
- **Lanjut ke Tahap B bila:** stream stabil, klip tersimpan utuh, dan jumlah kartu per hari masih wajar untuk dicek tim kantor.

### Tahap B — Belajar pola normal tiap outlet
- Setelah 2–4 minggu data aktivitas zona, model deteksi anomali (mis. pustaka PyOD) mempelajari kebiasaan tiap outlet per jam dan per hari.
- Menghasilkan K7: penyimpangan dari kebiasaan outlet itu sendiri.
- Model dilatih ulang otomatis berkala, misalnya tiap minggu.
- **Lanjut ke Tahap C bila:** sudah ada cukup klip yang dinilai tim kantor (perkiraan awal: beberapa ratus).

### Tahap C — Belajar dari klip yang dinilai tim kantor
- Klip yang dinilai tim kantor dipakai untuk melatih model khusus yang mengenali **laci terbuka**, **uang tunai**, dan **HP**. Model jadi tidak mengenali benda-benda ini, jadi harus diajari dengan rekaman outlet sendiri.
- Untuk modus mengambil uang, target utamanya **K12**: lacak tangan yang keluar dari laci membawa uang, lalu lihat tujuannya (pembeli di depan = wajar; saku, badan, tas, bawah konter = ditandai). Ini jauh lebih mudah dengan kamera atas laci.
- Penilaian "Wajar" yang berulang menurunkan prioritas pola itu, sehingga alarm palsu berkurang.
- Menghasilkan K8–K10.

### Tahap D — Belajar gerakan tubuh (nanti)
- Model membaca pose kasir dan mempelajari gerakan normal, lalu menandai gerakan janggal (K11).
- Pendekatan ini dipakai riset seperti PoseLift. Masih tahap riset dan rawan alarm palsu, jadi baru dipertimbangkan setelah Tahap C terbukti berguna.

## 9. Arsitektur

```
Kamera kasir (Bardi / IP camera)
   │
   ▼
go2rtc  ── jembatan stream (khusus kamera Bardi/Tuya)
   │
   ▼
Mini PC di outlet
   • Frigate: deteksi orang, zona, rekam klip saat kejadian
   • hanya mengirim kejadian + klip, bukan seluruh video
   │
   ▼
Server pusat
   • simpan klip + sidik digital (hash) + log akses
   • aturan kejadian + model anomali (Tahap B dst.)
   │
   ▼
Halaman "Perlu Dicek" (admin-dashboard)
   • kartu bukti → penilaian tim kantor
   • penilaian tim kantor jadi bahan latihan model berikutnya
```

Pengolahan video dilakukan **di outlet**, supaya internet outlet tidak terbebani. Yang dikirim ke pusat hanya data kejadian dan klip pendek.

**Penyimpanan bertahap (D15):**

| Tahap | Olah & simpan | Akses admin/developer |
|---|---|---|
| Uji kantor | PC kantor | Langsung di PC kantor |
| Pilot BNR | Mini PC di BNR (Frigate + klip + halaman "Perlu Dicek") | Dari kantor lewat VPN terenkripsi (Tailscale). Video tidak diunggah ke mana pun |
| Banyak outlet | Mini PC tiap outlet + **server pusat milik sendiri** untuk dashboard gabungan | Lewat server pusat. Klip "Investigasi" disalin ke pusat supaya tidak hilang bila mini PC rusak |

Server pusat, kapan pun dibutuhkan, adalah **server milik sendiri** (VPS perusahaan atau server di kantor), bukan cloud vendor CCTV atau AI. Lokasi data center-nya dicatat di sini saat tahap itu tiba.

**Tanpa notifikasi WhatsApp (D3).** Semua kartu dicek di halaman "Perlu Dicek" (perlu login, hanya admin/developer). Halaman itu menampilkan jumlah kartu yang belum dinilai, supaya terlihat kalau antrean menumpuk. Notifikasi lewat GOWA bisa ditambahkan belakangan bila kartu ternyata sering terlambat dicek.

**Sumber data pendukung yang sudah ada di sistem** (hanya dibaca, tidak diubah):
- Absensi crew (clock-in/clock-out per outlet), untuk mengisi "crew bertugas" (D2).
- Jam buka/tutup outlet (`outlets.open_hour` / `close_hour`), untuk kejadian K2 (D7).

## 9a. Topologi koneksi

### Uji kantor (semua di jaringan lokal kantor)

```
┌─────────────────────── Jaringan lokal kantor ───────────────────────┐
│                                                                     │
│  [Kamera atas laci] ──┐                                             │
│   (menghadap bawah)   ├──► [Router kantor] ──► [PC kantor]          │
│  [Kamera konter] ─────┘     (LAN / WiFi)        go2rtc, Frigate,    │
│   (serong belakang)                             klip, rekaman 30 hr │
│                                                      │              │
│                                                      ▼              │
│                                             [Admin / developer]     │
│                                              buka "Perlu Dicek"     │
└─────────────────────────────────────────────────────────────────────┘
        Tidak ada video yang keluar ke internet.
```

### Pilot BNR (video diolah dan disimpan di outlet)

```
┌──────────────────── Outlet BNR ────────────────────┐        ┌──── Kantor ────┐
│                                                     │        │                │
│  [Kamera atas laci] ──┐                             │        │ [Admin /       │
│   PoE, menghadap bawah├──► [Switch PoE] ──┐         │        │  developer]    │
│  [Kamera konter] ─────┘    listrik + data │         │        │       ▲        │
│   PoE, serong                             ▼         │        │       │        │
│                     [Router BNR] ◄── [Mini PC N100] │        └───────┼────────┘
│                     internet outlet   Frigate, klip,│                │
│                           │           rekaman 30 hr,│                │
│                           │           Perlu Dicek,  │                │
│                           │           Tailscale     │                │
│        [UPS] menyalakan switch PoE + mini PC        │                │
└───────────────────────────┼─────────────────────────┘                │
                            └ ─ ─ ─ ─ ─ Internet, VPN Tailscale ─ ─ ─ ─┘
                              (hanya halaman & klip yang dibuka, bukan video penuh)
```

- Router BNR **tidak perlu diubah** dan tidak ada port yang dibuka ke publik. Tailscale dipasang di mini PC dan PC kantor.
- Arus video kamera hanya berputar di dalam outlet (kamera → switch → mini PC), jadi internet POS tidak terbebani.

### 20+ outlet (tiap outlet mengolah sendiri, pusat mengumpulkan hasil)

```
 [Outlet BNR]   [Outlet Empang]   [Outlet lain]   [Outlet ke-20+]
 kamera, PoE,   kamera, PoE,      ...             kamera, PoE,
 mini PC, UPS   mini PC, UPS                      mini PC, UPS
      ╲              │                 │              ╱
       ╲ ─ ─ ─ ─ VPN terenkripsi: kartu, foto, klip pendek ─ ─ ╱
                              ▼
               [Server pusat milik sendiri]
               dashboard semua outlet, penilaian,
               salinan klip Mencurigakan/Investigasi,
               kirim zona & model ke outlet
                 ▲                        │
                 │ dibaca                 ▼
   [Data sistem yang ada]        [Admin / developer]
   absensi, jam outlet           Perlu Dicek gabungan
```

| Di mana | Tugas | Yang disimpan |
|---|---|---|
| Tiap outlet | Deteksi, buat kartu, rekam terus | Rekaman penuh 30 hari (D16) + semua klip kartu |
| Jalur VPN | Kirim kartu, foto, status kesehatan kamera | Tidak menyimpan |
| Server pusat | Dashboard gabungan, catatan penilaian, kirim pengaturan zona & pembaruan model, pantau kesehatan (K6) | Data kartu, foto, penilaian, salinan klip Mencurigakan/Investigasi |
| Data sistem yang ada | Absensi & jam buka/tutup outlet | Hanya dibaca |

Syarat skala 20+ outlet: perangkat **seragam** di semua outlet (supaya model bisa dipakai bersama), pengaturan dikirim dari pusat (tanpa datang ke outlet), dan setiap mini PC melapor rutin ke pusat. Server pusat **tidak mengolah video**, jadi tidak perlu GPU.

Perkiraan kasar perangkat 20 outlet: 20 × Rp 7.443.800 (bagian 14a, harga live) ≈ **Rp 148.876.000**, belum termasuk tambahan penyimpanan di server pusat. Angka ini bisa turun bila kamera konter di sebagian outlet cukup memakai CCTV yang sudah ada (asal mendukung RTSP).

## 10. Kamera Bardi

> **Hasil uji kantor 17 Nov 2026: kamera Bardi (PTZ IP Camera) TIDAK bisa dipakai.** Tidak ada RTSP/ONVIF lokal (semua port tertutup). Lewat cloud Tuya, stream HLS hanya berisi animasi "memuat", dan go2rtc menggantung. Selain itu jalur cloud Tuya bertentangan dengan prinsip 7. Uji berikutnya memakai IP camera ber-RTSP (lihat bagian 14). Isi bagian ini di bawah dipertahankan sebagai catatan riwayat.

Bardi berbasis platform Tuya. Rekamannya ada di microSD atau cloud Bardi dan biasanya diakses lewat aplikasi, sehingga sistem tidak bisa langsung "minta klip jam sekian".

Jalan yang mungkin, **belum diverifikasi untuk model yang dipakai outlet**:
1. **go2rtc** menarik stream kamera Tuya lewat API cloud Tuya (RTSP atau HLS). Syaratnya berlangganan layanan *IoT Video Live Stream* di Tuya Developer Platform. Ada laporan bahwa di sebagian kamera RTSP gagal tetapi HLS berhasil.
2. Sebagian model Bardi tercatat bisa RTSP langsung (port 8554) menurut database komunitas iSpyConnect. Tergantung model.
3. Bila keduanya gagal: **ganti kamera kasir saja** dengan IP camera yang mendukung RTSP/ONVIF. Kamera Bardi lain (dapur, depan) tetap dipakai.

## 11. Penyimpanan dan integritas bukti

**Disetujui owner 17 Nov 2026 (D5):**

| Data | Lama disimpan |
|---|---|
| Klip kejadian yang dinilai "Wajar" | 90 hari |
| Klip "Mencurigakan" | 1 tahun |
| Klip "Investigasi" | Sampai kasus selesai |
| Data aktivitas zona per menit (tanpa video) | Bisa disimpan lama, dipakai untuk belajar |
| **Rekaman penuh semua kamera (D16)** | **30 hari, di outlet** (harddisk mini PC), lalu terhapus otomatis |

- Setiap klip diberi sidik digital (hash) saat disimpan, supaya terbukti tidak diedit.
- Setiap kali klip dibuka atau diunduh, tercatat siapa dan kapan.
- **Rekaman penuh disimpan 30 hari di outlet (D16).** Frigate merekam terus dan menghapus otomatis rekaman yang lebih tua dari 30 hari. Admin/developer bisa memutar ulang hari mana pun dalam 30 hari terakhir dari kantor lewat VPN, misalnya saat ada laporan uang hilang yang tidak tertangkap sistem.
- **Rekaman penuh tidak dikirim ke pusat.** Untuk 20 outlet × 2 kamera, ukurannya ±26–52 TB per bulan dan tiap outlet harus terus mengunggah 2–4 Mbps selama 24 jam. Yang disalin ke pusat hanya klip "Mencurigakan" dan "Investigasi", jadi klip itu tetap aman walaupun rekaman penuhnya sudah terhapus atau mini PC rusak.
- **Batas 30 hari disengaja.** Rekaman penuh berarti seluruh jam kerja karyawan terekam. Batas yang jelas mengurangi risiko kalau terjadi kebocoran dan lebih mudah dipertanggungjawabkan dari sisi UU PDP.

**Perkiraan ukuran rekaman penuh** (kamera 2 MP, gambar penuh):

| Format | Per kamera per hari (24 jam) | 2 kamera, 30 hari (24 jam) | 2 kamera, 30 hari (jam operasional ±10 jam) |
|---|---|---|---|
| H.264 (±2 Mbps) | ±21 GB | ±1,3 TB | ±540 GB |
| H.265 (±1 Mbps) | ±11 GB | ±650 GB | ±270 GB |

**Harddisk ±2 TB per outlet** sudah cukup untuk 30 hari dengan sisa ruang. Kamera dipasang memakai **H.265** bila didukung (Dahua dan Hikvision di bagian 14a mendukung).

## 12. Privasi dan aspek hukum

- **Pemberitahuan wajib, setelah pilot (D4):** kasir dan crew diberi tahu secara tertulis bahwa area kasir direkam dan dianalisis untuk audit, dan dipasang tanda di area kasir.
  - Uji kantor tidak melibatkan kasir sungguhan, jadi tidak ada masalah di tahap itu.
  - ⚠️ **Sebelum pilot di outlet berjalan tanpa pemberitahuan, wajib dicek dulu ke HR/legal.** Analisis rekaman karyawan secara diam-diam berisiko dari sisi UU PDP dan hubungan kerja. Klip dari masa itu juga bisa lemah kalau dipakai sebagai dasar sanksi. Alternatif aman: pilot berjalan dengan pemberitahuan umum "area kasir direkam" (CCTV memang sudah ada di outlet), tanpa merinci aturan deteksinya.
- **Tanpa pengenalan wajah.** Sistem hanya mendeteksi "ada orang" dan posisinya.
- **Akses terbatas** sesuai tabel peran di bagian 7.
- **Tidak ada sanksi tanpa keputusan manusia** dan tanpa kesempatan kasir menjelaskan.
- Kamera hanya menyorot area kerja, bukan area istirahat atau toilet.

Disarankan dikonsultasikan dengan pihak HR/legal sebelum diterapkan di semua outlet (UU PDP dan peraturan perusahaan).

## 13. Rencana uji coba

### 13.0 Uji kantor (dikerjakan pertama)

**Perangkat (D11):** 2× TP-Link Tapo C110 (RTSP `stream1`/`stream2`, ONVIF port 2020, lewat "Camera Account" di aplikasi Tapo), dipasang dekat router. Diolah di PC kantor dengan go2rtc + Frigate, hanya bisa diakses dari jaringan lokal.

**Meja kasir tiruan:** meja + kotak/laci pengganti laci uang + uang mainan. Satu kamera **di atas laci menghadap ke bawah**, satu kamera **serong belakang** melihat konter dan sisi pembeli.

**Skenario yang diperagakan:**

| Skenario | Yang diharapkan |
|---|---|
| Buka laci tanpa "pembeli" | K1 muncul |
| Ambil uang lalu masukkan ke saku | K1 muncul, dan klipnya disimpan untuk latihan K12 |
| Dua orang menjangkau laci | K3 muncul |
| Tutup kamera dengan tangan/kertas | K5 muncul |
| Matikan kamera / cabut listrik | K6 muncul |
| Buka laci di luar jam (jam diatur sementara) | K2 muncul. Jeda wajar diukur di sini (D10) |
| Transaksi normal: ada pembeli, beri kembalian | **Tidak boleh** muncul kartu |

**Lulus uji kantor bila:**
- semua skenario mencurigakan tertangkap,
- transaksi normal tidak memicu kartu, atau alarm palsunya bisa ditekan dengan menyetel ambang,
- klip tersimpan utuh dan jamnya cocok dengan kejadian.

Setelah lulus, lanjut ke pilot outlet (13.1) memakai perangkat setara Paket B.

### 13.0a Timeline usulan (dihitung sejak proposal disetujui)

| Waktu | Kegiatan | Hasil |
|---|---|---|
| Minggu 1 | Beli kamera, siapkan meja kasir tiruan, pasang go2rtc dan Frigate di PC kantor | Kamera tampil di sistem |
| Minggu 2–3 | Peragakan 7 skenario, setel ambang, ukur alarm palsu dan beban PC | Data lulus atau tidak lulus |
| Minggu 4 | Evaluasi uji kantor, putuskan perangkat BNR (D15) | Lanjut ke BNR atau perbaiki |
| Minggu 5 | Beli dan pasang perangkat BNR, terapkan SOP laci | BNR siap merekam |
| Minggu 6–9 | Pilot BNR 4 minggu (minggu pertama hanya mencatat) | Laporan hasil pilot |
| Minggu 10 | Evaluasi pilot bersama owner | Keputusan perluasan & sambung POS (D12) |
| Bulan 4 | Perluasan ke outlet wilayah Bogor | Outlet Bogor terpasang |
| Bulan 5 dst. | Perluasan ke outlet lainnya di luar Bogor, bertahap | Semua outlet terpasang |

**Urutan perluasan (17 Nov 2026):** uji kantor → pilot BNR → **outlet wilayah Bogor** → outlet lainnya.

Waktu bisa bergeser mengikuti pengiriman barang dan hasil tiap evaluasi.

### 13.1 Pilot outlet

**Lokasi:** **SUKA SHAWARMA BNR** (D13). Perangkat: 2 kamera PoE (atas laci + konter), switch PoE, mini PC N100, dan UPS. Diakses dari kantor lewat Tailscale (D15).

| Minggu | Kegiatan |
|---|---|
| 0 | Cek model Bardi, uji tarik stream (go2rtc), cek sudut kamera, sinkronkan jam |
| 1 | Pasang mini PC + Frigate, gambar zona, jalankan dalam mode "catat saja" |
| 2–3 | Kumpulkan kejadian K1–K6, admin/developer menilai klip, setel ambang |
| 4 | Evaluasi bersama owner, putuskan lanjut / ubah / hentikan |

Selama pilot, **tidak ada teguran ke kasir** berdasarkan sistem ini. Pilot hanya untuk mengukur apakah sistem menghasilkan kejadian yang berguna.

**Ukuran keberhasilan pilot:**
- Stream dan perekaman berjalan ≥ 95% dari jam operasional.
- Jumlah kartu per hari masih bisa dicek tim kantor (perkiraan: di bawah 10 per outlet per hari).
- Sebagian kartu dinilai tim kantor "layak dicek", bukan semuanya alarm palsu.
- Klip bisa dibuka dan jamnya cocok dengan kejadian nyata.

## 14. Perkiraan biaya (kasar, perlu dicek harga terkini)

| Komponen | Perkiraan |
|---|---|
| Mini PC per outlet | Rp 3–8 juta, tergantung spesifikasi |
| IP camera pengganti (bila Bardi tidak bisa) | Rp 500 ribu – 1,5 juta per outlet |
| Kamera atas laci (tambahan) | Rp 500 ribu – 1,5 juta per outlet |
| Langganan Tuya IoT Video (bila lewat cloud Tuya) | Perlu dicek, ada masa uji coba gratis |
| Penyimpanan klip di server | Kecil, karena hanya klip pendek |
| Pengembangan halaman "Perlu Dicek" | Waktu tim internal |

## 14a. Pembanding perangkat dan harga (cek marketplace 17 Nov 2026)

Harga adalah cuplikan listing Tokopedia dan toko online Indonesia pada 17 Nov 2026. **Bisa berubah**, jadi cek ulang sebelum membeli.

### Kamera

Syarat wajib: **RTSP + ONVIF tertulis jelas di spesifikasi**, lensa tetap, 2–4 MP, H.264, bukan kamera baterai. Untuk atas laci pakai bentuk **turret/dome dengan lensa 2,8 mm** (sudut paling lebar).

| Model | Resolusi | Koneksi | Harga per unit | Catatan |
|---|---|---|---|---|
| TP-Link Tapo C110 | 3 MP | WiFi | ±Rp 263–292 rb | RTSP/ONVIF resmi (`stream1`/`stream2`, ONVIF port 2020). Cloud + microSD + RTSP hanya bisa 2 dari 3 sekaligus. Kelas rumahan |
| **Dahua IPC-HDW1230T1-A-S5** | 2 MP | PoE | **±Rp 477 rb** | Turret indoor, ada mikrofon (**audio dimatikan**). Paling murah untuk kelas profesional |
| Dahua IPC-HDBW1230E-S5 | 2 MP | PoE | ±Rp 504 rb | Dome |
| Hikvision DS-2CD1323G0E-I | 2 MP | PoE | ±Rp 952 rb | Turret, lensa 2,8/4/6 mm |
| Hikvision DS-2CD1123G0E-I | 2 MP | PoE | ±Rp 810 rb – 1,04 jt | Dome |
| Hikvision DS-2CD1343G0E-I | 4 MP | PoE | ±Rp 1,08 jt | Turret, lensa 2,8/4 mm |
| Dahua IPC-HDW2441T-S (WizSense) | 4 MP | PoE / 12V | ±Rp 1,62 jt | Ada deteksi manusia bawaan |
| ~~Bardi / Tuya / Xiaomi~~ | — | — | — | **Tidak bisa dipakai**: tanpa RTSP lokal (lihat bagian 10) |

⚠️ **Mikrofon bawaan:** merekam suara karyawan punya konsekuensi privasi lebih berat daripada gambar. Audio dimatikan di pengaturan kamera, atau pilih model tanpa akhiran "-A".

### Listrik dan jaringan kamera

Kamera PoE menerima **listrik dan data lewat satu kabel LAN**, jadi tidak perlu stopkontak di plafon.

| Cara menyalakan kamera | Harga | Kapan dipakai |
|---|---|---|
| **Switch PoE** TP-Link TL-SF1005P (4 port PoE) | ±Rp 365–369 rb | **BNR**: kamera atas laci tanpa stopkontak di plafon, pemasangan rapi |
| Adaptor 12V per kamera + colok ke port LAN router | Murah, per kamera | **Uji kantor**, bila router punya port LAN kosong dan model kamera mendukung 12V DC (cek spesifikasi) |
| Injektor PoE per kamera | Per kamera | Pengganti switch bila hanya 1–2 kamera |
| Kabel LAN Cat6 + konektor | ±Rp 100–200 rb | Selalu, tergantung panjang |

### Komputer pengolah dan pendukung

| Barang | Harga | Kapan perlu |
|---|---|---|
| PC kantor yang sudah ada | Rp 0 | Uji kantor |
| Mini PC Intel N100 (lihat tabel "Mini PC: baru vs bekas" di bawah) | ±Rp 2,1–3,55 jt | BNR, bila dipilih mengolah di outlet (D15) |
| UPS kecil untuk mini PC + switch | ±Rp 0,8–1,2 jt | BNR |
| Penyimpanan ±2 TB untuk rekaman penuh 30 hari (D16) | ±Rp 0,9–2,6 jt | BNR. Lihat tabel "Penyimpanan" di bawah. Mini PC 512 GB saja tidak cukup |

### Mini PC: baru vs bekas

| Pilihan | Harga | Catatan |
|---|---|---|
| MSI Cubi N ADL N100 **barebone** (baru) | ±Rp 2,1 jt | Belum termasuk RAM dan SSD |
| GK3 Plus N100 8 GB / 256 GB (baru) | ±Rp 2,6 jt | Cukup untuk 2 kamera, penyimpanan rekaman ditambah terpisah |
| T9 Plus / BMAX B4 Plus N100 8 GB / 128–512 GB (baru) | ±Rp 2,8–3,0 jt | |
| Beelink S12 Pro / EQ12 N100 16 GB / 500 GB (baru) | ±Rp 3,2–3,55 jt | ⚠️ Revisi baru S12 Pro **tidak punya slot 2,5 inci**. Penambahan penyimpanan lewat slot M.2 kedua (PCIe 3.0 x1, cukup untuk video) |
| Mini PC N100 **bekas** | Tidak ditemukan | Pencarian tidak menemukan listing bekas yang jelas |
| Lenovo ThinkCentre Tiny M720q / M920q **bekas** (Intel gen 8) | Harga Indonesia tidak ditemukan | Banyak dijual bekas korporat. Sebagai patokan, di Eropa M720q i3/16 GB refurbished ±€289. iGPU Intel juga bisa dipakai Frigate |
| PC tower kantor **bekas** | Belum dicek | Kelebihannya: muat harddisk 3,5 inci khusus CCTV di dalamnya |

### Penyimpanan rekaman penuh (±2 TB)

| Pilihan | Harga | Catatan |
|---|---|---|
| **SSD NVMe 2 TB** (Lexar NM610 Pro, Team MP33 Pro, ADATA Legend 900, dll.) | ±Rp 1,8–2,6 jt | **Disarankan untuk mini PC**: masuk ke slot M.2 kedua. Daya tahan tulis cukup (±8–16 TB per tahun untuk 2 kamera) |
| HDD khusus CCTV 3,5 inci 2 TB (WD Purple / Seagate SkyHawk), baru | ±Rp 0,9–2,6 jt (selisih harga antar penjual besar) | Dirancang untuk rekam 24 jam. **Tidak muat di mini PC**: butuh PC tower atau rumah harddisk eksternal berlistrik sendiri |
| HDD 3,5 inci 2 TB biasa (Toshiba P300, WD Blue, Seagate Barracuda), baru | ±Rp 1,0–1,2 jt | Murah, tapi bukan untuk rekam 24 jam terus-menerus |
| HDD eksternal USB 2,5 inci 2 TB (WD My Passport, Toshiba Canvio) | ±Rp 1,2–1,3 jt | Mudah dipasang, tapi bukan untuk rekam 24 jam dan bisa tercabut |
| HDD **bekas** 2 TB | ±Rp 1,2 jt (hanya ketemu satu, sepaket dengan DVR bekas) | ❌ **Tidak disarankan** untuk rekaman bukti: harddisk adalah bagian yang paling cepat rusak, dan umur pemakaiannya tidak diketahui. Kalau terpaksa, cek SMART dan jam pemakaian dulu |

**Saran kombinasi BNR:**
- Mini PC N100 baru 8 GB (±Rp 2,6–3 jt) + SSD NVMe 2 TB di slot kedua (±Rp 1,8–2 jt) ≈ **Rp 4,4–5 jt**. Ringkas dan tanpa bagian berputar.
- Alternatif hemat: **PC tower bekas** + HDD CCTV 3,5 inci baru. Lebih besar dan lebih boros listrik, tapi harddisk khusus CCTV muat langsung di dalamnya.
- Harddisk **bekas** tidak dipakai untuk rekaman bukti.
| microSD di kamera (cadangan rekaman) | ±Rp 100–200 rb | Opsional |
| ~~Google Coral USB~~ | ±Rp 2,8 jt | **Tidak perlu.** N100 cukup untuk 1–2 kamera, dan produknya dicatat sudah dihentikan oleh sebagian penjual |

### Perbandingan paket uji kantor

| Paket | Isi | Total | Plus / minus |
|---|---|---|---|
| A — Tapo (D11) | 2× Tapo C110 | **±Rp 0,6 jt** | Paling murah. WiFi bisa putus, kelas rumahan, tidak dipakai lagi di BNR |
| **A' — Dahua PoE** | 2× Dahua IPC-HDW1230T1-A-S5 + switch PoE + kabel | **±Rp 1,45–1,55 jt** | Perangkat sama dengan BNR (tinggal dipindah), kabel lebih stabil. Tanpa switch (pakai adaptor 12V) bisa lebih murah |
| B' — Hikvision PoE 4 MP | 2× DS-2CD1343G0E-I + switch PoE + kabel | ±Rp 2,6–2,8 jt | Gambar lebih tajam untuk kamera konter |

### Tapo C110 vs Dahua IPC-HDW1230T1-A-S5: kelebihan dan kekurangan

| Aspek | TP-Link Tapo C110 | Dahua IPC-HDW1230T1-A-S5 |
|---|---|---|
| Harga per kamera | ✅ ±Rp 263–292 rb | ±Rp 477 rb |
| Total 2 kamera siap pakai | ✅ ±Rp 0,6 jt (tanpa perangkat tambahan) | ±Rp 1,45–1,55 jt (+ switch PoE & kabel), atau lebih murah dengan adaptor 12V |
| Resolusi | ✅ 3 MP | 2 MP (cukup untuk atas laci) |
| Koneksi | ❌ WiFi, bisa putus-putus dan sulit dibedakan dari masalah sistem | ✅ Kabel LAN (PoE), stabil |
| Listrik | Adaptor, butuh stopkontak dekat kamera | ✅ Lewat kabel LAN (PoE), tanpa stopkontak di plafon |
| RTSP / ONVIF | ✅ Ada, resmi (lewat "Camera Account" di aplikasi Tapo) | ✅ Ada, bawaan kamera profesional |
| Batasan fitur | ❌ Cloud Tapo, rekam microSD, dan RTSP hanya bisa 2 dari 3 sekaligus | ✅ Tidak ada batasan semacam itu |
| Ketergantungan aplikasi/cloud | ❌ Pengaturan awal wajib lewat aplikasi Tapo dan akun TP-Link | ✅ Diatur lewat jaringan lokal (browser/aplikasi Dahua), tanpa wajib cloud |
| Bentuk & pemasangan | Kamera meja/dinding, perlu bracket untuk menghadap ke bawah | ✅ Turret plafon, arahnya bisa diatur, cocok untuk atas laci |
| Kompresi | H.264 | ✅ H.265 (rekaman 30 hari ±separuh ukurannya) |
| Mikrofon | Ada | ❌ Ada (akhiran "-A"), harus dimatikan karena alasan privasi |
| Kelas perangkat | ❌ Rumahan | ✅ Profesional, dirancang menyala 24 jam |
| Garansi | Garansi resmi TP-Link Indonesia | Ada penjual yang mencantumkan garansi resmi Dahua 2–3 tahun |
| Bisa dipakai lagi di BNR | ❌ Tidak disarankan (WiFi, kelas rumahan) | ✅ Ya, tinggal dipindah. Tidak ada uang yang terbuang untuk kamera "khusus uji" |
| Kemudahan uji kantor | ✅ Paling cepat: colok listrik, sambung WiFi | Perlu kabel LAN ke router atau switch |

**Ringkasan:**
- **Pilih Tapo** bila tujuannya membuktikan alur software secepat dan semurah mungkin. Kameranya kemudian dianggap habis pakai.
- **Pilih Dahua** bila uji kantor sekaligus menjadi gladi bersih BNR. Selisih ±Rp 0,9 jt terbayar karena kamera dan switch-nya langsung dipakai di BNR, dan hasil uji lebih mirip kondisi outlet.

### Rincian biaya per barang (harga live Tokopedia, dicek 17 Nov 2026 sore)

⚠️ **Harga di tabel-tabel sebelumnya di bagian ini adalah cuplikan hasil pencarian dan sebagian sudah basi.** Tabel ini memakai harga yang dibaca langsung dari halaman produk, dan semua link dicek aktif. Harga memori sedang tinggi: mini PC N100 16 GB Rp 5,8–8 jt, SSD 2 TB Rp 4,7–6,1 jt. Karena itu rincian BNR memakai mini PC 8 GB + harddisk eksternal.

| Barang | Harga satuan | Uji kantor · Tapo | Uji kantor · Dahua | Pilot BNR |
|---|---|---|---|---|
| [Kamera TP-Link Tapo C110](https://www.tokopedia.com/pronetindo/tp-link-tapo-c110-home-security-wi-fi-camera-1730778406183273588) | Rp 379.000 | Rp 758.000 (2×) | — | — |
| [Kamera Dahua IPC-HDW1230T1-A-S5](https://www.tokopedia.com/bandarcctvsurabaya/dahua-ipc-hdw1230-2mp-ip-camera-indoor-1732301918805067430) | Rp 409.000 | — | Rp 818.000 (2×) | Rp 818.000 (2×) |
| [Switch PoE TP-Link TL-SF1005LP](https://www.tokopedia.com/tp-linkofficialsby/tplink-sf1005lp) | Rp 328.000 | — | Rp 328.000 | Rp 328.000 |
| [Kabel LAN Cat6 20 m ProffTech](https://www.tokopedia.com/profftechindonesia/kabel-lan-cat-6-utp-original-profftech-20-meter-qualitas-terjamin) | Rp 75.600 | — | Rp 226.800 (3×) | Rp 226.800 (3×) |
| [Mini PC GK3 Plus N100 8/256 GB](https://www.tokopedia.com/juragantablet/minipc-gk3-plus-2024-intel-n100-8-256gb-ssd-hdmi-vga-windows-11-pro) | Rp 3.199.000 | PC kantor | PC kantor | Rp 3.199.000 |
| [Harddisk Toshiba Canvio Basics 2 TB](https://www.tokopedia.com/toshibastorageoffic/toshiba-canvio-basics-2tb-harddisk-eksternal-usb-3-0) | Rp 2.135.000 | — | — | Rp 2.135.000 |
| [UPS APC 650 VA](https://www.tokopedia.com/newtechcomputer/ups-apc-650va-garansi-resmi) | Rp 737.000 | — | — | Rp 737.000 |
| **Total** | | **Rp 758.000** | **Rp 1.372.800** | **Rp 7.443.800** |
| Opsional: kamera area racik (SOP kebersihan, bagian 3b) | | +Rp 379.000 | +Rp 484.600 (kamera + kabel) | +Rp 484.600 |

- **20 outlet** ≈ 20 × Rp 7.443.800 = **Rp 148.876.000**, ditambah Rp 9.692.000 bila semua outlet memakai kamera area racik. Switch PoE 4 port cukup untuk 3 kamera.
- Kalau uji kantor memakai **Dahua**, kamera, switch, dan kabelnya dipindah ke BNR, sehingga belanja BNR tinggal **Rp 6.071.000**.
- Selisih harga Tapo dan Dahua per kamera hari ini hanya Rp 30.000.
- Harddisk eksternal portabel tidak dirancang untuk rekam 24 jam. Cukup untuk pilot, tapi untuk banyak outlet sebaiknya ditinjau ulang (HDD khusus CCTV di PC tower, atau SSD bila harga memori turun).
- Harga basi yang ketahuan saat pengecekan: Beelink S12 Pro Rp 3.550.000 → **Rp 8.060.000**; SSD Lexar NM610 Pro 2 TB Rp 1.949.000 → **Rp 6.123.200**; listing Tapo C110 di toko resmi TP-Link sudah dihapus (410).

~~Perkiraan lama berikut memakai harga pencarian yang sudah basi; angka yang berlaku ada di tabel "Rincian biaya per barang" di atas (Rp 7.443.800).~~
**Perkiraan total BNR (lama)** (2 kamera Dahua 2 MP ±Rp 0,95 jt + switch PoE ±Rp 0,37 jt + kabel ±Rp 0,15 jt + mini PC N100 8 GB ±Rp 2,6–3 jt + SSD 2 TB ±Rp 1,8–2 jt + UPS ±Rp 0,8–1,2 jt): **±Rp 6,7–7,7 jt**. Angka ini naik dari perkiraan sebelumnya (±Rp 5,5–6,5 jt) karena penyimpanan rekaman penuh 30 hari (D16) kini ikut dihitung. Mini PC bisa tidak dibeli bila hasil uji kantor menunjukkan video BNR boleh diolah di PC kantor (D15).

Sumber harga: listing Tokopedia (TP-Link Indonesia, Bandar CCTV Surabaya, Saber Technology, Delta Vision, Maxprovision, Millennium Central CCTV, Sanjayacomtronix, Beelink Official), Nale, dan Dinomarket, diakses 17 Nov 2026.

## 15. Risiko

| Risiko | Mitigasi |
|---|---|
| Stream Bardi tidak bisa ditarik | Ganti kamera kasir saja dengan IP camera |
| Terlalu banyak alarm palsu, tim kantor berhenti mengecek | Mulai dari sedikit jenis kejadian, setel ambang selama pilot |
| Sudut kamera tidak memadai | Geser atau tambah kamera sebelum pilot |
| Jam kamera tidak akurat | Sinkron NTP + cek selisih rutin |
| Internet outlet putus | Mini PC menyimpan sementara, lalu mengirim saat tersambung |
| Kecurigaan berlebihan merusak suasana kerja | Pemberitahuan terbuka, tidak ada sanksi otomatis |
| Model belajar dari penilaian tim kantor yang bias | Admin dan developer saling meninjau sampel penilaian secara berkala |
| Hanya admin/developer yang memegang bukti dan keputusan | Setiap penilaian, perubahan penilaian, dan pembukaan klip tercatat atas nama penggunanya, dan catatan ini tidak bisa dihapus. Owner bisa meminta catatan ini kapan saja lewat laporan |

## 16. Pertanyaan terbuka

Sudah terjawab: D1–D12 (lihat tabel keputusan di atas).

Masih terbuka:
1. **Lampiran persetujuan HR/legal** (D14), disimpan sebelum pilot BNR dimulai.
2. **Lokasi data center server pusat**, baru dibutuhkan saat sistem dipakai banyak outlet (D15).

## 17. Tahap sesudahnya (di luar dokumen ini)

**Kebersihan dapur** kini sudah masuk lingkup (bagian 3b, kejadian K15–K19).

Setelah CCTV berjalan, data POS bisa disambungkan sehingga kejadian video bisa dicocokkan dengan transaksi. Contohnya: jumlah pembeli per 15 menit dibandingkan dengan jumlah order, atau laci terbuka dicocokkan dengan ada/tidaknya pembayaran tunai di detik yang sama. Itu dibahas di dokumen tersendiri.

## 18. Referensi pustaka dan riset

- Frigate NVR (deteksi objek + zona + perekaman dari kamera RTSP) — https://www.sourceforge.net/projects/frigate.mirror
- Roboflow Supervision, menghitung orang dalam zona — https://supervision.roboflow.com/0.29.0/how_to/count_in_zone/
- go2rtc, modul Tuya (menarik stream kamera Tuya/Bardi) — https://pkg.go.dev/github.com/AlexxIT/go2rtc@v1.9.14/internal/tuya
- Tuya cloud capabilities — https://developer.tuya.com/en/cloud-capabilities
- iSpyConnect, data komunitas kamera Bardi — https://www.ispyconnect.com/camera/bardi
- PyOD, pustaka deteksi anomali — https://www.pypi.org/project/pyod/1.0.0/
- PoseLift, riset deteksi anomali berbasis pose di ritel — https://arxiv.org/html/2501.06591v1
- RetailS, dataset pencurian di ritel — https://arxiv.org/pdf/2603.04723v1
- Contoh produk komersial sejenis: StopLift — https://www.wikipedia.com/wiki/StopLift

## 19. Pembanding produk komersial

| Produk | Yang dideteksi | Arsitektur | Catatan untuk kita |
|---|---|---|---|
| Neuronetic Vision — Kitchen Hygiene Monitoring ([video](https://www.youtube.com/watch?v=lbZw0X0Ct1k)) | Sarung tangan, penutup rambut di area masak | Kamera IP → PC Windows di outlet → **AI di cloud vendor** → WhatsApp + dashboard | Peringatan WhatsApp dengan foto, kamera, jam. Banding antar-outlet |
| VISTA by UrSpayce ([video](https://www.youtube.com/watch?v=1w5f8X1Z-fY)) | 35+ pemeriksaan: kebersihan, masker, keramaian, meja kotor, lama antre kasir, jumlah pengunjung, ANPR, absensi pengenalan wajah | Kamera yang ada → **platform cloud vendor** → dashboard | Setiap peringatan punya bukti, penanggung jawab, dan status selesai. Laporan untuk owner & area manager |

**Pelajaran:**
- Arsitektur kita (kamera → komputer di outlet → AI → peringatan + dashboard) sama dengan produk komersial. Keduanya juga tidak memakai GPU khusus.
- Keduanya tetap butuh kamera yang streamnya bisa ditarik. Kamera Bardi kita kemungkinan juga tidak akan didukung.
- **Tidak ada yang menyebut deteksi pengambilan uang dari laci.** Itu fokus utama kita.
- Keduanya mengirim video ke cloud vendor di luar negeri. **Tidak dipakai** sesuai prinsip 7, hanya sebagai patokan fitur dan tampilan.
- Yang diambil: pola peringatan WhatsApp + foto, alur "bukti → penanggung jawab → status selesai", dan fitur kebersihan dapur sebagai tahap lanjutan.
- Absensi dengan pengenalan wajah tidak diambil. Kita sudah punya app `absensi`, dan sistem ini tetap tanpa pengenalan wajah.

## 20. Tech stack (usulan, hasil riset 17 Nov 2026, belum diputuskan)

### 20.1 Ringkasan

| Lapisan | Pilihan | Lisensi | Status |
|---|---|---|---|
| OS edge | Ubuntu Server 24.04 LTS + Docker Compose | Bebas | Usulan |
| Perekam + deteksi | **Frigate NVR** (memuat go2rtc) | MIT (nama "Frigate" merek dagang, jangan dipakai sebagai nama produk) | Usulan kuat |
| Akselerasi AI | **OpenVINO** di GPU bawaan Intel N100 | Apache 2.0 | Usulan kuat |
| Pesan internal | **MQTT (Mosquitto)**, topik `frigate/events` | EPL/EDL | Usulan |
| Silent Eye Agent | **Python** (paho-mqtt + supabase-py) | Milik sendiri | **Diputuskan (D17)** |
| Data kartu & penilaian | **Supabase** (tabel `cctv_*`, RLS admin/developer) | Sudah dipakai | Usulan |
| Halaman Perlu Dicek | **Next.js di `apps/admin-dashboard`** | Sudah dipakai | Usulan |
| Jaringan pribadi | **Tailscale** | Sudah dipakai | Usulan |
| Penyimpanan klip pusat (tahap banyak outlet) | **Garage** atau **SeaweedFS** (bukan MinIO) | AGPL / Apache 2.0 | Usulan |
| Model deteksi khusus (Tahap C) | **RF-DETR** (bukan Ultralytics YOLO) | Apache 2.0 | Usulan kuat |
| Deteksi tangan untuk K12 | **MediaPipe Hand Landmarker** | Apache 2.0 | Perlu uji |
| Pola normal per outlet (Tahap B) | **PyOD** | BSD-2 | Usulan |
| Pelabelan klip | **Label Studio** dipasang sendiri | Apache 2.0 (Community) | Usulan |

### 20.2 Temuan penting dari riset

1. **Frigate cocok untuk N100.** Dokumentasi Frigate mencatat Intel N100 ±15 ms per deteksi (MobileNetV2) dan ±25 ms (YOLO-NAS 320). Kapasitas ≈ 1000 / waktu deteksi, jadi ±40–65 deteksi per detik, lebih dari cukup untuk 2–3 kamera. Batasannya: N100 hanya bisa menjalankan **satu** detektor sekaligus.
2. **Frigate sudah menyediakan hampir semua yang dibutuhkan Agent:**
   - MQTT `frigate/events` mengirim `before`/`after` beserta `current_zones` dan `entered_zones`, jadi aturan "ada orang di zona laci, zona pembeli kosong" bisa dibaca langsung.
   - Zona punya `inertia` (harus beberapa frame berturut-turut) dan `loitering_time` (harus diam di zona minimal N detik). Keduanya berguna untuk menekan alarm palsu.
   - API HTTP (FastAPI) menyediakan `GET /api/events/<id>/clip.mp4`, `GET /api/events/<id>/snapshot.jpg`, `POST /api/events/<id>/retain` (klip tidak ikut terhapus), dan ekspor rekaman per rentang waktu.
   - Rekaman penuh 30 hari (D16) memakai `record` dengan retensi hari continuous. Skema konfigurasi berubah antar versi (`retain` lama vs `continuous`/`motion` baru), jadi ikuti dokumentasi versi yang dipasang.
3. **🔴 Hindari Ultralytics YOLO untuk model khusus.** Lisensinya AGPL-3.0. Menurut Ultralytics, pemakaian komersial, termasuk tool internal perusahaan, wajib membuka seluruh kode atau membeli lisensi Enterprise. **Penggantinya RF-DETR** (Apache 2.0, kode dan bobot COCO), yang juga sudah didukung Frigate lewat ONNX. Lisensi bobot hasil fine-tune RF-DETR perlu dicek di file LICENSE repositorinya.
4. **🔴 Jangan pakai Frigate+.** Layanan berbayar ini mengunggah gambar ke server Frigate untuk melatih model, sehingga bertentangan dengan prinsip 7.
5. **🔴 Jangan pakai MinIO untuk penyimpanan pusat.** Edisi komunitasnya masuk mode pemeliharaan (Des 2025), tanpa image Docker resmi dan tanpa konsol admin. Alternatifnya Garage (ringan, AGPL, tidak masalah selama dipakai tanpa diubah) atau SeaweedFS (Apache 2.0).
6. **K12 (tangan ke saku) butuh logika tambahan.** MediaPipe Hand Landmarker (Apache 2.0) hanya memberi titik-titik tangan. Aturan "pergelangan tangan bergerak dari zona laci ke area badan" harus dibuat sendiri, atau dilatih sebagai pengklasifikasi urutan gerak. Alternatifnya RTMPose (cepat di CPU, mendukung OpenVINO; lisensi perlu dicek).
7. **Fitur GenAI Frigate (deskripsi kejadian dengan Ollama lokal) belum cocok.** Dokumentasinya menyarankan tidak menjalankannya di CPU karena terlalu lambat. Bisa dipertimbangkan nanti di server pusat ber-GPU.
8. **Kamera Dahua:** RTSP `rtsp://<user>:<pass>@<ip>:554/cam/realmonitor?channel=1&subtype=0` (main stream, untuk rekaman) dan `subtype=1` (sub stream, untuk deteksi). Pola Frigate yang umum: rekam dari main stream, deteksi dari sub stream. Sinkronisasi jam NTP di kamera perlu dicek manual saat pemasangan.
9. **Alternatif NVR yang dipertimbangkan:** Viseron (Python, deteksi di CPU), ZoneMinder (matang tapi minim fitur AI modern), Shinobi (Node.js, komunitas lebih kecil). **Frigate dipilih** karena paling banyak dipakai untuk deteksi AI, punya API dan MQTT yang lengkap, dan berlisensi MIT.
10. **Aspek hukum (bukan nasihat hukum):** Pasal 17 UU PDP mengatur alat pemroses data visual di tempat umum: harus untuk keamanan, wajib ada informasi keberadaannya, dan tidak untuk mengidentifikasi orang. Kewajiban dasar pemrosesan data pribadi (Pasal 20 UU PDP, dipertegas PP 33/2026 menurut Hukumonline) tetap berlaku untuk karyawan. Ini memperkuat keputusan tanpa pengenalan wajah dan cek HR/legal (D14).

### 20.3 Masih perlu diputuskan
- ~~Bahasa Agent~~ → **Python** (D17).
- Penyimpanan klip pusat saat banyak outlet: Garage atau SeaweedFS.
- Model Tahap C: RF-DETR (disarankan) atau model bawaan Frigate saja dulu.

### 20.4 Referensi
- Frigate: [hardware](https://docs.frigate.video/frigate/hardware), [object detectors](https://docs.frigate.video/configuration/object_detectors), [API](https://docs.frigate.video/integrations/api), [MQTT](https://docs.frigate.video/integrations/mqtt), [zones](https://docs.frigate.video/configuration/zones), [record](https://docs.frigate.video/configuration/record), [GenAI](https://docs.frigate.video/configuration/genai), [Frigate+](https://docs.frigate.video/plus), [diskusi N100 OpenVINO](https://github.com/blakeblackshear/frigate/discussions/17679), [trademark](https://git.laurivan.com/Mirrors/blakeblackshear.frigate/src/branch/0.18/TRADEMARK.md)
- Lisensi model: [Ultralytics license](https://ultralytics.com/license), [forum Ultralytics soal AGPL on-premise](https://community.ultralytics.com/t/yolov11-agpl-license-for-on-premises-use/1529), [RF-DETR Apache 2.0](https://blog.roboflow.com/rf-detr-is-free-to-use-commercially/), [dokumentasi RF-DETR](https://rfdetr.roboflow.com)
- Tangan & pose: [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker), [RTMPose paper](https://arxiv.org/pdf/2303.07399.pdf), [rtmlib](https://github.com/mprib/rtmlib)
- Penyimpanan: [MinIO maintenance mode (InfoQ)](https://www.infoq.com/news/2025/12/minio-s3-api-alternatives), [alternatif MinIO (elest.io)](https://blog.elest.io/minio-is-in-maintenance-mode-your-guide-to-s3-compatible-storage-alternatives/)
- Pelabelan: [Label Studio + YOLO](https://labelstud.io/integrations/machine-learning/yolo), [template video object tracking](https://docs.humansignal.com/templates/video_object_detector)
- Kamera: [format RTSP Dahua](https://securitycamcenter.com/rtsp-url-address-format-dahua/), [Dahua NVR channel/subtype](https://www.smartrtsp.com/en-in/guides/dahua-nvr-rtsp-channel-subtype)
- Alternatif NVR: [Frigate vs ZoneMinder](https://dev.to/selfhostingsh/frigate-vs-zoneminder-35ji), [ZoneMinder vs Shinobi](https://dev.to/selfhostingsh/zoneminder-vs-shinobi-which-nvr-to-self-host-4n8l), [daftar alternatif Frigate](https://alternativeto.net/software/frigate-nvr)
- Hukum: [Hukumonline: pemrosesan data visual tidak sah](https://www.hukumonline.com/klinik/a/pemrosesan-data-visual-tidak-sah-ini-sanksinya-lt63368386819ef), [Hukumonline: batasan akses data karyawan](https://www.hukumonline.com/klinik/a/batasan-akses-data-pribadi-karyawan-oleh-perusahaan-lt5d0b056a7eb05), [Meridian Hukum: Pasal 17](https://meridianhukum.com/article/jerat-pidana-memasang-cctv-di-toilet-umum)
