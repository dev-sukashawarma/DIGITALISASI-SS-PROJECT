// Generator ilustrasi "screenshot" untuk Buku Panduan Kasir.
// Menghasilkan file SVG di public/guide-assets/ — tampilan mock yang dibuat
// menyerupai layar kasir asli, lengkap dengan callout bernomor yang nyambung
// ke langkah pada teks panduan. Jalankan: node scripts/gen-guide-assets.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'guide-assets')
mkdirSync(OUT, { recursive: true })

const C = {
  amber: '#f59e0b', amber50: '#fffbeb', amber100: '#fef3c7', amber600: '#d97706',
  ink: '#111827', gray: '#6b7280', gray400: '#9ca3af', gray300: '#d1d5db',
  line: '#e5e7eb', bg: '#f9fafb', white: '#ffffff',
  blue: '#3b82f6', blue50: '#eff6ff', blue100: '#dbeafe', blue600: '#2563eb',
  emerald: '#10b981', emerald50: '#ecfdf5', emerald600: '#059669',
  red: '#ef4444', red50: '#fef2f2',
}
const FONT = "font-family='Segoe UI, Roboto, Arial, sans-serif'"
const W = 1200, H = 760
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Callout bernomor (lingkaran oranye) — penanda langkah di gambar
function dot(n, x, y, r = 18) {
  return `<g>
    <circle cx='${x}' cy='${y}' r='${r + 3}' fill='#ffffff' opacity='0.9'/>
    <circle cx='${x}' cy='${y}' r='${r}' fill='${C.amber}' stroke='#ffffff' stroke-width='3'/>
    <text x='${x}' y='${y + 6}' text-anchor='middle' ${FONT} font-size='19' font-weight='800' fill='#ffffff'>${n}</text>
  </g>`
}
// Pill teks kecil (badge)
function pill(x, y, w, h, text, fill, txtColor, fs = 13) {
  return `<g><rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${h / 2}' fill='${fill}'/>
    <text x='${x + w / 2}' y='${y + h / 2 + fs * 0.35}' text-anchor='middle' ${FONT} font-size='${fs}' font-weight='700' fill='${txtColor}'>${esc(text)}</text></g>`
}

const NAV = [
  { t: 'Order', i: 'bell' },
  { t: 'Manajemen Menu', i: 'menu' },
  { t: 'Histori', i: 'clip' },
  { t: 'Kontrol Device', i: 'monitor' },
  { t: 'Laporan', i: 'chart' },
  { t: 'Tampilan Layar', i: 'image' },
  { t: 'Panduan', i: 'book' },
]

function sidebar(active = -1) {
  let rows = ''
  NAV.forEach((n, idx) => {
    const y = 150 + idx * 56
    const on = idx === active
    rows += `<g>
      <rect x='16' y='${y}' width='198' height='44' rx='14' fill='${on ? C.amber50 : 'none'}'/>
      <rect x='32' y='${y + 13}' width='18' height='18' rx='5' fill='none' stroke='${on ? C.amber : C.gray400}' stroke-width='2'/>
      <text x='62' y='${y + 28}' ${FONT} font-size='15.5' font-weight='${on ? 800 : 600}' fill='${on ? C.amber600 : C.gray}'>${esc(n.t)}</text>
    </g>`
  })
  return `<g>
    <rect x='0' y='0' width='230' height='${H}' fill='${C.white}'/>
    <line x1='230' y1='0' x2='230' y2='${H}' stroke='${C.line}' stroke-width='2'/>
    <!-- brand -->
    <rect x='24' y='34' width='42' height='42' rx='13' fill='${C.amber}'/>
    <text x='45' y='61' text-anchor='middle' ${FONT} font-size='22'>🥙</text>
    <text x='80' y='52' ${FONT} font-size='16' font-weight='800' fill='${C.ink}'>Hai, Kasir</text>
    <g><circle cx='84' cy='66' r='4' fill='${C.emerald}'/><text x='94' y='71' ${FONT} font-size='11' font-weight='800' fill='${C.amber}' letter-spacing='1'>CABANG EMPANG</text></g>
    ${rows}
    <g><rect x='16' y='${H - 64}' width='198' height='44' rx='14' fill='${C.red50}'/>
    <text x='40' y='${H - 36}' ${FONT} font-size='15.5' font-weight='700' fill='${C.red}'>⎋  Keluar</text></g>
  </g>`
}

