'use client'

import { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesDaily } from '@/hooks/useSalesDaily'
import { useExpenses } from '@/hooks/useExpenses'
import { useHpp } from '@/hooks/useHpp'
import { useWaste } from '@/hooks/useWaste'
import { computeCompanyProfit } from '@/lib/profit'
import { PeriodFilter } from '@/components/PeriodFilter'
import { rupiah } from '@/lib/format'
import { PageHeader, StatTilesSkeleton } from '@/components/ui'
import { toast } from 'sonner'
import CountUp from 'react-countup'
import { 
  TrendingUp, 
  Boxes, 
  Layers, 
  Receipt, 
  Banknote, 
  Calculator,
  ShieldCheck,
  AlertTriangle,
  PieChart,
  Store,
  Sparkles,
  Search,
  Download,
  Clock,
  RefreshCw
} from 'lucide-react'
import { motion } from 'framer-motion'
import { isTestOutlet } from '@/lib/outletFilters'
import { CATEGORY_META } from '@/lib/expenseCategories'
import { useMitraInvestments } from '@/hooks/useMitraInvestments'
import { NetProfitBreakdownModal } from '@/components/NetProfitBreakdownModal'
import { GrossSalesBreakdownModal } from '@/components/profit/GrossSalesBreakdownModal'
import { CogsWasteBreakdownModal } from '@/components/profit/CogsWasteBreakdownModal'
import { OpexBreakdownModal } from '@/components/profit/OpexBreakdownModal'
import { DownloadProfitDataModal } from '@/components/profit/DownloadProfitDataModal'
import { bukuKasHref, pettyCashHref } from '@/lib/bukuKasLink'
import { isInScope, mitraOutletIds, SCOPE_LABEL, type ProfitScope } from '@/lib/outletOwnership'
import { useProratedOpex } from '@/hooks/useProratedOpex'
import { PRORATED_CATEGORIES } from '@/lib/opexProrata'
import { clearPeriodCache } from '@/lib/periodCache'
import { createThrottledRefresher } from '@/lib/realtimeThrottle'
import { resolveMitraPolicy, calculateMitraBepStatus } from '@/lib/mitraPolicy'
import { getSourceLabel } from '@/lib/channels'
import { useTikTokSettlement } from '@/hooks/useTikTokSettlement'

function formatLastUpdated(dateIso?: string) {
  if (!dateIso) return ''
  try {
    const d = new Date(dateIso)
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' WIB'
  } catch {
    return ''
  }
}

