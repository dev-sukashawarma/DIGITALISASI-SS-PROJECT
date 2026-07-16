import { describe, it, expect } from 'vitest'
import { buildReceiptHtml, type ReceiptData } from './printReceipt'
import { DEFAULT_PRINT_LAYOUT } from './printLayout'

const base: ReceiptData = {
  outletName: 'OUTLET X', orderNumber: 7, dateISO: '2026-07-15T10:00:00Z',
  customerName: 'Budi', items: [
    { name: 'Shawarma', quantity: 1, unit_price: 25000, subtotal: 25000, note: 'pedas' },
    { name: 'Keju', quantity: 1, unit_price: 5000, subtotal: 5000, isChild: true },
  ],
  subtotal: 30000, discount: 0, total: 30000, paymentMethod: 'cash',
  amountReceived: 50000, changeAmount: 20000, cashierName: 'Sari', receiptType: 'customer',
}

describe('buildReceiptHtml layout', () => {
  it('default: catatan, kasir, extra topping tampil', () => {
    const html = buildReceiptHtml(base, '', DEFAULT_PRINT_LAYOUT.struk_customer)
    expect(html).toContain('pedas')
    expect(html).toContain('Kasir: Sari')
    expect(html).toContain('EXTRA Keju')
  })
  it('showItemNotes:false menyembunyikan catatan', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, showItemNotes: false })
    expect(html).not.toContain('pedas')
  })
  it('showCashier:false menyembunyikan baris kasir', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, showCashier: false })
    expect(html).not.toContain('Kasir: Sari')
  })
  it('paperWidth 80 → @page 80mm', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, paperWidth: 80 })
    expect(html).toContain('80mm')
  })

  it('struk dapur default: ukuran font TIDAK di-skala (no-regresi)', () => {
    // struk_dapur.fontScale default = 'besar', tapi cabang kitchen sudah pakai px besar.
    // Pastikan tak dikalikan lagi: body tetap 22px (bukan 29px).
    const kitchen: ReceiptData = { ...base, receiptType: 'kitchen' }
    const html = buildReceiptHtml(kitchen, '', DEFAULT_PRINT_LAYOUT.struk_dapur)
    expect(html).toContain('font-size: 22px')
    expect(html).not.toContain('font-size: 29px')
  })

  it('default tipografi = tampilan lama (Courier, weight 900, padding 2mm)', () => {
    const html = buildReceiptHtml(base, '', DEFAULT_PRINT_LAYOUT.struk_customer)
    expect(html).toContain(`font-family: 'Courier New', Courier, monospace`)
    expect(html).toContain('font-weight: 900')
    expect(html).toContain('padding: 2mm')
    expect(html).toContain('font-size: 14px') // basis customer
  })

  it('fontFamily sans → font stack sans', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, fontFamily: 'sans' })
    expect(html).toContain('Arial, Helvetica, sans-serif')
  })

  it('bold:false → weight 400', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, bold: false })
    expect(html).toContain('font-weight: 400')
  })

  it('fontSizePx 28 → basis menskala (14→28)', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, fontSizePx: 28 })
    expect(html).toContain('font-size: 28px')
  })

  it('marginMm 5 → padding 5mm', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, marginMm: 5 })
    expect(html).toContain('padding: 5mm')
  })
})
