/* ── Ekspor Excel (.xlsx) Rangkuman Penjualan ────────────────────────────────
 *
 * CSV tidak bisa menyimpan warna, filter, maupun beberapa sheet, jadi ekspor
 * tabel dibuat sebagai .xlsx (tetap terbuka di Excel, Google Sheets, LibreOffice).
 * Setiap sheet data: judul berwarna primary, baris TOTAL yang ikut filter
 * (SUBTOTAL), tombol filter di judul kolom, header beku, dan warna dinamis
 * (skala warna omzet & margin, warna per channel).
 */

import type { PosExportReport } from '@/lib/posReport/ekspor'
import {
  WARNA, type KonteksEkspor, labelCabang, labelPeriode, namaBerkas, persen, rasio, unduhBlob, waktuCetak,
} from '@/lib/posReport/eksporUi'

type Jenis = 'teks' | 'angka' | 'rp' | 'pct' | 'tanggal'

interface Kolom {
  key: string
  header: string
  width: number
  jenis: Jenis
  /** sum = SUBTOTAL; judul = "TOTAL (n baris)" yang ikut filter; fungsi = rumus turunan. */
  total?: 'sum' | 'judul' | ((ref: (key: string) => string) => string)
  /** Skala warna: omzet (putih → oranye) atau margin (merah → kuning → hijau). */
  skala?: 'omzet' | 'margin'
  warnaChannel?: boolean
  tipeOutlet?: boolean
  rataKiri?: boolean
}

const RP = '"Rp"#,##0;[Red]-"Rp"#,##0;"Rp"0'
const INT = '#,##0'
const PCT = '0.0%'
const TGL = 'ddd, dd mmm yyyy'

