# Panduan Sistem — Konten Absensi + Perbaikan Kasir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate real, user-ready guide text directly into the `system_guides` Supabase table for `absensi` (built from scratch) and `pos` (3 missing topics + one bab retitled), so admins can open the existing "Kelola Panduan" CMS and just attach screenshots — no code changes.

**Architecture:** A single idempotent Node script (ESM, run with plain `node`) holds all the new copy as data literals and performs the DB writes via the Supabase service role key (read from `.env.local`, never printed). It supports `--dry-run` to compute and print the planned operations without touching the database, mirroring the existing precedent at `apps/pos-kasir/scripts/seed-panduan-kasir.mjs`.

**Tech Stack:** Node.js (ESM `.mjs`), `@supabase/supabase-js` (already a dependency in `apps/pos-kasir`), Supabase Postgres (`system_guides` table, already exists — no migration needed).

## Global Constraints

- Never print `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` to stdout/stderr or embed them in a shell command literal — read them from `.env.local` inside the script only (see `apps/pos-kasir/scripts/seed-panduan-kasir.mjs:14-22` for the exact pattern to copy).
- `image_url` stays `null` on every new row and **untouched** on the two updated `pos` rows — screenshots are the user's job, not ours.
- The two existing `pos` Bab 4 rows (ids `26fa440e-6725-4b65-88e2-363c3e41faec`, `477d502b-e252-4f54-9eec-ed4005730d5e`) must be updated via `UPDATE ... WHERE id = ...`, never deleted/reinserted — their `content_html` and `image_url` must survive unchanged.
- Script must be safe to re-run (idempotent): re-running it after a successful run must not create duplicate rows.
- No SQL migration files, no changes to any `.tsx`/`.ts` application code — this is a content-only task against an existing schema.

---

### Task 1: Write the idempotent seed script with full content and dry-run support

**Files:**
- Create: `scripts/seed-panduan-2026-07-07.mjs` (repo root `scripts/` — this is a one-off content-seeding script, not tied to a single app, so it lives alongside the other cross-cutting DB scripts like `scripts/seed-panduan-kasir.mjs` referenced in `CLAUDE.md`)

**Interfaces:**
- Consumes: `.env.local` at repo root — keys `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same file already used by `apps/pos-kasir/scripts/seed-panduan-kasir.mjs`).
- Produces: rows in `public.system_guides` (columns used: `system_code`, `category`, `title`, `content_html`, `sort_order`, `image_url`, `id` for updates). Nothing downstream consumes this script's exports — it's a standalone CLI.

- [ ] **Step 1: Write the full script**

```javascript
// scripts/seed-panduan-2026-07-07.mjs
//
// One-off, idempotent seed for `system_guides`:
//   - absensi: replace the "test" placeholder with 14 real topics (7 bab)
//   - pos: add 3 missing topics (Void, Buka Shift, Tutup Shift) and retitle
//     Bab 4 to "Bab 4 · Shift & Petty Cash" (existing 2 rows keep their
//     content_html/image_url, only category+sort_order change)
//
// Usage:
//   node scripts/seed-panduan-2026-07-07.mjs --dry-run   # print plan, no writes
//   node scripts/seed-panduan-2026-07-07.mjs             # execute for real
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

