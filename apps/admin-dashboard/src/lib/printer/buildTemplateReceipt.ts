import { EscPosEncoder } from './escpos-encoder'
import { loadImageRaster } from './escpos-image'
import type { PrintLayout, PaperWidth } from './printLayout'

function charWidth(w: PaperWidth): number { return w === 80 ? 48 : 32 }

async function addLogo(
  enc: EscPosEncoder,
  showLogo: boolean,
  paperWidth: PaperWidth,
  logoUrl?: string,
): Promise<void> {
  if (!showLogo || !logoUrl) return
  try {
    const raster = await loadImageRaster(logoUrl, paperWidth === 80 ? 384 : 240)
    if (raster) enc.alignCenter().raster(raster.bytes, raster.widthBytes, raster.height).newline()
  } catch { /* lewati logo */ }
}

/**
 * Bangun struk contoh (uji cetak) sebagai byte ESC/POS untuk printer thermal.
 * Menerapkan logo (raster), ukuran kasar (dobel tinggi bila font besar) & bold.
 * `logoUrl` opsional; bila canvas/gambar gagal, logo dilewati (sisa tetap tercetak).
 */
export async function buildTemplateReceipt(
  template: keyof PrintLayout,
  layout: PrintLayout,
  logoUrl?: string,
): Promise<Uint8Array> {
  const enc = new EscPosEncoder()
  enc.initialize()

  if (template === 'qr_surat_jalan') {
    const c = layout.qr_surat_jalan
    const w = charWidth(c.paperWidth)
    await addLogo(enc, c.showLogo, c.paperWidth, logoUrl)
    enc.alignCenter().bold(true).size(false, true).line(c.title).size(false, false).bold(false)
    enc.line('[ QR ' + c.qrSizeMm + 'mm ]').hr('-', w)
    for (const ln of c.footerText.split('\n')) enc.line(ln)
    enc.cut()
    return enc.encode()
  }

  if (template === 'struk_dapur') {
    const c = layout.struk_dapur
    const w = charWidth(c.paperWidth)
    const big = (c.fontSizePx ?? 0) >= 26
    const bold = c.bold !== false
    await addLogo(enc, c.showLogo, c.paperWidth, logoUrl)
    enc.alignCenter().bold(true).size(false, true).line(c.headerText || 'STRUK DAPUR').size(false, false).bold(false)
    enc.alignLeft().hr('-', w)
    if (c.showCustomer) enc.line('Pelanggan: Contoh')
    enc.alignCenter().bold(true).size(false, true).line('No. 123').size(false, false).bold(false).alignLeft()
    enc.hr('-', w)
    enc.size(false, big).bold(bold)
    enc.line('1x Shawarma Ayam')
    enc.line('  EXTRA Keju')
    enc.line('  EXTRA Kentang')
    enc.line('2x Kebab Daging')
    enc.size(false, false).bold(false)
    enc.cut()
    return enc.encode()
  }

  // struk_customer
  const c = layout.struk_customer
  const w = charWidth(c.paperWidth)
  const big = (c.fontSizePx ?? 0) >= 18
  const bold = c.bold !== false
  await addLogo(enc, c.showLogo, c.paperWidth, logoUrl)
  enc.alignCenter().bold(true).size(false, true).line(c.headerText || 'SUKA SHAWARMA').size(false, false).bold(false)
  enc.line('Suka Shawarma').alignLeft().hr('-', w)
  if (c.showCashier) enc.line('Kasir: Contoh')
  if (c.showCustomer) enc.line('Pelanggan: Contoh')
  enc.alignCenter().bold(true).size(false, true).line('No. 123').size(false, false).bold(false).alignLeft()
  enc.hr('-', w)
  enc.size(false, big).bold(bold)
  enc.row('1x Shawarma Ayam', 'Rp 25.000', ' ', w)
  if (c.showItemNotes) enc.line(' - pedas, tanpa bawang')
  enc.row('  EXTRA Keju', 'Rp 5.000', ' ', w)
  enc.row('  EXTRA Kentang', 'Rp 5.000', ' ', w)
  enc.row('2x Kebab Daging', 'Rp 50.000', ' ', w)
  enc.size(false, false).bold(false)
  enc.hr('-', w)
  enc.bold(true).row('TOTAL', 'Rp 85.000', ' ', w).bold(false).hr('-', w)
  enc.alignCenter()
  for (const ln of c.footerText.split('\n')) enc.line(ln)
  enc.cut()
  return enc.encode()
}