const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`
const isi = (hex: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: argb(hex) } })
const garisTipis = { style: 'thin' as const, color: { argb: argb(WARNA.garis) } }

const BARIS_JUDUL = 1
const BARIS_SUB = 2
const BARIS_TIPS = 3
const BARIS_TOTAL = 4
const BARIS_HEADER = 5
const BARIS_DATA = 6

function formatSel(jenis: Jenis) {
  return jenis === 'rp' ? RP : jenis === 'pct' ? PCT : jenis === 'angka' ? INT : jenis === 'tanggal' ? TGL : undefined
}

function tanggalExcel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Judul + sub-judul berwarna di atas setiap sheet. */
function kopSheet(ws: any, jumlahKolom: number, judul: string, sub: string, tips?: string) {
  const akhir = ws.getColumn(jumlahKolom).letter
  const pita = (baris: number, nilai: string, tinggi: number, warna: string, font: any) => {
    ws.mergeCells(`A${baris}:${akhir}${baris}`)
    for (let i = jumlahKolom; i >= 1; i--) {
      const c = ws.getRow(baris).getCell(i)
      if (i === 1) c.value = nilai
      c.fill = isi(warna)
      c.font = font
      c.alignment = { vertical: 'middle', indent: 1 }
    }
    ws.getRow(baris).height = tinggi
  }
  pita(BARIS_JUDUL, judul, 32, WARNA.primary, { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } })
  pita(BARIS_SUB, sub, 20, WARNA.primaryLembut, { name: 'Calibri', size: 10, color: { argb: 'FFFBE3D0' } })
  if (tips) pita(BARIS_TIPS, tips, 18, WARNA.krem, { name: 'Calibri', size: 9, italic: true, color: { argb: argb(WARNA.teksPudar) } })
}

/** Sheet tabel: TOTAL (ikut filter) → header → data, dengan filter & header beku. */
function sheetTabel(
  wb: any,
  nama: string,
  opsi: {
    judul: string
    sub: string
    kolom: Kolom[]
    baris: Record<string, any>[]
    beku: number
    tab: string
  }
) {
  const { kolom, baris } = opsi
  const ws = wb.addWorksheet(nama, {
    properties: { tabColor: { argb: argb(opsi.tab) } },
    views: [{ state: 'frozen', xSplit: opsi.beku, ySplit: BARIS_HEADER, showGridLines: false }],
  })
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${BARIS_HEADER}:${BARIS_HEADER}` }

  kolom.forEach((k, i) => { ws.getColumn(i + 1).width = k.width })
  kopSheet(ws, kolom.length, opsi.judul, opsi.sub,
    'Klik tombol ▼ di judul kolom untuk memfilter / mengurutkan. Baris TOTAL di atas otomatis menyesuaikan hasil filter.')

  const awal = BARIS_DATA
  const akhir = Math.max(BARIS_DATA, BARIS_DATA + baris.length - 1)
  const huruf = (key: string) => ws.getColumn(kolom.findIndex(k => k.key === key) + 1).letter
  const ref = (key: string) => `${huruf(key)}${BARIS_TOTAL}`

  // Header
  const header = ws.getRow(BARIS_HEADER)
  header.height = 30
  kolom.forEach((k, i) => {
    const c = header.getCell(i + 1)
    c.value = k.header
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = isi(WARNA.primary)
    c.alignment = { vertical: 'middle', horizontal: k.jenis === 'teks' || k.rataKiri ? 'left' : 'center', wrapText: true }
    c.border = { bottom: { style: 'medium', color: { argb: argb(WARNA.oranye) } } }
  })

  // Data
  baris.forEach((r, idx) => {
    const row = ws.getRow(awal + idx)
    kolom.forEach((k, i) => {
      const c = row.getCell(i + 1)
      const v = r[k.key]
      c.value = k.jenis === 'tanggal' && typeof v === 'string' ? tanggalExcel(v) : (v ?? (k.jenis === 'teks' ? '' : 0))
      const fmt = formatSel(k.jenis)
      if (fmt) c.numFmt = fmt
      c.font = { name: 'Calibri', size: 10, color: { argb: argb(WARNA.teks) } }
      c.alignment = { vertical: 'middle', horizontal: k.jenis === 'teks' || k.rataKiri ? 'left' : 'right' }
      c.border = { bottom: garisTipis }
      if (k.warnaChannel && r._warna) {
        c.fill = isi(r._warna)
        c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        c.alignment = { vertical: 'middle', horizontal: 'center' }
      }
      if (k.tipeOutlet) {
        const warna = v === 'Mitra' ? WARNA.mitra : v === 'SS Online' ? WARNA.oranye : WARNA.primary
        c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: argb(warna) } }
        c.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    })
  })

  // TOTAL yang mengikuti filter (SUBTOTAL mengabaikan baris tersembunyi)
  const total = ws.getRow(BARIS_TOTAL)
  total.height = 24
  kolom.forEach((k, i) => {
    const c = total.getCell(i + 1)
    const rentang = `${huruf(k.key)}${awal}:${huruf(k.key)}${akhir}`
    if (k.total === 'judul') c.value = { formula: `"TOTAL ("&SUBTOTAL(103,${rentang})&" baris, sesuai filter)"`, result: `TOTAL (${baris.length} baris, sesuai filter)` }
    else if (k.total === 'sum') c.value = { formula: `SUBTOTAL(109,${rentang})`, result: baris.reduce((s, r) => s + (Number(r[k.key]) || 0), 0) }
    else if (typeof k.total === 'function') c.value = { formula: k.total(ref) }
    const fmt = formatSel(k.jenis === 'tanggal' ? 'teks' : k.jenis)
    if (fmt && k.total !== 'judul') c.numFmt = fmt
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: argb(WARNA.primary) } }
    c.fill = isi(WARNA.kremTua)
    c.alignment = { vertical: 'middle', horizontal: k.jenis === 'teks' ? 'left' : 'right' }
    c.border = { top: { style: 'thin', color: { argb: argb(WARNA.primary) } }, bottom: { style: 'thin', color: { argb: argb(WARNA.primary) } } }
  })

  if (baris.length === 0) return ws
  ws.autoFilter = `A${BARIS_HEADER}:${ws.getColumn(kolom.length).letter}${akhir}`

  // Warna dinamis. Selang-seling baris lewat aturan (bukan warna statis) agar
  // tetap rapi setelah diurutkan; kolom channel dikecualikan supaya warnanya utuh.
  const tanpaChannel = kolom
    .map((k, i) => ({ k, h: ws.getColumn(i + 1).letter }))
    .filter(x => !x.k.warnaChannel)
    .map(x => `${x.h}${awal}:${x.h}${akhir}`)
    .join(' ')
  ws.addConditionalFormatting({
    ref: tanpaChannel,
    rules: [{ type: 'expression', priority: 20, formulae: ['MOD(ROW(),2)=0'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: argb(WARNA.krem) } } } }],
  })
  kolom.forEach(k => {
    if (!k.skala) return
    const rentang = `${huruf(k.key)}${awal}:${huruf(k.key)}${akhir}`
    ws.addConditionalFormatting({
      ref: rentang,
      rules: [k.skala === 'omzet'
        ? { type: 'colorScale', priority: 5, cfvo: [{ type: 'min' }, { type: 'max' }], color: [{ argb: 'FFFFFFFF' }, { argb: 'FFF9B47A' }] }
        : { type: 'colorScale', priority: 5, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 0.2 }, { type: 'num', value: 0.4 }], color: [{ argb: 'FFF8A5A5' }, { argb: 'FFFDE68A' }, { argb: 'FF86EFAC' }] }],
    })
  })
  return ws
}