export default function ProfitView({ scope = 'all' }: { scope?: ProfitScope }) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const { data: rawOutlets = [] } = useOutlets()
  const { investments: mitraInvestments, loading: mitraLoading } = useMitraInvestments()

  const allOutlets = useMemo(() => [
    { id: 'ss-online', name: 'SS ONLINE', type: 'online' } as any,
    ...rawOutlets.filter(o => !isTestOutlet(o))
  ], [rawOutlets])

  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  // Himpunan outlet kemitraan — dasar pemisahan Internal vs Mitra.
  const mitraIds = useMemo(
    () => mitraOutletIds(allOutlets, mitraInvestments),
    [allOutlets, mitraInvestments],
  )
  const cutoffDates = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, inv] of Object.entries(mitraInvestments)) {
      if (inv?.tanggal_mulai) {
        map.set(id, inv.tanggal_mulai)
      }
    }
    return map
  }, [mitraInvestments])

  const inScope = useMemo(
    () => (outletId: string | null | undefined, dateStr?: string | null) => {
      const targetDate = dateStr ?? filter.to ?? filter.from
      return isInScope(scope, outletId, mitraIds, targetDate, cutoffDates)
    },
    [scope, mitraIds, filter.to, filter.from, cutoffDates],
  )

  // Daftar outlet (dropdown filter & seed tabel) ikut menyempit sesuai scope.
  const outlets = useMemo(
    () => allOutlets.filter(o => inScope(o.id)),
    [allOutlets, inScope],
  )

  // Filter outlet tersimpan di store lintas halaman. Kalau pengguna memilih
  // satu outlet di tab Internal lalu pindah ke tab Mitra, outlet itu tak ada
  // lagi di daftar — tanpa reset ini seluruh angka jadi nol tanpa penjelasan.
  useEffect(() => {
    if (mitraLoading || lockedOutletId) return
    if (filter.outletId === 'all') return
    if (inScope(filter.outletId)) return
    setFilter({ ...filter, outletId: 'all' })
  }, [mitraLoading, lockedOutletId, filter, inScope, setFilter])

  // Laba Rugi Global hanya punya satu arti: seluruh outlet. Pemilih outletnya
  // disembunyikan, dan nilainya DIPAKSA 'all' — bukan sekadar disembunyikan.
  //
  // Filter outlet hidup di store lintas halaman, dan penjaga di atas tak pernah
  // menolaknya di scope 'all' (semua outlet dianggap in-scope). Tanpa paksaan
  // ini, memilih satu outlet di halaman lain membuat Laba Rugi Global terbuka
  // dalam keadaan sudah terfilter — diam-diam tanpa opex kantor pusat, karena
  // opex itu hanya ikut saat `isAllOutlets`.
  //
  // `lockedOutletId` (role mitra, read-only) TIDAK boleh ditimpa: kuncinya
  // justru yang menjaga mereka melihat outletnya sendiri saja.
  const hideOutletPicker = scope === 'all' && !lockedOutletId
  useEffect(() => {
    if (!hideOutletPicker) return
    if (filter.outletId === 'all') return
    setFilter({ ...filter, outletId: 'all' })
  }, [hideOutletPicker, filter, setFilter])

  const [outletSearch, setOutletSearch] = useState('')
  const [sortBy, setSortBy] = useState<'net' | 'margin' | 'omzet'>('net')
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toISOString())
  const todayJakarta = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()), [])
  const isPast = filter.to < todayJakarta

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      clearPeriodCache()
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['sales-daily'] }),
        queryClient.refetchQueries({ queryKey: ['expenses'] }),
        queryClient.refetchQueries({ queryKey: ['hpp-client-calculated'] }),
        queryClient.refetchQueries({ queryKey: ['hpp-client-calculated-v2'] }),
        queryClient.refetchQueries({ queryKey: ['waste'] }),
        queryClient.refetchQueries({ queryKey: ['prorata-payroll-records'] }),
        queryClient.refetchQueries({ queryKey: ['prorata-staff-financials'] }),
        queryClient.refetchQueries({ queryKey: ['prorata-rollover-expenses'] }),
        queryClient.refetchQueries({ queryKey: ['prorata-crew-bonus'] }),
        queryClient.refetchQueries({ queryKey: ['mitra-investments'] }),
        queryClient.refetchQueries({ queryKey: ['outlets'] }),
      ])
      setLastUpdated(new Date().toISOString())
      toast.success('Memperbarui data laba rugi dari database...')
    } catch (err) {
      console.error('Failed to refresh profit data:', err)
      toast.error('Gagal memperbarui data laba rugi')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    // Debounce 600 ms lama hampir selalu "menyala" di jam ramai (jeda 600 ms
    // antar-order itu sering), dan tiap nyala mengunduh ulang HPP ±30.000
    // order + 90.000 item. Kini maks. sekali per 30 detik (event pertama tetap
    // langsung), dan ditunda selama tab tersembunyi.
    const refresher = createThrottledRefresher(() => {
        clearPeriodCache()
        queryClient.invalidateQueries({ queryKey: ['sales-daily'] })
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
        queryClient.invalidateQueries({ queryKey: ['hpp-client-calculated'] })
        queryClient.invalidateQueries({ queryKey: ['hpp-client-calculated-v2'] })
        queryClient.invalidateQueries({ queryKey: ['waste'] })
        queryClient.invalidateQueries({ queryKey: ['prorata-payroll-records'] })
        queryClient.invalidateQueries({ queryKey: ['prorata-staff-financials'] })
        queryClient.invalidateQueries({ queryKey: ['prorata-rollover-expenses'] })
        queryClient.invalidateQueries({ queryKey: ['prorata-crew-bonus'] })
        queryClient.invalidateQueries({ queryKey: ['mitra-investments'] })
        queryClient.invalidateQueries({ queryKey: ['outlets'] })
    }, 30_000)
    const invalidate = () => refresher.trigger()

    const channel = supabase
      .channel('profit-realtime-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_expenses' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waste_records' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_records' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_financials' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mitra_investments' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlets' }, invalidate)
      .subscribe()

    return () => {
      refresher.dispose()
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  const effectiveFilter = useMemo(() => ({ ...filter, source: 'all' as const }), [filter])
  
  const sales = useSalesDaily(effectiveFilter, outlets)
  const expenses = useExpenses(effectiveFilter)
  const hpp = useHpp(effectiveFilter)
  const waste = useWaste(effectiveFilter)
  const { settlements: tiktokSettlements } = useTikTokSettlement({
    from: effectiveFilter.from,
    to: effectiveFilter.to,
  })

  // Penyaringan scope dipasang SEKALI di sumber datanya, bukan di tiap
  // perhitungan — hero metrics, laporan P&L, leaderboard, dan ekspor CSV/PDF
  // semuanya membaca baris yang sudah disaring ini.
  const salesRows = useMemo(() => sales.rows.filter(r => inScope(r.outlet_id, (r as any).sales_date || (r as any).date || (r as any).order_date)), [sales.rows, inScope])
  const hppRows = useMemo(() => hpp.rows.filter(r => inScope(r.outlet_id, (r as any).date || (r as any).order_date)), [hpp.rows, inScope])
  const wasteRows = useMemo(() => waste.rows.filter(r => inScope(r.outlet_id, (r as any).date || (r as any).created_at)), [waste.rows, inScope])
  // Biaya pusat (`scope === 'pusat'`) tak punya outlet_id: ia beban kantor
  // pusat, jadi ikut di tampilan gabungan & Internal, tapi tidak di Mitra.
  const rawExpenseRows = useMemo(
    () => expenses.rows.filter(r => (r.scope === 'pusat' ? scope !== 'mitra' : inScope(r.outlet_id, (r as any).expense_date || (r as any).date))),
    [expenses.rows, inScope, scope],
  )

  const {
    rows: expenseRows,
    isProrated,
    monthInfo: prorataMonthInfo,
    loading: prorataLoading,
  } = useProratedOpex({
    filter: effectiveFilter,
    rawExpenses: rawExpenseRows,
    outlets,
  })

  const loading = sales.loading || expenses.loading || hpp.loading || waste.loading || mitraLoading || prorataLoading
  const error = sales.error || expenses.error || hpp.error || waste.error

  const isAllOutlets = filter.outletId === 'all'

  // Perhitungan Management Fee Kemitraan (3% Gross Sales untuk outlet belum BEP per Sept 2026)
  const managementFeeData = useMemo(() => {
    let totalMitraFee = 0
    let grossMitraBelumBep = 0
    const perOutletFee = new Map<string, { gross: number; fee: number; pct: number; isBep: boolean }>()

    for (const [oid, inv] of Object.entries(mitraInvestments)) {
      const outletSales = sales.rows.filter(
        r => r.outlet_id === oid && 
             !isTestOutlet(r.outlet_id) &&
             isInScope('mitra', oid, mitraIds, (r as any).sales_date || (r as any).date, cutoffDates)
      )
      const gross = outletSales.reduce((sum, r) => sum + (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0), 0)

      const bepInfo = calculateMitraBepStatus(inv, oid, effectiveFilter.from, inv.isBep)
      const policy = resolveMitraPolicy({
        periodFrom: effectiveFilter.from,
        isBep: bepInfo.isBep,
        legacyProfitSharingPct: inv.persentase_bagi_hasil,
        legacyManagementFee: inv.management_fee,
      })

      const fee = policy.managementFeePct > 0 ? Math.round((gross * policy.managementFeePct) / 100) : 0
      if (policy.managementFeePct > 0) {
        grossMitraBelumBep += gross
      }
      perOutletFee.set(oid, { gross, fee, pct: policy.managementFeePct, isBep: bepInfo.isBep })
      totalMitraFee += fee
    }

    let jumlahOutletBelumBep = 0
    perOutletFee.forEach(v => { if (v.pct > 0) jumlahOutletBelumBep++ })

    return {
      totalMitraFee,
      grossMitraBelumBep,
      jumlahOutletBelumBep,
      perOutletFee,
    }
  }, [mitraInvestments, sales.rows, effectiveFilter.from, mitraIds, cutoffDates])

  // Omzet penjualan outlet (sebelum ditambahkan management fee)
  const actualGrossSales = useMemo(
    () => salesRows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0), 0), 
    [salesRows]
  )

  // Penerimaan Management Fee oleh Kantor Pusat (scope all & internal)
  const managementFeeReceived = (scope === 'all' || scope === 'internal')
    ? (isAllOutlets 
        ? managementFeeData.totalMitraFee 
        : (mitraIds.has(filter.outletId) ? (managementFeeData.perOutletFee.get(filter.outletId)?.fee ?? 0) : 0))
    : 0
  
  // Pembayaran Management Fee ke Pusat oleh Kemitraan (khusus scope mitra)
  // Sisi BEBAN fee. Wajib ikut di scope 'all': di sana kedua kantongnya
  // (pusat penerima, mitra pembayar) sama-sama ada di dalam layar, jadi kalau
  // hanya pendapatannya yang dibukukan, laba gabungan kelebihan sebesar fee —
  // dan `all` tak pernah sama dengan `internal` + `mitra`.
  const managementFeeExpense = (scope === 'mitra' || scope === 'all') 
    ? (isAllOutlets ? managementFeeData.totalMitraFee : (managementFeeData.perOutletFee.get(filter.outletId)?.fee ?? 0))
    : 0

  // Total HPP outlet kemitraan dalam cakupan filter, dipisah tiga angka:
  // `hpp` = yang ditagihkan ke mitra (base + 10%), `base` = modal bahan pusat,
  // `markup` = selisih keduanya. Ketiganya dijumlah dari nilai per item supaya
  // eksak — tidak ada pembagian balik 1,1 di level agregat.
  const mitraHppTotals = useMemo(() => {
    return hpp.rows
      .filter(r => (isAllOutlets ? mitraIds.has(r.outlet_id) : (r.outlet_id === filter.outletId && mitraIds.has(r.outlet_id))) && !isTestOutlet(r.outlet_id))
      .reduce(
        (acc, r) => ({
          hpp: acc.hpp + (Number(r.hpp) || 0),
          base: acc.base + (Number(r.baseHpp) || 0),
          markup: acc.markup + (Number(r.markup) || 0),
        }),
        { hpp: 0, base: 0, markup: 0 },
      )
  }, [hpp.rows, mitraIds, isAllOutlets, filter.outletId])

  const totalMitraHpp = mitraHppTotals.hpp
  const totalMitraBaseHpp = mitraHppTotals.base

  // Pendapatan Margin Pasokan Bahan Baku Mitra = 10% dari HPP DASAR, yaitu
  // selisih antara yang ditagihkan ke mitra dan modal bahan pusat.
  //
  // Diakui di dua scope dengan alasan berbeda:
  // - `internal`: HPP & omzet mitra tak ikut di sini, jadi ini pendapatan baru.
  // - `all`: HPP mitra ikut sebagai biaya dalam angka yang SUDAH ber-markup,
  //   jadi margin ini mengembalikannya ke modal sebenarnya. Kalau dicabut,
  //   laba global malah terlalu kecil sebesar markup itu.
  const mitraHppMarginReceived = (scope === 'all' || scope === 'internal')
    ? mitraHppTotals.markup
    : 0

  // Omzet Kotor = uang dari PELANGGAN saja. Fee manajemen dan margin pasokan
  // bahan bukan penjualan; keduanya pindah ke blok antar-kantong di bawah
  // "Penjualan Bersih" (tetap dijumlah ke Pendapatan Bersih, jadi laba tidak
  // bergeser). Selama keduanya ikut di sini, Margin Kotor % dan seluruh kartu
  // rasio memakai penyebut yang digelembungkan — dan gelembungnya membesar
  // seiring bertambahnya outlet mitra.
  const actualGrossRevenue = actualGrossSales

  const totalPotongan = useMemo(
    () => salesRows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0), 
    [salesRows]
  )
  const totalPlatformFee = useMemo(
    () => salesRows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (Number(r.platform_fee) || 0), 0), 
    [salesRows]
  )
  const totalDeductions = totalPotongan + totalPlatformFee

  const pengeluaranOutletBulanan = useMemo(
    () => expenseRows.filter(r => r.scope === 'outlet' && r.source === 'monthly' && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name)).reduce((sum, r) => sum + r.amount, 0),
    [expenseRows]
  )
  const totalJointExpense = useMemo(
    () => expenseRows
      .filter(r => r.scope === 'outlet' && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name) && ((r as any).category === 'joint_expense' || (r as any).category === 'joint_expanse'))
      .reduce((sum, r) => sum + r.amount, 0),
    [expenseRows]
  )
  const pengeluaranOutletBulananMurni = Math.max(0, pengeluaranOutletBulanan - totalJointExpense)
  const pengeluaranOutletPettyCash = useMemo(
    () => expenseRows.filter(r => r.scope === 'outlet' && r.source === 'petty_cash' && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name)).reduce((sum, r) => sum + r.amount, 0),
    [expenseRows]
  )
  const pengeluaranOutlet = pengeluaranOutletBulanan + pengeluaranOutletPettyCash
  const pengeluaranPusat = useMemo(
    () => expenseRows.filter(r => r.scope === 'pusat').reduce((sum, r) => sum + r.amount, 0),
    [expenseRows]
  )
    
  const totalHpp = useMemo(
    () => hppRows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + r.hpp, 0), 
    [hppRows]
  )
  const totalWaste = useMemo(
    () => wasteRows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + r.nilai_waste, 0), 
    [wasteRows]
  )
  
  // Pendapatan bersih: Gross - Potongan (sudah termasuk Management Fee Mitra pada scope internal)
  const netRevenue = actualGrossRevenue - totalDeductions + managementFeeReceived + mitraHppMarginReceived - managementFeeExpense
  const labaKotor = netRevenue - totalHpp
  const marginKotor = actualGrossRevenue > 0 ? (labaKotor / actualGrossRevenue) * 100 : 0
  
  // Laba bersih outlet: untuk mitra, dipotong management fee pusat
  // Apakah ada transaksi antar-kantong (pusat <-> mitra) di scope ini, dan
  // apakah KEDUA sisinya berada di layar yang sama. Kalau ya, angka gabungan
  // wajib diberi keterangan: tanpa itu, laba global yang (benar) lebih kecil
  // dari penjumlahan kasar tampak seperti ada laba yang hilang.
  const adaAntarKantong = managementFeeReceived > 0 || mitraHppMarginReceived > 0 || managementFeeExpense > 0
  const duaSisiDiLayarSama = managementFeeReceived > 0 && managementFeeExpense > 0

  // managementFeeExpense sudah dipotong di netRevenue (blok antar-kantong).
  const labaBersih = labaKotor - pengeluaranOutlet - totalWaste
  
  const labaPerusahaan = computeCompanyProfit(labaBersih, pengeluaranPusat).labaPerusahaan
  const displayLaba = isAllOutlets ? labaPerusahaan : labaBersih
  const costBase = actualGrossRevenue > 0 ? actualGrossRevenue : (netRevenue > 0 ? netRevenue : 0)
  const displayMargin = costBase > 0 ? (displayLaba / costBase) * 100 : 0

  // Struktur Biaya vs Omzet:
  // Seluruh biaya dihitung proporsinya terhadap Omzet Kotor (actualGrossRevenue),
  // konsisten dengan judul card dan margin per outlet di leaderboard.
  const costHpp = scope === 'all' ? Math.max(0, totalHpp - mitraHppMarginReceived) : totalHpp
  const costOpex = pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)
  const costFee = totalDeductions + (scope === 'mitra' || (!isAllOutlets && mitraIds.has(filter.outletId)) ? managementFeeExpense : 0)
  const costWaste = totalWaste
  const totalBiaya = costHpp + costOpex + costFee + costWaste

  // Cost proportions (dalam persen terhadap Omzet Kotor)
  const pctHpp = costBase > 0 ? (costHpp / costBase) * 100 : 0
  const pctOpex = costBase > 0 ? (costOpex / costBase) * 100 : 0
  const pctFee = costBase > 0 ? (costFee / costBase) * 100 : 0
  const pctWaste = costBase > 0 ? (costWaste / costBase) * 100 : 0
  const pctTotalBiaya = costBase > 0 ? (totalBiaya / costBase) * 100 : 0
  const pctSisaMargin = costBase > 0 ? (displayLaba / costBase) * 100 : 0

  // Skala visual bar agar proporsional dan tidak meluber saat beban > 100% (saat rugi)
  const barScale = pctTotalBiaya > 100 ? (100 / pctTotalBiaya) : 1
  const barHpp = pctHpp * barScale
  const barOpex = pctOpex * barScale
  const barFee = pctFee * barScale
  const barWaste = pctWaste * barScale

  // Outlets breakdown
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; deductions: number; expense: number; hpp: number; waste: number }>()

    outlets.filter(o => !isTestOutlet(o)).forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 })
    })

    salesRows.filter(s => !isTestOutlet(s.outlet_id)).forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name || (s.outlet_id === 'ss-online' ? 'SS ONLINE' : 'Outlet Tidak Dikenal'), omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      const deductions = (Number(s.total_deductions) || 0) + (Number(s.platform_fee) || 0)
      const gross = (Number(s.omzet) || 0) + (Number(s.total_deductions) || 0)
      cur.omzet += gross
      cur.deductions += deductions
      map.set(s.outlet_id, cur)
    })

    expenseRows.filter(e => !isTestOutlet(e.outlet_id) && !isTestOutlet(e.outlet_name)).forEach(e => {
      if (e.scope !== 'outlet' || !e.outlet_id) return
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    hppRows.filter(h => !isTestOutlet(h.outlet_id)).forEach(h => {
      const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.hpp += h.hpp
      if (h.channels) {
        const curChannels = (cur as any).cogsChannels ?? { outlet: 0, food_apps: 0, tiktok_go: 0, website: 0 }
        curChannels.outlet += h.channels.outlet || 0
        curChannels.food_apps += h.channels.food_apps || 0
        curChannels.tiktok_go += h.channels.tiktok_go || 0
        curChannels.website += h.channels.website || 0
        ;(cur as any).cogsChannels = curChannels
      }
      map.set(h.outlet_id, cur)
    })

    wasteRows.filter(w => !isTestOutlet(w.outlet_id)).forEach(w => {
      const cur = map.get(w.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.waste += w.nilai_waste
      map.set(w.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        const grossRev = val.omzet
        const netRev = val.omzet - val.deductions
        const labaKotor = grossRev - val.hpp - val.deductions
        const feeInfo = managementFeeData.perOutletFee.get(id)
        const isOutletMitraScope = scope === 'internal' 
          ? false 
          : (scope === 'mitra' ? true : mitraIds.has(id))
        const mgmtFee = isOutletMitraScope ? (feeInfo?.fee ?? 0) : 0
        const mgmtFeePct = isOutletMitraScope ? (feeInfo?.pct ?? 0) : 0
        const isBep = Boolean(feeInfo?.isBep)
        const net = labaKotor - val.expense - val.waste - mgmtFee
        const margin = grossRev > 0 ? (net / grossRev) * 100 : 0
        const totalCost = val.deductions + val.hpp + val.waste + val.expense + mgmtFee
        return { 
          id, 
          name: val.name, 
          omzet: grossRev, 
          deductions: val.deductions, 
          netRev, 
          expense: val.expense, 
          hpp: val.hpp, 
          cogsChannels: (val as any).cogsChannels as { outlet: number; food_apps: number; tiktok_go: number; website: number } | undefined,
          waste: val.waste, 
          mgmtFee,
          mgmtFeePct,
          isBep,
          isMitra: isOutletMitraScope,
          labaKotor, 
          net, 
          margin,
          totalCost 
        }
      })
      .filter(item => item.omzet > 0 || item.expense > 0 || item.hpp > 0 || item.waste > 0)
      .sort((a, b) => {
        if (sortBy === 'margin') return b.margin - a.margin
        if (sortBy === 'omzet') return b.netRev - a.netRev
        return b.net - a.net
      })
  }, [salesRows, expenseRows, hppRows, wasteRows, outlets, sortBy, managementFeeData, mitraIds, scope])

  const filteredOutlets = useMemo(() => {
    if (!outletSearch.trim()) return outletBreakdown
    return outletBreakdown.filter(o => o.name.toLowerCase().includes(outletSearch.toLowerCase()))
  }, [outletBreakdown, outletSearch])

  const filteredTotals = useMemo(() => {
    return filteredOutlets.reduce((acc, row) => ({
      omzet: acc.omzet + row.omzet,
      deductions: acc.deductions + row.deductions,
      hpp: acc.hpp + row.hpp,
      waste: acc.waste + row.waste,
      expense: acc.expense + row.expense,
      mgmtFee: acc.mgmtFee + row.mgmtFee,
      net: acc.net + row.net,
    }), { omzet: 0, deductions: 0, hpp: 0, waste: 0, expense: 0, mgmtFee: 0, net: 0 })
  }, [filteredOutlets])

  const filteredAvgMargin = filteredTotals.omzet > 0 ? (filteredTotals.net / filteredTotals.omzet) * 100 : 0

  const profitableOutletsCount = outletBreakdown.filter(o => o.net > 0).length
  const lossOutletsCount = outletBreakdown.filter(o => o.net < 0).length

  // Health diagnosis
  const isHealthy = displayMargin >= 20
  const isModerate = displayMargin >= 5 && displayMargin < 20

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [activeBreakdownModal, setActiveBreakdownModal] = useState<'sales' | 'cogs' | 'opex' | 'net' | null>(null)

  // Biaya pusat hanya ikut pada tampilan gabungan seluruh outlet — sama persis
  // dengan syarat yang dipakai `displayLaba`, supaya rincian mendarat di angka
  // yang tertera di kartu.
  const includeCentral = isAllOutlets && scope !== 'mitra'
  // Rincian per kategori untuk baris "Beban Bulanan Outlet" di modal. Sumbernya
  // baris yang PERSIS sama dengan yang membentuk `pengeluaranOutletBulananMurni`,
  // supaya jumlah rinciannya tak mungkin meleset dari angka induknya.
  const opexMonthlyBreakdown = useMemo(() => {
    const perKategori = new Map<string, number>()
    expenseRows
      .filter(r => 
        r.scope === 'outlet' && 
        r.source === 'monthly' && 
        !isTestOutlet(r.outlet_id) && 
        !isTestOutlet(r.outlet_name) &&
        (r as any).category !== 'joint_expense' &&
        (r as any).category !== 'joint_expanse'
      )
      .forEach(r => {
        const key = (r as any).category || 'lainnya'
        perKategori.set(key, (perKategori.get(key) ?? 0) + r.amount)
      })
    return [...perKategori.entries()]
      .map(([kategori, jumlah]) => {
        const isCatProrated = isProrated && (PRORATED_CATEGORIES as readonly string[]).includes(kategori)
        const baseLabel = CATEGORY_META[kategori as keyof typeof CATEGORY_META]?.label ?? kategori
        const prorataSuffix = prorataMonthInfo.overlapDays === 1
          ? `Beban 1 Hari · 1/${prorataMonthInfo.totalDays} bln`
          : `Beban ${prorataMonthInfo.overlapDays} Hari · ${prorataMonthInfo.overlapDays}/${prorataMonthInfo.totalDays} bln`
        const label = isCatProrated
          ? `${baseLabel} (${prorataSuffix})`
          : baseLabel
        return {
          label,
          amount: -jumlah,
        }
      })
      .sort((a, b) => a.amount - b.amount)
  }, [expenseRows, isProrated, prorataMonthInfo])

  // Rincian Omzet Kotor per Channel Penjualan (POS, Food Apps, Online Marketplace)
  const grossRevenueBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    salesRows
      .filter(r => !isTestOutlet(r.outlet_id))
      .forEach(r => {
        const src = r.sales_source || 'pos'
        const gross = (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0)
        map.set(src, (map.get(src) ?? 0) + gross)
      })
    return [...map.entries()]
      .filter(([_, amount]) => amount > 0)
      .map(([src, amount]) => ({
        label: getSourceLabel(src),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [salesRows])

  // Rincian Potongan Merchant per Channel Penjualan
  const deductionsBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    salesRows
      .filter(r => !isTestOutlet(r.outlet_id))
      .forEach(r => {
        const src = r.sales_source || 'pos'
        const ded = (Number(r.total_deductions) || 0) + (Number(r.platform_fee) || 0)
        map.set(src, (map.get(src) ?? 0) + ded)
      })
    return [...map.entries()]
      .filter(([_, amount]) => amount > 0)
      .map(([src, amount]) => ({
        label: getSourceLabel(src),
        amount: -amount,
      }))
      .sort((a, b) => a.amount - b.amount)
  }, [salesRows])

  // Rincian Saluran Penjualan untuk Modal Omzet Penjualan
  const salesChannelBreakdown = useMemo(() => {
    const grossMap = new Map<string, number>()
    const dedMap = new Map<string, number>()
    const countMap = new Map<string, number>()

    salesRows
      .filter(r => !isTestOutlet(r.outlet_id))
      .forEach(r => {
        const src = r.sales_source || 'pos'
        const gross = (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0)
        const ded = (Number(r.total_deductions) || 0) + (Number(r.platform_fee) || 0)
        const count = Number(r.jumlah_order_completed) || 0
        grossMap.set(src, (grossMap.get(src) ?? 0) + gross)
        dedMap.set(src, (dedMap.get(src) ?? 0) + ded)
        countMap.set(src, (countMap.get(src) ?? 0) + count)
      })

    const allKeys = new Set([...grossMap.keys(), ...dedMap.keys()])
    return [...allKeys]
      .map(key => {
        const gross = grossMap.get(key) ?? 0
        const deductions = dedMap.get(key) ?? 0
        const net = gross - deductions
        const orderCount = countMap.get(key) ?? 0
        return {
          key,
          label: getSourceLabel(key),
          gross,
          deductions,
          net,
          orderCount,
        }
      })
      .filter(item => item.gross > 0 || item.deductions > 0)
      .sort((a, b) => b.gross - a.gross)
  }, [salesRows])

  // Rincian Outlet untuk Modal Omzet Penjualan
  const salesOutletList = useMemo(() => {
    return outletBreakdown.map(o => ({
      id: o.id,
      name: o.name,
      gross: o.omzet,
      deductions: o.deductions,
      net: o.netRev,
      isMitra: o.isMitra,
    }))
  }, [outletBreakdown])

  // Rincian Outlet untuk Modal Beban Pokok (HPP & Waste)
  const cogsOutletList = useMemo(() => {
    return outletBreakdown.map(o => ({
      id: o.id,
      name: o.name,
      hpp: o.hpp,
      waste: o.waste,
      totalCost: o.hpp + o.waste,
      gross: o.omzet,
      isMitra: o.isMitra,
    }))
  }, [outletBreakdown])

  // Rincian Kategori & Lokasi untuk Modal Biaya Operasional (OPEX)
  const opexCategoriesList = useMemo(() => {
    const list: Array<{ key: string; label: string; amount: number; isProrated?: boolean }> = []

    opexMonthlyBreakdown.forEach((item) => {
      list.push({
        key: item.label,
        label: item.label,
        amount: Math.abs(item.amount),
        isProrated: isProrated && item.label.includes('Beban'),
      })
    })

    if (totalJointExpense > 0) {
      list.push({
        key: 'joint_expense',
        label: 'Joint Expense',
        amount: totalJointExpense,
        isProrated: false,
      })
    }

    if (pengeluaranOutletPettyCash > 0) {
      list.push({
        key: 'petty_cash',
        label: 'Kas Kecil (Petty Cash Outlet)',
        amount: pengeluaranOutletPettyCash,
        isProrated: false,
      })
    }

    if (includeCentral && pengeluaranPusat > 0) {
      list.push({
        key: 'pusat',
        label: 'Biaya Operasional Kantor Pusat',
        amount: pengeluaranPusat,
        isProrated: false,
      })
    }

    return list.sort((a, b) => b.amount - a.amount)
  }, [opexMonthlyBreakdown, totalJointExpense, pengeluaranOutletPettyCash, includeCentral, pengeluaranPusat, isProrated])

  const opexOutletList = useMemo(() => {
    const list = outletBreakdown.map(o => ({
      id: o.id,
      name: o.name,
      expense: o.expense,
      gross: o.omzet,
      isMitra: o.isMitra,
    }))

    if (includeCentral && pengeluaranPusat > 0) {
      list.push({
        id: 'pusat',
        name: 'Kantor Pusat SS',
        expense: pengeluaranPusat,
        gross: 0,
        isMitra: false,
      })
    }

    return list.sort((a, b) => b.expense - a.expense)
  }, [outletBreakdown, includeCentral, pengeluaranPusat])

  const waterfallInput = useMemo(() => ({
    grossRevenue: actualGrossSales,
    deductions: totalDeductions,
    hpp: totalHpp,
    waste: totalWaste,
    opexMonthly: totalJointExpense > 0 ? pengeluaranOutletBulananMurni : pengeluaranOutletBulanan,
    jointExpense: totalJointExpense,
    opexPettyCash: pengeluaranOutletPettyCash,
    centralExpense: pengeluaranPusat,
    includeCentral,
    opexMonthlyBreakdown,
    managementFeeIncome: managementFeeReceived,
    mitraHppMarginIncome: mitraHppMarginReceived,
    managementFeeExpense: managementFeeExpense,
    grossRevenueBreakdown,
    deductionsBreakdown,
  }), [
    actualGrossSales, totalDeductions, totalHpp, totalWaste,
    totalJointExpense, pengeluaranOutletBulananMurni, pengeluaranOutletBulanan, pengeluaranOutletPettyCash, pengeluaranPusat, includeCentral,
    opexMonthlyBreakdown, managementFeeReceived, mitraHppMarginReceived, managementFeeExpense,
    grossRevenueBreakdown, deductionsBreakdown,
  ])

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <PageHeader
        title={scope === 'all' ? 'Laba Rugi Global' : `Laba Rugi ${SCOPE_LABEL[scope]}`}
        description={
          scope === 'mitra'
            ? 'Omzet, beban pokok, dan biaya operasional khusus outlet kemitraan (di luar biaya kantor pusat)'
            : scope === 'internal'
              ? 'Omzet, beban pokok, dan biaya operasional outlet milik pusat, termasuk biaya kantor pusat'
              : 'Seluruh outlet — pusat dan kemitraan — digabung, termasuk biaya kantor pusat. Sama dengan Laba Internal + Laba Mitra: fee manajemen & margin bahan antar-kantong dibukukan kedua sisinya, jadi tidak terhitung dua kali.'
        }
        icon={Calculator}
      >
        {/* Baris atas hanya berisi PENYARING — "apa yang sedang dilihat".
            Tombol perintah turun ke pita di bawah supaya keduanya tak
            berdesakan sebagai hal yang setara. */}
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} hideSource={true} hideOutlet={hideOutletPicker} />
      </PageHeader>

      {/* Status Sinkronisasi / Last Updated */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 -mt-5 mb-2 pt-3 border-t border-suka-brown/10 text-xs">
        <div className="flex items-center gap-2">
          {isPast ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[11px] shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Terakhir diperbarui: <strong>{formatLastUpdated(lastUpdated)}</strong> (Data Lampau Tersimpan)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-bold text-[11px] shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Realtime · Sinkronisasi POS: <strong>{formatLastUpdated(lastUpdated)}</strong></span>
            </span>
          )}
        </div>
        {/* Semua perintah berkumpul di sini: muat ulang & ekspor. Gayanya
            netral supaya filter aktif (oranye) tetap jadi yang paling menonjol. */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white hover:bg-suka-gray-50 border border-suka-gray-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Muat ulang data laba rugi dari database"
          >
            <RefreshCw className={`w-3 h-3 text-suka-orange ${loading || isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>

          <span className="w-px h-4 bg-suka-gray-200" aria-hidden="true" />

          <button
            onClick={() => setIsDownloadModalOpen(true)}
            title="Unduh laporan laba rugi (PDF / CSV / ZIP)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white hover:bg-suka-gray-50 border border-suka-gray-200 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-suka-orange" />
            <span>Download Data</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
          <span>Gagal memuat data keuangan: {error}</span>
        </div>
      )}

      {loading ? (
        <StatTilesSkeleton count={4} />
      ) : (
        <div className="space-y-8">
          
          {/* 1. TOP EXECUTIVE HERO METRICS (Balanced 4-Column Grid) */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Card 1: Omzet Penjualan (Kotor) */}
            <div 
              onClick={() => setActiveBreakdownModal('sales')}
              className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md hover:border-orange-300 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider group-hover:text-orange-600 transition-colors">Omzet Penjualan (Kotor)</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">
                    Pemasukan kotor dari pelanggan sebelum potongan
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-orange-50 text-orange-600 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold">Rp </span>
                  <CountUp end={actualGrossRevenue} duration={1} separator="." />
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    Net Masuk: {rupiah(actualGrossRevenue - totalDeductions)}
                  </span>
                  {managementFeeReceived > 0 && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200" title="Pendapatan Management Fee 3% dari kemitraan yang masuk ke kas pusat">
                      +Fee Mitra {rupiah(managementFeeReceived)}
                    </span>
                  )}
                  {mitraHppMarginReceived > 0 && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300" title="Pendapatan Margin Pasokan Bahan Baku 10% HPP Dasar Kemitraan">
                      +Margin Bahan Mitra {rupiah(mitraHppMarginReceived)}
                    </span>
                  )}
                  {scope === 'mitra' && managementFeeExpense > 0 && (
                    <span className="text-[10px] font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-300" title="Beban Management Fee 3% yang disetor ke pusat">
                      -Fee Pusat {rupiah(managementFeeExpense)}
                    </span>
                  )}
                </div>
                <div className="mt-2.5 pt-2 border-t border-suka-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-rose-600">
                    Admin Fee: -{rupiah(totalDeductions)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveBreakdownModal('sales')
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 underline decoration-dotted underline-offset-2 transition-colors active:scale-95 cursor-pointer ml-auto"
                  >
                    <Search className="w-3 h-3" /> Lihat rincian
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Beban Pokok (COGS + Waste) */}
            <div 
              onClick={() => setActiveBreakdownModal('cogs')}
              className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md hover:border-amber-300 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">Beban Pokok (HPP)</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Modal bahan resep & waste</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold text-amber-800">-Rp </span>
                  <CountUp end={totalHpp + totalWaste} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-suka-gray-500 font-semibold">
                  <span>HPP: {rupiah(totalHpp)}</span>
                  <span>Waste: {rupiah(totalWaste)}</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-suka-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-amber-800">
                    {actualGrossRevenue > 0 ? `${((totalHpp + totalWaste) / actualGrossRevenue * 100).toFixed(1)}% dari Omzet` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveBreakdownModal('cogs')
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 underline decoration-dotted underline-offset-2 transition-colors active:scale-95 cursor-pointer ml-auto"
                  >
                    <Search className="w-3 h-3" /> Lihat rincian
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Beban Operasional (OPEX) */}
            <div 
              onClick={() => setActiveBreakdownModal('opex')}
              className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md hover:border-rose-300 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider group-hover:text-rose-600 transition-colors">Biaya Operasional</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Gaji, sewa, listrik & kas</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold text-rose-700">-Rp </span>
                  <CountUp end={pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)} duration={1} separator="." />
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-suka-gray-500 font-semibold">
                  <span>{isAllOutlets ? `Outlet + Pusat` : `Beban Outlet`}</span>
                  {isProrated && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300/70 shadow-2xs"
                      title={`Beban tetap (Gaji, Sewa, Internet) dialokasikan proporsional: ${prorataMonthInfo.overlapDays} hari dari total ${prorataMonthInfo.totalDays} hari bulan ini`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      {prorataMonthInfo.overlapDays === 1
                        ? `Beban 1 Hari (${prorataMonthInfo.totalDays} hr)`
                        : `Beban ${prorataMonthInfo.overlapDays} Hari`}
                    </span>
                  )}
                </div>
                <div className="mt-2.5 pt-2 border-t border-suka-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-suka-gray-400">
                    Bulanan + Kas Kecil
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveBreakdownModal('opex')
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 underline decoration-dotted underline-offset-2 transition-colors active:scale-95 cursor-pointer ml-auto"
                  >
                    <Search className="w-3 h-3" /> Lihat rincian
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: Laba Bersih (Net Profit) - Hero Highlight */}
            <div 
              onClick={() => setActiveBreakdownModal('net')}
              className={`p-5 rounded-3xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
                displayLaba >= 0 
                  ? 'bg-gradient-to-br from-orange-50/80 via-white to-amber-50/50 border-suka-orange/30 hover:border-suka-orange/60' 
                  : 'bg-gradient-to-br from-rose-50/80 via-white to-red-50/50 border-rose-200 hover:border-rose-400'
              }`}
            >
              <div className={`absolute top-0 left-0 w-2 h-full rounded-l-3xl ${displayLaba >= 0 ? 'bg-suka-orange' : 'bg-rose-600'}`} />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-extrabold text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-suka-orange" /> Laba Bersih (Net)
                  </p>
                  <p className="text-[11px] text-suka-gray-500 font-medium mt-0.5">Hasil laba bersih akhir</p>
                </div>
                <div className={`p-2.5 rounded-2xl group-hover:scale-105 transition-transform ${displayLaba >= 0 ? 'bg-orange-100 text-suka-orange' : 'bg-rose-100 text-rose-600'}`}>
                  <Banknote className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${displayLaba >= 0 ? 'text-suka-brown' : 'text-rose-600'}`}>
                  <span className="text-base font-semibold">{displayLaba < 0 ? '-Rp ' : 'Rp '}</span>
                  <CountUp end={Math.abs(displayLaba)} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    displayLaba >= 0
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}>
                    Margin: {displayMargin.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-suka-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-suka-gray-400">
                    Alur Waterfall
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveBreakdownModal('net')
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-suka-brown/70 hover:text-suka-brown underline decoration-dotted underline-offset-2 transition-colors active:scale-95 cursor-pointer ml-auto"
                  >
                    <Search className="w-3 h-3" /> Lihat rincian
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 1. Modal Rincian Omzet Penjualan (Card 1) */}
          <GrossSalesBreakdownModal
            isOpen={activeBreakdownModal === 'sales'}
            onClose={() => setActiveBreakdownModal(null)}
            periodLabel={`${filter.from} s/d ${filter.to}`}
            scopeLabel={isAllOutlets ? SCOPE_LABEL[scope] : (outlets.find(o => o.id === filter.outletId)?.name ?? SCOPE_LABEL[scope])}
            grossRevenue={actualGrossRevenue}
            totalDeductions={totalDeductions}
            netRevenue={actualGrossRevenue - totalDeductions}
            managementFeeReceived={managementFeeReceived}
            mitraHppMarginReceived={mitraHppMarginReceived}
            channels={salesChannelBreakdown}
            outlets={salesOutletList}
          />

          {/* 2. Modal Rincian Beban Pokok (HPP & Waste) (Card 2) */}
          <CogsWasteBreakdownModal
            isOpen={activeBreakdownModal === 'cogs'}
            onClose={() => setActiveBreakdownModal(null)}
            periodLabel={`${filter.from} s/d ${filter.to}`}
            scopeLabel={isAllOutlets ? SCOPE_LABEL[scope] : (outlets.find(o => o.id === filter.outletId)?.name ?? SCOPE_LABEL[scope])}
            totalCogs={totalHpp + totalWaste}
            totalHpp={totalHpp}
            totalWaste={totalWaste}
            grossRevenue={actualGrossRevenue}
            outlets={cogsOutletList}
            wasteDetailHref="/dashboard/owner/waste"
          />

          {/* 3. Modal Rincian Biaya Operasional (OPEX) (Card 3) */}
          <OpexBreakdownModal
            isOpen={activeBreakdownModal === 'opex'}
            onClose={() => setActiveBreakdownModal(null)}
            periodLabel={`${filter.from} s/d ${filter.to}`}
            scopeLabel={isAllOutlets ? SCOPE_LABEL[scope] : (outlets.find(o => o.id === filter.outletId)?.name ?? SCOPE_LABEL[scope])}
            totalOpex={pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)}
            opexMonthly={pengeluaranOutletBulanan}
            opexPettyCash={pengeluaranOutletPettyCash}
            centralExpense={pengeluaranPusat}
            isAllOutlets={isAllOutlets}
            isProrated={isProrated}
            prorataInfo={prorataMonthInfo}
            categories={opexCategoriesList}
            outlets={opexOutletList}
            detailHref={{
              monthly: bukuKasHref(filter),
              pettyCash: pettyCashHref(filter),
            }}
          />

          {/* 4. Modal Rincian Laba Bersih (Net Profit) (Card 4) */}
          <NetProfitBreakdownModal
            isOpen={activeBreakdownModal === 'net' || breakdownOpen}
            onClose={() => {
              setActiveBreakdownModal(null)
              setBreakdownOpen(false)
            }}
            periodLabel={`${filter.from} s/d ${filter.to}`}
            scopeLabel={isAllOutlets ? SCOPE_LABEL[scope] : (outlets.find(o => o.id === filter.outletId)?.name ?? SCOPE_LABEL[scope])}
            input={waterfallInput}
            detailHref={{ opex_petty_cash: pettyCashHref(filter) }}
          />

          {/* 5. Modal Tarik & Unduh Laporan Laba Rugi */}
          <DownloadProfitDataModal
            isOpen={isDownloadModalOpen}
            onClose={() => setIsDownloadModalOpen(false)}
            currentFilter={filter}
            outlets={allOutlets}
            scope={scope}
            mitraInvestments={mitraInvestments}
            currentData={{
              outletBreakdown,
              salesRows,
              expenseRows,
              tiktokSettlements,
              summaryData: {
                actualGrossSales,
                totalDeductions,
                netRevenue,
                totalHpp,
                labaKotor,
                marginKotor,
                pengeluaranOutlet,
                totalWaste,
                pengeluaranPusat,
                managementFeeReceived,
                mitraHppMarginReceived,
                managementFeeExpense,
                displayLaba,
                displayMargin,
                adaAntarKantong,
                includeCentral,
                totalJointExpense,
              },
            }}
          />

          {/* 2. CORE DUAL SECTION: P&L Statement (2/3) + Financial Health & Cost Structure (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* LEFT 2 COLS: STRUCTURED P&L STATEMENT */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-6 sm:p-7 space-y-6">
                
                <div className="flex items-center justify-between border-b border-suka-gray-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-suka-brown tracking-tight flex items-center gap-2">
                      <Layers className="w-5 h-5 text-suka-orange" /> Laporan Laba Rugi Komprehensif
                    </h2>
                    <p className="text-xs text-suka-gray-500 font-medium mt-0.5">Alur perhitungan pendapatan bersih, biaya pokok, dan laba operasional</p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-suka-cream rounded-xl text-suka-brown border border-suka-brown/10">
                    P&L Formal
                  </span>
                </div>

                {/* BLOCK 1: PENDAPATAN (REVENUE) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-suka-gray-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 1. Aliran Pendapatan (Revenue)
                  </div>
                  <div className="bg-suka-gray-50/70 rounded-2xl p-4 space-y-2.5 text-sm border border-suka-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-suka-gray-600">Omzet Kotor Penjualan (Gross Sales)</span>
                      <span className="font-bold text-suka-brown">{rupiah(actualGrossSales)}</span>
                    </div>
                    {/* Selalu tampil, termasuk saat Rp 0 -- baris yang
                        muncul-hilang bikin pembaca mengira datanya tidak ada. */}
                    <div className="flex justify-between items-center text-xs text-rose-600 pl-4 border-l-2 border-rose-300">
                      <div>
                        <span className="font-semibold block">Admin Fee (Promo & Biaya Platform)</span>
                        {totalPlatformFee > 0 && (
                          <span className="text-[10px] text-rose-500/80">
                            Promo: {rupiah(totalPotongan)} · Komisi: {rupiah(totalPlatformFee)}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold">-{rupiah(totalDeductions)}</span>
                    </div>
                    {adaAntarKantong && (
                      <div className="pt-2 mt-1 border-t border-dashed border-suka-gray-300">
                        <p className="text-[11px] font-bold text-suka-brown/80 uppercase tracking-wide">
                          Transaksi Antar-Kantong (Pusat &harr; Mitra)
                        </p>
                        <p className="text-[10px] text-suka-gray-500 leading-snug mt-0.5">
                          {duaSisiDiLayarSama
                            ? 'Kedua sisinya ada di layar ini, jadi saling menghapus — tidak menambah maupun mengurangi laba gabungan. Bukan penjualan ke pelanggan, karena itu tidak ikut ke Omzet Kotor.'
                            : scope === 'mitra'
                              ? 'Sisi beban. Pasangan pendapatannya ada di tab Internal.'
                              : 'Sisi pendapatan. Pasangan bebannya ada di tab Mitra. Bukan penjualan ke pelanggan, karena itu tidak ikut ke Omzet Kotor.'}
                        </p>
                      </div>
                    )}
                    {managementFeeReceived > 0 && (
                      <div className="flex justify-between items-center text-xs text-blue-700 pl-4 border-l-2 border-blue-400 bg-blue-50/50 py-1 pr-2 rounded-r-lg">
                        <div>
                          <span className="font-semibold block">Pendapatan Management Fee Mitra (3% Gross Mitra)</span>
                          <span className="text-[10px] text-blue-600 block font-normal">
                            {isAllOutlets 
                              ? `3% dari omzet kotor outlet mitra belum BEP (${rupiah(managementFeeData.grossMitraBelumBep)}) · Outlet BEP bebas fee`
                              : `3% dari omzet kotor outlet kemitraan`}
                          </span>
                        </div>
                        <span className="font-bold text-sm shrink-0">+{rupiah(managementFeeReceived)}</span>
                      </div>
                    )}
                    {mitraHppMarginReceived > 0 && (
                      <div className="flex justify-between items-center text-xs text-amber-800 pl-4 border-l-2 border-amber-500 bg-amber-50/60 py-1 pr-2 rounded-r-lg">
                        <div>
                          <span className="font-semibold block">Pendapatan Margin Pasokan Bahan Baku Mitra (10% HPP Dasar)</span>
                          <span className="text-[10px] text-amber-700 block font-normal">
                            10% dari HPP dasar bahan baku mitra ({rupiah(totalMitraBaseHpp)}) · ditagihkan ke mitra {rupiah(totalMitraHpp)}
                          </span>
                        </div>
                        <span className="font-bold text-sm shrink-0">+{rupiah(mitraHppMarginReceived)}</span>
                      </div>
                    )}
                    {managementFeeExpense > 0 ? (
                      <div className="flex justify-between items-center text-xs text-rose-600 pl-4 border-l-2 border-rose-300 bg-rose-50/40 py-1.5 pr-2 rounded-r-lg">
                        <div>
                          <span className="font-semibold block">Management Fee ke Kantor Pusat (3% Gross Mitra Belum BEP)</span>
                          <span className="text-[10px] text-rose-500 block font-normal">
                            {isAllOutlets 
                              ? `Dipotong 3% hanya dari ${managementFeeData.jumlahOutletBelumBep} outlet belum BEP (${rupiah(managementFeeData.grossMitraBelumBep)}) · Outlet sudah BEP bebas fee`
                              : `Dipotong 3% dari omzet kotor outlet`}
                          </span>
                        </div>
                        <span className="font-bold text-sm shrink-0">-{rupiah(managementFeeExpense)}</span>
                      </div>
                    ) : scope === 'mitra' && !isAllOutlets ? (
                      <div className="flex justify-between items-center text-xs text-emerald-700 pl-4 border-l-2 border-emerald-400 bg-emerald-50/50 py-1.5 pr-2 rounded-r-lg">
                        <div>
                          <span className="font-semibold block">Management Fee ke Kantor Pusat (0% · Bebas Fee)</span>
                          <span className="text-[10px] text-emerald-600 block font-normal">
                            Outlet ini telah mencapai status Balik Modal (BEP). Bebas potongan management fee.
                          </span>
                        </div>
                        <span className="font-bold text-xs shrink-0 text-emerald-700">Rp 0</span>
                      </div>
                    ) : null}
                    <div className="pt-2 border-t border-suka-gray-200 flex justify-between items-center font-bold">
                      <span className="text-suka-brown">Pendapatan Bersih (Net Revenue)</span>
                      <span className="text-emerald-700 font-black text-base">{rupiah(netRevenue)}</span>
                    </div>
                  </div>
                </div>

                {/* BLOCK 2: BIAYA POKOK & MARGIN KOTOR (COGS & GROSS PROFIT) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-suka-gray-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> 2. Beban Pokok Penjualan (COGS)
                  </div>
                  <div className="bg-suka-gray-50/70 rounded-2xl p-4 space-y-2.5 text-sm border border-suka-gray-100">
                    <div className="flex justify-between items-center text-rose-600">
                      <span className="font-medium">Total Modal Bahan Dasar (HPP Resep)</span>
                      <span className="font-bold">-{rupiah(totalHpp)}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-600">
                      <span className="font-medium">Kerugian Bahan Rusak / Basi (Waste)</span>
                      <span className="font-bold">-{rupiah(totalWaste)}</span>
                    </div>
                    <div className="pt-2 border-t border-suka-gray-200 flex justify-between items-center font-bold">
                      <div className="flex items-center gap-2">
                        <span className="text-suka-brown">Laba Kotor (Gross Profit)</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Margin: {marginKotor.toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-suka-brown font-black text-base">{rupiah(labaKotor)}</span>
                    </div>
                  </div>
                </div>

                {/* BLOCK 3: BEBAN OPERASIONAL (OPEX) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-suka-gray-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> 3. Beban Operasional (OPEX)
                  </div>
                  <div className="bg-suka-gray-50/70 rounded-2xl p-4 space-y-2.5 text-sm border border-suka-gray-100">
                    <div className="flex justify-between items-center text-rose-600">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">Beban Tetap & Bulanan Outlet (Gaji, Listrik, Sewa)</span>
                        {isProrated && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            {prorataMonthInfo.overlapDays === 1
                              ? `Beban 1 Hari (1/${prorataMonthInfo.totalDays} bln)`
                              : `Beban ${prorataMonthInfo.overlapDays} Hari (${prorataMonthInfo.overlapDays}/${prorataMonthInfo.totalDays} bln)`}
                          </span>
                        )}
                      </div>
                      <span className="font-bold">-{rupiah(totalJointExpense > 0 ? pengeluaranOutletBulananMurni : pengeluaranOutletBulanan)}</span>
                    </div>
                    {totalJointExpense > 0 && (
                      <div className="flex justify-between items-center text-rose-600">
                        <span className="font-medium">Joint Expense</span>
                        <span className="font-bold">-{rupiah(totalJointExpense)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-rose-600">
                      <span className="font-medium">Biaya Kas Kecil Operasional (Petty Cash)</span>
                      <span className="font-bold">-{rupiah(pengeluaranOutletPettyCash)}</span>
                    </div>
                    {isAllOutlets && pengeluaranPusat > 0 && (
                      <div className="flex justify-between items-center text-rose-600">
                        <span className="font-medium">Beban Operasional Kantor Pusat (Manajemen)</span>
                        <span className="font-bold">-{rupiah(pengeluaranPusat)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* FINAL TOTAL ROW */}
                <div className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                  displayLaba >= 0 
                    ? 'bg-suka-cream/50 border-suka-orange/30 text-suka-brown' 
                    : 'bg-rose-50/60 border-rose-200 text-rose-900'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black uppercase tracking-wide">LABA BERSIH AKHIR (NET PROFIT)</span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        displayLaba >= 0 ? 'bg-suka-orange text-white' : 'bg-rose-600 text-white'
                      }`}>
                        {displayMargin.toFixed(1)}% Margin
                      </span>
                    </div>
                    <p className="text-xs text-suka-gray-500 mt-1">Keuntungan bersih riil setelah dikurangi seluruh beban dan biaya</p>
                    {duaSisiDiLayarSama && (
                      <p className="text-[11px] text-suka-brown/70 mt-1.5 leading-snug max-w-xl">
                        <span className="font-bold">Laba Rugi Global = Laba Internal + Laba Mitra.</span>{' '}
                        Management fee {rupiah(managementFeeExpense)} sudah dibukukan{' '}
                        <span className="font-semibold">kedua sisinya</span> di sini — pendapatan pusat dan
                        bebannya di mitra — jadi tak ada laba yang terhitung dua kali. Angka ini memang lebih
                        kecil dari sekadar menjumlahkan omzet semua outlet, dan itu yang benar.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl sm:text-3xl font-black tracking-tight ${displayLaba >= 0 ? 'text-suka-brown' : 'text-rose-600'}`}>
                      {displayLaba < 0 ? '-' : ''}{rupiah(Math.abs(displayLaba))}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT 1 COL: COST ANATOMY & FINANCIAL HEALTH */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Cost Anatomy Breakdown Card */}
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-suka-orange" />
                  <h3 className="font-black text-suka-brown text-sm uppercase tracking-wider">Struktur Biaya vs Omzet</h3>
                </div>

                {/* Mini Multi-Bar */}
                <div className="space-y-2">
                  <div className="h-4 w-full bg-suka-gray-100 rounded-full overflow-hidden flex shadow-inner">
                    <div style={{ width: `${barHpp}%` }} className="bg-amber-500 h-full transition-all duration-300" title={`HPP: ${pctHpp.toFixed(1)}%`} />
                    <div style={{ width: `${barOpex}%` }} className="bg-rose-500 h-full transition-all duration-300" title={`Opex: ${pctOpex.toFixed(1)}%`} />
                    <div style={{ width: `${barFee}%` }} className="bg-purple-500 h-full transition-all duration-300" title={`Potongan/Fee: ${pctFee.toFixed(1)}%`} />
                    <div style={{ width: `${barWaste}%` }} className="bg-red-700 h-full transition-all duration-300" title={`Waste: ${pctWaste.toFixed(1)}%`} />
                  </div>
                  <div className="flex justify-between text-[10px] text-suka-gray-400 font-semibold uppercase">
                    <span>Total Beban: {pctTotalBiaya.toFixed(1)}%</span>
                    <span>Sisa Margin: {pctSisaMargin.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Progress items */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> HPP (Bahan Baku)
                    </span>
                    <span className="font-bold text-suka-brown">{pctHpp.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Biaya Operasional (Opex)
                    </span>
                    <span className="font-bold text-suka-brown">{pctOpex.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span> Admin Fee
                    </span>
                    <span className="font-bold text-suka-brown">{pctFee.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-700"></span> Waste (Bahan Basi)
                    </span>
                    <span className="font-bold text-suka-brown">{pctWaste.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Diagnosis Box */}
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
                  isHealthy 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                    : isModerate
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isHealthy ? 'Margin Sehat' : isModerate ? 'Perhatian: Margin Sedang' : 'Peringatan: Margin Kritis / Rugi'}</span>
                  </div>
                  <p className="opacity-90">
                    {isHealthy 
                      ? 'Efisiensi biaya dan HPP terkendali dengan baik, menghasilkan margin laba bersih di atas target standar 20%.' 
                      : isModerate 
                      ? 'Margin bersih berada di rentang 5-20%. Evaluasi efisiensi operasional dan pengeluaran kas kecil.' 
                      : 'Bisnis mengalami defisit atau margin di bawah 5%. Segera audit HPP resep dan kurangi biaya opex outlet.'}
                  </p>
                </div>

              </div>

            </div>

          </div>

          {/* 3. OUTLET PERFORMANCE LEADERBOARD (Full Width Table with Filtering & Sorting) */}
          {isAllOutlets && (
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden space-y-4 p-6">
              
              {/* Header Table with Search and Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-suka-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-suka-brown tracking-tight flex items-center gap-2">
                    <Store className="w-5 h-5 text-suka-orange" /> Kinerja Profitabilitas per Outlet
                  </h3>
                  <p className="text-xs text-suka-gray-400 font-medium mt-0.5">
                    Menampilkan {filteredOutlets.length} outlet ({profitableOutletsCount} untung, {lossOutletsCount} rugi)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* Search box */}
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-4 h-4 text-suka-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Cari nama outlet..." 
                      value={outletSearch}
                      onChange={(e) => setOutletSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-suka-gray-50 border border-suka-gray-200 rounded-xl text-xs font-medium text-suka-brown placeholder-suka-gray-400 focus:outline-none focus:ring-2 focus:ring-suka-orange/30"
                    />
                  </div>

                  {/* Sort selector */}
                  <div className="flex items-center gap-1.5 bg-suka-gray-50 p-1 border border-suka-gray-200 rounded-xl text-xs font-semibold">
                    <button 
                      onClick={() => setSortBy('net')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'net' ? 'bg-white text-suka-brown shadow-sm font-bold' : 'text-suka-gray-500 hover:text-suka-brown'}`}
                    >
                      Laba Bersih
                    </button>
                    <button 
                      onClick={() => setSortBy('margin')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'margin' ? 'bg-white text-suka-brown shadow-sm font-bold' : 'text-suka-gray-500 hover:text-suka-brown'}`}
                    >
                      Margin %
                    </button>
                    <button 
                      onClick={() => setSortBy('omzet')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'omzet' ? 'bg-white text-suka-brown shadow-sm font-bold' : 'text-suka-gray-500 hover:text-suka-brown'}`}
                    >
                      Omzet
                    </button>
                  </div>
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-suka-cream/20 text-left text-suka-gray-500 font-bold text-xs uppercase border-b border-suka-brown/5">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">Nama Outlet</th>
                      <th className="py-3.5 px-4 text-right">Gross Omzet</th>
                      <th className="py-3.5 px-4 text-right">Admin Fee</th>
                      <th className="py-3.5 px-4 text-right">HPP</th>
                      <th className="py-3.5 px-4 text-right">Waste</th>
                      <th className="py-3.5 px-4 text-right">OPEX</th>
                      <th className="py-3.5 px-4 text-right">Fee Mgmt</th>
                      <th className="py-3.5 px-4 text-right">Laba Bersih</th>
                      <th className="py-3.5 px-4 text-center">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium text-suka-ink">
                    {filteredOutlets.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-suka-gray-400">
                          Tidak ditemukan outlet yang cocok dengan pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredOutlets.map((row, index) => {
                        const isProfit = row.net >= 0
                        const marginBadge = row.margin >= 20 
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-200' 
                          : row.margin >= 5 
                          ? 'text-amber-800 bg-amber-50 border-amber-200' 
                          : 'text-rose-800 bg-rose-50 border-rose-200'

                        return (
                          <tr 
                            key={row.id} 
                            className="hover:bg-orange-50/30 transition-colors group whitespace-nowrap"
                          >
                            <td className="py-3.5 px-4 text-center text-suka-gray-400 font-bold text-xs">
                              {index + 1}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-suka-ink">
                              <div className="flex items-center gap-1.5">
                                <span>{row.name.replace('SUKA SHAWARMA ', '')}</span>
                                {row.isMitra && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-blue-50 text-blue-600 border border-blue-200">
                                    Mitra
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right text-suka-brown font-bold">
                              {rupiah(row.omzet)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-rose-500">
                              -{rupiah(row.deductions)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-rose-500">
                              -{rupiah(row.hpp)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-rose-500">
                              -{rupiah(row.waste)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-rose-500">
                              -{rupiah(row.expense)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {row.isMitra ? (
                                row.isBep ? (
                                  <span className="text-[11px] font-semibold text-emerald-600" title="Sudah Balik Modal (BEP) - Bebas Fee 0%">
                                    0% (BEP)
                                  </span>
                                ) : row.mgmtFee > 0 ? (
                                  <span className="text-xs font-semibold text-rose-500" title={`Management Fee ${row.mgmtFeePct}% dari Gross Sales`}>
                                    -{rupiah(row.mgmtFee)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-suka-gray-400" title={row.mgmtFeePct > 0 ? `Belum BEP - Fee ${row.mgmtFeePct}%` : 'Skema Historis (Sebelum Sept 2026)'}>
                                    {row.mgmtFeePct > 0 ? `${row.mgmtFeePct}%` : '-'}
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-suka-gray-300">-</span>
                              )}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-black ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {rupiah(row.net)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-lg border ${marginBadge}`}>
                                {row.margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {filteredOutlets.length > 0 && (
                    <tfoot className="bg-suka-cream/30 font-bold border-t-2 border-suka-brown/20 text-xs text-suka-brown">
                      <tr className="whitespace-nowrap">
                        <td colSpan={2} className="py-3.5 px-4 text-left font-black uppercase tracking-wider text-suka-ink">
                          TOTAL ({filteredOutlets.length} OUTLET)
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-suka-brown">
                          {rupiah(filteredTotals.omzet)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-600 font-bold">
                          {filteredTotals.deductions > 0 ? `-${rupiah(filteredTotals.deductions)}` : rupiah(0)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-600 font-bold">
                          {filteredTotals.hpp > 0 ? `-${rupiah(filteredTotals.hpp)}` : rupiah(0)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-600 font-bold">
                          {filteredTotals.waste > 0 ? `-${rupiah(filteredTotals.waste)}` : rupiah(0)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-600 font-bold">
                          {filteredTotals.expense > 0 ? `-${rupiah(filteredTotals.expense)}` : rupiah(0)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-600 font-bold">
                          {filteredTotals.mgmtFee > 0 ? `-${rupiah(filteredTotals.mgmtFee)}` : '-'}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-black ${filteredTotals.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {rupiah(filteredTotals.net)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-lg border ${
                            filteredAvgMargin >= 20 
                              ? 'text-emerald-800 bg-emerald-50 border-emerald-200' 
                              : filteredAvgMargin >= 5 
                              ? 'text-amber-800 bg-amber-50 border-amber-200' 
                              : 'text-rose-800 bg-rose-50 border-rose-200'
                          }`}>
                            {filteredAvgMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  )
}







