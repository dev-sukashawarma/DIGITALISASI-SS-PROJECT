# Konsep: CCTV Anti-Fraud Kasir ("Kasir Watch")

**Status:** Konsep, belum disetujui owner. Belum ada kode, database, atau perangkat yang disentuh.
**Tanggal:** 17 November 2026
**Lingkup:** CCTV saja. Data POS sengaja **tidak** disambungkan di tahap ini.
**Fokus kecurangan:** **mengambil uang dari laci kasir** (lihat bagian 3a).

---

## 1. Latar belakang

Outlet menerima uang tunai di konter, dan pengawasan saat ini bergantung pada rekaman CCTV yang hanya dibuka bila ada kecurigaan. Rekaman jarang dicek karena terlalu banyak untuk ditonton, dan sering sudah tertimpa sebelum sempat dicek.

Konsep ini membuat CCTV **menandai sendiri** kejadian janggal di area kasir, menyimpan klip buktinya, lalu menyerahkan keputusan ke manusia (AM). Seiring waktu, sistem **belajar** dari penilaian AM.

## 2. Tujuan dan bukan tujuan

**Tujuan**
1. Menandai perilaku janggal di area kasir secara otomatis, lengkap dengan klip dan foto bukti.
2. Menyimpan bukti di server pusat agar tidak hilang tertimpa rekaman kamera.
3. Mengurangi waktu AM menonton rekaman: yang ditonton hanya klip yang ditandai.
4. Mengumpulkan penilaian AM sebagai bahan untuk melatih model yang makin akurat.
5. Menyiapkan data (jumlah pembeli per waktu) yang nanti bisa dicocokkan dengan POS.

**Bukan tujuan (tahap ini)**
- Tidak menyambungkan data POS. Kecurangan "uang diterima, order tidak diinput" belum bisa dibuktikan.
- Tidak memberi sanksi otomatis. Sistem hanya menandai.
- Tidak memakai pengenalan wajah.
- Tidak menonton seluruh rekaman 24 jam secara manual.

## 3. Prinsip

1. **Sistem menandai, manusia memutuskan.** Setiap kejadian berakhir di keputusan AM, dan kasir diberi kesempatan menjelaskan sebelum ada sanksi.
2. **Video membuktikan apa yang terjadi, bukan niatnya.** Kartu bukti tidak boleh ditulis sebagai tuduhan.
3. **Bukti harus utuh.** Klip disalin ke pusat, diberi sidik digital, dan setiap akses tercatat.
4. **Jam harus akurat.** Jam kamera disinkronkan otomatis ke internet (NTP), dan selisihnya dicek rutin.
5. **Patokan per outlet.** Outlet ramai dan outlet sepi tidak disamakan.
6. **Mulai kecil.** Satu outlet uji coba dulu sebelum diperluas.

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
| K2 | Aktivitas di zona LACI di luar jam operasional | Tidak ada alasan membuka laci saat tutup | A |
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

**Prioritas untuk modus mengambil uang:** K1, K2, K3, K5 (Tahap A) dulu, lalu K12 dan K9 sebagai target utama Tahap C.

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
│ Penilaian AM: [Wajar] [Mencurigakan] [Investigasi]  │
│ Catatan AM: ____________________________            │
└────────────────────────────────────────────────────┘
```

Isi kartu:
1. Klip video sekitar ±30–60 detik di sekitar kejadian.
2. Penanda awal dan akhir kejadian di garis waktu video.
3. Foto diam di detik penting, untuk lampiran teguran atau laporan.
4. Penilaian dan catatan AM.

Nama kasir **tidak** diambil dari wajah. Selama POS belum disambungkan, AM mengisi siapa yang bertugas dari jadwal shift bila diperlukan.

## 7. Peran

| Peran | Yang dilihat dan dilakukan |
|---|---|
| AM | Kartu bukti outlet binaannya, menonton klip, memberi penilaian |
| Owner / Admin | Ringkasan semua outlet, tren per minggu, kartu yang naik ke investigasi |
| Developer | Konfigurasi zona, kesehatan kamera dan perangkat outlet |
| Kasir dan crew | Tidak melihat sistem ini, tetapi **diberi tahu** bahwa area kasir direkam untuk audit |

## 8. Bagaimana sistem belajar (tahapan)

### Tahap A — Aturan zona (tanpa melatih model)
- Model pendeteksi orang yang sudah jadi (YOLO) + zona.
- Menghasilkan K1–K6 dan klipnya.
- Mencatat aktivitas tiap zona per menit (jumlah orang, lama di zona) sebagai bahan Tahap B.
- **Lanjut ke Tahap B bila:** stream stabil, klip tersimpan utuh, dan jumlah kartu per hari masih wajar untuk dicek AM.

### Tahap B — Belajar pola normal tiap outlet
- Setelah 2–4 minggu data aktivitas zona, model deteksi anomali (mis. pustaka PyOD) mempelajari kebiasaan tiap outlet per jam dan per hari.
- Menghasilkan K7: penyimpangan dari kebiasaan outlet itu sendiri.
- Model dilatih ulang otomatis berkala, misalnya tiap minggu.
- **Lanjut ke Tahap C bila:** sudah ada cukup klip yang dinilai AM (perkiraan awal: beberapa ratus).

### Tahap C — Belajar dari klip yang dinilai AM
- Klip yang dinilai AM dipakai untuk melatih model khusus yang mengenali **laci terbuka**, **uang tunai**, dan **HP**. Model jadi tidak mengenali benda-benda ini, jadi harus diajari dengan rekaman outlet sendiri.
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
   • kartu bukti → penilaian AM
   • penilaian AM jadi bahan latihan model berikutnya
```