function frame(active, inner, title, subtitle) {
  return `<svg viewBox='0 0 ${W} ${H}' xmlns='http://www.w3.org/2000/svg'>
    <rect width='${W}' height='${H}' fill='${C.bg}'/>
    ${sidebar(active)}
    <g transform='translate(266,40)'>
      ${title ? `<text x='0' y='28' ${FONT} font-size='30' font-weight='800' fill='${C.ink}'>${esc(title)}</text>` : ''}
      ${subtitle ? `<text x='0' y='56' ${FONT} font-size='15' font-weight='600' fill='${C.gray}'>${esc(subtitle)}</text>` : ''}
    </g>
    ${inner}
  </svg>`
}

const files = {}

// ── 01 Overview ──────────────────────────────────────────────
files['01-overview.svg'] = frame(0,
  `<g transform='translate(266,120)'>
    <rect x='0' y='0' width='430' height='250' rx='20' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <rect x='24' y='24' width='120' height='14' rx='7' fill='${C.amber100}'/>
    <rect x='24' y='58' width='382' height='52' rx='14' fill='${C.amber50}' stroke='${C.amber100}' stroke-width='2'/>
    <text x='44' y='90' ${FONT} font-size='17' font-weight='800' fill='${C.amber600}'>🔔  Pesanan Baru Masuk Otomatis</text>
    <rect x='24' y='126' width='382' height='44' rx='12' fill='${C.bg}'/>
    <text x='44' y='154' ${FONT} font-size='15' font-weight='700' fill='${C.gray}'>Antrian #102  ·  Rp 51.000</text>
    <rect x='24' y='184' width='382' height='44' rx='12' fill='${C.bg}'/>
    <text x='44' y='212' ${FONT} font-size='15' font-weight='700' fill='${C.gray}'>Antrian #103  ·  Rp 36.000</text>

    <rect x='462' y='0' width='430' height='250' rx='20' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='486' y='42' ${FONT} font-size='17' font-weight='800' fill='${C.ink}'>Sistem Kasir Digital</text>
    <text x='486' y='78' ${FONT} font-size='14.5' fill='${C.gray}'>Semua pesanan dari pelanggan</text>
    <text x='486' y='102' ${FONT} font-size='14.5' fill='${C.gray}'>tampil di satu layar. Kasir tinggal</text>
    <text x='486' y='126' ${FONT} font-size='14.5' fill='${C.gray}'>terima, proses, lalu selesaikan.</text>
    ${pill(486, 150, 150, 34, '✓ Mudah dipakai', C.emerald50, C.emerald600, 14)}
    ${pill(646, 150, 150, 34, '✓ Tanpa ribet', C.emerald50, C.emerald600, 14)}
  </g>
  ${dot(1, 286, 175)} ${dot(2, 748, 175)}`,
  'Selamat Datang di Sistem Kasir', 'Layar utama kerja Anda sehari-hari')

// ── 02 Login ─────────────────────────────────────────────────
files['02-login.svg'] = `<svg viewBox='0 0 ${W} ${H}' xmlns='http://www.w3.org/2000/svg'>
  <rect width='${W}' height='${H}' fill='#FFFBF5'/>
  <rect x='390' y='150' width='420' height='460' rx='28' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
  <rect x='560' y='192' width='80' height='80' rx='24' fill='${C.amber}'/>
  <text x='600' y='248' text-anchor='middle' ${FONT} font-size='40'>🥙</text>
  <text x='600' y='312' text-anchor='middle' ${FONT} font-size='24' font-weight='800' fill='${C.ink}'>Masuk Akun Kasir</text>
  <text x='600' y='342' text-anchor='middle' ${FONT} font-size='15' fill='${C.gray}'>Gunakan akun dari atasan Anda</text>
  <rect x='430' y='372' width='340' height='52' rx='14' fill='${C.bg}' stroke='${C.line}' stroke-width='2'/>
  <text x='450' y='404' ${FONT} font-size='15' fill='${C.gray400}'>Email / Username</text>
  <rect x='430' y='436' width='340' height='52' rx='14' fill='${C.bg}' stroke='${C.line}' stroke-width='2'/>
  <text x='450' y='468' ${FONT} font-size='15' fill='${C.gray400}'>Kata sandi  ••••••••</text>
  <rect x='430' y='508' width='340' height='54' rx='14' fill='${C.amber}'/>
  <text x='600' y='542' text-anchor='middle' ${FONT} font-size='17' font-weight='800' fill='#ffffff'>Masuk</text>
  ${dot(1, 450, 398)} ${dot(2, 450, 462)} ${dot(3, 600, 535)}`

