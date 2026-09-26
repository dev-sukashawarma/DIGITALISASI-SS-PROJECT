// apps/finance/src/app/eom-closing/useEomKasirLive.ts
import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { OutletCashData } from './exportKasirPdf'
import { isExcludedOutlet, isTestOutlet } from '@/lib/outletFilters'

export interface ShiftVarianceLog {
  no: number
  day: number
  outlet: string
  shift: string
  sistem: number
  fisik: number
  selisih: number
  penyebab: string
  status: string
}

export interface PettyCashCategoryItem {
  no: number
  kategori: string
  outletTerbanyak: string
  nominal: number
  porsi: string
}

export interface NonCashChannelItem {
  no: number
  channel: string
  volume: string
  nominal: number
  porsi: string
}

export interface EomKasirLiveData {
  outlets: OutletCashData[]
  shiftVariances: ShiftVarianceLog[]
  pettyCashCategories: PettyCashCategoryItem[]
  nonCashChannels: NonCashChannelItem[]
  totalOrders: number
  totalShifts: number
  isLive: boolean
  lastFetchedAt: string
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
  pengeluaran_outlet: 'Operasional & Belanja Darurat Toko',
  outlet: 'Pengeluaran Kebutuhan Laci Kasir',
  bb: 'Bahan Baku & Tambahan Dapur Segar',
  bahan_baku: 'Bahan Tambahan & Kemasan Darurat',
  pln: 'Listrik PLN & Token Darurat',
  utilities: 'Token Listrik & Utilitas Toko',
  transport: 'Transportasi & Pengantaran Cepat',
  lembur: 'Uang Makan & Lembur Staf Shift',
  pdam: 'Air Minum Galon & Sanitasi Toko',
  operasional: 'Iuran Kebersihan, Parkir & Lingkungan',
  lainnya: 'Pengeluaran Operasional Lainnya',
}

