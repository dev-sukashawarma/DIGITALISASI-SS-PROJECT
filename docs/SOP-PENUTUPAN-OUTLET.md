# SOP Penutupan Outlet

**Status:** DRAF untuk disetujui owner (13 Nov 2026)
**Berlaku untuk:** outlet internal & mitra yang berhenti beroperasi permanen.
Tutup sementara (libur, renovasi) TIDAK memakai SOP ini, pakai fitur tutup
sementara / emergency lock.

## Prinsip

1. **Data yang sudah berjalan tidak boleh hilang.** Outlet yang tutup di tengah
   bulan tetap tampil di laporan, filter, dan form input **sampai akhir bulan
   tutupnya**. Mulai tanggal 1 bulan berikutnya outlet hilang dari pilihan
   harian, tetapi tetap muncul saat melihat laporan periode lama.
2. **Tanggal tutup tercatat di sistem.** Tanggal itu ada di kolom
   `outlets.nonaktif_at`, terisi otomatis saat Admin menonaktifkan outlet.
   Jadi menonaktifkan di sistem dilakukan **di hari terakhir jualan**, tidak
   ditunda sampai akhir bulan.
3. **Outlet tidak pernah dihapus.** Selalu nonaktifkan, jangan delete (delete
   ikut menghapus riwayat order, stok, dan surat jalan).
4. **Semua sisa stok dan uang ditutup lewat sistem**, bukan dicatat di kertas.

## Peran

| Peran | Tanggung jawab |
|---|---|
| Owner | Memutuskan penutupan & tanggal hari terakhir jualan |
| Area Manager (AM) | Koordinator lapangan, menjalankan checklist di outlet |
| Kitchen / Gudang Pusat | Menghentikan kiriman, menerima retur stok |
| Finance | Setoran terakhir, kas kecil, biaya bulan tutup, closing |
| HR | Memindahkan atau menonaktifkan crew, menutup penugasan AM |
| Marcom | Mematikan promo & kanal online |
| Admin | Menonaktifkan outlet di sistem (langkah terakhir hari H) |

## Linimasa

### H-7 — Keputusan & pengumuman
- [ ] **Owner** menetapkan tanggal hari terakhir jualan (hari H) dan alasan tutup.
- [ ] **AM** memberi tahu crew dan semua divisi di atas.
- [ ] **HR** menyiapkan tujuan pindah tiap crew (outlet lain atau berhenti).
- [ ] **Owner/Finance** (khusus mitra): sepakati dengan mitra soal bagi hasil
      bulan terakhir dan sisa investasi.

### H-3 — Berhenti menambah stok
- [ ] **AM** menghentikan permintaan bahan dari outlet ini.
- [ ] **Kitchen** tidak menerbitkan surat jalan baru ke outlet ini. Surat jalan
      yang sudah dikirim **wajib diverifikasi outlet sebelum hari H** (kalau
      tidak, auto-verifikasi jam 02:00 akan menambah stok ke outlet yang sudah
      tutup).
- [ ] **Marcom** menjadwalkan promo outlet ini berakhir di hari H.

### Hari H — Hari terakhir jualan
Urutannya penting:
1. [ ] **Marcom/Admin** mematikan outlet di **aplikasi pelanggan**
       (App Retail → Outlet Aplikasi) dan di GoFood / GrabFood / ShopeeFood /
       TikTok GO (di portal merchant masing-masing).
2. [ ] **Crew** menyelesaikan semua pesanan, lalu **tutup shift** di POS.
       Tidak boleh ada order berstatus pending/preparing.
3. [ ] **Crew + AM** melakukan **opname penutupan** (hitung fisik semua bahan)
       dan memfinalisasinya. Opname ini wajib: tanpanya, saldo stok terakhir
       outlet tidak bisa dipercaya.
4. [ ] **Crew** menyetor seluruh uang tunai (setoran terakhir) dan
       mengembalikan sisa kas kecil ke Finance.
5. [ ] **AM** memastikan langkah 1–4 selesai, lalu memberi tahu Admin.
6. [ ] **Admin** menonaktifkan outlet di halaman **Outlet**. Tanggal tutup
       tercatat otomatis. Syaratnya, **HR sudah memindahkan atau menyesuaikan
       semua crew**. Begitu outlet nonaktif, POS dan absensinya dikunci; crew
       yang belum dipindah tidak bisa absen di mana pun.
7. [ ] **Admin** memastikan kanal pesanan otomatis (website/Order Online,
       GoFood, GrabFood) tidak lagi diarahkan ke outlet ini. Kalau masih,
       pesanan baru tetap masuk ke outlet yang sudah tutup (lihat kasus
       Sawangan di bawah).

### H+1 sampai H+3 — Bereskan sisa
- [ ] **AM** memindahkan sisa stok yang masih layak lewat **Mutasi Stok**
      (app Stok › Mutasi). Tujuannya **Gudang Pusat ATAU outlet lain**, dipilih
      AM sesuai jarak dan kebutuhan. Mutasi disetujui Admin Kitchen dan wajib
      diverifikasi oleh penerima. Sisa yang tidak layak dicatat sebagai
      **waste**. Target akhirnya: **saldo stok outlet = 0 untuk semua bahan**.
