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

  // Format A4 Landscape for financial journals/tables
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  const primaryColor = [112, 22, 4]   // Suka Maroon #701604
  const darkInk = [30, 41, 59]        // Slate 800
  const lightGray = [248, 250, 252]   // Slate 50
  const borderGray = [226, 232, 240]  // Slate 200

  // 1. Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 297, 24, 'F')

  // Logo Brand
  try {
    doc.addImage(LOGO_BASE64, 'PNG', 14, 2, 20, 20)
  } catch (e) {
    console.error('Failed to add logo to OPEX PDF:', e)
  }

  // Header Title
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('SUKASHAWARMA INDONESIA', 38, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('KANTOR PUSAT & HEAD OFFICE - DIVISI KEUANGAN & ACCOUNTING', 38, 17)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('LAPORAN PENGELUARAN OPERASIONAL (OPEX)', 283, 11, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('DOKUMEN RESMI PENGELUARAN KAS & BANK', 283, 17, { align: 'right' })

  // 2. Metadata Box
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.roundedRect(14, 28, 269, 16, 2, 2, 'FD')

  doc.setTextColor(darkInk[0], darkInk[1], darkInk[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Periode: ${startDate} s/d ${endDate}`, 20, 36)
  doc.setFont('helvetica', 'normal')
  doc.text(`Unit / Target: ${targetLabel}`, 20, 41)

  doc.setFont('helvetica', 'normal')
  doc.text(`Total Transaksi: ${items.length} catatan`, 150, 36)
  doc.setFont('helvetica', 'bold')
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, 150, 41)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text(`Total OPEX: ${rupiah(totalAmount)}`, 277, 38, { align: 'right' })

  // 3. Table of Transactions
  const headers = [
    'No',
    'Tanggal',
    'Unit / Cabang',
    'Pemohon',
    'Divisi',
    'Kategori OPEX',
    'Keterangan / Uraian',
    'Bukti Nota',
    'Nominal (Rp)'
  ]

  const rows = items.map((r, idx) => [
    idx + 1,
    r.date,
    r.outlet_name || '-',
    r.recipient_name || '-',
    r.division || '-',
    r.category_label || r.category,
    r.description || '-',
    r.receipt_url ? 'Ada Bukti' : '-',
    rupiah(r.amount)
  ])

  // Summary row at the bottom
  const summaryRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    rupiah(totalAmount)
  ]

  autoTable(doc, {
    startY: 48,
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
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 26 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 34 },
      6: { cellWidth: 70 },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 37, halign: 'right', fontStyle: 'bold' }
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
    margin: { left: 24, right: 24 },
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
      fontSize: 9,
      halign: 'center',
      cellPadding: 1
    },
    columnStyles: {
      0: { halign: 'center' },
      1: { halign: 'center' },
      2: { halign: 'center' }
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
      `Halaman ${i} dari ${pageCount} — Dokumen Laporan Resmi Pengeluaran OPEX PT Suka Shawarma Indonesia`,
      doc.internal.pageSize.width / 2,
      pageHeight - 6,
      { align: 'center' }
    )
  }

  // 6. Save PDF
  const defaultFilename = `Laporan_OPEX_${startDate}_sampai_${endDate}.pdf`
  doc.save(filename || defaultFilename)
}
