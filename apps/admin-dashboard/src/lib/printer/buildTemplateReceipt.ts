import { EscPosEncoder } from './escpos-encoder'
import type { PrintLayout, PaperWidth } from './printLayout'

function charWidth(w: PaperWidth): number { return w === 80 ? 48 : 32 }

export function buildTemplateReceipt(
  template: keyof PrintLayout,
  layout: PrintLayout,
): Uint8Array {
  const enc = new EscPosEncoder()
  enc.initialize()

  if (template === 'qr_surat_jalan') {
    const c = layout.qr_surat_jalan
    const w = charWidth(c.paperWidth)
    enc.alignCenter().bold(true).size(false, true).line(c.title).size(false, false).bold(false)
    enc.line('[ QR ' + c.qrSizeMm + 'mm ]').hr('-', w)
    for (const ln of c.footerText.split('\n')) enc.line(ln)
    enc.cut()
    return enc.encode()
  }

  if (template === 'struk_dapur') {
    const c = layout.struk_dapur
    const w = charWidth(c.paperWidth)
    enc.alignCenter().bold(true).size(false, true).line(c.headerText || 'STRUK DAPUR').size(false, false).bold(false)
    enc.alignLeft().hr('-', w)
    if (c.showCustomer) enc.line('Pelanggan: Contoh')
    enc.line('No. 123').hr('-', w)
    enc.line('1x Shawarma Ayam')
    enc.line('  EXTRA Keju')
    enc.line('  EXTRA Kentang')
    enc.line('2x Kebab Daging')
    enc.cut()
    return enc.encode()
  }

  // struk_customer
  const c = layout.struk_customer
  const w = charWidth(c.paperWidth)
  enc.alignCenter().bold(true).size(false, c.fontScale === 'besar')
    .line(c.headerText || 'SUKA SHAWARMA').size(false, false).bold(false)
  enc.line('Suka Shawarma').alignLeft().hr('-', w)
  if (c.showCashier) enc.line('Kasir: Contoh')
  if (c.showCustomer) enc.line('Pelanggan: Contoh')
  enc.hr('-', w)
  enc.row('1x Shawarma Ayam', 'Rp 25.000', ' ', w)
  if (c.showItemNotes) enc.line(' - pedas, tanpa bawang')
  enc.row('  EXTRA Keju', 'Rp 5.000', ' ', w)
  enc.row('  EXTRA Kentang', 'Rp 5.000', ' ', w)
  enc.row('2x Kebab Daging', 'Rp 50.000', ' ', w)
  enc.hr('-', w)
  enc.bold(true).row('TOTAL', 'Rp 85.000', ' ', w).bold(false).hr('-', w)
  enc.alignCenter()
  for (const ln of c.footerText.split('\n')) enc.line(ln)
  enc.cut()
  return enc.encode()
}
