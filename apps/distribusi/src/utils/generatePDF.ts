import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { LOGO_BASE64 } from './logoBase64'
import { createSupabaseBrowserClient } from '@suka/auth'
import { DEFAULT_PRINT_LAYOUT, type QrLayout } from './printLayout'

export async function fetchFotoAsBase64(foto_path: string): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.storage
      .from('verif-foto-bahan')
      .download(foto_path)
    if (error || !data) return null
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(data)
    })
  } catch {
    return null
  }
}

export interface SuratJalanData {
  id: string
  document_number: string
  outlet_name: string
  sender_outlet: string
  status: string
  created_at: string
  verification_url?: string
  verification_code?: string
  items: Array<{
    nama: string
    satuan: string
    qty_dikirim: number
    qty_terima?: number | null
    kondisi?: string | null
    catatan?: string | null
    foto_base64?: string | null
  }>
  signatures: Array<{
    signed_by: string
    role: string
    signed_at: string
    signature_image?: string
  }>
  receipt_signatures?: Array<{
    signed_by: string
    role: string
    signed_at: string
    signature_image?: string
  }> | null
}

export interface SuratJalanPDFOptions {
  hideQR?: boolean
  copies?: 1 | 3 // 1 = 1x pass untuk Epson LX-310 (kertas continuous form sudah 3 rangkap NCR), 3 = 3 lembar terpisah
  paperFormat?: '3ply_14x12' | 'continuous_9.5x5.5' | 'letter'
  isDotMatrix?: boolean
}

export async function generateQRDataUrl(text: string, size = 80): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 1 })
}

// 3-Ply designation metadata
export const PLY_COPIES = [
  {
    copyNumber: 1,
    colorName: 'Putih',
    destination: 'ARSIP PUSAT / FINANCE',
    headerBg: '#f8fafc',
    badgeColor: '#1e293b',
    badgeBorder: '#94a3b8',
  },
  {
    copyNumber: 2,
    colorName: 'Merah / Kuning',
    destination: 'OUTLET PENERIMA / CABANG',
    headerBg: '#fffbeb',
    badgeColor: '#92400e',
    badgeBorder: '#f59e0b',
  },
  {
    copyNumber: 3,
    colorName: 'Hijau / Biru',
    destination: 'SUPIR / LOGISTIK',
    headerBg: '#f0fdf4',
    badgeColor: '#166534',
    badgeBorder: '#22c55e',
  },
]

// Maksimal 6 item per lembar continuous form agar pas tanpa terpotong
export const ITEMS_PER_PAGE_3PLY = 6

/**
 * Menghasilkan HTML Surat Jalan format Continuous Form 3-Ply (Lebar 195mm, Top Margin 6mm agar tidak terpotong di Epson LX-310).
 */
