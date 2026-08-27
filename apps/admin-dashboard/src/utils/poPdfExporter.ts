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

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Load image error: ' + url))
    img.src = url
  })
}

function formatRupiah(amount: number): string {
  return 'Rp' + Math.round(amount).toLocaleString('id-ID')
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
    return convert(Math.floor(x / 1000000000000)) + ' Triliun ' + (x % 1000000000000 > 0 ? convert(x % 1000000000) : '')
  }

  const result = convert(Math.round(Math.abs(n))).replace(/\s+/g, ' ').trim()
  return (result.charAt(0).toUpperCase() + result.slice(1)) + ' Rupiah'
}

export async function generatePurchaseOrderPDF(po: POPDFData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let currentY = 12

  const isDraft = po.status === 'draft' || po.status === 'menunggu_approval_finance'

  // ── WATERMARK IF DRAFT ──
  if (isDraft) {
    doc.saveGraphicsState()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(55)
    doc.setTextColor(235, 235, 235)
    doc.text('DRAFT PO', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45
    })
    doc.restoreGraphicsState()
  }

  // ── KOP PERUSAHAAN (SESUAI TEMPLATE PT SUKA PROFIT BERKAH) ──
  let textStartX = margin
  try {
    const logoImg = await loadImage('/logo.png')
    doc.addImage(logoImg, 'PNG', margin, currentY - 2, 18, 18)
    textStartX = margin + 22
  } catch (err) {
    console.warn('Logo could not be loaded for PDF, using text layout')
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 27, 21) // Suka Ink / Dark
  doc.text('PT SUKA PROFIT BERKAH', textStartX, currentY + 3)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(50, 50, 50)
  doc.text('SUKA SHAWARMA KITCHEN', textStartX, currentY + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(90, 90, 90)
  doc.text('Jl. Bukit Nirwana Raya No. 3, Mulyaharja, Kec Bogor Selatan, Kota Bogor, Jawa Barat', textStartX, currentY + 12.5)

  currentY += 19

  // Garis Ganda Pembatas Kop (Double border line)
  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.8)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  doc.setLineWidth(0.2)
  doc.line(margin, currentY + 1, pageWidth - margin, currentY + 1)

  currentY += 8

  // ── JUDUL DOKUMEN ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 27, 21)
  const titleText = isDraft ? 'DRAFT PURCHASE ORDER (PO)' : 'PURCHASE ORDER (PO)'
  doc.text(titleText, pageWidth / 2, currentY, { align: 'center' })

  currentY += 7

  // ── METADATA PO (SESUAI EXCEL) ──
  const labelColX = margin
  const colonColX = margin + 34
  const valColX = colonColX + 3
  const rowHeight = 5

  const formattedDate = new Date(po.tanggal_po).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const metadataList = [
    { label: 'No. PO', val: po.nomor_po || '-' },
    { label: 'Tanggal PO', val: formattedDate },
    { label: 'Supplier', val: po.supplier_nama || '-' },
    { label: 'Alamat Supplier', val: po.supplier?.alamat || '-' },
    { label: 'No. Telepon', val: po.supplier?.telepon || '-' },
    { label: 'Tanggal Pengiriman', val: po.jatuh_tempo ? `TOP: ${po.supplier?.termin_hari ?? 0} Hari (Est. ${new Date(po.jatuh_tempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})` : '-' }
  ]

  metadataList.forEach(meta => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 30, 30)
    doc.text(meta.label, labelColX, currentY)
    doc.text(':', colonColX, currentY)

    doc.setFont('helvetica', meta.label === 'No. PO' || meta.label === 'Supplier' ? 'bold' : 'normal')
    doc.text(meta.val, valColX, currentY)

    currentY += rowHeight
  })

  currentY += 3

  // ── TABEL BARANG (ORANGE HEADER SESUAI EXCEL) ──
  const tableHead = [['No', 'Nama Barang', 'Satuan', 'Jumlah', 'Harga', 'Total']]
  
  let grandTotal = 0
  const tableBody = (po.items || []).map((it, idx) => {
    const sub = it.subtotal ?? (it.qty_pesan * it.harga_pesan)
    grandTotal += sub
    return [
      (idx + 1).toString(),
      it.nama_item,
      it.satuan || 'Pack',
      it.qty_pesan.toLocaleString('id-ID'),
      it.harga_pesan > 0 ? formatRupiah(it.harga_pesan) : 'Rp0',
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
      fillColor: [230, 115, 36], // #E67324 (Orange Suka Sesuai Template)
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
      lineColor: [40, 40, 40]
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 30, 30],
      lineWidth: 0.2,
      lineColor: [100, 100, 100],
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 36, halign: 'right' },
      5: { cellWidth: 38, halign: 'right' }
    },
    foot: [
      [
        { content: 'TOTAL', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold', fontSize: 8.5 } },
        { content: formatRupiah(grandTotal), styles: { halign: 'right', fontStyle: 'bold', fontSize: 8.5 } }
      ]
    ],
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 30, 30],
      lineWidth: 0.2,
      lineColor: [100, 100, 100]
    }
  })

  currentY = (doc as any).lastAutoTable.finalY + 8

  // Check if signatures fit on the same page
  if (currentY > 220) {
    doc.addPage()
    currentY = 20
  }

  // ── CATATAN / TERBILANG ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 80)
  doc.text(`Terbilang: ${terbilang(grandTotal)}`, margin, currentY)
  if (po.catatan) {
    currentY += 4
    doc.text(`Catatan: ${po.catatan}`, margin, currentY)
  }

  currentY += 8

  // ── TABEL TANDA TANGAN (5 KOLOM SESUAI EXCEL) ──
  // Columns: Dibuat Oleh (Reva / Purchasing) | Diketahui Oleh (Helmi / Chef) | Diperiksa Oleh (Nadya / Finance) | Disetujui Oleh (Alby / Direktur F&A) | Diterima Supplier
  const sigTableWidth = pageWidth - (margin * 2)
  const sigColWidth = sigTableWidth / 5
  const sigHeaderHeight = 6.5
  const sigSpaceHeight = 18
  const sigFooterHeight = 9

  const signCols = [
    { title: 'Dibuat Oleh', name: 'Reva', role: 'Purchasing' },
    { title: 'Diketahui Oleh', name: 'Helmi', role: 'Chef' },
    { title: 'Diperiksa Oleh', name: 'Nadya', role: 'Finance' },
    { title: 'Disetujui Oleh', name: 'Alby', role: 'Direktur F&A' },
    { title: 'Diterima Supplier', name: '', role: '' }
  ]

  // Draw 5-column signature box
  signCols.forEach((col, idx) => {
    const x = margin + (idx * sigColWidth)

    // Outer Box
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.2)
    doc.rect(x, currentY, sigColWidth, sigHeaderHeight + sigSpaceHeight + sigFooterHeight, 'S')

    // Header divider
    doc.line(x, currentY + sigHeaderHeight, x + sigColWidth, currentY + sigHeaderHeight)
    // Footer divider
    doc.line(x, currentY + sigHeaderHeight + sigSpaceHeight, x + sigColWidth, currentY + sigHeaderHeight + sigSpaceHeight)

    // Header Text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 30, 30)
    doc.text(col.title, x + (sigColWidth / 2), currentY + 4.5, { align: 'center' })

    // Footer Text (Name & Role)
    if (col.name) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.text(col.name, x + (sigColWidth / 2), currentY + sigHeaderHeight + sigSpaceHeight + 4, { align: 'center' })
    }
    if (col.role) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(70, 70, 70)
      doc.text(col.role, x + (sigColWidth / 2), currentY + sigHeaderHeight + sigSpaceHeight + 7.5, { align: 'center' })
    }
  })

  // ── FOOTER ──
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `Dicetak otomatis oleh Sistem Suka Shawarma | ${new Date().toLocaleString('id-ID')} | Hal ${i} dari ${pageCount}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    )
  }

  // ── SAVE FILE ──
  const cleanNomor = (po.nomor_po || 'PO').replace(/[^a-zA-Z0-9]/g, '_')
  const prefix = isDraft ? 'DRAFT_PO' : 'PO'
  const filename = `${prefix}_${cleanNomor}_${po.supplier_nama.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  doc.save(filename)
}