// ── 03 Sidebar ───────────────────────────────────────────────
files['03-sidebar.svg'] = frame(-1,
  `${dot(1, 145, 178)} ${dot(2, 145, 234)} ${dot(3, 145, 458)}
   <g transform='translate(300,150)'>
     <rect x='0' y='0' width='560' height='420' rx='20' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
     <text x='30' y='52' ${FONT} font-size='20' font-weight='800' fill='${C.ink}'>Menu di Sebelah Kiri</text>
     <text x='30' y='92' ${FONT} font-size='15.5' fill='${C.gray}'>Semua halaman bisa dibuka dari daftar</text>
     <text x='30' y='116' ${FONT} font-size='15.5' fill='${C.gray}'>menu di kiri. Yang paling sering dipakai:</text>
     ${pill(30, 140, 120, 34, 'Order', C.amber50, C.amber600, 14)}
     <text x='162' y='162' ${FONT} font-size='14.5' fill='${C.gray}'>tempat semua pesanan masuk</text>
     ${pill(30, 188, 120, 34, 'Histori', C.amber50, C.amber600, 14)}
     <text x='162' y='210' ${FONT} font-size='14.5' fill='${C.gray}'>melihat pesanan yang sudah lewat</text>
     ${pill(30, 236, 120, 34, 'Laporan', C.amber50, C.amber600, 14)}
     <text x='162' y='258' ${FONT} font-size='14.5' fill='${C.gray}'>melihat ringkasan penjualan</text>
     ${pill(30, 300, 220, 36, '⎋  Keluar = keluar/logout', C.red50, C.red, 13)}
   </g>`,
  'Mengenal Menu Navigasi', 'Tombol-tombol di sisi kiri layar')

// ── 04 Order board ───────────────────────────────────────────
function orderCol(x, color, bg, title, count, cards) {
  let c = ''
  cards.forEach((cd, i) => {
    const y = 70 + i * 92
    c += `<rect x='${x + 14}' y='${y}' width='262' height='78' rx='14' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
      <rect x='${x + 28}' y='${y + 16}' width='46' height='46' rx='13' fill='${color}'/>
      <text x='${x + 51}' y='${y + 38}' text-anchor='middle' ${FONT} font-size='9' font-weight='800' fill='#fff'>ANTRIAN</text>
      <text x='${x + 51}' y='${y + 56}' text-anchor='middle' ${FONT} font-size='16' font-weight='800' fill='#fff'>#${cd.n}</text>
      <text x='${x + 88}' y='${y + 34}' ${FONT} font-size='15' font-weight='800' fill='${C.ink}'>${cd.amt}</text>
      <text x='${x + 88}' y='${y + 56}' ${FONT} font-size='12' fill='${C.gray400}'>${cd.t}</text>`
  })
  return `<rect x='${x}' y='0' width='290' height='${70 + cards.length * 92 + 6}' rx='18' fill='${bg}'/>
    <rect x='${x + 14}' y='16' width='262' height='40' rx='12' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='${x + 32}' y='41' ${FONT} font-size='15' font-weight='800' fill='${C.ink}'>${esc(title)}</text>
    ${pill(x + 210, 24, 52, 24, count, bg === C.white ? C.amber50 : C.white, color, 12)}
    ${c}`
}
files['04-order-board.svg'] = frame(0,
  `<g transform='translate(266,128)'>
    ${orderCol(0, C.blue, C.blue50, 'Sedang Diproses', '1', [{ n: 101, amt: 'Rp 51.000', t: '2 menit lalu · QRIS' }])}
    ${orderCol(305, C.amber, '#fff7ed', 'Menunggu', '2', [{ n: 102, amt: 'Rp 36.000', t: 'Baru saja · TUNAI' }, { n: 103, amt: 'Rp 28.000', t: 'Baru saja · TUNAI' }])}
    ${orderCol(610, C.emerald, C.emerald50, 'Selesai / Lunas', '8', [{ n: 100, amt: 'Rp 46.000', t: '5 menit lalu · LUNAS' }])}
  </g>
  ${dot(1, 286, 152)} ${dot(2, 591, 152)} ${dot(3, 896, 152)}`,
  'Halaman Order', 'Pesanan bergerak dari kanan: Menunggu → Diproses → Selesai')

