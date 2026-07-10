# Buku Panduan Sistem Absensi (SukaAbsen)

Panduan lengkap untuk **kru** dan **SPV/Leader** outlet Suka Shawarma. Ditulis dengan bahasa
sederhana dan **hanya berisi interaksi antara Anda dan sistem** — apa yang Anda lakukan, dan
apa yang sistem tampilkan sebagai balasannya.

> Panduan ini juga tampil di dalam aplikasi pada menu **Panduan**. Isi di bawah ini sama persis
> dengan data yang disuntikkan ke database (`system_guides`, `system_code = 'absensi'`) lewat file
> [`scripts/seed-panduan-absensi.sql`](../scripts/seed-panduan-absensi.sql).

---

## Bab 1 · Mengenal Sistem

### 1. Apa Itu SukaAbsen?
SukaAbsen menggantikan absen manual (tanda tangan atau kertas) dengan **pengenalan wajah otomatis**.
Setiap kali datang dan pulang kerja, Anda cukup **membuka aplikasi di HP pribadi Anda sendiri** dan
memindai wajah lewat kamera depan — tanpa kartu, tanpa sidik jari, tanpa mengetik apa pun. Absen
dilakukan dengan **akun Anda sendiri** (bukan lewat satu perangkat bersama), dan sistem memeriksa
lokasi (GPS) untuk memastikan Anda benar-benar berada di outlet.

Selain absen, dari akun Anda sendiri Anda juga bisa: mengisi **checklist tugas harian**, mengajukan
**cuti/izin**, mengajukan **kasbon**, serta melihat **riwayat kehadiran** Anda — semuanya dalam satu
aplikasi.

### 2. Cara Masuk (Login) dan Keluar
- **Masuk:** Buka aplikasi, sistem akan mengarahkan Anda ke halaman **Portal**. Ketik **Email/Username**
  dan **Kata Sandi** yang diberikan SPV/Leader, lalu tekan **Masuk**. Setelah berhasil, Anda otomatis
  dibawa ke Dashboard Absensi outlet Anda.
- **Keluar:** Tekan tombol **Keluar** (ikon pintu keluar) di menu. Untuk berpindah ke aplikasi lain,
  tekan **Kembali ke Portal**.

Akun Anda bersifat rahasia — jangan dibagikan. Jika muncul pesan **"Profil Staff Tidak Ditemukan"**,
berarti akun Anda belum terhubung ke outlet; hubungi Admin HR / SPV.

---

## Bab 2 · Absen Wajah lewat HP

### 1. Cara Absen Masuk dan Pulang
Absen dilakukan lewat **HP pribadi Anda sendiri** (login dengan akun Anda), bukan lewat satu perangkat
bersama. Anda hanya bisa mengabsenkan **wajah Anda sendiri** — wajah orang lain akan ditolak. Buka
menu **Beranda Saya / Absen**, lalu:
1. Berdiri tegak menghadap kamera depan HP dengan jarak wajar. Lepas masker, topi, atau kacamata hitam.
2. Sistem memindai lokasi Anda dulu (**"Memindai Lokasi Anda…"**) untuk memastikan Anda benar-benar
   berada di outlet.
3. Setelah kamera aktif, sistem mengenali wajah Anda dan menampilkan **"Halo, [nama Anda]"**.
4. Sistem meminta satu **gerakan kepala** (menoleh) — ini untuk memastikan Anda orang asli, bukan foto.
5. **Hadapkan wajah lurus kembali** ke kamera. Verifikasi terakhir dilakukan saat wajah Anda sudah
   lurus, bukan saat menoleh.
6. Jika berhasil, muncul tanda centang hijau dan tulisan **"Berhasil!"** beserta status Masuk/Pulang.

Kartu **Status Hari Ini** akan berubah otomatis: **Belum Absen** → **Sedang Bekerja** (setelah absen
masuk) → **Selesai Shift** (setelah absen pulang).

### 2. Kapan Kamera Absen Terbuka
Kamera tidak selalu aktif — hanya pada jam yang diizinkan:
- **Absen masuk** terbuka mulai **1 jam sebelum** jam masuk. Di luar itu muncul **"Belum Waktunya
  Absen"** lengkap dengan jam kamera akan terbuka.
- **Absen pulang** terbuka mulai **30 menit sebelum** jam pulang. Sebelum itu muncul **"Kamu sudah
  Clock-in hari ini!"** dengan keterangan jam kamera pulang akan dibuka.
- Setelah absen masuk **dan** pulang, muncul **"Shift Selesai!"** — Anda selesai untuk hari itu.

Pada daftar **Riwayat Absensi Terakhir**, absen masuk diberi label **Tepat Waktu** atau **Telat
(sekian menit)**, dan absen pulang diberi label **Selesai**.

