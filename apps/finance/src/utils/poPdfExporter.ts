import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface POPDFData {
  id: string
  nomor_po: string
  supplier_nama: string
  tanggal_po: string
  status: string
  jatuh_tempo?: string | null
  catatan?: string | null
  nama_dibuat_oleh?: string | null
  nama_disetujui_oleh?: string | null
  diverifikasi_at?: string | null
  supplier?: {
    nama?: string
    telepon?: string | null
    alamat?: string | null
    kontak_person?: string | null
    termin_hari?: number | null
  } | null
  items: Array<{
    nama_item: string
    satuan: string
    qty_pesan: number
    harga_pesan: number
    subtotal?: number
    catatan?: string | null
  }>
}

function formatRupiah(amount: number): string {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

export function terbilang(n: number): string {
  if (n === 0) return 'Nol Rupiah'
  const angka = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  
  function convert(x: number): string {
    x = Math.floor(x)
    if (x < 12) return angka[x]
    if (x < 20) return convert(x - 10) + ' Belas'
    if (x < 100) return convert(Math.floor(x / 10)) + ' Puluh ' + (x % 10 > 0 ? convert(x % 10) : '')
    if (x < 200) return 'Seratus ' + (x - 100 > 0 ? convert(x - 100) : '')
    if (x < 1000) return convert(Math.floor(x / 100)) + ' Ratus ' + (x % 100 > 0 ? convert(x % 100) : '')
    if (x < 2000) return 'Seribu ' + (x - 1000 > 0 ? convert(x - 1000) : '')
    if (x < 1000000) return convert(Math.floor(x / 1000)) + ' Ribu ' + (x % 1000 > 0 ? convert(x % 1000) : '')
    if (x < 1000000000) return convert(Math.floor(x / 1000000)) + ' Juta ' + (x % 1000000 > 0 ? convert(x % 1000000) : '')
    if (x < 1000000000000) return convert(Math.floor(x / 1000000000)) + ' Miliar ' + (x % 1000000000 > 0 ? convert(x % 1000000000) : '')
    return convert(Math.floor(x / 1000000000000)) + ' Triliun ' + (x % 1000000000000 > 0 ? convert(x % 1000000000000) : '')
  }

  const result = convert(Math.round(Math.abs(n))).replace(/\s+/g, ' ').trim()
  return (result.charAt(0).toUpperCase() + result.slice(1)) + ' Rupiah'
}

export function generatePurchaseOrderPDF(po: POPDFData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let currentY = 14

  const isDraft = po.status === 'draft' || po.status === 'menunggu_approval_finance'

  // ── WATERMARK IF DRAFT ──
  if (isDraft) {
    doc.saveGraphicsState()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(60)
    doc.setTextColor(240, 240, 240)
    doc.text('DRAFT PO', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45
    })
    doc.restoreGraphicsState()
  }

  // ── HEADER / KOP PERUSAHAAN ──
  // Top decorative bar
  doc.setFillColor(44, 24, 16) // #2C1810 (Suka Brown)
  doc.rect(margin, currentY, pageWidth - (margin * 2), 3, 'F')
  currentY += 8

  // Left Company Details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(44, 24, 16)
  doc.text('SUKASHAWARMA', margin, currentY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(234, 88, 12) // Suka Orange
  doc.text('CENTRAL KITCHEN & LOGISTICS BOGOR', margin, currentY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Gudang Pusat SS Shawarma, Bogor - Jawa Barat', margin, currentY + 9)
  doc.text('Email: purchasing@sukashawarma.com | Telp: (0251) 832-1234', margin, currentY + 13)

  // Right PO Title & Number Box
  const rightBoxWidth = 72
  const rightBoxX = pageWidth - margin - rightBoxWidth
  
  doc.setFillColor(254, 243, 199) // Amber-100
  if (!isDraft) {
    doc.setFillColor(243, 244, 246) // Gray-100
  }
  doc.roundedRect(rightBoxX, currentY - 2, rightBoxWidth, 18, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(isDraft ? 180 : 30, isDraft ? 83 : 41, isDraft ? 9 : 59)
  doc.text(isDraft ? 'DRAFT PURCHASE ORDER' : 'PURCHASE ORDER (PO)', rightBoxX + (rightBoxWidth / 2), currentY + 4, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(44, 24, 16)
  doc.text(po.nomor_po || '-', rightBoxX + (rightBoxWidth / 2), currentY + 10, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  doc.text(`Tgl: ${new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, rightBoxX + (rightBoxWidth / 2), currentY + 14.5, { align: 'center' })

  currentY += 21

  // Divider line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.4)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 6

  // ── 2 COLUMN INFO: VENDOR & PENGIRIMAN ──
  const colWidth = (pageWidth - (margin * 2) - 6) / 2
  const colHeight = 26

  // Left Box: Supplier Info
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(margin, currentY, colWidth, colHeight, 2, 2, 'F')
  doc.setDrawColor(230, 230, 230)
  doc.roundedRect(margin, currentY, colWidth, colHeight, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(234, 88, 12)
  doc.text('KEPADA SUPPLIER / VENDOR:', margin + 4, currentY + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(44, 24, 16)
  doc.text(po.supplier_nama || '-', margin + 4, currentY + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 80)
  doc.text(`Kontak : ${po.supplier?.kontak_person || po.supplier?.telepon || '-'}`, margin + 4, currentY + 16)
  doc.text(`Alamat : ${(po.supplier?.alamat || 'Sesuai database vendor').substring(0, 42)}`, margin + 4, currentY + 20)

  // Right Box: Delivery & Payment Terms
  const rightColX = margin + colWidth + 6
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(rightColX, currentY, colWidth, colHeight, 2, 2, 'F')
  doc.roundedRect(rightColX, currentY, colWidth, colHeight, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(234, 88, 12)
  doc.text('TUJUAN PENGIRIMAN & TERMIN:', rightColX + 4, currentY + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(44, 24, 16)
  doc.text('Central Kitchen Sukashawarma Bogor', rightColX + 4, currentY + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 80)
  const terminText = po.supplier?.termin_hari ? `${po.supplier.termin_hari} Hari Kalender (TOP)` : 'Cash / COD'
  doc.text(`Termin Bayar : ${terminText}`, rightColX + 4, currentY + 16)
  doc.text(`Jatuh Tempo  : ${po.jatuh_tempo ? new Date(po.jatuh_tempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}`, rightColX + 4, currentY + 20)

  currentY += colHeight + 6

  // ── ITEM TABLE (autoTable) ──
  const tableHead = [['#', 'Nama Bahan Baku / Deskripsi', 'Qty Pesan', 'Satuan', 'Harga Satuan', 'Total Subtotal']]
  
  let grandTotal = 0
  const tableBody = (po.items || []).map((it, idx) => {
    const sub = it.subtotal ?? (it.qty_pesan * it.harga_pesan)
    grandTotal += sub
    return [
      (idx + 1).toString(),
      it.nama_item,
      it.qty_pesan.toLocaleString('id-ID'),
      it.satuan || 'Pcs',
      it.harga_pesan > 0 ? formatRupiah(it.harga_pesan) : 'Rp 0',
      formatRupiah(sub)
    ]
  })

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [44, 24, 16], // Suka Brown
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 3
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [40, 40, 40],
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 32, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [252, 250, 248]
    }
  })

  currentY = (doc as any).lastAutoTable.finalY + 4

  // Check if we need page break for summary & signatures
  if (currentY > 210) {
    doc.addPage()
    currentY = 20
  }

  // ── SUMMARY & TERBILANG BLOCK ──
  const summaryBoxWidth = pageWidth - (margin * 2)
  const leftNotesWidth = summaryBoxWidth * 0.58
  const rightTotalsWidth = summaryBoxWidth - leftNotesWidth

  // Left: Catatan & Terbilang
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(44, 24, 16)
  doc.text('Terbilang:', margin, currentY + 4)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  const terbilangText = terbilang(grandTotal)
  const splitTerbilang = doc.splitTextToSize(`"${terbilangText}"`, leftNotesWidth - 4)
  doc.text(splitTerbilang, margin, currentY + 8)

  if (po.catatan) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(150, 80, 20)
    doc.text('Catatan PO:', margin, currentY + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(90, 90, 90)
    doc.text(doc.splitTextToSize(po.catatan, leftNotesWidth - 4), margin, currentY + 20)
  }

  // Right: Grand Total Box
  const totalBoxX = margin + leftNotesWidth
  doc.setFillColor(254, 242, 237) // Suka Cream
  doc.roundedRect(totalBoxX, currentY, rightTotalsWidth, 18, 2, 2, 'F')
  doc.setDrawColor(249, 115, 22)
  doc.setLineWidth(0.3)
  doc.roundedRect(totalBoxX, currentY, rightTotalsWidth, 18, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(150, 80, 20)
  doc.text('TOTAL NILAI PO', totalBoxX + 4, currentY + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(44, 24, 16)
  doc.text(formatRupiah(grandTotal), totalBoxX + rightTotalsWidth - 4, currentY + 13, { align: 'right' })

  currentY += 28

  // ── INSTRUCTION / KETENTUAN ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.text('SYARAT & KETENTUAN PENERIMAAN:', margin, currentY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text('1. Surat Pesanan ini sah apabila telah disetujui oleh pihak Purchasing / Finance Sukashawarma.', margin, currentY + 3.5)
  doc.text('2. Pengiriman barang wajib melampirkan Surat Jalan & Faktur Penjualan asli sesuai rincian PO di atas.', margin, currentY + 6.5)
  doc.text('3. Barang yang rusak, kadaluarsa, atau tidak sesuai spesifikasi akan ditolak saat pemeriksaan fisik di gudang.', margin, currentY + 9.5)

  currentY += 16

  // ── SIGNATURES (3 KOLOM) ──
  const sigColWidth = (pageWidth - (margin * 2)) / 3

  const sigs = [
    { title: 'Dibuat Oleh,', role: 'Purchasing Staff', name: po.nama_dibuat_oleh || '(..........................)' },
    { title: 'Disetujui Oleh,', role: 'Finance & Accounting', name: po.nama_disetujui_oleh || '(..........................)' },
    { title: 'Dikonfirmasi Oleh,', role: 'Supplier / Rekanan', name: po.supplier_nama ? `( ${po.supplier_nama.substring(0, 18)} )` : '(..........................)' }
  ]

  sigs.forEach((sig, idx) => {
    const sigX = margin + (idx * sigColWidth) + (sigColWidth / 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 100, 100)
    doc.text(sig.title, sigX, currentY, { align: 'center' })
    doc.text(sig.role, sigX, currentY + 4, { align: 'center' })

    // Sign space
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(44, 24, 16)
    doc.text(sig.name, sigX, currentY + 22, { align: 'center' })
  })

  // ── FOOTER ──
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `Dokumen dicetak otomatis oleh Sistem Sukashawarma Finance | ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    )
  }

  // ── SAVE / DOWNLOAD ──
  const cleanNomor = (po.nomor_po || 'PO').replace(/[^a-zA-Z0-9]/g, '_')
  const prefix = isDraft ? 'DRAFT_PO' : 'PO'
  const filename = `${prefix}_${cleanNomor}_${po.supplier_nama.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  doc.save(filename)
}
