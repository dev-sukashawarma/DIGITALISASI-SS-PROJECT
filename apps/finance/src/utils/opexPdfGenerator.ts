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
}

export async function generateOpexReportPDF(options: OpexPdfOptions): Promise<void> {
  const { startDate, endDate, targetLabel, items, totalAmount, filename } = options
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
  doc.setFontSize(10.5)
  doc.text('LAPORAN PENGELUARAN (OPEX)', 196, 11, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('DOKUMEN RESMI KAS & BANK', 196, 16.5, { align: 'right' })

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
  doc.text(`Outlet: ${cleanTarget}`, 18, 38.5)

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

  const rows = items.map((r, idx) => [
    idx + 1,
    r.date,
    r.outlet_name || '-',
    r.category_label || r.category,
    r.description || '-',
    rupiah(r.amount)
  ])

  // Summary row at the bottom
  const summaryRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    rupiah(totalAmount)
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
  const finalY = (doc as any).lastAutoTable?.finalY || 100
  const signatureBlockHeight = 44

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

  // 5. Page Numbers on Every Page
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

  // 6. Save PDF
  const defaultFilename = `Laporan_OPEX_${startDate}_sampai_${endDate}.pdf`
  doc.save(filename || defaultFilename)
}
