'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { resolveMitraPolicy } from '@/lib/mitraPolicy'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { getMitraAugustClosing, isAugust2026Period } from './mitraPnlClosingData'
import { buatSaringanKasKecil } from '@/lib/kasKecilTeraudit'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import { fetchHppRows } from '@/lib/hpp/fetchHpp'
import { calculateProratedExpenses } from '@/lib/opexProrata'
import { isTestOrDevStaff, KANTOR_PUSAT_ID } from '@/lib/staffFilters'

/** 2026-08-01 00:00 WIB — awal data bagi hasil yang dihitung sistem. */
const SYSTEM_START_MONTH = '2026-08'

/** Tanggal hari ini menurut Asia/Jakarta (bukan UTC). */
function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

/** Daftar bulan `YYYY-MM` dari SYSTEM_START_MONTH s/d bulan berjalan (WIB). */
function monthsSinceSystemStart(): { key: string; from: string; to: string }[] {
  const out: { key: string; from: string; to: string }[] = []
  const today = todayWib()
  const last = today.slice(0, 7)
  let [y, m] = SYSTEM_START_MONTH.split('-').map(Number)
  for (let guard = 0; guard < 240; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const from = `${key}-01`
    const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    // Untuk bulan berjalan, gunakan tanggal hari ini agar sinkron dengan data MTD Tab Laba Rugi
    const to = key === last ? today : lastDayOfMonth
    out.push({ key, from, to })
    if (key >= last) break
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

/**
 * Bulan pertama yang boleh diakru untuk satu outlet.
 *
 * Bagi hasil yang SUDAH ditransfer tercatat di `mitra_transfers` (kolom
 * `bulan`). Mengakru bulan yang transfernya sudah ada = menghitung uang yang
 * sama dua kali, sekali sebagai transfer dan sekali sebagai akrual. Karena itu
 * akrual dimulai dari bulan SETELAH transfer terakhir.
 */
function accrualStartMonth(outletTransfers: { bulan?: string | null }[]): string {
  let latest = ''
  for (const t of outletTransfers) {
    const b = (t.bulan || '').slice(0, 7)
    if (b > latest) latest = b
  }
  if (!latest) return SYSTEM_START_MONTH
  let [y, m] = latest.split('-').map(Number)
  m++; if (m > 12) { m = 1; y++ }
  const next = `${y}-${String(m).padStart(2, '0')}`
  return next > SYSTEM_START_MONTH ? next : SYSTEM_START_MONTH
}

export async function getMitraRoiStats(outletId: string | 'all', allowedOutletIds: string[]) {
  const targetOutlets = outletId === 'all' ? allowedOutletIds : [outletId]
  if (targetOutlets.length === 0) {
    return {
      systemProfitMitra: 0,
      historisProfitMitra: 0,
      nilaiInvestasi: 0,
      totalProfitKumulatif: 0,
      roi: 0,
      bepPercentage: 0
    }
  }

  const bepMap = await getMitraRealtimeBepBreakdown(targetOutlets)
  
  let nilaiInvestasi = 0
  let historisProfitMitra = 0
  let systemProfitMitra = 0
  let totalDanaKembali = 0

  for (const oid of targetOutlets) {
    const item = bepMap[oid]
    if (item) {
      nilaiInvestasi += item.modalInvestasi
      // Termasuk transfer lewat sistem — sebelumnya hanya historis, sehingga
      // "profit historis" dan "total dana kembali" bercerita beda.
      historisProfitMitra += item.danaSudahKembali
      systemProfitMitra += item.akrualBelumDitransfer
      totalDanaKembali += item.totalDanaKembali
    }
  }

  const roi = nilaiInvestasi > 0 ? (totalDanaKembali / nilaiInvestasi) * 100 : 0
  const bepPercentage = Math.max(0, Math.min(Math.round(roi * 10) / 10, 100))

  return {
    systemProfitMitra,
    historisProfitMitra,
    nilaiInvestasi,
    totalProfitKumulatif: totalDanaKembali,
    roi: Math.round(roi * 10) / 10,
    bepPercentage
  }
}

export interface MitraMonthlyProfitItem {
  monthKey: string
  monthLabel: string
  netProfit: number
  mitraShare: number
  profitSharingPct: number
  managementFee: number
  isTransferred: boolean
  isClosed: boolean
}

export interface MitraRealtimeBepItem {
  outletId: string
  modalInvestasi: number
  omzetHistoris: number
  transferHistoris: number
  /** Jumlah `mitra_transfers.nominal` — bagi hasil yang sudah ditransfer lewat sistem. */
  transferSistem: number
  /** omzetHistoris + transferHistoris + transferSistem. Uang yang sudah sampai ke mitra. */
  danaSudahKembali: number
  /** Bagi hasil bulan-bulan yang belum ditransfer (akrual), per kebijakan bulan itu. */
  akrualBelumDitransfer: number
  /** `false` bila `mitra_investments.is_profit_sharing_active` dimatikan owner. */
  profitSharingActive: boolean
  revenue: number
  cogs: number
  opex: number
  managementFee: number
  netProfit: number
  mitraShare: number
  totalDanaKembali: number
  sisaModal: number
  roiPct: number
  bepPercentage: number
  isBep: boolean
  monthlyBreakdown: MitraMonthlyProfitItem[]
}

export async function getMitraRealtimeBepBreakdown(mitraOutletIds: string[]): Promise<Record<string, MitraRealtimeBepItem>> {
  if (mitraOutletIds.length === 0) return {}
  const supabase = createServiceClient()

  const months = monthsSinceSystemStart()

  // 1. Fetch investments, profiles, transfers, and master outlet/staff metadata
  const [invRes, profRes, transfersRes, allOpsRes, mgrStaffRes] = await Promise.all([
    supabase.from('mitra_investments').select('*').in('outlet_id', mitraOutletIds),
    supabase.from('mitra_profiles').select('*'),
    supabase.from('mitra_transfers').select('*').in('outlet_id', mitraOutletIds),
    supabase.from('outlets').select('id, name, slug, type, is_active, status').in('type', ['internal', 'mitra']),
    supabase.from('staff_outlets').select('staff_id, outlet_id, outlet_staff!inner(role)').in('outlet_staff.role', ['area_manager', 'regional_manager'])
  ])

  const invMap: Record<string, any> = {}
  ;(invRes.data || []).forEach(inv => {
    invMap[inv.outlet_id] = inv
  })
  const profiles = profRes.data || []
  const transfersData = transfersRes.data || []

  const operationalOutletIds = (allOpsRes.data || [])
    .filter((o: any) => o.slug !== 'sawangan-depok-internal' && o.status === 'active' && o.is_active === true)
    .map((o: any) => o.id)

  const operationalOutlets = (allOpsRes.data || []).map((o: any) => ({
    id: o.id,
    name: o.name,
    is_active: o.is_active
  }))

  const managerMap = new Map<string, any>()
  for (const r of (mgrStaffRes.data || []) as any[]) {
    if (!managerMap.has(r.staff_id)) {
      managerMap.set(r.staff_id, { staff_id: r.staff_id, role: r.outlet_staff.role, outlet_ids: [] })
    }
    managerMap.get(r.staff_id)!.outlet_ids.push(r.outlet_id)
  }
  const managerAssignments = Array.from(managerMap.values())

  const resultMap: Record<string, MitraRealtimeBepItem> = {}

  // 2. Agregat PER BULAN.
  // Single Source of Truth: Selaras 100% dengan Tab Laba Rugi (ProfitView / useSalesDaily / mitraPnl)
  type WindowFin = { grossRevenue: number; totalDeductions: number; totalCogs: number; opex: number; waste: number }
  const emptyFin = (): WindowFin => ({ grossRevenue: 0, totalDeductions: 0, totalCogs: 0, opex: 0, waste: 0 })

  async function aggregateMonth(from: string, to: string, monthKey: string): Promise<Record<string, WindowFin>> {
    const acc: Record<string, WindowFin> = {}
    const bump = (oid: string) => (acc[oid] ||= emptyFin())

    // Optimasi performa: Data Agustus 2026 adalah data closing audit statis.
    if (isAugust2026Period(from, to)) {
      const allCovered = mitraOutletIds.every(oid => {
        const cutoff = invMap[oid]?.tanggal_mulai
        return (cutoff && to < cutoff) || getMitraAugustClosing(oid) !== undefined || !invMap[oid]
      })
      if (allCovered) {
        for (const oid of mitraOutletIds) {
          const cutoff = invMap[oid]?.tanggal_mulai
          if (cutoff && to < cutoff) continue
          const closing = getMitraAugustClosing(oid)
          if (closing) {
            const a = bump(oid)
            a.grossRevenue = closing.totals.grossRevenue
            a.totalDeductions = closing.totals.totalDeductions
            a.totalCogs = closing.totals.totalCogs
            a.opex = closing.totals.totalOpex
            a.waste = closing.totals.totalWaste
          }
        }
        return acc
      }
    }

    const [yStr, mStr] = monthKey.split('-')
    const mYear = Number(yStr)
    const mMonth = Number(mStr)

    const [salesDailyRows, settlementsRes, hppRows, wasteRes, pettyRows, monthlyRows, payrollRes] = await Promise.all([
      fetchAllPages<any>(() => supabase
        .from('sales_daily_scoped')
        .select('outlet_id, sales_source, sales_date, omzet, total_deductions')
        .in('outlet_id', mitraOutletIds)
        .neq('outlet_id', TEST_OUTLET_ID)
        .gte('sales_date', from)
        .lte('sales_date', to)
        .order('sales_date', { ascending: true })
      ).catch(err => {
        console.warn('Gagal memuat sales_daily_scoped di mitraRoi:', err)
        return [] as any[]
      }),
      fetchAllPages<any>(() => supabase
        .from('platform_settlements')
        .select('outlet_id, platform, tanggal, commission, promo_merchant')
        .in('outlet_id', mitraOutletIds)
        .gte('tanggal', from)
        .lte('tanggal', to)
        .order('id', { ascending: true })
      ).catch(err => {
        console.warn('Gagal memuat platform_settlements di mitraRoi:', err)
        return [] as any[]
      }),
      (mitraOutletIds.length === 1
        ? fetchHppRows(supabase, { from, to, outletId: mitraOutletIds[0], source: 'all' })
        : Promise.all(mitraOutletIds.map(oid => fetchHppRows(supabase, { from, to, outletId: oid, source: 'all' }))).then(res => res.flat())
      ).catch(err => {
        console.warn('Gagal memuat fetchHppRows di mitraRoi:', err)
        return []
      }),
      supabase.rpc('get_waste_periode', { p_from: from, p_to: to }).then(async res => {
        let data = (res.data || []).filter((r: any) => mitraOutletIds.includes(r.outlet_id))
        if (!data || data.length === 0) {
          const { data: directReports } = await supabase
            .from('stok_waste_reports')
            .select('outlet_id, qty, bahan_baku_id')
            .in('outlet_id', mitraOutletIds)
            .eq('status', 'APPROVED')
            .gte('created_at', `${from}T00:00:00+07:00`)
            .lte('created_at', `${to}T23:59:59+07:00`)
          if (directReports && directReports.length > 0) {
            const { data: prices } = await supabase.from('bahan_baku_harga').select('bahan_baku_id, harga_beli')
            const pMap = new Map((prices || []).map((p: any) => [p.bahan_baku_id, Number(p.harga_beli) || 0]))
            const sumMap = new Map<string, number>()
            for (const dr of directReports) {
              const h = pMap.get(dr.bahan_baku_id) || 0
              sumMap.set(dr.outlet_id, (sumMap.get(dr.outlet_id) || 0) + ((Number(dr.qty) || 0) * h))
            }
            data = Array.from(sumMap.entries()).map(([outlet_id, nilai_waste]) => ({ outlet_id, nilai_waste }))
          }
        }
        return { data }
      }),
      fetchAllPages<any>(() => supabase
        .from('petty_cash_expenses')
        .select('id, amount, outlet_id, category, description, expense_date')
        .in('outlet_id', mitraOutletIds)
        .is('deleted_at', null)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('id', { ascending: true })
      ).catch(err => {
        console.warn('Gagal memuat petty_cash_expenses di mitraRoi:', err)
        return [] as any[]
      }),
      fetchAllPages<any>(() => supabase
        .from('expenses')
        .select('id, amount, outlet_id, category, description, expense_date')
        .in('outlet_id', mitraOutletIds)
        .eq('type', 'expense')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('id', { ascending: true })
      ).catch(err => {
        console.warn('Gagal memuat expenses di mitraRoi:', err)
        return [] as any[]
      }),
      supabase
        .from('payroll_records')
        .select(`
          period_month,
          period_year,
          outlet_id,
          total_salary,
          bonus,
          outlet_staff!payroll_records_staff_id_fkey(
            id,
            role,
            status
          )
        `)
        .eq('period_month', mMonth)
        .eq('period_year', mYear)
    ])

    // 1. Rekonsiliasi Omzet & Potongan (termasuk Komisi Platform Settlement)
    const normalizePlatform = (src: string) => {
      const s = (src || '').toLowerCase()
      if (s.includes('gofood') || s.includes('gojek')) return 'gofood'
      if (s.includes('grab')) return 'grabfood'
      if (s.includes('shopee')) return 'shopeefood'
      if (s.includes('tiktok')) return 'tiktokgo'
      return s
    }

    const stlCommissionMap = new Map<string, number>()
    const stlPromoMap = new Map<string, number>()
    for (const s of (settlementsRes || [])) {
      const plat = normalizePlatform(s.platform)
      const key = `${s.outlet_id}__${plat}__${s.tanggal}`
      stlCommissionMap.set(key, (stlCommissionMap.get(key) || 0) + (Number(s.commission) || 0))
      if (s.promo_merchant !== null && s.promo_merchant !== undefined) {
        stlPromoMap.set(key, (stlPromoMap.get(key) || 0) + Math.max(0, Number(s.promo_merchant) || 0))
      }
    }

    for (const row of (salesDailyRows || [])) {
      const cutoff = invMap[row.outlet_id]?.tanggal_mulai
      if (cutoff && row.sales_date < cutoff) continue
      let totalDed = Number(row.total_deductions) || 0
      const plat = normalizePlatform(row.sales_source)
      const key = `${row.outlet_id}__${plat}__${row.sales_date}`
      const platformFee = stlCommissionMap.get(key) || 0

      if (stlPromoMap.has(key) && (plat === 'gofood' || plat === 'shopeefood')) {
        totalDed = stlPromoMap.get(key) || 0
      }

      const gross = (Number(row.omzet) || 0) + (Number(row.total_deductions) || 0)
      const a = bump(row.outlet_id)
      a.grossRevenue += gross
      a.totalDeductions += (totalDed + platformFee)
    }

    // 2. HPP Bahan Baku dari fetchHppRows
    for (const r of (hppRows || [])) {
      if (mitraOutletIds.includes(r.outlet_id)) {
        const cutoff = invMap[r.outlet_id]?.tanggal_mulai
        if (cutoff && to < cutoff) continue
        bump(r.outlet_id).totalCogs += (Number(r.hpp) || 0)
      }
    }

    // 3. OPEX via calculateProratedExpenses (termasuk Gaji HR & Alokasi Manajer)
    const simpanKasKecil = buatSaringanKasKecil(monthlyRows || [])
    const rawExpenses = [
      ...(monthlyRows || []).map((m: any) => ({
        id: m.id,
        outlet_id: m.outlet_id,
        outlet_name: 'Outlet',
        amount: Number(m.amount) || 0,
        category: m.category,
        description: m.description ?? '',
        expense_date: m.expense_date,
        period_month: `${(m.expense_date || '').slice(0, 7)}-01`,
        scope: 'outlet' as const,
        source: 'monthly' as const
      })),
      ...(pettyRows || []).filter(simpanKasKecil).map((p: any) => ({
        id: p.id,
        outlet_id: p.outlet_id,
        outlet_name: 'Outlet',
        amount: Number(p.amount) || 0,
        category: p.category,
        description: p.description ?? '',
        expense_date: p.expense_date,
        period_month: `${(p.expense_date || '').slice(0, 7)}-01`,
        scope: 'outlet' as const,
        source: 'petty_cash' as const
      }))
    ]

    const ALLOWED_ROLES = ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager']
    const payrollRows = ((payrollRes as any)?.data || [])
      .filter((r: any) => {
        const s = r.outlet_staff
        if (!s) return false
        if (isTestOrDevStaff(s)) return false
        if (!ALLOWED_ROLES.includes(s.role)) return false
        const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
        const effectiveOutletId = (r.outlet_id || s.outlet_id) as string
        if (!isManager) {
          if (!effectiveOutletId || effectiveOutletId === KANTOR_PUSAT_ID) return false
          if (!mitraOutletIds.includes(effectiveOutletId)) return false
        }
        return true
      })
      .map((r: any) => ({
        staff_id: (r.outlet_staff?.id || r.staff_id) as string,
        outlet_id: (r.outlet_id || r.outlet_staff?.outlet_id) as string,
        total_salary: Number(r.total_salary) || 0,
        bonus: Number(r.bonus) || 0,
        period_month: Number(r.period_month),
        period_year: Number(r.period_year),
        role: r.outlet_staff?.role || 'crew'
      }))

    const prorata = calculateProratedExpenses({
      filter: { from, to, outletId: 'all', source: 'all' },
      rawExpenses,
      payrollRecords: payrollRows,
      outlets: operationalOutlets,
      managerAssignments,
      operationalOutletIds
    })

    for (const r of prorata.rows) {
      if (r.scope === 'outlet' && r.outlet_id && mitraOutletIds.includes(r.outlet_id)) {
        const cutoff = invMap[r.outlet_id]?.tanggal_mulai
        if (cutoff && r.expense_date < cutoff) continue
        bump(r.outlet_id).opex += (Number(r.amount) || 0)
      }
    }

    // 4. Waste Bahan Baku
    for (const w of ((wasteRes as any)?.data || [])) {
      if (mitraOutletIds.includes(w.outlet_id)) {
        const cutoff = invMap[w.outlet_id]?.tanggal_mulai
        if (cutoff && to < cutoff) continue
        bump(w.outlet_id).waste += (Number(w.nilai_waste) || 0)
      }
    }

    return acc
  }

  const monthlyAgg = await Promise.all(months.map(m => aggregateMonth(m.from, m.to, m.key)))

  for (const oid of mitraOutletIds) {
    const inv = invMap[oid]
    const profile = profiles.find(p => (p.outlet_ids || []).includes(oid))
    const modalInvestasi = Number(inv?.nilai_investasi) || 0
    const omzetHistoris = Number(inv?.omzet_historis) || 0
    const transferHistoris = Number(inv?.transfer_historis) || 0
    const systemTransfers = transfersData.filter(t => t.outlet_id === oid).reduce((sum, t) => sum + (Number(t.nominal) || 0), 0)

    const outletTanggalMulai = inv?.tanggal_mulai || profile?.tanggal_pks
    const outletStartMonth = outletTanggalMulai ? outletTanggalMulai.slice(0, 7) : SYSTEM_START_MONTH

    // "Sudah kembali" = uang yang benar-benar sudah sampai ke mitra: bagi hasil
    // historis (diselesaikan di luar sistem) + transfer yang tercatat. Ini SATU
    // definisi, dipakai untuk memicu kebijakan BEP sekaligus untuk progress bar.
    const danaSudahKembali = omzetHistoris + transferHistoris + systemTransfers
    const isBepAlready = modalInvestasi > 0 && danaSudahKembali >= modalInvestasi
    const legacyShare = inv?.persentase_bagi_hasil ?? profile?.profit_sharing_pct ?? 50
    const legacyFee = Number(inv?.management_fee) || 0
    const sharingActive = inv?.is_profit_sharing_active !== false

    // Akrual hanya untuk bulan yang belum ditransfer, dan tiap bulan memakai
    // kebijakan yang berlaku di bulan itu.
    const mulaiAkru = accrualStartMonth(transfersData.filter(t => t.outlet_id === oid))

    let grossRevenue = 0
    let totalDeductions = 0
    let totalCogs = 0
    let opex = 0
    let waste = 0
    let managementFee = 0
    let akrualBelumDitransfer = 0
    const monthlyBreakdown: MitraMonthlyProfitItem[] = []
    const curMonthKey = todayWib().slice(0, 7)

    months.forEach((m, idx) => {
      if (m.key < outletStartMonth) return
      const w = monthlyAgg[idx][oid]
      if (!w) return
      const p = resolveMitraPolicy({
        periodFrom: m.from,
        isBep: isBepAlready,
        legacyProfitSharingPct: legacyShare,
        legacyManagementFee: legacyFee
      })
      const fee = Math.round((w.grossRevenue * p.managementFeePct) / 100)
      let laba = w.grossRevenue - w.totalDeductions - w.totalCogs - w.opex - w.waste - fee

      const closing = isAugust2026Period(m.from, m.to) ? getMitraAugustClosing(oid) : undefined
      if (closing) {
        laba = Math.round(closing.totals.netProfit)
      }

      grossRevenue += w.grossRevenue
      totalDeductions += w.totalDeductions
      totalCogs += w.totalCogs
      opex += w.opex
      waste += w.waste
      managementFee += fee

      const isTransferred = m.key < mulaiAkru
      let monthMitraShare = 0
      if (closing) {
        monthMitraShare = Math.round(closing.totals.mitraShare)
      } else if (sharingActive && laba > 0) {
        monthMitraShare = Math.round((laba * p.profitSharingPct) / 100)
      }

      if (!isTransferred) {
        akrualBelumDitransfer += monthMitraShare
      }

      const [yr, mo] = m.key.split('-')
      const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
      const monthLabel = `${monthNames[Number(mo)] || m.key} ${yr}`

      monthlyBreakdown.push({
        monthKey: m.key,
        monthLabel,
        netProfit: Math.round(laba),
        mitraShare: Math.round(monthMitraShare),
        profitSharingPct: p.profitSharingPct,
        managementFee: Math.round(fee),
        isTransferred,
        isClosed: m.key < curMonthKey
      })
    })

    const netProfit = grossRevenue - totalDeductions - totalCogs - opex - waste - managementFee
    const mitraShare = akrualBelumDitransfer

    const totalDanaKembali = danaSudahKembali + akrualBelumDitransfer
    const roiPct = modalInvestasi > 0 ? (totalDanaKembali / modalInvestasi) * 100 : 0
    const bepPercentage = Math.max(0, Math.min(Math.round(roiPct * 10) / 10, 100))
    const isBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi
    const sisaModal = Math.max(0, modalInvestasi - totalDanaKembali)

    resultMap[oid] = {
      outletId: oid,
      modalInvestasi,
      omzetHistoris,
      transferHistoris,
      transferSistem: systemTransfers,
      danaSudahKembali,
      akrualBelumDitransfer: Math.round(akrualBelumDitransfer),
      profitSharingActive: sharingActive,
      revenue: Math.round(grossRevenue),
      cogs: Math.round(totalCogs),
      opex: Math.round(opex + waste),
      managementFee: Math.round(managementFee),
      netProfit: Math.round(netProfit),
      mitraShare: Math.round(mitraShare),
      totalDanaKembali: Math.round(totalDanaKembali),
      sisaModal: Math.round(sisaModal),
      roiPct,
      bepPercentage,
      isBep,
      monthlyBreakdown
    }
  }

  return resultMap
}

