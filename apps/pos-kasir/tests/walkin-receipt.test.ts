import { describe, it, expect } from 'vitest'
import { buildReceiptHtml, type ReceiptData } from '@/lib/printReceipt'

const base: ReceiptData = {
  outletName: 'SUKA SHAWARMA KEMANG',
  orderNumber: 3742,
  dateISO: '2026-07-01T10:15:00.000Z',
  customerName: 'Budi',
  items: [
    { name: 'Shawarma Ayam', note: 'pedas', quantity: 2, unit_price: 25000, subtotal: 50000 },
    { name: 'Es Teh', quantity: 1, unit_price: 5000, subtotal: 5000 },
  ],
  subtotal: 55000,
  discount: 0,
  total: 55000,
  paymentMethod: 'cash',
  amountReceived: 100000,
  changeAmount: 45000,
}

describe('buildReceiptHtml', () => {
  it('menyertakan nama outlet, nomor antrian, dan item', () => {
    const html = buildReceiptHtml(base)
    expect(html).toContain('SUKA SHAWARMA KEMANG')
    expect(html).toContain('No. 3742')
    expect(html).toContain('Shawarma Ayam')
    expect(html).toContain('2x')
    expect(html).toContain('Budi')
  })

  it('untuk tunai menampilkan uang diterima & kembalian', () => {
    const html = buildReceiptHtml(base)
    expect(html).toContain('TUNAI')
    expect(html).toContain('Kembalian')
    // Rp100.000 & Rp45.000 (formatRupiah pakai pemisah ribuan id-ID)
    expect(html).toMatch(/100[.\s]?000/)
    expect(html).toMatch(/45[.\s]?000/)
  })

  it('untuk QRIS tidak menampilkan baris kembalian', () => {
    const html = buildReceiptHtml({ ...base, paymentMethod: 'qris', amountReceived: null, changeAmount: null })
    expect(html).toContain('QRIS')
    expect(html).not.toContain('Kembalian')
  })

  it('menampilkan baris diskon hanya bila ada', () => {
    const noDisc = buildReceiptHtml(base)
    expect(noDisc).not.toContain('Diskon')
    const withDisc = buildReceiptHtml({ ...base, discount: 5000, total: 50000 })
    expect(withDisc).toContain('Diskon')
  })

  it('meng-escape karakter HTML pada nama item', () => {
    const html = buildReceiptHtml({
      ...base,
      items: [{ name: 'Roti <b>& Keju</b>', quantity: 1, unit_price: 10000, subtotal: 10000 }],
    })
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('&amp;')
    expect(html).not.toContain('<b>& Keju</b>')
  })
})
