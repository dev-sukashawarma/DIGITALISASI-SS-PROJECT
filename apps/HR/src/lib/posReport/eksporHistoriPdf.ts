/* ── Ekspor PDF Histori Transaksi Detail (Rangkuman Penjualan) ───────────────
 *
 * A4 Landscape (lebar konten 273 mm). Mengikuti bahasa visual eksporPdf.ts &
 * eksporStrukPdf.ts: kop berwarna primary, strip ringkasan metrik tabel, dan
 * tabel rincian transaksi sesuai seluruh filter aktif di Histori Transaksi Detail.
 */

import type { PosHistoryExportReport } from '@/lib/posReport/eksporHistori'
import {
  WARNA,
  angka,
  hexKeRgb,
  jumlahHari,
  rupiah,
  tanggalPendek,
  waktuCetak,
} from '@/lib/posReport/eksporUi'

type RGB = [number, number, number]
const rgb = (hex: string): RGB => hexKeRgb(hex)
const PUTIH: RGB = [255, 255, 255]

const W = 297
const H = 210
const M = 12
const LK = W - 2 * M // 273 mm
const ATAS_LANJUTAN = 19
const BAWAH = 14

export interface KonteksEksporHistori {
  cabang: string
  channel: string
  paymentLabel: string
  receiptLabel: string
  search: string
  multiOutlet: boolean
}

