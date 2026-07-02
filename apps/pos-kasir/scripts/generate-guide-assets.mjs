// Generate ilustrasi SVG untuk Buku Panduan Kasir, disesuaikan dengan tampilan
// aplikasi kasir yang sekarang (bukan versi lama). Jalankan: node scripts/generate-guide-assets.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'guide-assets')
mkdirSync(OUT_DIR, { recursive: true })

const FONT = "Segoe UI, Roboto, Arial, sans-serif"
const CREAM = '#fdf3e7'
const CREAM_CARD = '#ffffff'
const ORANGE = '#f29744'
const ORANGE_DARK = '#c9711f'
const ORANGE_SOFT = '#fff1e0'
const BROWN = '#701604'
const INK = '#2b1a12'
const MUTED = '#8a7263'
const GREEN = '#0a7d2c'
const RED = '#dc2626'
const BORDER = '#eee0d2'

const NAV_ITEMS = [
  'Order', 'Manajemen Menu', 'Petty Cash', 'Histori',
  'Kontrol Device Pel...', 'Laporan', 'Tampilan Layar', 'Panduan',
]

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function sidebar(activeIndex) {
  let y = 150
  const items = NAV_ITEMS.map((label, i) => {
    const active = i === activeIndex
    const g = `
    <g>
      <rect x='16' y='${y}' width='198' height='42' rx='13' fill='${active ? ORANGE_SOFT : 'none'}'/>
      <circle cx='40' cy='${y + 21}' r='4' fill='${active ? ORANGE : '#c7b8a9'}'/>
      <text x='58' y='${y + 26}' font-family='${FONT}' font-size='14.5' font-weight='${active ? 800 : 600}' fill='${active ? ORANGE_DARK : MUTED}'>${esc(label)}</text>
    </g>`
    y += 50
    return g
  }).join('')
  return `
  <rect x='0' y='0' width='250' height='700' fill='${CREAM_CARD}'/>
  <line x1='250' y1='0' x2='250' y2='700' stroke='${BORDER}' stroke-width='2'/>
  <rect x='20' y='28' width='40' height='40' rx='12' fill='${ORANGE}'/>
  <text x='40' y='54' text-anchor='middle' font-family='${FONT}' font-size='18'>🥙</text>
  <text x='72' y='46' font-family='${FONT}' font-size='15' font-weight='800' fill='${INK}'>SHAWARMA</text>
  <text x='72' y='62' font-family='${FONT}' font-size='10' font-weight='800' fill='${MUTED}' letter-spacing='0.5'>CABANG SUKA SHAWARMA</text>
  <line x1='16' y1='90' x2='234' y2='90' stroke='${BORDER}' stroke-width='2'/>
  ${items}
  <g>
    <rect x='16' y='618' width='198' height='40' rx='13' fill='none'/>
    <text x='58' y='643' font-family='${FONT}' font-size='14' font-weight='700' fill='${MUTED}'>← Portal</text>
  </g>
  <g>
    <rect x='16' y='662' width='198' height='40' rx='13' fill='#fdeceb'/>
    <text x='58' y='687' font-family='${FONT}' font-size='14' font-weight='700' fill='${RED}'>⎋ Keluar</text>
  </g>`
}

function frame({ activeIndex, title, subtitle, body }) {
  return `<svg viewBox='0 0 1180 700' xmlns='http://www.w3.org/2000/svg'>
  <rect width='1180' height='700' fill='${CREAM}'/>
  ${sidebar(activeIndex)}
  <g transform='translate(284,36)'>
    <text x='0' y='26' font-family='${FONT}' font-size='26' font-weight='800' fill='${BROWN}'>${esc(title)}</text>
    ${subtitle ? `<text x='0' y='52' font-family='${FONT}' font-size='14' font-weight='600' fill='${MUTED}'>${esc(subtitle)}</text>` : ''}
  </g>
  <g transform='translate(284,${subtitle ? 76 : 60})'>
    ${body}
  </g>
</svg>`
}

function card(x, y, w, h, fill = CREAM_CARD, stroke = BORDER) {
  return `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='16' fill='${fill}' stroke='${stroke}' stroke-width='1.5'/>`
}
function text(x, y, s, { size = 14, weight = 600, fill = INK, anchor = 'start' } = {}) {
  return `<text x='${x}' y='${y}' text-anchor='${anchor}' font-family='${FONT}' font-size='${size}' font-weight='${weight}' fill='${fill}'>${esc(s)}</text>`
}
function badge(x, y, w, s, { fill = ORANGE_SOFT, textFill = ORANGE_DARK } = {}) {
  return `<rect x='${x}' y='${y}' width='${w}' height='24' rx='12' fill='${fill}'/>${text(x + w / 2, y + 16.5, s, { size: 11, weight: 800, fill: textFill, anchor: 'middle' })}`
}
function numberDot(x, y, n) {
  return `<circle cx='${x}' cy='${y}' r='16' fill='${ORANGE}'/>${text(x, y + 5, String(n), { size: 14, weight: 800, fill: '#fff', anchor: 'middle' })}`
}

