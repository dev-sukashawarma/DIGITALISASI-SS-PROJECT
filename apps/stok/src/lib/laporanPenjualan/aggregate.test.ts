import { describe, it, expect } from 'vitest'
import {
  summarizeDay,
  buildAnalytics,
  channelMatches,
  kanalOrder,
  cleanMenuName,
  extractPackageDrinks,
  minumanPaket,
  susunPaketMinuman,
  MINUMAN_TAK_TERCATAT,
  type PaketMinumanMap,
  type RawOrder,
} from './aggregate'

const A = 'outlet-a', B = 'outlet-b', TES = 'outlet-tes'
const info = new Map([
  [A, { name: 'SUKA SHAWARMA A', cleanName: 'A', category: 'internal' as const }],
  [B, { name: 'MITRA B', cleanName: 'MITRA B', category: 'mitra' as const }],
])
const valid = new Set([A, B])

const order = (id: string, outlet: string | null, channel: string | null, at: string, total: number, items: [string, number, number][], status = 'completed', sales_source: string | null = 'pos'): RawOrder => ({
  id, status, channel, sales_source, outlet_id: outlet, created_at: at, total_amount: total, discount_amount: 1000, promo_subsidy: 0,
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

  it('order batal memakai saringan outlet yang sama dengan order selesai', () => {
    const hari = summarizeDay([
      order('b1', A, null, '2026-09-22T03:00:00Z', 0, [], 'cancelled'),
      order('b2', TES, null, '2026-09-22T03:10:00Z', 0, [], 'cancelled'),   // outlet tes
      order('b3', null, null, '2026-09-22T03:20:00Z', 0, [], 'cancelled'),  // tanpa outlet
      order('c1', null, null, '2026-09-22T03:30:00Z', 10000, [['Sapi', 1, 10000]]),
    ])
    const semua = buildAnalytics([hari], { channelFilter: 'all', outletFilter: 'all', validOutletIdSet: valid, outletInfoMap: info })
    expect(semua.canceledCount).toBe(1)
    // order selesai tanpa outlet juga tidak ikut "semua outlet"
    expect(semua.totalOrders).toBe(0)
    const tes = buildAnalytics([hari], { channelFilter: 'all', outletFilter: TES, validOutletIdSet: valid, outletInfoMap: info })
    expect(tes.canceledCount).toBe(1)
  })

  it('label kanal tiktok = TikTok GO (food app), bukan TikTok Shop', () => {
    expect(build().channelStats.tiktok.label).toBe('TikTok GO')
  })

  it('filter outlet spesifik tetap menghitung order outlet itu apa adanya', () => {
    const a = build('all', TES)
    expect(a.totalOrders).toBe(1)
    expect(a.outletVolumeList[0].outletName).toBe('outlet-t')
  })

  it('filter channel memakai kunci kanal (offline, food apps, tiktok, gofood)', () => {
    expect(build('offline').totalOrders).toBe(1)
    expect(build('food_apps').totalOrders).toBe(2)
    expect(build('tiktok').totalOrders).toBe(1)
    expect(build('gofood').canceledCount).toBe(1)
    expect(channelMatches('food_apps', 'tiktok')).toBe(true)
    expect(channelMatches('food_apps', 'website')).toBe(false)
    expect(channelMatches('tiktokgo', 'tiktok')).toBe(true)
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

  describe('Kanal penjualan (keputusan owner)', () => {
    it('kanalOrder memetakan channel + sales_source', () => {
      expect(kanalOrder(null, 'pos')).toBe('offline')
      expect(kanalOrder(null, null)).toBe('offline')
      expect(kanalOrder('', 'pos')).toBe('offline')
      expect(kanalOrder('pos', 'pos')).toBe('offline')
      expect(kanalOrder('preorder_wa', 'pos')).toBe('offline')
      expect(kanalOrder(null, 'online')).toBe('website')
      expect(kanalOrder('website', 'pos')).toBe('website')
      expect(kanalOrder('direct_web', 'online')).toBe('website')
      expect(kanalOrder('gofood', 'online')).toBe('gofood')
      expect(kanalOrder('GrabFood', 'pos')).toBe('grabfood')
      expect(kanalOrder('shopeefood', 'shopeefood')).toBe('shopeefood')
      expect(kanalOrder('tiktokgo', 'tiktok')).toBe('tiktok')
      expect(kanalOrder('tiktok_go', 'pos')).toBe('tiktok')
      expect(kanalOrder('endorse', 'pos')).toBe('endorse')
      expect(kanalOrder('app', 'app')).toBe('lainnya')
    })

    const hari = summarizeDay([
      order('k1', A, null, '2026-11-20T03:00:00Z', 50000, [['Sapi', 1, 50000]]),                         // kasir 10:00
      order('k2', A, 'preorder_wa', '2026-11-20T03:10:00Z', 70000, [['Ayam', 2, 70000]]),               // PreOrder WA
      order('k3', A, null, '2026-11-20T03:20:00Z', 40000, [['Sapi', 1, 40000]], 'completed', 'online'),  // website
      order('k4', A, 'endorse', '2026-11-20T04:00:00Z', 0, [['Sapi', 3, 0]]),                           // endorse 11:00
      order('k5', A, 'endorse', '2026-11-20T04:10:00Z', 0, [], 'cancelled'),                            // endorse batal
      order('k6', A, null, '2026-11-20T04:20:00Z', 0, [], 'cancelled', 'online'),                        // website batal
    ])
    const b = (channelFilter: string) =>
      buildAnalytics([hari], { channelFilter, outletFilter: 'all', validOutletIdSet: valid, outletInfoMap: info })

    it('PreOrder WA masuk Offline, website jadi kanal sendiri', () => {
      const a = b('all')
      expect(a.channelStats.offline.count).toBe(2)
      expect(a.channelStats.offline.revenue).toBe(120000)
      expect(a.channelStats.website.count).toBe(1)
      expect(a.channelStats.website.revenue).toBe(40000)
      expect(a.channelStats.lainnya.count).toBe(0)
      expect(b('offline').totalOrders).toBe(2)
      expect(b('website').totalOrders).toBe(1)
      expect(b('website').canceledCount).toBe(1)
    })

    it('endorse: bukan transaksi (tidak masuk jumlah order, rata-rata, jam, batal) tapi porsinya dihitung', () => {
      const a = b('all')
      expect(a.totalOrders).toBe(3)
      expect(a.netRevenue).toBe(160000)
      expect(a.avgOrderValue).toBe(Math.round(160000 / 3))
      expect(a.canceledCount).toBe(1) // hanya website batal
      expect(a.hourly[11]).toBe(0)     // jam 11 WIB hanya order endorse
      expect(a.hourlyPorsi[11]).toBe(3)
      expect(a.totalItemsSold).toBe(1 + 2 + 1 + 3)
      expect(a.channelStats.endorse.count).toBe(0)
      expect(a.channelStats.endorse.porsi).toBe(3)
      expect(a.channelStats.endorse.pesananTakDihitung).toBe(1)
      expect(a.outletVolumeList[0].totalOrders).toBe(3)
      expect(a.outletVolumeList[0].itemsSold).toBe(7)
      expect(a.peakHour).toBe(10)
    })
  })

  describe('Minuman komponen paket (pilihan maupun tetap)', () => {
    const ITEMS = [
      { id: 'p-aqua', name: 'AYAM BESAR + AQUA', categories: { name: 'Promo Bundling Aqua' } },
      { id: 'p-combo', name: 'Combo #1', categories: { name: 'Combo' } },
      { id: 'p-c4', name: 'Combo 4', categories: { name: 'Combo' } },
      { id: 'p-tanpa', name: 'SHAWARMA DUO COMBO', categories: { name: 'Combo' } },
      { id: 'm-ayam', name: 'Original Ayam Besar', categories: { name: 'Original Shawarma Ayam' } },
      { id: 'm-aqua', name: 'Aqua', categories: { name: 'Suka Drink' } },
      { id: 'm-tea', name: 'Ice Tea', categories: { name: 'Suka Drink' } },
      { id: 'm-oj', name: 'Orange Juice', categories: { name: 'Suka Drink' } },
    ]
    const SLOTS = [
      { id: 's1', package_id: 'p-aqua', menu_item_id: 'm-ayam', or_menu_item_id: null, quantity: 1 },
      { id: 's2', package_id: 'p-aqua', menu_item_id: 'm-aqua', or_menu_item_id: null, quantity: 1 },
      { id: 's3', package_id: 'p-combo', menu_item_id: 'm-ayam', or_menu_item_id: null, quantity: 1 },
      { id: 's4', package_id: 'p-combo', menu_item_id: 'm-tea', or_menu_item_id: 'm-oj', quantity: 1 },
      { id: 's5', package_id: 'p-c4', menu_item_id: 'm-tea', or_menu_item_id: 'm-oj', quantity: 2 },
      { id: 's6', package_id: 'p-tanpa', menu_item_id: 'm-ayam', or_menu_item_id: null, quantity: 2 },
    ]
    const paket: PaketMinumanMap = susunPaketMinuman(SLOTS, ITEMS)

    it('susunPaketMinuman hanya menyimpan slot minuman', () => {
      expect(paket['p-aqua']).toEqual([{ qty: 1, opsi: [{ id: 'm-aqua', name: 'Aqua' }] }])
      expect(paket['p-combo']).toEqual([{ qty: 1, opsi: [{ id: 'm-tea', name: 'Ice Tea' }, { id: 'm-oj', name: 'Orange Juice' }] }])
      expect(paket['p-tanpa']).toBeUndefined()
    })

    it('minuman tetap (+ AQUA) ikut dihitung', () => {
      expect(minumanPaket({ menu_item_id: 'p-aqua', menu_item_name: 'AYAM BESAR + AQUA' }, paket)).toEqual([{ name: 'Aqua', qty: 1 }])
    })

    it('minuman pilihan dari catatan nama atau package_choices', () => {
      expect(minumanPaket({ menu_item_id: 'p-combo', menu_item_name: 'Combo #1|NOTE|pedas (Paket: Orange Juice)' }, paket))
        .toEqual([{ name: 'Orange Juice', qty: 1 }])
      expect(minumanPaket({ menu_item_id: 'p-combo', menu_item_name: 'Combo #1', package_choices: { s4: 'm-tea' } }, paket))
        .toEqual([{ name: 'Ice Tea', qty: 1 }])
    })

    it('pilihan tak tercatat tetap menambah porsi minuman tanpa menebak jenisnya', () => {
      expect(minumanPaket({ menu_item_id: 'p-combo', menu_item_name: 'Combo #1|NOTE|Sedang' }, paket))
        .toEqual([{ name: MINUMAN_TAK_TERCATAT, qty: 1 }])
    })

    it('jumlah minuman per slot mengikuti menu_packages.quantity', () => {
      expect(minumanPaket({ menu_item_id: 'p-c4', menu_item_name: 'Combo 4|NOTE|Paket: Orange Juice' }, paket))
        .toEqual([{ name: 'Orange Juice', qty: 2 }])
      expect(minumanPaket({ menu_item_id: 'p-c4', menu_item_name: 'Combo 4 (Paket: Orange Juice, Ice Tea)' }, paket))
        .toEqual([{ name: 'Orange Juice', qty: 1 }, { name: 'Ice Tea', qty: 1 }])
    })

    it('paket tanpa komponen minuman / menu bukan paket: tanpa minuman', () => {
      expect(minumanPaket({ menu_item_id: 'p-tanpa', menu_item_name: 'SHAWARMA DUO COMBO' }, paket)).toEqual([])
      expect(minumanPaket({ menu_item_id: 'm-ayam', menu_item_name: 'Original Ayam Besar' }, paket)).toEqual([])
    })

    it('menu tak dikenal di menu_packages: jatuh ke catatan nama seperti dulu', () => {
      expect(minumanPaket({ menu_item_id: null, menu_item_name: 'Combo X (Paket: Ice Tea)' }, paket))
        .toEqual([{ name: 'Ice Tea', qty: 1 }])
    })

    it('summarizeDay: paket + AQUA menambah porsi Aqua, porsi makanan paket tetap', () => {
      const ord: RawOrder = {
        id: 'q1', status: 'completed', channel: null, sales_source: 'pos', outlet_id: A,
        created_at: '2026-11-20T03:00:00Z', total_amount: 60000, discount_amount: 0, promo_subsidy: 0,
        order_items: [{ menu_item_id: 'p-aqua', menu_item_name: 'AYAM BESAR + AQUA', quantity: 2, subtotal: 60000 }],
      }
      const day = summarizeDay([ord], paket)
      expect(day.groups[0].porsi).toBe(4)
      expect(day.items.find(i => i.name === 'AYAM BESAR + AQUA')?.qty).toBe(2)
      const aqua = day.items.find(i => i.name === 'Aqua')
      expect(aqua?.qty).toBe(2)
      expect(aqua?.rev).toBe(0)
      expect(aqua?.fromPackage).toBe('AYAM BESAR + AQUA')
    })
  })
})
