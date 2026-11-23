import { describe, expect, it } from 'vitest'
import {
  buildMenuMaps,
  buildPenerapHpp,
  computeAnalytics,
  computeItemBreakdown,
  formatBestSellerItemName,
  type OrderRow,
} from './compute'

function buatOrder(
  id: string,
  opts: {
    outlet_id?: string
    channel?: string | null
    sales_source?: string | null
    customer_name?: string | null
    is_endorse?: boolean
    items: Array<{ id?: string; menu_item_id?: string | null; name: string; qty: number; subtotal: number }>
  },
): OrderRow {
  const total = opts.items.reduce((s, i) => s + i.subtotal, 0)
  return {
    id,
    order_number: 1,
    status: 'completed',
    payment_method: 'qris',
    total_amount: total,
    created_at: '2026-11-20T05:00:00.000Z',
    outlet_id: opts.outlet_id ?? 'out-1',
    channel: opts.channel ?? null,
    sales_source: opts.sales_source ?? null,
    customer_name: opts.customer_name ?? 'Pelanggan',
    is_endorse: opts.is_endorse ?? false,
    order_items: opts.items.map((it, idx) => ({
      id: it.id ?? `${id}-i${idx}`,
      menu_item_id: it.menu_item_id ?? null,
      menu_item_name: it.name,
      quantity: it.qty,
      unit_price: it.qty > 0 ? it.subtotal / it.qty : 0,
      subtotal: it.subtotal,
    })),
  }
}

