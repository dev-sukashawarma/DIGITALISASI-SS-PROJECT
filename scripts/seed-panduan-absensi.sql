-- =====================================================================
-- Suntikan panduan Sistem Absensi (SukaAbsen) ke tabel `system_guides`.
--
-- Cara pakai:
--   Buka Supabase Dashboard -> SQL Editor -> tempel isi file ini -> Run.
--   (SQL Editor berjalan sebagai service role sehingga melewati RLS.)
--
-- Aman diulang: seluruh baris `absensi` lama dihapus dulu, lalu diisi ulang.
-- Kolom yang dipakai halaman Panduan: system_code, category, title,
-- content_html, sort_order. Kolom image_url dibiarkan NULL (belum ada gambar).
-- Sumber teks: docs/PANDUAN-ABSENSI.md
-- =====================================================================

BEGIN;

-- 1. Bersihkan panduan absensi lama agar tidak duplikat.
DELETE FROM public.system_guides WHERE system_code = 'absensi';

-- 2. Isi ulang dengan 18 topik dalam 8 bab.
--    Urutan kolom: system_code, category, sort_order, title, content_html.
--    (image_url dibiarkan default NULL.)
INSERT INTO public.system_guides (system_code, category, sort_order, title, content_html) VALUES

-- ── Bab 1 · Mengenal Sistem ──
('absensi', 'Bab 1 · Mengenal Sistem', 1, 'Apa Itu SukaAbsen?',
 '<h3>Kenalan dengan SukaAbsen</h3><p>SukaAbsen menggantikan absen manual (tanda tangan atau kertas) dengan <strong>pengenalan wajah otomatis</strong>. Setiap kali datang dan pulang kerja, Anda cukup <strong>membuka aplikasi di HP pribadi Anda sendiri</strong> dan memindai wajah lewat kamera depan — tanpa kartu, tanpa sidik jari, tanpa mengetik apa pun. Absen dilakukan dengan <strong>akun Anda sendiri</strong> (bukan lewat satu perangkat bersama), dan sistem memeriksa lokasi (GPS) untuk memastikan Anda berada di outlet.</p><p>Selain absen, dari akun Anda sendiri Anda juga bisa mengisi <strong>checklist tugas harian</strong>, mengajukan <strong>cuti/izin</strong>, mengajukan <strong>kasbon</strong>, serta melihat <strong>riwayat kehadiran</strong> — semuanya dalam satu aplikasi.</p>'),

('absensi', 'Bab 1 · Mengenal Sistem', 2, 'Cara Masuk (Login) dan Keluar',
 '<h3>Masuk dan Keluar Aplikasi</h3><p><strong>Masuk:</strong> Buka aplikasi, sistem mengarahkan Anda ke halaman <strong>Portal</strong>. Ketik <strong>Email/Username</strong> dan <strong>Kata Sandi</strong> dari SPV/Leader, lalu tekan <strong>Masuk</strong>. Setelah berhasil, Anda otomatis dibawa ke Dashboard Absensi outlet Anda.</p><p><strong>Keluar:</strong> Tekan tombol <strong>Keluar</strong> di menu. Untuk berpindah ke aplikasi lain, tekan <strong>Kembali ke Portal</strong>.</p><p>Akun Anda rahasia — jangan dibagikan. Jika muncul pesan <strong>Profil Staff Tidak Ditemukan</strong>, akun Anda belum terhubung ke outlet; hubungi Admin HR / SPV.</p>'),