### 3. Kalau Absen Ditolak atau Gagal
Kemungkinan penyebab dan solusinya:
- **"Belum Waktunya Absen"** — kamera baru terbuka mendekati jam masuk/pulang Anda. Tunggu sesuai jam
  yang tertera.
- **"Outlet Ditutup" / "Dikunci SPV"** — SPV mengunci absensi (mis. outlet libur). Hubungi SPV.
- **"Akses Lokasi Ditolak"** — Anda terdeteksi di luar area outlet; jaraknya ditampilkan dalam meter.
  Mendekatlah ke outlet lalu tekan **Coba Pindai Ulang Lokasi**. Pastikan izin lokasi (GPS) di
  perangkat menyala.
- **Wajah tidak dikenali** — pastikan wajah Anda sudah didaftarkan SPV/Leader. Bila penampilan berubah
  drastis, minta SPV melakukan **Enroll Ulang**.
- **Gerakan tidak terdeteksi** — ulangi, gerakkan kepala lebih jelas, lalu kembali menghadap lurus.

Jika tetap gagal berulang kali, laporkan ke SPV/Leader.

---

## Bab 3 · Checklist Tugas Harian (Kru)

### 1. Mengisi Checklist Buka dan Tutup Toko
Menu **Checklist Harian** berisi daftar tugas rutin outlet, terbagi dua tab: **Buka Toko** dan
**Tutup Toko**.
1. **Absen masuk dulu.** Selama Anda belum absen hadir hari ini, checklist **terkunci** dan muncul
   pesan "Checklist terkunci".
2. Pilih tab **Buka Toko** (pagi) atau **Tutup Toko** (sore).
3. Ketuk lingkaran di samping tugas untuk **mencentangnya**. Nama Anda dan jam centang akan tercatat.
   Bar **Progress** naik otomatis; saat 100% muncul ucapan "Tugas Selesai!".
4. Tugas berlabel **Wajib** sebaiknya diprioritaskan.

Catatan: hanya **orang yang mencentang** yang bisa membatalkan centang tugas tersebut. Perubahan yang
dibuat rekan Anda muncul **langsung (real-time)** tanpa perlu refresh.

---

## Bab 4 · Cuti dan Izin

### 1. Mengajukan Cuti atau Izin
Buka menu **Cuti**, lalu:
1. Tekan **Ajukan Cuti** untuk membuka form.
2. Pilih **Jenis**: Cuti Tahunan, Sakit (dengan Surat Dokter), Izin Tidak Dibayar, Cuti Melahirkan,
   atau Izin Lainnya.
3. Isi **Tanggal Mulai** dan **Tanggal Selesai** (tanggal selesai tidak boleh sebelum tanggal mulai —
   sistem akan menolak).
4. Tulis **Alasan/Keterangan** singkat.
5. Tekan **Kirim Pengajuan**. Statusnya menjadi **Menunggu Persetujuan** dari SPV/Leader dan HR.

### 2. Memantau Status dan Sisa Kuota Cuti
Di bagian atas halaman **Cuti** ada tiga kotak: **Total Kuota Tahunan**, **Cuti Terpakai**, dan
**Sisa Kuota** (hari). Periksa sisa kuota sebelum mengajukan cuti baru.

Di bawahnya, daftar **Riwayat Pengajuan** menampilkan setiap pengajuan beserta statusnya:
**Menunggu Persetujuan**, **Disetujui**, atau **Ditolak**. Jika ditolak, alasan penolakan dari atasan
ikut ditampilkan.

---

## Bab 5 · Kasbon

### 1. Mengajukan Kasbon dan Memilih Cicilan
Buka menu **Kasbon**, tekan **Ajukan Kasbon**, lalu isi:
1. **Nominal (Rp)** — jumlah yang ingin dipinjam (harus lebih dari 0).
2. **Skema Cicilan** — 1 sampai 6 bulan. Sistem menampilkan **estimasi cicilan per bulan** secara
   otomatis; makin pendek cicilan, makin besar potongan per bulan.
3. **Alasan Pengajuan** — jelaskan singkat tujuan kasbon.
4. Tekan **Kirim Pengajuan**. Statusnya **Menunggu Persetujuan** hingga disetujui atasan/HR sebelum
   dana dicairkan.

### 2. Memantau Riwayat dan Status Kasbon
Bagian **Riwayat Pengajuan Kasbon** menampilkan semua kasbon yang pernah Anda ajukan: nominal, lama
cicilan, tanggal pengajuan, dan status (**Menunggu / Disetujui / Ditolak**). Gunakan untuk mengecek
cicilan yang masih berjalan sebelum mengajukan kasbon baru.

---

## Bab 6 · Akun dan Riwayat Saya

### 1. Melihat Riwayat Absensi Saya
Pada halaman **Absen**, di bawah kamera terdapat **Riwayat Absensi Terakhir** yang menampilkan absen
masuk/pulang Anda beserta jam dan statusnya. Gunakan untuk memastikan absen Anda tercatat benar. Bila
ada yang tidak sesuai, segera laporkan ke SPV/Leader.

