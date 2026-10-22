/* ── Ekspor PDF Rekap & Audit Cetak Struk POS ─────────────────────────────────
 *
 * A4 Landscape. Hanya mengekspor Tabel Rekap Kasir yang Tidak Cetak Struk
 * sesuai filter yang sedang aktif di layar (tanpa tabel rincian orderan).
 * Lebar seluruh kolom dirancang presisi pas dengan lebar halaman (273 mm)
 * dan mendukung word-wrap sehingga tidak pernah terpotong.
 */

import {
  WARNA,
  angka,
  hexKeRgb,
  jumlahHari,
  tanggalPendek,
  waktuCetak,
} from '@/lib/posReport/eksporUi'
import type { CashierStrukRecapRow } from '@/lib/posReport/rekapStruk'

type RGB = [number, number, number]
const rgb = (hex: string): RGB => hexKeRgb(hex)
const PUTIH: RGB = [255, 255, 255]

const W = 297
const H = 210
const M = 12
const LK = W - 2 * M // 273 mm
const ATAS_LANJUTAN = 19
const BAWAH = 14

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
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export interface RekapStrukPdfInput {
  periode: { from: string; to: string }
  cabangLabel: string
  amLabel: string
  channelLabel: string
  filterInfoLabel: string
  cashiers: CashierStrukRecapRow[]
}