export async function generatePDFContent(
  data: SuratJalanData,
  options?: SuratJalanPDFOptions
): Promise<string> {
  const hideQR = options?.hideQR ?? false
  const copiesCount = options?.copies ?? 3
  const qrUrl = data.verification_code || data.document_number
  const qrDataUrl = !hideQR ? await generateQRDataUrl(qrUrl, 140) : ''
  const createdDate = new Date(data.created_at).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const isReceivedOrSelesai = ['diterima_lengkap', 'diterima_sebagian', 'selesai'].includes(data.status)

  const receiptSigs = data.receipt_signatures || []
  const adminSignature = data.signatures.find((sig) => ['Admin Kitchen', 'Kitchen SPV', 'Admin Gudang'].includes(sig.role))
  const driverSignature = data.signatures.find((sig) => sig.role === 'Supir')
  const receiverSignature = receiptSigs.find((sig) => ['Crew Penerima', 'Staff Outlet', 'SPV Outlet'].includes(sig.role))

  // Bagi items ke dalam beberapa halaman jika melebihi kapasitas 1 lembar
  const totalItemPages = Math.max(1, Math.ceil((data.items?.length || 0) / ITEMS_PER_PAGE_3PLY))

  const renderSingleSheet = (ply: typeof PLY_COPIES[0], pageIdx: number, totalPages: number) => {
    const isLastPage = pageIdx === totalPages - 1
    const startIndex = pageIdx * ITEMS_PER_PAGE_3PLY
    const pageItems = data.items.slice(startIndex, startIndex + ITEMS_PER_PAGE_3PLY)
    
    // Pad items to 6 rows for uniform height
    const printableRows: Array<typeof data.items[0] | null> = [...pageItems]
    while (printableRows.length < 6) printableRows.push(null)

    const itemRows = printableRows.map((item, index) => {
      const globalIdx = startIndex + index + 1
      return `
        <tr>
          <td class="cell-center" style="width: 6%;">${item ? globalIdx : ''}</td>
          <td class="cell-name" style="width: 46%;">${item?.nama || ''}</td>
          <td class="cell-center" style="width: 12%;">${item?.satuan || ''}</td>
          <td class="cell-number" style="width: 12%;">${item ? item.qty_dikirim : ''}</td>
          <td class="cell-number" style="width: 12%;">${item && isReceivedOrSelesai ? (item.qty_terima ?? item.qty_dikirim) : ''}</td>
          <td class="cell-center" style="width: 12%;">${item ? (isReceivedOrSelesai ? (item.kondisi || 'Baik').toUpperCase() : '☐') : ''}</td>
        </tr>
      `
    }).join('')

    return `
      <section class="print-sheet ply-sheet-${ply.copyNumber}">
        <!-- Header (Dengan Safe Margin Top 6mm) -->
        <header class="sheet-header">
          <div class="brand-block">
            <img class="brand-logo" src="${LOGO_BASE64}" alt="Logo Suka Shawarma" />
            <div class="company-text">
              <strong class="company-name">PT SUKA PROFIT BERKAH</strong>
              <div class="company-sub">SUKA SHAWARMA LOGISTICS</div>
              <div class="company-address">Jl. Bukit Nirwana Raya No. 3, Mulyaharja, Bogor</div>
            </div>
          </div>
          <div class="doc-title-block">
            <h1 class="doc-title">SURAT JALAN</h1>
            <div class="ply-badge" style="border-color: ${ply.badgeBorder}; color: ${ply.badgeColor}; background-color: ${ply.headerBg};">
              RANGKAP ${ply.copyNumber}: ${ply.destination} ${totalPages > 1 ? `(${pageIdx + 1}/${totalPages})` : ''}
            </div>
          </div>
        </header>

        <!-- Meta Information Grid (Lebar Penuh 195mm) -->
        <section class="meta-grid">
          <div class="meta-col">
            <div class="meta-row"><span class="meta-lbl">No. Surat Jalan</span><b>:</b><span class="meta-val font-mono"><strong>${data.document_number}</strong></span></div>
            <div class="meta-row"><span class="meta-lbl">Tujuan Outlet</span><b>:</b><span class="meta-val font-bold">${data.outlet_name}</span></div>
          </div>
          <div class="meta-col">
            <div class="meta-row"><span class="meta-lbl">Tanggal Kirim</span><b>:</b><span class="meta-val">${createdDate}</span></div>
            <div class="meta-row"><span class="meta-lbl">Kode Verifikasi</span><b>:</b><span class="meta-val font-mono"><strong>${data.verification_code || '-'}</strong></span></div>
          </div>
          ${!hideQR && qrDataUrl ? `
            <div class="meta-qr">
              <img src="${qrDataUrl}" alt="QR" />
            </div>
          ` : ''}
        </section>

        <!-- Table Barang (Lebar Penuh 195mm) -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 6%;">No</th>
              <th style="width: 46%;">Nama Bahan / Barang</th>
              <th style="width: 12%;">Satuan</th>
              <th style="width: 12%;">Qty Kirim</th>
              <th style="width: 12%;">Qty Terima</th>
              <th style="width: 12%;">Cek / Status</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- Catatan & Signatures / Continuation Footer -->
        ${isLastPage ? `
          <div class="footer-block">
            <div class="notes-box">
              <b>Catatan:</b> Barang wajib diperiksa saat serah terima. Komplain selisih maksimal 1x24 jam setelah status diterima.
            </div>

            <div class="signatures-grid">
              <div class="signature-cell">
                <div class="sig-title">Diserahkan (Admin Gudang)</div>
                <div class="sig-space">
                  ${adminSignature?.signature_image ? `<img src="${adminSignature.signature_image}" alt="TTD Admin" />` : ''}
                </div>
                <div class="sig-name">${adminSignature?.signed_by || '( ................................. )'}</div>
              </div>
              <div class="signature-cell">
                <div class="sig-title">Dibawa (Supir / Kurir)</div>
                <div class="sig-space">
                  ${driverSignature?.signature_image ? `<img src="${driverSignature.signature_image}" alt="TTD Supir" />` : ''}
                </div>
                <div class="sig-name">${driverSignature?.signed_by || '( ................................. )'}</div>
              </div>
              <div class="signature-cell">
                <div class="sig-title">Diterima (Staff Outlet)</div>
                <div class="sig-space">
                  ${receiverSignature?.signature_image ? `<img src="${receiverSignature.signature_image}" alt="TTD Penerima" />` : ''}
                </div>
                <div class="sig-name">${receiverSignature?.signed_by || '( ................................. )'}</div>
              </div>
            </div>
          </div>
        ` : `
          <div class="continuation-box">
            <span>⏭️ <b>Bersambung ke Lembar Berikutnya (Halaman ${pageIdx + 2} dari ${totalPages})...</b></span>
            <span class="paraf-line">Paraf Petugas: ____________</span>
          </div>
        `}

        <!-- Micro Footer -->
        <footer class="sheet-footer">
          <span>Distribusi Suka Shawarma • Continuous Form 3-Ply</span>
          <span>Lembar ${pageIdx + 1}/${totalPages} • Rangkap ${ply.copyNumber} (${ply.colorName})</span>
        </footer>
      </section>
    `
  }

  let sheetsHtml = ''
  for (let copyIdx = 0; copyIdx < copiesCount; copyIdx += 1) {
    const ply = PLY_COPIES[copyIdx % PLY_COPIES.length]
    for (let pageIdx = 0; pageIdx < totalItemPages; pageIdx += 1) {
      sheetsHtml += renderSingleSheet(ply, pageIdx, totalItemPages)
    }
  }

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Surat Jalan 3-Ply - ${data.document_number}</title>
  <style>
    @page {
      size: auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #f1f5f9;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5pt;
    }
    /* Lebar 195mm memenuhi kertas Continuous Form 9.5 inch / Letter pada Epson LX-310 */
    .print-sheet {
      width: 195mm;
      max-width: 195mm;
      min-height: 120mm;
      max-height: 126mm;
      margin: 0 auto;
      background: #fff;
      padding: 6mm 4mm 3mm 4mm; /* Top padding 6mm agar header tidak kepotong jarum printer */
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
    }
    .print-sheet:last-child {
      page-break-after: auto;
    }

    /* Header */
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 0.35mm solid #000;
      padding-bottom: 1.2mm;
      height: 14mm;
    }
    .brand-block {
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    .brand-logo {
      width: 11mm;
      height: 11mm;
      object-fit: contain;
    }
    .company-text {
      line-height: 1.15;
    }
    .company-name {
      font-size: 8.5pt;
      font-weight: 900;
      letter-spacing: 0.2pt;
    }
    .company-sub {
      font-size: 7.5pt;
      font-weight: 700;
      color: #000;
    }
    .company-address {
      font-size: 6pt;
      color: #333;
    }
    .doc-title-block {
      text-align: right;
    }
    .doc-title {
      margin: 0;
      font-size: 13pt;
      font-weight: 900;
      letter-spacing: 0.5pt;
      line-height: 1;
    }
    .ply-badge {
      display: inline-block;
      margin-top: 1mm;
      font-size: 6pt;
      font-weight: 900;
      border: 0.25mm solid #000;
      padding: 0.5mm 1.5mm;
      border-radius: 1mm;
      text-transform: uppercase;
      white-space: nowrap;
    }

    /* Meta Grid */
    .meta-grid {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 0.25mm solid #000;
      padding: 1.2mm 0;
      font-size: 7.5pt;
      height: 11mm;
    }
    .meta-col {
      display: flex;
      flex-direction: column;
      gap: 0.6mm;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 1.5mm;
    }
    .meta-lbl {
      width: 22mm;
      font-weight: 700;
      color: #000;
    }
    .meta-val {
      color: #000;
    }
    .font-mono { font-family: monospace; }
    .font-bold { font-weight: 800; }
    .meta-qr img {
      width: 9.5mm;
      height: 9.5mm;
    }

    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 7.5pt;
      margin-top: 0.8mm;
      border: 0.3mm solid #000;
    }
    .items-table th, .items-table td {
      border: 0.25mm solid #000;
      padding: 0.8mm 1.2mm;
      height: 5.2mm;
      vertical-align: middle;
    }
    .items-table th {
      background: #f1f5f9;
      font-weight: 900;
      text-align: center;
      font-size: 7.5pt;
    }
    .cell-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }
    .cell-center { text-align: center; }
    .cell-number { text-align: right; font-weight: 800; }

    /* Continuation Box for Multi-page */
    .continuation-box {
      border: 0.25mm dashed #000;
      padding: 1.5mm 2.5mm;
      margin-top: 1mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      background: #fafafa;
    }
    .paraf-line {
      font-family: monospace;
      font-size: 6.5pt;
    }

    /* Footer & Signatures */
    .footer-block {
      margin-top: 0.8mm;
    }
    .notes-box {
      font-size: 6pt;
      border: 0.25mm solid #000;
      padding: 0.8mm 1.5mm;
      background: #fafafa;
      line-height: 1.2;
      margin-bottom: 0.8mm;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 0.3mm solid #000;
      height: 23mm;
    }
    .signature-cell {
      border-right: 0.3mm solid #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      padding: 0.8mm;
    }
    .signature-cell:last-child {
      border-right: none;
    }
    .sig-title {
      font-size: 6pt;
      font-weight: 900;
      border-bottom: 0.2mm solid #000;
      padding-bottom: 0.4mm;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .sig-space {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 11mm;
    }
    .sig-space img {
      max-height: 10mm;
      max-width: 85%;
      object-fit: contain;
    }
    .sig-name {
      font-size: 6pt;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Micro Footer */
    .sheet-footer {
      display: flex;
      justify-content: space-between;
      font-size: 5.5pt;
      color: #333;
      padding-top: 0.5mm;
      border-top: 0.2mm dashed #888;
    }

    /* Screen Preview Styling */
    @media screen {
      body {
        padding: 20px 10px;
        background: #0f172a;
      }
      .print-sheet {
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        margin-bottom: 24px;
      }
    }
    @media print {
      body {
        background: #fff;
      }
      .print-sheet {
        box-shadow: none;
        border-radius: 0;
        width: 195mm !important;
        max-width: 195mm !important;
        margin: 0 !important;
        padding-top: 6mm !important;
      }
    }
  </style>
</head>
<body>
  ${sheetsHtml}
</body>
</html>
  `.trim()
}

function addImageSafely(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!dataUrl) return
  try {
    doc.addImage(dataUrl, x, y, width, height, undefined, 'FAST')
  } catch (error) {
    console.warn('Gambar tidak dapat dimasukkan ke PDF Surat Jalan:', error)
  }
}

/**
 * Dimensi Kertas 3-Ply Continuous Form: 215.9 mm x 139.7 mm (9.5" x 5.5" / Half Letter)
 */
export const CONTINUOUS_95X55: [number, number] = [215.9, 139.7]
export const PAPER_3PLY_14X12: [number, number] = [140, 120]
export const LETTER_PORTRAIT: [number, number] = [215.9, 279.4]

/**
 * Menghasilkan PDF Surat Jalan format kertas 3-Ply Continuous Form dengan multi-page chunking otomatis.
 */
export async function generateSuratJalanPDF(
  data: SuratJalanData,
  options?: SuratJalanPDFOptions
): Promise<Blob> {
  const paperFormat = options?.paperFormat ?? 'continuous_9.5x5.5'
  const is3Ply = paperFormat === 'continuous_9.5x5.5' || paperFormat === '3ply_14x12'
  const copiesCount = is3Ply ? (options?.copies ?? 3) : 1
  const pageSize: [number, number] = paperFormat === '3ply_14x12' ? PAPER_3PLY_14X12 : CONTINUOUS_95X55

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: pageSize,
    compress: true,
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight() // 139.7 mm
  const marginX = 10.0
  const marginTop = 6.0
  const contentWidth = pageWidth - (marginX * 2) // ~195 mm

  const createdDate = new Date(data.created_at).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const completed = ['diterima_lengkap', 'diterima_sebagian', 'selesai'].includes(data.status)
  const receiptSignatures = data.receipt_signatures || []
  const adminSignature = data.signatures.find((sig) => ['Admin Kitchen', 'Kitchen SPV', 'Admin Gudang'].includes(sig.role))
  const driverSignature = data.signatures.find((sig) => sig.role === 'Supir')
  const receiverSignature = receiptSignatures.find((sig) => ['Crew Penerima', 'Staff Outlet', 'SPV Outlet'].includes(sig.role))

  doc.setProperties({
    title: `Surat Jalan - ${data.document_number}`,
    subject: `Surat Jalan 3-Ply Continuous Form untuk ${data.outlet_name}`,
    author: 'PT Suka Profit Berkah',
    creator: 'Sistem Distribusi Suka Shawarma',
  })

  const totalItemPages = Math.max(1, Math.ceil((data.items?.length || 0) / ITEMS_PER_PAGE_3PLY))

  let isFirstPageInDoc = true

  // Render Copies (Rangkap 1: Putih, Rangkap 2: Merah/Kuning, Rangkap 3: Hijau/Biru)
  for (let copyIdx = 0; copyIdx < copiesCount; copyIdx += 1) {
    const ply = PLY_COPIES[copyIdx % PLY_COPIES.length]

    for (let pageIdx = 0; pageIdx < totalItemPages; pageIdx += 1) {
      if (!isFirstPageInDoc) {
        doc.addPage(pageSize, 'landscape')
      }
      isFirstPageInDoc = false

      const isLastPage = pageIdx === totalItemPages - 1
      const startIndex = pageIdx * ITEMS_PER_PAGE_3PLY
      const pageItems = data.items.slice(startIndex, startIndex + ITEMS_PER_PAGE_3PLY)
      const printableRowsCount = isLastPage ? Math.max(5, Math.min(ITEMS_PER_PAGE_3PLY, pageItems.length)) : ITEMS_PER_PAGE_3PLY

      doc.setTextColor(0, 0, 0)
      doc.setDrawColor(0, 0, 0)

      // 1. Header (y: 6.0 to 19.5)
      const headerTop = marginTop
      
      // Logo Brand
      addImageSafely(doc, LOGO_BASE64, marginX, headerTop, 12, 12)

      // Company Info
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text('PT SUKA PROFIT BERKAH', marginX + 15, headerTop + 3.2)
      doc.setFontSize(7.5)
      doc.text('SUKA SHAWARMA LOGISTICS', marginX + 15, headerTop + 7.0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.text('Jl. Bukit Nirwana Raya No. 3, Mulyaharja, Bogor', marginX + 15, headerTop + 10.5)

      // Doc Title & Ply Badge (Right aligned)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('SURAT JALAN', pageWidth - marginX, headerTop + 4.0, { align: 'right' })

      // Ply badge text & frame
      const pageBadgeSuffix = totalItemPages > 1 ? ` (${pageIdx + 1}/${totalItemPages})` : ''
      const badgeText = `RANGKAP ${ply.copyNumber}: ${ply.destination}${pageBadgeSuffix}`
      doc.setFontSize(6.5)
      const badgeWidth = doc.getTextWidth(badgeText) + 4
      const badgeX = pageWidth - marginX - badgeWidth
      const badgeY = headerTop + 6.2
      
      doc.setLineWidth(0.2)
      doc.rect(badgeX, badgeY, badgeWidth, 4.5)
      doc.text(badgeText, badgeX + (badgeWidth / 2), badgeY + 3.2, { align: 'center' })

      // Line under header
      doc.setLineWidth(0.35)
      doc.line(marginX, headerTop + 14, pageWidth - marginX, headerTop + 14)

      // 2. Metadata Grid (y: 22 to 33)
      const metaTop = headerTop + 16
      const drawMetaRow = (label: string, value: string, x: number, y: number, labelWidth = 24) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(label, x, y)
        doc.text(':', x + labelWidth, y)
        doc.setFont('helvetica', 'normal')
        doc.text(value || '-', x + labelWidth + 2, y, { maxWidth: 65 })
      }

      drawMetaRow('No. Surat Jalan', data.document_number, marginX, metaTop)
      drawMetaRow('Tujuan Outlet', data.outlet_name, marginX, metaTop + 4.5)

      const rightColX = marginX + 105
      drawMetaRow('Tanggal Kirim', createdDate, rightColX, metaTop)
      drawMetaRow('Kode Verifikasi', data.verification_code || '-', rightColX, metaTop + 4.5)

      // Line under meta
      doc.setLineWidth(0.25)
      doc.line(marginX, metaTop + 7.5, pageWidth - marginX, metaTop + 7.5)

      // 3. Items Table (y: 35.5 to ~80)
      const tableTop = metaTop + 9.5
      const headerHeight = 5.0
      const rowHeight = 4.8
      
      // Column widths total = 195.9 mm
      const columnWidths = [12, 90, 23, 23, 23, 24.9]
      const headers = ['No', 'Nama Bahan / Barang', 'Satuan', 'Qty Kirim', 'Qty Terima', 'Cek / Status']

      let columnX = marginX
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      
      // Draw table header
      headers.forEach((header, index) => {
        doc.rect(columnX, tableTop, columnWidths[index], headerHeight)
        const align = index === 1 ? 'left' : (index === 3 || index === 4 ? 'right' : 'center')
        const textX = align === 'left' ? columnX + 1.5 : (align === 'right' ? columnX + columnWidths[index] - 1.5 : columnX + (columnWidths[index] / 2))
        doc.text(header, textX, tableTop + 3.4, { align })
        columnX += columnWidths[index]
      })

      // Draw table rows for this page chunk
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      for (let rowIndex = 0; rowIndex < printableRowsCount; rowIndex += 1) {
        const item = pageItems[rowIndex]
        const globalRowIdx = startIndex + rowIndex + 1
        const rowY = tableTop + headerHeight + (rowIndex * rowHeight)
        columnX = marginX
        columnWidths.forEach((width) => {
          doc.rect(columnX, rowY, width, rowHeight)
          columnX += width
        })

        if (!item) continue

        const baseline = rowY + (rowHeight / 2) + 1.0
        // No
        doc.text(String(globalRowIdx), marginX + (columnWidths[0] / 2), baseline, { align: 'center' })
        // Nama
        doc.text(item.nama || '-', marginX + columnWidths[0] + 1.5, baseline, { maxWidth: columnWidths[1] - 3.0 })
        // Satuan
        doc.text(item.satuan || '-', marginX + columnWidths[0] + columnWidths[1] + (columnWidths[2] / 2), baseline, { align: 'center' })
        // Qty Kirim
        doc.setFont('helvetica', 'bold')
        doc.text(String(item.qty_dikirim ?? ''), marginX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] - 1.5, baseline, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        
        // Qty Terima & Check status
        if (completed) {
          doc.text(String(item.qty_terima ?? item.qty_dikirim), marginX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4] - 1.5, baseline, { align: 'right' })
          const statusText = (item.kondisi || 'Baik').toUpperCase()
          doc.text(statusText, marginX + columnWidths.slice(0, 5).reduce((a, b) => a + b, 0) + (columnWidths[5] / 2), baseline, { align: 'center' })
        } else {
          doc.text('☐', marginX + columnWidths.slice(0, 5).reduce((a, b) => a + b, 0) + (columnWidths[5] / 2), baseline, { align: 'center' })
        }
      }

      const tableBottom = tableTop + headerHeight + (printableRowsCount * rowHeight)

      if (isLastPage) {
        // 4. Catatan box
        const notesTop = tableBottom + 1.2
        const notesHeight = 5.5
        doc.rect(marginX, notesTop, contentWidth, notesHeight)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.text('Catatan:', marginX + 1.5, notesTop + 3.6)
        doc.setFont('helvetica', 'normal')
        doc.text('Barang wajib diperiksa saat serah terima. Komplain selisih maksimal 1x24 jam setelah status diterima.', marginX + 13.5, notesTop + 3.6, { maxWidth: contentWidth - 15 })

        // 5. Signatures Grid (3 Kolom = 65mm per cell)
        const sigTop = notesTop + notesHeight + 1.2
        const sigHeight = 23
        const sigColWidth = contentWidth / 3
        const sigEntries = [
          { title: 'Diserahkan (Admin Gudang)', signature: adminSignature },
          { title: 'Dibawa (Supir / Kurir)', signature: driverSignature },
          { title: 'Diterima (Staff Outlet)', signature: receiverSignature },
        ]

        sigEntries.forEach(({ title, signature }, idx) => {
          const cellX = marginX + (idx * sigColWidth)
          doc.rect(cellX, sigTop, sigColWidth, sigHeight)
          
          // Header cell TTD
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.5)
          doc.text(title, cellX + (sigColWidth / 2), sigTop + 3.4, { align: 'center' })
          doc.line(cellX, sigTop + 4.4, cellX + sigColWidth, sigTop + 4.4)

          // Signature Image
          if (signature?.signature_image) {
            addImageSafely(doc, signature.signature_image, cellX + (sigColWidth / 2) - 10, sigTop + 5.0, 20, 11)
          }

          // Name & Line
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6.5)
          doc.text(signature?.signed_by || '( ................................. )', cellX + (sigColWidth / 2), sigTop + 20.5, { align: 'center' })
        })
      } else {
        // Continuation banner for intermediate pages
        const contTop = tableBottom + 2.0
        doc.setLineWidth(0.2)
        doc.setLineDashPattern([1.5, 1.5], 0)
        doc.rect(marginX, contTop, contentWidth, 12)
        doc.setLineDashPattern([], 0)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.text(`>>> Bersambung ke Lembar Berikutnya (Halaman ${pageIdx + 2} dari ${totalItemPages}) >>>`, marginX + 3.0, contTop + 7.0)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.text('Paraf Petugas: ___________________', pageWidth - marginX - 3.0, contTop + 7.0, { align: 'right' })
      }

      // 6. Micro Footer (y: pageHeight - 3.0)
      doc.setFontSize(5.5)
      doc.setTextColor(60, 60, 60)
      doc.text(
        `Distribusi Suka Shawarma • Continuous Form 3-Ply`,
        marginX,
        pageHeight - 3.0
      )
      doc.text(
        `Lembar ${pageIdx + 1}/${totalItemPages} • Rangkap ${ply.copyNumber} (${ply.colorName})`,
        pageWidth - marginX,
        pageHeight - 3.0,
        { align: 'right' }
      )
    }
  }

  // Optional: Lampiran Foto jika ada
  const photoItems = completed ? data.items.filter((item) => item.foto_base64) : []
  if (photoItems.length > 0) {
    doc.addPage(pageSize, 'landscape')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text('LAMPIRAN FOTO BUKTI PENERIMAAN', marginX, 8)
    doc.setLineWidth(0.25)
    doc.line(marginX, 10.0, pageWidth - marginX, 10.0)

    const cardW = (contentWidth - 6) / 3
    const cardH = 50
    photoItems.slice(0, 6).forEach((item, index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const x = marginX + (col * (cardW + 3))
      const y = 12.0 + (row * (cardH + 3))

      doc.rect(x, y, cardW, cardH)
      addImageSafely(doc, item.foto_base64 || undefined, x + 1, y + 1, cardW - 2, 38)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.text(item.nama, x + 1.5, y + 42, { maxWidth: cardW - 3 })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.text(`Diterima: ${item.qty_terima ?? item.qty_dikirim} ${item.satuan} (${(item.kondisi || 'baik').toUpperCase()})`, x + 1.5, y + 46)
    })
  }

  return doc.output('blob')
}

export function downloadPDF(filename: string, pdfBlob: Blob) {
  const url = URL.createObjectURL(pdfBlob)
  const element = document.createElement('a')
  element.setAttribute('href', url)
  element.setAttribute('download', filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBarcode(filename: string, dataUrl: string) {
  const element = document.createElement('a')
  element.setAttribute('href', dataUrl)
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

/**
 * Bangun HTML cetak QR/Surat Jalan.
 */
export function buildBarcodeHtml(
  docNumber: string,
  dataUrl: string,
  layout: QrLayout = DEFAULT_PRINT_LAYOUT.qr_surat_jalan,
  extra?: { tanggal?: string; tujuanOutlet?: string; verificationCode?: string }
): string {
  const footer = layout.footerText.split('\n').join('<br/>')
  const logo = layout.showLogo
    ? `<img src="${LOGO_BASE64}" alt="Logo" style="width:40px;height:40px;object-fit:contain;display:block;margin:0 auto 6px auto;" />`
    : ''
  const FONT_STACK: Record<QrLayout['fontFamily'], string> = {
    monospace: `'Courier New', Courier, monospace`,
    sans: `Arial, Helvetica, sans-serif`,
    serif: `'Times New Roman', Times, serif`,
  }
  const scale = (layout.fontSizePx || 13) / 13
  const fs = (basePx: number) => Math.round(basePx * scale)
  const weight = layout.bold ? 900 : 400
  const fontFam = FONT_STACK[layout.fontFamily] ?? FONT_STACK.monospace
  const marginMm = typeof layout.marginMm === 'number' ? layout.marginMm : 2
  
  const extraHtml = extra ? `
    <div style="font-size: ${fs(11)}px; font-weight: ${weight}; margin-top: 4px; line-height: 1.2;">
      ${extra.tujuanOutlet ? `<div>Tujuan: ${extra.tujuanOutlet}</div>` : ''}
      ${extra.tanggal ? `<div>Tgl: ${extra.tanggal}</div>` : ''}
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Print QR Code - ${docNumber}</title>
        <style>
          @page { margin: 0mm; }
          @media print { @page { margin: 0mm; } }
          * { box-sizing: border-box; }
          html, body { background: #fff; margin: 0; padding: 0; }
          body {
            width: ${layout.paperWidth}mm;
            padding: ${marginMm}mm;
            font-family: ${fontFam};
            color: #000;
            text-align: center;
          }
          .title {
            font-size: ${fs(16)}px;
            font-weight: ${weight};
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: ${fs(13)}px;
            font-weight: ${weight};
            margin-bottom: 2px;
            text-decoration: underline;
          }
          img.qr {
            width: ${layout.qrSizeMm}mm;
            height: ${layout.qrSizeMm}mm;
            display: block;
            margin: 4px auto 0 auto;
          }
          .verification-code {
            font-size: ${fs(14)}px;
            font-weight: 900;
            margin-top: 4px;
            text-transform: uppercase;
          }
          .footer {
            margin-top: 10px;
            font-size: ${fs(10)}px;
            font-weight: ${weight};
            border-top: 1px dashed #000;
            padding-top: 6px;
          }
        </style>
      </head>
      <body>
        ${logo}
        <div class="title">${layout.title}</div>
        <div class="subtitle">${docNumber}</div>
        ${extraHtml}
        <img class="qr" src="${dataUrl}" alt="QR Code" />
        ${extra?.verificationCode ? `<div class="verification-code">KODE: ${extra.verificationCode}</div>` : ''}
        <div class="footer">${footer}</div>
      </body>
    </html>
  `;
}

export function printBarcode(
  docNumber: string,
  dataUrl: string,
  layout: QrLayout = DEFAULT_PRINT_LAYOUT.qr_surat_jalan,
  extra?: { tanggal?: string; tujuanOutlet?: string; verificationCode?: string }
) {
  const PAPER_WIDTH_MM = layout.paperWidth;
  const html = buildBarcodeHtml(docNumber, dataUrl, layout, extra);

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 500)
  }

  const win = iframe.contentWindow
  if (!win) { cleanup(); return }

  const applyPageSize = () => {
    try {
      const heightPx = doc.body?.scrollHeight || 0
      if (heightPx > 0) {
        const heightMm = Math.ceil((heightPx / 96) * 25.4) + 4
        const style = doc.createElement('style')
        style.textContent = `@media print { @page { size: ${PAPER_WIDTH_MM}mm ${heightMm}mm; margin: 0mm; } }`
        doc.head?.appendChild(style)
      }
    } catch {
      // Fallback
    }
  }

  let printed = false
  const doPrint = () => {
    if (printed) return
    printed = true
    try {
      applyPageSize()
      win.focus()
      win.print()
    } finally {
      cleanup()
    }
  }

  const checkImage = setInterval(() => {
    const img = doc.querySelector('img')
    if (!img || img.complete) {
      clearInterval(checkImage)
      doPrint()
    }
  }, 50)
  
  setTimeout(() => {
    clearInterval(checkImage)
    doPrint()
  }, 1500)
}
