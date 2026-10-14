import { describe, it, expect } from 'vitest'
import {
  buildMenuMaps,
  buildPenerapHpp,
  computeAnalytics,
  computeAvailableChannels,
  computeAvailablePaymentMethods,
  computeItemBreakdown,
  computeTableFooter,
  filterOrdersByChannels,
  filterTableData,
  getItemHpp,
} from './compute'
import { selectReportOrders } from './load'
import { cleanItemName, parseItemName } from '@/lib/order-item-name'
import {
  buildFoodAppsSettlementPromoMap,
  computeOrderDeduction,
  computeOrderGross,
  computeOrderPlatformSubsidy,
  getOrderJakartaDateStr,
  isFoodAppOrder,
  isGoFoodOrder,
  isTikTokGoOrder,
} from '@/lib/posReportKpi'
import { tanggalWib } from '@/lib/hpp/riwayatHpp'
import { isTestOutlet } from '@/lib/outletFilters'

function generateDataset(orderCount = 20_000) {
  const outlets = [
    { id: 'out-1', name: 'SUKA SHAWARMA EMPANG', type: 'internal' },
    { id: 'out-2', name: 'SUKA SHAWARMA PAJAJARAN', type: 'internal' },
    { id: 'out-3', name: 'MITRA CIBINONG', type: 'mitra' },
    { id: 'out-4', name: 'MITRA DEPOK', type: 'mitra' },
    { id: 'out-mp', name: 'MARKETPLACE', type: 'marketplace' },
  ]

  const menus = [
    { id: 'm-1', name: 'Original Ayam Jumbo', hpp_override: 14000, channel_hpp: { ss_online: 12000 }, is_package: false },
    { id: 'm-2', name: 'Original Sapi Jumbo', hpp_override: 17000, channel_hpp: { ss_online: 15000 }, is_package: false },
    { id: 'm-3', name: 'Kebab Mozarella', hpp_override: 16000, channel_hpp: {}, is_package: false },
    {
      id: 'm-4',
      name: 'Paket Hemat Berdua',
      hpp_override: null,
      channel_hpp: {},
      is_package: true,
      package_items: [
        { quantity: 1, component: { id: 'm-1', hpp_override: 14000, channel_hpp: {} } },
        { quantity: 1, component: { id: 'm-2', hpp_override: 17000, channel_hpp: {} } },
      ],
    },
    { id: 'm-5', name: 'Extra Keju Slice', hpp_override: 2500, channel_hpp: {}, is_package: false },
  ]

  const riwayat = [
    { menu_item_id: 'm-1', kunci: 'hpp_override', nilai: 13500, berlaku_mulai: '2026-09-01' },
    { menu_item_id: 'm-1', kunci: 'hpp_override', nilai: 14200, berlaku_mulai: '2026-09-15' },
    { menu_item_id: 'm-2', kunci: 'hpp_override', nilai: 16800, berlaku_mulai: '2026-09-01' },
    { menu_item_id: 'm-2', kunci: 'hpp_override', nilai: 17300, berlaku_mulai: '2026-09-20' },
  ]

  const channels = [
    { channel: null, sales_source: 'pos_kasir', payment_method: 'cash', customer_name: 'Pelanggan Umum' },
    { channel: 'pos_kasir', sales_source: 'pos_kasir', payment_method: 'qris', customer_name: 'Budi' },
    { channel: 'gofood', sales_source: 'gofood', payment_method: 'gofood', customer_name: 'GoFood #123' },
    { channel: 'grabfood', sales_source: 'grabfood', payment_method: 'grabfood', customer_name: 'GrabFood #456' },
    { channel: 'shopeefood', sales_source: 'shopeefood', payment_method: 'shopeefood', customer_name: 'ShopeeFood #789' },
    { channel: 'tiktokgo', sales_source: 'tiktok', payment_method: 'tiktok', customer_name: 'TikTok #101' },
    { channel: 'online', sales_source: 'online', payment_method: 'qris', customer_name: 'Web Order' },
    { channel: 'endors', sales_source: 'pos_kasir', payment_method: 'cash', customer_name: 'Endorse Influencer' },
  ]

  const posOrders: any[] = []
  const ecommerceOrders: any[] = []

  for (let i = 0; i < orderCount; i++) {
    const day = String((i % 28) + 1).padStart(2, '0')
    const hour = String(i % 24).padStart(2, '0')
    const min = String(i % 60).padStart(2, '0')
    const createdAt = `2026-09-${day}T${hour}:${min}:00.000Z`

    if (i % 10 === 0) {
      ecommerceOrders.push({
        id: `ec-${i}`,
        order_number: 0,
        status: 'completed',
        payment_method: i % 20 === 0 ? 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' : 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584',
        total_amount: 42000,
        discount_amount: 4000,
        promo_subsidy: 0,
        created_at: createdAt,
        outlet_id: 'ss-online',
        channel: i % 20 === 0 ? 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' : 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584',
        sales_source: 'Online',
        customer_name: 'SS Online Customer',
        cashier_name: null,
        external_order_id: `EXT-${i}`,
        is_endorse: false,
        order_items: [
          {
            id: `eci-${i}-1`,
            menu_item_id: 'm-1',
            menu_item_name: 'Original Ayam Jumbo',
            quantity: 2,
            unit_price: 23000,
            subtotal: 46000,
            package_choices: null,
            menu_items: menus[0],
          },
        ],
      })
      continue
    }

    const chInfo = channels[i % channels.length]
    const outlet = outlets[i % 4]
    const isCancelled = i % 25 === 0
    const isBogo = i % 15 === 0
    const isFoodApp = ['gofood', 'grabfood', 'shopeefood', 'tiktokgo'].includes(chInfo.channel || '')

    const items = [
      {
        id: `oi-${i}-1`,
        menu_item_id: menus[i % 4].id,
        menu_item_name: `${menus[i % 4].name}|ID|cid-${i}|NOTE|Pedas dikit`,
        quantity: (i % 3) + 1,
        unit_price: 25000,
        subtotal: ((i % 3) + 1) * 25000,
        is_promo_reward: false,
        package_choices: i % 4 === 3 ? { Saus: 'Pedas' } : null,
      },
      {
        id: `oi-${i}-2`,
        menu_item_id: 'm-5',
        menu_item_name: `Extra Keju Slice|ID|cid-${i}-2|PARENT|cid-${i}|NOTE|`,
        quantity: 1,
        unit_price: 5000,
        subtotal: 5000,
        is_promo_reward: isBogo,
        package_choices: null,
      },
    ]

    const menuSum = items.reduce((s, it) => s + it.subtotal, 0)
    const discount = !isFoodApp && i % 5 === 0 ? 5000 : 0
    const promoSubsidy = isFoodApp && i % 3 === 0 ? 6000 : 0

    posOrders.push({
      id: `pos-${i}`,
      order_number: i + 1,
      status: isCancelled ? 'cancelled' : 'completed',
      payment_method: chInfo.payment_method,
      total_amount: isFoodApp ? menuSum : menuSum - discount,
      discount_amount: discount,
      promo_subsidy: promoSubsidy,
      created_at: createdAt,
      outlet_id: outlet.id,
      channel: chInfo.channel,
      sales_source: chInfo.sales_source,
      customer_name: chInfo.customer_name,
      cashier_name: 'Kasir A',
      external_order_id: null,
      is_endorse: chInfo.channel === 'endors',
      order_items: items,
    })
  }

  const settlements = [
    { id: 's-1', outlet_id: 'out-1', platform: 'gofood', tanggal: '2026-09-05', omzet_kotor: 500000, promo_merchant: 45000, commission: 100000 },
    { id: 's-2', outlet_id: 'out-2', platform: 'grabfood', tanggal: '2026-09-10', omzet_kotor: 600000, promo_merchant: 55000, commission: 120000 },
    { id: 's-3', outlet_id: 'out-3', platform: 'shopeefood', tanggal: '2026-09-15', omzet_kotor: 400000, promo_merchant: 30000, commission: 80000 },
  ]

  const shifts = [
    { id: 'sh-1', outlet_id: 'out-1', start_time: '2026-09-05T01:00:00Z', end_time: '2026-09-05T09:00:00Z', status: 'closed', starting_cash: 200000, expected_ending_cash: 800000, actual_ending_cash: 795000, variance: -5000, expected_ending_petty_cash: 100000, actual_ending_petty_cash: 100000, petty_cash_variance: 0 },
  ]

  return { outlets, menus, riwayat, posOrders, ecommerceOrders, settlements, shifts }
}