const guides = []
function addGuide({ category, sortOrder, file, title, content, activeIndex, body }) {
  writeFileSync(join(OUT_DIR, file), frame({ activeIndex, title: title, subtitle: null, body }))
  guides.push({ category, sort_order: sortOrder, file, title, content })
}

// ── BAB 1 · Mengenal Sistem ──
const B1 = 'Bab 1 · Mengenal Sistem'
addGuide({
  category: B1, sortOrder: 1, file: '01-overview.svg', activeIndex: 0,
  title: 'Apa Itu Sistem Kasir Suka Shawarma?',
  content: `Sistem ini adalah "meja kerja digital" Anda sebagai kasir. Semua pesanan pelanggan — baik yang dipesan sendiri lewat layar toko (kiosk) maupun yang Anda input manual — akan muncul otomatis di halaman "Order".

Menu-menu di sisi kiri layar (sidebar) adalah semua tugas yang bisa Anda lakukan: mulai dari memproses pesanan, mengatur menu, mencatat kas kecil (Petty Cash), sampai melihat laporan penjualan.

Ikuti panduan ini bab demi bab dari atas ke bawah, ya.`,
  body: `
    ${card(0, 0, 860, 220, ORANGE_SOFT, 'none')}
    ${numberDot(30, 34, 1)}
    ${text(56, 40, 'Pesanan masuk otomatis ke halaman Order — lengkap dengan status & nominal.', { size: 14.5, weight: 700 })}
    ${numberDot(30, 74, 2)}
    ${text(56, 80, 'Sidebar kiri = semua fitur kasir: Order, Menu, Petty Cash, Histori, Device, Laporan, dst.', { size: 14.5, weight: 700 })}
    ${numberDot(30, 114, 3)}
    ${text(56, 120, 'Tidak perlu mencatat manual di kertas — semua tersimpan otomatis di sistem.', { size: 14.5, weight: 700 })}
  `,
})

addGuide({
  category: B1, sortOrder: 2, file: '02-login.svg', activeIndex: -1,
  title: 'Cara Masuk (Login)',
  content: `Sebelum bekerja, masuk dulu memakai akun yang diberikan atasan (SPV/Leader).

Langkah-langkahnya:
1) Ketik Username Anda (contoh: staff_dramaga).
2) Ketik Kata Sandi (password) Anda.
3) Tekan tombol "Masuk" berwarna oranye.

Catatan penting:
• Akun ini rahasia, jangan dibagikan ke siapa pun.
• Kalau lupa sandi, hubungi atasan/admin Anda.`,
  body: `
    <rect x='230' y='0' width='400' height='320' rx='24' fill='${CREAM_CARD}' stroke='${BORDER}' stroke-width='1.5'/>
    <rect x='390' y='30' width='80' height='80' rx='24' fill='${ORANGE}'/>
    <text x='430' y='80' text-anchor='middle' font-family='${FONT}' font-size='34'>🥙</text>
    ${text(430, 140, 'Masuk ke Akun Kasir', { size: 16, weight: 800, anchor: 'middle' })}
    <rect x='262' y='166' width='336' height='44' rx='12' fill='${CREAM}' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(280, 193, 'Username', { size: 13, weight: 600, fill: MUTED })}
    <rect x='262' y='222' width='336' height='44' rx='12' fill='${CREAM}' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(280, 249, '••••••••', { size: 13, weight: 600, fill: MUTED })}
    <rect x='262' y='278' width='336' height='46' rx='12' fill='${ORANGE}'/>
    ${text(430, 306, 'Masuk', { size: 15, weight: 800, fill: '#fff', anchor: 'middle' })}
  `,
})

addGuide({
  category: B1, sortOrder: 3, file: '03-sidebar.svg', activeIndex: 0,
  title: 'Mengenal Menu di Sebelah Kiri',
  content: `Semua halaman dibuka lewat daftar menu (sidebar) di sisi kiri layar:

1) "Order" — layar utama, semua pesanan masuk & dikerjakan di sini.
2) "Manajemen Menu" — atur menu tersedia/habis.
3) "Petty Cash" — catat kas kecil & dana operasional.
4) "Histori" — daftar & ringkasan semua pesanan.
5) "Kontrol Device Pelanggan" — kelola layar pesan-sendiri (kiosk) di toko.
6) "Laporan" — ringkasan & grafik penjualan.
7) "Tampilan Layar" — atur gambar sambutan di kiosk.
8) "Panduan" — buku panduan ini.

Paling bawah ada "Portal" (kembali ke portal utama) dan "Keluar" (logout).`,
  body: `${text(0, 20, 'Sidebar terlihat penuh di sisi kiri layar Anda →', { size: 15, weight: 700, fill: MUTED })}`,
})

