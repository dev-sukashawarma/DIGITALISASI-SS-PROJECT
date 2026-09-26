import { loadKasirData } from './loadKasirData'
import { buildChannelBreakdown, buildCashRows, buildOutletBreakdown, isRunningShift } from './kasir'
import { buildPenerapHpp, buildMenuMaps, computeAnalytics } from '@/lib/posReport/compute'
import { monthRange } from '@/lib/period'
import { tanggalWib } from '@/lib/hpp/riwayatHpp'

/** Tanggal pergantian HPP di dalam bulan: tanggal berlaku (selain tgl 1) dengan perubahan terbanyak. */
function findCutoff(riwayat: { berlaku_mulai: string }[], from: string, to: string) {
  const counts = new Map<string, number>()
  for (const r of riwayat) {
    const d = String(r.berlaku_mulai).slice(0, 10)
    if (d > from && d <= to) counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  const dates = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return { cutoff: dates[0]?.[0] ?? null, perubahan: [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])) }
}

/** Seluruh data tab Kasir & Kas Toko untuk satu bulan (dipakai API route). */
export async function buildKasirReport(supabase: any, month: number, year: number, opts: { outletDetail?: boolean } = {}) {
  const { from, to } = monthRange(year, month)

  const data = await loadKasirData(supabase, from, to)

  const penerapHpp = buildPenerapHpp(data.menuItems, data.riwayat)
  const { cutoff, perubahan } = findCutoff(data.riwayat, from, to)
  const maps = buildMenuMaps(data.menuItems)
  const ctx = { ...maps, penerapHpp, settlements: [], isSSOnlineSelected: false, outlets: data.outlets }

  // Kartu KPI Rangkuman Penjualan (Semua Cabang, Semua Channel) untuk bulan ini.
  const kpi = computeAnalytics({ ...ctx, orders: data.orders, shifts: data.shifts, selectedChannels: ['all'] })
  const channels = buildChannelBreakdown(data.orders, data.outlets, penerapHpp, cutoff)
  const today = tanggalWib(new Date())
  const cash = buildCashRows(data.orders, data.shifts, data.deposits, data.outlets, ctx, today)

  // Rincian untuk PDF: shift yang berselisih atau belum ditutup.
  const outletName = new Map(data.outlets.map((o: any) => [o.id, o.name]))
  const shiftDetails = data.shifts
    .filter((sh: any) => (sh.status !== 'closed' && !isRunningShift(sh, today)) || Math.abs(Number(sh.variance) || 0) >= 1)
    .map((sh: any) => {
      const staff = Array.isArray(sh.staff) ? sh.staff[0] : sh.staff
      return {
        tanggal: tanggalWib(sh.start_time),
        outlet: outletName.get(sh.outlet_id) ?? '—',
        kasir: staff?.name ?? '—',
        expected: Number(sh.expected_ending_cash) || 0,
        fisik: Number(sh.actual_ending_cash) || 0,
        selisih: Number(sh.variance) || 0,
        status: sh.status,
        catatan: sh.notes ?? '',
      }
    })
    .sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal) || a.outlet.localeCompare(b.outlet))

  return {
    period: { month, year, from, to },
    hppCutoff: cutoff,
    hppPerubahan: perubahan,
    kpi: {
      grossRevenue: kpi.grossRevenue,
      netRevenue: kpi.netRevenue,
      totalDeductions: kpi.totalDeductions,
      totalHPP: kpi.totalHPP,
      grossProfit: kpi.grossProfit,
      totalOrders: kpi.totalOrders,
      totalCashVariance: kpi.totalCashVariance,
    },
    channels,
    cash,
    shiftDetails,
    // Rincian per outlet (untuk PDF) hanya dihitung bila diminta — payload besar.
    outletDetails: opts.outletDetail ? buildOutletBreakdown(data.orders, data.outlets, penerapHpp, cutoff) : undefined,
    outlets: data.outlets.map((o: any) => ({ id: o.id, name: o.name, type: o.type })),
    fetchedAt: new Date().toISOString(),
  }
}