const margin = (gp: (r: (k: string) => string) => string, gross: string) =>
  (ref: (k: string) => string) => `IFERROR(${gp(ref)}/${ref(gross)},0)`

/** Kolom angka standar (Gross → Margin) yang dipakai banyak sheet. */
function kolomUang(opsi: { netto?: boolean; kontribusi?: boolean } = {}): Kolom[] {
  const k: Kolom[] = [
    { key: 'gross', header: 'Gross Revenue', width: 17, jenis: 'rp', total: 'sum', skala: 'omzet' },
    { key: 'potongan', header: 'Potongan Merchant', width: 16, jenis: 'rp', total: 'sum' },
  ]
  if (opsi.netto) k.push({ key: 'net', header: 'Omzet Bersih', width: 17, jenis: 'rp', total: 'sum' })
  k.push(
    { key: 'cogs', header: 'Total COGS (HPP)', width: 17, jenis: 'rp', total: 'sum' },
    { key: 'gp', header: 'Gross Profit', width: 17, jenis: 'rp', total: 'sum' },
    { key: 'margin', header: 'Margin GP', width: 11, jenis: 'pct', total: margin(r => r('gp'), 'gross'), skala: 'margin' },
  )
  if (opsi.kontribusi) k.push({ key: 'kontribusi', header: 'Kontribusi Omzet', width: 12, jenis: 'pct', total: 'sum' })
  return k
}