describe('formatBestSellerItemName & bestSellers ("Item Yang Terjual")', () => {
  it('memberi kode [TTGO], [FA], [WEB], [SSO] dan CAPSLOCK sesuai sumber pesanan', () => {
    expect(
      formatBestSellerItemName('Original Sapi Sedang|ID|123|NOTE|pedas', {
        outlet_id: 'out-1',
        channel: 'tiktokgo',
        sales_source: 'tiktok',
      }),
    ).toBe('[TTGO] ORIGINAL SAPI SEDANG')

    expect(
      formatBestSellerItemName('Original Sapi Sedang', {
        outlet_id: 'out-1',
        channel: 'gofood',
        sales_source: 'gofood',
      }),
    ).toBe('[FA] ORIGINAL SAPI SEDANG')

    expect(
      formatBestSellerItemName('Combo #1 UP SIZE BESAR', {
        outlet_id: 'out-1',
        channel: 'grabfood',
        sales_source: 'grabfood',
      }),
    ).toBe('[FA] COMBO #1 UP SIZE BESAR')

    expect(
      formatBestSellerItemName('Suka Beef', {
        outlet_id: 'out-1',
        channel: 'shopeefood',
        sales_source: 'shopeefood',
      }),
    ).toBe('[FA] SUKA BEEF')

    expect(
      formatBestSellerItemName('Original Ayam Jumbo', {
        outlet_id: 'out-1',
        channel: 'online',
        sales_source: 'online',
      }),
    ).toBe('[WEB] ORIGINAL AYAM JUMBO')

    expect(
      formatBestSellerItemName('Shawarma Frozen Pack', {
        outlet_id: 'ss-online',
        channel: 'tiktok_shop',
        sales_source: 'Online',
      }),
    ).toBe('[SSO] SHAWARMA FROZEN PACK')

    expect(
      formatBestSellerItemName('Original Sapi Besar', {
        outlet_id: 'out-1',
        channel: 'pos_kasir',
        sales_source: 'pos_kasir',
        customer_name: 'Walk-in',
      }),
    ).toBe('ORIGINAL SAPI BESAR')
  })

  it('mencegah duplikasi prefix pada data Pawoon FA atau nama yang sudah ber-prefix, tanpa salah memotong kata seperti FAMILY/FAVORITE', () => {
    expect(
      formatBestSellerItemName('FA Original Sapi Sedang', {
        outlet_id: 'out-1',
        channel: null,
        sales_source: 'pos',
        customer_name: 'Pawoon Import',
      }),
    ).toBe('[FA] ORIGINAL SAPI SEDANG')

    expect(
      formatBestSellerItemName('[TTGO] Suka Duo Favorite', {
        outlet_id: 'out-1',
        channel: 'tiktokgo',
        sales_source: 'tiktok',
      }),
    ).toBe('[TTGO] SUKA DUO FAVORITE')

    // Kata biasa berawalan FA di POS Kasir tidak boleh dianggap kode FA
    expect(
      formatBestSellerItemName('Family Pack Favorite', {
        outlet_id: 'out-1',
        channel: 'pos_kasir',
        sales_source: 'pos_kasir',
        customer_name: 'Budi',
      }),
    ).toBe('FAMILY PACK FAVORITE')
  })

  it('menggabungkan item beda huruf besar/kecil per grup sumber di bestSellers tanpa merusak mapping HPP & Rekap Rincian Item Terjual', () => {
    const menus = [
      { id: 'm-sapi', name: 'Original Sapi Sedang', hpp_override: 12000, channel_hpp: { ss_online: 15000 }, is_available: true, categories: { name: 'Main' } },
      { id: 'm-combo', name: 'Combo #1 UP SIZE BESAR', hpp_override: 18000, channel_hpp: {}, is_available: true, categories: { name: 'Combo' } },
    ]
    const riwayat = [
      { menu_item_id: 'm-sapi', kunci: 'hpp_override', nilai: 12000, berlaku_mulai: '2026-01-01' },
      { menu_item_id: 'm-sapi', kunci: 'ss_online', nilai: 15000, berlaku_mulai: '2026-01-01' },
      { menu_item_id: 'm-combo', kunci: 'hpp_override', nilai: 18000, berlaku_mulai: '2026-01-01' },
    ]
    const { menuItemByNameMap, menuItemByIdMap } = buildMenuMaps(menus)
    const penerapHpp = buildPenerapHpp(menus, riwayat)
    const outlets = [{ id: 'out-1', type: 'internal' }]

    const orders: OrderRow[] = [
      // POS Kasir: nama campur huruf besar & kecil tanpa menu_item_id -> HPP tetap harus ketemu via byName!
      buatOrder('o1', {
        channel: 'pos_kasir',
        sales_source: 'pos_kasir',
        items: [
          { name: 'Original Sapi Sedang', qty: 2, subtotal: 60000 },
          { name: 'ORIGINAL SAPI SEDANG', qty: 3, subtotal: 90000 },
        ],
      }),
      // GoFood + ShopeeFood -> tergabung di [FA] ORIGINAL SAPI SEDANG
      buatOrder('o2', {
        channel: 'gofood',
        sales_source: 'gofood',
        items: [{ name: 'Original Sapi Sedang', qty: 4, subtotal: 140000 }],
      }),
      buatOrder('o3', {
        channel: 'shopeefood',
        sales_source: 'shopeefood',
        items: [{ name: 'original sapi sedang', qty: 2, subtotal: 70000 }],
      }),
      // TikTok Go -> [TTGO] COMBO #1 UP SIZE BESAR
      buatOrder('o4', {
        channel: 'tiktokgo',
        sales_source: 'tiktok',
        items: [{ name: 'Combo #1 UP SIZE BESAR', qty: 3, subtotal: 120000 }],
      }),
      // Website -> [WEB] ORIGINAL SAPI SEDANG
      buatOrder('o5', {
        channel: 'online',
        sales_source: 'online',
        items: [{ name: 'Original Sapi Sedang', qty: 1, subtotal: 30000 }],
      }),
      // SS Online -> [SSO] ORIGINAL SAPI SEDANG (memakai HPP ss_online = 15000)
      buatOrder('o6', {
        outlet_id: 'ss-online',
        channel: 'tiktok_shop',
        sales_source: 'Online',
        items: [{ menu_item_id: 'm-sapi', name: 'Original Sapi Sedang', qty: 2, subtotal: 80000 }],
      }),
    ]

    const analytics = computeAnalytics({
      orders,
      shifts: [],
      selectedChannels: ['all'],
      menuItemByNameMap,
      menuItemByIdMap,
      penerapHpp,
      settlements: [],
      isSSOnlineSelected: false,
      outlets,
    })

    expect(analytics.bestSellers).toEqual([
      { name: '[FA] ORIGINAL SAPI SEDANG', qty: 6, revenue: 210000 },
      { name: 'ORIGINAL SAPI SEDANG', qty: 5, revenue: 150000 },
      { name: '[TTGO] COMBO #1 UP SIZE BESAR', qty: 3, revenue: 120000 },
      { name: '[SSO] ORIGINAL SAPI SEDANG', qty: 2, revenue: 80000 },
      { name: '[WEB] ORIGINAL SAPI SEDANG', qty: 1, revenue: 30000 },
    ])

    // HPP harus tepat 100%:
    // (2 + 3 + 4 + 2 + 1) * 12.000 + 3 * 18.000 + 2 * 15.000 = 144.000 + 54.000 + 30.000 = 228.000
    expect(analytics.totalHPP).toBe(228000)

    // Rekap Rincian Item Terjual (computeItemBreakdown) tidak ikut berubah formatnya
    const breakdown = computeItemBreakdown(orders, outlets, penerapHpp)
    expect(breakdown.some(b => b.groupLabel === 'FOOD APPS')).toBe(true)
    expect(breakdown.some(b => b.groupLabel === 'TIKTOK')).toBe(true)
  })
})