// ── 05 Terima & Proses ───────────────────────────────────────
function bigOrderCard(x, y, borderColor, badge, badgeBg, btnText, btnColor) {
  return `<rect x='${x}' y='${y}' width='520' height='250' rx='20' fill='${C.white}' stroke='${borderColor}' stroke-width='3'/>
    <rect x='${x + 28}' y='${y + 28}' width='70' height='70' rx='18' fill='${badgeBg}'/>
    <text x='${x + 63}' y='${y + 60}' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='#fff'>ANTRIAN</text>
    <text x='${x + 63}' y='${y + 86}' text-anchor='middle' ${FONT} font-size='24' font-weight='800' fill='#fff'>#102</text>
    ${pill(x + 116, y + 30, 92, 26, badge, badgeBg === C.amber ? C.amber50 : badgeBg, badgeBg === C.amber ? C.amber600 : '#fff', 12)}
    ${pill(x + 216, y + 30, 80, 26, 'TUNAI', C.bg, C.gray, 12)}
    <text x='${x + 116}' y='${y + 84}' ${FONT} font-size='22' font-weight='800' fill='${C.ink}'>Rp 36.000</text>
    <text x='${x + 116}' y='${y + 110}' ${FONT} font-size='13.5' fill='${C.gray400}'>Baru saja · 2 pesanan utama</text>
    <rect x='${x + 28}' y='${y + 134}' width='464' height='2' fill='${C.line}'/>
    <text x='${x + 28}' y='${y + 162}' ${FONT} font-size='14.5' font-weight='700' fill='${C.gray}'>2x  Original Sapi Besar</text>
    <text x='${x + 28}' y='${y + 184}' ${FONT} font-size='13.5' fill='${C.gray400}'>1x  Extra Keju</text>
    <rect x='${x + 28}' y='${y + 200}' width='464' height='34' rx='11' fill='${btnColor}'/>
    <text x='${x + 260}' y='${y + 223}' text-anchor='middle' ${FONT} font-size='15' font-weight='800' fill='#fff'>✓  ${esc(btnText)}</text>`
}
files['05-terima.svg'] = frame(0,
  `<g transform='translate(360,150)'>${bigOrderCard(0, 0, C.amber100, 'MENUNGGU', C.amber, 'Terima & Proses', C.amber)}</g>
   ${dot(1, 423, 195)} ${dot(2, 620, 367)}
   <text x='700' y='205' ${FONT} font-size='15' font-weight='700' fill='${C.gray}'>Cek nomor antrian</text>
   <text x='700' y='228' ${FONT} font-size='15' font-weight='700' fill='${C.gray}'>&amp; isi pesanannya</text>`,
  'Menerima Pesanan Baru', 'Pesanan baru ada di kolom kuning "Menunggu"')

// ── 06 Selesai ───────────────────────────────────────────────
files['06-selesai.svg'] = frame(0,
  `<g transform='translate(360,150)'>${bigOrderCard(0, 0, C.blue100, 'DIPROSES', C.blue, 'Tandai Selesai', C.emerald)}</g>
   ${dot(1, 620, 367)}
   <text x='700' y='360' ${FONT} font-size='15' font-weight='700' fill='${C.emerald600}'>Tekan saat pesanan</text>
   <text x='700' y='383' ${FONT} font-size='15' font-weight='700' fill='${C.emerald600}'>sudah diberikan</text>`,
  'Menyelesaikan Pesanan', 'Saat makanan sudah jadi & diserahkan ke pelanggan')