Pengolahan video dilakukan **di outlet**, supaya internet outlet tidak terbebani. Yang dikirim ke pusat hanya data kejadian dan klip pendek.

## 10. Kamera Bardi

Bardi berbasis platform Tuya. Rekamannya ada di microSD atau cloud Bardi dan biasanya diakses lewat aplikasi, sehingga sistem tidak bisa langsung "minta klip jam sekian".

Jalan yang mungkin, **belum diverifikasi untuk model yang dipakai outlet**:
1. **go2rtc** menarik stream kamera Tuya lewat API cloud Tuya (RTSP atau HLS). Syaratnya berlangganan layanan *IoT Video Live Stream* di Tuya Developer Platform. Ada laporan bahwa di sebagian kamera RTSP gagal tetapi HLS berhasil.
2. Sebagian model Bardi tercatat bisa RTSP langsung (port 8554) menurut database komunitas iSpyConnect. Tergantung model.
3. Bila keduanya gagal: **ganti kamera kasir saja** dengan IP camera yang mendukung RTSP/ONVIF. Kamera Bardi lain (dapur, depan) tetap dipakai.

## 11. Penyimpanan dan integritas bukti

Usulan awal, perlu disetujui owner:

| Data | Lama disimpan |
|---|---|
| Klip kejadian yang dinilai "Wajar" | 90 hari |
| Klip "Mencurigakan" | 1 tahun |
| Klip "Investigasi" | Sampai kasus selesai |
| Data aktivitas zona per menit (tanpa video) | Bisa disimpan lama, dipakai untuk belajar |

- Setiap klip diberi sidik digital (hash) saat disimpan, supaya terbukti tidak diedit.
- Setiap kali klip dibuka atau diunduh, tercatat siapa dan kapan.
- Rekaman penuh tetap di kamera/NVR outlet dengan masa simpan bawaannya. Sistem tidak menyalin seluruh rekaman.

## 12. Privasi dan aspek hukum

- **Pemberitahuan wajib:** kasir dan crew diberi tahu secara tertulis bahwa area kasir direkam dan dianalisis untuk audit. Dipasang juga tanda di area kasir.
- **Tanpa pengenalan wajah.** Sistem hanya mendeteksi "ada orang" dan posisinya.
- **Akses terbatas** sesuai tabel peran di bagian 7.
- **Tidak ada sanksi tanpa keputusan manusia** dan tanpa kesempatan kasir menjelaskan.
- Kamera hanya menyorot area kerja, bukan area istirahat atau toilet.

Disarankan dikonsultasikan dengan pihak HR/legal sebelum diterapkan di semua outlet (UU PDP dan peraturan perusahaan).

## 13. Rencana uji coba (pilot)

**Lokasi:** satu outlet, sebaiknya yang ramai dan kameranya sudah mengarah ke konter.

| Minggu | Kegiatan |
|---|---|
| 0 | Cek model Bardi, uji tarik stream (go2rtc), cek sudut kamera, sinkronkan jam |
| 1 | Pasang mini PC + Frigate, gambar zona, jalankan dalam mode "catat saja" |
| 2–3 | Kumpulkan kejadian K1–K6, AM menilai klip, setel ambang |
| 4 | Evaluasi bersama owner, putuskan lanjut / ubah / hentikan |

Selama pilot, **tidak ada teguran ke kasir** berdasarkan sistem ini. Pilot hanya untuk mengukur apakah sistem menghasilkan kejadian yang berguna.

**Ukuran keberhasilan pilot:**
- Stream dan perekaman berjalan ≥ 95% dari jam operasional.
- Jumlah kartu per hari masih bisa dicek AM (perkiraan: di bawah 10 per outlet per hari).
- Sebagian kartu dinilai AM "layak dicek", bukan semuanya alarm palsu.
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

## 15. Risiko

| Risiko | Mitigasi |
|---|---|
| Stream Bardi tidak bisa ditarik | Ganti kamera kasir saja dengan IP camera |
| Terlalu banyak alarm palsu, AM berhenti mengecek | Mulai dari sedikit jenis kejadian, setel ambang selama pilot |
| Sudut kamera tidak memadai | Geser atau tambah kamera sebelum pilot |
| Jam kamera tidak akurat | Sinkron NTP + cek selisih rutin |
| Internet outlet putus | Mini PC menyimpan sementara, lalu mengirim saat tersambung |
| Kecurigaan berlebihan merusak suasana kerja | Pemberitahuan terbuka, tidak ada sanksi otomatis |
| Model belajar dari penilaian AM yang bias | Owner meninjau sampel penilaian secara berkala |

## 16. Pertanyaan terbuka

1. Outlet mana yang dipakai untuk pilot? Sebaiknya outlet yang paling dicurigai ada uang hilang dari laci.
1a. Apakah owner setuju memasang **kamera atas laci** di outlet pilot, dan menjalankan SOP hitung uang di bawah kamera?
2. Model kamera Bardi apa yang terpasang di outlet itu, dan apakah ada kamera yang mengarah ke konter/laci?
3. Apakah outlet menyimpan rekaman di microSD, cloud Bardi, atau NVR?
4. Siapa yang menilai klip selama pilot: AM outlet itu, atau owner/admin langsung?
5. Masa simpan klip di bagian 11 disetujui atau perlu diubah?
6. Kapan POS akan disambungkan (untuk mendeteksi order tunai yang tidak diinput)?

## 17. Tahap sesudahnya (di luar dokumen ini)

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
