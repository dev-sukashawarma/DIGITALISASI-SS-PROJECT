import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { createServerComponentClient } from '@/lib/supabase-server'
import { loadKasirData } from '@/lib/eom/loadKasirData'
import { buildChannelBreakdown, buildCashRows } from '@/lib/eom/kasir'
import { buildPenerapHpp, buildMenuMaps, computeAnalytics } from '@/lib/posReport/compute'
import { monthRange } from '@/lib/period'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

export async function GET(req: NextRequest) {
  try {
    await requireRole(['admin_finance', 'owner', 'admin'])

    const { searchParams } = new URL(req.url)
    const month = Number(searchParams.get('month'))
    const year = Number(searchParams.get('year'))
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2025 || year > 2100) {
      return NextResponse.json({ error: 'Parameter bulan/tahun tidak valid' }, { status: 400 })
    }
    const { from, to } = monthRange(year, month)

    // Sesi user (RLS berlaku) — sama dengan Rangkuman Penjualan yang membaca lewat sesi user.
    const supabase = await createServerComponentClient()
    const data = await loadKasirData(supabase, from, to)

    const penerapHpp = buildPenerapHpp(data.menuItems, data.riwayat)
    const { cutoff, perubahan } = findCutoff(data.riwayat, from, to)
    const maps = buildMenuMaps(data.menuItems)
    const ctx = { ...maps, penerapHpp, settlements: [], isSSOnlineSelected: false, outlets: data.outlets }

    // Kartu KPI Rangkuman Penjualan (Semua Cabang, Semua Channel) untuk bulan ini.
    const kpi = computeAnalytics({ ...ctx, orders: data.orders, shifts: data.shifts, selectedChannels: ['all'] })
    const channels = buildChannelBreakdown(data.orders, data.outlets, penerapHpp, cutoff)
    const cash = buildCashRows(data.orders, data.shifts, data.deposits, data.outlets, ctx)

    return NextResponse.json({
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
      outlets: data.outlets.map((o: any) => ({ id: o.id, name: o.name, type: o.type })),
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    const msg = err?.message || 'Gagal memuat data EOM kasir'
    const status = msg.startsWith('Unauthorized') ? 401 : msg.startsWith('Forbidden') ? 403 : 500
    console.error('API /api/eom-closing/kasir error:', err)
    return NextResponse.json({ error: msg }, { status })
  }
}
