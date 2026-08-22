import QRCode from 'qrcode'
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


interface SuratJalanData {
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

export async function generateQRDataUrl(text: string, size = 80): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 1 })
}

export async function generatePDFContent(
  data: SuratJalanData,
  options?: { hideQR?: boolean }
): Promise<string> {
  const hideQR = options?.hideQR ?? false
  const qrUrl = data.verification_code || data.document_number
  const qrDataUrl = !hideQR ? await generateQRDataUrl(qrUrl, 200) : ''
  const createdDate = new Date(data.created_at).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const isReceivedOrSelesai = ['diterima_lengkap', 'diterima_sebagian', 'selesai'].includes(data.status)

  let statusText = data.status
  if (data.status === 'draft') {
    statusText = 'Draft'
  } else if (data.status === 'dikirim' || data.status === 'dikirim_lengkap') {
    statusText = 'Dikirim'
  } else if (data.status === 'diterima_lengkap') {
    statusText = 'Diterima Lengkap'
  } else if (data.status === 'diterima_sebagian') {
    statusText = 'Diterima Sebagian'
  } else if (data.status === 'selesai') {
    statusText = 'Selesai'
  }

  const receiptSigs = data.receipt_signatures || []
  const adminSignature = data.signatures.find((sig) => ['Admin Kitchen', 'Kitchen SPV'].includes(sig.role))
  const driverSignature = data.signatures.find((sig) => sig.role === 'Supir')
  const receiverSignature = receiptSigs.find((sig) => sig.role === 'Crew Penerima')
  type SuratJalanItem = SuratJalanData['items'][number]
  const printableItems: Array<SuratJalanItem | null> = [...data.items]
  while (printableItems.length < 8) printableItems.push(null)

  const itemRows = printableItems.map((item, index) => `
    <tr>
      <td class="cell-center">${item ? index + 1 : ''}</td>
      <td>${item?.nama || ''}</td>
      <td class="cell-center">${item?.satuan || ''}</td>
      <td class="cell-number">${item?.qty_dikirim ?? ''}</td>
      <td>${item && isReceivedOrSelesai ? `${item.qty_terima ?? '-'} / ${(item.kondisi || 'baik').toUpperCase()}` : ''}</td>
    </tr>
  `).join('')

  const signatureBox = (title: string, signature?: SuratJalanData['signatures'][number]) => `
    <div class="signature-box">
      <div class="signature-title">${title}</div>
      <div class="signature-space">
        ${signature?.signature_image ? `<img src="${signature.signature_image}" alt="Tanda tangan ${title}" />` : ''}
      </div>
      <div class="signature-name">${signature?.signed_by || '( ........................................ )'}</div>
    </div>
  `

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Surat Jalan - ${data.outlet_name}</title>
  <style>
    @page { size: A3 landscape; margin: 8mm 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.25; }
    .print-sheet { width: 100%; max-width: 400mm; margin: 0 auto; background: #fff; }
    .document-header {
      display: grid;
      grid-template-columns: 34mm 1fr 72mm;
      gap: 5mm;
      min-height: 30mm;
      align-items: center;
      border-bottom: 0.45mm solid #000;
      padding: 0 2mm 3mm;
    }
    .brand-logo { width: auto; height: 24mm; max-width: 30mm; display: block; margin: 0 auto; object-fit: contain; }
    .company { text-align: center; }
    .company strong { display: block; font-size: 13pt; line-height: 1.25; }
    .company .company-unit { font-size: 12pt; }
    .company address { margin-top: 1.5mm; font-style: normal; font-size: 9.5pt; }
    .document-title { text-align: center; }
    .document-title h1 { margin: 0; font-size: 19pt; letter-spacing: 0.5pt; }
    .compact-qr { margin-top: 1.5mm; display: flex; justify-content: center; align-items: center; gap: 2mm; }
    .compact-qr img { width: 17mm; height: 17mm; image-rendering: crisp-edges; }
    .compact-qr span { font-size: 7.5pt; font-weight: 700; line-height: 1.2; max-width: 30mm; }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12mm;
      padding: 4mm 2mm 3mm;
      border-bottom: 0.35mm solid #000;
    }
    .meta-row { display: grid; grid-template-columns: 42mm 4mm 1fr; min-height: 6mm; align-items: center; }
    .meta-row strong { font-size: 10pt; }
    .meta-row span { overflow-wrap: anywhere; }
    .items-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 3mm; }
    .items-table col:nth-child(1) { width: 7%; }
    .items-table col:nth-child(2) { width: 43%; }
    .items-table col:nth-child(3) { width: 12%; }
    .items-table col:nth-child(4) { width: 13%; }
    .items-table col:nth-child(5) { width: 25%; }
    .items-table th, .items-table td { border: 0.3mm solid #000; padding: 1.2mm 2mm; height: 7mm; vertical-align: middle; }
    .items-table th { text-align: center; font-weight: 700; font-size: 10pt; }
    .items-table td { font-size: 9.5pt; }
    .cell-center { text-align: center; }
    .cell-number { text-align: right; padding-right: 3mm !important; }
    .notes { margin-top: 4mm; border: 0.3mm solid #000; height: 30mm; }
    .notes-title { height: 7mm; display: flex; align-items: center; justify-content: center; border-bottom: 0.3mm solid #000; font-weight: 700; }
    .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 4mm; border: 0.3mm solid #000; }
    .signature-box { min-height: 42mm; text-align: center; border-right: 0.3mm solid #000; display: grid; grid-template-rows: 7mm 1fr 8mm; }
    .signature-box:last-child { border-right: 0; }
    .signature-title { display: flex; align-items: center; justify-content: center; border-bottom: 0.3mm solid #000; font-weight: 700; }
    .signature-space { min-height: 24mm; display: flex; align-items: center; justify-content: center; }
    .signature-space img { max-height: 21mm; max-width: 85%; object-fit: contain; }
    .signature-name { display: flex; align-items: center; justify-content: center; font-size: 9pt; padding: 1mm; }
    .document-footer { text-align: center; margin-top: 2mm; font-size: 7.5pt; }
    .attachment { page-break-before: always; }
    .attachment h2 { margin: 0 0 5mm; font-size: 15pt; border-bottom: 0.4mm solid #000; padding-bottom: 2mm; }
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
    .photo-card { border: 0.3mm solid #000; break-inside: avoid; }
    .photo-card img { display: block; width: 100%; height: 55mm; object-fit: cover; }
    .photo-caption { padding: 2.5mm; font-size: 9pt; }
    @media screen {
      body { padding: 16px; background: #e5e7eb; }
      .print-sheet, .attachment { padding: 8mm 10mm; box-shadow: 0 2px 12px rgba(0,0,0,.18); }
      .print-sheet { min-height: 281mm; }
    }
    @media print {
      body { background: #fff; }
      .print-sheet, .attachment { padding: 0; box-shadow: none; }
      .print-sheet { page-break-after: auto; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="print-sheet">
    <header class="document-header">
      <img class="brand-logo" src="${LOGO_BASE64}" alt="Logo Suka Shawarma">
      <div class="company">
        <strong>PT SUKA PROFIT BERKAH</strong>
        <strong class="company-unit">SUKA SHAWARMA KITCHEN</strong>
        <address>Jl. Bukit Rivwenda Raya No. 3, Mulyaharja, Kota Bogor, Jawa Barat</address>
      </div>
      <div class="document-title">
        <h1>SURAT JALAN</h1>
        ${data.status !== 'selesai' && !hideQR ? `
          <div class="compact-qr">
            <img src="${qrDataUrl}" alt="QR Verifikasi">
            <span>KODE VERIFIKASI<br>${data.verification_code || '-'}</span>
          </div>
        ` : ''}
      </div>
    </header>

    <section class="meta">
      <div>
        <div class="meta-row"><strong>Nama Outlet</strong><b>:</b><span>${data.outlet_name}</span></div>
        <div class="meta-row"><strong>Nomor PO</strong><b>:</b><span>-</span></div>
      </div>
      <div>
        <div class="meta-row"><strong>Nomor Surat Jalan</strong><b>:</b><span>${data.document_number}</span></div>
        <div class="meta-row"><strong>Tanggal Surat Jalan</strong><b>:</b><span>${createdDate}</span></div>
      </div>
    </section>

    <table class="items-table">
      <colgroup><col><col><col><col><col></colgroup>
      <thead><tr><th>No</th><th>Nama Barang</th><th>Satuan</th><th>Jumlah</th><th>Check List</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <section class="notes"><div class="notes-title">CATATAN</div></section>
    <section class="signature-grid">
      ${signatureBox('Admin Gudang', adminSignature)}
      ${signatureBox('Pengirim', driverSignature)}
      ${signatureBox('Penerima', receiverSignature)}
    </section>
    <footer class="document-footer">${data.sender_outlet} • ${statusText.toUpperCase()} • Dicetak ${new Date().toLocaleDateString('id-ID')}</footer>
  </main>

  ${isReceivedOrSelesai && data.items.some(item => item.foto_base64) ? `
    <section class="attachment">
      <h2>Lampiran Foto Bukti Penerimaan</h2>
      <div class="photo-grid">
        ${data.items.filter(item => item.foto_base64).map(item => `
          <article class="photo-card">
            <img src="${item.foto_base64}" alt="Bukti ${item.nama}">
            <div class="photo-caption"><strong>${item.nama}</strong><br>Diterima: ${item.qty_terima ?? item.qty_dikirim} ${item.satuan} • ${(item.kondisi || 'baik').toUpperCase()}</div>
          </article>
        `).join('')}
      </div>
    </section>
  ` : ''}
</body>
</html>
  `.trim()
}

export function downloadPDF(filename: string, htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const element = document.createElement('a')
  element.setAttribute('href', url)
  element.setAttribute('download', filename)
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
 * Bangun HTML cetak QR/Surat Jalan. Fungsi murni (dapat diuji tanpa DOM).
 * Dengan `DEFAULT_PRINT_LAYOUT.qr_surat_jalan`, output identik dengan template lama:
 * judul "VERIFIKASI SJ", subtitle = nomor dokumen, QR 45mm, footer "Distribusi<br/>Suka Shawarma",
 * kertas 58mm, tanpa logo.
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
  // Tipografi terpusat. Default (fontSizePx 13 → scale 1) = tampilan lama.
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
        // Calculate needed height in mm based on 96 DPI
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

  // Tunggu gambar ter-load sebelum diprint
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

