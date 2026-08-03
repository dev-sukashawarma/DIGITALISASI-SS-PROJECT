import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExecutiveReportData {
  outletName: string
  dateRangeLabel: string
  channelLabel: string
  grossRevenue: number
  totalOrders: number
  bestSellers: Array<{
    name: string
    channel?: string
    qty: number
    revenue: number
  }>
}

export interface CategorizedReportData {
  outletName: string
  dateRangeLabel: string
  categories: Array<{
    categoryName: string
    grossRevenue: number
    bestSellers: Array<{
      name: string
      qty: number
      revenue: number
    }>
  }>
}

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount)
}

export const generateExecutiveItemReportPDF = (data: ExecutiveReportData): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  let currentY = 14

  // ── Header / Kop Dokumen ──
  // Logo & Title Accent Bar
  doc.setFillColor(79, 70, 229) // Indigo-600
  doc.rect(margin, currentY, 4, 18, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 41, 59) // Slate-800
  doc.text('SS SHAWARMA', margin + 8, currentY + 6)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(79, 70, 229)
  doc.text('LAPORAN EKSEKUTIF - RINCIAN ITEM TERJUAL', margin + 8, currentY + 12)

  // Right-aligned Metadata Box
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139) // Slate-500
  
  const rightX = pageWidth - margin
  doc.text(`Cabang: ${data.outletName}`, rightX, currentY + 4, { align: 'right' })
  doc.text(`Periode: ${data.dateRangeLabel}`, rightX, currentY + 9, { align: 'right' })
  doc.text(`Channel: ${data.channelLabel}`, rightX, currentY + 14, { align: 'right' })
  doc.text(`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, rightX, currentY + 19, { align: 'right' })

  currentY += 24

  // Divider line
  doc.setDrawColor(226, 232, 240) // Slate-200
  doc.setLineWidth(0.5)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 6

  // ── Executive KPI Cards Summary ──
  const totalItemQty = data.bestSellers.reduce((acc, item) => acc + item.qty, 0)
  const cardWidth = (pageWidth - (margin * 2) - 8) / 3
  const cardHeight = 16

  const kpis = [
    { label: 'GROSS REVENUE', value: formatRupiah(data.grossRevenue), color: [245, 158, 11] }, // Amber-500
    { label: 'TOTAL ITEM TERJUAL', value: `${totalItemQty.toLocaleString('id-ID')} Pcs`, color: [16, 185, 129] }, // Emerald-500
    { label: 'TOTAL TRANSAKSI', value: `${data.totalOrders.toLocaleString('id-ID')} Pesanan`, color: [99, 102, 241] } // Indigo-500
  ]

  kpis.forEach((kpi, idx) => {
    const cardX = margin + (idx * (cardWidth + 4))

    // Card background
    doc.setFillColor(248, 250, 252) // Slate-50
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'F')

    // Top border accent
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2])
    doc.rect(cardX, currentY, cardWidth, 1.2, 'F')

    // KPI Content
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184) // Slate-400
    doc.text(kpi.label, cardX + 4, currentY + 5.5)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(kpi.value, cardX + 4, currentY + 12)
  })

  currentY += cardHeight + 8

  // ── Section Title ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text('Rincian Performa Penjualan Produk', margin, currentY)
  currentY += 4

  // ── Data Table (jspdf-autotable) ──
  const tableHead = [['#', 'Nama Menu / Item', 'Channel', 'Qty Terjual', 'Total Revenue (Rp)', '% Kontribusi Omzet']]
  
  const totalRevenue = data.grossRevenue > 0 ? data.grossRevenue : 1

  const tableBody = data.bestSellers.map((item, index) => {
    const contributionPct = ((item.revenue / totalRevenue) * 100).toFixed(1)
    return [
      (index + 1).toString(),
      item.name,
      data.channelLabel,
      `${item.qty} Pcs`,
      formatRupiah(item.revenue),
      `${contributionPct}%`
    ]
  })

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'striped',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85] // Slate-700
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'left' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  })

  // ── Footer ──
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(156, 163, 175) // Gray-400
    doc.text(
      `Dicetak pada: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`,
      105,
      287,
      { align: 'center' }
    )
  }

  // ── Simpan File ──
  const filename = `Laporan_Eksekutif_${data.outletName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

export const generateCategorizedReportPDF = (data: CategorizedReportData): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const margin = 15
  let currentY = 20

  // ── Kop / Header Laporan ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42) // Slate-900
  doc.text('LAPORAN RINCIAN ITEM TERJUAL (PER KATEGORI CHANNEL)', 105, currentY, { align: 'center' })
  
  currentY += 8
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105) // Slate-600
  doc.text(`Outlet: ${data.outletName}`, 105, currentY, { align: 'center' })
  currentY += 5
  doc.text(`Periode: ${data.dateRangeLabel}`, 105, currentY, { align: 'center' })
  currentY += 5
  doc.text(`Channel: Semua Channel`, 105, currentY, { align: 'center' })
  currentY += 10

  // ── Data Tables per Category ──
  data.categories.forEach((cat, idx) => {
    // Add space before next table (except the first one)
    if (idx > 0) {
      currentY = (doc as any).lastAutoTable.finalY + 15
      
      // If we are close to the bottom of the page, add a new page
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 41, 59)
    doc.text(`Kategori: ${cat.categoryName}`, margin, currentY)
    currentY += 4

    const tableHead = [['#', 'Nama Menu / Item', 'Qty Terjual', 'Total Revenue (Rp)', '% Kontribusi Kategori']]
    const totalRevenue = cat.grossRevenue > 0 ? cat.grossRevenue : 1

    const tableBody = cat.bestSellers.map((item, index) => {
      const contributionPct = ((item.revenue / totalRevenue) * 100).toFixed(1)
      return [
        (index + 1).toString(),
        item.name,
        `${item.qty} Pcs`,
        formatRupiah(item.revenue),
        `${contributionPct}%`
      ]
    })

    autoTable(doc, {
      startY: currentY,
      head: tableHead,
      body: tableBody,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [30, 41, 59], // Slate-800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85] // Slate-700
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    })
  })

  // ── Footer ──
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(156, 163, 175) // Gray-400
    doc.text(
      `Dicetak pada: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`,
      105,
      287,
      { align: 'center' }
    )
  }

  // ── Simpan File ──
  const filename = `Laporan_Eksekutif_Kategori_${data.outletName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
