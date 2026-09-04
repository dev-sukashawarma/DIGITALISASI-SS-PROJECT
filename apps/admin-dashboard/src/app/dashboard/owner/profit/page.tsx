'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesDaily } from '@/hooks/useSalesDaily'
import { useExpenses } from '@/hooks/useExpenses'
import { useHpp } from '@/hooks/useHpp'
import { useWaste } from '@/hooks/useWaste'
import { computeProfit, computeCompanyProfit } from '@/lib/profit'
import { PeriodFilter } from '@/components/PeriodFilter'
import { rupiah } from '@/lib/format'
import { PageHeader, StatTilesSkeleton } from '@/components/ui'
import { toast } from 'sonner'
import { LOGO_BASE64 } from '@/utils/logoBase64'
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
  FileText,
  Clock,
  RefreshCw
} from 'lucide-react'
import { motion } from 'framer-motion'
import { isTestOutlet } from '@/lib/outletFilters'

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

// Helper for channel classification
function getChannelGroup(source: string): 'outlet' | 'food_apps' | 'tiktok_go' | 'website' {
  const s = (source || '').toLowerCase().trim()
  if (['grabfood', 'gofood', 'shopeefood', 'food_apps', 'foodapps', 'grab_food', 'go_food', 'shopee_food', 'shopee food', 'grab food', 'go food'].includes(s)) {
    return 'food_apps'
  }
  if (['tiktok', 'tiktok_shop', 'tiktok_go', 'tiktok go', 'tiktok shop'].includes(s)) {
    return 'tiktok_go'
  }
  if (['website', 'online', 'web', 'website ss', 'ss-online', 'ss_online'].includes(s)) {
    return 'website'
  }
  return 'outlet' // Default POS / Offline
}

