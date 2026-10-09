/* ── Ekspor PDF Rangkuman Penjualan ──────────────────────────────────────────
 *
 * A4 landscape. Halaman 1: kop berwarna primary (sidebar), kartu KPI seperti di
 * layar, ringkasan per outlet. Lalu channel & pembayaran, tren harian, menu
 * terlaris, dan satu bagian rincian (channel × menu) untuk SETIAP outlet.
 */

import type { PosExportReport } from '@/lib/posReport/ekspor'
import {
  WARNA, type KonteksEkspor, angka, hexKeRgb, labelCabang, labelPeriode, namaBerkas, persen, rasio, rupiah,
  tanggalDenganHari, tint, waktuCetak, warnaMargin,
} from '@/lib/posReport/eksporUi'

type RGB = [number, number, number]
const rgb = (hex: string): RGB => hexKeRgb(hex)
const PUTIH: RGB = [255, 255, 255]

const W = 297
const H = 210
const M = 12
const LK = W - 2 * M
const ATAS_LANJUTAN = 19
const BAWAH = 14

/** Font standar PDF hanya mengenal Latin-1: ganti tanda baca Unicode & buang emoji. */
function aman(s: unknown): string {
  return String(s ?? '')
    .replace(/[–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

function muatGambar(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null)
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export function susunPdfLaporan(
  JsPDF: any,
  autoTable: any,
  data: PosExportReport,
  ctx: KonteksEkspor,
  logo: HTMLImageElement | null = null
) {
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const t = data.total
  const periode = aman(labelPeriode(data))
  const cabang = aman(labelCabang(data, ctx))
  const dicetak = waktuCetak()

  const teks = (s: unknown, x: number, y: number, o: { size?: number; bold?: boolean; warna?: RGB; align?: 'left' | 'right' | 'center'; maxW?: number } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.setFontSize(o.size ?? 8)
    doc.setTextColor(...(o.warna ?? rgb(WARNA.teks)))
    let isi = aman(s)
    if (o.maxW && doc.getTextWidth(isi) > o.maxW) {
      while (isi.length > 1 && doc.getTextWidth(`${isi}...`) > o.maxW) isi = isi.slice(0, -1)
      isi = `${isi.trimEnd()}...`
    }
    doc.text(isi, x, y, { align: o.align ?? 'left' })
  }

  const halamanBaru = () => {
    doc.addPage()
    return ATAS_LANJUTAN + 1
  }
  const pastikanRuang = (y: number, butuh: number) => (y + butuh > H - BAWAH ? halamanBaru() : y)
  const akhirTabel = () => (doc as any).lastAutoTable.finalY as number

  const judulBagian = (judul: string, y: number, ket?: string) => {
    doc.setFillColor(...rgb(WARNA.oranye))
    doc.rect(M, y - 3.7, 1.4, 4.8, 'F')
    teks(judul, M + 3.6, y, { size: 11, bold: true, warna: rgb(WARNA.primary) })
    if (ket) teks(ket, W - M, y, { size: 7.4, warna: rgb(WARNA.teksPudar), align: 'right' })
    return y + 3
  }

  const dasarTabel = {
    theme: 'plain',
    margin: { left: M, right: M, top: ATAS_LANJUTAN, bottom: BAWAH },
    styles: {
      font: 'helvetica', fontSize: 7.4, textColor: rgb(WARNA.teks), valign: 'middle', overflow: 'ellipsize',
      cellPadding: { top: 1.7, bottom: 1.7, left: 1.8, right: 1.8 }, lineColor: rgb(WARNA.garis), lineWidth: { bottom: 0.15 },
    },
    headStyles: { fillColor: rgb(WARNA.primary), textColor: PUTIH, fontStyle: 'bold', fontSize: 7.1, halign: 'right', lineWidth: 0 },
    footStyles: { fillColor: rgb(WARNA.kremTua), textColor: rgb(WARNA.primary), fontStyle: 'bold', fontSize: 7.6, halign: 'right', lineWidth: { top: 0.35 }, lineColor: rgb(WARNA.primary) },
    alternateRowStyles: { fillColor: rgb(WARNA.krem) },
    showFoot: 'lastPage',
    // Baris tidak pernah dibelah dua di batas halaman.
    rowPageBreak: 'avoid',
  }

  /** Batang kecil di dalam sel (kontribusi / tren), relatif terhadap nilai terbesar. */
  const batang = (cell: any, nilai: number, maks: number, warna: string, sisaTeks = 14) => {
    const lebar = Math.max(4, cell.width - sisaTeks - 3)
    const y = cell.y + cell.height / 2 - 0.9
    doc.setFillColor(...rgb(WARNA.garis))
    doc.roundedRect(cell.x + 1.8, y, lebar, 1.8, 0.9, 0.9, 'F')
    const isiLebar = maks > 0 ? Math.max(0.8, (lebar * Math.max(0, nilai)) / maks) : 0
    if (isiLebar > 0) {
      doc.setFillColor(...rgb(warna))
      doc.roundedRect(cell.x + 1.8, y, isiLebar, 1.8, 0.9, 0.9, 'F')
    }
  }

  const warnaAngka = (cell: any, nilai: number, kolomMargin: boolean) => {
    if (kolomMargin) {
      cell.styles.textColor = rgb(warnaMargin(nilai))
      cell.styles.fontStyle = 'bold'
    } else if (nilai < 0) {
      cell.styles.textColor = rgb(WARNA.merah)
    }
  }

  // ── Halaman 1: kop ─────────────────────────────────────────────────────────
  doc.setFillColor(...rgb(WARNA.primary))
  doc.rect(0, 0, W, 30, 'F')
  doc.setFillColor(...rgb(WARNA.oranye))
  doc.rect(0, 30, W, 1.2, 'F')
  let xJudul = M
  if (logo) {
    doc.setFillColor(...PUTIH)
    doc.circle(M + 9.5, 15, 9.5, 'F')
    doc.addImage(logo, 'PNG', M + 1.8, 7.3, 15.4, 15.4)
    xJudul = M + 24
  }
  teks('LAPORAN PENJUALAN', xJudul, 14.2, { size: 19, bold: true, warna: PUTIH })
  teks('SS Shawarma  ·  Rangkuman Penjualan & Analitik Outlet', xJudul, 20.8, { size: 9, warna: [251, 227, 208] })

  const meta: [string, string][] = [['Periode', periode], ['Cabang', cabang], ['Channel', aman(ctx.channel)], ['Dicetak', dicetak]]
  const xLabel = W - M - 98
  meta.forEach(([label, nilai], i) => {
    const y = 8.6 + i * 5
    teks(label, xLabel, y, { size: 7.2, warna: [245, 201, 166] })
    teks(nilai, xLabel + 15, y, { size: 7.8, bold: true, warna: PUTIH, maxW: 83 })
  })

  // ── Kartu KPI (warna sama dengan kartu di layar) ───────────────────────────
  const kartu = [
    { label: 'GROSS REVENUE', nilai: t.gross, ket: 'Omzet kotor sebelum diskon & potongan', warna: WARNA.gross },
    { label: 'TOTAL COGS', nilai: t.cogs, ket: `${persen(rasio(t.cogs, t.gross))} dari Gross Revenue (HPP resep)`, warna: WARNA.cogs },
    { label: 'POTONGAN MERCHANT', nilai: t.potongan, ket: `${persen(rasio(t.potongan, t.gross))} dari Gross · Subsidi platform ${rupiah(t.subsidi)}`, warna: WARNA.potongan },
    { label: 'GROSS PROFIT', nilai: t.gp, ket: `Margin ${persen(rasio(t.gp, t.gross))} · Gross - (COGS + Potongan)`, warna: WARNA.gp },
  ]
  const yK = 37
  const lebarK = (LK - 3 * 4) / 4
  kartu.forEach((k, i) => {
    const x = M + i * (lebarK + 4)
    doc.setFillColor(...rgb(k.warna))
    doc.roundedRect(x, yK, lebarK, 25, 2.6, 2.6, 'F')
    doc.setCharSpace(0.25)
    teks(k.label, x + 5, yK + 6.8, { size: 7.4, bold: true, warna: PUTIH })
    doc.setCharSpace(0)
    teks(rupiah(k.nilai), x + 5, yK + 15.4, { size: 16, bold: true, warna: PUTIH })
    teks(k.ket, x + 5, yK + 21.4, { size: 6.8, warna: [255, 244, 232], maxW: lebarK - 9 })
  })

  // ── Statistik pendamping ──────────────────────────────────────────────────
  const statistik: [string, string][] = [
    ['ITEM TERJUAL', `${angka(t.qty)} pcs`],
    ['TRANSAKSI SELESAI', angka(t.trx)],
    ['DIBATALKAN', `${angka(t.batal)}  (${persen(rasio(t.batal, t.trx + t.batal))})`],
    ['RATA-RATA / TRANSAKSI', rupiah(rasio(t.gross, t.trx))],
    ['OMZET BERSIH', rupiah(t.gross - t.potongan)],
    ['OUTLET AKTIF', `${t.outletCount} outlet`],
  ]
  const yS = 66
  const lebarS = (LK - 5 * 3) / 6
  statistik.forEach(([label, nilai], i) => {
    const x = M + i * (lebarS + 3)
    doc.setFillColor(...rgb(WARNA.krem))
    doc.setDrawColor(...rgb(WARNA.garis))
    doc.setLineWidth(0.2)
    doc.roundedRect(x, yS, lebarS, 14.5, 1.8, 1.8, 'FD')
    doc.setFillColor(...rgb(WARNA.primary))
    doc.rect(x, yS + 2.5, 1.1, 9.5, 'F')
    teks(label, x + 4, yS + 5.4, { size: 6.2, bold: true, warna: rgb(WARNA.teksPudar) })
    teks(nilai, x + 4, yS + 11.2, { size: 10.5, bold: true, warna: rgb(WARNA.primary), maxW: lebarS - 6 })
  })

  // ── Ringkasan per outlet ───────────────────────────────────────────────────
  let y = judulBagian('Ringkasan per Outlet', 89, 'Diurutkan dari Gross Revenue terbesar · Margin GP = Gross Profit / Gross Revenue')
  const maksKontribusiOutlet = Math.max(0, ...data.outlets.map(o => rasio(o.gross, t.gross)))
  autoTable(doc, {
    ...dasarTabel,
    startY: y,
    head: [['#', 'Outlet', 'Tipe', 'Trx', 'Batal', 'Item', 'Gross Revenue', 'Potongan', 'COGS', 'Gross Profit', 'Margin', 'Kontribusi']],
    body: data.outlets.map((o, i) => [
      i + 1, aman(o.nama), o.tipe, angka(o.trx), angka(o.batal), angka(o.qty),
      angka(o.gross), angka(o.potongan), angka(o.cogs), angka(o.gp), persen(rasio(o.gp, o.gross)), persen(rasio(o.gross, t.gross)),
    ]),
    foot: [['', `TOTAL ${t.outletCount} OUTLET`, '', angka(t.trx), angka(t.batal), angka(t.qty), angka(t.gross), angka(t.potongan), angka(t.cogs), angka(t.gp), persen(rasio(t.gp, t.gross)), '100,0%']],
    columnStyles: {
      0: { cellWidth: 7, halign: 'center', textColor: rgb(WARNA.teksPudar) },
      1: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 11, halign: 'right' },
      5: { cellWidth: 15, halign: 'right' },
      6: { cellWidth: 29, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 27, halign: 'right' },
      9: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 14, halign: 'right' },
      11: { cellWidth: 28, halign: 'right' },
    },
    didParseCell: (c: any) => {
      if (c.section === 'head' && c.column.index <= 1) c.cell.styles.halign = c.column.index === 0 ? 'center' : 'left'
      if (c.section === 'head' && c.column.index === 2) c.cell.styles.halign = 'center'
      if (c.section === 'foot' && c.column.index === 1) c.cell.styles.halign = 'left'
      if (c.section !== 'body') return
      const o = data.outlets[c.row.index]
      if (c.column.index === 2) c.cell.styles.textColor = rgb(o.tipe === 'Mitra' ? WARNA.mitra : o.tipe === 'SS Online' ? WARNA.oranye : WARNA.primary)
      if (c.column.index === 9) warnaAngka(c.cell, o.gp, false)
      if (c.column.index === 10) warnaAngka(c.cell, rasio(o.gp, o.gross), true)
    },
    didDrawCell: (c: any) => {
      if (c.section === 'body' && c.column.index === 11) batang(c.cell, rasio(data.outlets[c.row.index].gross, t.gross), maksKontribusiOutlet, WARNA.oranye)
    },
  })
  y = akhirTabel() + 9

  // ── Per channel & metode pembayaran (berdampingan) ─────────────────────────
  const barisSamping = Math.max(data.channels.length, data.pembayaran.length) + 2
  y = pastikanRuang(y, 14 + barisSamping * 6.2)
  y = judulBagian('Ringkasan per Channel & Metode Pembayaran', y)
  const lebarChannel = 196
  const yMulaiSamping = y
  const maksKontribusiCh = Math.max(0, ...data.channels.map(c => rasio(c.gross, t.gross)))
  autoTable(doc, {
    ...dasarTabel,
    startY: yMulaiSamping,
    margin: { ...dasarTabel.margin, right: W - M - lebarChannel },
    head: [['Channel', 'Trx', 'Item', 'Gross Revenue', 'Potongan', 'COGS', 'Gross Profit', 'Margin', 'Porsi']],
    body: data.channels.map(c => [
      aman(c.nama), angka(c.trx), angka(c.qty), angka(c.gross), angka(c.potongan), angka(c.cogs), angka(c.gp),
      persen(rasio(c.gp, c.gross)), persen(rasio(c.gross, t.gross)),
    ]),
    foot: [['TOTAL', angka(t.trx), angka(t.qty), angka(t.gross), angka(t.potongan), angka(t.cogs), angka(t.gp), persen(rasio(t.gp, t.gross)), '100,0%']],
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold', cellPadding: { top: 1.7, bottom: 1.7, left: 5.5, right: 1.8 } },
      1: { cellWidth: 13 }, 2: { cellWidth: 14 }, 3: { cellWidth: 25, fontStyle: 'bold' }, 4: { cellWidth: 21 },
      5: { cellWidth: 23 }, 6: { cellWidth: 23, fontStyle: 'bold' }, 7: { cellWidth: 13 }, 8: { cellWidth: 22 },
    },
    didParseCell: (c: any) => {
      if (c.column.index === 0 && c.section !== 'body') c.cell.styles.halign = 'left'
      if (c.section !== 'body') return
      const ch = data.channels[c.row.index]
      if (c.column.index > 0) c.cell.styles.halign = 'right'
      if (c.column.index === 0) c.cell.styles.textColor = rgb(ch.warna)
      if (c.column.index === 6) warnaAngka(c.cell, ch.gp, false)
      if (c.column.index === 7) warnaAngka(c.cell, rasio(ch.gp, ch.gross), true)
    },
    didDrawCell: (c: any) => {
      if (c.section !== 'body') return
      const ch = data.channels[c.row.index]
      if (c.column.index === 0) {
        doc.setFillColor(...rgb(ch.warna))
        doc.circle(c.cell.x + 2.6, c.cell.y + c.cell.height / 2, 1.1, 'F')
      }
      if (c.column.index === 8) batang(c.cell, rasio(ch.gross, t.gross), maksKontribusiCh, ch.warna, 12)
    },
  })
  const akhirChannel = akhirTabel()
  const totalBayar = data.pembayaran.reduce((s, p) => s + p.nominal, 0)
  autoTable(doc, {
    ...dasarTabel,
    startY: yMulaiSamping,
    margin: { ...dasarTabel.margin, left: M + lebarChannel + 6 },
    head: [['Metode Bayar', 'Trx', 'Nominal Dibayar', 'Porsi']],
    body: data.pembayaran.map(p => [aman(p.metode), angka(p.trx), angka(p.nominal), persen(rasio(p.nominal, totalBayar))]),
    foot: [['TOTAL', angka(data.pembayaran.reduce((s, p) => s + p.trx, 0)), angka(totalBayar), '100,0%']],
    columnStyles: { 0: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' }, 1: { cellWidth: 12 }, 2: { cellWidth: 24 }, 3: { cellWidth: 14 } },
    didParseCell: (c: any) => {
      if (c.column.index === 0) c.cell.styles.halign = 'left'
      else if (c.section === 'body') c.cell.styles.halign = 'right'
    },
  })
  y = Math.max(akhirChannel, akhirTabel()) + 9

  // ── Tren harian ────────────────────────────────────────────────────────────
  if (data.harian.length > 1) {
    y = pastikanRuang(y, 40)
    const terbaik = data.harian.reduce((a, b) => (b.gross > a.gross ? b : a), data.harian[0])
    y = judulBagian('Tren Harian (Semua Outlet)', y, `Hari tertinggi: ${tanggalDenganHari(terbaik.tanggal)} · ${rupiah(terbaik.gross)}`)
    const maksHarian = Math.max(0, ...data.harian.map(h => h.gross))
    autoTable(doc, {
      ...dasarTabel,
      startY: y,
      head: [['Tanggal', 'Trx', 'Item', 'Gross Revenue', 'Potongan', 'COGS', 'Gross Profit', 'Margin', 'Grafik Gross Revenue']],
      body: data.harian.map(h => [
        tanggalDenganHari(h.tanggal), angka(h.trx), angka(h.qty), angka(h.gross), angka(h.potongan), angka(h.cogs), angka(h.gp), persen(rasio(h.gp, h.gross)), '',
      ]),
      foot: [[`${data.harian.length} hari`, angka(t.trx), angka(t.qty), angka(t.gross), angka(t.potongan), angka(t.cogs), angka(t.gp), persen(rasio(t.gp, t.gross)), `Rata-rata ${rupiah(rasio(t.gross, data.harian.length))} / hari`]],
      columnStyles: {
        0: { cellWidth: 25, halign: 'left', fontStyle: 'bold' }, 1: { cellWidth: 14 }, 2: { cellWidth: 15 }, 3: { cellWidth: 29, fontStyle: 'bold' },
        4: { cellWidth: 25 }, 5: { cellWidth: 27 }, 6: { cellWidth: 27, fontStyle: 'bold' }, 7: { cellWidth: 14 }, 8: { cellWidth: 'auto' },
      },
      didParseCell: (c: any) => {
        if (c.column.index === 0) c.cell.styles.halign = 'left'
        else if (c.section === 'body') c.cell.styles.halign = 'right'
        if (c.section !== 'body' && c.column.index === 8) c.cell.styles.halign = 'left'
        if (c.section !== 'body') return
        const h = data.harian[c.row.index]
        if (c.column.index === 6) warnaAngka(c.cell, h.gp, false)
        if (c.column.index === 7) warnaAngka(c.cell, rasio(h.gp, h.gross), true)
      },
      didDrawCell: (c: any) => {
        if (c.section === 'body' && c.column.index === 8) {
          const h = data.harian[c.row.index]
          batang(c.cell, h.gross, maksHarian, h.tanggal === terbaik.tanggal ? WARNA.gp : WARNA.gross, 2)
        }
      },
    })
    y = akhirTabel() + 9
  }

  // ── Menu terlaris ──────────────────────────────────────────────────────────
  const top = data.menu.slice(0, 20)
  if (top.length > 0) {
    y = pastikanRuang(y, 40)
    y = judulBagian(`${top.length} Menu Terlaris (Semua Outlet)`, y, `Dari ${data.menu.length} menu terjual · daftar lengkap ada di Excel sheet "Menu Terlaris"`)
    const maksMenu = Math.max(0, ...top.map(m => rasio(m.gross, t.gross)))
    autoTable(doc, {
      ...dasarTabel,
      startY: y,
      head: [['#', 'Nama Menu / Item', 'Jml Outlet', 'Qty', 'Harga Rata²', 'Gross Revenue', 'Potongan', 'COGS', 'Gross Profit', 'Margin', 'Kontribusi']],
      body: top.map((m, i) => [
        i + 1, aman(m.menu), angka(m.outletCount), angka(m.qty), angka(rasio(m.gross, m.qty)), angka(m.gross), angka(m.potongan),
        angka(m.cogs), angka(m.gp), persen(rasio(m.gp, m.gross)), persen(rasio(m.gross, t.gross)),
      ]),
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', textColor: rgb(WARNA.teksPudar) }, 1: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 16 }, 3: { cellWidth: 16, fontStyle: 'bold' }, 4: { cellWidth: 22 }, 5: { cellWidth: 28, fontStyle: 'bold' },
        6: { cellWidth: 24 }, 7: { cellWidth: 26 }, 8: { cellWidth: 26, fontStyle: 'bold' }, 9: { cellWidth: 14 }, 10: { cellWidth: 26 },
      },
      didParseCell: (c: any) => {
        if (c.column.index === 1) c.cell.styles.halign = 'left'
        else if (c.column.index === 0) c.cell.styles.halign = 'center'
        else if (c.section === 'body') c.cell.styles.halign = 'right'
        if (c.section !== 'body') return
        const m = top[c.row.index]
        if (c.column.index === 8) warnaAngka(c.cell, m.gp, false)
        if (c.column.index === 9) warnaAngka(c.cell, rasio(m.gp, m.gross), true)
      },
      didDrawCell: (c: any) => {
        if (c.section === 'body' && c.column.index === 10) batang(c.cell, rasio(top[c.row.index].gross, t.gross), maksMenu, WARNA.cogs)
      },
    })
    y = akhirTabel() + 8
  }

  // ── Keterangan ─────────────────────────────────────────────────────────────
  const catatan = [
    'Gross Revenue = nilai kotor pesanan selesai sebelum diskon & potongan (sama dengan kartu di layar Rangkuman Penjualan).',
    'Potongan Merchant = diskon offline + promo Food Apps yang ditanggung merchant. Subsidi platform bukan beban outlet.',
    'COGS = HPP resep yang berlaku pada tanggal pesanan x qty (outlet mitra +10%). Gross Profit = Gross Revenue - (COGS + Potongan).',
    'Rincian per item membagi omzet & potongan setiap pesanan secara proporsional ke item di dalamnya.',
  ]
  y = pastikanRuang(y, 6 + catatan.length * 4.2)
  doc.setFillColor(...rgb(WARNA.krem))
  doc.roundedRect(M, y - 1, LK, 4 + catatan.length * 4.2, 1.5, 1.5, 'F')
  teks('KETERANGAN', M + 3, y + 2.6, { size: 6.8, bold: true, warna: rgb(WARNA.primary) })
  catatan.forEach((c, i) => teks(`-  ${c}`, M + 24, y + 2.6 + i * 4.2, { size: 6.8, warna: rgb(WARNA.teksPudar), maxW: LK - 27 }))

  // ── Rincian per outlet (satu bagian per outlet, mulai halaman baru) ────────
  data.outlets.forEach((o, peringkat) => {
    let yo = halamanBaru()
    const metrik: [string, string, string][] = [
      ['GROSS REVENUE', rupiah(o.gross), WARNA.gross],
      ['TOTAL COGS', rupiah(o.cogs), WARNA.cogs],
      ['POTONGAN', rupiah(o.potongan), WARNA.potongan],
      ['GROSS PROFIT', rupiah(o.gp), o.gp < 0 ? WARNA.merah : WARNA.gp],
      ['MARGIN GP', persen(rasio(o.gp, o.gross)), warnaMargin(rasio(o.gp, o.gross))],
      ['TRX / ITEM', `${angka(o.trx)} / ${angka(o.qty)}`, WARNA.primary],
    ]
    const lebarM = 29
    const xMetrik = W - M - metrik.length * lebarM - 2
    doc.setFillColor(...rgb(WARNA.krem))
    doc.setDrawColor(...rgb(WARNA.garis))
    doc.setLineWidth(0.2)
    doc.roundedRect(M, yo, LK, 21, 2, 2, 'FD')
    doc.setFillColor(...rgb(WARNA.primary))
    doc.rect(M, yo + 3, 1.6, 15, 'F')
    teks(o.nama, M + 5, yo + 8.2, { size: 12.5, bold: true, warna: rgb(WARNA.primary), maxW: xMetrik - M - 8 })
    const warnaTipe = o.tipe === 'Mitra' ? WARNA.mitra : o.tipe === 'SS Online' ? WARNA.oranye : WARNA.primary
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.6)
    const lebarChip = doc.getTextWidth(aman(o.tipe.toUpperCase())) + 4.4
    doc.setFillColor(...rgb(warnaTipe))
    doc.roundedRect(M + 5, yo + 11.6, lebarChip, 4, 2, 2, 'F')
    teks(o.tipe.toUpperCase(), M + 7.2, yo + 14.4, { size: 6.6, bold: true, warna: PUTIH })
    teks(
      `Peringkat #${peringkat + 1} dari ${data.outlets.length} outlet  ·  Kontribusi ${persen(rasio(o.gross, t.gross))} omzet  ·  Batal ${angka(o.batal)}`,
      M + 7 + lebarChip, yo + 14.4, { size: 7, warna: rgb(WARNA.teksPudar), maxW: xMetrik - M - lebarChip - 10 }
    )
    metrik.forEach(([label, nilai, warna], i) => {
      const x = xMetrik + i * lebarM
      if (i > 0) {
        doc.setDrawColor(...rgb(WARNA.garis))
        doc.line(x - 1, yo + 4, x - 1, yo + 17)
      }
      teks(label, x + 1, yo + 8, { size: 5.9, bold: true, warna: rgb(WARNA.teksPudar) })
      teks(nilai, x + 1, yo + 14, { size: 8.6, bold: true, warna: rgb(warna), maxW: lebarM - 2 })
    })
    yo += 25

    type Baris = { jenis: 'grup' | 'item' | 'sub'; warna: string; nilai?: number; gp?: number; gross?: number; zebra?: boolean }
    const meta: Baris[] = []
    const body: any[] = []
    const itemOutlet = data.items.filter(i => i.outletId === o.id)
    const maksItem = Math.max(0, ...itemOutlet.map(i => rasio(i.gross, o.gross)))
    const channelOutlet = data.outletChannels.filter(c => c.outletId === o.id)
    const warnaCh = new Map(data.channels.map(c => [c.nama, c.warna]))

    for (const ch of channelOutlet) {
      const warna = warnaCh.get(ch.channel) ?? WARNA.primary
      meta.push({ jenis: 'grup', warna })
      body.push([{
        content: aman(`${ch.channel}   ·   ${ch.grup}   ·   ${angka(ch.trx)} transaksi   ·   ${angka(ch.qty)} item   ·   Gross ${rupiah(ch.gross)}`),
        colSpan: 10,
        styles: { halign: 'left', fontStyle: 'bold', textColor: rgb(warna), fillColor: tint(warna, 0.1), cellPadding: { top: 1.9, bottom: 1.9, left: 6, right: 2 } },
      }])
      itemOutlet.filter(i => i.channel === ch.channel).forEach((it, idx) => {
        meta.push({ jenis: 'item', warna, nilai: rasio(it.gross, o.gross), gp: it.gp, gross: it.gross, zebra: idx % 2 === 1 })
        body.push([
          aman(it.menu), angka(it.qty), angka(rasio(it.gross, it.qty)), angka(rasio(it.cogs, it.qty)), angka(it.gross),
          angka(it.potongan), angka(it.cogs), angka(it.gp), persen(rasio(it.gp, it.gross)), persen(rasio(it.gross, o.gross)),
        ])
      })
      meta.push({ jenis: 'sub', warna, gp: ch.gp, gross: ch.gross })
      body.push([
        aman(`Subtotal ${ch.channel}`), angka(ch.qty), angka(rasio(ch.gross, ch.qty)), angka(rasio(ch.cogs, ch.qty)), angka(ch.gross),
        angka(ch.potongan), angka(ch.cogs), angka(ch.gp), persen(rasio(ch.gp, ch.gross)), persen(rasio(ch.gross, o.gross)),
      ])
    }

    autoTable(doc, {
      ...dasarTabel,
      startY: yo,
      margin: { ...dasarTabel.margin, top: ATAS_LANJUTAN + 5 },
      styles: { ...dasarTabel.styles, cellPadding: { top: 1.35, bottom: 1.35, left: 1.8, right: 1.8 } },
      alternateRowStyles: {},
      didDrawPage: (h: any) => {
        // pageNumber dihitung per tabel: 1 = halaman pertama tabel ini.
        if (h.pageNumber <= 1) return
        teks(`${o.nama}  -  lanjutan`, M, ATAS_LANJUTAN + 2.2, { size: 8.4, bold: true, warna: rgb(WARNA.primary) })
        teks(`Peringkat #${peringkat + 1} · Gross ${rupiah(o.gross)} · Margin ${persen(rasio(o.gp, o.gross))}`, W - M, ATAS_LANJUTAN + 2.2, { size: 7, warna: rgb(WARNA.teksPudar), align: 'right' })
      },
      head: [['Nama Menu / Item', 'Qty', 'Harga Rata²', 'HPP / Unit', 'Gross Revenue', 'Potongan', 'COGS', 'Gross Profit', 'Margin', 'Kontribusi']],
      body,
      foot: [[
        aman(`TOTAL ${o.nama}`), angka(o.qty), angka(rasio(o.gross, o.qty)), angka(rasio(o.cogs, o.qty)), angka(o.gross),
        angka(o.potongan), angka(o.cogs), angka(o.gp), persen(rasio(o.gp, o.gross)), '100,0%',
      ]],
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left', cellPadding: { top: 1.35, bottom: 1.35, left: 6, right: 1.8 } },
        1: { cellWidth: 14, fontStyle: 'bold' }, 2: { cellWidth: 22 }, 3: { cellWidth: 20 }, 4: { cellWidth: 28, fontStyle: 'bold' },
        5: { cellWidth: 24 }, 6: { cellWidth: 26 }, 7: { cellWidth: 26, fontStyle: 'bold' }, 8: { cellWidth: 14 }, 9: { cellWidth: 25 },
      },
      didParseCell: (c: any) => {
        c.cell.styles.halign = c.column.index === 0 ? 'left' : 'right'
        if (c.section !== 'body') return
        const b = meta[c.row.index]
        if (!b || b.jenis === 'grup') return
        if (b.jenis === 'sub') {
          c.cell.styles.fontStyle = 'bold'
          c.cell.styles.fillColor = tint(b.warna, 0.05)
          c.cell.styles.textColor = rgb(WARNA.primary)
          c.cell.styles.lineWidth = { bottom: 0.4 }
          c.cell.styles.lineColor = tint(b.warna, 0.45)
        } else if (b.zebra) {
          c.cell.styles.fillColor = rgb(WARNA.krem)
        }
        if (c.column.index === 7) warnaAngka(c.cell, b.gp ?? 0, false)
        if (c.column.index === 8) warnaAngka(c.cell, rasio(b.gp ?? 0, b.gross ?? 0), true)
      },
      didDrawCell: (c: any) => {
        if (c.section !== 'body') return
        const b = meta[c.row.index]
        if (!b) return
        if (b.jenis === 'grup' && c.column.index === 0) {
          doc.setFillColor(...rgb(b.warna))
          doc.circle(c.cell.x + 3, c.cell.y + c.cell.height / 2, 1.2, 'F')
        }
        if (b.jenis === 'item' && c.column.index === 9) batang(c.cell, b.nilai ?? 0, maksItem, b.warna, 12)
      },
    })
  })

  // ── Kop lanjutan & kaki halaman ────────────────────────────────────────────
  const jumlah = doc.internal.getNumberOfPages()
  for (let i = 1; i <= jumlah; i++) {
    doc.setPage(i)
    if (i > 1) {
      doc.setFillColor(...rgb(WARNA.primary))
      doc.rect(0, 0, W, 12, 'F')
      doc.setFillColor(...rgb(WARNA.oranye))
      doc.rect(0, 12, W, 0.6, 'F')
      teks('LAPORAN PENJUALAN  ·  SS SHAWARMA', M, 7.8, { size: 8.6, bold: true, warna: PUTIH })
      teks(`${periode}   ·   ${cabang}`, W - M, 7.8, { size: 7.4, warna: [245, 201, 166], align: 'right', maxW: 150 })
    }
    doc.setDrawColor(...rgb(WARNA.garis))
    doc.setLineWidth(0.25)
    doc.line(M, H - 9, W - M, H - 9)
    teks('SS Shawarma Digital Hub  ·  Dokumen internal', M, H - 5, { size: 6.8, warna: rgb(WARNA.teksPudar) })
    teks(`Dicetak ${dicetak}`, W / 2, H - 5, { size: 6.8, warna: rgb(WARNA.teksPudar), align: 'center' })
    teks(`Halaman ${i} dari ${jumlah}`, W - M, H - 5, { size: 6.8, bold: true, warna: rgb(WARNA.primary), align: 'right' })
  }

  return doc
}

export async function buatPdfLaporan(data: PosExportReport, ctx: KonteksEkspor): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    muatGambar('/logo.png'),
  ])
  const doc = susunPdfLaporan(JsPDF, autoTable, data, ctx, logo)
  doc.save(namaBerkas(data, ctx, 'pdf'))
}