### 2. Mengganti Kata Sandi
Buka menu **Profil**:
1. Kolom **Email Login** hanya untuk info dan tidak bisa diubah.
2. Isi **Password Baru** (minimal 6 karakter) dan **Konfirmasi Password Baru** (harus sama).
3. Tekan **Update Password**. Sistem menampilkan konfirmasi bila berhasil.

Untuk mengubah **nama, peran, atau foto wajah**, hubungi SPV/Kepala Outlet — hal itu tidak bisa Anda
ubah sendiri.

---

## Bab 7 · Untuk SPV dan Leader: Kehadiran dan Checklist

### 1. Memantau Papan Kehadiran Real-Time
Menu **Papan Kehadiran** menampilkan status kehadiran seluruh kru **hari ini secara langsung**:
- Bar persentase kehadiran (Hadir / Telat / Alpha) dan ringkasan jumlah per status.
- Daftar staf dengan label status: Masuk, Telat, Belum Hadir, Alpha, Keluar, dll.
- Filter untuk menampilkan status tertentu, dan foto selfie absen yang bisa **diklik untuk diperbesar**.

### 2. Melihat Rekap dan Mengunduh Laporan (CSV)
Menu **Rekap & Riwayat**:
1. Pilih **tanggal** yang ingin dilihat.
2. Sistem menampilkan ringkasan **Tepat / Telat / Alpha / Pulang Awal** dan daftar detail per orang.
3. Gunakan dropdown **filter status** untuk menyaring.
4. Tekan **Export CSV** untuk mengunduh laporan tanggal tersebut (file dapat dibuka di Excel).

### 3. Memantau Progres Checklist Kru
Menu **Monitor Checklist** menampilkan tugas mana yang sudah/belum dicentang kru **hari ini secara
real-time**, terbagi tab **Buka Toko** dan **Tutup Toko**, lengkap dengan **siapa** yang mencentang
dan **jam**-nya. Tekan **Refresh** untuk memuat ulang bila perlu.

### 4. Menyusun Daftar Checklist (Kategori dan Tugas)
Menu **Manajemen Checklist**:
1. Pilih tab **Sebelum Buka** atau **Sebelum Pulang**.
2. Tekan **Tambah Kategori**, isi nama (mis. "Kebersihan") dan **Fase** (buka/tutup), lalu simpan.
3. Di dalam kategori, tekan **Tambah Tugas**, isi nama tugas, dan tentukan apakah **Wajib**.
4. Gunakan ikon **edit** / **hapus** untuk mengubah atau menghapus kategori dan tugas.

Daftar yang Anda susun inilah yang muncul di halaman **Checklist Harian** kru.

---

## Bab 8 · Untuk SPV dan Leader: Wajah dan Pengaturan

### 1. Mendaftarkan Wajah Kru (Enrollment dan Enroll Ulang)
Menu **Enrollment Crew**. Halaman terbagi dua: **Belum Terdaftar** dan **Sudah Terdaftar**.
1. Pilih outlet (bila membina lebih dari satu) lewat pemilih outlet di atas.
2. **Mendaftarkan baru:** pilih nama kru di **Belum Terdaftar**. Kru mencentang **Persetujuan Privasi
   (UU PDP)** — wajib. Tekan **Mulai Perekaman Kamera**.
3. Minta kru menghadap kamera **lurus (frontal)**, jangan menoleh. Sistem mengambil **3 gambar
   otomatis** (ditandai tiga titik hijau), lalu menyimpannya sendiri. Muncul **"Enrollment Selesai!"**.
4. **Enroll ulang:** pilih kru di **Sudah Terdaftar**, tekan **Enroll Ulang**. Konfirmasi bahwa data
   wajah lama akan ditimpa, isi **alasan** (opsional), lalu rekam ulang seperti langkah di atas.

Akun kru baru dibuatkan oleh **Admin HR** terlebih dahulu; setelah itu barulah wajahnya di-enroll di
sini.

### 2. Mengatur Mode Absensi, Jam Kerja, dan Toleransi
Menu **Pengaturan Absensi**:
1. **Mode Absensi Kiosk:**
   - **Otomatis** — kamera buka/tutup sendiri mengikuti jam kerja (masuk 1 jam sebelumnya, pulang 30
     menit sebelumnya). Toggle di bawahnya berfungsi sebagai **Emergency Lock** (kunci darurat).
   - **Manual** — Anda menyalakan/mematikan kiosk sendiri lewat toggle **Status Kiosk**.
2. **Jam Shift Kerja** — atur **jam mulai masuk** dan **jam boleh pulang**.
3. **Toleransi Keterlambatan (menit)** — kru yang absen setelah jam masuk tapi masih dalam batas
   toleransi tetap dihitung **Tepat Waktu**.
4. Tekan **Simpan Perubahan**.