// ── BAB 2 · Order & Pesanan ──
const B2 = 'Bab 2 · Order & Pesanan'
addGuide({
  category: B2, sortOrder: 1, file: '04-order-board.svg', activeIndex: 0,
  title: 'Memahami 3 Kolom di Halaman "Order"',
  content: `Halaman "Order" adalah layar utama kerja Anda, terbagi 3 kolom:

1) "Menunggu Pembayaran" — pesanan baru yang belum dibayar/diproses.
2) "Sedang Diproses" — pesanan yang sudah diterima kasir & sedang dibuatkan.
3) "Selesai / Lunas" — pesanan yang sudah beres, ada kolom pencarian nomor antrian.

Kalau kolom kosong akan muncul tulisan "Tidak ada pesanan ..." — itu normal, artinya belum ada aktivitas di kolom tersebut.`,
  body: `
    ${text(0, 20, 'Order', { size: 22, weight: 800, fill: BROWN })}
    <rect x='400' y='-4' width='170' height='40' rx='12' fill='${ORANGE}'/>
    ${text(485, 21, '+ Pesanan Baru', { size: 13.5, weight: 800, fill: '#fff', anchor: 'middle' })}
    <g transform='translate(0,52)'>
      ${card(0, 0, 260, 210)}
      ${text(16, 30, '🕐 Menunggu Pembayaran', { size: 13.5, weight: 800 })}
      ${badge(210, 16, 34, '0')}
      <rect x='16' y='50' width='228' height='140' rx='12' fill='none' stroke='${BORDER}' stroke-dasharray='6,6' stroke-width='2'/>
      ${text(130, 105, 'Tidak ada pesanan', { size: 12.5, weight: 700, fill: MUTED, anchor: 'middle' })}
      ${text(130, 124, 'tertunda', { size: 12.5, weight: 700, fill: MUTED, anchor: 'middle' })}

      ${card(280, 0, 260, 210)}
      ${text(296, 30, '🧑‍🍳 Sedang Diproses', { size: 13.5, weight: 800 })}
      ${badge(490, 16, 34, '0')}
      <rect x='296' y='50' width='228' height='140' rx='12' fill='none' stroke='${BORDER}' stroke-dasharray='6,6' stroke-width='2'/>
      ${text(410, 115, 'Tidak ada pesanan', { size: 12.5, weight: 700, fill: MUTED, anchor: 'middle' })}

      ${card(560, 0, 260, 210, '#eefaf1')}
      ${text(576, 30, '✅ Selesai / Lunas', { size: 13.5, weight: 800 })}
      ${badge(770, 16, 34, '2', { fill: '#dcf7e3', textFill: GREEN })}
      <rect x='576' y='50' width='228' height='30' rx='10' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(590, 69, '🔍 Cari antrian...', { size: 12, weight: 600, fill: MUTED })}
    </g>
  `,
})

addGuide({
  category: B2, sortOrder: 2, file: '05-filter-online-offline.svg', activeIndex: 0,
  title: 'Filter Pesanan: Semua / Online / Offline',
  content: `Di atas kolom Order ada 3 tombol filter:

1) "Semua" — tampilkan semua pesanan.
2) "Online" — pesanan yang datang dari pelanggan lewat website/aplikasi.
3) "Offline" — pesanan dari kiosk/layar pesan-sendiri di toko, atau input manual kasir.

Gunakan filter ini kalau ingin fokus memantau satu sumber pesanan saja.`,
  body: `
    <rect x='0' y='0' width='106' height='40' rx='12' fill='${INK}'/>
    ${text(53, 25, 'Semua', { size: 13.5, weight: 800, fill: '#fff', anchor: 'middle' })}
    <rect x='114' y='0' width='106' height='40' rx='12' fill='${CREAM_CARD}' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(167, 25, '🌐 Online', { size: 13.5, weight: 700, fill: INK, anchor: 'middle' })}
    <rect x='228' y='0' width='106' height='40' rx='12' fill='${CREAM_CARD}' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(281, 25, '🏬 Offline', { size: 13.5, weight: 700, fill: INK, anchor: 'middle' })}
    ${text(0, 84, 'Pilih salah satu untuk menyaring daftar pesanan yang tampil di 3 kolom.', { size: 14, weight: 600, fill: MUTED })}
  `,
})