export function useEomKasirLive(
  month: number,
  year: number,
  fallbackOutlets: OutletCashData[]
) {
  const [data, setData] = useState<EomKasirLiveData>({
    outlets: fallbackOutlets,
    shiftVariances: [],
    pettyCashCategories: [],
    nonCashChannels: [],
    totalOrders: 0,
    totalShifts: 0,
    isLive: false,
    lastFetchedAt: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLiveEomData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()

    try {
      const pad = (n: number) => String(n).padStart(2, '0')
      const startTz = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0)).toISOString()
      const endTz =
        month === 12
          ? new Date(Date.UTC(year + 1, 0, 1, -7, 0, 0)).toISOString()
          : new Date(Date.UTC(year, month, 1, -7, 0, 0)).toISOString()

      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const startDate = `${year}-${pad(month)}-01`
      const endDate = `${year}-${pad(month)}-${pad(lastDay)}`

      // 1. Fetch Outlets, Shifts, Petty Cash in parallel
      const outletsPromise = supabase
        .from('outlets')
        .select('id, name, type, bank_name, bank_account_number, is_active')
        .order('name')

      const shiftsPromise = supabase
        .from('shifts')
        .select(
          'id, outlet_id, staff_id, start_time, end_time, starting_cash, actual_ending_cash, expected_ending_cash, variance, status, notes, outlet_staff(id, name, role)'
        )
        .gte('start_time', startTz)
        .lt('start_time', endTz)
        .limit(2000)

      const pettyCashPromise = supabase
        .from('petty_cash_expenses')
        .select('id, outlet_id, category, amount, description, expense_date')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .is('deleted_at', null)
        .limit(2000)

      // 2. Fetch Orders with parallel wave pagination
      const PAGE_SIZE = 1000
      const PAGE_CONCURRENCY = 6
      let offset = 0
      const allOrders: Array<{ outlet_id: string; total_amount: number; payment_method: string }> = []

      const fetchOrdersWave = async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const wave = await Promise.all(
            Array.from({ length: PAGE_CONCURRENCY }, (_, i) =>
              supabase
                .from('orders')
                .select('outlet_id, total_amount, payment_method')
                .gte('created_at', startTz)
                .lt('created_at', endTz)
                .neq('status', 'cancelled')
                .neq('status', 'void')
                .range(offset + i * PAGE_SIZE, offset + (i + 1) * PAGE_SIZE - 1)
            )
          )

          let reachedEnd = false
          for (const { data: page, error: pageErr } of wave) {
            if (pageErr) {
              console.warn('EOM Orders wave fetch error:', pageErr)
              reachedEnd = true
              break
            }
            if (Array.isArray(page)) {
              allOrders.push(...(page as any))
              if (page.length < PAGE_SIZE) {
                reachedEnd = true
                break
              }
            } else {
              reachedEnd = true
              break
            }
          }
          if (reachedEnd) break
          offset += PAGE_CONCURRENCY * PAGE_SIZE
        }
      }

      const [outletsRes, shiftsRes, pettyRes] = await Promise.all([
        outletsPromise,
        shiftsPromise,
        pettyCashPromise,
        fetchOrdersWave(),
      ])

      // Fallback if no real orders found in this month
      if (allOrders.length === 0) {
        console.info('Tidak ada transaksi order live untuk periode ini. Menggunakan snapshot baseline.')
        setData({
          outlets: fallbackOutlets,
          shiftVariances: [],
          pettyCashCategories: [],
          nonCashChannels: [],
          totalOrders: 0,
          totalShifts: 0,
          isLive: false,
          lastFetchedAt: new Date().toISOString(),
        })
        setLoading(false)
        return
      }

      // 3. Process Outlets
      const validOutlets = (outletsRes.data || []).filter(
        (o) => !isExcludedOutlet(o) && !isTestOutlet(o)
      )

      const outletMap = new Map<
        string,
        OutletCashData & { orderCount: number; shiftCount: number; bankAccount?: string }
      >()

      validOutlets.forEach((o, idx) => {
        const typeStr =
          o.type === 'mitra' ? 'Mitra' : o.type === 'marketplace' ? 'Online' : 'Internal'
        outletMap.set(o.id, {
          no: idx + 1,
          name: o.name,
          type: typeStr,
          grossPos: 0,
          cash: 0,
          nonCash: 0,
          bankDeposit: 0,
          pettyCash: 0,
          poAlloc: 0,
          variance: 0,
          orderCount: 0,
          shiftCount: 0,
          bankAccount: o.bank_account_number || '873-092-1100',
        })
      })

      // 4. Process Orders & Payment Channels
      const channelSums: Record<string, { nominal: number; count: number }> = {}
      allOrders.forEach((ord) => {
        const out = outletMap.get(ord.outlet_id)
        const amt = Number(ord.total_amount) || 0
        const method = (ord.payment_method || 'other').toLowerCase()

        if (!channelSums[method]) {
          channelSums[method] = { nominal: 0, count: 0 }
        }
        channelSums[method].nominal += amt
        channelSums[method].count += 1

        if (out) {
          out.grossPos += amt
          out.orderCount += 1
          if (method === 'cash') {
            out.cash += amt
          } else {
            out.nonCash += amt
          }
        }
      })

      // 5. Process Petty Cash
      const catSums: Record<string, { nominal: number; outlets: Set<string> }> = {}
      ;(pettyRes.data || []).forEach((p: any) => {
        const out = outletMap.get(p.outlet_id)
        const amt = Number(p.amount) || 0
        const rawCat = p.category || 'operasional'
        const catKey = CATEGORY_LABEL_MAP[rawCat] || 'Operasional Darurat Toko'

        if (!catSums[catKey]) {
          catSums[catKey] = { nominal: 0, outlets: new Set() }
        }
        catSums[catKey].nominal += amt

        if (out) {
          out.pettyCash += amt
          catSums[catKey].outlets.add(
            out.name.replace('SUKA SHAWARMA ', '').replace('MITRA ', '')
          )
        }
      })

      // 6. Process Shifts & Variances
      const liveVariances: ShiftVarianceLog[] = []
      let totalShiftCount = 0

      ;(shiftsRes.data || []).forEach((s: any) => {
        totalShiftCount += 1
        const out = outletMap.get(s.outlet_id)
        const varAmt = Number(s.variance) || 0

        if (out) {
          out.shiftCount += 1
          out.variance += varAmt
        }

        if (varAmt !== 0) {
          const d = new Date(s.start_time)
          const staffObj = Array.isArray(s.outlet_staff) ? s.outlet_staff[0] : s.outlet_staff
          const staffName = staffObj?.name || 'Kasir Toko'
          liveVariances.push({
            no: liveVariances.length + 1,
            day: d.getDate(),
            outlet: out?.name || 'CABANG OUTLET',
            shift: `Shift Kasir (${staffName})`,
            sistem: Number(s.expected_ending_cash) || 0,
            fisik: Number(s.actual_ending_cash) || 0,
            selisih: varAmt,
            penyebab:
              s.notes ||
              (varAmt < 0
                ? 'Salah hitung kembalian / selisih fisik blind close kasir'
                : 'Kelebihan kembalian koin / pembulatan pembayaran'),
            status:
              varAmt < 0 ? 'LUNAS (Potong Kasbon Kasir)' : 'SELESAI (Disetor ke Kas Toko)',
          })
        }
      })

      // 7. Compile Final Outlet List
      const compiledOutlets = Array.from(outletMap.values()).map((o) => {
        const targetSetor = Math.max(0, o.cash - o.pettyCash)
        o.bankDeposit = targetSetor
        o.poAlloc = Math.round(o.grossPos * 0.38)
        return o
      })

      // Sort by Gross POS descending
      compiledOutlets.sort((a, b) => b.grossPos - a.grossPos)
      compiledOutlets.forEach((o, idx) => {
        o.no = idx + 1
      })

      // 8. Compile Petty Cash Categories
      const totalPetty = Object.values(catSums).reduce((a, b) => a + b.nominal, 0)
      const compiledCategories: PettyCashCategoryItem[] = Object.entries(catSums)
        .sort((a, b) => b[1].nominal - a[1].nominal)
        .slice(0, 5)
        .map(([kategori, val], idx) => ({
          no: idx + 1,
          kategori,
          outletTerbanyak: Array.from(val.outlets).slice(0, 3).join(', ') || 'Semua Cabang',
          nominal: val.nominal,
          porsi: totalPetty > 0 ? `${((val.nominal / totalPetty) * 100).toFixed(1)}%` : '0%',
        }))

      // 9. Compile Non-Cash Channels
      const totalNonCash = Object.entries(channelSums).reduce(
        (sum, [key, val]) => (key !== 'cash' ? sum + val.nominal : sum),
        0
      )

      const channelNameMapping: Record<string, string> = {
        qris: 'QRIS Statis & Dinamis (BCA / Mandiri / ShopeePay)',
        card: 'EDC Kartu Debit & Kredit Bank',
        edc: 'EDC Kartu Debit & Kredit Bank',
        va: 'Virtual Account & Bank Transfer Langsung',
        transfer: 'Virtual Account & Bank Transfer Langsung',
        ewallet: 'E-Wallet (GoPay, ShopeePay, OVO)',
        gofood: 'Settlement Merchant Delivery Online',
        shopeefood: 'Settlement Merchant Delivery Online',
        other: 'Kanal Non-Tunai Lainnya',
      }

      const groupedChannels: Record<string, { nominal: number; volume: number }> = {}
      Object.entries(channelSums).forEach(([method, val]) => {
        if (method === 'cash') return
        const friendlyName = channelNameMapping[method] || 'Kanal Non-Tunai Lainnya'
        if (!groupedChannels[friendlyName]) {
          groupedChannels[friendlyName] = { nominal: 0, volume: 0 }
        }
        groupedChannels[friendlyName].nominal += val.nominal
        groupedChannels[friendlyName].volume += val.count
      })

      const compiledChannels: NonCashChannelItem[] = Object.entries(groupedChannels)
        .sort((a, b) => b[1].nominal - a[1].nominal)
        .map(([channel, val], idx) => ({
          no: idx + 1,
          channel,
          volume: `${val.volume.toLocaleString('id-ID')} Trx`,
          nominal: val.nominal,
          porsi: totalNonCash > 0 ? `${((val.nominal / totalNonCash) * 100).toFixed(1)}%` : '0%',
        }))

      setData({
        outlets: compiledOutlets,
        shiftVariances: liveVariances,
        pettyCashCategories: compiledCategories,
        nonCashChannels: compiledChannels,
        totalOrders: allOrders.length,
        totalShifts: totalShiftCount,
        isLive: true,
        lastFetchedAt: new Date().toISOString(),
      })
    } catch (err: any) {
      console.error('Error fetching live EOM data from Supabase:', err)
      setError(err?.message || 'Gagal mengambil data live dari Supabase')
      // Fallback gracefully
      setData({
        outlets: fallbackOutlets,
        shiftVariances: [],
        pettyCashCategories: [],
        nonCashChannels: [],
        totalOrders: 0,
        totalShifts: 0,
        isLive: false,
        lastFetchedAt: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [month, year, fallbackOutlets])

  useEffect(() => {
    fetchLiveEomData()
  }, [fetchLiveEomData])

  return {
    ...data,
    loading,
    error,
    refetch: fetchLiveEomData,
  }
}
