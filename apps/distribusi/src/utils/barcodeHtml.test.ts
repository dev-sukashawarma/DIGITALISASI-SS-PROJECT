import { describe, it, expect } from 'vitest'
import { buildBarcodeHtml } from './generatePDF'
import { DEFAULT_PRINT_LAYOUT } from './printLayout'

describe('buildBarcodeHtml', () => {
  it('default: judul, footer, ukuran QR & kertas seperti sekarang (no-regresi)', () => {
    const html = buildBarcodeHtml('SJ-001', 'data:img', DEFAULT_PRINT_LAYOUT.qr_surat_jalan)
    expect(html).toContain('VERIFIKASI SJ')
    expect(html).toContain('Distribusi<br/>Suka Shawarma')
    expect(html).toContain('SJ-001')
    expect(html).toContain('45mm')
    expect(html).toContain('58mm')
    // default tanpa logo
    expect(html).not.toContain('object-fit:contain')
  })
  it('override judul/qr/paper', () => {
    const html = buildBarcodeHtml('SJ-002', 'data:img', {
      ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, title: 'CEK SJ', qrSizeMm: 60, paperWidth: 80,
    })
    expect(html).toContain('CEK SJ')
    expect(html).toContain('60mm')
    expect(html).toContain('80mm')
  })
  it('showLogo:true menyisipkan logo', () => {
    const html = buildBarcodeHtml('SJ-003', 'data:img', { ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, showLogo: true })
    expect(html).toContain('object-fit:contain')
  })

  it('default tipografi = tampilan lama (Courier, weight 900, padding 2mm)', () => {
    const html = buildBarcodeHtml('SJ-004', 'data:img', DEFAULT_PRINT_LAYOUT.qr_surat_jalan)
    expect(html).toContain(`'Courier New', Courier, monospace`)
    expect(html).toContain('font-weight: 900')
    expect(html).toContain('padding: 2mm')
  })

  it('fontFamily/bold/fontSizePx/margin diterapkan', () => {
    const html = buildBarcodeHtml('SJ-005', 'data:img', {
      ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, fontFamily: 'serif', bold: false, fontSizePx: 26, marginMm: 5,
    })
    expect(html).toContain(`'Times New Roman', Times, serif`)
    expect(html).toContain('font-weight: 400')
    expect(html).toContain('padding: 5mm')
    expect(html).toContain('font-size: 32px') // .title 16 * (26/13)=2
  })
})