export default function ProfitPage() {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const debounceRef = useRef<any>(null)

  const { data: rawOutlets = [] } = useOutlets()
  const outlets = useMemo(() => [
    { id: 'ss-online', name: 'SS ONLINE', type: 'online' } as any,
    ...rawOutlets.filter(o => !isTestOutlet(o))
  ], [rawOutlets])

  const { filter, setFilter, lockedOutletId } = useScopedFilter()
  const [outletSearch, setOutletSearch] = useState('')
  const [sortBy, setSortBy] = useState<'net' | 'margin' | 'omzet'>('net')
  const [mitraInvestments, setMitraInvestments] = useState<Record<string, any>>({})
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toISOString())
  const todayJakarta = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()), [])
  const isPast = filter.to < todayJakarta

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['sales-daily'] })
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['hpp-client-calculated'] })
    queryClient.invalidateQueries({ queryKey: ['waste'] })
    setLastUpdated(new Date().toISOString())
    toast.success('Memperbarui data laba rugi dari database...')
  }

  useEffect(() => {
    async function loadInvestments() {
      const { data } = await supabase.from('mitra_investments').select('*')
      if (data) {
        const map: Record<string, any> = {}
        data.forEach(inv => {
          map[inv.outlet_id] = inv
        })
        setMitraInvestments(map)
      }
    }
    loadInvestments()
  }, [supabase])

  useEffect(() => {
    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sales-daily'] })
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
        queryClient.invalidateQueries({ queryKey: ['hpp-client-calculated'] })
        queryClient.invalidateQueries({ queryKey: ['waste'] })
      }, 600)
    }

    const channel = supabase
      .channel('profit-realtime-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_expenses' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waste_records' }, invalidate)
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  const effectiveFilter = useMemo(() => ({ ...filter, source: 'all' as const }), [filter])
  
  const sales = useSalesDaily(effectiveFilter, outlets)
  const expenses = useExpenses(effectiveFilter)
  const hpp = useHpp(effectiveFilter)
  const waste = useWaste(effectiveFilter)

  const loading = sales.loading || expenses.loading || hpp.loading || waste.loading
  const error = sales.error || expenses.error || hpp.error || waste.error

  const isAllOutlets = filter.outletId === 'all'

  // Calculations (Filter out any test outlet)
  const actualGrossRevenue = useMemo(
    () => sales.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0), 0), 
    [sales.rows]
  )

  const totalPotongan = useMemo(
    () => sales.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0), 
    [sales.rows]
  )
  const totalPlatformFee = useMemo(
    () => sales.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + (Number(r.platform_fee) || 0), 0), 
    [sales.rows]
  )
  const totalDeductions = totalPotongan + totalPlatformFee

  const pengeluaranOutletBulanan = useMemo(
    () => expenses.rows.filter(r => r.scope === 'outlet' && r.source === 'monthly' && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name)).reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows]
  )
  const pengeluaranOutletPettyCash = useMemo(
    () => expenses.rows.filter(r => r.scope === 'outlet' && r.source === 'petty_cash' && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name)).reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows]
  )
  const pengeluaranOutlet = pengeluaranOutletBulanan + pengeluaranOutletPettyCash
  const pengeluaranPusat = useMemo(
    () => expenses.rows.filter(r => r.scope === 'pusat').reduce((sum, r) => sum + r.amount, 0),
    [expenses.rows]
  )
    
  const totalHpp = useMemo(
    () => hpp.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + r.hpp, 0), 
    [hpp.rows]
  )
  const totalWaste = useMemo(
    () => waste.rows.filter(r => !isTestOutlet(r.outlet_id)).reduce((sum, r) => sum + r.nilai_waste, 0), 
    [waste.rows]
  )
  
  const { netRevenue, labaKotor, labaBersih, marginKotor } = computeProfit(actualGrossRevenue, totalDeductions, totalHpp, pengeluaranOutlet, totalWaste)
  
  const labaPerusahaan = computeCompanyProfit(labaBersih, pengeluaranPusat).labaPerusahaan
  const displayLaba = isAllOutlets ? labaPerusahaan : labaBersih
  const displayMargin = netRevenue > 0 ? (displayLaba / netRevenue) * 100 : 0

  const totalBiaya = totalDeductions + totalHpp + totalWaste + pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)

  // Cost proportions
  const pctHpp = netRevenue > 0 ? Math.min(100, Math.round((totalHpp / netRevenue) * 100)) : 0
  const pctOpex = netRevenue > 0 ? Math.min(100, Math.round(((pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)) / netRevenue) * 100)) : 0
  const pctWaste = netRevenue > 0 ? Math.min(100, Math.round((totalWaste / netRevenue) * 100)) : 0
  const pctFee = netRevenue > 0 ? Math.min(100, Math.round((totalDeductions / netRevenue) * 100)) : 0

  // Outlets breakdown
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; deductions: number; expense: number; hpp: number; waste: number }>()

    outlets.filter(o => !isTestOutlet(o)).forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 })
    })

    sales.rows.filter(s => !isTestOutlet(s.outlet_id)).forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name || (s.outlet_id === 'ss-online' ? 'SS ONLINE' : 'Outlet Tidak Dikenal'), omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      const deductions = (Number(s.total_deductions) || 0) + (Number(s.platform_fee) || 0)
      const gross = (Number(s.omzet) || 0) + (Number(s.total_deductions) || 0)
      cur.omzet += gross
      cur.deductions += deductions
      map.set(s.outlet_id, cur)
    })

    expenses.rows.filter(e => !isTestOutlet(e.outlet_id) && !isTestOutlet(e.outlet_name)).forEach(e => {
      if (e.scope !== 'outlet' || !e.outlet_id) return
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    hpp.rows.filter(h => !isTestOutlet(h.outlet_id)).forEach(h => {
      const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.hpp += h.hpp
      map.set(h.outlet_id, cur)
    })

    waste.rows.filter(w => !isTestOutlet(w.outlet_id)).forEach(w => {
      const cur = map.get(w.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, deductions: 0, expense: 0, hpp: 0, waste: 0 }
      cur.waste += w.nilai_waste
      map.set(w.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        const grossRev = val.omzet
        const netRev = val.omzet - val.deductions
        const labaKotor = grossRev - val.hpp - val.deductions
        const net = labaKotor - val.expense - val.waste
        const margin = grossRev > 0 ? (net / grossRev) * 100 : 0
        const totalCost = val.deductions + val.hpp + val.waste + val.expense
        return { 
          id, 
          name: val.name, 
          omzet: grossRev, 
          deductions: val.deductions, 
          netRev, 
          expense: val.expense, 
          hpp: val.hpp, 
          waste: val.waste, 
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
  }, [sales.rows, expenses.rows, hpp.rows, waste.rows, outlets, sortBy])

  const filteredOutlets = useMemo(() => {
    if (!outletSearch.trim()) return outletBreakdown
    return outletBreakdown.filter(o => o.name.toLowerCase().includes(outletSearch.toLowerCase()))
  }, [outletBreakdown, outletSearch])

  const profitableOutletsCount = outletBreakdown.filter(o => o.net > 0).length
  const lossOutletsCount = outletBreakdown.filter(o => o.net < 0).length

  // Health diagnosis
  const isHealthy = displayMargin >= 20
  const isModerate = displayMargin >= 5 && displayMargin < 20

  const [isExporting, setIsExporting] = useState(false)

  const handleExportCSV = () => {
    setIsExporting(true)
    const tId = toast.loading('Menyiapkan file CSV resmi...')
    try {
      const headers = ['Outlet', 'Kategori Outlet', 'Bagian / Pos Keuangan', 'Keterangan', 'Nilai (Rp)']
      const rows: (string | number)[][] = []

      outletBreakdown.forEach(item => {
        const outletName = item.name.replace(/^SUKA SHAWARMA\s*/i, '').trim()
        const outletSales = sales.rows.filter(r => r.outlet_id === item.id)
        
        // Check mitra investment profile
        const inv = mitraInvestments[item.id]
        const isMitra = Boolean(inv || item.name.toLowerCase().includes('mitra'))
        const modalInvestasi = Number(inv?.nilai_investasi) || (isMitra ? 125000000 : 0)
        const omzetHistoris = Number(inv?.omzet_historis) || 0
        const transferHistoris = Number(inv?.transfer_historis) || 0
        const profitMitraSebelumnya = omzetHistoris + transferHistoris
        const bagiHasilPct = inv?.persentase_bagi_hasil !== undefined ? Number(inv.persentase_bagi_hasil) : (isMitra ? 50 : 0)
        const mgmtFeePct = Number(inv?.management_fee) || 0
        const categoryLabel = isMitra ? `Mitra (Bagi Hasil ${bagiHasilPct}% | Mgmt Fee ${mgmtFeePct}%)` : 'Outlet Pusat'

        // 1. Group sales by channel
        const channels = {
          outlet: { revenue: 0, adminFee: 0 },
          food_apps: { revenue: 0, adminFee: 0 },
          tiktok_go: { revenue: 0, adminFee: 0 },
          website: { revenue: 0, adminFee: 0 }
        }

        outletSales.forEach(r => {
          const grp = getChannelGroup(r.sales_source || '')
          const gross = (r.omzet || 0) + (r.total_deductions || 0)
          const fee = (r.total_deductions || 0) + (r.platform_fee || 0)
          channels[grp].revenue += gross
          channels[grp].adminFee += fee
        })

        // Standard platform commission rates: Food Apps 20%, TikTok 10%
        if (channels.food_apps.adminFee === 0 && channels.food_apps.revenue > 0) {
          channels.food_apps.adminFee = Math.round(channels.food_apps.revenue * 0.20)
        }
        if (channels.tiktok_go.adminFee === 0 && channels.tiktok_go.revenue > 0) {
          channels.tiktok_go.adminFee = Math.round(channels.tiktok_go.revenue * 0.10)
        }

        const totalGross = item.omzet + item.deductions
        const getCogs = (rev: number) => totalGross > 0 ? Math.round((item.hpp * rev) / totalGross) : 0

        const cogsOutlet = getCogs(channels.outlet.revenue)
        const cogsFoodApps = getCogs(channels.food_apps.revenue)
        const cogsTikTok = getCogs(channels.tiktok_go.revenue)
        const cogsWebsite = Math.max(0, item.hpp - cogsOutlet - cogsFoodApps - cogsTikTok)

        const gpOutlet = channels.outlet.revenue - cogsOutlet
        const gpFoodApps = channels.food_apps.revenue - channels.food_apps.adminFee - cogsFoodApps
        const settlementTikTok = channels.tiktok_go.revenue - channels.tiktok_go.adminFee
        const gpTikTok = settlementTikTok - cogsTikTok
        const gpWebsite = channels.website.revenue - cogsWebsite

        const totalRev = channels.outlet.revenue + channels.food_apps.revenue + channels.tiktok_go.revenue + channels.website.revenue
        const totalCogs = item.hpp
        const totalAdminFee = channels.food_apps.adminFee + channels.tiktok_go.adminFee
        const managementFee = (totalRev * mgmtFeePct) / 100
        const totalGrossProfit = totalRev - totalCogs - totalAdminFee - managementFee

        // CSV Rows - Channel 1
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI OUTLET', 'REVENUE', channels.outlet.revenue])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI OUTLET', 'TOTAL COGS (HPP)', cogsOutlet])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI OUTLET', 'TOTAL GROSS PROFIT OUTLET', gpOutlet])

        // CSV Rows - Channel 2
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'REVENUE', channels.food_apps.revenue])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'ADMIN FEE (KOMISI PLATFORM)', channels.food_apps.adminFee])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'TOTAL COGS (HPP)', cogsFoodApps])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'TOTAL GROSS PROFIT FOOD APPS', gpFoodApps])

        // CSV Rows - Channel 3
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'REVENUE', channels.tiktok_go.revenue])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'TOTAL COGS (HPP)', cogsTikTok])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'ADMIN FEE (POTONGAN TIKTOK)', channels.tiktok_go.adminFee])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'SETTLEMENT (PENCAIRAN)', settlementTikTok])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'TOTAL GROSS PROFIT TIKTOK GO', gpTikTok])

        // CSV Rows - Channel 4
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI WEBSITE SS', 'REVENUE', channels.website.revenue])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI WEBSITE SS', 'TOTAL COGS (HPP)', cogsWebsite])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI WEBSITE SS', 'TOTAL GROSS PROFIT WEBSITE SS', gpWebsite])

        // CSV Rows - Total Rekap Gross
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL REVENUE', totalRev])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL COGS (HPP)', totalCogs])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL ADMIN FEE', totalAdminFee])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', `MANAGEMENT FEE (${mgmtFeePct}%)`, managementFee])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL GROSS PROFIT', totalGrossProfit])

        // OPEX
        const outletOpex = expenses.rows.filter(e => e.outlet_id === item.id)
        const opexSums: Record<string, number> = {
          pengeluaran_outlet: 0,
          gaji_crew_outlet: 0,
          bonus_leader: 0,
          bonus_korlap: 0,
          lembur: 0,
          ads: 0,
          endorsement: 0,
          promo: 0,
          pdam: 0,
          pln: 0,
          internet: 0,
          sewa_outlet: 0
        }

        outletOpex.forEach(e => {
          const c = (e as any).category?.toLowerCase() || ''
          if (c === 'gaji_crew_outlet' || c === 'salary' || c === 'gaji') opexSums.gaji_crew_outlet += e.amount
          else if (c === 'bonus_leader') opexSums.bonus_leader += e.amount
          else if (c === 'bonus_korlap' || c === 'bonus_area_manager') opexSums.bonus_korlap += e.amount
          else if (c === 'lembur' || c === 'overtime') opexSums.lembur += e.amount
          else if (c === 'ads') opexSums.ads += e.amount
          else if (c === 'endorsement') opexSums.endorsement += e.amount
          else if (c === 'promo') opexSums.promo += e.amount
          else if (c === 'pdam' || c === 'air') opexSums.pdam += e.amount
          else if (c === 'pln' || c === 'listrik') opexSums.pln += e.amount
          else if (c === 'internet' || c === 'wifi') opexSums.internet += e.amount
          else if (c === 'sewa_outlet' || c === 'sewa') opexSums.sewa_outlet += e.amount
          else opexSums.pengeluaran_outlet += e.amount
        })

        if (item.waste > 0) {
          opexSums.pengeluaran_outlet += item.waste
        }

        const totalOpex = Object.values(opexSums).reduce((a, b) => a + b, 0)
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'PENGELUARAN OUTLET', opexSums.pengeluaran_outlet])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'GAJI CREW OUTLET', opexSums.gaji_crew_outlet])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'BONUS LEADER', opexSums.bonus_leader])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'BONUS KORLAP', opexSums.bonus_korlap])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'LEMBUR', opexSums.lembur])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'ADS', opexSums.ads])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'ENDORSEMENT', opexSums.endorsement])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'PROMO', opexSums.promo])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'PDAM', opexSums.pdam])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'PLN', opexSums.pln])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'INTERNET', opexSums.internet])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'BIAYA SEWA OUTLET', opexSums.sewa_outlet])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'SUB TOTAL PENGELUARAN', totalOpex])

        // NET PROFIT & BAGI HASIL
        const totalNetProfit = totalGrossProfit - totalOpex
        let profitMitra = 0
        let profitSukaShawarma = 0

        if (isMitra) {
          profitMitra = totalNetProfit > 0 ? (totalNetProfit * bagiHasilPct) / 100 : totalNetProfit
          profitSukaShawarma = managementFee + (totalNetProfit > 0 ? (totalNetProfit * (100 - bagiHasilPct)) / 100 : 0)
        } else {
          profitMitra = 0
          profitSukaShawarma = totalNetProfit
        }

        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'NET PROFIT', 'TOTAL NET PROFIT', totalNetProfit])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'NET PROFIT', `PROFIT MITRA (${isMitra ? bagiHasilPct : 0}%)`, profitMitra])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'NET PROFIT', 'PROFIT SUKA SHAWARMA', profitSukaShawarma])

        // 8. REKAP MODAL MITRA & ROI
        const totalProfitMitraSementara = profitMitraSebelumnya + (isMitra ? profitMitra : 0)
        const roi = modalInvestasi > 0 ? ((totalProfitMitraSementara / modalInvestasi) * 100).toFixed(2) + '%' : '0.00%'
        const bepStatus = isMitra 
          ? (modalInvestasi > 0 && totalProfitMitraSementara >= modalInvestasi 
              ? 'SUDAH BEP (BALIK MODAL)' 
              : `${(modalInvestasi > 0 ? (totalProfitMitraSementara / modalInvestasi) * 100 : 0).toFixed(2).replace('.', ',')}% Menuju BEP`)
          : '-'

        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'TOTAL MODAL MITRA', modalInvestasi])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'PROFIT MITRA SEBELUMNYA (HISTORIS)', profitMitraSebelumnya])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'PROFIT MITRA PERIODE INI', profitMitra])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'TOTAL PROFIT MITRA SEMENTARA (KUMULATIF)', totalProfitMitraSementara])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'ROI (%)', `"${roi}"`])
        rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'STATUS BEP', `"${bepStatus}"`])
      })

      const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laporan_Laba_Rugi_${filter.from}_${filter.to}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Ekspor CSV berhasil', { id: tId })
    } catch (e) {
      toast.error('Gagal mengekspor CSV', { id: tId })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    const tId = toast.loading('Menyiapkan file PDF resmi Suka Shawarma...')
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ])

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      outletBreakdown.forEach((item, oIndex) => {
        if (oIndex > 0) doc.addPage()

        const outletDisplayName = item.name.replace(/^SUKA SHAWARMA\s*/i, '').toUpperCase()
        const outletSales = sales.rows.filter(r => r.outlet_id === item.id)

        // Check mitra investment profile
        const inv = mitraInvestments[item.id]
        const isMitra = Boolean(inv || item.name.toLowerCase().includes('mitra'))
        const modalInvestasi = Number(inv?.nilai_investasi) || (isMitra ? 125000000 : 0)
        const omzetHistoris = Number(inv?.omzet_historis) || 0
        const transferHistoris = Number(inv?.transfer_historis) || 0
        const profitMitraSebelumnya = omzetHistoris + transferHistoris
        const bagiHasilPct = inv?.persentase_bagi_hasil !== undefined ? Number(inv.persentase_bagi_hasil) : (isMitra ? 50 : 0)
        const mgmtFeePct = Number(inv?.management_fee) || 0

        // 1. Group sales by channel
        const channels = {
          outlet: { revenue: 0, adminFee: 0 },
          food_apps: { revenue: 0, adminFee: 0 },
          tiktok_go: { revenue: 0, adminFee: 0 },
          website: { revenue: 0, adminFee: 0 }
        }

        outletSales.forEach(r => {
          const grp = getChannelGroup(r.sales_source || '')
          const gross = (r.omzet || 0) + (r.total_deductions || 0)
          const fee = (r.total_deductions || 0) + (r.platform_fee || 0)
          channels[grp].revenue += gross
          channels[grp].adminFee += fee
        })

        // Standard platform commission rates: Food Apps 20%, TikTok 10%
        if (channels.food_apps.adminFee === 0 && channels.food_apps.revenue > 0) {
          channels.food_apps.adminFee = Math.round(channels.food_apps.revenue * 0.20)
        }
        if (channels.tiktok_go.adminFee === 0 && channels.tiktok_go.revenue > 0) {
          channels.tiktok_go.adminFee = Math.round(channels.tiktok_go.revenue * 0.10)
        }

        const totalGross = item.omzet + item.deductions
        const getCogs = (rev: number) => totalGross > 0 ? Math.round((item.hpp * rev) / totalGross) : 0

        const cogsOutlet = getCogs(channels.outlet.revenue)
        const cogsFoodApps = getCogs(channels.food_apps.revenue)
        const cogsTikTok = getCogs(channels.tiktok_go.revenue)
        const cogsWebsite = Math.max(0, item.hpp - cogsOutlet - cogsFoodApps - cogsTikTok)

        const gpOutlet = channels.outlet.revenue - cogsOutlet
        const gpFoodApps = channels.food_apps.revenue - channels.food_apps.adminFee - cogsFoodApps
        const settlementTikTok = channels.tiktok_go.revenue - channels.tiktok_go.adminFee
        const gpTikTok = settlementTikTok - cogsTikTok
        const gpWebsite = channels.website.revenue - cogsWebsite

        const totalRev = channels.outlet.revenue + channels.food_apps.revenue + channels.tiktok_go.revenue + channels.website.revenue
        const totalCogs = item.hpp
        const totalAdminFee = channels.food_apps.adminFee + channels.tiktok_go.adminFee
        const managementFee = (totalRev * mgmtFeePct) / 100
        const totalGrossProfit = totalRev - totalCogs - totalAdminFee - managementFee

        // OPEX
        const outletOpex = expenses.rows.filter(e => e.outlet_id === item.id)
        const opexSums: Record<string, number> = {
          pengeluaran_outlet: 0,
          gaji_crew_outlet: 0,
          bonus_leader: 0,
          bonus_korlap: 0,
          lembur: 0,
          ads: 0,
          endorsement: 0,
          promo: 0,
          pdam: 0,
          pln: 0,
          internet: 0,
          sewa_outlet: 0
        }

        outletOpex.forEach(e => {
          const c = (e as any).category?.toLowerCase() || ''
          if (c === 'gaji_crew_outlet' || c === 'salary' || c === 'gaji') opexSums.gaji_crew_outlet += e.amount
          else if (c === 'bonus_leader') opexSums.bonus_leader += e.amount
          else if (c === 'bonus_korlap' || c === 'bonus_area_manager') opexSums.bonus_korlap += e.amount
          else if (c === 'lembur' || c === 'overtime') opexSums.lembur += e.amount
          else if (c === 'ads') opexSums.ads += e.amount
          else if (c === 'endorsement') opexSums.endorsement += e.amount
          else if (c === 'promo') opexSums.promo += e.amount
          else if (c === 'pdam' || c === 'air') opexSums.pdam += e.amount
          else if (c === 'pln' || c === 'listrik') opexSums.pln += e.amount
          else if (c === 'internet' || c === 'wifi') opexSums.internet += e.amount
          else if (c === 'sewa_outlet' || c === 'sewa') opexSums.sewa_outlet += e.amount
          else opexSums.pengeluaran_outlet += e.amount
        })

        if (item.waste > 0) {
          opexSums.pengeluaran_outlet += item.waste
        }

        const totalOpex = Object.values(opexSums).reduce((a, b) => a + b, 0)
        const totalNetProfit = totalGrossProfit - totalOpex

        let profitMitra = 0
        let profitSukaShawarma = 0

        if (isMitra) {
          profitMitra = totalNetProfit > 0 ? (totalNetProfit * bagiHasilPct) / 100 : totalNetProfit
          profitSukaShawarma = managementFee + (totalNetProfit > 0 ? (totalNetProfit * (100 - bagiHasilPct)) / 100 : 0)
        } else {
          profitMitra = 0
          profitSukaShawarma = totalNetProfit
        }

        // Rekap Modal Mitra & ROI
        const totalProfitMitraSementara = profitMitraSebelumnya + (isMitra ? profitMitra : 0)
        const roiVal = modalInvestasi > 0 ? ((totalProfitMitraSementara / modalInvestasi) * 100).toFixed(2).replace('.', ',') + '%' : '-'
        const bepStatus = isMitra 
          ? (modalInvestasi > 0 && totalProfitMitraSementara >= modalInvestasi 
              ? 'SUDAH BALIK MODAL (BEP)' 
              : `${(modalInvestasi > 0 ? (totalProfitMitraSementara / modalInvestasi) * 100 : 0).toFixed(2).replace('.', ',')}% Menuju BEP`)
          : 'Outlet Milik Pusat'

        // Brand Suka Shawarma Palette
        const sukaAmberLight = [254, 243, 199] // Warm Cream (#FEF3C7)
        const sukaAmberDark = [146, 64, 14]   // Dark Amber (#92400E)
        const sukaGold = [253, 230, 138]       // Warm Gold (#FDE68A)
        const sukaRoseLight = [255, 228, 230]  // Soft Rose (#FFE4E6)
        const sukaRoseDark = [159, 18, 57]    // Dark Rose (#9F1239)
        const sukaGreenLight = [209, 250, 229] // Mint Emerald (#D1FAE5)
        const sukaGreenDark = [6, 95, 70]     // Dark Green (#065F46)
        const sukaCyanLight = [224, 242, 254]  // Sky Cyan (#E0F2FE)
        const sukaCyanDark = [3, 105, 161]    // Deep Cyan (#0369A1)
        const sukaBlueLight = [239, 246, 255]  // Soft Blue (#EFF6FF)
        const sukaBlueDark = [30, 58, 138]    // Dark Slate/Navy (#1E3A8A)

        // BRAND HEADER WITH LOGO IN PDF
        doc.setDrawColor(234, 88, 12)
        doc.setFillColor(234, 88, 12)
        doc.rect(14, 9, 182, 1.2, 'F')

        // Embed Logo
        try {
          if (LOGO_BASE64) {
            doc.addImage(LOGO_BASE64, 'PNG', 14, 12.5, 15, 15)
          }
        } catch {
          // Fallback if logo fails
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(194, 65, 12) // Suka Orange Terracotta
        doc.text('SUKA SHAWARMA', 32, 17)

        doc.setFontSize(8.5)
        doc.setTextColor(30, 41, 59) // Slate 800
        doc.text('LAPORAN LABA RUGI OPERASIONAL & PERFORMA KEMITRAAN', 32, 22)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(100, 116, 139) // Slate 500
        const outletCategoryStr = isMitra 
          ? `Kemitraan (Bagi Hasil: ${bagiHasilPct}% | Mgmt Fee: ${mgmtFeePct}%)` 
          : 'Outlet Pusat (Milik Sendiri)'
        doc.text(`OUTLET: ${outletDisplayName}  [${outletCategoryStr}]`, 32, 26.5)
        doc.text(`Periode: ${filter.from} s/d ${filter.to}   |   Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`, 32, 30.5)

        const bodyRows: any[] = []

        // 1. TRANSAKSI OUTLET
        bodyRows.push([
          { content: 'TRANSAKSI OUTLET (KASIR POS / OFFLINE)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
        ])
        bodyRows.push(['REVENUE', { content: rupiah(channels.outlet.revenue), styles: { halign: 'right' } }])
        bodyRows.push(['TOTAL COGS (HPP)', { content: rupiah(cogsOutlet), styles: { halign: 'right' } }])
        bodyRows.push([
          { content: 'TOTAL GROSS PROFIT OUTLET', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
          { content: rupiah(gpOutlet), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
        ])

        // Spacer
        bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])

        // 2. TRANSAKSI FOOD APPS
        bodyRows.push([
          { content: 'TRANSAKSI FOOD APPS (GRAB / GOJEK / SHOPEE)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
        ])
        bodyRows.push(['REVENUE', { content: rupiah(channels.food_apps.revenue), styles: { halign: 'right' } }])
        bodyRows.push(['ADMIN FEE (KOMISI PLATFORM)', { content: rupiah(channels.food_apps.adminFee), styles: { halign: 'right' } }])
        bodyRows.push(['TOTAL COGS (HPP)', { content: rupiah(cogsFoodApps), styles: { halign: 'right' } }])
        bodyRows.push([
          { content: 'TOTAL GROSS PROFIT FOOD APPS', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
          { content: rupiah(gpFoodApps), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
        ])

        // Spacer
        bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])

        // 3. TRANSAKSI TIKTOK GO
        bodyRows.push([
          { content: 'TRANSAKSI TIKTOK GO / TIKTOK SHOP', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
        ])
        bodyRows.push(['REVENUE', { content: rupiah(channels.tiktok_go.revenue), styles: { halign: 'right' } }])
        bodyRows.push(['TOTAL COGS (HPP)', { content: rupiah(cogsTikTok), styles: { halign: 'right' } }])
        bodyRows.push(['ADMIN FEE (POTONGAN TIKTOK)', { content: rupiah(channels.tiktok_go.adminFee), styles: { halign: 'right' } }])
        bodyRows.push([
          { content: 'SETTLEMENT (PENCAIRAN DANA)', styles: { fontStyle: 'bold' } }, 
          { content: rupiah(settlementTikTok), styles: { halign: 'right', fontStyle: 'bold' } }
        ])
        bodyRows.push([
          { content: 'TOTAL GROSS PROFIT TIKTOK GO', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
          { content: rupiah(gpTikTok), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
        ])

        // Spacer
        bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])

        // 4. TRANSAKSI WEBSITE SS
        bodyRows.push([
          { content: 'TRANSAKSI WEBSITE RESMI SUKA SHAWARMA', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
        ])
        bodyRows.push(['REVENUE', { content: rupiah(channels.website.revenue), styles: { halign: 'right' } }])
        bodyRows.push(['TOTAL COGS (HPP)', { content: rupiah(cogsWebsite), styles: { halign: 'right' } }])
        bodyRows.push([
          { content: 'TOTAL GROSS PROFIT WEBSITE SS', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
          { content: rupiah(gpWebsite), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
        ])

        // Spacer
        bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])

        // 5. TOTAL REKAP GROSS
        bodyRows.push([
          { content: 'TOTAL REKAP PENDAPATAN KOTOR (GROSS)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }
        ])
        bodyRows.push([
          { content: 'TOTAL REVENUE' }, 
          { content: rupiah(totalRev), styles: { halign: 'right' } }
        ])
        bodyRows.push([
          { content: 'TOTAL COGS (HPP)' }, 
          { content: rupiah(totalCogs), styles: { halign: 'right' } }
        ])
        bodyRows.push([
          { content: 'TOTAL ADMIN FEE' }, 
          { content: rupiah(totalAdminFee), styles: { halign: 'right' } }
        ])
        if (mgmtFeePct > 0 || managementFee > 0) {
          bodyRows.push([
            { content: `MANAGEMENT FEE PUSAT (${mgmtFeePct}%)`, styles: { fontStyle: 'bold', fillColor: sukaBlueLight, textColor: sukaBlueDark } }, 
            { content: rupiah(managementFee), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaBlueLight, textColor: sukaBlueDark } }
          ])
        }
        bodyRows.push([
          { content: 'TOTAL GROSS PROFIT', styles: { fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }, 
          { content: rupiah(totalGrossProfit), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }
        ])

        // Spacer
        bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.6, lineWidth: 0 } }])

        // 6. URAIAN OPEX
        bodyRows.push([
          { content: 'URAIAN BEBAN OPERASIONAL (OPEX)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaRoseLight, textColor: sukaRoseDark } }
        ])
        bodyRows.push(['PENGELUARAN OUTLET', { content: rupiah(opexSums.pengeluaran_outlet), styles: { halign: 'right' } }])
        bodyRows.push(['GAJI CREW OUTLET', { content: rupiah(opexSums.gaji_crew_outlet), styles: { halign: 'right' } }])
        bodyRows.push(['BONUS LEADER', { content: rupiah(opexSums.bonus_leader), styles: { halign: 'right' } }])
        bodyRows.push(['BONUS KORLAP', { content: rupiah(opexSums.bonus_korlap), styles: { halign: 'right' } }])
        bodyRows.push(['LEMBUR', { content: rupiah(opexSums.lembur), styles: { halign: 'right' } }])
        bodyRows.push(['ADS', { content: rupiah(opexSums.ads), styles: { halign: 'right' } }])
        bodyRows.push(['ENDORSEMENT', { content: rupiah(opexSums.endorsement), styles: { halign: 'right' } }])
        bodyRows.push(['PROMO', { content: rupiah(opexSums.promo), styles: { halign: 'right' } }])
        bodyRows.push(['PDAM (AIR)', { content: rupiah(opexSums.pdam), styles: { halign: 'right' } }])
        bodyRows.push(['PLN (LISTRIK)', { content: rupiah(opexSums.pln), styles: { halign: 'right' } }])
        bodyRows.push(['INTERNET & WIFI', { content: rupiah(opexSums.internet), styles: { halign: 'right' } }])
        bodyRows.push(['BIAYA SEWA OUTLET', { content: rupiah(opexSums.sewa_outlet), styles: { halign: 'right' } }])
        bodyRows.push([
          { content: 'SUB TOTAL PENGELUARAN (TOTAL OPEX)', styles: { fontStyle: 'bold', fillColor: sukaRoseLight, textColor: sukaRoseDark } }, 
          { content: rupiah(totalOpex), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaRoseLight, textColor: sukaRoseDark } }
        ])

        // Spacer
        bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.6, lineWidth: 0 } }])

        // 7. NET PROFIT & BAGI HASIL
        bodyRows.push([
          { content: 'HASIL LABA BERSIH & BAGI HASIL', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }
        ])
        bodyRows.push([
          { content: 'TOTAL NET PROFIT', styles: { fontStyle: 'bold' } }, 
          { content: rupiah(totalNetProfit), styles: { halign: 'right', fontStyle: 'bold' } }
        ])
        if (isMitra) {
          bodyRows.push([
            { content: `PROFIT MITRA (${bagiHasilPct}%)`, styles: { fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }, 
            { content: rupiah(profitMitra), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }
          ])
          bodyRows.push([
            { content: `PROFIT SUKA SHAWARMA PUSAT (${100 - bagiHasilPct}% + Mgmt Fee)`, styles: { fontStyle: 'bold', fillColor: sukaBlueLight, textColor: sukaBlueDark } }, 
            { content: rupiah(profitSukaShawarma), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaBlueLight, textColor: sukaBlueDark } }
          ])
        } else {
          bodyRows.push([
            { content: 'PROFIT SUKA SHAWARMA PUSAT (100%)', styles: { fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }, 
            { content: rupiah(profitSukaShawarma), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }
          ])
        }

        // 8. REKAP MODAL MITRA & ROI
        if (isMitra) {
          bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.6, lineWidth: 0 } }])
          bodyRows.push([
            { content: 'REKAP MODAL INVESTASI & ROI MITRA (DASHBOARD KEMITRAAN)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaCyanLight, textColor: sukaCyanDark } }
          ])
          bodyRows.push(['TOTAL MODAL INVESTASI MITRA', { content: modalInvestasi > 0 ? rupiah(modalInvestasi) : '-', styles: { halign: 'right' } }])
          bodyRows.push(['PROFIT MITRA SEBELUMNYA (HISTORIS)', { content: rupiah(profitMitraSebelumnya), styles: { halign: 'right' } }])
          bodyRows.push(['PROFIT MITRA PERIODE INI', { content: rupiah(profitMitra), styles: { halign: 'right' } }])
          bodyRows.push([
            { content: 'TOTAL PROFIT MITRA SEMENTARA (KUMULATIF)', styles: { fontStyle: 'bold' } }, 
            { content: rupiah(totalProfitMitraSementara), styles: { halign: 'right', fontStyle: 'bold' } }
          ])
          bodyRows.push([
            { content: 'RETURN ON INVESTMENT (ROI)', styles: { fontStyle: 'bold', fillColor: sukaCyanLight, textColor: sukaCyanDark } }, 
            { content: roiVal, styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaCyanLight, textColor: sukaCyanDark } }
          ])
          bodyRows.push([
            { content: 'STATUS BEP', styles: { fontStyle: 'bold' } }, 
            { content: bepStatus, styles: { halign: 'right', fontStyle: 'bold' } }
          ])
        }

        autoTable(doc, {
          startY: 34,
          head: [],
          body: bodyRows,
          theme: 'plain',
          styles: { 
            fontSize: 7.8, 
            cellPadding: { top: 1.5, bottom: 1.5, left: 3.5, right: 3.5 },
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            textColor: [15, 23, 42]
          },
          columnStyles: { 
            0: { cellWidth: 122 }, 
            1: { cellWidth: 60, halign: 'right' } 
          },
          didParseCell: function (data: any) {
            if (data.row.raw[0]?.content === '') {
              data.cell.styles.lineWidth = 0
              data.cell.styles.fillColor = [255, 255, 255]
            }
          },
          didDrawPage: function (data: any) {
            const pageCount = (doc as any).internal.getNumberOfPages()
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.setTextColor(148, 163, 184)
            doc.text(
              `Halaman ${data.pageNumber} dari ${pageCount}  |  Laporan Resmi Keuangan & Kemitraan Suka Shawarma`,
              14,
              doc.internal.pageSize.height - 8
            )
          }
        })
      })

      doc.save(`Laporan_Laba_Rugi_${filter.from}_${filter.to}.pdf`)
      toast.success('Ekspor PDF berhasil', { id: tId })
    } catch (e) {
      toast.error('Gagal mengekspor PDF', { id: tId })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <PageHeader 
        title="Laba Rugi & Profitabilitas" 
        description="Analisis mendalam perbandingan omzet penjualan, beban pokok, dan biaya operasional" 
        icon={Calculator}
      >
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <button disabled={isExporting} onClick={handleExportCSV} className={`flex items-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border border-green-200 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Download className="w-3.5 h-3.5" /> {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button disabled={isExporting} onClick={handleExportPDF} className={`flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border border-red-200 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <FileText className="w-3.5 h-3.5" /> {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
          <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} hideSource={true} />
        </div>
      </PageHeader>

      {/* Status Sinkronisasi / Last Updated */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 -mt-4 mb-2 text-xs">
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
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white hover:bg-suka-gray-50 border border-suka-gray-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
          title="Muat ulang data laba rugi dari database"
        >
          <RefreshCw className={`w-3 h-3 text-suka-orange ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
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
            <div className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Omzet Penjualan (Kotor)</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Pemasukan kotor sebelum potongan</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-orange-50 text-orange-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold">Rp </span>
                  <CountUp end={actualGrossRevenue} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    Net Masuk: {rupiah(actualGrossRevenue - totalDeductions)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Beban Pokok (COGS + Waste) */}
            <div className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Beban Pokok (HPP)</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Modal bahan resep & waste</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold text-amber-800">-Rp </span>
                  <CountUp end={totalHpp + totalWaste} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-suka-gray-500 font-semibold">
                  <span>HPP: {rupiah(totalHpp)}</span>
                  <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢</span>
                  <span>Waste: {rupiah(totalWaste)}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Beban Operasional (OPEX) */}
            <div className="bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 rounded-l-3xl" />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Biaya Operasional</p>
                  <p className="text-[11px] text-suka-gray-400 font-medium mt-0.5">Gaji, sewa, listrik & kas</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className="text-2xl font-black text-suka-brown tracking-tight">
                  <span className="text-base font-semibold text-rose-700">-Rp </span>
                  <CountUp end={pengeluaranOutlet + (isAllOutlets ? pengeluaranPusat : 0)} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-suka-gray-500 font-semibold">
                  <span>{isAllOutlets ? `Outlet + Pusat` : `Beban Outlet`}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Laba Bersih (Net Profit) - Hero Highlight */}
            <div className={`p-5 rounded-3xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${
              displayLaba >= 0 
                ? 'bg-gradient-to-br from-orange-50/80 via-white to-amber-50/50 border-suka-orange/30' 
                : 'bg-gradient-to-br from-rose-50/80 via-white to-red-50/50 border-rose-200'
            }`}>
              <div className={`absolute top-0 left-0 w-2 h-full rounded-l-3xl ${displayLaba >= 0 ? 'bg-suka-orange' : 'bg-rose-600'}`} />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-extrabold text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-suka-orange" /> Laba Bersih (Net)
                  </p>
                  <p className="text-[11px] text-suka-gray-500 font-medium mt-0.5">Hasil laba bersih akhir</p>
                </div>
                <div className={`p-2.5 rounded-2xl ${displayLaba >= 0 ? 'bg-orange-100 text-suka-orange' : 'bg-rose-100 text-rose-600'}`}>
                  <Banknote className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pl-2">
                <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${displayLaba >= 0 ? 'text-suka-brown' : 'text-rose-600'}`}>
                  <span className="text-base font-semibold">{displayLaba < 0 ? '-Rp ' : 'Rp '}</span>
                  <CountUp end={Math.abs(displayLaba)} duration={1} separator="." />
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    displayLaba >= 0 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}>
                    Margin: {displayMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

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
                      <span className="font-bold text-suka-brown">{rupiah(actualGrossRevenue)}</span>
                    </div>
                    {/* Selalu tampil, termasuk saat Rp 0 -- baris yang
                        muncul-hilang bikin pembaca mengira datanya tidak ada. */}
                    <div className="flex justify-between items-center text-xs text-rose-600 pl-4 border-l-2 border-rose-300">
                      <span>Potongan Merchant</span>
                      <span className="font-semibold">-{rupiah(totalDeductions)}</span>
                    </div>
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
                      <span className="font-medium">Beban Tetap & Bulanan Outlet (Gaji, Listrik, Sewa)</span>
                      <span className="font-bold">-{rupiah(pengeluaranOutletBulanan)}</span>
                    </div>
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
                    <div style={{ width: `${pctHpp}%` }} className="bg-amber-500 h-full" title={`HPP: ${pctHpp}%`} />
                    <div style={{ width: `${pctOpex}%` }} className="bg-rose-500 h-full" title={`Opex: ${pctOpex}%`} />
                    <div style={{ width: `${pctFee}%` }} className="bg-purple-500 h-full" title={`Potongan/Fee: ${pctFee}%`} />
                    <div style={{ width: `${pctWaste}%` }} className="bg-red-700 h-full" title={`Waste: ${pctWaste}%`} />
                  </div>
                  <div className="flex justify-between text-[10px] text-suka-gray-400 font-semibold uppercase">
                    <span>Total Beban: {((totalBiaya / (netRevenue || 1)) * 100).toFixed(0)}%</span>
                    <span>Sisa Margin: {displayMargin.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Progress items */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> HPP (Bahan Baku)
                    </span>
                    <span className="font-bold text-suka-brown">{pctHpp}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Biaya Operasional (Opex)
                    </span>
                    <span className="font-bold text-suka-brown">{pctOpex}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span> Potongan & Komisi
                    </span>
                    <span className="font-bold text-suka-brown">{pctFee}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-semibold text-suka-gray-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-700"></span> Waste (Bahan Basi)
                    </span>
                    <span className="font-bold text-suka-brown">{pctWaste}%</span>
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
                      <th className="py-3.5 px-4 text-right">Potongan Merchant</th>
                      <th className="py-3.5 px-4 text-right">HPP</th>
                      <th className="py-3.5 px-4 text-right">Waste</th>
                      <th className="py-3.5 px-4 text-right">OPEX</th>
                      <th className="py-3.5 px-4 text-right">Laba Bersih</th>
                      <th className="py-3.5 px-4 text-center">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium text-suka-ink">
                    {filteredOutlets.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-suka-gray-400">
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
                              {row.name.replace('SUKA SHAWARMA ', '')}
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
                </table>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  )
}