// ── 07 Batalkan ──────────────────────────────────────────────
files['07-batalkan.svg'] = frame(0,
  `<g transform='translate(360,150)'>
    <rect x='0' y='0' width='520' height='300' rx='20' fill='${C.white}' stroke='${C.amber100}' stroke-width='3'/>
    <rect x='28' y='28' width='70' height='70' rx='18' fill='${C.amber}'/>
    <text x='63' y='60' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='#fff'>ANTRIAN</text>
    <text x='63' y='86' text-anchor='middle' ${FONT} font-size='24' font-weight='800' fill='#fff'>#104</text>
    <text x='116' y='66' ${FONT} font-size='22' font-weight='800' fill='${C.ink}'>Rp 31.000</text>
    <text x='116' y='92' ${FONT} font-size='13.5' fill='${C.gray400}'>1 pesanan utama</text>
    <rect x='28' y='120' width='464' height='2' fill='${C.line}'/>
    <text x='28' y='150' ${FONT} font-size='14.5' font-weight='700' fill='${C.gray}'>1x  Shawarmie Ayam</text>
    <rect x='300' y='240' width='192' height='40' rx='12' fill='${C.red50}'/>
    <text x='396' y='265' text-anchor='middle' ${FONT} font-size='14.5' font-weight='800' fill='${C.red}'>✕  Batalkan</text>
   </g>
   ${dot(1, 388, 270)} ${dot(2, 756, 540)}
   <text x='430' y='275' ${FONT} font-size='14' font-weight='700' fill='${C.gray}'>Buka detail pesanan</text>`,
  'Membatalkan Pesanan', 'Hanya bila pelanggan benar-benar batal')

// ── 08 Online vs Offline ─────────────────────────────────────
files['08-online-offline.svg'] = frame(0,
  `<g transform='translate(290,150)'>
    <rect x='0' y='0' width='430' height='60' rx='16' fill='#f3f4f6'/>
    ${pill(10, 10, 120, 40, 'Semua', C.white, C.ink, 15)}
    ${pill(140, 10, 130, 40, '🌐 Online', C.blue, '#fff', 15)}
    <circle cx='262' cy='16' r='13' fill='${C.red}'/>
    <text x='262' y='21' text-anchor='middle' ${FONT} font-size='12' font-weight='800' fill='#fff'>2</text>
    ${pill(280, 10, 130, 40, '🏪 Offline', C.white, C.gray, 15)}

    <rect x='0' y='90' width='430' height='150' rx='18' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='28' y='130' ${FONT} font-size='16' font-weight='800' fill='${C.ink}'>Dua sumber pesanan</text>
    ${pill(28, 148, 110, 32, '🌐 Online', C.blue50, C.blue600, 13)}
    <text x='150' y='169' ${FONT} font-size='14' fill='${C.gray}'>dari pelanggan via website</text>
    ${pill(28, 192, 110, 32, '🏪 Offline', C.bg, C.gray, 13)}
    <text x='150' y='213' ${FONT} font-size='14' fill='${C.gray}'>dari mesin pesan di toko</text>
   </g>
   <g transform='translate(770,170)'>
    <rect x='0' y='0' width='320' height='150' rx='18' fill='${C.amber50}' stroke='${C.amber100}' stroke-width='2'/>
    <text x='28' y='52' ${FONT} font-size='40'>🔊</text>
    <text x='90' y='44' ${FONT} font-size='16' font-weight='800' fill='${C.amber600}'>Ada Bunyi "Ding"</text>
    <text x='90' y='72' ${FONT} font-size='13.5' fill='${C.gray}'>setiap pesanan baru masuk.</text>
    <text x='28' y='112' ${FONT} font-size='13.5' fill='${C.gray}'>Pastikan suara HP/komputer</text>
    <text x='28' y='134' ${FONT} font-size='13.5' fill='${C.gray}'>tidak di-bisukan ya.</text>
   </g>
   ${dot(1, 455, 175)} ${dot(2, 300, 320)} ${dot(3, 790, 195)}`,
  'Online vs Offline & Notifikasi', 'Membedakan asal pesanan dan tanda pesanan baru')