- [ ] **HR** memindahkan crew ke outlet baru (berlaku H+1) atau menonaktifkan
      akunnya bila berhenti. Langkah ini wajib selesai sebelum outlet
      dinonaktifkan (lihat Hari H langkah 6). HR juga menutup penugasan AM
      untuk outlet ini dan memeriksa kasbon crew yang masih berjalan.
- [ ] **Inventaris:** AM mencatat perpindahan aset (freezer, printer, tablet
      kasir, dll.) ke lokasi barunya.
- [ ] **Finance** memastikan semua pengajuan kas kecil outlet ini sudah
      diputuskan (tidak ada yang menggantung di Hub Approval).

### Sampai akhir bulan tutup
- [ ] **Finance** mencatat biaya terakhir outlet (sewa, PLN, PDAM, internet,
      gaji sampai hari H) ke bulan tutup. Outlet masih bisa dipilih di form
      sampai akhir bulan.
- [ ] **Finance** memutus biaya rutin agar tidak tercatat lagi di bulan berikutnya.

### Closing bulan tutup
- [ ] **Finance** memasukkan outlet ini di closing laba rugi bulan itu seperti
      biasa (data 1 s.d. hari H).
- [ ] **Owner/Finance** (khusus mitra): hitung & transfer bagi hasil bulan
      terakhir, lalu tutup data investasi mitra.
- [ ] **Admin** memeriksa ulang: saldo stok 0, tidak ada surat jalan / order /
      pengajuan yang menggantung.

## Yang belum didukung sistem (perlu dibangun)

Ditemukan dari penutupan **SAWANGAN (INTERNAL), 8 Nov 2026**:

| Celah | Kondisi sekarang |
|---|---|
| Outlet tutup masih muncul di aplikasi pelanggan | Sawangan masih `app_enabled = true` |
| Tidak ada opname penutupan | Opname terakhir Sawangan 11 Sep; 43 bahan masih bersaldo |
| Kanal pesanan otomatis tidak ikut berhenti | Website & GoFood masih mengirim pesanan ke Sawangan Internal sampai 8 Nov |
| Menonaktifkan outlet tidak ikut mematikan aplikasi pelanggan | 3 outlet tutup masih tampil sampai dimatikan manual 13 Nov |
| Aturan tampil "sampai akhir bulan" belum seragam | Sebagian layar menampilkan outlet tutup selamanya, sebagian langsung menyembunyikannya |
| Tidak ada checklist penutupan di sistem | Belum ada padanan Wizard Pembukaan Outlet untuk penutupan |

Usulan jangka panjang: **Wizard Penutupan Outlet**, kebalikan dari Wizard
Pembukaan. Wizard ini menampilkan checklist di atas beserta statusnya yang
dibaca langsung dari data (order pending, SJ menggantung, saldo stok, kas
kecil, crew aktif), dan tombol Nonaktifkan baru terbuka setelah langkah wajib
selesai.

## Keputusan owner (13 Nov 2026)

1. POS & absensi dikunci saat outlet dinonaktifkan. Karena itu **HR wajib
   memindahkan atau menyesuaikan crew lebih dulu**.
2. Sisa stok dipindah lewat **Mutasi Stok**, ke **Gudang Pusat atau outlet
   lain**.
3. Aplikasi pelanggan: Sawangan Internal, Depok Sukmajaya, dan Mitra Ciseeng
   sudah dimatikan 13 Nov (`app_enabled = false`).

## Kasus SAWANGAN (INTERNAL)

Outlet ini **berganti menjadi MITRA SAWANGAN DTC** (order pertama DTC
26 Sep 2026). Operasional internalnya praktis berhenti sekitar 25 Sep.
Masalah yang tertinggal:

- **Stok ±Rp 11 juta (43 bahan) masih tercatat di outlet internal.** Ledger
  terakhirnya 30 Sep, dan tidak pernah ada mutasi ke DTC. Barangnya
  kemungkinan dipakai DTC di lokasi yang sama, tetapi di sistem masih milik
  outlet yang sudah tutup.
- **Pesanan nyasar masih masuk sesudah tutup:** 1 website (30 Sep), 1 GoFood +
  3 GrabFood batal (20–21 Okt), dan 3 website (1 & 8 Nov). Totalnya
  Rp 222.834 penjualan completed yang tercatat di outlet tutup, bukan di DTC.
- **Tanggal tutup di sistem keliru:** `nonaktif_at` = 8 Nov, karena diisi dari
  pesanan terakhir yang ternyata nyasar. Tanggal sebenarnya ±25 Sep.
- **Dibereskan 13 Nov 2026** (skrip
  `SS COGS SET/penutupan-outlet-nolkan-stok-dan-pindah-pesanan-2026-11-13.sql`):
  - Sisa stok **4 outlet tutup** (Sawangan Internal, Ciseeng, Jatiasih,
    Sukmajaya) dinolkan: 155 baris `adjustment`, nilai persediaan turun
    Rp 26.127.866, termasuk 4 printer thermal yang sudah tidak dipakai.
    Laba tidak berubah.
  - 3 pesanan website November (Rp 107.642) dipindah ke DTC. Potongan
    stoknya memang sudah tercatat di DTC.
  - Pesanan nyasar September–Oktober dibiarkan karena bulannya sudah closing.
  - **Masih terbuka:** tanggal tutup (`nonaktif_at` 8 Nov, seharusnya ±25 Sep)
    dan sumber pesanan website/GoFood yang masih mengarah ke outlet lama.