-- ── Bab 2 · Absen Wajah di Kiosk ──
('absensi', 'Bab 2 · Absen Wajah lewat HP', 1, 'Cara Absen Masuk dan Pulang',
 '<h3>Langkah Absen Lewat HP</h3><p>Absen dilakukan lewat <strong>HP pribadi Anda sendiri</strong> (login dengan akun Anda), bukan lewat satu perangkat bersama. Anda hanya bisa mengabsenkan <strong>wajah Anda sendiri</strong> — wajah orang lain akan ditolak. Buka menu <strong>Beranda Saya / Absen</strong>, lalu ikuti urutan berikut:</p><ol><li>Berdiri tegak menghadap kamera depan HP dengan jarak wajar. Lepas masker, topi, atau kacamata hitam.</li><li>Sistem memindai lokasi Anda dulu (<strong>Memindai Lokasi Anda...</strong>) untuk memastikan Anda berada di outlet.</li><li>Kamera aktif, sistem mengenali wajah dan menampilkan <strong>Halo, [nama Anda]</strong>.</li><li>Sistem meminta satu <strong>gerakan kepala</strong> (menoleh) untuk memastikan Anda orang asli, bukan foto.</li><li><strong>Hadapkan wajah lurus kembali</strong> ke kamera. Verifikasi terakhir dilakukan saat wajah sudah lurus, bukan saat menoleh.</li><li>Jika berhasil, muncul centang hijau dan tulisan <strong>Berhasil!</strong> beserta status Masuk/Pulang.</li></ol><p>Kartu <strong>Status Hari Ini</strong> berubah otomatis: <strong>Belum Absen</strong> menjadi <strong>Sedang Bekerja</strong> setelah absen masuk, lalu <strong>Selesai Shift</strong> setelah absen pulang.</p>'),

('absensi', 'Bab 2 · Absen Wajah lewat HP', 2, 'Kapan Kamera Absen Terbuka',
 '<h3>Jam Buka Kamera dan Status Hari Ini</h3><p>Kamera tidak selalu aktif — hanya pada jam yang diizinkan:</p><ul><li><strong>Absen masuk</strong> terbuka mulai <strong>1 jam sebelum</strong> jam masuk. Di luar itu muncul <strong>Belum Waktunya Absen</strong> lengkap dengan jam kamera akan terbuka.</li><li><strong>Absen pulang</strong> terbuka mulai <strong>30 menit sebelum</strong> jam pulang. Sebelum itu muncul <strong>Kamu sudah Clock-in hari ini</strong> dengan jam kamera pulang akan dibuka.</li><li>Setelah absen masuk <strong>dan</strong> pulang, muncul <strong>Shift Selesai</strong> — Anda selesai untuk hari itu.</li></ul><p>Pada <strong>Riwayat Absensi Terakhir</strong>, absen masuk diberi label <strong>Tepat Waktu</strong> atau <strong>Telat (sekian menit)</strong>, dan absen pulang diberi label <strong>Selesai</strong>.</p>'),

('absensi', 'Bab 2 · Absen Wajah lewat HP', 3, 'Kalau Absen Ditolak atau Gagal',
 '<h3>Penyebab Umum dan Solusinya</h3><ul><li><strong>Belum Waktunya Absen</strong> — kamera baru terbuka mendekati jam masuk/pulang Anda. Tunggu sesuai jam yang tertera.</li><li><strong>Outlet Ditutup / Dikunci SPV</strong> — SPV mengunci absensi (misal outlet libur). Hubungi SPV.</li><li><strong>Akses Lokasi Ditolak</strong> — Anda terdeteksi di luar area outlet; jaraknya ditampilkan dalam meter. Mendekatlah ke outlet lalu tekan <strong>Coba Pindai Ulang Lokasi</strong>. Pastikan izin lokasi (GPS) menyala.</li><li><strong>Wajah tidak dikenali</strong> — pastikan wajah Anda sudah didaftarkan SPV/Leader. Bila penampilan berubah drastis, minta SPV melakukan <strong>Enroll Ulang</strong>.</li><li><strong>Gerakan tidak terdeteksi</strong> — ulangi, gerakkan kepala lebih jelas, lalu kembali menghadap lurus.</li></ul><p>Jika tetap gagal berulang kali, laporkan ke SPV/Leader.</p>'),