// ── 09 Stok habis ────────────────────────────────────────────
files['09-stok-habis.svg'] = frame(1,
  `<g transform='translate(266,128)'>
    <rect x='0' y='0' width='626' height='64' rx='16' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='24' y='40' ${FONT} font-size='15' fill='${C.gray400}'>🔎  Cari menu...</text>
    ${[['Original Sapi Besar', true], ['Shawarmie Ayam', false], ['Original Mix Jumbo', true]].map(([name, on], i) => {
      const y = 84 + i * 86
      return `<rect x='0' y='${y}' width='626' height='74' rx='16' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
        <rect x='20' y='${y + 13}' width='48' height='48' rx='12' fill='${C.amber100}'/>
        <text x='84' y='${y + 34}' ${FONT} font-size='16' font-weight='800' fill='${C.ink}'>${esc(name)}</text>
        <text x='84' y='${y + 56}' ${FONT} font-size='13.5' fill='${C.gray400}'>Rp 36.000</text>
        ${on
          ? pill(420, y + 17, 150, 40, '✓ Tersedia', C.emerald50, C.emerald600, 15)
          : pill(420, y + 17, 150, 40, 'Habis', C.red50, C.red, 15)}`
    }).join('')}
   </g>
   <!-- jari menunjuk tombol hijau yang bisa diklik -->
   <text x='840' y='268' ${FONT} font-size='30'>👆</text>
   ${dot(1, 761, 249)} ${dot(2, 761, 335)}
   <g transform='translate(905,214)'>
     <text x='0' y='0' ${FONT} font-size='15' font-weight='800' fill='${C.amber600}'>Cukup KLIK</text>
     <text x='0' y='24' ${FONT} font-size='14.5' fill='${C.gray}'>tulisan hijau ini</text>
   </g>
   <g transform='translate(905,322)'>
     <text x='0' y='0' ${FONT} font-size='14.5' fill='${C.gray}'>langsung berubah</text>
     <text x='0' y='24' ${FONT} font-size='15' font-weight='800' fill='${C.red}'>jadi merah "Habis"</text>
   </g>`,
  'Mengatur Menu Habis / Tersedia', 'Cukup klik tulisan status untuk mengubahnya — tanpa digeser')

// ── 10 Kiosk QR ──────────────────────────────────────────────
files['10-kiosk-qr.svg'] = frame(3,
  `<rect x='0' y='0' width='${W}' height='${H}' fill='#00000055'/>
   <g transform='translate(400,150)'>
    <rect x='0' y='0' width='400' height='460' rx='26' fill='${C.white}'/>
    <text x='200' y='60' text-anchor='middle' ${FONT} font-size='21' font-weight='800' fill='${C.ink}'>Hubungkan Device</text>
    <text x='200' y='90' text-anchor='middle' ${FONT} font-size='14' fill='${C.gray}'>Pindai kode ini dari layar pelanggan</text>
    <rect x='100' y='120' width='200' height='200' rx='16' fill='${C.white}' stroke='${C.ink}' stroke-width='3'/>
    ${(() => { let q = ''; for (let r = 0; r < 9; r++) for (let c2 = 0; c2 < 9; c2++) { if ((r * 7 + c2 * 3) % 5 < 2 || (r + c2) % 3 === 0) q += `<rect x='${118 + c2 * 18}' y='${138 + r * 18}' width='16' height='16' fill='${C.ink}'/>` } return q })()}
    <rect x='40' y='350' width='320' height='54' rx='14' fill='${C.amber}'/>
    <text x='200' y='384' text-anchor='middle' ${FONT} font-size='16' font-weight='800' fill='#fff'>Tampilkan QR</text>
   </g>
   ${dot(1, 230, 234)}
   <text x='40' y='240' ${FONT} font-size='15' font-weight='700' fill='#fff'>Buka "Kontrol Device"</text>
   ${dot(2, 760, 530)}`,
  '', '')

// ── 11 Kiosk list ────────────────────────────────────────────
files['11-kiosk-list.svg'] = frame(3,
  `<g transform='translate(266,128)'>
    ${[['Kasir Depan', true], ['Meja Tengah', true], ['Pojok Kanan', false]].map(([name, online], i) => {
      const y = i * 96
      return `<rect x='0' y='${y}' width='626' height='84' rx='18' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
        <rect x='20' y='${y + 18}' width='48' height='48' rx='13' fill='${online ? C.blue50 : C.bg}'/>
        <text x='44' y='${y + 50}' text-anchor='middle' ${FONT} font-size='22'>🖥️</text>
        <text x='84' y='${y + 38}' ${FONT} font-size='16' font-weight='800' fill='${C.ink}'>${esc(name)}</text>
        ${online
          ? `<g><circle cx='92' cy='${y + 56}' r='5' fill='${C.emerald}'/><text x='104' y='${y + 61}' ${FONT} font-size='13' font-weight='700' fill='${C.emerald600}'>Online</text></g>`
          : `<g><circle cx='92' cy='${y + 56}' r='5' fill='${C.gray300}'/><text x='104' y='${y + 61}' ${FONT} font-size='13' font-weight='700' fill='${C.gray400}'>Tidak aktif</text></g>`}
        ${pill(380, y + 24, 100, 36, '↻ Reload', C.bg, C.gray, 13)}
        ${pill(492, y + 24, 110, 36, '⎋ Logout', C.red50, C.red, 13)}`
    }).join('')}
   </g>
   ${dot(1, 652, 200)} ${dot(2, 880, 200)}`,
  'Memantau Device Pelanggan', 'Lihat device yang menyala, reload atau keluarkan dari jarak jauh')

