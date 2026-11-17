import { LOGO_BASE64 } from '@/utils/logoBase64'
import { rupiah } from '@/lib/format'

export interface OpexPdfItem {
  id?: string
  date: string
  outlet_name: string
  recipient_name?: string | null
  division?: string | null
  category: string
  category_label?: string
  description?: string
  amount: number
  receipt_url?: string | null
}

export interface OpexPdfOptions {
  startDate: string
  endDate: string
  targetLabel: string
  items: OpexPdfItem[]
  totalAmount: number
  filename?: string
  /** Pengeluaran ditanggung RAB pada filter yang sama: dicetak sebagai catatan, TIDAK masuk total. */
  catatanRab?: { total: number; jumlahTransaksi: number }
}

const MAX_RECEIPT_IMAGE_PX = 1200
const RECEIPT_FETCH_TIMEOUT_MS = 12000
const RECEIPT_LOAD_CONCURRENCY = 5

export function parseReceiptUrls(raw: string | null | undefined): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      }
    } catch {
      // Fallback ke single URL bila bukan JSON valid
    }
  }
  return [trimmed]
}

export function isPdfUrl(url: string): boolean {
  const clean = url.split('?')[0].split('#')[0].trim().toLowerCase()
  return clean.endsWith('.pdf')
}

export function fitImageDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return { width: maxWidth, height: maxHeight }
  }
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight)
  return {
    width: srcWidth * ratio,
    height: srcHeight * ratio
  }
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`
}

type LoadedReceipt =
  | { kind: 'image'; url: string; dataUrl: string; width: number; height: number }
  | { kind: 'pdf'; url: string }
  | { kind: 'error'; url: string }

async function loadReceiptAsset(url: string): Promise<LoadedReceipt> {
  if (isPdfUrl(url)) {
    return { kind: 'pdf', url }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RECEIPT_FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, { mode: 'cors', signal: controller.signal })
    if (!res.ok) return { kind: 'error', url }

    const contentType = res.headers.get('content-type')?.toLowerCase() || ''
    if (contentType.includes('application/pdf')) {
      return { kind: 'pdf', url }
    }

    const blob = await res.blob()
    if (blob.type.toLowerCase().includes('pdf')) {
      return { kind: 'pdf', url }
    }

    const objectUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Image decode failed'))
        el.src = objectUrl
      })

      const natW = img.naturalWidth || img.width
      const natH = img.naturalHeight || img.height
      if (natW <= 0 || natH <= 0) return { kind: 'error', url }

      const scale = Math.min(1, MAX_RECEIPT_IMAGE_PX / Math.max(natW, natH))
      const targetW = Math.max(1, Math.round(natW * scale))
      const targetH = Math.max(1, Math.round(natH * scale))

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) return { kind: 'error', url }

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.drawImage(img, 0, 0, targetW, targetH)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      return { kind: 'image', url, dataUrl, width: targetW, height: targetH }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return { kind: 'error', url }
  } finally {
    clearTimeout(timer)
  }
}

async function loadReceiptsInBatches<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIdx = 0

  async function worker() {
    while (nextIdx < tasks.length) {
      const current = nextIdx++
      results[current] = await tasks[current]()
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function generateOpexReportPDF(options: OpexPdfOptions): Promise<void> {
  const { startDate, endDate, targetLabel, items, totalAmount, filename, catatanRab } = options
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  // Format A4 Portrait sesuai permintaan
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const primaryColor = [112, 22, 4]   // Suka Maroon #701604
  const darkInk = [30, 41, 59]        // Slate 800
  const lightGray = [248, 250, 252]   // Slate 50
  const borderGray = [226, 232, 240]  // Slate 200

  // 1. Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 210, 24, 'F')

  // Logo Brand - Rasio aspek dipertahankan (799 x 1024) agar tidak gepeng
  try {
    const logoHeight = 18
    const logoWidth = logoHeight * (799 / 1024) // ~14.04 mm
    doc.addImage(LOGO_BASE64, 'PNG', 14, 3, logoWidth, logoHeight)
  } catch (e) {
    console.error('Failed to add logo to OPEX PDF:', e)
  }

  // Header Title - SUKA SHAWARMA
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('SUKA SHAWARMA', 32, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('KANTOR PUSAT & HEAD OFFICE - DIVISI KEUANGAN', 32, 16.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('LAPORAN PENGELUARAN (OPEX)', 196, 13.5, { align: 'right' })

  // 2. Metadata Box (Bersihkan icon/emoji agar tidak corrupt di jsPDF)
  const cleanTarget = (targetLabel || 'Semua Outlet')
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim() || 'Semua Outlet'

  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.roundedRect(14, 27, 182, 15, 2, 2, 'FD')

  doc.setTextColor(darkInk[0], darkInk[1], darkInk[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`Periode: ${startDate} s/d ${endDate}`, 18, 33)
  doc.setFont('helvetica', 'normal')
  doc.text(`Filter: ${cleanTarget}`, 18, 38.5)

  doc.text(`Total Transaksi: ${items.length} catatan`, 100, 33)
  const printDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  doc.text(`Dicetak: ${printDate}`, 100, 38.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Total OPEX:', 192, 32.5, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text(rupiah(totalAmount), 192, 38.5, { align: 'right' })

  // 3. Table of Transactions (Tanpa Pemohon, Divisi, dan Bukti Nota)
  const headers = [
    'No',
    'Tanggal',
    'Outlet',
    'Kategori OPEX',
    'Keterangan / Uraian',
    'Nominal (Rp)'
  ]

  // Sort items berdasarkan outlet (Kantor Pusat di awal, lalu cabang A-Z, dan tanggal kronologis)
  const sortedItems = [...items].sort((a, b) => {
    const nameA = (a.outlet_name || '-').trim()
    const nameB = (b.outlet_name || '-').trim()

    const lowerA = nameA.toLowerCase()
    const lowerB = nameB.toLowerCase()
    const isPusatA = lowerA.includes('head office') || lowerA.includes('kantor pusat') || lowerA === 'pusat'
    const isPusatB = lowerB.includes('head office') || lowerB.includes('kantor pusat') || lowerB === 'pusat'

    if (isPusatA && !isPusatB) return -1
    if (!isPusatA && isPusatB) return 1

    const cmp = nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
    if (cmp !== 0) return cmp

    return a.date.localeCompare(b.date)
  })

  const rows = sortedItems.map((r, idx) => [
    idx + 1,
    r.date,
    r.outlet_name || '-',
    r.category_label || r.category,
    r.description || '-',
    rupiah(r.amount)
  ])

  // Summary row at the bottom (Merge kolom 0-4 / colSpan: 5)
  const summaryRow: any = [
    {
      content: 'TOTAL',
      colSpan: 5,
      styles: { halign: 'right', fontStyle: 'bold' }
    },
    {
      content: rupiah(totalAmount),
      styles: { halign: 'right', fontStyle: 'bold' }
    }
  ]

  autoTable(doc, {
    startY: 45,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [headers],
    body: [...rows, summaryRow],
    headStyles: {
      fillColor: primaryColor as [number, number, number],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      textColor: darkInk as [number, number, number],
      fontSize: 7.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 34 },
      3: { cellWidth: 32 },
      4: { cellWidth: 52 },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Highlight total row
      if (data.row.index === rows.length) {
        data.cell.styles.fillColor = [254, 243, 199] // Amber 100
        data.cell.styles.textColor = primaryColor as [number, number, number]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 8.5
      }
    }
  })

  // 4. Signatures Section (Admin Hesti, Finance Nadya, Direktur F&A Alby)
  const pageHeight = doc.internal.pageSize.height
  let finalY = (doc as any).lastAutoTable?.finalY || 100
  const signatureBlockHeight = 44

  if (catatanRab && catatanRab.jumlahTransaksi > 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(3, 105, 161)
    doc.text(
      `Catatan: ${catatanRab.jumlahTransaksi} pengeluaran senilai ${rupiah(catatanRab.total)} ditanggung RAB (dana investasi) dan tidak dihitung dalam total OPEX di atas.`,
      18,
      finalY + 6,
      { maxWidth: 174 }
    )
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    finalY += 8
  }

  let signStartY = finalY + 8
  if (signStartY + signatureBlockHeight > pageHeight - 16) {
    doc.addPage()
    signStartY = 20
  }

  autoTable(doc, {
    startY: signStartY,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    head: [['Dibuat Oleh,', 'Diperiksa Oleh,', 'Disetujui Oleh,']],
    body: [
      ['Admin', 'Finance', 'Direktur F&A'],
      [
        '\n\n\n\n__________________________\n( Hesti )',
        '\n\n\n\n__________________________\n( Nadya )',
        '\n\n\n\n__________________________\n( Alby )'
      ]
    ],
    headStyles: {
      textColor: [71, 85, 105],
      fontStyle: 'normal',
      fontSize: 8.5,
      halign: 'center'
    },
    bodyStyles: {
      textColor: darkInk as [number, number, number],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 1
    },
    columnStyles: {
      0: { cellWidth: 60, halign: 'center' },
      1: { cellWidth: 62, halign: 'center' },
      2: { cellWidth: 60, halign: 'center' }
    }
  })

  // 5. Lampiran Bukti Nota / Struk (jika ada transaksi yang memiliki receipt_url)
  interface ReceiptEntry {
    rowNo: number
    item: OpexPdfItem
    url: string
    notaIndex: number
    notaTotal: number
  }

  const receiptEntries: ReceiptEntry[] = []
  sortedItems.forEach((item, idx) => {
    const urls = parseReceiptUrls(item.receipt_url)
    urls.forEach((url, notaIdx) => {
      receiptEntries.push({
        rowNo: idx + 1,
        item,
        url,
        notaIndex: notaIdx + 1,
        notaTotal: urls.length
      })
    })
  })

  if (receiptEntries.length > 0) {
    const loadedReceipts = await loadReceiptsInBatches(
      receiptEntries.map(entry => () => loadReceiptAsset(entry.url)),
      RECEIPT_LOAD_CONCURRENCY
    )

    const marginX = 14
    const colGap = 6
    const rowGap = 6
    const cardWidth = (210 - marginX * 2 - colGap) / 2 // 88 mm
    const cardHeight = 112
    const headerHeight = 22
    const imgPadding = 2.5
    const imgBoxW = cardWidth - imgPadding * 2
    const imgBoxH = cardHeight - headerHeight - imgPadding * 2

    const drawAppendixHeader = (isContinuation: boolean) => {
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.rect(0, 0, 210, 14, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(
        isContinuation
          ? 'LAMPIRAN BUKTI NOTA / STRUK (LANJUTAN)'
          : `LAMPIRAN BUKTI NOTA / STRUK (${receiptEntries.length} Lampiran)`,
        marginX,
        9.2
      )
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(`${startDate} s/d ${endDate} | ${cleanTarget}`, 196, 9.2, { align: 'right' })
    }

    doc.addPage()
    drawAppendixHeader(false)

    let cursorX = marginX
    let cursorY = 19
    let col = 0

    receiptEntries.forEach((entry, i) => {
      if (cursorY + cardHeight > pageHeight - 13) {
        doc.addPage()
        drawAppendixHeader(true)
        cursorX = marginX
        cursorY = 19
        col = 0
      }

      const x = cursorX
      const y = cursorY

      // Card container
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD')

      // Card header strip
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
      doc.roundedRect(x, y, cardWidth, headerHeight, 2, 2, 'F')
      doc.rect(x, y + headerHeight - 2, cardWidth, 2, 'F')
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
      doc.line(x, y + headerHeight, x + cardWidth, y + headerHeight)

      // Header line 1: No. & Tanggal + Nominal
      const notaSuffix = entry.notaTotal > 1 ? ` (Nota ${entry.notaIndex}/${entry.notaTotal})` : ''
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text(`No. ${entry.rowNo} — ${entry.item.date}${notaSuffix}`, x + 3, y + 6)

      doc.setTextColor(darkInk[0], darkInk[1], darkInk[2])
      doc.text(rupiah(entry.item.amount), x + cardWidth - 3, y + 6, { align: 'right' })

      // Header line 2: Outlet & Kategori
      const outletStr = truncateText(sanitizePdfText(entry.item.outlet_name || '-'), 24)
      const catStr = truncateText(sanitizePdfText(entry.item.category_label || entry.item.category || '-'), 22)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(51, 65, 85)
      doc.text(`${outletStr} | ${catStr}`, x + 3, y + 12)

      // Header line 3: Deskripsi
      const descStr = truncateText(sanitizePdfText(entry.item.description || '-'), 48)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      doc.setTextColor(100, 116, 139)
      doc.text(descStr || '-', x + 3, y + 17.5)

      // Receipt image / fallback area
      const boxX = x + imgPadding
      const boxY = y + headerHeight + imgPadding
      const asset = loadedReceipts[i]

      if (asset?.kind === 'image') {
        const fitted = fitImageDimensions(asset.width, asset.height, imgBoxW, imgBoxH)
        const drawX = boxX + (imgBoxW - fitted.width) / 2
        const drawY = boxY + (imgBoxH - fitted.height) / 2
        try {
          doc.addImage(asset.dataUrl, 'JPEG', drawX, drawY, fitted.width, fitted.height)
        } catch {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(7.5)
          doc.setTextColor(148, 163, 184)
          doc.text('Gambar nota tidak dapat dirender', x + cardWidth / 2, boxY + imgBoxH / 2, {
            align: 'center'
          })
        }
      } else {
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(boxX + 6, boxY + imgBoxH / 2 - 12, imgBoxW - 12, 24, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(71, 85, 105)
        doc.text(
          asset?.kind === 'pdf' ? 'Lampiran Nota Berformat PDF' : 'Gambar Nota Tidak Dapat Dimuat',
          x + cardWidth / 2,
          boxY + imgBoxH / 2 - 2,
          { align: 'center' }
        )
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(37, 99, 235)
        doc.textWithLink('Buka Lampiran Nota', x + cardWidth / 2 - 12, boxY + imgBoxH / 2 + 5, {
          url: entry.url
        })
      }

      if (col === 0) {
        col = 1
        cursorX = marginX + cardWidth + colGap
      } else {
        col = 0
        cursorX = marginX
        cursorY += cardHeight + rowGap
      }
    })
  }

  // 6. Page Numbers on Every Page
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Halaman ${i} dari ${pageCount} — Dokumen Laporan Resmi Pengeluaran OPEX Suka Shawarma`,
      doc.internal.pageSize.width / 2,
      pageHeight - 6,
      { align: 'center' }
    )
  }

  // 7. Save PDF
  const defaultFilename = `Laporan_OPEX_${startDate}_sampai_${endDate}.pdf`
  doc.save(filename || defaultFilename)
}