-- ── Bab 3 · Checklist Tugas Harian ──
('absensi', 'Bab 3 · Checklist Tugas Harian', 1, 'Mengisi Checklist Buka dan Tutup Toko',
 '<h3>Mengisi Checklist Harian</h3><p>Menu <strong>Checklist Harian</strong> berisi daftar tugas rutin outlet, terbagi dua tab: <strong>Buka Toko</strong> dan <strong>Tutup Toko</strong>.</p><ol><li><strong>Absen masuk dulu.</strong> Selama Anda belum absen hadir hari ini, checklist <strong>terkunci</strong> dan muncul pesan Checklist terkunci.</li><li>Pilih tab <strong>Buka Toko</strong> (pagi) atau <strong>Tutup Toko</strong> (sore).</li><li>Ketuk lingkaran di samping tugas untuk <strong>mencentangnya</strong>. Nama Anda dan jam centang tercatat. Bar <strong>Progress</strong> naik otomatis; saat 100% muncul ucapan Tugas Selesai.</li><li>Tugas berlabel <strong>Wajib</strong> sebaiknya diprioritaskan.</li></ol><p>Catatan: hanya <strong>orang yang mencentang</strong> yang bisa membatalkan centang tugas itu. Perubahan rekan Anda muncul <strong>langsung (real-time)</strong> tanpa perlu refresh.</p>'),

-- ── Bab 4 · Cuti dan Izin ──
('absensi', 'Bab 4 · Cuti dan Izin', 1, 'Mengajukan Cuti atau Izin',
 '<h3>Cara Mengajukan Cuti atau Izin</h3><p>Buka menu <strong>Cuti</strong>, lalu:</p><ol><li>Tekan <strong>Ajukan Cuti</strong> untuk membuka form.</li><li>Pilih <strong>Jenis</strong>: Cuti Tahunan, Sakit (dengan Surat Dokter), Izin Tidak Dibayar, Cuti Melahirkan, atau Izin Lainnya.</li><li>Isi <strong>Tanggal Mulai</strong> dan <strong>Tanggal Selesai</strong> (tanggal selesai tidak boleh sebelum tanggal mulai — sistem menolaknya).</li><li>Tulis <strong>Alasan/Keterangan</strong> singkat.</li><li>Tekan <strong>Kirim Pengajuan</strong>. Statusnya menjadi <strong>Menunggu Persetujuan</strong> dari SPV/Leader dan HR.</li></ol>'),

('absensi', 'Bab 4 · Cuti dan Izin', 2, 'Memantau Status dan Sisa Kuota Cuti',
 '<h3>Memantau Pengajuan Cuti</h3><p>Di bagian atas halaman <strong>Cuti</strong> ada tiga kotak: <strong>Total Kuota Tahunan</strong>, <strong>Cuti Terpakai</strong>, dan <strong>Sisa Kuota</strong> (hari). Periksa sisa kuota sebelum mengajukan cuti baru.</p><p>Di bawahnya, daftar <strong>Riwayat Pengajuan</strong> menampilkan tiap pengajuan beserta statusnya: <strong>Menunggu Persetujuan</strong>, <strong>Disetujui</strong>, atau <strong>Ditolak</strong>. Jika ditolak, alasan penolakan dari atasan ikut ditampilkan.</p>'),

-- ── Bab 5 · Kasbon ──
('absensi', 'Bab 5 · Kasbon', 1, 'Mengajukan Kasbon dan Memilih Cicilan',
 '<h3>Cara Mengajukan Kasbon</h3><p>Buka menu <strong>Kasbon</strong>, tekan <strong>Ajukan Kasbon</strong>, lalu isi:</p><ol><li><strong>Nominal (Rp)</strong> — jumlah yang ingin dipinjam (harus lebih dari 0).</li><li><strong>Skema Cicilan</strong> — 1 sampai 6 bulan. Sistem menampilkan <strong>estimasi cicilan per bulan</strong> otomatis; makin pendek cicilan, makin besar potongan per bulan.</li><li><strong>Alasan Pengajuan</strong> — jelaskan singkat tujuan kasbon.</li><li>Tekan <strong>Kirim Pengajuan</strong>. Statusnya <strong>Menunggu Persetujuan</strong> hingga disetujui atasan/HR sebelum dana dicairkan.</li></ol>'),