// ── 12 Histori ───────────────────────────────────────────────
files['12-histori.svg'] = frame(2,
  `<g transform='translate(266,124)'>
    <rect x='0' y='0' width='200' height='56' rx='16' fill='${C.amber50}'/><text x='26' y='34' ${FONT} font-size='14' font-weight='800' fill='${C.amber600}'>Menunggu · 3</text>
    <rect x='214' y='0' width='200' height='56' rx='16' fill='${C.emerald50}'/><text x='240' y='34' ${FONT} font-size='14' font-weight='800' fill='${C.emerald600}'>Selesai · 24</text>
    <rect x='428' y='0' width='200' height='56' rx='16' fill='${C.bg}'/><text x='454' y='34' ${FONT} font-size='14' font-weight='800' fill='${C.gray}'>Dibatalkan · 1</text>
    ${[['#100', 'Rp 46.000', 'Selesai', C.emerald600, C.emerald50], ['#099', 'Rp 28.000', 'Selesai', C.emerald600, C.emerald50], ['#098', 'Rp 31.000', 'Dibatalkan', C.red, C.red50]].map((r, i) => {
      const y = 80 + i * 72
      return `<rect x='0' y='${y}' width='628' height='60' rx='14' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
        <text x='24' y='${y + 37}' ${FONT} font-size='16' font-weight='800' fill='${C.ink}'>${r[0]}</text>
        <text x='140' y='${y + 37}' ${FONT} font-size='15' font-weight='700' fill='${C.gray}'>${r[1]}</text>
        ${pill(470, y + 14, 140, 32, r[2], r[4], r[3], 13)}`
    }).join('')}
   </g>
   ${dot(1, 320, 180)} ${dot(2, 860, 230)}`,
  'Histori Pesanan', 'Semua pesanan hari ini, termasuk yang sudah selesai & batal')

// ── 13 Laporan ───────────────────────────────────────────────
files['13-laporan.svg'] = frame(4,
  `<g transform='translate(266,124)'>
    <rect x='0' y='0' width='300' height='110' rx='18' fill='${C.amber}'/>
    <text x='26' y='44' ${FONT} font-size='13' font-weight='800' fill='#fff' opacity='0.85'>TOTAL PENJUALAN</text>
    <text x='26' y='84' ${FONT} font-size='30' font-weight='800' fill='#fff'>Rp 1.044.000</text>
    <rect x='320' y='0' width='150' height='110' rx='18' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='344' y='40' ${FONT} font-size='12' font-weight='800' fill='${C.gray400}'>PESANAN</text>
    <text x='344' y='78' ${FONT} font-size='26' font-weight='800' fill='${C.ink}'>32</text>
    <rect x='484' y='0' width='144' height='110' rx='18' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='508' y='40' ${FONT} font-size='12' font-weight='800' fill='${C.gray400}'>RATA-RATA</text>
    <text x='508' y='78' ${FONT} font-size='22' font-weight='800' fill='${C.ink}'>Rp 32rb</text>
    <rect x='0' y='130' width='628' height='200' rx='18' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='26' y='168' ${FONT} font-size='16' font-weight='800' fill='${C.ink}'>Penjualan Harian</text>
    ${[60, 100, 80, 140, 120, 165].map((h, i) => `<rect x='${40 + i * 95}' y='${300 - h}' width='56' height='${h}' rx='8' fill='${C.amber}' opacity='${0.55 + i * 0.07}'/>`).join('')}
   </g>
   ${dot(1, 300, 178)} ${dot(2, 320, 420)}`,
  'Laporan Penjualan', 'Ringkasan omzet, jumlah pesanan, dan grafik harian')