addGuide({
  category: B2, sortOrder: 3, file: '06-pesanan-baru.svg', activeIndex: 0,
  title: 'Membuat Pesanan Manual (Kasir Langsung)',
  content: `Kalau ada pelanggan pesan langsung ke kasir (bukan lewat kiosk), input pesanannya secara manual:

1) Tekan tombol oranye "+ Pesanan Baru" di halaman Order.
2) Pilih tab "Kasir Langsung".
3) Cari & tekan menu yang dipesan — otomatis masuk ke "Keranjang" di kanan.
4) Tekan tombol "+"/"−" untuk ubah jumlah, atau tempat sampah untuk hapus.
5) Isi nama pelanggan (opsional) & pilih metode pembayaran: Tunai atau QRIS.
6) Tekan tombol pesan untuk menyimpan pesanan.`,
  body: `
    <rect x='0' y='0' width='150' height='36' rx='10' fill='${ORANGE_SOFT}'/>
    ${text(75, 23, '🏬 Kasir Langsung', { size: 12.5, weight: 800, fill: ORANGE_DARK, anchor: 'middle' })}
    <rect x='158' y='0' width='150' height='36' rx='10' fill='none' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(233, 23, '🌐 Channel Online', { size: 12.5, weight: 700, fill: MUTED, anchor: 'middle' })}
    <g transform='translate(0,52)'>
      ${card(0, 0, 560, 220)}
      ${text(16, 30, '1. Pilih Menu', { size: 13, weight: 800, fill: MUTED })}
      <rect x='16' y='44' width='120' height='90' rx='12' fill='#fdece0' stroke='${ORANGE}' stroke-width='2'/>
      ${text(76, 100, 'Suka Samyang', { size: 11.5, weight: 800, anchor: 'middle' })}
      ${text(76, 118, 'Rp 30.000', { size: 11.5, weight: 700, fill: ORANGE_DARK, anchor: 'middle' })}
      <rect x='150' y='44' width='120' height='90' rx='12' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(210, 100, 'Suka Beef', { size: 11.5, weight: 700, anchor: 'middle' })}
      <rect x='284' y='44' width='120' height='90' rx='12' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(344, 100, 'Suka Chicken', { size: 11.5, weight: 700, anchor: 'middle' })}

      ${card(580, 0, 280, 220, ORANGE_SOFT, 'none')}
      ${text(596, 30, '🛍 Keranjang', { size: 13, weight: 800 })}
      <rect x='596' y='44' width='248' height='60' rx='10' fill='#fff'/>
      ${text(610, 64, 'Suka Samyang', { size: 12.5, weight: 800 })}
      ${text(610, 84, 'Rp 30.000', { size: 12, weight: 700, fill: ORANGE_DARK })}
      ${text(810, 78, '1', { size: 13, weight: 800, anchor: 'middle' })}
      <rect x='596' y='114' width='120' height='34' rx='10' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(656, 136, 'Tunai', { size: 12, weight: 700, anchor: 'middle' })}
      <rect x='724' y='114' width='120' height='34' rx='10' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(784, 136, 'QRIS', { size: 12, weight: 700, anchor: 'middle' })}
    </g>
  `,
})

addGuide({
  category: B2, sortOrder: 4, file: '07-stok-kritis.svg', activeIndex: 0,
  title: 'Notifikasi Stok Kritis & Panel Stok Outlet',
  content: `Di bagian atas halaman Order, kadang muncul banner merah "STOK KRITIS DI OUTLET ANDA" — ini artinya ada bahan baku yang hampir habis atau sudah habis.

1) Tekan tombol "Cek Stok" pada banner untuk melihat detail stok outlet.
2) Ada juga panel kecil "Stok Outlet" di sisi kanan halaman Order yang menampilkan bahan dengan status "Kritis!" (merah) atau "Menipis" (oranye).

Segera laporkan ke SPV/Leader kalau ada bahan penting yang kritis, supaya menu terkait tidak salah jual.`,
  body: `
    <rect x='0' y='0' width='860' height='58' rx='14' fill='#fdecec' stroke='${RED}' stroke-width='1.5'/>
    ${text(20, 26, '🔥 STOK KRITIS DI OUTLET ANDA!', { size: 13.5, weight: 800, fill: RED })}
    ${text(20, 44, 'BAWANG, JINTEN, AYAM, CENGKEH +1 lainnya', { size: 12, weight: 600, fill: '#b91c1c' })}
    <rect x='730' y='16' width='110' height='30' rx='10' fill='#fff' stroke='${RED}' stroke-width='1.5'/>
    ${text(785, 36, 'Cek Stok', { size: 12, weight: 800, fill: RED, anchor: 'middle' })}
    <g transform='translate(0,86)'>
      ${card(0, 0, 300, 190)}
      ${text(16, 30, '📦 Stok Outlet', { size: 13.5, weight: 800 })}
      ${text(16, 62, 'BAWANG', { size: 13, weight: 700 })}
      ${badge(210, 48, 70, 'Kritis! 2 kg', { fill: '#fdecec', textFill: RED })}
      ${text(16, 96, 'JINTEN', { size: 13, weight: 700 })}
      ${badge(210, 82, 70, 'Kritis! 0 kg', { fill: '#fdecec', textFill: RED })}
      ${text(16, 130, 'AYAM', { size: 13, weight: 700 })}
      ${badge(210, 116, 70, 'Menipis', { fill: '#fdf1de', textFill: ORANGE_DARK })}
    </g>
  `,
})