/** Sheet pertama: kartu KPI berwarna seperti di layar + ringkasan channel & pembayaran. */
function sheetRingkasan(wb: any, data: PosExportReport, sub: string, daftarSheet: string[]) {
  const ws = wb.addWorksheet('Ringkasan', {
    properties: { tabColor: { argb: argb(WARNA.primary) } },
    views: [{ showGridLines: false }],
  })
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  const lebar = [28, 14, 13, 12, 18, 18, 18, 18, 12, 13]
  lebar.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  kopSheet(ws, lebar.length, 'LAPORAN PENJUALAN — SS SHAWARMA', sub)

  const t = data.total
  /** Sel gabungan: warna & garis harus dipasang di setiap sel penyusunnya. */
  const blok = (a: string, b: string, baris: number, nilai: any, gaya: any) => {
    if (a !== b) ws.mergeCells(`${a}${baris}:${b}${baris}`)
    const awal = ws.getColumn(a).number
    const akhir = ws.getColumn(b).number
    for (let i = akhir; i >= awal; i--) {
      const c = ws.getRow(baris).getCell(i)
      if (i === awal) c.value = nilai
      Object.assign(c, gaya)
    }
  }

  // Kartu KPI utama (warna = kartu di layar)
  const kartu = [
    { kol: ['A', 'B'], label: 'GROSS REVENUE', nilai: t.gross, cap: 'Omzet kotor sebelum diskon & potongan', warna: WARNA.gross },
    { kol: ['C', 'E'], label: 'TOTAL COGS', nilai: t.cogs, cap: `${persen(rasio(t.cogs, t.gross))} dari Gross Revenue (HPP resep)`, warna: WARNA.cogs },
    { kol: ['F', 'G'], label: 'POTONGAN MERCHANT', nilai: t.potongan, cap: `${persen(rasio(t.potongan, t.gross))} dari Gross · diskon & promo merchant`, warna: WARNA.potongan },
    { kol: ['H', 'J'], label: 'GROSS PROFIT', nilai: t.gp, cap: `Margin ${persen(rasio(t.gp, t.gross))} · Gross − (COGS + Potongan)`, warna: WARNA.gp },
  ]
  ws.getRow(5).height = 18
  ws.getRow(6).height = 36
  ws.getRow(7).height = 20
  for (const k of kartu) {
    const [a, b] = k.kol
    blok(a, b, 5, k.label, { font: { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }, fill: isi(k.warna), alignment: { vertical: 'bottom', indent: 1 } })
    blok(a, b, 6, k.nilai, { numFmt: RP, font: { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }, fill: isi(k.warna), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } })
    blok(a, b, 7, k.cap, { font: { name: 'Calibri', size: 9, color: { argb: argb(k.warna) } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }, alignment: { vertical: 'middle', indent: 1 }, border: { bottom: { style: 'medium', color: { argb: argb(k.warna) } } } })
  }

  // Statistik pendamping
  const statistik = [
    { kol: ['A', 'A'], label: 'ITEM TERJUAL', nilai: t.qty, fmt: INT },
    { kol: ['B', 'C'], label: 'TRANSAKSI SELESAI', nilai: t.trx, fmt: INT },
    { kol: ['D', 'E'], label: `DIBATALKAN (${persen(rasio(t.batal, t.trx + t.batal))})`, nilai: t.batal, fmt: INT },
    { kol: ['F', 'F'], label: 'RATA-RATA / TRANSAKSI', nilai: rasio(t.gross, t.trx), fmt: RP },
    { kol: ['G', 'H'], label: 'OMZET BERSIH (GROSS − POTONGAN)', nilai: t.gross - t.potongan, fmt: RP },
    { kol: ['I', 'J'], label: 'SUBSIDI PLATFORM (BUKAN BEBAN)', nilai: t.subsidi, fmt: RP },
  ]
  ws.getRow(9).height = 16
  ws.getRow(10).height = 26
  for (const s of statistik) {
    const [a, b] = s.kol
    blok(a, b, 9, s.label, { font: { name: 'Calibri', size: 8, bold: true, color: { argb: argb(WARNA.teksPudar) } }, fill: isi(WARNA.krem), alignment: { vertical: 'bottom', indent: 1 } })
    blok(a, b, 10, s.nilai, { numFmt: s.fmt, font: { name: 'Calibri', size: 14, bold: true, color: { argb: argb(WARNA.primary) } }, fill: isi(WARNA.krem), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 }, border: { bottom: { style: 'medium', color: { argb: argb(WARNA.primary) } } } })
  }

  let r = 12
  const judulBagian = (teks: string) => {
    blok('A', 'J', r, teks, { font: { name: 'Calibri', size: 12, bold: true, color: { argb: argb(WARNA.primary) } }, border: { bottom: { style: 'medium', color: { argb: argb(WARNA.oranye) } } }, alignment: { vertical: 'bottom' } })
    ws.getRow(r).height = 22
    r += 1
  }
  const headerTabel = (judul: string[]) => {
    judul.forEach((h, i) => {
      const c = ws.getRow(r).getCell(i + 1)
      c.value = h
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = isi(WARNA.primary)
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', wrapText: true }
    })
    ws.getRow(r).height = 26
    r += 1
  }
  const barisTabel = (nilai: any[], fmt: (string | undefined)[], gaya: { tebal?: boolean; isiWarna?: string; warnaPertama?: string; ganjil?: boolean } = {}) => {
    nilai.forEach((v, i) => {
      const c = ws.getRow(r).getCell(i + 1)
      c.value = v
      if (fmt[i]) c.numFmt = fmt[i]
      c.font = { name: 'Calibri', size: 10, bold: !!gaya.tebal, color: { argb: argb(gaya.tebal ? WARNA.primary : WARNA.teks) } }
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 }
      c.border = { bottom: garisTipis }
      if (gaya.isiWarna) c.fill = isi(gaya.isiWarna)
      else if (gaya.ganjil) c.fill = isi(WARNA.krem)
      if (i === 0 && gaya.warnaPertama) {
        c.fill = isi(gaya.warnaPertama)
        c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      }
    })
    r += 1
  }

  judulBagian('Ringkasan per Channel')
  headerTabel(['Channel', 'Grup', 'Transaksi', 'Item', 'Gross Revenue', 'Potongan Merchant', 'Total COGS', 'Gross Profit', 'Margin GP', 'Kontribusi'])
  const fmtCh = [undefined, undefined, INT, INT, RP, RP, RP, RP, PCT, PCT]
  data.channels.forEach((c, i) => barisTabel(
    [c.nama, c.grup, c.trx, c.qty, c.gross, c.potongan, c.cogs, c.gp, rasio(c.gp, c.gross), rasio(c.gross, t.gross)],
    fmtCh, { warnaPertama: c.warna, ganjil: i % 2 === 1 }
  ))
  barisTabel(['TOTAL', '', t.trx, t.qty, t.gross, t.potongan, t.cogs, t.gp, rasio(t.gp, t.gross), 1], fmtCh, { tebal: true, isiWarna: WARNA.kremTua })

  r += 1
  judulBagian('Metode Pembayaran')
  headerTabel(['Metode', 'Transaksi', 'Nominal Dibayar', 'Porsi'])
  const totalBayar = data.pembayaran.reduce((s, p) => s + p.nominal, 0)
  data.pembayaran.forEach((p, i) => barisTabel([p.metode, p.trx, p.nominal, rasio(p.nominal, totalBayar)], [undefined, INT, RP, PCT], { ganjil: i % 2 === 1 }))
  barisTabel(['TOTAL', data.pembayaran.reduce((s, p) => s + p.trx, 0), totalBayar, 1], [undefined, INT, RP, PCT], { tebal: true, isiWarna: WARNA.kremTua })

  r += 1
  judulBagian('Isi Workbook (klik untuk membuka sheet)')
  daftarSheet.forEach(nama => {
    const c = ws.getCell(`A${r}`)
    c.value = { text: `→  ${nama}`, hyperlink: `#'${nama}'!A1` }
    c.font = { name: 'Calibri', size: 10, bold: true, underline: true, color: { argb: argb(WARNA.potongan) } }
    r += 1
  })

  r += 1
  judulBagian('Keterangan')
  const catatan = [
    'Gross Revenue = nilai kotor pesanan selesai sebelum diskon & potongan (sama dengan kartu di layar).',
    'Potongan Merchant = diskon offline + promo Food Apps yang ditanggung merchant. Subsidi platform tidak termasuk.',
    'Total COGS = HPP resep yang berlaku pada tanggal pesanan × qty (outlet mitra +10%).',
    'Gross Profit = Gross Revenue − (Total COGS + Potongan Merchant). Margin GP = Gross Profit ÷ Gross Revenue.',
    'Rincian per item membagi omzet & potongan pesanan secara proporsional ke tiap item.',
  ]
  catatan.forEach(teks => {
    blok('A', 'J', r, `•  ${teks}`, { font: { name: 'Calibri', size: 9, color: { argb: argb(WARNA.teksPudar) } }, alignment: { vertical: 'middle', wrapText: true } })
    r += 1
  })
}