// ── 14 Tampilan Layar ────────────────────────────────────────
files['14-tampilan.svg'] = frame(5,
  `<!-- Kartu pengaturan di sisi kasir -->
   <rect x='266' y='140' width='440' height='448' rx='20' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
   <text x='292' y='184' ${FONT} font-size='17' font-weight='800' fill='${C.ink}'>Gambar Cover Cabang Ini</text>
   <rect x='292' y='200' width='388' height='214' rx='14' fill='${C.amber50}' stroke='${C.amber100}' stroke-width='2'/>
   <text x='486' y='298' text-anchor='middle' ${FONT} font-size='44'>🥙</text>
   <text x='486' y='344' text-anchor='middle' ${FONT} font-size='19' font-weight='800' fill='${C.amber600}'>SUKA SHAWARMA</text>
   <text x='486' y='372' text-anchor='middle' ${FONT} font-size='14' fill='${C.gray}'>Selamat datang 👋</text>
   ${pill(292, 426, 264, 26, 'JPG · PNG · WebP  ·  rasio 16:9', C.bg, C.gray, 12)}
   <rect x='292' y='462' width='388' height='52' rx='14' fill='${C.amber}'/>
   <text x='486' y='495' text-anchor='middle' ${FONT} font-size='16' font-weight='800' fill='#fff'>⬆  Upload Gambar Cover</text>

   <!-- Panah: gambar yang di-upload tampil di perangkat pelanggan -->
   <line x1='714' y1='320' x2='786' y2='320' stroke='${C.amber}' stroke-width='3'/>
   <polygon points='786,312 800,320 786,328' fill='${C.amber}'/>
   <text x='755' y='306' text-anchor='middle' ${FONT} font-size='12.5' font-weight='800' fill='${C.amber600}'>tampil di</text>

   <!-- Perangkat pelanggan menampilkan cover fullscreen -->
   <rect x='800' y='206' width='372' height='258' rx='26' fill='${C.ink}'/>
   <circle cx='986' cy='219' r='3' fill='#374151'/>
   <rect x='816' y='231' width='340' height='208' rx='12' fill='${C.amber50}'/>
   <text x='986' y='300' text-anchor='middle' ${FONT} font-size='38'>🥙</text>
   <text x='986' y='342' text-anchor='middle' ${FONT} font-size='17' font-weight='800' fill='${C.amber600}'>SUKA SHAWARMA</text>
   ${pill(894, 360, 184, 34, '👆 Sentuh untuk Mulai', C.amber, '#ffffff', 13)}
   <text x='986' y='500' text-anchor='middle' ${FONT} font-size='14.5' font-weight='800' fill='${C.gray}'>Layar pelanggan saat menganggur</text>

   ${dot(1, 680, 248)} ${dot(2, 300, 488)}`,
  'Tampilan Layar Kiosk', 'Gambar sambutan yang tampil di layar pelanggan saat tidak dipakai')

// ── 15 Logout ────────────────────────────────────────────────
files['15-logout.svg'] = frame(-1,
  `${dot(1, 145, 698)}
   <g transform='translate(300,250)'>
    <rect x='0' y='0' width='560' height='240' rx='22' fill='${C.white}' stroke='${C.line}' stroke-width='2'/>
    <text x='40' y='66' ${FONT} font-size='44'>👋</text>
    <text x='110' y='58' ${FONT} font-size='20' font-weight='800' fill='${C.ink}'>Selesai Bekerja?</text>
    <text x='40' y='120' ${FONT} font-size='15.5' fill='${C.gray}'>Selalu tekan tombol "Keluar" di pojok kiri bawah</text>
    <text x='40' y='146' ${FONT} font-size='15.5' fill='${C.gray}'>sebelum meninggalkan kasir, supaya akun Anda aman.</text>
    <rect x='40' y='176' width='180' height='44' rx='13' fill='${C.red50}'/>
    <text x='130' y='204' text-anchor='middle' ${FONT} font-size='15' font-weight='800' fill='${C.red}'>⎋  Keluar</text>
   </g>`,
  'Keluar dari Sistem', 'Jangan lupa logout saat selesai shift')

let n = 0
for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(OUT, name), svg.trim())
  n++
}
console.log(`OK: ${n} file SVG ditulis ke public/guide-assets/`)
