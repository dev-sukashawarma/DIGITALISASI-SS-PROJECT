import QRCode from 'qrcode'

interface SuratJalanData {
  id: string
  document_number: string
  outlet_name: string
  sender_outlet: string
  status: string
  created_at: string
  verification_url?: string
  items: Array<{
    nama: string
    satuan: string
    qty_dikirim: number
  }>
  signatures: Array<{
    signed_by: string
    role: string
    signed_at: string
    signature_image?: string
  }>
}

const SIGNATURE_CELL_HEIGHT = '80px'
const SIGNATURE_IMAGE_MAX_HEIGHT = '70px'
const SIGNATURE_IMAGE_STYLE = `max-height: ${SIGNATURE_IMAGE_MAX_HEIGHT}; max-width: 100%; display: block; margin: 0 auto;`
const SIGNATURE_PLACEHOLDER_STYLE = `height: 70px; border-bottom: 2px solid #000;`

export async function generateQRDataUrl(text: string, size = 80): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 1 })
}

export async function generatePDFContent(data: SuratJalanData): Promise<string> {
  const qrUrl = data.verification_url || data.document_number
  const qrDataUrl = await generateQRDataUrl(qrUrl, 200)
  const createdDate = new Date(data.created_at).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const itemRows = data.items
    .map(
      (item) => `
    <tr>
      <td style="border: 1px solid #000; padding: 8px;">${item.nama}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.qty_dikirim}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.satuan}</td>
    </tr>
  `
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
      <td style="padding: 8px; text-align: center;">${sig.signed_by}</td>
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
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; }
    .info { margin: 20px 0; }
    .info p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background-color: #f0f0f0; border: 1px solid #000; padding: 8px; text-align: left; }
    .signature-section { margin-top: 40px; }
    .signature-table { width: 100%; }
    .signature-table td { padding: 8px; }
    .qr-section { margin-top: 40px; text-align: center; border-top: 1px solid #ddd; padding-top: 24px; }
    .qr-section p { font-size: 13px; color: #444; margin: 8px 0 4px; font-weight: bold; }
    .qr-section small { font-size: 11px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SURAT JALAN</h1>
    <p style="font-size: 16px; margin: 10px 0;">${data.document_number}</p>
  </div>

  <div class="info">
    <p><strong>Dikirim dari:</strong> ${data.sender_outlet}</p>
    <p><strong>ke Outlet:</strong> ${data.outlet_name}</p>
    <p><strong>Tanggal:</strong> ${createdDate}</p>
    <p><strong>Status:</strong> ${data.status}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Barang</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: center;">Satuan</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="signature-section">
    <p><strong>Tanda Tangan Pengesahan:</strong></p>
    <table class="signature-table">
      <tr>
        <th>Tanda Tangan</th>
        <th>Nama</th>
        <th>Jabatan</th>
        <th>Tanggal</th>
      </tr>
      ${signatureRows}
    </table>
  </div>

  <div class="qr-section">
    <p>Scan QR untuk verifikasi penerimaan</p>
    <img src="${qrDataUrl}" width="200" height="200" alt="QR Verifikasi" />
    <br/>
    <small>${data.document_number}</small>
  </div>

  <p style="margin-top: 24px; font-size: 12px; color: #666; text-align: center;">
    Dokumen ini dicetak otomatis dari sistem Sukashawarma
  </p>
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
