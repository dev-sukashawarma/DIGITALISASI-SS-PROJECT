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


// SUKA Design System Tokens
const TOKENS = {
  colors: {
    'suka-orange': '#f29744',
    'suka-brown': '#701604',
    'suka-ink': '#400a07',
    'suka-cream': '#fff7ed',
    'gray-100': '#f3f4f6',
    'gray-200': '#e5e7eb',
    'gray-600': '#4b5563',
    'gray-900': '#111827',
  },
  fonts: {
    display: '"Lilita One", sans-serif',
    sans: '"Plus Jakarta Sans", system-ui, sans-serif',
  },
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

const SIGNATURE_CELL_HEIGHT = '80px'
const SIGNATURE_IMAGE_MAX_HEIGHT = '70px'
const SIGNATURE_IMAGE_STYLE = `max-height: ${SIGNATURE_IMAGE_MAX_HEIGHT}; max-width: 100%; display: block; margin: 0 auto;`
const SIGNATURE_PLACEHOLDER_STYLE = `height: 70px; border-bottom: 2px solid ${TOKENS.colors['suka-brown']};`

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
  let statusColor = TOKENS.colors['suka-orange']
  if (data.status === 'draft') {
    statusText = 'Draft'
  } else if (data.status === 'dikirim' || data.status === 'dikirim_lengkap') {
    statusText = 'Dikirim'
    statusColor = '#1d4ed8' // blue
  } else if (data.status === 'diterima_lengkap') {
    statusText = 'Diterima Lengkap'
    statusColor = '#0a7d2c' // green
  } else if (data.status === 'diterima_sebagian') {
    statusText = 'Diterima Sebagian'
    statusColor = TOKENS.colors['suka-orange']
  } else if (data.status === 'selesai') {
    statusText = 'Selesai'
    statusColor = '#0a7d2c' // green
  }

  const tableHeaders = isReceivedOrSelesai
    ? `
      <tr>
        <th style="border: 1px solid #000; padding: 8px;">Nama Barang</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 60px;">Kirim</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 60px;">Terima</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 50px;">Sat.</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">Kondisi</th>
        <th style="border: 1px solid #000; padding: 8px;">Catatan</th>
      </tr>
    `
    : `
      <tr>
        <th style="border: 1px solid #000; padding: 8px;">Nama Barang</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">Qty</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">Satuan</th>
      </tr>
    `

  const itemRows = data.items
    .map(
      (item) => {
        if (isReceivedOrSelesai) {
          const isKurang = item.qty_terima !== undefined && item.qty_terima !== null && item.qty_terima < item.qty_dikirim
          const isRusak = item.kondisi === 'rusak'
          const qtyTerimaText = item.qty_terima !== undefined && item.qty_terima !== null ? item.qty_terima : '-'
          const kondisiText = item.kondisi || 'baik'
          const catatanText = item.catatan || '-'
          return `
            <tr>
              <td style="border: 1px solid #000; padding: 8px;">${item.nama}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.qty_dikirim}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; color: ${isKurang ? TOKENS.colors['suka-brown'] : '#0a7d2c'};">${qtyTerimaText}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.satuan}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold; color: ${isRusak ? '#ba1a1a' : '#0a7d2c'};">${kondisiText.toUpperCase()}</td>
              <td style="border: 1px solid #000; padding: 8px; font-style: italic; color: #544437;">${catatanText}</td>
            </tr>
          `
        } else {
          return `
            <tr>
              <td style="border: 1px solid #000; padding: 8px;">${item.nama}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.qty_dikirim}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.satuan}</td>
            </tr>
          `
        }
      }
    )
    .join('')

  const signatureRows = data.signatures
    .map(
      (sig) => `
    <tr>
      <td style="padding: 8px; text-align: center; height: ${SIGNATURE_CELL_HEIGHT};">
        ${
          sig.signature_image
            ? `<img src="${sig.signature_image}" style="${SIGNATURE_IMAGE_STYLE}" />`
            : `<div style="${SIGNATURE_PLACEHOLDER_STYLE}"></div>`
        }
      </td>
      <td style="padding: 8px; text-align: center; font-weight: bold;">${sig.signed_by}</td>
      <td style="padding: 8px; text-align: center;">${sig.role}</td>
      <td style="padding: 8px; text-align: center;">${new Date(sig.signed_at).toLocaleDateString('id-ID')}</td>
    </tr>
  `
    )
    .join('')

  const receiptSigs = data.receipt_signatures || []
  const receiptSignatureRows = receiptSigs
    .map(
      (sig) => `
    <tr>
      <td style="padding: 8px; text-align: center; height: ${SIGNATURE_CELL_HEIGHT};">
        ${
          sig.signature_image
            ? `<img src="${sig.signature_image}" style="${SIGNATURE_IMAGE_STYLE}" />`
            : `<div style="${SIGNATURE_PLACEHOLDER_STYLE}"></div>`
        }
      </td>
      <td style="padding: 8px; text-align: center; font-weight: bold;">${sig.signed_by}</td>
      <td style="padding: 8px; text-align: center;">${sig.role}</td>
      <td style="padding: 8px; text-align: center;">${new Date(sig.signed_at).toLocaleDateString('id-ID')}</td>
    </tr>
  `
    )
    .join('')

  const missingSigImages = data.signatures.filter((sig) => !sig.signature_image)
  const sigImageWarning =
    missingSigImages.length > 0
      ? `\n  <!-- WARNING: ${missingSigImages.length} signature(s) missing image data: ${missingSigImages.map((s) => s.signed_by).join(', ')} -->`
      : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Surat Jalan - ${data.outlet_name}</title>${sigImageWarning}
  <link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: ${TOKENS.fonts.sans};
      color: ${TOKENS.colors['gray-900']};
      line-height: 1.6;
      background: white;
      padding: 40px 20px;
    }

    .container { max-width: 800px; margin: 0 auto; }

    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 3px solid ${TOKENS.colors['suka-orange']};
    }

    .brand {
      font-family: ${TOKENS.fonts.display};
      font-size: 28px;
      color: ${TOKENS.colors['suka-brown']};
      margin-bottom: 8px;
      letter-spacing: 1px;
    }

    .header h1 {
      font-family: ${TOKENS.fonts.display};
      font-size: 32px;
      color: ${TOKENS.colors['suka-orange']};
      margin: 8px 0;
      letter-spacing: 0.5px;
    }

    .doc-number {
      font-size: 14px;
      color: ${TOKENS.colors['gray-600']};
      font-weight: 600;
      margin-top: 8px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 24px 0;
      padding: 16px;
      background: ${TOKENS.colors['suka-cream']};
      border-radius: 8px;
    }

    .info-item {
      font-size: 14px;
    }

    .info-label {
      font-weight: 700;
      color: ${TOKENS.colors['suka-brown']};
      margin-bottom: 4px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-value {
      color: ${TOKENS.colors['gray-900']};
      font-size: 14px;
    }

    .section-title {
      font-family: ${TOKENS.fonts.display};
      font-size: 16px;
      color: ${TOKENS.colors['suka-brown']};
      margin: 24px 0 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${TOKENS.colors['suka-orange']};
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14px;
    }

    th {
      background: ${TOKENS.colors['suka-orange']};
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid ${TOKENS.colors['gray-200']};
    }

    tbody tr:nth-child(even) {
      background: ${TOKENS.colors['gray-100']};
    }

    .signature-section {
      margin-top: 32px;
      page-break-inside: avoid;
    }

    .signature-table {
      width: 100%;
      margin-top: 16px;
    }

    .signature-table th {
      background: ${TOKENS.colors['suka-brown']};
      color: white;
      padding: 10px;
      font-size: 12px;
      text-align: center;
    }

    .signature-table td {
      padding: 16px 8px;
      text-align: center;
      font-size: 13px;
      border: 1px solid ${TOKENS.colors['gray-200']};
    }

    .qr-section {
      margin: 40px 0;
      padding: 24px;
      text-align: center;
      background: ${TOKENS.colors['suka-cream']};
      border-radius: 8px;
      border: 2px solid ${TOKENS.colors['suka-orange']};
    }

    .qr-label {
      font-family: ${TOKENS.fonts.display};
      font-size: 16px;
      color: ${TOKENS.colors['suka-brown']};
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }

    .qr-code {
      margin: 16px 0;
    }

    .qr-number {
      font-size: 12px;
      color: ${TOKENS.colors['gray-600']};
      font-weight: 600;
      margin-top: 12px;
    }

    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid ${TOKENS.colors['gray-200']};
      text-align: center;
      font-size: 11px;
      color: ${TOKENS.colors['gray-600']};
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_BASE64}" alt="Logo Suka Shawarma" style="height: 48px; width: auto; object-fit: contain; margin: 0 auto 12px; display: block;" />
      <h1>SURAT JALAN${data.status === 'selesai' ? ' (SUDAH DIVERIFIKASI)' : ''}</h1>
      <div class="doc-number">${data.document_number}</div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Dari Outlet</div>
        <div class="info-value">${data.sender_outlet}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Ke Outlet</div>
        <div class="info-value">${data.outlet_name}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Tanggal</div>
        <div class="info-value">${createdDate}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value" style="color: ${statusColor}; font-weight: 600;">
          ${statusText.toUpperCase()}
        </div>
      </div>
    </div>

    <div class="section-title">📦 Detail Barang</div>
    <table>
      <thead>
        ${tableHeaders}
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="signature-section">
      <div class="section-title">✍️ Tanda Tangan Pengirim (Pusat)</div>
      <table class="signature-table">
        <thead>
          <tr>
            <th style="width: 140px;">Tanda Tangan</th>
            <th>Nama</th>
            <th>Jabatan</th>
            <th style="width: 100px;">Tanggal</th>
          </tr>
        </thead>
        <tbody>
          ${signatureRows}
        </tbody>
      </table>
    </div>

    ${isReceivedOrSelesai && receiptSigs.length > 0 ? `
    <div class="signature-section" style="margin-top: 24px;">
      <div class="section-title">✍️ Tanda Tangan Penerima (Cabang)</div>
      <table class="signature-table">
        <thead>
          <tr>
            <th style="width: 140px;">Tanda Tangan</th>
            <th>Nama</th>
            <th>Jabatan</th>
            <th style="width: 100px;">Tanggal</th>
          </tr>
        </thead>
        <tbody>
          ${receiptSignatureRows}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${isReceivedOrSelesai && data.items.some(i => i.foto_base64) ? `
    <div style="page-break-before: always; padding-top: 32px;">
      <div class="section-title">📷 Lampiran Foto Bukti Penerimaan</div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 16px;">
        ${data.items.filter(i => i.foto_base64).map(item => {
          const kondisiText = item.kondisi || 'baik'
          const isRusak = item.kondisi === 'rusak'
          const qtyText = item.qty_terima !== undefined && item.qty_terima !== null ? item.qty_terima : item.qty_dikirim
          return `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
              <img src="${item.foto_base64}" style="width: 100%; height: 180px; object-fit: cover; display: block;" />
              <div style="padding: 10px 12px; background: #fff7ed;">
                <p style="font-weight: 700; font-size: 13px; color: #111827; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.3px;">${item.nama}</p>
                <p style="font-size: 12px; color: #4b5563; margin: 0 0 4px;">Diterima: <strong>${qtyText} ${item.satuan}</strong> dari ${item.qty_dikirim} ${item.satuan}</p>
                <span style="display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: ${isRusak ? '#ffdad6' : '#dcfce7'}; color: ${isRusak ? '#ba1a1a' : '#166534'};">${kondisiText.toUpperCase()}</span>
                ${item.catatan ? `<p style="font-size: 11px; color: #ba1a1a; margin: 6px 0 0; font-style: italic;">${item.catatan}</p>` : ''}
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${data.status !== 'selesai' && !hideQR ? `
    <div class="qr-section">
      <div class="qr-label">📱 Scan untuk Verifikasi Penerimaan</div>
      <div class="qr-code">
        <img src="${qrDataUrl}" width="200" height="200" alt="QR Verifikasi" />
      </div>
      <div class="qr-number" style="font-size: 16px; font-weight: bold; letter-spacing: 2px; color: ${TOKENS.colors['suka-brown']};">KODE VERIFIKASI: ${data.verification_code || '-'}</div>
    </div>
    ` : ''}

    <div class="footer">
      Dokumen ini dicetak otomatis dari Sistem Sukashawarma • ${new Date().toLocaleDateString('id-ID')}
    </div>
  </div>
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
            margin-bottom: 8px;
            text-decoration: underline;
          }
          img.qr {
            width: ${layout.qrSizeMm}mm;
            height: ${layout.qrSizeMm}mm;
            display: block;
            margin: 0 auto;
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
        <img class="qr" src="${dataUrl}" alt="QR Code" />
        <div class="footer">${footer}</div>
      </body>
    </html>
  `;
}

export function printBarcode(
  docNumber: string,
  dataUrl: string,
  layout: QrLayout = DEFAULT_PRINT_LAYOUT.qr_surat_jalan,
) {
  const PAPER_WIDTH_MM = layout.paperWidth;
  const html = buildBarcodeHtml(docNumber, dataUrl, layout);

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