// ── BAB 3 · Manajemen Menu ──
const B3 = 'Bab 3 · Manajemen Menu'
addGuide({
  category: B3, sortOrder: 1, file: '08-menu-list.svg', activeIndex: 1,
  title: 'Melihat & Mencari Menu',
  content: `Halaman "Manajemen Menu" menampilkan semua menu cabang Anda dalam bentuk tabel: Foto, Nama Menu, Kategori, Harga, Status, dan Aksi.

Gunakan kolom pencarian "Cari menu..." di kanan atas untuk cepat menemukan menu tertentu, terutama kalau daftarnya panjang.`,
  body: `
    ${text(0, 18, 'Manajemen Menu Kasir', { size: 18, weight: 800, fill: BROWN })}
    <rect x='560' y='-30' width='230' height='36' rx='10' fill='${CREAM_CARD}' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(578, -7, '🔍 Cari menu...', { size: 12.5, weight: 600, fill: MUTED })}
    <g transform='translate(0,40)'>
      ${card(0, 0, 790, 170)}
      ${text(16, 26, 'Foto', { size: 11.5, weight: 800, fill: MUTED })}
      ${text(80, 26, 'Nama Menu', { size: 11.5, weight: 800, fill: MUTED })}
      ${text(360, 26, 'Harga', { size: 11.5, weight: 800, fill: MUTED })}
      ${text(470, 26, 'Status', { size: 11.5, weight: 800, fill: MUTED })}
      ${text(650, 26, 'Aksi', { size: 11.5, weight: 800, fill: MUTED })}
      <line x1='16' y1='38' x2='774' y2='38' stroke='${BORDER}' stroke-width='1.5'/>
      <rect x='16' y='50' width='44' height='44' rx='10' fill='#fdece0'/>
      ${text(80, 70, 'Suka Samyang', { size: 13, weight: 700 })}
      ${text(360, 76, 'Rp 30.000', { size: 12.5, weight: 700 })}
      ${badge(470, 60, 78, 'Tersedia', { fill: '#dcf7e3', textFill: GREEN })}
      <rect x='650' y='60' width='70' height='26' rx='8' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(685, 78, 'Aksi ⌄', { size: 11.5, weight: 700, anchor: 'middle' })}
      <rect x='16' y='106' width='44' height='44' rx='10' fill='#fdece0'/>
      ${text(80, 126, 'Suka Beef', { size: 13, weight: 700 })}
      ${text(360, 132, 'Rp 32.000', { size: 12.5, weight: 700 })}
      ${badge(470, 116, 78, 'Tersedia', { fill: '#dcf7e3', textFill: GREEN })}
      <rect x='650' y='116' width='70' height='26' rx='8' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(685, 134, 'Aksi ⌄', { size: 11.5, weight: 700, anchor: 'middle' })}
    </g>
  `,
})

addGuide({
  category: B3, sortOrder: 2, file: '09-menu-toggle.svg', activeIndex: 1,
  title: 'Menandai Menu Habis atau Tersedia',
  content: `Kalau bahan suatu menu habis, matikan menunya supaya pelanggan tidak bisa memesannya.

Caranya:
1) Buka "Manajemen Menu", cari nama menunya.
2) Klik tulisan hijau "Tersedia" pada menu itu — langsung berubah jadi merah "Habis". Tidak perlu tombol lain.
3) Kalau bahan sudah tersedia lagi, klik lagi tulisan "Habis" supaya kembali menjadi "Tersedia".`,
  body: `
    <g transform='translate(0,0)'>
      ${card(0, 0, 340, 90)}
      ${text(20, 32, 'Suka Fried Chicken', { size: 13.5, weight: 800 })}
      ${badge(20, 46, 90, 'Tersedia', { fill: '#dcf7e3', textFill: GREEN })}
      ${text(150, 66, '← klik untuk ubah', { size: 11.5, weight: 700, fill: MUTED })}
    </g>
    <g transform='translate(0,110)'>
      ${card(0, 0, 340, 90, '#fdecec')}
      ${text(20, 32, 'Suka Fried Chicken', { size: 13.5, weight: 800 })}
      ${badge(20, 46, 70, 'Habis', { fill: '#fdd8d8', textFill: RED })}
      ${text(130, 66, '← setelah diklik', { size: 11.5, weight: 700, fill: MUTED })}
    </g>
  `,
})

// ── BAB 4 · Petty Cash ──
const B4 = 'Bab 4 · Petty Cash'
addGuide({
  category: B4, sortOrder: 1, file: '10-petty-cash.svg', activeIndex: 2,
  title: 'Memahami Laci Kasir & Dana Operasional',
  content: `Halaman "Petty Cash" mengelola dua jenis uang di outlet:

1) "Laci Kasir (Sales)" — uang hasil penjualan tunai hari ini.
2) "Dana Operasional" — kas kecil untuk belanja kebutuhan mendadak (misal beli es batu, plastik).

Kedua nominal ini ditampilkan jelas di bagian atas halaman, supaya Anda tahu persis berapa uang yang seharusnya ada di laci.`,
  body: `
    ${card(0, 0, 380, 130, '#eefaf1')}
    ${text(20, 34, '💳 LACI KASIR (SALES)', { size: 12, weight: 800, fill: GREEN })}
    ${text(20, 70, 'Rp 0', { size: 26, weight: 800 })}
    ${text(20, 96, 'Awal Rp 0', { size: 12, weight: 600, fill: MUTED })}
    ${card(400, 0, 380, 130)}
    ${text(420, 34, '💰 DANA OPERASIONAL', { size: 12, weight: 800, fill: ORANGE_DARK })}
    ${text(420, 70, 'Rp 300.000', { size: 26, weight: 800 })}
    ${text(420, 96, 'Awal Shift: Rp 300.000 · Dana operasional', { size: 12, weight: 600, fill: MUTED })}
  `,
})