export function susunPdfRekapStruk(
  JsPDF: any,
  autoTable: any,
  input: RekapStrukPdfInput,
  logo: HTMLImageElement | null = null
) {
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', compress: true, format: 'a4' })
  const { from, to } = input.periode
  const hari = jumlahHari(from, to)
  const periodeStr = aman(
    `${from === to ? tanggalPendek(from) : `${tanggalPendek(from)} - ${tanggalPendek(to)}`} (${hari} hari)`
  )
  const cabangStr = aman(input.cabangLabel)
  const amStr = aman(input.amLabel)
  const dicetak = waktuCetak()

  const teks = (
    s: unknown,
    x: number,
    y: number,
    o: {
      size?: number
      bold?: boolean
      warna?: RGB
      align?: 'left' | 'right' | 'center'
      maxW?: number
    } = {}
  ) => {
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

  const judulBagian = (judul: string, y: number, ket?: string) => {
    doc.setFillColor(...rgb(WARNA.oranye))
    doc.rect(M, y - 3.7, 1.4, 4.8, 'F')
    teks(judul, M + 3.6, y, { size: 10.5, bold: true, warna: rgb(WARNA.primary) })
    if (ket) teks(ket, W - M, y, { size: 7.3, warna: rgb(WARNA.teksPudar), align: 'right' })
    return y + 3
  }

  // ── Kop Halaman 1 ──
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
  teks('REKAP KASIR TIDAK CETAK STRUK', xJudul, 14.2, { size: 18, bold: true, warna: PUTIH })
  teks(
    `SS Shawarma  ·  ${aman(input.filterInfoLabel)}`,
    xJudul,
    20.8,
    { size: 8.8, warna: [251, 227, 208], maxW: 145 }
  )

  const meta: [string, string][] = [
    ['Periode', periodeStr],
    ['Cabang', cabangStr],
    ['Area Manager', amStr],
    ['Dicetak', dicetak],
  ]
  const xLabel = W - M - 102
  meta.forEach(([label, nilai], i) => {
    const y = 8.6 + i * 5
    teks(label, xLabel, y, { size: 7.1, warna: [245, 201, 166] })
    teks(nilai, xLabel + 19, y, { size: 7.6, bold: true, warna: PUTIH, maxW: 83 })
  })

  // Hitung total keseluruhan dari daftar kasir yang tidak cetak struk
  let sumTotalTrx = 0
  let sumPrinted = 0
  let sumNotPrinted = 0
  let sumCustSkip = 0
  let sumKitchenSkip = 0
  for (let i = 0; i < input.cashiers.length; i++) {
    const c = input.cashiers[i]
    sumTotalTrx += c.totalOrders
    sumPrinted += c.printedOrders
    sumNotPrinted += c.notPrintedOrders
    sumCustSkip += c.customerSkippedOrders
    sumKitchenSkip += c.kitchenSkippedOrders
  }
  const sumPrintedPct =
    sumTotalTrx > 0
      ? `${((sumPrinted / sumTotalTrx) * 100).toFixed(1).replace('.', ',')}%`
      : '0,0%'
  const sumNotPrintedPct =
    sumTotalTrx > 0
      ? `${((sumNotPrinted / sumTotalTrx) * 100).toFixed(1).replace('.', ',')}%`
      : '0,0%'

  // Strip Ringkasan di Atas Tabel
  const yS = 36
  const stripItems: [string, string][] = [
    ['KASIR TIDAK CETAK STRUK', `${angka(input.cashiers.length)} kasir`],
    ['TOTAL TRANSAKSI KASIR', `${angka(sumTotalTrx)} transaksi`],
    ['STRUK DICETAK', `${angka(sumPrinted)} transaksi (${sumPrintedPct})`],
    ['STRUK TIDAK DICETAK', `${angka(sumNotPrinted)} transaksi (${sumNotPrintedPct})`],
  ]
  const lebarS = (LK - 3 * 3) / 4
  stripItems.forEach(([label, nilai], i) => {
    const x = M + i * (lebarS + 3)
    doc.setFillColor(...rgb(WARNA.krem))
    doc.setDrawColor(...rgb(WARNA.garis))
    doc.setLineWidth(0.2)
    doc.roundedRect(x, yS, lebarS, 13.5, 1.5, 1.5, 'FD')
    doc.setFillColor(...rgb(i === 3 ? WARNA.merah : i === 2 ? WARNA.hijau : WARNA.primary))
    doc.rect(x, yS + 2.2, 1.1, 9.1, 'F')
    teks(label, x + 3.8, yS + 5.1, { size: 6.2, bold: true, warna: rgb(WARNA.teksPudar) })
    teks(nilai, x + 3.8, yS + 10.6, {
      size: 10,
      bold: true,
      warna: rgb(i === 3 ? WARNA.merah : i === 2 ? WARNA.hijau : WARNA.primary),
      maxW: lebarS - 6,
    })
  })

  // ── Tabel Rekap Cetak Struk per Kasir, Outlet & AM ──
  // Total lebar kolom = 10 + 48 + 52 + 35 + 24 + 24 + 24 + 32 + 24 = 273 mm (100% pas LK)
  const y = judulBagian(
    'Tabel Rekap Kasir Tidak Cetak Struk',
    56.5,
    '% Struk Dicetak = (Struk Dicetak / Total Transaksi) x 100%'
  )

  autoTable(doc, {
    theme: 'plain',
    startY: y,
    tableWidth: LK,
    margin: { left: M, right: M, top: ATAS_LANJUTAN, bottom: BAWAH },
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      textColor: rgb(WARNA.teks),
      valign: 'middle',
      overflow: 'linebreak',
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.2, right: 2.2 },
      lineColor: rgb(WARNA.garis),
      lineWidth: { bottom: 0.15 },
    },
    headStyles: {
      fillColor: rgb(WARNA.primary),
      textColor: PUTIH,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      lineWidth: 0,
    },
    footStyles: {
      fillColor: rgb(WARNA.kremTua),
      textColor: rgb(WARNA.primary),
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'right',
      lineWidth: { top: 0.35 },
      lineColor: rgb(WARNA.primary),
    },
    alternateRowStyles: { fillColor: rgb(WARNA.krem) },
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    head: [
      [
        'No',
        'Nama Kasir',
        'Outlet / Cabang',
        'Nama AM',
        'Total Transaksi',
        'Struk Dicetak',
        'Tidak Dicetak',
        'Rincian Tidak Cetak',
        '% Struk Dicetak',
      ],
    ],
    body: input.cashiers.map((c, idx) => [
      idx + 1,
      aman(c.cashierName),
      aman(c.outletName),
      aman(c.amName),
      angka(c.totalOrders),
      angka(c.printedOrders),
      angka(c.notPrintedOrders),
      `Cust: ${c.customerSkippedOrders}x | Dapur: ${c.kitchenSkippedOrders}x`,
      `${c.printedRate.toFixed(1).replace('.', ',')}%`,
    ]),
    foot: [
      [
        '',
        `TOTAL (${input.cashiers.length} KASIR)`,
        '',
        '',
        angka(sumTotalTrx),
        angka(sumPrinted),
        angka(sumNotPrinted),
        `Cust: ${sumCustSkip}x | Dapur: ${sumKitchenSkip}x`,
        sumPrintedPct,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: rgb(WARNA.teksPudar) },
      1: { cellWidth: 48, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 52, halign: 'left' },
      3: { cellWidth: 35, halign: 'left' },
      4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 24, halign: 'right', textColor: rgb(WARNA.hijau), fontStyle: 'bold' },
      6: { cellWidth: 24, halign: 'right', textColor: rgb(WARNA.merah), fontStyle: 'bold' },
      7: { cellWidth: 32, halign: 'left', fontSize: 7.2 },
      8: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (c: any) => {
      if (c.section === 'head') {
        if (c.column.index === 0) c.cell.styles.halign = 'center'
        else if ([4, 5, 6, 8].includes(c.column.index)) c.cell.styles.halign = 'right'
        else c.cell.styles.halign = 'left'
      }
      if (c.section === 'foot') {
        if (c.column.index === 1 || c.column.index === 7) c.cell.styles.halign = 'left'
      }
      if (c.section === 'body') {
        const row = input.cashiers[c.row.index]
        if (c.column.index === 8) {
          c.cell.styles.textColor = rgb(
            row.printedRate >= 90 ? WARNA.hijau : row.printedRate >= 70 ? WARNA.kuning : WARNA.merah
          )
        }
      }
    },
  })

  // ── Header Halaman Lanjutan & Footer Nomor Halaman ──
  const jumlah = doc.internal.getNumberOfPages()
  for (let i = 1; i <= jumlah; i++) {
    doc.setPage(i)
    if (i > 1) {
      doc.setFillColor(...rgb(WARNA.primary))
      doc.rect(0, 0, W, 12, 'F')
      doc.setFillColor(...rgb(WARNA.oranye))
      doc.rect(0, 12, W, 0.6, 'F')
      teks('REKAP KASIR TIDAK CETAK STRUK  ·  SS SHAWARMA', M, 7.8, {
        size: 8.6,
        bold: true,
        warna: PUTIH,
      })
      teks(`${periodeStr}   ·   ${cabangStr}`, W - M, 7.8, {
        size: 7.4,
        warna: [245, 201, 166],
        align: 'right',
        maxW: 155,
      })
    }
    doc.setDrawColor(...rgb(WARNA.garis))
    doc.setLineWidth(0.25)
    doc.line(M, H - 9, W - M, H - 9)
    teks('SS Shawarma Digital Hub  ·  Dokumen Audit Operasional POS', M, H - 5, {
      size: 6.8,
      warna: rgb(WARNA.teksPudar),
    })
    teks(`Dicetak ${dicetak}`, W / 2, H - 5, {
      size: 6.8,
      warna: rgb(WARNA.teksPudar),
      align: 'center',
    })
    teks(`Halaman ${i} dari ${jumlah}`, W - M, H - 5, {
      size: 6.8,
      bold: true,
      warna: rgb(WARNA.primary),
      align: 'right',
    })
  }

  return doc
}

export async function buatPdfRekapStruk(input: RekapStrukPdfInput): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    muatGambar('/logo.png'),
  ])
  const doc = susunPdfRekapStruk(JsPDF, autoTable, input, logo)
  const { from, to } = input.periode
  const cabangAman = input.cabangLabel
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32)
  const fileName = `Rekap_Cetak_Struk_${cabangAman || 'Semua_Cabang'}_${
    from === to ? from : `${from}_sd_${to}`
  }.pdf`
  doc.save(fileName)
}
