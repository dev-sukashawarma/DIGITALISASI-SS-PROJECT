import QRCode from 'qrcode'
import { LOGO_BASE64 } from './logoBase64'


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
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">Qty Kirim</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">Qty Terima</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 70px;">Satuan</th>
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
  const element = document.createElement('a')
  element.setAttribute(
    'href',
    'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
  )
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
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