addGuide({
  category: B4, sortOrder: 2, file: '11-petty-topup.svg', activeIndex: 2,
  title: 'Mencatat Pengeluaran & Mengajukan Top Up',
  content: `Untuk mencatat belanja pakai Dana Operasional:
1) Buka bagian "Catat Pengeluaran (Ambil dari Petty Cash)".
2) Pilih kategori (contoh: Operasional - Plastik, ATK).
3) Isi keterangan/nama barang & nominal, lalu simpan.

Kalau Dana Operasional sudah menipis, tekan tombol "Ajukan Top Up Petty Cash" di kanan atas halaman untuk minta tambahan dana ke atasan.`,
  body: `
    <rect x='0' y='0' width='260' height='36' rx='10' fill='#eef2ff'/>
    ${text(20, 23, '↳ Ajukan Top Up Petty Cash', { size: 12.5, weight: 800, fill: '#4338ca' })}
    <g transform='translate(0,52)'>
      ${card(0, 0, 400, 190)}
      ${text(16, 30, '↗ Catat Pengeluaran', { size: 13, weight: 800, fill: RED })}
      ${text(16, 56, 'KATEGORI', { size: 10.5, weight: 800, fill: MUTED })}
      <rect x='16' y='64' width='368' height='36' rx='10' fill='${CREAM}' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(30, 87, 'Operasional (Plastik, ATK)', { size: 12.5, weight: 600 })}
      ${text(16, 118, 'KETERANGAN / NAMA BARANG', { size: 10.5, weight: 800, fill: MUTED })}
      <rect x='16' y='126' width='368' height='36' rx='10' fill='${CREAM}' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(30, 149, 'Contoh: Beli es kristal 2 bungkus', { size: 12, weight: 600, fill: MUTED })}
    </g>
  `,
})

// ── BAB 5 · Histori & Dashboard ──
const B5 = 'Bab 5 · Histori & Dashboard Pesanan'
addGuide({
  category: B5, sortOrder: 1, file: '12-histori.svg', activeIndex: 3,
  title: 'Melihat Ringkasan Dashboard Pesanan',
  content: `Menu "Histori" membuka "Dashboard Pesanan", ringkasan lengkap aktivitas hari ini:

1) Kotak "Menunggu" & "Selesai" — jumlah pesanan per status.
2) Kotak oranye "Revenue Hari Ini" — total pendapatan hari ini.
3) Tab "Semua Pesanan / Menunggu / Selesai / Dibatalkan" untuk menyaring daftar di bawahnya.

Halaman ini auto-refresh setiap 15 detik.`,
  body: `
    ${card(0, 0, 210, 110)}
    ${text(20, 32, '🕐 MENUNGGU', { size: 11, weight: 800, fill: MUTED })}
    ${text(20, 72, '0', { size: 28, weight: 800, fill: ORANGE_DARK })}
    ${card(224, 0, 210, 110)}
    ${text(244, 32, '✅ SELESAI', { size: 11, weight: 800, fill: MUTED })}
    ${text(244, 72, '32', { size: 28, weight: 800 })}
    ${card(448, 0, 260, 110, ORANGE)}
    ${text(468, 32, '💳 REVENUE HARI INI', { size: 11, weight: 800, fill: '#fff5ea' })}
    ${text(468, 76, 'Rp 1.681.029', { size: 22, weight: 800, fill: '#fff' })}
    <g transform='translate(0,130)'>
      <rect x='0' y='0' width='150' height='36' rx='10' fill='${INK}'/>
      ${text(75, 23, 'Semua Pesanan', { size: 12, weight: 800, fill: '#fff', anchor: 'middle' })}
      <rect x='158' y='0' width='110' height='36' rx='10' fill='none' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(213, 23, 'Menunggu', { size: 12, weight: 700, anchor: 'middle' })}
      <rect x='276' y='0' width='90' height='36' rx='10' fill='none' stroke='${BORDER}' stroke-width='1.5'/>
      ${text(321, 23, 'Selesai', { size: 12, weight: 700, anchor: 'middle' })}
    </g>
  `,
})

