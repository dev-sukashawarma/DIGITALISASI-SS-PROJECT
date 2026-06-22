// Seed Buku Panduan Kasir ke tabel `guides`.
// Memakai service role (bypass RLS). Idempotent: hapus dulu bab-bab panduan
// kasir yang lama, lalu insert ulang dari daftar di bawah.
// Jalankan: node scripts/seed-panduan-kasir.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Ambil kredensial dari .env.local tanpa menampilkannya
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

const B1 = 'Bab 1 · Mengenal Sistem'
const B2 = 'Bab 2 · Mengelola Pesanan'
const B3 = 'Bab 3 · Mengatur Menu'
const B4 = 'Bab 4 · Device Pelanggan'
const B5 = 'Bab 5 · Laporan & Histori'
const B6 = 'Bab 6 · Pengaturan & Keluar'

const IMG = (f) => `/guide-assets/${f}`

const guides = [
  // ── BAB 1 ──
  {
    category: B1, sort_order: 1, image_url: IMG('01-overview.svg'),
    title: 'Apa Itu Sistem Kasir Suka Shawarma?',
    content:
`Sistem ini adalah "meja kerja digital" Anda sebagai kasir. Tugasnya satu: menampung semua pesanan pelanggan di satu layar, supaya tidak ada yang terlewat.

Lihat gambar:
1) Setiap ada pesanan baru, otomatis muncul di sini lengkap dengan bunyi pemberitahuan.
2) Anda cukup menerima, memproses, lalu menyelesaikannya. Tidak perlu mencatat manual.

Tenang, semua tombolnya gampang. Ikuti panduan ini dari atas ke bawah, ya.`,
  },
  {
    category: B1, sort_order: 2, image_url: IMG('02-login.svg'),
    title: 'Cara Masuk (Login)',
    content:
`Sebelum bekerja, Anda harus masuk dulu memakai akun yang diberikan atasan.

Langkah-langkahnya:
1) Ketik Email atau Username Anda.
2) Ketik Kata Sandi (password) Anda.
3) Tekan tombol "Masuk" berwarna oranye.

Catatan penting:
• Akun ini rahasia, jangan dibagikan ke siapa pun.
• Kalau lupa sandi, hubungi atasan/admin Anda. Jangan menebak-nebak terlalu sering.`,
  },
  {
    category: B1, sort_order: 3, image_url: IMG('03-sidebar.svg'),
    title: 'Mengenal Menu di Sebelah Kiri',
    content:
`Semua halaman dibuka lewat daftar menu di sisi kiri layar. Ini yang paling sering Anda pakai:

1) "Order" — layar utama, tempat semua pesanan masuk dan dikerjakan.
2) "Histori" — melihat daftar pesanan yang sudah lewat.
3) "Keluar" (paling bawah, warna merah) — untuk keluar/logout saat selesai bekerja.

Di HP, daftar menu ini disembunyikan. Tekan ikon garis tiga (≡) di pojok kiri atas untuk membukanya.`,
  },

  // ── BAB 2 ──
  {
    category: B2, sort_order: 1, image_url: IMG('04-order-board.svg'),
    title: 'Memahami Halaman "Order"',
    content:
`Halaman "Order" terbagi menjadi 3 kolom. Bayangkan pesanan berjalan dari kanan ke kiri:

1) Kolom BIRU "Sedang Diproses" — pesanan yang sedang Anda siapkan/masak.
2) Kolom KUNING "Menunggu" — pesanan baru yang belum Anda kerjakan.
3) Kolom HIJAU "Selesai / Lunas" — pesanan yang sudah beres dan dibayar.

Setiap pesanan punya "Nomor Antrian" (contoh #102) supaya mudah dipanggil. Cukup hafalkan: baru di kuning, dikerjakan jadi biru, selesai jadi hijau.`,
  },
  {
    category: B2, sort_order: 2, image_url: IMG('05-terima.svg'),
    title: 'Menerima & Memproses Pesanan Baru',
    content:
`Saat ada pesanan baru di kolom kuning "Menunggu":

1) Lihat nomor antrian dan daftar pesanannya (contoh: 2x Original Sapi Besar).
2) Tekan tombol oranye "Terima & Proses".

Setelah ditekan, pesanan otomatis pindah ke kolom biru "Sedang Diproses". Artinya: Anda sudah menerima pesanan ini dan mulai menyiapkannya.

Tips: kalau pembayarannya QRIS, sistem menunggu pembayaran masuk secara otomatis — Anda tidak perlu menekan apa pun dulu.`,
  },
  {
    category: B2, sort_order: 3, image_url: IMG('06-selesai.svg'),
    title: 'Menyelesaikan Pesanan',
    content:
`Kalau makanan sudah jadi dan sudah diberikan ke pelanggan:

1) Cari pesanannya di kolom biru "Sedang Diproses".
2) Tekan tombol hijau "Tandai Selesai".

Pesanan akan pindah ke kolom hijau "Selesai / Lunas", dan uangnya otomatis dihitung ke total pendapatan hari ini. Selesai!

Jangan menekan "Tandai Selesai" sebelum makanan benar-benar diserahkan, ya.`,
  },
  {
    category: B2, sort_order: 4, image_url: IMG('07-batalkan.svg'),
    title: 'Membatalkan Pesanan',
    content:
`Kadang pelanggan batal. Untuk membatalkan pesanan:

1) Tekan kartu pesanannya untuk membuka detail.
2) Tekan tombol merah "Batalkan" di bawah, lalu pilih "Ya".

PENTING: Membatalkan tidak bisa dikembalikan. Lakukan hanya kalau pelanggan benar-benar batal, supaya laporan penjualan tetap akurat.`,
  },
  {
    category: B2, sort_order: 5, image_url: IMG('08-online-offline.svg'),
    title: 'Pesanan Online vs Offline & Bunyi Notifikasi',
    content:
`Pesanan datang dari dua sumber. Anda bisa memilihnya lewat tombol di atas daftar:

1) "Online" (biru) — pesanan dari pelanggan lewat website. Angka merah kecil menandakan berapa pesanan online yang masih aktif.
2) "Offline" (abu) — pesanan dari mesin/layar pesan di toko.
Pilih "Semua" untuk melihat keduanya sekaligus.

3) Setiap ada pesanan baru, terdengar bunyi "ding". Pastikan suara HP/komputer TIDAK dibisukan agar tidak ada pesanan yang terlewat.`,
  },

  // ── BAB 3 ──
  {
    category: B3, sort_order: 1, image_url: IMG('09-stok-habis.svg'),
    title: 'Menandai Menu Habis atau Tersedia',
    content:
`Kalau bahan suatu menu habis, matikan menunya supaya pelanggan tidak memesannya.

Caranya, buka "Manajemen Menu" di kiri, lalu:
1) Cari nama menunya (boleh pakai kolom pencarian di atas).
2) Cukup KLIK tulisan hijau "Tersedia" pada menu itu. Tidak perlu digeser — sekali klik, tulisannya langsung berubah menjadi merah "Habis", tandanya menu sekarang tidak bisa dipesan.

Kalau bahannya sudah ada lagi, klik sekali lagi pada tulisan merah "Habis" supaya kembali menjadi hijau "Tersedia".`,
  },

  // ── BAB 4 ──
  {
    category: B4, sort_order: 1, image_url: IMG('10-kiosk-qr.svg'),
    title: 'Menghubungkan Device Pelanggan (Kiosk)',
    content:
`"Device Pelanggan" adalah layar/tablet tempat pelanggan memesan sendiri. Untuk menyalakannya pertama kali:

1) Buka menu "Kontrol Device" di kiri, lalu tekan "Hubungkan via QR". Akan muncul sebuah kode QR.
2) Dari layar tablet pelanggan, pindai (scan) kode QR tersebut.

Setelah terpindai, tablet otomatis masuk dan siap dipakai pelanggan. Anda tidak perlu mengetik sandi di tablet.`,
  },
  {
    category: B4, sort_order: 2, image_url: IMG('11-kiosk-list.svg'),
    title: 'Memantau & Mengatur Device Pelanggan',
    content:
`Di halaman "Kontrol Device", Anda bisa melihat semua tablet pelanggan yang sedang menyala:

1) Tombol "Reload" — memuat ulang tablet kalau tampilannya error atau ngadat.
2) Tombol "Logout" — mengeluarkan tablet (misalnya toko mau tutup). Tablet akan kembali ke halaman awal.

Titik hijau berarti tablet sedang online (aktif). Titik abu berarti tablet sedang mati/tidak terhubung.`,
  },

  // ── BAB 5 ──
  {
    category: B5, sort_order: 1, image_url: IMG('12-histori.svg'),
    title: 'Melihat Histori Pesanan',
    content:
`Menu "Histori" berisi daftar semua pesanan cabang Anda, termasuk yang sudah selesai maupun dibatalkan.

1) Di atas ada ringkasan jumlah: Menunggu, Selesai, dan Dibatalkan.
2) Di bawahnya, daftar pesanan satu per satu lengkap dengan nomor antrian, total, dan statusnya.

Gunakan halaman ini bila ada pelanggan bertanya soal pesanan sebelumnya, atau saat mencocokkan uang di akhir shift.`,
  },
  {
    category: B5, sort_order: 2, image_url: IMG('13-laporan.svg'),
    title: 'Membaca Laporan Penjualan',
    content:
`Menu "Laporan" menampilkan ringkasan penjualan cabang Anda secara otomatis:

1) Kotak oranye besar = Total Penjualan (omzet). Di sampingnya ada jumlah pesanan dan rata-rata per pesanan.
2) Grafik batang di bawah = penjualan per hari, supaya terlihat hari mana yang ramai.

Anda tidak perlu menghitung manual — sistem yang menjumlahkan semuanya.`,
  },

  // ── BAB 6 ──
  {
    category: B6, sort_order: 1, image_url: IMG('14-tampilan.svg'),
    title: 'Mengatur Tampilan Layar Kiosk',
    content:
`Untuk apa menu ini?
"Tampilan Layar" mengatur gambar sambutan (cover) yang tampil memenuhi layar perangkat pelanggan saat sedang menganggur — yaitu saat belum ada yang memesan. Fungsinya untuk menarik perhatian pelanggan dan menampilkan wajah/branding cabang Anda, seperti poster digital di depan toko. Begitu pelanggan menyentuh layar, gambar ini hilang dan menu pesanan muncul.

Cara mengganti gambarnya:
1) Buka menu "Tampilan Layar" di kiri. Akan terlihat gambar cover yang sedang aktif untuk cabang Anda.
2) Tekan tombol "Upload Gambar Cover", lalu pilih gambar dari komputer atau HP. Gambar langsung berganti setelah selesai diunggah.

Tips agar hasilnya bagus dan rapi:
• Pakai gambar mendatar (landscape) dengan rasio 16:9 supaya pas memenuhi layar dan tidak terpotong.
• Format yang didukung: JPG, PNG, atau WebP.
• Gambar ini khusus untuk cabang Anda saja. Biasanya sudah diatur atasan — ubah bila memang diminta.`,
  },
  {
    category: B6, sort_order: 2, image_url: IMG('15-logout.svg'),
    title: 'Keluar dari Sistem (Logout)',
    content:
`Setiap selesai bekerja atau berganti shift, selalu keluar dari akun Anda.

1) Tekan tombol "Keluar" berwarna merah di pojok kiri bawah.

Kenapa penting? Supaya akun Anda tidak dipakai orang lain dan data tetap aman. Anggap ini seperti mengunci pintu sebelum pulang. Terima kasih sudah bertugas dengan baik! 👋`,
  },
]

const CATEGORIES = [B1, B2, B3, B4, B5, B6]

async function main() {
  // Idempotent: hapus bab panduan kasir lama (berdasarkan kategori)
  const { error: delErr } = await supabase.from('guides').delete().in('category', CATEGORIES)
  if (delErr) { console.error('Gagal hapus data lama:', delErr.message); process.exit(1) }

  const { data, error } = await supabase.from('guides').insert(guides).select('id, category, title, sort_order')
  if (error) { console.error('Gagal insert:', error.message); process.exit(1) }

  console.log(`OK: ${data.length} langkah panduan tersimpan.`)
  const byCat = {}
  for (const g of data) (byCat[g.category] ??= []).push(g)
  for (const cat of CATEGORIES) {
    console.log(`\n${cat}  (${byCat[cat]?.length || 0} langkah)`)
    for (const g of (byCat[cat] || []).sort((a, b) => a.sort_order - b.sort_order)) {
      console.log(`   ${g.sort_order}. ${g.title}`)
    }
  }
}

main()
