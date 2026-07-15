import { EscPosEncoder } from './escpos-encoder'

export interface PrinterConfig {
  paperWidth: 58 | 80          // mm
  showLogo: boolean
  headerText: string
  footerText: string
  density: 'normal' | 'padat'
  align: 'left' | 'center'
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: 58,
  showLogo: true,
  headerText: 'SUKA SHAWARMA',
  footerText: 'Terima kasih',
  density: 'normal',
  align: 'center',
}

const STORAGE_KEY = 'admin_printer_config'

export function loadPrinterConfig(): PrinterConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PRINTER_CONFIG }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG }
    const parsed = JSON.parse(raw) as Partial<PrinterConfig>
    return { ...DEFAULT_PRINTER_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_PRINTER_CONFIG }
  }
}

export function savePrinterConfig(config: PrinterConfig): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/** Lebar karakter per baris menurut ukuran kertas. */
export function charWidth(paperWidth: 58 | 80): number {
  return paperWidth === 80 ? 48 : 32
}

/** Bangun struk contoh untuk uji cetak, memakai preferensi aktif. */
export function buildSampleReceipt(config: PrinterConfig): Uint8Array {
  const w = charWidth(config.paperWidth)
  const enc = new EscPosEncoder()
  enc.initialize()

  if (config.align === 'center') enc.alignCenter()
  else enc.alignLeft()

  enc.bold(true).size(false, true).line(config.headerText).size(false, false).bold(false)
  enc.line('-- CONTOH STRUK / UJI CETAK --')
  enc.alignLeft().hr('-', w)
  enc.row('Item Contoh', 'Rp 10.000', ' ', w)
  enc.row('Item Kedua', 'Rp 25.000', ' ', w)
  enc.hr('-', w)
  enc.bold(true).row('TOTAL', 'Rp 35.000', ' ', w).bold(false)
  enc.hr('-', w)

  if (config.align === 'center') enc.alignCenter()
  enc.newline().line(config.footerText).newline()
  enc.cut()
  return enc.encode()
}