addGuide({
  category: B5, sortOrder: 2, file: '13-histori-detail.svg', activeIndex: 3,
  title: 'Melihat Detail Item Pesanan',
  content: `Tiap baris pesanan di Dashboard Pesanan menampilkan nomor order, status, waktu, jumlah item, dan total harga.

Tekan ikon panah (⌄) di ujung kanan baris pesanan untuk membuka rincian — Anda bisa melihat menu apa saja yang dipesan beserta harga satuannya. Berguna kalau ada pelanggan bertanya soal pesanan sebelumnya, atau saat mencocokkan uang di akhir shift.`,
  body: `
    ${card(0, 0, 790, 150)}
    ${text(20, 30, '#3896', { size: 14, weight: 800, fill: ORANGE_DARK })}
    ${badge(80, 18, 66, 'Selesai', { fill: '#dcf7e3', textFill: GREEN })}
    ${text(20, 50, '2 Jul, 11.45 · 3 pesanan utama', { size: 11.5, weight: 600, fill: MUTED })}
    ${text(770, 30, 'Rp 98.000', { size: 14, weight: 800, anchor: 'end' })}
    <line x1='16' y1='64' x2='774' y2='64' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(30, 92, '1  Original Sapi Sedang', { size: 12.5, weight: 700 })}
    ${text(770, 92, 'Rp 27.000', { size: 12.5, weight: 700, anchor: 'end' })}
    ${text(30, 120, '1  Original Ayam Besar', { size: 12.5, weight: 700 })}
    ${text(770, 120, 'Rp 29.000', { size: 12.5, weight: 700, anchor: 'end' })}
  `,
})

// ── BAB 6 · Kontrol Device Pelanggan ──
const B6 = 'Bab 6 · Kontrol Device Pelanggan'
addGuide({
  category: B6, sortOrder: 1, file: '14-kiosk-qr.svg', activeIndex: 4,
  title: 'Menghubungkan Device Pelanggan (Kiosk)',
  content: `"Device Pelanggan" adalah layar/tablet tempat pelanggan memesan sendiri. Untuk menyalakannya:

1) Buka menu "Kontrol Device Pelanggan", tekan tombol ungu "Hubungkan via QR" — muncul kode QR.
2) Dari layar tablet pelanggan, pindai (scan) kode QR tersebut.

Setelah terpindai, tablet otomatis masuk dan siap dipakai pelanggan tanpa perlu mengetik sandi apa pun.`,
  body: `
    ${text(0, 24, 'Kontrol Device Pelanggan', { size: 18, weight: 800, fill: BROWN })}
    <rect x='560' y='2' width='90' height='34' rx='10' fill='#fff' stroke='${BORDER}' stroke-width='1.5'/>
    ${text(605, 24, '↻ Refresh', { size: 11.5, weight: 700, anchor: 'middle' })}
    <rect x='658' y='2' width='170' height='34' rx='10' fill='#5b4bda'/>
    ${text(743, 24, '▦ Hubungkan via QR', { size: 11.5, weight: 800, fill: '#fff', anchor: 'middle' })}
    <g transform='translate(0,54)'>
      ${card(0, 0, 790, 42, '#fef7e6')}
      ${text(16, 26, '⚠ Panduan Mengelola Banyak Device — cocokkan ID Device di pojok layar tablet.', { size: 12, weight: 700, fill: '#92600a' })}
    </g>
  `,
})

addGuide({
  category: B6, sortOrder: 2, file: '15-kiosk-list.svg', activeIndex: 4,
  title: 'Memantau & Logout Device',
  content: `Di halaman "Kontrol Device Pelanggan" Anda bisa melihat semua tablet pelanggan yang sedang menyala:

1) Titik hijau "Terhubung" — tablet sedang online/aktif.
2) Tombol "Refresh" — memuat ulang kalau tampilan tablet error/ngadat.
3) Tombol merah "Logout Semua Device" — mengeluarkan semua tablet (misal toko mau tutup).

Kalau tidak ada tablet menyala, akan muncul tulisan "Tidak ada device online".`,
  body: `
    ${card(0, 0, 790, 130)}
    <circle cx='40' cy='40' r='6' fill='${GREEN}'/>
    ${text(56, 46, 'Terhubung', { size: 13, weight: 800, fill: GREEN })}
    ${text(0, 90, '🖥', { size: 40, anchor: 'middle' })}
    ${text(300, 100, 'Tidak ada device online', { size: 14, weight: 800, fill: MUTED, anchor: 'middle' })}
    ${text(300, 118, 'Device yang menyala akan muncul otomatis di sini.', { size: 11.5, weight: 600, fill: MUTED, anchor: 'middle' })}
    <rect x='560' y='-24' width='210' height='34' rx='10' fill='#fdecec'/>
    ${text(665, -2, '⏻ Logout Semua Device', { size: 11.5, weight: 800, fill: RED, anchor: 'middle' })}
  `,
})