function aman(s: unknown): string {
  return String(s ?? '')
    .replace(/[–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
    .trim()
}

function formatWibDateTimePdf(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    const tgl = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
    const jam = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    return `${tgl}, ${jam.replace(/\./g, ':')} WIB`
  } catch {
    return isoStr
  }
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

export function namaBerkasHistori(data: PosHistoryExportReport, ctx: KonteksEksporHistori): string {
  const cabang =
    ctx.cabang === 'Semua Cabang'
      ? 'Semua_Cabang'
      : ctx.cabang.includes(',')
        ? `${ctx.cabang.split(',').length}_Cabang`
        : ctx.cabang
  const cabangAman = cabang.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Cabang'
  const { from, to } = data.periode
  return `Histori_Transaksi_${cabangAman}_${from === to ? from : `${from}_sd_${to}`}.pdf`
}

export function susunPdfHistoriTransaksi(
  JsPDF: any,
  autoTable: any,
  data: PosHistoryExportReport,
  ctx: KonteksEksporHistori,
  logo: HTMLImageElement | null = null
) {
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', compress: true, format: 'a4' })
  const { from, to } = data.periode
  const hari = jumlahHari(from, to)
  const periodeStr = aman(
    `${from === to ? tanggalPendek(from) : `${tanggalPendek(from)} - ${tanggalPendek(to)}`} (${hari} hari)`
  )
  const cabangStr = aman(ctx.cabang)
  const dicetak = waktuCetak()
  const f = data.footer

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
    let isi = aman(s).replace(/\n+/g, ' ')
    if (o.maxW && doc.getTextWidth(isi) > o.maxW) {
      while (isi.length > 1 && doc.getTextWidth(`${isi}...`) > o.maxW) isi = isi.slice(0, -1)
      isi = `${isi.trimEnd()}...`
    }
    doc.text(isi, x, y, { align: o.align ?? 'left' })
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
  teks('HISTORI TRANSAKSI DETAIL', xJudul, 14.2, { size: 18, bold: true, warna: PUTIH })
  teks('SS Shawarma  |  Rangkuman Penjualan & Rincian Pesanan Selesai', xJudul, 20.8, {
    size: 8.8,
    warna: [251, 227, 208],
    maxW: 145,
  })

  const filterBayarStruk = data.isSSOnlineSelected
    ? ctx.channel
    : `${ctx.channel} | ${ctx.paymentLabel} | ${ctx.receiptLabel}`
  const meta: [string, string][] = [
    ['Periode', periodeStr],
    ['Cabang', cabangStr],
    ['Filter', aman(ctx.search ? `${filterBayarStruk} | Cari: "${ctx.search}"` : filterBayarStruk)],
    ['Dicetak', dicetak],
  ]
  const xLabel = W - M - 102
  meta.forEach(([label, nilai], i) => {
    const y = 8.6 + i * 5
    teks(label, xLabel, y, { size: 7.1, warna: [245, 201, 166] })
    teks(nilai, xLabel + 16, y, { size: 7.5, bold: true, warna: PUTIH, maxW: 86 })
  })

  // ── Strip Ringkasan ──
  const totalPotonganTabel = data.isSSOnlineSelected
    ? f.totalEcommerceDiscount + f.totalOfflineDiscount
    : f.totalOfflineDiscount + f.totalAppSubsidy

  const yS = 36
  const stripItems: [string, string, string][] = [
    [
      'TRANSAKSI TERFILTER',
      `${angka(data.totalMatching)} transaksi (${angka(f.totalItems)} item)`,
      WARNA.primary,
    ],
    ['TOTAL HARGA KOTOR', rupiah(f.totalGross), WARNA.gross],
    [
      data.isSSOnlineSelected ? 'DISKON & BIAYA PLATFORM' : 'POTONGAN & DISKON PROMO',
      totalPotonganTabel > 0 ? `- ${rupiah(totalPotonganTabel)}` : rupiah(0),
      WARNA.potongan,
    ],
    ['TOTAL TRANSAKSI (NET)', rupiah(f.totalNet), WARNA.gp],
  ]
  const lebarS = (LK - 3 * 3) / 4
  stripItems.forEach(([label, nilai, warna], i) => {
    const x = M + i * (lebarS + 3)
    doc.setFillColor(...rgb(WARNA.krem))
    doc.setDrawColor(...rgb(WARNA.garis))
    doc.setLineWidth(0.2)
    doc.roundedRect(x, yS, lebarS, 13.5, 1.5, 1.5, 'FD')
    doc.setFillColor(...rgb(warna))
    doc.rect(x, yS + 2.2, 1.1, 9.1, 'F')
    teks(label, x + 3.8, yS + 5.1, { size: 6.2, bold: true, warna: rgb(WARNA.teksPudar) })
    teks(nilai, x + 3.8, yS + 10.6, {
      size: 9.6,
      bold: true,
      warna: rgb(warna),
      maxW: lebarS - 6,
    })
  })

  // ── Judul Tabel ──
  const yJudul = 56.5
  doc.setFillColor(...rgb(WARNA.oranye))
  doc.rect(M, yJudul - 3.7, 1.4, 4.8, 'F')
  const judulTabel = data.truncated
    ? `Daftar Transaksi (${angka(data.rows.length)} terbaru dari ${angka(data.totalMatching)} transaksi)`
    : `Daftar Transaksi (${angka(data.rows.length)} transaksi | Zona Waktu WIB)`
  teks(judulTabel, M + 3.6, yJudul, { size: 10.2, bold: true, warna: rgb(WARNA.primary) })
  if (data.truncated) {
    teks('Persempit filter cabang/tanggal/pencarian untuk melihat seluruh baris', W - M, yJudul, {
      size: 7.1,
      warna: rgb(WARNA.merah),
      align: 'right',
    })
  }

  const head = data.isSSOnlineSelected
    ? [['No', 'No. Antrian', 'Waktu (WIB)', 'Pelanggan', 'Nama Item', 'Sumber', 'Total Transaksi']]
    : [
        [
          'No',
          'No. Antrian',
          'Waktu (WIB)',
          'Pelanggan / Kasir',
          'Nama Item',
          'Paket / Combo',
          'Sumber',
          'Bayar',
          'Total Transaksi',
        ],
      ]

  const body = data.rows.map((row, idx) => {
    const antrianLines = [row.orderNumberLabel]
    if (row.promoBadges.length > 0) antrianLines.push(row.promoBadges.join(', '))
    if (row.receiptNote) antrianLines.push(row.receiptNote)

    const waktuStr = formatWibDateTimePdf(row.createdAt)
    const waktuCell =
      ctx.multiOutlet && row.outletName ? `${waktuStr}\n[${row.outletName}]` : waktuStr

    const totalLines: string[] = []
    if (row.originalAmount !== null) {
      totalLines.push(`Awal: ${rupiah(row.originalAmount)}`)
    }
    totalLines.push(rupiah(row.totalAmount))
    if (row.deductionNotes.length > 0) {
      totalLines.push(...row.deductionNotes.map((n) => `(${n})`))
    }

    if (data.isSSOnlineSelected) {
      return [
        idx + 1,
        aman(antrianLines.join('\n')),
        aman(waktuCell),
        aman(row.customerName || '-'),
        aman(row.itemsText),
        aman(row.sourceLabel),
        aman(totalLines.join('\n')),
      ]
    }

    const pelangganLines = [row.customerName || '-']
    if (row.cashierName) pelangganLines.push(`Kasir: ${row.cashierName}`)

    return [
      idx + 1,
      aman(antrianLines.join('\n')),
      aman(waktuCell),
      aman(pelangganLines.join('\n')),
      aman(row.itemsText),
      aman(row.packagesText),
      aman(row.sourceLabel),
      aman(row.paymentMethod),
      aman(totalLines.join('\n')),
    ]
  })

  const buildFooterRows = () => {
    const rows: any[] = []
    if (data.isSSOnlineSelected) {
      rows.push([
        { content: 'TOTAL HARGA KOTOR', colSpan: 5, styles: { halign: 'right' } },
        { content: `${angka(f.totalItems)} Item`, styles: { halign: 'left' } },
        { content: rupiah(f.totalGross), styles: { halign: 'right' } },
      ])
      if (f.totalEcommerceDiscount > 0) {
        rows.push([
          {
            content: 'POTONGAN PROMO / DISKON PRODUK',
            colSpan: 6,
            styles: { halign: 'right', textColor: rgb(WARNA.merah) },
          },
          {
            content: `- ${rupiah(f.totalEcommerceDiscount)}`,
            styles: { halign: 'right', textColor: rgb(WARNA.merah) },
          },
        ])
      }
      if (f.totalOfflineDiscount > 0) {
        rows.push([
          {
            content: 'BIAYA ADMIN & KOMISI PLATFORM',
            colSpan: 6,
            styles: { halign: 'right', textColor: rgb(WARNA.kuning) },
          },
          {
            content: `- ${rupiah(f.totalOfflineDiscount)}`,
            styles: { halign: 'right', textColor: rgb(WARNA.kuning) },
          },
        ])
      }
      rows.push([
        { content: 'TOTAL TRANSAKSI (NET)', colSpan: 5, styles: { halign: 'right' } },
        { content: `${angka(data.totalMatching)} Transaksi`, styles: { halign: 'left' } },
        { content: rupiah(f.totalNet), styles: { halign: 'right', textColor: rgb(WARNA.hijau) } },
      ])
      return rows
    }

    rows.push([
      { content: 'TOTAL HARGA KOTOR', colSpan: 6, styles: { halign: 'right' } },
      { content: `${angka(f.totalItems)} Item`, colSpan: 2, styles: { halign: 'center' } },
      { content: rupiah(f.totalGross), styles: { halign: 'right' } },
    ])
    if (f.totalOfflineDiscount > 0) {
      rows.push([
        {
          content: 'POTONGAN DISKON PROMO OFFLINE',
          colSpan: 8,
          styles: { halign: 'right', textColor: rgb(WARNA.merah) },
        },
        {
          content: `- ${rupiah(f.totalOfflineDiscount)}`,
          styles: { halign: 'right', textColor: rgb(WARNA.merah) },
        },
      ])
    }
    if (f.totalAppSubsidy > 0) {
      rows.push([
        {
          content: 'TOTAL DISKON PROMO FOOD APPS (KASIR)',
          colSpan: 8,
          styles: { halign: 'right', textColor: rgb(WARNA.kuning) },
        },
        {
          content: `- ${rupiah(f.totalAppSubsidy)}`,
          styles: { halign: 'right', textColor: rgb(WARNA.kuning) },
        },
      ])
    }
    rows.push([
      { content: 'TOTAL TRANSAKSI (NET)', colSpan: 6, styles: { halign: 'right' } },
      { content: `${angka(data.totalMatching)} Trx`, colSpan: 2, styles: { halign: 'center' } },
      { content: rupiah(f.totalNet), styles: { halign: 'right', textColor: rgb(WARNA.hijau) } },
    ])
    return rows
  }

  // Lebar kolom presisi 273 mm (= LK)
  const columnStyles = data.isSSOnlineSelected
    ? {
        0: { cellWidth: 9, halign: 'center', textColor: rgb(WARNA.teksPudar) },
        1: { cellWidth: 26, halign: 'left', fontStyle: 'bold', fontSize: 6.9 },
        2: { cellWidth: 32, halign: 'left', fontSize: 6.9 },
        3: { cellWidth: 32, halign: 'left', fontSize: 7 },
        4: { cellWidth: 104, halign: 'left', fontSize: 7 },
        5: { cellWidth: 32, halign: 'left', fontSize: 7 },
        6: { cellWidth: 38, halign: 'right', fontStyle: 'bold', fontSize: 7.2 },
      }
    : {
        0: { cellWidth: 9, halign: 'center', textColor: rgb(WARNA.teksPudar) },
        1: { cellWidth: 25, halign: 'left', fontStyle: 'bold', fontSize: 6.7 },
        2: { cellWidth: 29, halign: 'left', fontSize: 6.7 },
        3: { cellWidth: 30, halign: 'left', fontSize: 6.8 },
        4: { cellWidth: 66, halign: 'left', fontSize: 6.9 },
        5: { cellWidth: 38, halign: 'left', fontSize: 6.7 },
        6: { cellWidth: 24, halign: 'left', fontSize: 6.8 },
        7: { cellWidth: 18, halign: 'center', fontStyle: 'bold', fontSize: 6.8 },
        8: { cellWidth: 34, halign: 'right', fontStyle: 'bold', fontSize: 7.1 },
      }

  const lastColIdx = data.isSSOnlineSelected ? 6 : 8

  autoTable(doc, {
    theme: 'plain',
    startY: 59.5,
    tableWidth: LK,
    margin: { left: M, right: M, top: ATAS_LANJUTAN, bottom: BAWAH },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      textColor: rgb(WARNA.teks),
      valign: 'middle',
      overflow: 'linebreak',
      cellPadding: { top: 1.7, bottom: 1.7, left: 1.6, right: 1.6 },
      lineColor: rgb(WARNA.garis),
      lineWidth: { bottom: 0.15 },
    },
    headStyles: {
      fillColor: rgb(WARNA.primary),
      textColor: PUTIH,
      fontStyle: 'bold',
      fontSize: 7.1,
      halign: 'left',
      lineWidth: 0,
    },
    footStyles: {
      fillColor: rgb(WARNA.kremTua),
      textColor: rgb(WARNA.primary),
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: { top: 0.3 },
      lineColor: rgb(WARNA.primary),
    },
    alternateRowStyles: { fillColor: rgb(WARNA.krem) },
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    head,
    body,
    foot: buildFooterRows(),
    columnStyles,
    didParseCell: (c: any) => {
      if (c.section === 'head') {
        if (c.column.index === 0 || (!data.isSSOnlineSelected && c.column.index === 7)) {
          c.cell.styles.halign = 'center'
        } else if (c.column.index === lastColIdx) {
          c.cell.styles.halign = 'right'
        } else {
          c.cell.styles.halign = 'left'
        }
      }
      if (c.section === 'body' && c.column.index === 1) {
        const row = data.rows[c.row.index]
        if (row?.hasSkippedReceipt) {
          c.cell.styles.textColor = rgb(WARNA.merah)
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
      teks('HISTORI TRANSAKSI DETAIL  |  SS SHAWARMA', M, 7.8, {
        size: 8.6,
        bold: true,
        warna: PUTIH,
      })
      teks(`${periodeStr}   |   ${cabangStr}`, W - M, 7.8, {
        size: 7.4,
        warna: [245, 201, 166],
        align: 'right',
        maxW: 155,
      })
    }
    doc.setDrawColor(...rgb(WARNA.garis))
    doc.setLineWidth(0.25)
    doc.line(M, H - 9, W - M, H - 9)
    teks('SS Shawarma Digital Hub  |  Rangkuman Penjualan', M, H - 5, {
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

export async function buatPdfHistoriTransaksi(
  data: PosHistoryExportReport,
  ctx: KonteksEksporHistori
): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    muatGambar('/logo.png'),
  ])
  const doc = susunPdfHistoriTransaksi(JsPDF, autoTable, data, ctx, logo)
  doc.save(namaBerkasHistori(data, ctx))
}
