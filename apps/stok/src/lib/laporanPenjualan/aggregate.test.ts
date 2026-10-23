import { describe, it, expect } from 'vitest'
import {
  summarizeDay,
  buildAnalytics,
  channelMatches,
  channelKey,
  cleanMenuName,
  extractPackageDrinks,
  type RawOrder,
} from './aggregate'

const A = 'outlet-a', B = 'outlet-b', TES = 'outlet-tes'
const info = new Map([
  [A, { name: 'SUKA SHAWARMA A', cleanName: 'A', category: 'internal' as const }],
  [B, { name: 'MITRA B', cleanName: 'MITRA B', category: 'mitra' as const }],
])
const valid = new Set([A, B])

const order = (id: string, outlet: string | null, channel: string | null, at: string, total: number, items: [string, number, number][], status = 'completed'): RawOrder => ({
  id, status, channel, outlet_id: outlet, created_at: at, total_amount: total, discount_amount: 1000, promo_subsidy: 0,
  order_items: items.map(([menu_item_name, quantity, subtotal]) => ({ menu_item_name, quantity, subtotal })),
})

const day1 = summarizeDay([
  order('1', A, null, '2026-09-20T03:00:00Z', 50000, [['Sapi|NOTE|pedas', 2, 50000]]),       // 10:00 WIB
  order('2', B, 'gofood', '2026-09-20T05:00:00Z', 30000, [['Ayam', 1, 30000]]),              // 12:00 WIB
  order('3', TES, null, '2026-09-20T05:30:00Z', 99999, [['Sapi', 9, 99999]]),                 // outlet tak valid
  order('4', A, 'gofood', '2026-09-20T06:00:00Z', 0, [], 'cancelled'),
])
const day2 = summarizeDay([
  order('5', B, 'tiktok_go', '2026-09-21T11:00:00Z', 40000, [['Ayam', 1, 40000], ['Sapi', 1, 0]]), // 18:00 WIB
])

const build = (channelFilter = 'all', outletFilter = 'all') =>
  buildAnalytics([day1, day2], { channelFilter, outletFilter, validOutletIdSet: valid, outletInfoMap: info })

