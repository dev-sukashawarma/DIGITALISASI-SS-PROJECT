import { groupChannel, type ChannelGroup } from './channelGroups'

export interface ChannelMetrics {
  revenue: number
  gp: number
  pcs: number
}

export interface BusinessReportRow {
  outletId: string
  outletName: string
  offline: ChannelMetrics
  online: ChannelMetrics
  foodapps: ChannelMetrics
  tiktok: ChannelMetrics
  totalPerformance: ChannelMetrics
  opexOutlet: number
  opexSalary: number
  opexTotal: number
  totalGrossProfit: number
}

interface ChannelAccum { revenue: number; hpp: number; pcs: number }

function emptyAccums(): Record<ChannelGroup, ChannelAccum> {
  return {
    offline: { revenue: 0, hpp: 0, pcs: 0 },
    online: { revenue: 0, hpp: 0, pcs: 0 },
    foodapps: { revenue: 0, hpp: 0, pcs: 0 },
    tiktok: { revenue: 0, hpp: 0, pcs: 0 },
  }
}

function toMetrics(a: ChannelAccum): ChannelMetrics {
  return { revenue: a.revenue, gp: a.revenue - a.hpp, pcs: a.pcs }
}

function sumMetrics(a: ChannelMetrics, b: ChannelMetrics): ChannelMetrics {
  return { revenue: a.revenue + b.revenue, gp: a.gp + b.gp, pcs: a.pcs + b.pcs }
}

const EMPTY_METRICS: ChannelMetrics = { revenue: 0, gp: 0, pcs: 0 }

/**
 * Gabungkan Revenue (sales), HPP per-channel, PCS per-channel, dan Opex (expenses)
 * jadi matriks per outlet x channel group untuk halaman Rekap Bulanan.
 * Formula: GP channel = Revenue - HPP; Total Gross Profit = Sigma GP semua channel - Total Opex.
 */
export function buildBusinessReportRows(
  outlets: { id: string; name: string }[],
  salesRows: { outlet_id: string; sales_source: string; omzet: number }[],
  hppByChannelRows: { outlet_id: string; sales_source: string; hpp: number }[],
  pcsRows: { outlet_id: string; sales_source: string; pcs: number }[],
  expenseRows: { outlet_id: string | null; category: string; scope: string; amount: number }[],
): { rows: BusinessReportRow[]; total: BusinessReportRow } {
  const byOutlet = new Map<string, { name: string; accums: Record<ChannelGroup, ChannelAccum>; opexOutlet: number; opexSalary: number }>()

  const ensure = (id: string, name: string) => {
    let cur = byOutlet.get(id)
    if (!cur) {
      cur = { name, accums: emptyAccums(), opexOutlet: 0, opexSalary: 0 }
      byOutlet.set(id, cur)
    }
    return cur
  }

  outlets.forEach((o) => ensure(o.id, o.name))

  salesRows.forEach((r) => {
    const cur = ensure(r.outlet_id, 'Outlet Tidak Dikenal')
    cur.accums[groupChannel(r.sales_source)].revenue += r.omzet
  })

  hppByChannelRows.forEach((r) => {
    const cur = ensure(r.outlet_id, 'Outlet Tidak Dikenal')
    cur.accums[groupChannel(r.sales_source)].hpp += r.hpp
  })

  pcsRows.forEach((r) => {
    const cur = ensure(r.outlet_id, 'Outlet Tidak Dikenal')
    cur.accums[groupChannel(r.sales_source)].pcs += r.pcs
  })

  expenseRows.forEach((r) => {
    if (r.scope !== 'outlet' || !r.outlet_id) return // Pengeluaran Pusat tak dibebankan ke outlet manapun
    const cur = ensure(r.outlet_id, 'Outlet Tidak Dikenal')
    if (r.category === 'gaji_crew_outlet') cur.opexSalary += r.amount
    else cur.opexOutlet += r.amount
  })

  const rows: BusinessReportRow[] = [...byOutlet.entries()].map(([id, val]) => {
    const offline = toMetrics(val.accums.offline)
    const online = toMetrics(val.accums.online)
    const foodapps = toMetrics(val.accums.foodapps)
    const tiktok = toMetrics(val.accums.tiktok)
    const totalPerformance = [offline, online, foodapps, tiktok].reduce(sumMetrics, EMPTY_METRICS)
    const opexTotal = val.opexOutlet + val.opexSalary
    return {
      outletId: id,
      outletName: val.name,
      offline,
      online,
      foodapps,
      tiktok,
      totalPerformance,
      opexOutlet: val.opexOutlet,
      opexSalary: val.opexSalary,
      opexTotal,
      totalGrossProfit: totalPerformance.gp - opexTotal,
    }
  })

  const total: BusinessReportRow = rows.reduce<BusinessReportRow>(
    (acc, r) => ({
      outletId: 'total',
      outletName: 'TOTAL',
      offline: sumMetrics(acc.offline, r.offline),
      online: sumMetrics(acc.online, r.online),
      foodapps: sumMetrics(acc.foodapps, r.foodapps),
      tiktok: sumMetrics(acc.tiktok, r.tiktok),
      totalPerformance: sumMetrics(acc.totalPerformance, r.totalPerformance),
      opexOutlet: acc.opexOutlet + r.opexOutlet,
      opexSalary: acc.opexSalary + r.opexSalary,
      opexTotal: acc.opexTotal + r.opexTotal,
      totalGrossProfit: acc.totalGrossProfit + r.totalGrossProfit,
    }),
    {
      outletId: 'total',
      outletName: 'TOTAL',
      offline: EMPTY_METRICS,
      online: EMPTY_METRICS,
      foodapps: EMPTY_METRICS,
      tiktok: EMPTY_METRICS,
      totalPerformance: EMPTY_METRICS,
      opexOutlet: 0,
      opexSalary: 0,
      opexTotal: 0,
      totalGrossProfit: 0,
    },
  )

  return { rows, total }
}