/** Susun workbook (tanpa mengunduh) — dipisah agar bisa diuji di Node. */
export function susunWorkbookLaporan(ExcelJS: any, data: PosExportReport, ctx: KonteksEkspor) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SS Shawarma Digital Hub'
  wb.created = new Date()

  const t = data.total
  const sub = `Periode: ${labelPeriode(data)}   ·   Cabang: ${labelCabang(data, ctx)}   ·   Channel: ${ctx.channel}   ·   Dicetak: ${waktuCetak()}`
  const warnaChannel = new Map(data.channels.map(c => [c.nama, c.warna]))
  const lengkapi = (r: { gross: number; potongan: number; gp: number }) => ({
    net: r.gross - r.potongan,
    margin: rasio(r.gp, r.gross),
    kontribusi: rasio(r.gross, t.gross),
  })

  const SHEET = ['Per Outlet', 'Outlet x Channel', 'Detail Item', 'Harian per Outlet', 'Menu Terlaris']
  sheetRingkasan(wb, data, sub, SHEET)

  sheetTabel(wb, 'Per Outlet', {
    judul: 'RINGKASAN PER OUTLET', sub, beku: 2, tab: WARNA.oranye,
    kolom: [
      { key: 'no', header: 'No', width: 6, jenis: 'angka' },
      { key: 'nama', header: 'Outlet', width: 34, jenis: 'teks', total: 'judul' },
      { key: 'tipe', header: 'Tipe', width: 11, jenis: 'teks', tipeOutlet: true },
      { key: 'trx', header: 'Transaksi', width: 12, jenis: 'angka', total: 'sum' },
      { key: 'batal', header: 'Dibatalkan', width: 11, jenis: 'angka', total: 'sum' },
      { key: 'qty', header: 'Item Terjual', width: 12, jenis: 'angka', total: 'sum' },
      ...kolomUang({ netto: true, kontribusi: true }),
      { key: 'aov', header: 'Rata-rata / Transaksi', width: 15, jenis: 'rp', total: ref => `IFERROR(${ref('gross')}/${ref('trx')},0)` },
      { key: 'subsidi', header: 'Subsidi Platform', width: 15, jenis: 'rp', total: 'sum' },
    ],
    baris: data.outlets.map((o, i) => ({ no: i + 1, ...o, ...lengkapi(o), aov: rasio(o.gross, o.trx) })),
  })

  sheetTabel(wb, 'Outlet x Channel', {
    judul: 'PENJUALAN PER OUTLET × CHANNEL', sub, beku: 3, tab: WARNA.potongan,
    kolom: [
      { key: 'no', header: 'No', width: 6, jenis: 'angka' },
      { key: 'outlet', header: 'Outlet', width: 32, jenis: 'teks', total: 'judul' },
      { key: 'channel', header: 'Channel', width: 20, jenis: 'teks', warnaChannel: true },
      { key: 'grup', header: 'Grup Channel', width: 13, jenis: 'teks' },
      { key: 'trx', header: 'Transaksi', width: 12, jenis: 'angka', total: 'sum' },
      { key: 'qty', header: 'Item Terjual', width: 12, jenis: 'angka', total: 'sum' },
      ...kolomUang({ netto: true, kontribusi: true }),
    ],
    baris: data.outletChannels.map((o, i) => ({ no: i + 1, ...o, ...lengkapi(o), _warna: warnaChannel.get(o.channel) })),
  })

  sheetTabel(wb, 'Detail Item', {
    judul: 'DETAIL ITEM TERJUAL PER OUTLET & CHANNEL', sub, beku: 3, tab: WARNA.gp,
    kolom: [
      { key: 'no', header: 'No', width: 6, jenis: 'angka' },
      { key: 'outlet', header: 'Outlet', width: 30, jenis: 'teks', total: 'judul' },
      { key: 'channel', header: 'Channel', width: 19, jenis: 'teks', warnaChannel: true },
      { key: 'tipe', header: 'Tipe Outlet', width: 11, jenis: 'teks', tipeOutlet: true },
      { key: 'grup', header: 'Grup Channel', width: 13, jenis: 'teks' },
      { key: 'menu', header: 'Nama Menu / Item', width: 34, jenis: 'teks' },
      { key: 'qty', header: 'Qty', width: 9, jenis: 'angka', total: 'sum' },
      { key: 'harga', header: 'Harga Rata²', width: 13, jenis: 'rp', total: ref => `IFERROR(${ref('gross')}/${ref('qty')},0)` },
      { key: 'hpp', header: 'HPP / Unit', width: 12, jenis: 'rp', total: ref => `IFERROR(${ref('cogs')}/${ref('qty')},0)` },
      ...kolomUang({ netto: true, kontribusi: true }),
    ],
    baris: data.items.map((it, i) => ({
      no: i + 1, ...it, ...lengkapi(it),
      harga: rasio(it.gross, it.qty), hpp: rasio(it.cogs, it.qty), _warna: warnaChannel.get(it.channel),
    })),
  })

  sheetTabel(wb, 'Harian per Outlet', {
    judul: 'TREN HARIAN PER OUTLET', sub, beku: 3, tab: WARNA.gross,
    kolom: [
      { key: 'no', header: 'No', width: 6, jenis: 'angka' },
      { key: 'tanggal', header: 'Tanggal', width: 18, jenis: 'tanggal', rataKiri: true },
      { key: 'outlet', header: 'Outlet', width: 32, jenis: 'teks', total: 'judul' },
      { key: 'trx', header: 'Transaksi', width: 12, jenis: 'angka', total: 'sum' },
      { key: 'qty', header: 'Item Terjual', width: 12, jenis: 'angka', total: 'sum' },
      ...kolomUang({ netto: true }),
    ],
    baris: data.harianOutlet.map((h, i) => ({ no: i + 1, ...h, ...lengkapi(h) })),
  })

  sheetTabel(wb, 'Menu Terlaris', {
    judul: 'MENU TERLARIS (SEMUA OUTLET)', sub, beku: 2, tab: WARNA.cogs,
    kolom: [
      { key: 'no', header: 'Peringkat', width: 10, jenis: 'angka' },
      { key: 'menu', header: 'Nama Menu / Item', width: 38, jenis: 'teks', total: 'judul' },
      { key: 'outletCount', header: 'Dijual di (Outlet)', width: 13, jenis: 'angka' },
      { key: 'qty', header: 'Qty Terjual', width: 12, jenis: 'angka', total: 'sum' },
      { key: 'harga', header: 'Harga Rata²', width: 13, jenis: 'rp', total: ref => `IFERROR(${ref('gross')}/${ref('qty')},0)` },
      ...kolomUang({ kontribusi: true }),
    ],
    baris: data.menu.map((m, i) => ({ no: i + 1, ...m, ...lengkapi(m), harga: rasio(m.gross, m.qty) })),
  })

  return wb
}

export async function buatExcelLaporan(data: PosExportReport, ctx: KonteksEkspor): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const buffer = await susunWorkbookLaporan(ExcelJS, data, ctx).xlsx.writeBuffer()
  unduhBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    namaBerkas(data, ctx, 'xlsx')
  )
}