('absensi', 'Bab 5 · Kasbon', 2, 'Memantau Riwayat dan Status Kasbon',
 '<h3>Memantau Riwayat Kasbon</h3><p>Bagian <strong>Riwayat Pengajuan Kasbon</strong> menampilkan semua kasbon yang pernah Anda ajukan: nominal, lama cicilan, tanggal pengajuan, dan status (<strong>Menunggu / Disetujui / Ditolak</strong>). Gunakan untuk mengecek cicilan yang masih berjalan sebelum mengajukan kasbon baru.</p>'),

-- ── Bab 6 · Akun dan Riwayat Saya ──
('absensi', 'Bab 6 · Akun dan Riwayat Saya', 1, 'Melihat Riwayat Absensi Saya',
 '<h3>Cek Riwayat Kehadiran Anda</h3><p>Pada halaman <strong>Absen</strong>, di bawah kamera terdapat <strong>Riwayat Absensi Terakhir</strong> yang menampilkan absen masuk/pulang Anda beserta jam dan statusnya. Gunakan untuk memastikan absen Anda tercatat benar. Bila ada yang tidak sesuai, segera laporkan ke SPV/Leader.</p>'),

('absensi', 'Bab 6 · Akun dan Riwayat Saya', 2, 'Mengganti Kata Sandi',
 '<h3>Mengganti Kata Sandi Akun</h3><p>Buka menu <strong>Profil</strong>:</p><ol><li>Kolom <strong>Email Login</strong> hanya info dan tidak bisa diubah.</li><li>Isi <strong>Password Baru</strong> (minimal 6 karakter) dan <strong>Konfirmasi Password Baru</strong> (harus sama).</li><li>Tekan <strong>Update Password</strong>. Sistem menampilkan konfirmasi bila berhasil.</li></ol><p>Untuk mengubah <strong>nama, peran, atau foto wajah</strong>, hubungi SPV/Kepala Outlet — hal itu tidak bisa Anda ubah sendiri.</p>'),

-- ── Bab 7 · Untuk SPV dan Leader: Kehadiran dan Checklist ──
('absensi', 'Bab 7 · Untuk SPV dan Leader - Kehadiran dan Checklist', 1, 'Memantau Papan Kehadiran Real-Time',
 '<h3>Memantau Kehadiran Semua Kru</h3><p>Menu <strong>Papan Kehadiran</strong> menampilkan status kehadiran seluruh kru <strong>hari ini secara langsung</strong>:</p><ul><li>Bar persentase kehadiran (Hadir / Telat / Alpha) dan ringkasan jumlah per status.</li><li>Daftar staf dengan label status: Masuk, Telat, Belum Hadir, Alpha, Keluar, dan lainnya.</li><li>Filter untuk menampilkan status tertentu, dan foto selfie absen yang bisa <strong>diklik untuk diperbesar</strong>.</li></ul>'),

('absensi', 'Bab 7 · Untuk SPV dan Leader - Kehadiran dan Checklist', 2, 'Melihat Rekap dan Mengunduh Laporan (CSV)',
 '<h3>Rekap Kehadiran dan Ekspor</h3><p>Menu <strong>Rekap &amp; Riwayat</strong>:</p><ol><li>Pilih <strong>tanggal</strong> yang ingin dilihat.</li><li>Sistem menampilkan ringkasan <strong>Tepat / Telat / Alpha / Pulang Awal</strong> dan daftar detail per orang.</li><li>Gunakan dropdown <strong>filter status</strong> untuk menyaring.</li><li>Tekan <strong>Export CSV</strong> untuk mengunduh laporan tanggal tersebut (bisa dibuka di Excel).</li></ol>'),

('absensi', 'Bab 7 · Untuk SPV dan Leader - Kehadiran dan Checklist', 3, 'Memantau Progres Checklist Kru',
 '<h3>Monitor Checklist Real-Time</h3><p>Menu <strong>Monitor Checklist</strong> menampilkan tugas mana yang sudah/belum dicentang kru <strong>hari ini secara real-time</strong>, terbagi tab <strong>Buka Toko</strong> dan <strong>Tutup Toko</strong>, lengkap dengan <strong>siapa</strong> yang mencentang dan <strong>jam</strong>-nya. Tekan <strong>Refresh</strong> untuk memuat ulang bila perlu.</p>'),