describe('Laporan Penjualan — ringkasan per hari', () => {
  it('semua outlet: outlet tak valid dibuang, batal dihitung', () => {
    const a = build()
    expect(a.totalOrders).toBe(3)
    expect(a.netRevenue).toBe(120000)
    expect(a.totalDeductions).toBe(3000)
    expect(a.totalRevenue).toBe(123000)
    expect(a.canceledCount).toBe(1)
    expect(a.hourly[10]).toBe(1)
    expect(a.hourlyPorsi[18]).toBe(2)
    expect(a.peakHour).toBe(10)
    expect(a.channelStats.tiktok.count).toBe(1)
    expect(a.bestSellers.map(i => i.name)).toEqual(['Sapi', 'Ayam']) // seri qty 3 vs 2
  })

  it('filter outlet spesifik tetap menghitung order outlet itu apa adanya', () => {
    const a = build('all', TES)
    expect(a.totalOrders).toBe(1)
    expect(a.outletVolumeList[0].outletName).toBe('outlet-t')
  })

  it('filter channel mengikuti aturan query lama (offline = channel NULL)', () => {
    expect(build('offline').totalOrders).toBe(1)
    expect(build('food_apps').totalOrders).toBe(2)
    expect(build('tiktok').totalOrders).toBe(1)
    expect(build('gofood').canceledCount).toBe(1)
    expect(channelMatches('offline', '')).toBe(false)
    expect(channelKey('')).toBe('offline')
    expect(channelKey('GrabFood')).toBe('grabfood')
  })

  it('urutan seri outlet = urutan kemunculan order pertamanya', () => {
    const d = summarizeDay([
      order('1', B, null, '2026-09-20T03:00:00Z', 1, [['X', 1, 1]]),
      order('2', A, null, '2026-09-20T04:00:00Z', 1, [['Y', 1, 1]]),
    ])
    const a = buildAnalytics([d], { channelFilter: 'all', outletFilter: 'all', validOutletIdSet: valid, outletInfoMap: info })
    expect(a.outletVolumeList.map(o => o.outletId)).toEqual([B, A])
  })

  it('nama menu dibersihkan dari metadata', () => {
    expect(cleanMenuName('Sapi|NOTE|pedas')).toBe('Sapi')
    expect(cleanMenuName('Combo #1|NOTE|Sedang (Paket: Orange Juice)')).toBe('Combo #1')
    expect(cleanMenuName('Combo #2 (Paket: Ice Tea)')).toBe('Combo #2')
    expect(cleanMenuName(null)).toBe('Item Tanpa Nama')
  })

  describe('Ekstraksi Minuman Paket (Suka Drink)', () => {
    it('ekstraksi dari package_choices via UUID', () => {
      const drinks = extractPackageDrinks({
        menu_item_name: 'Combo #1',
        package_choices: {
          'slot-1': 'c543b78e-3341-44e0-b3ef-53349e71e3d3', // Orange Juice
        },
      })
      expect(drinks).toEqual(['Orange Juice'])

      const tea = extractPackageDrinks({
        menu_item_name: 'Combo #2',
        package_choices: {
          'slot-1': '08a57f8f-f212-4205-a3eb-fb88066ae1b8', // Ice Tea
        },
      })
      expect(tea).toEqual(['Ice Tea'])
    })

    it('fallback ekstraksi dari note di menu_item_name jika package_choices kosong', () => {
      const drinks = extractPackageDrinks({
        menu_item_name: 'Combo #1|ID|123|NOTE|Paket: Orange Juice',
        package_choices: null,
      })
      expect(drinks).toEqual(['Orange Juice'])

      const drinksInParen = extractPackageDrinks({
        menu_item_name: 'Combo #2 UP SIZE BESAR|ID|456|NOTE|Ga pedas (Paket: Ice Tea)',
        package_choices: {},
      })
      expect(drinksInParen).toEqual(['Ice Tea'])
    })

    it('summarizeDay mencatat minuman paket sebagai DayItem companion dan menaikkan porsi', () => {
      const rawOrder: RawOrder = {
        id: 'ord-pkg-1',
        status: 'completed',
        channel: null,
        outlet_id: A,
        created_at: '2026-09-20T03:00:00Z',
        total_amount: 35000,
        discount_amount: 0,
        promo_subsidy: 0,
        order_items: [
          {
            menu_item_name: 'Combo #1|ID|abc|NOTE|Paket: Orange Juice',
            quantity: 2,
            subtotal: 70000,
            package_choices: {
              'slot-1': 'c543b78e-3341-44e0-b3ef-53349e71e3d3',
            },
          },
        ],
      }

      const day = summarizeDay([rawOrder])

      // Package item
      const pkgItem = day.items.find(i => i.name === 'Combo #1')
      expect(pkgItem).toBeDefined()
      expect(pkgItem?.qty).toBe(2)
      expect(pkgItem?.rev).toBe(70000)
      expect(pkgItem?.fromPackage).toBeNull()

      // Drink companion item
      const drinkItem = day.items.find(i => i.name === 'Orange Juice')
      expect(drinkItem).toBeDefined()
      expect(drinkItem?.qty).toBe(2)
      expect(drinkItem?.rev).toBe(0)
      expect(drinkItem?.fromPackage).toBe('Combo #1')

      // g.porsi mencatat porsi combo + porsi minuman yang disiapkan dapur = 2 + 2 = 4
      expect(day.groups[0].porsi).toBe(4)
    })

    it('buildAnalytics menampilkan minuman ber-flag di bestSellers dengan qty tepat', () => {
      const rawOrder: RawOrder = {
        id: 'ord-pkg-2',
        status: 'completed',
        channel: null,
        outlet_id: A,
        created_at: '2026-09-20T03:00:00Z',
        total_amount: 35000,
        discount_amount: 0,
        promo_subsidy: 0,
        order_items: [
          {
            menu_item_name: 'Combo #1|ID|abc|NOTE|Paket: Orange Juice',
            quantity: 3,
            subtotal: 105000,
            package_choices: {
              'slot-1': 'c543b78e-3341-44e0-b3ef-53349e71e3d3',
            },
          },
          {
            menu_item_name: 'Orange Juice', // standalone
            quantity: 1,
            subtotal: 15000,
            package_choices: null,
          },
        ],
      }

      const day = summarizeDay([rawOrder])
      const analytics = buildAnalytics([day], {
        channelFilter: 'all',
        outletFilter: 'all',
        validOutletIdSet: valid,
        outletInfoMap: info,
      })

      // bestSellers harus memiliki:
      // 1. Combo #1 (qty: 3, rev: 105000)
      // 2. Orange Juice dari Combo #1 (qty: 3, rev: 0, fromPackage: "Combo #1")
      // 3. Orange Juice standalone (qty: 1, rev: 15000, fromPackage: null)
      expect(analytics.bestSellers.length).toBe(3)

      const combo = analytics.bestSellers.find(i => i.name === 'Combo #1')
      expect(combo?.qty).toBe(3)
      expect(combo?.revenue).toBe(105000)

      const drinkFromPkg = analytics.bestSellers.find(i => i.name === 'Orange Juice' && i.fromPackage === 'Combo #1')
      expect(drinkFromPkg?.qty).toBe(3)
      expect(drinkFromPkg?.revenue).toBe(0)

      const standaloneDrink = analytics.bestSellers.find(i => i.name === 'Orange Juice' && !i.fromPackage)
      expect(standaloneDrink?.qty).toBe(1)
      expect(standaloneDrink?.revenue).toBe(15000)

      // Total porsi = 3 (combo) + 3 (drink combo) + 1 (drink standalone) = 7
      expect(analytics.totalItemsSold).toBe(7)
    })
  })
})
