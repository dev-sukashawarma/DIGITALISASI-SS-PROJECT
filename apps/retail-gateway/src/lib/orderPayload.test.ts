import { describe, it, expect } from 'vitest'
import { susunPayloadPos } from './orderPayload'

const dasar = {
  clientOrderId: '9197d153-2a29-4ca8-a123-a4a6ff8e1cbf',
  outletId: '44444444-4444-4444-4444-444444444444',
  customerName: 'Rizky Ananda',
  customerPhone: '+6281234567890',
  subtotal: 65000,
  discountAmount: 0,
  total: 65000,
  pickupCode: '4821',
  items: [
    { menu_item_id: 'm1', name: 'Shawarma Ayam Original', unit_price: 25000, quantity: 2 },
    { menu_item_id: 'm2', name: 'Es Kopi Susu', unit_price: 15000, quantity: 1, note: 'Kurangi gula' },
  ],
}

describe('susunPayloadPos', () => {
  it('tidak pernah mengirim order_number', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order).not.toHaveProperty('order_number')
  })

  it('menandai sumber sebagai aplikasi pelanggan', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order.source).toBe('app')
    expect(p_order.channel).toBe('app')
    expect(p_order.sales_source).toBe('app')
  })

  it('memakai client_order_id sebagai kunci idempotensi', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order.client_order_id).toBe('9197d153-2a29-4ca8-a123-a4a6ff8e1cbf')
  })

  it('masuk sebagai preparing dengan struk dapur belum tercetak', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order.status).toBe('preparing')
    expect(p_order.kitchen_receipt_printed).toBe(false)
  })

  it('menuliskan catatan item dengan konvensi pipe NOTE yang sudah ada', () => {
    const { p_items } = susunPayloadPos(dasar)
    expect(p_items[0].menu_item_name).toBe('Shawarma Ayam Original')
    expect(p_items[1].menu_item_name).toBe('Es Kopi Susu|NOTE|Kurangi gula')
  })

  it('menghitung subtotal per baris', () => {
    const { p_items } = susunPayloadPos(dasar)
    expect(p_items[0].subtotal).toBe(50000)
    expect(p_items[1].subtotal).toBe(15000)
  })

  it('menyertakan kode ambil di catatan pesanan', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(String(p_order.notes)).toContain('4821')
  })
})
