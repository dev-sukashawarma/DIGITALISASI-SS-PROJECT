// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { ComprehensiveMitraPnl } from '@/app/actions/mitraPnl'
import { gabungkanPnlMitra } from './mitraPnlGabung'

function potongan(over: {
  from: string; to: string; gross: number; ded: number; cogs: number; opex: number; waste: number
  fee: number; feePct: number; sharePct: number; kategori: [string, number][]
}): ComprehensiveMitraPnl {
  const net = over.gross - over.ded - over.cogs - over.opex - over.waste - over.fee
  return {
    period: { from: over.from, to: over.to },
    outletName: 'MITRA UJI',
    profitSharingPct: over.sharePct,
    summary: {
      grossRevenue: over.gross, totalDeductions: over.ded, netRevenue: over.gross - over.ded,
      totalCogs: over.cogs, grossProfit: over.gross - over.ded - over.cogs, totalOpex: over.opex,
      totalWaste: over.waste, managementFeePct: over.feePct, managementFeeAmount: over.fee,
      netProfit: net, mitraShare: (net * over.sharePct) / 100, profitMarginPct: 0,
      policyStatus: `status ${over.from}`, isBep: false, profitSharingActive: true,
    },
    channels: {
      pos: { revenue: over.gross, cogs: over.cogs, deductions: 0, grossProfit: over.gross - over.cogs, orderCount: 10 },
      foodApps: { revenue: 0, cogs: 0, deductions: over.ded, grossProfit: -over.ded, orderCount: 0, grab: 1, gofood: 2, shopeefood: 3 },
      tiktok: { revenue: 0, cogs: 0, deductions: 0, grossProfit: 0, orderCount: 0 },
    },
    opex: {
      categories: over.kategori.map(([category, amount]) => ({
        category, amount, items: [{ description: category, amount, date: over.to, source: 'monthly' as const }],
      })),
      totalPettyCash: 100, totalMonthly: over.opex - 100, grandTotal: over.opex,
    },
    investment: { totalModal: 200, totalProfitDistributed: 50, bepPercentage: 25, roi: 25 },
  }
}

const sep = potongan({ from: '2026-09-01', to: '2026-09-30', gross: 1000, ded: 100, cogs: 500, opex: 200, waste: 10, fee: 0, feePct: 0, sharePct: 100, kategori: [['Gaji Crew Outlet', 150], ['Internet', 50]] })
const okt = potongan({ from: '2026-10-01', to: '2026-10-12', gross: 400, ded: 40, cogs: 200, opex: 60, waste: 5, fee: 12, feePct: 3, sharePct: 100, kategori: [['Internet', 20], ['Gaji, Lembur & Upah Crew', 40]] })

describe('gabungkanPnlMitra', () => {
  it('satu potongan dikembalikan apa adanya', () => {
    expect(gabungkanPnlMitra([sep])).toBe(sep)
  })

  it('menjumlahkan seluruh angka tanpa menghitung ulang', () => {
    const g = gabungkanPnlMitra([sep, okt])
    expect(g.period).toEqual({ from: '2026-09-01', to: '2026-10-12' })
    expect(g.summary.grossRevenue).toBe(1400)
    expect(g.summary.totalDeductions).toBe(140)
    expect(g.summary.netRevenue).toBe(1260)
    expect(g.summary.totalCogs).toBe(700)
    expect(g.summary.grossProfit).toBe(560)
    expect(g.summary.totalOpex).toBe(260)
    expect(g.summary.totalWaste).toBe(15)
    expect(g.summary.managementFeeAmount).toBe(12)
    expect(g.summary.netProfit).toBe(sep.summary.netProfit + okt.summary.netProfit)
    expect(g.summary.mitraShare).toBe(sep.summary.mitraShare + okt.summary.mitraShare)
    // laba gabungan tetap = gross profit − opex − waste − fee
    expect(g.summary.grossProfit - g.summary.totalOpex - g.summary.totalWaste - (g.summary.managementFeeAmount ?? 0)).toBe(g.summary.netProfit)
    expect(g.channels.pos.revenue).toBe(1400)
    expect(g.channels.pos.orderCount).toBe(20)
    expect(g.channels.foodApps.shopeefood).toBe(6)
    expect(g.opex.grandTotal).toBe(260)
    expect(g.opex.totalPettyCash + g.opex.totalMonthly).toBe(260)
  })

  it('kategori OPEX yang sama dijumlahkan, sisanya berdampingan, urut terbesar', () => {
    const g = gabungkanPnlMitra([sep, okt])
    expect(g.opex.categories.map(c => [c.category, c.amount, c.items.length])).toEqual([
      ['Gaji Crew Outlet', 150, 1], ['Internet', 70, 2], ['Gaji, Lembur & Upah Crew', 40, 1],
    ])
    expect(g.opex.categories.reduce((s, c) => s + c.amount, 0)).toBe(g.opex.grandTotal)
  })

  it('persen fee berbeda antar potongan → tarif efektif; persen sama → dipertahankan', () => {
    expect(gabungkanPnlMitra([sep, okt]).summary.managementFeePct).toBe(0.9) // 12 / 1400
    expect(gabungkanPnlMitra([okt, okt]).summary.managementFeePct).toBe(3)
    expect(gabungkanPnlMitra([sep, okt]).profitSharingPct).toBe(100)
  })

  it('status & investasi mengikuti potongan terakhir', () => {
    const g = gabungkanPnlMitra([sep, okt])
    expect(g.summary.policyStatus).toBe('status 2026-10-01')
    expect(g.investment).toBe(okt.investment)
  })
})