/** Reference implementation (verbatim pre-optimization logic) to verify 100% mathematical equivalence */
function referencePipeline(smallData: ReturnType<typeof generateDataset>, selectedOutlets: string[], selectedChannels: string[]) {
  const includeAll = selectedOutlets.includes('all')
  const selectedSet = new Set(selectedOutlets)
  const posRows = !selectedOutlets.includes('ss-online')
    ? (includeAll ? smallData.posOrders : smallData.posOrders.filter((o: any) => selectedSet.has(o.outlet_id)))
    : []
  const ecommerceRows = includeAll || selectedOutlets.includes('ss-online') ? smallData.ecommerceOrders : []
  const orders = [...posRows, ...ecommerceRows]
    .filter((o: any) => !isTestOutlet(o.outlet_id))
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((o: any) => JSON.parse(JSON.stringify(o)))

  const isSSOnlineSelected = selectedOutlets.length === 1 && selectedOutlets[0] === 'ss-online'
  const penerapHpp = buildPenerapHpp(smallData.menus, smallData.riwayat)
  const filteredOrders = filterOrdersByChannels(orders, selectedChannels)
  const completed = filteredOrders.filter((o: any) => o.status === 'completed' || o.status === 'settled')
  const totalOrders = completed.length
  const buyOneGetOneOrders = completed.filter((order: any) => order.order_items.some((item: any) => item.is_promo_reward))
  const buyOneGetOneGiftUnits = buyOneGetOneOrders.reduce(
    (sum: number, order: any) => sum + order.order_items
      .filter((item: any) => item.is_promo_reward)
      .reduce((itemSum: number, item: any) => itemSum + Number(item.quantity || 0), 0),
    0
  )
  const totalCashVariance = smallData.shifts.reduce((s, shift) => s + (shift.variance || 0), 0)
  const outletTypeMap = new Map<string, string>()
  smallData.outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))

  const totalHPP = completed.reduce((sum: number, o: any) => {
    const outletType = outletTypeMap.get(o.outlet_id)
    const orderChannel = o.channel || o.sales_source
    const pHpp = penerapHpp.untuk(tanggalWib(o.created_at))
    return sum + o.order_items.reduce((itemSum: number, item: any) => {
      const menuItem = pHpp.terapkan(item.menu_items) || (item.menu_item_id ? pHpp.byId.get(item.menu_item_id) : null) || pHpp.byName.get(parseItemName(item.menu_item_name).name)
      const hpp = getItemHpp(menuItem, outletType, item.menu_item_name, pHpp.byName, orderChannel, item.menu_item_id, pHpp.byId)
      return itemSum + (hpp * item.quantity)
    }, 0)
  }, 0)

  const foodAppsSettlementPromoMap = buildFoodAppsSettlementPromoMap(completed, smallData.settlements)
  const kpiOpts = {
    ssOnlineMode: isSSOnlineSelected,
    getSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    getGofoodSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    gofoodSettlementMap: foodAppsSettlementPromoMap,
  }

  completed.forEach((o: any) => {
    if (isFoodAppOrder(o)) {
      const allocated = foodAppsSettlementPromoMap.get(o.id ?? o)
      if (allocated !== undefined) {
        o.settlement_promo_merchant = allocated
        const kasirPromo = Number(o.promo_subsidy) || 0
        o.platform_subsidy = Math.max(0, kasirPromo - allocated)
      }
    } else if (isTikTokGoOrder(o)) {
      o.settlement_promo_merchant = 0
      const kasirPromo = Number(o.promo_subsidy) || 0
      o.platform_subsidy = kasirPromo
    }
  })

  const totalDeductions = completed.reduce((s: number, o: any) => s + computeOrderDeduction(o, kpiOpts), 0)
  const totalPlatformSubsidy = completed.reduce((s: number, o: any) => o.outlet_id === 'ss-online' ? s : s + computeOrderPlatformSubsidy(o, kpiOpts), 0)
  const grossRevenue = completed.reduce((s: number, o: any) => s + computeOrderGross(o, kpiOpts), 0)
  const netRevenue = grossRevenue - totalDeductions
  const grossProfit = Math.max(0, grossRevenue - (totalHPP + totalDeductions))
  const estimatedCommission = completed.reduce((sum: number, o: any) => {
    if (isSSOnlineSelected || o.outlet_id === 'ss-online') return sum
    const gross = computeOrderGross(o, kpiOpts)
    const ch = (o.channel || '').toLowerCase()
    const src = (o.sales_source || '').toLowerCase()
    if (isGoFoodOrder(o)) return sum + Math.round(gross * 0.20)
    if (ch.includes('grab') || src.includes('grab')) return sum + Math.round(gross * 0.20)
    if (ch.includes('shopee') || src.includes('shopee')) return sum + Math.round(gross * 0.20)
    if (isTikTokGoOrder(o)) return sum + Math.round(gross * 0.092)
    return sum
  }, 0)

  return {
    totalOrders,
    buyOneGetOneTransactions: buyOneGetOneOrders.length,
    buyOneGetOneGiftUnits,
    totalCashVariance,
    totalHPP,
    totalDeductions,
    totalPlatformSubsidy,
    grossRevenue,
    netRevenue,
    grossProfit,
    estimatedCommission,
  }
}

