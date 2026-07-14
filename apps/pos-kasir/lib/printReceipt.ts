// Cetak struk thermal (58/80mm) lewat hidden iframe dengan @page sendiri,
// terisolasi dari CSS print aplikasi (yang memakai A4 landscape untuk laporan).
//
// Dipakai jalur kasir walk-in: setelah order dibuat, panggil printReceipt(data)
// untuk mencetak ke printer thermal yang terpasang sebagai printer sistem.

import { formatRupiah } from '@/lib/validations'

// Lebar kertas thermal. Umum: 80mm (default) atau 58mm. Ganti ke 58 bila
// printer memakai kertas 58mm.
const PAPER_WIDTH_MM = 80

export interface ReceiptLine {
  name: string
  note?: string
  quantity: number
  unit_price: number
  subtotal: number
  isChild?: boolean
}

export interface ReceiptData {
  outletName: string
  orderNumber: number | string
  dateISO: string
  customerName?: string | null
  items: ReceiptLine[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: 'cash' | 'qris'
  amountReceived?: number | null
  changeAmount?: number | null
  cashierName?: string | null
  logoUrl?: string
  receiptType?: 'customer' | 'kitchen'
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildReceiptHtml(d: ReceiptData, origin: string = ''): string {
  const date = new Date(d.dateISO)
  const dateStr = date.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const rows = d.items.map((it) => {
    const noteHtml = it.note ? `<div class="note">- ${esc(it.note)}</div>` : ''
    return `
      <tr>
        <td class="qty">${it.quantity}x</td>
        <td class="name">${esc(it.name)}${noteHtml}</td>
        <td class="amt">${formatRupiah(it.subtotal)}</td>
      </tr>`
  }).join('')

  const payLabel = d.paymentMethod === 'cash' ? 'TUNAI' : 'QRIS'
  const cashRows = d.paymentMethod === 'cash'
    ? `
      <div class="row"><span>Tunai</span><span>${formatRupiah(d.amountReceived ?? 0)}</span></div>
      <div class="row"><span>Kembalian</span><span>${formatRupiah(d.changeAmount ?? 0)}</span></div>`
    : ''

  const discRow = d.discount > 0 && d.receiptType !== 'kitchen'
    ? `<div class="row"><span>Diskon</span><span>-${formatRupiah(d.discount)}</span></div>`
    : ''

  const logoSrc = d.logoUrl || `${origin}/logo.png`
  const isKitchen = d.receiptType === 'kitchen'

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk</title>
<style>
  /* @page di-set dinamis oleh printReceipt (80mm x tinggi konten). */
  @page { size: ${PAPER_WIDTH_MM}mm 297mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body { margin: 0; padding: 6px 8px; font-family: 'Courier New', Courier, monospace; color: #000;
         width: ${PAPER_WIDTH_MM}mm; font-size: ${isKitchen ? '22px' : '14px'}; line-height: 1.3; font-weight: 900; }
  .center { text-align: center; }
  .bold { font-weight: 900; }
  .lg { font-size: ${isKitchen ? '26px' : '18px'}; }
  .muted { font-size: ${isKitchen ? '18px' : '13px'}; font-weight: 900; }
  .logo { display: block; margin: 0 auto 6px auto; width: 48px; height: 48px; object-fit: contain; filter: grayscale(100%) contrast(200%); }
  hr { border: none; border-top: 2px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 4px; }
  td { vertical-align: top; padding: 2px 0; font-weight: 900; }
  td.qty { width: ${isKitchen ? '40px' : '30px'}; font-size: ${isKitchen ? '24px' : '16px'}; }
  td.name { font-size: ${isKitchen ? '22px' : '15px'}; padding-right: 4px; }
  td.amt { text-align: right; white-space: nowrap; padding-left: 6px; }
  .note { font-size: ${isKitchen ? '18px' : '13px'}; font-style: italic; display: block; margin-top: 2px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .total { font-size: 18px; font-weight: 900; margin-top: 4px; margin-bottom: 4px; }
  .queue { font-size: 32px; font-weight: 900; margin: 4px 0; }
  .kitchen-title { font-size: 30px; font-weight: 900; margin-bottom: 8px; text-decoration: underline; }
</style></head>
<body>
  ${isKitchen ? `<div class="center kitchen-title">STRUK DAPUR</div>` : `
  <img src="${logoSrc}" class="logo" alt="Logo" />
  <div class="center bold lg">${esc(d.outletName || 'SUKA SHAWARMA')}</div>
  <div class="center muted">Suka Shawarma</div>
  `}
  <hr/>
  <div class="row muted"><span>${dateStr}</span><span>${!isKitchen ? payLabel : ''}</span></div>
  ${d.customerName ? `<div class="muted">Pelanggan: ${esc(d.customerName)}</div>` : ''}
  ${d.cashierName && !isKitchen ? `<div class="muted">Kasir: ${esc(d.cashierName)}</div>` : ''}
  <div class="center queue">No. ${esc(String(d.orderNumber))}</div>
  <hr/>
  <table><tbody>
  ${d.items.map((it) => {
    const noteHtml = it.note ? `<div class="note">- ${esc(it.note)}</div>` : ''
    const paddingLeft = it.isChild ? 'padding-left: 12px;' : ''
    const prefix = it.isChild ? '- ' : ''
    return `
      <tr>
        <td class="qty">${it.quantity}x</td>
        <td class="name" style="${paddingLeft}">${prefix}${esc(it.name)}${noteHtml}</td>
        ${!isKitchen ? `<td class="amt">${formatRupiah(it.subtotal)}</td>` : ''}
      </tr>`
  }).join('')}
  </tbody></table>
  <hr/>
  ${!isKitchen ? `
  <div class="row"><span>Subtotal</span><span>${formatRupiah(d.subtotal)}</span></div>
  ${discRow}
  <div class="row total"><span>TOTAL</span><span>${formatRupiah(d.total)}</span></div>
  ${cashRows}
  <hr/>
  <div class="center muted" style="margin-top: 8px;">Terima kasih & selamat menikmati!</div>
  ` : ''}
</body></html>`
}

async function getBase64Image(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    // If fetch fails (e.g. CORS), fallback to original URL
    return url
  }
}

export function printReceipt(data: ReceiptData): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    
    // Start async process
    const origin = window.location.origin
    const logoUrl = data.logoUrl || `${origin}/logo.png`

    getBase64Image(logoUrl).then((base64Logo) => {
      // Override logoUrl temporarily
      const dataWithBase64 = { ...data, logoUrl: base64Logo }
      const html = buildReceiptHtml(dataWithBase64, origin)

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
        resolve()
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
      if (!win) { cleanup(); resolve(); return }

      const applyPageSize = () => {
        try {
          const heightPx = doc.body?.scrollHeight || 0
          if (heightPx > 0) {
            const heightMm = Math.ceil((heightPx / 96) * 25.4) + 4
            const style = doc.createElement('style')
            style.textContent = `@page { size: ${PAPER_WIDTH_MM}mm ${heightMm}mm; margin: 0; }`
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
          resolve() // Resolve after the print dialog is closed/done
        }
      }

      // Karena logo sudah dirender sebagai base64 (atau fallback), kita bisa
      // menunggu sebentar saja untuk pastikan CSS selesai dirender.
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
    })
  })
}


