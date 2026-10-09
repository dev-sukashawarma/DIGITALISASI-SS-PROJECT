import { describe, it, expect } from 'vitest'
import { encodeDay, decodeDay } from './dayCodec'

const posOrder = {
  id: 'o1', order_number: 12, status: 'completed', payment_method: 'qris', total_amount: 45000,
  discount_amount: 5000, promo_subsidy: 0, created_at: '2026-09-20T12:00:00+07:00', outlet_id: 'x',
  channel: null, sales_source: 'pos_kasir', customer_name: 'Budi', cashier_name: 'Sari',
  external_order_id: null, is_endorse: false,
  order_items: [
    { id: 'i1', menu_item_id: 'm1', menu_item_name: 'Original Sapi|NOTE|pedas', quantity: 2, unit_price: 25000,
      subtotal: 50000, is_promo_reward: false, promo_id: null, promo_name: null, promo_buy_quantity: null,
      promo_get_quantity: null, original_unit_price: null, package_choices: { Saus: 'Keju' } },
  ],
}

const ecommerceOrder = {
  ...posOrder, id: 'e1', outlet_id: 'ss-online', raw_data: { admin_fee: 1000 },
  order_items: [{ id: 'i2', menu_item_id: 'm2', menu_item_name: 'Kebab', quantity: 1, unit_price: 20000, subtotal: 20000,
    package_choices: null, menu_items: { name: 'Kebab', hpp_override: 9000, channel_hpp: null } }],
}

describe('dayCodec', () => {
  it('round-trip mempertahankan semua kolom yang dipakai laporan', () => {
    const back = decodeDay(JSON.parse(JSON.stringify(encodeDay([posOrder, ecommerceOrder]))))
    expect(back[0]).toEqual(posOrder)
    // Item SS Online tidak punya kolom promo (undefined) → kembali sebagai null.
    // Setara bagi laporan: semua pemeriksaannya memakai truthiness / `??`
    // (dibuktikan uji kesetaraan data live 2026-09-25, termasuk 794 order SS Online).
    const { order_items: backItems, ...backOrder } = back[1]
    const { order_items: origItems, ...origOrder } = ecommerceOrder
    expect({ ...backOrder, is_endorse: backOrder.is_endorse }).toEqual(origOrder)
    expect(backItems[0]).toMatchObject(origItems[0])
    expect(backItems[0].is_promo_reward).toBeNull()
  })

  it('kolom yang memang tidak diambil tetap tidak ada (bukan null)', () => {
    const [o] = decodeDay(encodeDay([posOrder]))
    expect('raw_data' in o).toBe(false)
    expect('menu_items' in o.order_items[0]).toBe(false)
  })

  it('lebih ringkas dari JSON biasa', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ ...posOrder, id: `o${i}` }))
    expect(JSON.stringify(encodeDay(many)).length).toBeLessThan(JSON.stringify(many).length * 0.7)
  })

  it('versi format berbeda → kosong (cache lama diabaikan, bukan salah baca)', () => {
    expect(decodeDay({ v: 999, o: [] } as any)).toEqual([])
    expect(decodeDay(null)).toEqual([])
  })
})
