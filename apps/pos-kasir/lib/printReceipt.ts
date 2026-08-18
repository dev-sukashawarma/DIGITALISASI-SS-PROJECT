// Cetak struk thermal (58/80mm) lewat hidden iframe dengan @page sendiri,
// terisolasi dari CSS print aplikasi (yang memakai A4 landscape untuk laporan).
//
// Dipakai jalur kasir walk-in: setelah order dibuat, panggil printReceipt(data)
// untuk mencetak ke printer thermal yang terpasang sebagai printer sistem.

import { formatRupiah } from '@/lib/validations'
import { usePrinterStore } from './printerStore'
import { printViaBluetooth, printViaRawBT } from './bluetooth-printer'
import { createClient } from '@/lib/supabase/client'
import { fetchPrintLayout, DEFAULT_PRINT_LAYOUT, type CustomerLayout, type KitchenLayout, type FontFamily } from './printLayout'

const FONT_STACK: Record<FontFamily, string> = {
  monospace: `'Courier New', Courier, monospace`,
  sans: `Arial, Helvetica, sans-serif`,
  serif: `'Times New Roman', Times, serif`,
}

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
  posPromoDiscount?: number
  total: number
  paymentMethod: 'cash' | 'qris' | 'card'
  amountReceived?: number | null
  changeAmount?: number | null
  cashierName?: string | null
  logoUrl?: string
  receiptType?: 'customer' | 'kitchen'
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildReceiptHtml(
  d: ReceiptData,
  origin: string = '',
  layout: CustomerLayout | KitchenLayout =
    d.receiptType === 'kitchen' ? DEFAULT_PRINT_LAYOUT.struk_dapur : DEFAULT_PRINT_LAYOUT.struk_customer,
): string {
  const date = new Date(d.dateISO)
  const dateStr = date.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const payLabel = d.paymentMethod === 'cash' ? 'TUNAI' : d.paymentMethod === 'card' ? 'DEBIT/KREDIT' : 'QRIS'
  const cashRows = d.paymentMethod === 'cash'
    ? `
      <div class="row"><span>Tunai</span><span>${formatRupiah(d.amountReceived ?? 0)}</span></div>
      <div class="row"><span>Kembalian</span><span>${formatRupiah(d.changeAmount ?? 0)}</span></div>`
    : ''

  let discRow = ''
  if (d.receiptType !== 'kitchen') {
    if ((d.posPromoDiscount || 0) > 0) {
      discRow += `<div class="row"><span>Diskon Item (POS)</span><span>-${formatRupiah(d.posPromoDiscount || 0)}</span></div>`
    }
    if (d.discount > 0) {
      discRow += `<div class="row"><span>Diskon Promo</span><span>-${formatRupiah(d.discount)}</span></div>`
    }
  }

  const logoSrc = d.logoUrl || `${origin}/logo.png`
  const isKitchen = d.receiptType === 'kitchen'

  // ── Layout terpusat (fallback = perilaku hardcoded lama) ──
  const paperWidth = layout.paperWidth
  // Ukuran font: fontSizePx adalah basis. Default (customer 14 / kitchen 22) → scale 1
  // → identik dengan tampilan lama. Elemen lain menskala proporsional dari basis ini.
  const scale = (layout.fontSizePx || 14) / 14
  const fs = (basePx: number) => Math.round(basePx * scale)
  const weight = layout.bold ? 900 : 400
  const fontFam = FONT_STACK[layout.fontFamily] ?? FONT_STACK.monospace
  const marginMm = typeof layout.marginMm === 'number' ? layout.marginMm : 2
  const headerText = layout.headerText // ada di Customer & Kitchen layout
  // Customer: header override nama outlet bila non-kosong. Kitchen: .lg tetap nama outlet.
  const bigTitle = isKitchen ? (d.outletName || 'SUKA SHAWARMA') : (headerText || d.outletName || 'SUKA SHAWARMA')
  const kitchenTitle = headerText || 'STRUK DAPUR'
  const footerText = 'footerText' in layout ? layout.footerText : 'Terima kasih & selamat menikmati!'
  const showCashier = !isKitchen && (layout as CustomerLayout).showCashier
  const showCustomer = layout.showCustomer
  const showItemNotes = isKitchen || (layout as CustomerLayout).showItemNotes
  const showLogo = layout.showLogo

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk</title>
<style>
  /* @page di-set dinamis oleh printReceipt (paperWidth x tinggi konten). */
  @page { margin: 0mm; }
  @media print {
    @page { margin: 0mm; size: auto; }
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
  }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body { margin: 0mm; padding: ${marginMm}mm; font-family: ${fontFam}; color: #000;
         width: ${paperWidth}mm; font-size: ${fs(isKitchen ? 22 : 14)}px; line-height: 1.3; font-weight: ${weight}; }
  .center { text-align: center; }
  .bold { font-weight: ${weight}; }
  .lg { font-size: ${fs(isKitchen ? 26 : 18)}px; }
  .muted { font-size: ${fs(isKitchen ? 18 : 13)}px; font-weight: ${weight}; }
  .logo { display: block; margin: 0 auto 6px auto; width: 48px; height: 48px; object-fit: contain; filter: grayscale(100%) contrast(200%); }
  hr { border: none; border-top: 2px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 4px; }
  td { vertical-align: top; padding: 2px 0; font-weight: ${weight}; }
  td.qty { width: ${isKitchen ? '40px' : '30px'}; font-size: ${fs(isKitchen ? 24 : 16)}px; }
  td.name { font-size: ${fs(isKitchen ? 22 : 15)}px; padding-right: 4px; }
  td.name.child-item { padding-left: 10px; border-left: 1.5px solid #000; position: relative; left: 6px; }
  td.amt { text-align: right; white-space: nowrap; padding-left: 6px; }
  td.amt.child-amt { padding-top: 0; padding-bottom: 0; }
  .child-amt-inner { padding-top: 2px; padding-bottom: 2px; }
  .note { font-size: ${fs(isKitchen ? 18 : 13)}px; font-style: italic; display: block; margin-top: 2px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .total { font-size: ${fs(18)}px; font-weight: 900; margin-top: 4px; margin-bottom: 4px; }
  .queue { font-size: ${fs(32)}px; font-weight: 900; margin: 4px 0; }
  .kitchen-title { font-size: ${fs(30)}px; font-weight: 900; margin-bottom: 8px; text-decoration: underline; }
</style></head>
<body>
  ${showLogo ? `<img src="${logoSrc}" class="logo" alt="Logo" />` : ''}
  <div class="center bold lg">${esc(bigTitle)}</div>
  ${isKitchen ? `
  <div class="center kitchen-title" style="margin-top: 8px;">${esc(kitchenTitle)}</div>
  ` : ''}
  <hr/>
  <div class="row muted"><span>${dateStr}</span><span>${!isKitchen ? payLabel : ''}</span></div>
  ${showCustomer && d.customerName ? `<div class="muted">Pelanggan: ${esc(d.customerName)}</div>` : ''}
  ${showCashier && d.cashierName ? `<div class="muted">Kasir: ${esc(d.cashierName)}</div>` : ''}
  <div class="center queue">No. ${esc(String(d.orderNumber))}</div>
  <hr/>
  <table><tbody>
  ${d.items.map((it) => {
    const noteHtml = (it.note && showItemNotes) ? `<div class="note">- ${esc(it.note)}</div>` : ''

    if (it.isChild) {
      return `
      <tr>
        <td class="qty"></td>
        <td class="name child-item">
          ${it.quantity}x EXTRA ${esc(it.name)}${noteHtml}
        </td>
        ${!isKitchen ? `<td class="amt child-amt"><div class="child-amt-inner">${formatRupiah(it.subtotal)}</div></td>` : ''}
      </tr>`
    }

    return `
      <tr>
        <td class="qty">${it.quantity}x</td>
        <td class="name">${esc(it.name)}${noteHtml}</td>
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
  <div class="center muted" style="margin-top: 8px;">${footerText.split('\n').map((l) => esc(l)).join('<br/>')}</div>
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

    // Ambil layout cetak terpusat (fallback ke default bila gagal), lalu pilih
    // template sesuai jenis struk. Call site tak berubah — fetch di sini.
    ;(async () => {
      const layout = await fetchPrintLayout(createClient()).catch(() => DEFAULT_PRINT_LAYOUT)
      const tpl = data.receiptType === 'kitchen' ? layout.struk_dapur : layout.struk_customer

      // 1. Cek mode printer RawBT (Android Gateway Instant)
      if (typeof window !== 'undefined' && localStorage.getItem('printer_mode') === 'rawbt') {
        printViaRawBT(data, tpl)
        resolve()
        return
      }

      // 2. Cek apakah printer Bluetooth Web Bluetooth terkoneksi
      const store = usePrinterStore.getState();
      if (store.characteristic) {
        printViaBluetooth(data, tpl)
          .then(() => resolve())
          .catch(err => {
            console.error('Print Bluetooth gagal, mencoba RawBT atau fallback window.print', err);
            // Fallback ke RawBT jika di Android, atau ke window.print
            const printedRaw = printViaRawBT(data, tpl)
            if (!printedRaw) {
              fallbackPrint(data, resolve, tpl);
            } else {
              resolve()
            }
          });
        return;
      }

      // 3. Jika tidak terkoneksi, gunakan fallback HTML iframe window.print()
      fallbackPrint(data, resolve, tpl);
    })();
  });
}

function fallbackPrint(data: ReceiptData, resolve: () => void, tpl: CustomerLayout | KitchenLayout) {
    const origin = window.location.origin
    const logoUrl = data.logoUrl || `${origin}/logo.png`

    getBase64Image(logoUrl).then((base64Logo) => {
      // Override logoUrl temporarily
      const dataWithBase64 = { ...data, logoUrl: base64Logo }
      const html = buildReceiptHtml(dataWithBase64, origin, tpl)

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
            style.textContent = `@media print { @page { size: ${tpl.paperWidth}mm ${heightMm}mm; margin: 0; } }`
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
}


