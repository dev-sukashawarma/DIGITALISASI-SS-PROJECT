// Cetak struk thermal (58/80mm) lewat hidden iframe dengan @page sendiri,
// terisolasi dari CSS print aplikasi (yang memakai A4 landscape untuk laporan).
//
// Dipakai jalur kasir walk-in: setelah order dibuat, panggil printReceipt(data)
// untuk mencetak ke printer thermal yang terpasang sebagai printer sistem.

import { formatRupiah } from '@/lib/validations'

export interface ReceiptLine {
  name: string
  note?: string
  quantity: number
  unit_price: number
  subtotal: number
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
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildReceiptHtml(d: ReceiptData): string {
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

  const discRow = d.discount > 0
    ? `<div class="row"><span>Diskon</span><span>-${formatRupiah(d.discount)}</span></div>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 6px 8px; font-family: 'Courier New', monospace; color: #000;
         width: 80mm; font-size: 12px; line-height: 1.35; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .lg { font-size: 15px; }
  .muted { font-size: 11px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  td.qty { width: 26px; }
  td.amt { text-align: right; white-space: nowrap; padding-left: 6px; }
  td.name .note { font-size: 10px; padding-left: 2px; }
  .row { display: flex; justify-content: space-between; }
  .total { font-size: 14px; font-weight: 700; }
  .queue { font-size: 22px; font-weight: 700; }
</style></head>
<body>
  <div class="center bold lg">${esc(d.outletName || 'SUKA SHAWARMA')}</div>
  <div class="center muted">Suka Shawarma</div>
  <hr/>
  <div class="row muted"><span>${dateStr}</span><span>${payLabel}</span></div>
  ${d.customerName ? `<div class="muted">Pelanggan: ${esc(d.customerName)}</div>` : ''}
  ${d.cashierName ? `<div class="muted">Kasir: ${esc(d.cashierName)}</div>` : ''}
  <div class="center queue">No. ${esc(String(d.orderNumber))}</div>
  <hr/>
  <table><tbody>${rows}</tbody></table>
  <hr/>
  <div class="row"><span>Subtotal</span><span>${formatRupiah(d.subtotal)}</span></div>
  ${discRow}
  <div class="row total"><span>TOTAL</span><span>${formatRupiah(d.total)}</span></div>
  ${cashRows}
  <hr/>
  <div class="center muted">Terima kasih & selamat menikmati!</div>
</body></html>`
}

export function printReceipt(data: ReceiptData): void {
  if (typeof window === 'undefined') return
  const html = buildReceiptHtml(data)

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
    // Beri jeda agar dialog print sempat menangkap konten sebelum iframe dibuang
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 500)
  }

  const win = iframe.contentWindow
  if (!win) { cleanup(); return }

  // Tunggu konten siap, lalu print (sekali saja meski beberapa pemicu ter-fire)
  let printed = false
  const doPrint = () => {
    if (printed) return
    printed = true
    try {
      win.focus()
      win.print()
    } finally {
      cleanup()
    }
  }

  if (doc.readyState === 'complete') {
    setTimeout(doPrint, 100)
  } else {
    win.addEventListener('load', () => setTimeout(doPrint, 100))
    // Fallback bila event load tidak ter-fire
    setTimeout(doPrint, 600)
  }
}