function readEnv() {
  const txt = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  const env = {}
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = readEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Kredensial Supabase tidak ditemukan di .env.local'); process.exit(1) }

const supabase = createClient(url, key, { auth: { persistSession: false } })

// ── Konten baru: absensi (14 topik, 7 bab) ──
const ABSENSI_GUIDES = [
  { category: 'Bab 1 · Mengenal Sistem', sort_order: 1, title: 'Apa Itu Sistem Absensi Ini?', content_html:
    `<h3>Kenalan dengan Sistem Absensi Suka Shawarma</h3><p>Sistem ini menggantikan absen manual (tanda tangan/kertas) dengan <strong>pengenalan wajah otomatis</strong>. Setiap kali Anda datang atau pulang kerja, cukup berdiri di depan kamera kiosk di outlet — tidak perlu kartu, sidik jari, atau mengetik apa pun.</p><p>Selain absen, dari akun Anda sendiri Anda juga bisa mengajukan cuti/izin, mengajukan kasbon, dan melihat rekap kehadiran — semua di satu tempat.</p>` },
  { category: 'Bab 1 · Mengenal Sistem', sort_order: 2, title: 'Cara Masuk (Login)', content_html:
    `<h3>Cara Masuk ke Dashboard Absensi</h3><p>Untuk melihat riwayat kehadiran, mengajukan cuti, atau kasbon, masuk dulu ke Dashboard (bukan ke kiosk absen):</p><ol><li>Buka halaman login, ketik <strong>Username</strong> dan <strong>Kata Sandi</strong> yang diberikan SPV/Leader.</li><li>Tekan tombol <strong>Masuk</strong>.</li></ol><p>Akun ini rahasia — jangan dibagikan. Kalau lupa sandi, minta bantuan SPV/Leader untuk mengatur ulang.</p>` },

  { category: 'Bab 2 · Absen di Kiosk (Face Recognition)', sort_order: 1, title: 'Cara Absen Masuk & Pulang Lewat Kamera', content_html:
    `<h3>Langkah Absen di Kiosk</h3><p>Kiosk absen ada di outlet Anda (bukan di HP pribadi). Begini caranya:</p><ol><li>Berdiri tegak lurus di depan kamera, dengan jarak wajar (jangan terlalu dekat/jauh).</li><li>Pastikan wajah tidak tertutup masker, topi, atau kacamata hitam.</li><li>Sistem akan meminta Anda melakukan sedikit <strong>gerakan kepala</strong> (menoleh) — ini untuk memastikan Anda orang asli, bukan foto.</li><li>Setelah bergerak, <strong>hadapkan wajah lurus kembali ke kamera</strong>. Verifikasi akhir dilakukan saat wajah Anda kembali lurus, bukan saat sedang menoleh.</li><li>Kalau berhasil, layar menampilkan nama Anda dan status "Absen Masuk"/"Absen Pulang" berhasil.</li></ol><p>Kiosk hanya bisa dipakai pada jam yang diizinkan — lihat topik berikutnya kalau kamera menolak absen Anda.</p>` },
  { category: 'Bab 2 · Absen di Kiosk (Face Recognition)', sort_order: 2, title: 'Kenapa Wajah Saya Ditolak?', content_html:
    `<h3>Penyebab Umum Absen Gagal</h3><p>Beberapa alasan kiosk menolak wajah Anda:</p><ul><li><strong>Belum waktunya absen</strong> — muncul pesan "Belum Waktunya Absen". Kiosk baru terbuka mendekati jam masuk/pulang Anda.</li><li><strong>Dikunci SPV</strong> atau <strong>Outlet Ditutup</strong> — SPV mengunci kiosk secara manual (misal outlet sedang libur/tutup).</li><li><strong>Wajah tidak dikenali</strong> — pastikan Anda sudah didaftarkan (enrollment) oleh SPV/Leader. Kalau sudah lama tidak pernah re-enroll setelah ganti penampilan drastis (misal berjenggot tebal), minta SPV melakukan <strong>Enroll Ulang</strong>.</li><li><strong>Gerakan liveness tidak terdeteksi</strong> — coba ulangi, gerakkan kepala lebih jelas lalu kembali menghadap lurus ke kamera.</li></ul><p>Kalau masih gagal berulang kali, segera laporkan ke SPV/Leader outlet Anda.</p>` },

  { category: 'Bab 3 · Cuti & Izin', sort_order: 1, title: 'Mengajukan Cuti / Izin', content_html:
    `<h3>Cara Mengajukan Cuti atau Izin</h3><p>Buka menu <strong>Cuti & Izin</strong> di dashboard, lalu:</p><ol><li>Tekan tombol untuk membuka <strong>Form Pengajuan Cuti</strong>.</li><li>Pilih <strong>Jenis Cuti/Izin</strong>: Cuti Tahunan, Sakit (dengan Surat Dokter), Izin Tidak Dibayar (Unpaid Leave), Cuti Melahirkan, atau Izin Lainnya.</li><li>Isi <strong>Tanggal Mulai</strong> dan <strong>Tanggal Selesai</strong>.</li><li>Isi <strong>Alasan/Keterangan</strong> secara singkat dan jelas.</li><li>Kirim pengajuan — statusnya akan <strong>Menunggu Persetujuan</strong> dari SPV/Leader/HR.</li></ol>` },
  { category: 'Bab 3 · Cuti & Izin', sort_order: 2, title: 'Melihat Status & Sisa Kuota Cuti', content_html:
    `<h3>Memantau Pengajuan Cuti Anda</h3><p>Di bagian atas halaman <strong>Cuti & Izin</strong>, ada kotak yang menampilkan <strong>sisa kuota cuti tahunan</strong> Anda (dalam hari) — pantau ini sebelum mengajukan cuti baru.</p><p>Di bawahnya ada daftar riwayat semua pengajuan Anda, lengkap dengan statusnya: <strong>Menunggu</strong>, <strong>Disetujui</strong>, atau <strong>Ditolak</strong>. Kalau ditolak, biasanya ada catatan alasan dari atasan.</p>` },

  { category: 'Bab 4 · Kasbon', sort_order: 1, title: 'Mengajukan Kasbon & Skema Cicilan', content_html:
    `<h3>Cara Mengajukan Kasbon</h3><p>Buka menu <strong>Kasbon</strong>, tekan tombol pengajuan, lalu isi:</p><ol><li><strong>Nominal (Rp)</strong> — jumlah uang yang ingin dipinjam.</li><li><strong>Skema Cicilan</strong> — pilih dari 1 sampai 6 bulan. Semakin pendek skemanya, semakin besar potongan per bulan dari gaji.</li><li><strong>Alasan Pengajuan</strong> — jelaskan singkat tujuan kasbon.</li></ol><p>Setelah dikirim, pengajuan menunggu persetujuan atasan/HR sebelum dana dicairkan.</p>` },
  { category: 'Bab 4 · Kasbon', sort_order: 2, title: 'Melihat Riwayat & Status Kasbon', content_html:
    `<h3>Memantau Riwayat Kasbon</h3><p>Bagian <strong>Riwayat Pengajuan Kasbon</strong> di halaman yang sama menampilkan semua kasbon yang pernah Anda ajukan: nominal, skema cicilan, tanggal pengajuan, dan statusnya (Menunggu/Disetujui/Ditolak/Lunas).</p><p>Gunakan halaman ini untuk mengecek sisa cicilan yang masih berjalan sebelum mengajukan kasbon baru.</p>` },

  { category: 'Bab 5 · Kehadiran Saya', sort_order: 1, title: 'Melihat Rekap Kehadiran', content_html:
    `<h3>Cek Riwayat Kehadiran Anda</h3><p>Menu <strong>Rekap</strong> menampilkan riwayat absen Anda per hari: jam masuk, jam pulang, dan status (Hadir, Terlambat, Alpha, Cuti, dsb).</p><p>Gunakan halaman ini untuk mengecek apakah absen Anda tercatat dengan benar, terutama kalau merasa lupa absen atau kamera sempat bermasalah — segera laporkan ke SPV/Leader kalau ada data yang tidak sesuai.</p>` },
  { category: 'Bab 5 · Kehadiran Saya', sort_order: 2, title: 'Checklist Tugas Harian', content_html:
    `<h3>Mengisi Checklist Tugas Harian</h3><p>Menu <strong>Checklist</strong> berisi daftar tugas rutin harian outlet yang perlu dicentang (misal: bersih-bersih, cek suhu kulkas, cek stok awal).</p><p>Tandai setiap tugas yang sudah Anda selesaikan dengan mencentangnya. SPV/Leader dapat memantau progres checklist seluruh kru lewat halaman monitoring mereka.</p>` },

  { category: 'Bab 6 · Untuk SPV/Leader — Kelola Kru', sort_order: 1, title: 'Membuat Akun Kru Baru', content_html:
    `<h3>Membuat Akun untuk Kru Baru</h3><p>Buka menu <strong>Manajemen Kru</strong>, lalu:</p><ol><li>Tekan tombol untuk membuat akun baru.</li><li>Isi <strong>Nama</strong>, <strong>Username</strong>, dan <strong>Password Sementara</strong>.</li><li>Pilih <strong>Role</strong>: Crew, Kasir, SPV, atau Leader sesuai jabatan sebenarnya.</li><li>Simpan — akun langsung aktif dan bisa dipakai untuk login ke Dashboard.</li></ol><p>Setelah akun dibuat, lanjutkan ke langkah <strong>Enrollment Wajah</strong> supaya kru bisa absen di kiosk.</p>` },
  { category: 'Bab 6 · Untuk SPV/Leader — Kelola Kru', sort_order: 2, title: 'Mendaftarkan Wajah Kru (Enrollment)', content_html:
    `<h3>Cara Mendaftarkan Wajah Kru</h3><p>Buka menu <strong>Enroll</strong>. Halaman ini terbagi 2 bagian: <strong>Belum Terdaftar</strong> (kru yang belum punya wajah tersimpan) dan <strong>Sudah Terdaftar</strong> (untuk enroll ulang).</p><ol><li>Pilih nama kru dari daftar <strong>Belum Terdaftar</strong>, lalu tekan <strong>Daftarkan</strong>.</li><li>Minta kru menghadap kamera <strong>lurus (frontal)</strong> — sistem akan mengambil 3 frame otomatis. Jangan menoleh saat proses ini, hasil paling akurat kalau wajah tetap lurus ke kamera.</li><li>Setelah 3 frame terekam, sistem menyimpan wajah kru secara otomatis.</li></ol><p>Kalau kru butuh didaftarkan ulang (misal penampilan berubah drastis), pilih namanya dari daftar <strong>Sudah Terdaftar</strong>, konfirmasi timpa data lama, dan isi alasan re-enroll (opsional).</p>` },

  { category: 'Bab 7 · Untuk SPV/Leader — Monitoring', sort_order: 1, title: 'Papan Kehadiran Real-Time', content_html:
    `<h3>Memantau Kehadiran Semua Kru</h3><p>Menu <strong>Papan Kehadiran</strong> menampilkan status kehadiran seluruh kru outlet Anda hari ini secara real-time: siapa yang sudah absen masuk, siapa yang belum, dan siapa yang sedang cuti/izin.</p><p>Gunakan halaman ini di pagi hari untuk cepat mengecek siapa yang belum datang tanpa harus menghubungi satu per satu.</p>` },
  { category: 'Bab 7 · Untuk SPV/Leader — Monitoring', sort_order: 2, title: 'Pengaturan Mode Absensi (Otomatis/Manual)', content_html:
    `<h3>Mengatur Mode Buka-Tutup Kiosk</h3><p>Menu <strong>Pengaturan</strong> menentukan kapan kiosk absen boleh dipakai kru:</p><ul><li><strong>Mode Otomatis</strong> — kiosk buka sendiri sesuai jam kerja (absen masuk terbuka 1 jam sebelum jam masuk, absen pulang 30 menit sebelum jam keluar). Toggle di halaman ini jadi <strong>kunci darurat</strong> saja.</li><li><strong>Mode Manual</strong> — Anda yang menyalakan/mematikan kiosk sendiri lewat toggle <strong>Status Kiosk</strong>, tidak terikat jam otomatis.</li></ul><p>Pilih mode yang sesuai kebiasaan outlet Anda, lalu simpan pengaturan.</p>` },
]

// ── Konten baru: pos (3 topik) ──
const POS_NEW_GUIDES = [
  { category: 'Bab 2 · Order & Pesanan', sort_order: 5, title: 'Membatalkan Pesanan (Void)', content_html:
    `<h3>Cara Membatalkan Pesanan (Void)</h3><p>Kalau ada pesanan yang salah input dan sudah terlanjur masuk sistem, jangan dihapus sembarangan — gunakan fitur <strong>Batalkan</strong> di halaman Order:</p><ol><li>Buka pesanan yang ingin dibatalkan, tekan tombol <strong>Batalkan</strong>.</li><li>Sistem akan meminta <strong>PIN Otorisasi SPV/Leader</strong> — hanya SPV/Leader outlet yang boleh memberikan PIN ini.</li><li>Setelah PIN benar, isi <strong>Alasan Pembatalan</strong> (wajib diisi, tidak boleh kosong).</li><li>Tekan konfirmasi — pesanan berubah status jadi "Dibatalkan" dan tidak dihitung sebagai penjualan.</li></ol><p>Kenapa perlu PIN? Supaya kasir tidak bisa sembarangan membatalkan pesanan sendiri tanpa sepengetahuan atasan — mencegah kecurangan atau kesalahan yang tidak tercatat.</p>` },
  { category: 'Bab 4 · Shift & Petty Cash', sort_order: 1, title: 'Membuka Shift (Setoran Awal)', content_html:
    `<h3>Membuka Shift di Awal Kerja</h3><p>Sebelum bisa memproses transaksi tunai, Anda wajib membuka shift terlebih dahulu di halaman <strong>Petty Cash</strong>:</p><ol><li>Hitung dulu uang fisik <strong>Dana Operasional</strong> yang ada di outlet saat ini (bukan uang hasil jualan, murni kas kecil).</li><li>Masukkan nominalnya ke kolom <strong>Saldo Awal Dana Operasional</strong>.</li><li>Tekan <strong>Buka Shift Sekarang</strong>.</li></ol><p>Catatan: kalau kolom ini terkunci dengan ikon gembok, artinya nominalnya otomatis mengikuti setoran awal shift sebelumnya — hubungi SPV/Admin kalau nominal itu perlu diubah. Setelah shift terbuka, Laci Kasir dan Dana Operasional mulai tercatat berjalan sampai Anda menutup shift nanti.</p>` },
  { category: 'Bab 4 · Shift & Petty Cash', sort_order: 4, title: 'Menutup Shift (Blind Close) & Selisih Kas', content_html:
    `<h3>Menutup Shift di Akhir Kerja</h3><p>Di akhir shift/hari kerja, tutup shift dengan cara <strong>Blind Close</strong> — Anda menghitung uang fisik dulu sebelum melihat angka sistem:</p><ol><li>Hitung fisik <strong>Uang Laci</strong> (hasil penjualan tunai) dan masukkan nominalnya.</li><li>Hitung fisik sisa <strong>Dana Operasional</strong> dan masukkan nominalnya secara terpisah.</li><li>Tekan <strong>Kunci & Tutup Shift</strong>.</li></ol><p>Sistem akan membandingkan hitungan Anda dengan <strong>Perhitungan Sistem (Otomatis)</strong> — kalau ada selisih, akan muncul keterangan "Lebih dari sistem" atau "Kurang dari sistem". Kalau ada kekurangan, segera laporkan ke SPV/Leader sebelum benar-benar menutup shift. Setelah shift ditutup, Anda otomatis diarahkan ke halaman Laporan.</p>` },
]

// ── Update kategori + sort_order pada 2 baris pos existing (Bab 4 lama) ──
// content_html dan image_url TIDAK disentuh.
const POS_RETITLE_UPDATES = [
  { id: '26fa440e-6725-4b65-88e2-363c3e41faec', title: 'Memahami Laci Kasir & Dana Operasional', category: 'Bab 4 · Shift & Petty Cash', sort_order: 2 },
  { id: '477d502b-e252-4f54-9eec-ed4005730d5e', title: 'Mencatat Pengeluaran & Mengajukan Top Up', category: 'Bab 4 · Shift & Petty Cash', sort_order: 3 },
]

const ABSENSI_TEST_ROW_ID = '8ac2e68f-7336-4a76-ac1a-c1c5a1192b02'

async function main() {
  console.log(DRY_RUN ? '── DRY RUN (tidak ada perubahan ke database) ──' : '── EXECUTING (menulis ke database) ──')

  // 1. Hapus baris placeholder absensi "test"
  console.log(`\n1. Hapus placeholder absensi (id=${ABSENSI_TEST_ROW_ID})`)
  if (!DRY_RUN) {
    const { error } = await supabase.from('system_guides').delete().eq('id', ABSENSI_TEST_ROW_ID)
    if (error) { console.error('   Gagal hapus placeholder:', error.message); process.exit(1) }
  }
  console.log('   OK')

  // 2. Insert 14 baris absensi baru — idempotent: skip kalau title sudah ada utk system_code ini
  console.log(`\n2. Insert ${ABSENSI_GUIDES.length} topik absensi baru`)
  const { data: existingAbsensi } = await supabase.from('system_guides').select('title').eq('system_code', 'absensi')
  const existingAbsensiTitles = new Set((existingAbsensi || []).map(r => r.title))
  const absensiToInsert = ABSENSI_GUIDES.filter(g => !existingAbsensiTitles.has(g.title))
  console.log(`   ${absensiToInsert.length} baru, ${ABSENSI_GUIDES.length - absensiToInsert.length} sudah ada (dilewati)`)
  if (!DRY_RUN && absensiToInsert.length > 0) {
    const rows = absensiToInsert.map(g => ({ system_code: 'absensi', category: g.category, title: g.title, content_html: g.content_html, sort_order: g.sort_order, image_url: null }))
    const { error } = await supabase.from('system_guides').insert(rows)
    if (error) { console.error('   Gagal insert absensi:', error.message); process.exit(1) }
  }
  console.log('   OK')

  // 3. Insert 3 baris pos baru — idempotent: skip kalau title sudah ada
  console.log(`\n3. Insert ${POS_NEW_GUIDES.length} topik pos baru`)
  const { data: existingPos } = await supabase.from('system_guides').select('title').eq('system_code', 'pos')
  const existingPosTitles = new Set((existingPos || []).map(r => r.title))
  const posToInsert = POS_NEW_GUIDES.filter(g => !existingPosTitles.has(g.title))
  console.log(`   ${posToInsert.length} baru, ${POS_NEW_GUIDES.length - posToInsert.length} sudah ada (dilewati)`)
  if (!DRY_RUN && posToInsert.length > 0) {
    const rows = posToInsert.map(g => ({ system_code: 'pos', category: g.category, title: g.title, content_html: g.content_html, sort_order: g.sort_order, image_url: null }))
    const { error } = await supabase.from('system_guides').insert(rows)
    if (error) { console.error('   Gagal insert pos:', error.message); process.exit(1) }
  }
  console.log('   OK')

  // 4. Update category + sort_order pada 2 baris pos existing (content_html/image_url tidak diubah)
  console.log(`\n4. Update category+sort_order pada ${POS_RETITLE_UPDATES.length} baris pos existing (Bab 4 lama)`)
  for (const u of POS_RETITLE_UPDATES) {
    console.log(`   - ${u.title} -> "${u.category}" (sort_order=${u.sort_order})`)
    if (!DRY_RUN) {
      const { error } = await supabase.from('system_guides').update({ category: u.category, sort_order: u.sort_order }).eq('id', u.id)
      if (error) { console.error(`   Gagal update ${u.id}:`, error.message); process.exit(1) }
    }
  }
  console.log('   OK')

  console.log(DRY_RUN ? '\nDry-run selesai. Jalankan tanpa --dry-run untuk eksekusi nyata.' : '\nSelesai. Semua perubahan tersimpan di system_guides.')
}

main()
```

- [ ] **Step 2: Create the `scripts/` directory if it doesn't exist and verify the file was written**

Run: `ls scripts/seed-panduan-2026-07-07.mjs`
Expected: prints the file path (no "No such file" error). If `scripts/` doesn't exist at repo root yet, create it first with `mkdir scripts` before writing the file in Step 1.

- [ ] **Step 3: Run the dry-run and verify the plan looks right**

Run: `node scripts/seed-panduan-2026-07-07.mjs --dry-run`

Expected output (counts must match exactly):
```
── DRY RUN (tidak ada perubahan ke database) ──

1. Hapus placeholder absensi (id=8ac2e68f-7336-4a76-ac1a-c1c5a1192b02)
   OK

2. Insert 14 topik absensi baru
   14 baru, 0 sudah ada (dilewati)
   OK

3. Insert 3 topik pos baru
   3 baru, 0 sudah ada (dilewati)
   OK

4. Update category+sort_order pada 2 baris pos existing (Bab 4 lama)
   - Memahami Laci Kasir & Dana Operasional -> "Bab 4 · Shift & Petty Cash" (sort_order=2)
   - Mencatat Pengeluaran & Mengajukan Top Up -> "Bab 4 · Shift & Petty Cash" (sort_order=3)
   OK

Dry-run selesai. Jalankan tanpa --dry-run untuk eksekusi nyata.
```

If the counts differ (e.g. "0 baru, 14 sudah ada"), STOP — it means a previous partial run already inserted rows; inspect `system_guides` before continuing (see the read-only check pattern in Task 2 Step 2 below).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-panduan-2026-07-07.mjs
git commit -m "$(cat <<'EOF'
feat(guides): seed script for absensi guide content + pos gaps

Dry-run verified: 14 new absensi topics, 3 new pos topics (void,
buka/tutup shift), 2 pos rows retitled into Bab 4 Shift & Petty Cash.
EOF
)"
```

---

### Task 2: Execute the seed for real and verify the live result

**Files:**
- No new files. Uses `scripts/seed-panduan-2026-07-07.mjs` from Task 1.
- Create (temporary, not committed): a throwaway verification script under the scratchpad directory — do **not** put ad-hoc DB-reading scripts in the repo.

**Interfaces:**
- Consumes: `scripts/seed-panduan-2026-07-07.mjs` (Task 1).
- Produces: live rows in `public.system_guides` — the deliverable admins will see in `/dashboard/panduan/absensi` and `/dashboard/panduan/pos`.

- [ ] **Step 1: Run the script for real**

Run: `node scripts/seed-panduan-2026-07-07.mjs`

Expected: same log shape as the dry-run in Task 1 Step 3, but header says `── EXECUTING (menulis ke database) ──` and final line says `Selesai. Semua perubahan tersimpan di system_guides.` No `Gagal ...` error lines.

- [ ] **Step 2: Write a throwaway read-only verification script (do not commit)**

Create this file at the path your scratchpad tool provides (never inside the repo), e.g. `<scratchpad>/verify-panduan.mjs`:

```javascript
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Adjust this path to the actual repo root on this machine.
const REPO_ROOT = 'C:/Users/Digital Marketing/OneDrive/Desktop/project/DIGITALISASI-SS-PROJECT'
const env = Object.fromEntries(
  readFileSync(`${REPO_ROOT}/.env.local`, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: absensi } = await supabase.from('system_guides').select('category,title,sort_order').eq('system_code', 'absensi').order('category').order('sort_order')
console.log(`absensi: ${absensi.length} rows (expect 14, no "test" title)`) 
absensi.forEach(r => console.log(`  [${r.category}] ${r.sort_order}. ${r.title}`))

const { data: posBab4 } = await supabase.from('system_guides').select('id,title,category,sort_order,image_url').eq('system_code', 'pos').eq('category', 'Bab 4 · Shift & Petty Cash').order('sort_order')
console.log(`\npos Bab 4 · Shift & Petty Cash: ${posBab4.length} rows (expect 4)`) 
posBab4.forEach(r => console.log(`  ${r.sort_order}. ${r.title} (image_url=${r.image_url ?? 'null'})`))

const { data: posVoid } = await supabase.from('system_guides').select('title,category').eq('system_code', 'pos').eq('title', 'Membatalkan Pesanan (Void)')
console.log(`\npos Void topic present: ${posVoid.length === 1}`)
```

Run: `node <scratchpad>/verify-panduan.mjs`

Expected:
- `absensi: 14 rows` — list shows all 7 bab (`Bab 1 · Mengenal Sistem` through `Bab 7 · Untuk SPV/Leader — Monitoring`), no row titled `test`.
- `pos Bab 4 · Shift & Petty Cash: 4 rows` — order is `Membuka Shift (Setoran Awal)` (1), `Memahami Laci Kasir & Dana Operasional` (2), `Mencatat Pengeluaran & Mengajukan Top Up` (3), `Menutup Shift (Blind Close) & Selisih Kas` (4). The 2 middle rows must show a **non-null** `image_url` if they had one before (confirms the update didn't wipe it — cross-check against the values recorded in the design spec's DB read, where row `26fa440e-...` had `image_url = /guide-assets/10-petty-cash.svg` and `477d502b-...` had `/guide-assets/11-petty-topup.svg`).
- `pos Void topic present: true`.

- [ ] **Step 3: Manual spot-check in the admin UI**

Open `/dashboard/panduan/absensi` and `/dashboard/panduan/pos` in admin-dashboard (dev server or deployed instance) and confirm the new bab/topics render with the expected titles and that the two retitled Bab 4 rows still show their original screenshots. This step has no automated pass/fail output — visually confirm and move on.

No commit in this task — there are no file changes, only a live data write (Task 1's script) and a throwaway local verification script that must NOT be added to git.

---

## Self-Review Notes

- **Spec coverage:** Design spec's section A (3 pos rows + 2 retitled rows) → Task 1 `POS_NEW_GUIDES`/`POS_RETITLE_UPDATES` + Task 2 verification. Section B (14 absensi rows, delete placeholder) → Task 1 `ABSENSI_GUIDES`/`ABSENSI_TEST_ROW_ID` + Task 2 verification. Writing style and "no images" constraint → every row literal has real prose and `image_url: null`. Delivery mechanism (idempotent script, credentials never printed) → Task 1 Step 1 code.
- **Placeholder scan:** No TBD/TODO; every content string is complete, real copy — nothing deferred.
- **Type/id consistency:** The two UUIDs in `POS_RETITLE_UPDATES` match exactly the ids read from the live `system_guides` table during design (`26fa440e-6725-4b65-88e2-363c3e41faec`, `477d502b-e252-4f54-9eec-ed4005730d5e`), and the absensi placeholder id (`8ac2e68f-7336-4a76-ac1a-c1c5a1192b02`) matches the row confirmed to have title `"test"`.
