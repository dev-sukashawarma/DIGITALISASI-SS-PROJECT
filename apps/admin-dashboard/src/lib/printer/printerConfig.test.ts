import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_PRINTER_CONFIG,
  loadPrinterConfig,
  savePrinterConfig,
  buildSampleReceipt,
  type PrinterConfig,
} from './printerConfig'

describe('printerConfig localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('mengembalikan default saat localStorage kosong', () => {
    expect(loadPrinterConfig()).toEqual(DEFAULT_PRINTER_CONFIG)
  })

  it('round-trip save lalu load', () => {
    const cfg: PrinterConfig = {
      ...DEFAULT_PRINTER_CONFIG,
      paperWidth: 80,
      showLogo: false,
      headerText: 'TOKO A',
      footerText: 'Sampai jumpa',
      density: 'padat',
      align: 'left',
    }
    savePrinterConfig(cfg)
    expect(loadPrinterConfig()).toEqual(cfg)
  })

  it('merge default bila JSON tersimpan tidak lengkap', () => {
    localStorage.setItem('admin_printer_config', JSON.stringify({ paperWidth: 80 }))
    const loaded = loadPrinterConfig()
    expect(loaded.paperWidth).toBe(80)
    expect(loaded.showLogo).toBe(DEFAULT_PRINTER_CONFIG.showLogo)
  })

  it('fallback ke default bila JSON korup', () => {
    localStorage.setItem('admin_printer_config', '{bukan json')
    expect(loadPrinterConfig()).toEqual(DEFAULT_PRINTER_CONFIG)
  })
})

describe('buildSampleReceipt', () => {
  it('menghasilkan bytes non-kosong', () => {
    const bytes = buildSampleReceipt(DEFAULT_PRINTER_CONFIG)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('80mm menghasilkan output berbeda dari 58mm (lebar berbeda)', () => {
    const a = buildSampleReceipt({ ...DEFAULT_PRINTER_CONFIG, paperWidth: 58 })
    const b = buildSampleReceipt({ ...DEFAULT_PRINTER_CONFIG, paperWidth: 80 })
    expect(b.length).not.toBe(a.length)
  })
})