('absensi', 'Bab 7 · Untuk SPV dan Leader - Kehadiran dan Checklist', 4, 'Menyusun Daftar Checklist (Kategori dan Tugas)',
 '<h3>Mengelola Checklist Operasional</h3><p>Menu <strong>Manajemen Checklist</strong>:</p><ol><li>Pilih tab <strong>Sebelum Buka</strong> atau <strong>Sebelum Pulang</strong>.</li><li>Tekan <strong>Tambah Kategori</strong>, isi nama (misal Kebersihan) dan <strong>Fase</strong> (buka/tutup), lalu simpan.</li><li>Di dalam kategori, tekan <strong>Tambah Tugas</strong>, isi nama tugas, dan tentukan apakah <strong>Wajib</strong>.</li><li>Gunakan ikon <strong>edit</strong> atau <strong>hapus</strong> untuk mengubah kategori dan tugas.</li></ol><p>Daftar yang Anda susun inilah yang muncul di halaman <strong>Checklist Harian</strong> kru.</p>'),

-- ── Bab 8 · Untuk SPV dan Leader: Wajah dan Pengaturan ──
('absensi', 'Bab 8 · Untuk SPV dan Leader - Wajah dan Pengaturan', 1, 'Mendaftarkan Wajah Kru (Enrollment dan Enroll Ulang)',
 '<h3>Cara Mendaftarkan Wajah Kru</h3><p>Menu <strong>Enrollment Crew</strong>. Halaman terbagi dua: <strong>Belum Terdaftar</strong> dan <strong>Sudah Terdaftar</strong>.</p><ol><li>Pilih outlet (bila membina lebih dari satu) lewat pemilih outlet di atas.</li><li><strong>Mendaftarkan baru:</strong> pilih nama kru di Belum Terdaftar. Kru mencentang <strong>Persetujuan Privasi (UU PDP)</strong> — wajib. Tekan <strong>Mulai Perekaman Kamera</strong>.</li><li>Minta kru menghadap kamera <strong>lurus (frontal)</strong>, jangan menoleh. Sistem mengambil <strong>3 gambar otomatis</strong> (ditandai tiga titik hijau) lalu menyimpannya. Muncul <strong>Enrollment Selesai</strong>.</li><li><strong>Enroll ulang:</strong> pilih kru di Sudah Terdaftar, tekan <strong>Enroll Ulang</strong>. Konfirmasi bahwa data wajah lama akan ditimpa, isi <strong>alasan</strong> (opsional), lalu rekam ulang.</li></ol><p>Akun kru baru dibuatkan oleh <strong>Admin HR</strong> lebih dulu; setelah itu barulah wajahnya di-enroll di sini.</p>'),

('absensi', 'Bab 8 · Untuk SPV dan Leader - Wajah dan Pengaturan', 2, 'Mengatur Mode Absensi, Jam Kerja, dan Toleransi',
 '<h3>Pengaturan Absensi Outlet</h3><p>Menu <strong>Pengaturan Absensi</strong>:</p><ol><li><strong>Mode Absensi Kiosk:</strong><ul><li><strong>Otomatis</strong> — kamera buka/tutup sendiri mengikuti jam kerja (masuk 1 jam sebelumnya, pulang 30 menit sebelumnya). Toggle di bawahnya berfungsi sebagai <strong>Emergency Lock</strong> (kunci darurat).</li><li><strong>Manual</strong> — Anda menyalakan/mematikan kiosk sendiri lewat toggle <strong>Status Kiosk</strong>.</li></ul></li><li><strong>Jam Shift Kerja</strong> — atur jam mulai masuk dan jam boleh pulang.</li><li><strong>Toleransi Keterlambatan (menit)</strong> — kru yang absen setelah jam masuk tapi masih dalam batas toleransi tetap dihitung <strong>Tepat Waktu</strong>.</li><li>Tekan <strong>Simpan Perubahan</strong>.</li></ol>');

COMMIT;

-- Verifikasi cepat (opsional):
-- SELECT category, sort_order, title FROM public.system_guides
--   WHERE system_code = 'absensi' ORDER BY category, sort_order;
