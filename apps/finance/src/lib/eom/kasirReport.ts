import { loadKasirData } from './loadKasirData'
import { buildChannelBreakdown, buildCashRows, buildOutletBreakdown, isRunningShift, KONFIRMASI_SETORAN_MANUAL } from './kasir'
import { buildPenerapHpp, buildMenuMaps, computeAnalytics } from '@/lib/posReport/compute'
import { monthRange } from '@/lib/period'
import { tanggalWib } from '@/lib/hpp/riwayatHpp'

export interface RiwayatHppItem {
  menu_item_id?: string
  kunci?: string
  nilai?: number | string | null
  berlaku_mulai: string
}

/** Tanggal pergantian HPP di dalam bulan: hanya diaktifkan bila ada perubahan massal harga HPP (>= 5 menu). */
export function findCutoff(riwayat: RiwayatHppItem[], from: string, to: string) {
  const perKey = new Map<string, { tgl: string; nilai: number | null }[]>()
  for (const r of riwayat) {
    const keyId = r.menu_item_id || 'unknown'
    const kunci = r.kunci || 'default'
    const k = `${keyId}:${kunci}`
    let list = perKey.get(k)
    if (!list) {
      list = []
      perKey.set(k, list)
    }
    list.push({
      tgl: String(r.berlaku_mulai).slice(0, 10),
      nilai: r.nilai === null || r.nilai === undefined ? null : Number(r.nilai),
    })
  }

  const genuineChanges = new Map<string, number>()
  for (const points of perKey.values()) {
    points.sort((a, b) => a.tgl.localeCompare(b.tgl))
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]
      if (pt.tgl > from && pt.tgl <= to) {
        let prevVal: number | null | undefined = undefined
        for (let j = i - 1; j >= 0; j--) {
          if (points[j].tgl < pt.tgl) {
            prevVal = points[j].nilai
            break
          }
        }
        if (prevVal !== undefined && pt.nilai !== null && prevVal !== null && Math.abs(prevVal - pt.nilai) > 0.01) {
          genuineChanges.set(pt.tgl, (genuineChanges.get(pt.tgl) ?? 0) + 1)
        }
      }
    }
  }

  const MIN_MASS_CHANGE = 5
  const eligible = [...genuineChanges.entries()].filter(([, count]) => count >= MIN_MASS_CHANGE)
  eligible.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const allPerubahan = [...genuineChanges.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return {
    cutoff: eligible[0]?.[0] ?? null,
    perubahan: eligible.length > 0 ? allPerubahan : [],
  }
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
  const konfirmasiSetoran = KONFIRMASI_SETORAN_MANUAL[from.slice(0, 7)] ?? null
  const cash = buildCashRows(data.orders, data.shifts, data.deposits, data.outlets, ctx, today, konfirmasiSetoran?.sampaiTanggalJual ?? null)

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
    konfirmasiSetoran,
    // Rincian per outlet (untuk PDF) hanya dihitung bila diminta — payload besar.
    outletDetails: opts.outletDetail ? buildOutletBreakdown(data.orders, data.outlets, penerapHpp, cutoff) : undefined,
    outlets: data.outlets.map((o: any) => ({ id: o.id, name: o.name, type: o.type })),
    fetchedAt: new Date().toISOString(),
  }
}