describe('POS Report Performance & Mathematical Equivalence', () => {
  const data = generateDataset(20_000)
  const smallData = generateDataset(1_000)

  it('cleanItemName and parseItemName preserve exact behavior for all metadata formats', () => {
    const samples = [
      'Original Ayam Jumbo',
      'Original Ayam Jumbo|ID|123',
      'Original Ayam Jumbo|ID|123|PARENT|456',
      'Original Ayam Jumbo|ID|123|PARENT|456|NOTE|Pedas manis',
      'Extra Keju|NOTE|Tanpa saus',
      'Paket Hemat|PARENT|999',
      '',
    ]
    for (const s of samples) {
      expect(cleanItemName(s)).toBe(parseItemName(s).name)
    }
  })

  it('getOrderJakartaDateStr and tanggalWib produce identical YYYY-MM-DD in Asia/Jakarta across UTC boundaries', () => {
    const timestamps = [
      '2026-09-18T16:59:59.999Z', // 23:59:59 WIB -> 2026-09-18
      '2026-09-18T17:00:00.000Z', // 00:00:00 WIB -> 2026-09-19
      '2026-01-01T00:00:00.000Z', // 07:00:00 WIB -> 2026-01-01
      '2026-12-31T18:30:00.000Z', // 01:30:00 WIB -> 2027-01-01
      '2026-09-20T12:00:00+07:00',
    ]
    const refFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    for (const ts of timestamps) {
      const expected = refFormatter.format(new Date(ts))
      expect(getOrderJakartaDateStr(ts)).toBe(expected)
      expect(getOrderJakartaDateStr(new Date(ts))).toBe(expected)
      expect(tanggalWib(ts)).toBe(expected)
      expect(tanggalWib(new Date(ts))).toBe(expected)
    }
    expect(getOrderJakartaDateStr('')).toBe('')
    expect(getOrderJakartaDateStr(null)).toBe('')
    expect(getOrderJakartaDateStr('2026-09-15 invalid')).toBe('2026-09-15')
  })

  it('matches reference un-fused calculation 100% across all outlet and channel filter combinations', () => {
    const filterCases = [
      { outlets: ['all'], channels: ['all'] },
      { outlets: ['out-1', 'out-3'], channels: ['food_apps'] },
      { outlets: ['out-2'], channels: ['pos_kasir'] },
      { outlets: ['ss-online'], channels: ['all'] },
    ]

    const { menuItemByNameMap, menuItemByIdMap } = buildMenuMaps(smallData.menus)
    const penerapHpp = buildPenerapHpp(smallData.menus, smallData.riwayat)

    for (const fc of filterCases) {
      const ref = referencePipeline(smallData, fc.outlets, fc.channels)
      const orders = selectReportOrders(smallData.posOrders, smallData.ecommerceOrders, fc.outlets)
      const isSSOnlineSelected = fc.outlets.length === 1 && fc.outlets[0] === 'ss-online'
      const actual = computeAnalytics({
        orders,
        shifts: smallData.shifts as any,
        selectedChannels: fc.channels,
        menuItemByNameMap,
        menuItemByIdMap,
        penerapHpp,
        settlements: smallData.settlements,
        isSSOnlineSelected,
        outlets: smallData.outlets,
      })

      expect({
        totalOrders: actual.totalOrders,
        buyOneGetOneTransactions: actual.buyOneGetOneTransactions,
        buyOneGetOneGiftUnits: actual.buyOneGetOneGiftUnits,
        totalCashVariance: actual.totalCashVariance,
        totalHPP: actual.totalHPP,
        totalDeductions: actual.totalDeductions,
        totalPlatformSubsidy: actual.totalPlatformSubsidy,
        grossRevenue: actual.grossRevenue,
        netRevenue: actual.netRevenue,
        grossProfit: actual.grossProfit,
        estimatedCommission: actual.estimatedCommission,
      }).toEqual(ref)
    }
  })

  it('benchmarks full 20,000-order POS report computation pipeline and verifies deterministic outputs', () => {
    const t0 = performance.now()

    const tSelect0 = performance.now()
    const orders = selectReportOrders(data.posOrders, data.ecommerceOrders, ['all'])
    const tSelect1 = performance.now()

    const { menuItemByNameMap, menuItemByIdMap } = buildMenuMaps(data.menus)
    const penerapHpp = buildPenerapHpp(data.menus, data.riwayat)

    const tAnalytics0 = performance.now()
    const analytics = computeAnalytics({
      orders,
      shifts: data.shifts as any,
      selectedChannels: ['all'],
      menuItemByNameMap,
      menuItemByIdMap,
      penerapHpp,
      settlements: data.settlements,
      isSSOnlineSelected: false,
      outlets: data.outlets,
    })
    const tAnalytics1 = performance.now()

    const tChannels0 = performance.now()
    const availableChannels = computeAvailableChannels(orders, false)
    const availablePaymentMethods = computeAvailablePaymentMethods(orders)
    const tChannels1 = performance.now()

    const tFooter0 = performance.now()
    const tableRows = filterTableData(analytics.completedOrders, 'all', '')
    const footer = computeTableFooter(tableRows, data.settlements)
    const tFooter1 = performance.now()

    const tBreakdown0 = performance.now()
    const itemBreakdown = computeItemBreakdown(tableRows, data.outlets, penerapHpp)
    const tBreakdown1 = performance.now()

    const totalMs = performance.now() - t0
    console.log(
      `[BENCHMARK 20k orders] total=${totalMs.toFixed(1)}ms | select=${(tSelect1 - tSelect0).toFixed(1)}ms | analytics=${(tAnalytics1 - tAnalytics0).toFixed(1)}ms | channels=${(tChannels1 - tChannels0).toFixed(1)}ms | footer=${(tFooter1 - tFooter0).toFixed(1)}ms | itemBreakdown=${(tBreakdown1 - tBreakdown0).toFixed(1)}ms`
    )

    expect(orders.length).toBe(20_000)
    expect(analytics.totalOrders).toBe(19_600)
    expect(analytics.cancelledCount).toBe(400)
    expect(analytics.grossRevenue).toBeGreaterThan(0)
    expect(analytics.totalHPP).toBeGreaterThan(0)
    expect(analytics.grossProfit).toBe(Math.max(0, analytics.grossRevenue - (analytics.totalHPP + analytics.totalDeductions)))
    expect(footer.totalGross).toBe(analytics.grossRevenue)
    expect(footer.totalMerchantDeductions).toBe(analytics.totalDeductions)
    expect(availableChannels.length).toBeGreaterThan(0)
    expect(availablePaymentMethods.length).toBeGreaterThan(0)
    expect(itemBreakdown.length).toBeGreaterThan(0)
    expect(totalMs).toBeLessThan(1500)
  })
})