// ── BAB 7 · Laporan ──
const B7 = 'Bab 7 · Laporan & Analitik'
addGuide({
  category: B7, sortOrder: 1, file: '16-laporan.svg', activeIndex: 5,
  title: 'Membaca Laporan & Analitik Cabang',
  content: `Menu "Laporan" menampilkan insight bisnis cabang Anda secara real-time:

1) Kotak oranye "Total Pendapatan" — omzet pada periode yang dipilih (default: Hari Ini).
2) "Total Pesanan Sukses", "Rata-rata / Pesanan", dan "Jam Tersibuk".
3) Di bawahnya ada rincian "Status Transaksi" (Selesai vs Dibatalkan), "Distribusi Pembayaran", dan "Kategori Produk".

Ubah periode lewat dropdown "Hari Ini" di kanan atas kalau ingin melihat rentang tanggal lain. Anda tidak perlu menghitung manual — sistem menjumlahkan semuanya otomatis.`,
  body: `
    ${card(0, 0, 190, 100, ORANGE)}
    ${text(16, 30, 'TOTAL PENDAPATAN', { size: 9.5, weight: 800, fill: '#fff5ea' })}
    ${text(16, 66, 'Rp 0', { size: 22, weight: 800, fill: '#fff' })}
    ${card(200, 0, 190, 100)}
    ${text(216, 30, 'PESANAN SUKSES', { size: 9.5, weight: 800, fill: MUTED })}
    ${text(216, 66, '0', { size: 22, weight: 800 })}
    ${card(400, 0, 190, 100)}
    ${text(416, 30, 'RATA-RATA/PESANAN', { size: 9.5, weight: 800, fill: MUTED })}
    ${text(416, 66, 'Rp 0', { size: 22, weight: 800 })}
    ${card(600, 0, 190, 100)}
    ${text(616, 30, 'JAM TERSIBUK', { size: 9.5, weight: 800, fill: MUTED })}
    ${text(616, 66, '—', { size: 22, weight: 800 })}
    <g transform='translate(0,116)'>
      ${card(0, 0, 260, 130)}
      ${text(16, 26, 'Status Transaksi', { size: 13, weight: 800 })}
      ${text(16, 60, '✅ Selesai', { size: 12.5, weight: 700, fill: GREEN })}
      ${text(240, 60, '0', { size: 13, weight: 800, anchor: 'end' })}
      ${text(16, 96, '❌ Dibatalkan', { size: 12.5, weight: 700, fill: RED })}
      ${text(240, 96, '0', { size: 13, weight: 800, anchor: 'end' })}
    </g>
  `,
})

// ── BAB 8 · Tampilan Layar & Keluar ──
const B8 = 'Bab 8 · Tampilan Layar & Keluar'
addGuide({
  category: B8, sortOrder: 1, file: '17-tampilan.svg', activeIndex: 6,
  title: 'Mengatur Gambar Cover Kiosk',
  content: `"Tampilan Layar" mengatur gambar sambutan (cover) yang tampil penuh di layar tablet pelanggan saat sedang menganggur (attract screen) — seperti poster digital di depan toko.

Cara mengganti:
1) Buka menu "Tampilan Layar" — terlihat gambar cover yang aktif untuk cabang Anda.
2) Tekan tombol "Upload Gambar Cover", pilih gambar dari komputer/HP.

Tips: pakai gambar landscape rasio 16:9, format JPG/PNG/WebP, supaya pas dan tidak terpotong.`,
  body: `
    ${text(0, 20, 'Tampilan Layar Kiosk', { size: 18, weight: 800, fill: BROWN })}
    ${text(0, 42, 'Kelola gambar yang tampil saat kiosk sedang istirahat', { size: 12.5, weight: 600, fill: MUTED })}
    <g transform='translate(0,60)'>
      ${card(0, 0, 340, 150)}
      ${text(16, 26, 'Gambar Cover Cabang Ini', { size: 13, weight: 800 })}
      <rect x='16' y='36' width='308' height='72' rx='10' fill='${CREAM}' stroke='${BORDER}' stroke-width='1.5'/>
      <rect x='16' y='116' width='308' height='22' rx='10' fill='${ORANGE}'/>
      ${text(170, 132, '⬆ Upload Gambar Cover', { size: 10.5, weight: 800, fill: '#fff', anchor: 'middle' })}
    </g>
  `,
})

addGuide({
  category: B8, sortOrder: 2, file: '18-logout.svg', activeIndex: -1,
  title: 'Keluar dari Sistem (Logout)',
  content: `Setiap selesai bekerja atau berganti shift, selalu keluar dari akun Anda.

1) Tekan tombol "Keluar" berwarna merah di pojok kiri bawah sidebar.

Kenapa penting? Supaya akun Anda tidak dipakai orang lain dan data tetap aman — anggap seperti mengunci pintu sebelum pulang. Terima kasih sudah bertugas dengan baik!`,
  body: `
    ${card(0, 0, 300, 70, '#fdecec')}
    ${text(24, 44, '⎋  Keluar', { size: 16, weight: 800, fill: RED })}
    ${text(0, 106, 'Tombol ini ada di paling bawah sidebar kiri.', { size: 13.5, weight: 700, fill: MUTED })}
  `,
})

console.log(`Generated ${guides.length} guide SVG assets.`)
writeFileSync(join(__dirname, 'guide-content.json'), JSON.stringify(guides, null, 2))
console.log('Wrote scripts/guide-content.json (used by seed-panduan-kasir.mjs)')
