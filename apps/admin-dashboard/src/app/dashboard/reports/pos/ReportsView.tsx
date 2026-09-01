// @ts-nocheck
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  FileText, Calendar, ChevronDown, ChevronUp, Award, Banknote, Store,
  QrCode, CreditCard, Package, Search, CheckCircle2, XCircle, Printer, Wallet, Filter, X, FileSpreadsheet,
  Clock, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cleanItemName } from '@/lib/order-item-name'
import { formatRupiah } from '@/lib/validations'
import OrderSourceBadge from '@/components/OrderSourceBadge'
import ScheduledPromoBadge from '@/components/ScheduledPromoBadge'
import { resolveOrderSource } from '@/lib/order-source'
import { computePosReportKpi, computeNetRevenueVoidAware } from '@/lib/posReportKpi'

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

import type { Outlet } from '@/pos-types'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import BranchFilter from '@/components/BranchFilter'
import { splitOutletsByType } from '@/lib/marketplaceOutlets'
import { generateExecutiveItemReportPDF, generateCategorizedReportPDF } from '@/utils/pdfExporter'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

interface ShiftRow {
  id: string
  outlet_id: string
  start_time: string
  end_time: string | null
  status: string
  starting_cash: number
  expected_ending_cash: number
  actual_ending_cash: number
  variance: number
  expected_ending_petty_cash: number
  actual_ending_petty_cash: number
  petty_cash_variance: number
}

interface OrderRow {
  id: string
  order_number: number
  status: string
  payment_method: string | null
  total_amount: number
  created_at: string
  outlet_id: string
  channel: string | null
  sales_source: string | null
  customer_name?: string | null
  cashier_name?: string | null
  external_order_id?: string | null
  order_items: {
    id: string
    menu_item_id?: string | null
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
    is_promo_reward?: boolean
    promo_id?: string | null
    promo_name?: string | null
    promo_buy_quantity?: number | null
    promo_get_quantity?: number | null
    original_unit_price?: number | null
    package_choices?: Record<string, string> | string | null
    menu_items?: {
      hpp_override?: number | null
      is_package?: boolean
      package_items?: {
        quantity?: number
        component?: {
          hpp_override?: number | null
        } | null
      }[] | null
    } | null
  }[]
}

function getItemHpp(
  menuItem: any, 
  outletType?: string, 
  fallbackName?: string, 
  menuItemByNameMap?: Map<string, any>,
  channel?: string | null,
  menuItemId?: string | null,
  menuItemByIdMap?: Map<string, any>
): number {
  let itemObj = menuItem
  if (!itemObj && menuItemId && menuItemByIdMap?.has(menuItemId)) {
    itemObj = menuItemByIdMap.get(menuItemId)
  }
  if ((!itemObj || (!itemObj.hpp_override && !itemObj.channel_hpp && !itemObj.is_package)) && fallbackName && menuItemByNameMap) {
    const cleanKey = cleanItemName(fallbackName)
    if (menuItemByNameMap.has(cleanKey)) {
      itemObj = menuItemByNameMap.get(cleanKey)
    }
  }
  if (!itemObj) return 0

  let baseHpp = 0
  const normCh = channel ? channel.toLowerCase() : null
  let channelHppVal: number | null = null

  if (itemObj.channel_hpp && typeof itemObj.channel_hpp === 'object' && normCh) {
    if (
      normCh === 'ss-online' ||
      normCh === 'ss_online' ||
      normCh.includes('tiktok') ||
      normCh.includes('shopee') ||
      normCh === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' ||
      normCh === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
    ) {
      channelHppVal = itemObj.channel_hpp.ss_online ?? itemObj.channel_hpp.tiktok_shop ?? itemObj.channel_hpp.shopee_shop ?? itemObj.channel_hpp[normCh] ?? null
    } else {
      channelHppVal = itemObj.channel_hpp[normCh] ?? null
    }
  }

  if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
    baseHpp = Number(channelHppVal)
  } else if (itemObj.hpp_override !== null && itemObj.hpp_override !== undefined && Number(itemObj.hpp_override) > 0) {
    baseHpp = Number(itemObj.hpp_override)
  } else if (itemObj.is_package && Array.isArray(itemObj.package_items)) {
    baseHpp = itemObj.package_items.reduce((sum: number, pkg: any) => {
      const compHpp = pkg.component ? getItemHpp(pkg.component, outletType, undefined, undefined, channel) : (pkg.component?.hpp_override || 0)
      const qty = pkg.quantity || 1
      return sum + (compHpp * qty)
    }, 0)
  }
  if (outletType === 'mitra' && baseHpp > 0) {
    return Math.round(baseHpp * 1.10)
  }
  return baseHpp
}

type DateRangeType = 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all' | 'custom'

const RANGE_LABELS: Record<DateRangeType, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  thisMonth: 'Bulan Ini',
  all: 'Semua Waktu',
  custom: 'Kustom Tanggal',
}

interface ReportsViewProps {
  initialOutlets: Outlet[]
}

// â”€â”€â”€ Helper for extracting packages/combos â”€â”€â”€
function extractOrderPackages(order: OrderRow) {
  const pkgs: { name: string; qty: number; choices?: Record<string, string> }[] = []
  
  order.order_items.forEach(item => {
    let isPackage = false
    let choicesObj: Record<string, string> = {}
    
    // Fallback: check if 'package_choices' is set and has keys
    if (item.package_choices) {
      if (typeof item.package_choices === 'object') {
        choicesObj = item.package_choices as Record<string, string>
      } else if (typeof item.package_choices === 'string') {
        try {
          choicesObj = JSON.parse(item.package_choices)
        } catch (e) {
          // ignore
        }
      }
      if (Object.keys(choicesObj).length > 0) isPackage = true
    }

    const nameLower = item.menu_item_name.toLowerCase()
    if (nameLower.includes('paket') || nameLower.includes('combo') || nameLower.includes('bundle')) {
      isPackage = true
    }

    if (isPackage) {
      pkgs.push({
        name: cleanItemName(item.menu_item_name),
        qty: item.quantity,
        choices: choicesObj
      })
    }
  })

  return pkgs
}

export default function ReportsView({ initialOutlets: rawInitialOutlets }: ReportsViewProps) {
  const initialOutlets = useMemo(() => rawInitialOutlets.filter(o => !isTestOutlet(o)), [rawInitialOutlets])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>(
    initialOutlets.length === 1 ? [initialOutlets[0].id] : ['all']
  )
  const { physical: physicalOutlets, marketplace: marketplaceOutlets } = useMemo(
    () => splitOutletsByType(outlets),
    [outlets]
  )
  const marketplaceOutletIds = useMemo(
    () => new Set(marketplaceOutlets.map(o => o.id)),
    [marketplaceOutlets]
  )
  // selectedOutlet menunjuk salah satu dari outlet fisik.
  const branchFilterValue = selectedOutlets
  const isSSOnlineSelected = selectedOutlets.length === 1 && selectedOutlets[0] === 'ss-online'
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['all'])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toISOString())
  const todayJakarta = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()), [])

  const menuItemByNameMap = useMemo(() => {
    const map = new Map<string, any>()
    menuItems.forEach(mi => {
      if (mi.name) {
        map.set(cleanItemName(mi.name), mi)
      }
    })
    return map
  }, [menuItems])

  const menuItemByIdMap = useMemo(() => {
    const map = new Map<string, any>()
    menuItems.forEach(mi => {
      if (mi.id) {
        map.set(mi.id, mi)
      }
    })
    return map
  }, [menuItems])
  
  // Date Range State
  const [range, setRange] = useState<DateRangeType>(initialOutlets.length === 1 ? 'yesterday' : 'thisMonth')
  const [showRangePicker, setShowRangePicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  const dateStrRange = useMemo(() => {
    const fmt = (d: Date) => {
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${d.getFullYear()}-${m}-${day}`
    }
    const today = new Date()
    if (range === 'today') return { from: fmt(today), to: fmt(today) }
    if (range === 'yesterday') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      return { from: fmt(y), to: fmt(y) }
    }
    if (range === '7days') {
      const s = new Date()
      s.setDate(s.getDate() - 7)
      return { from: fmt(s), to: fmt(today) }
    }
    if (range === '30days') {
      const s = new Date()
      s.setDate(s.getDate() - 30)
      return { from: fmt(s), to: fmt(today) }
    }
    if (range === 'thisMonth') {
      const s = new Date()
      s.setDate(1)
      return { from: fmt(s), to: fmt(today) }
    }
    if (range === 'custom') {
      // Salah satu input masih kosong = rentang belum valid. Kembalikan kosong
      // supaya query HPP di-skip; JANGAN jatuh ke fallback all-time di bawah,
      // karena itu bikin kartu Total COGS menampilkan HPP sepanjang masa.
      if (!customStartDate || !customEndDate) return { from: '', to: '' }
      return { from: customStartDate, to: customEndDate }
    }
    return { from: '2000-01-01', to: fmt(today) }
  }, [range, customStartDate, customEndDate])

  const isPast = useMemo(() => {
    if (range === 'yesterday' || range === '7days' || range === '30days') {
      if (dateStrRange.to && dateStrRange.to < todayJakarta) return true
    }
    if (range === 'custom' && customEndDate && customEndDate < todayJakarta) return true
    return false
  }, [range, dateStrRange, customEndDate, todayJakarta])

  // Pawoon data hanya tersedia s.d. Juli 2026 â€” sembunyikan filter Pawoon
  // jika rentang filter tidak mencakup satupun hari di Juli 2026 atau sebelumnya.
  const PAWOON_CUTOFF = '2026-08-01'
  const isPawoonVisible = useMemo(() => {
    if (range === 'all') return true
    const from = dateStrRange.from
    if (!from) return false
    return new Date(from) < new Date(PAWOON_CUTOFF)
  }, [range, dateStrRange.from])

  // Table State
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Modal State for Shift Expenses
  const [selectedShiftForExpenses, setSelectedShiftForExpenses] = useState<ShiftRow | null>(null)
  const [shiftExpenses, setShiftExpenses] = useState<any[]>([])
  const [shiftTopups, setShiftTopups] = useState<any[]>([])
  const [activePettyCashTab, setActivePettyCashTab] = useState<'pengeluaran' | 'pemasukan'>('pengeluaran')
  const [loadingShiftExpenses, setLoadingShiftExpenses] = useState(false)
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null)
  const [settlements, setSettlements] = useState<any[]>([])

  const openShiftExpenses = async (shift: ShiftRow) => {
    setSelectedShiftForExpenses(shift)
    setActivePettyCashTab('pengeluaran')
    setLoadingShiftExpenses(true)
    const supabase = createClient()
    
    const expensesPromise = supabase
      .from('petty_cash_expenses')
      .select('*')
      .eq('outlet_id', shift.outlet_id)
      .gte('created_at', shift.start_time)
      .lte('created_at', shift.end_time || new Date().toISOString())
      .order('created_at', { ascending: true })

    const topupsPromise = supabase
      .from('petty_cash_topups')
      .select('*')
      .eq('outlet_id', shift.outlet_id)
      .gte('created_at', shift.start_time)
      .lte('created_at', shift.end_time || new Date().toISOString())
      .order('created_at', { ascending: true })
      
    const [expRes, topRes] = await Promise.all([expensesPromise, topupsPromise])
    
    setShiftExpenses(expRes.data || [])
    setShiftTopups(topRes.data || [])
    setLoadingShiftExpenses(false)
  }

  const fetchOrdersRequestId = useRef(0)

  const fetchOrders = useCallback(async () => {
    // Kustom Tanggal butuh KEDUA input terisi â€” kalau salah satu masih kosong
    // (state transisi normal saat user baru pindah ke "Kustom Tanggal" atau
    // baru isi satu input), jangan fetch sama sekali. Selain sia-sia, fetch
    // ini tanpa bound tanggal akan menarik SELURUH riwayat order 19 outlet.
    const requestId = ++fetchOrdersRequestId.current

    if (range === 'custom' && (!customStartDate || !customEndDate)) {
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Filter Date (dihitung sekali jadi bound tanggal, dipakai ulang tiap halaman pagination)
    let ordersGte: string | undefined
    let ordersLt: string | undefined
    let ordersLte: string | undefined

    const pad = (n: number) => String(n).padStart(2, '0')
    const formatLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

    if (range === 'today') {
      const today = new Date()
      ordersGte = `${formatLocalDate(today)}T00:00:00+07:00`
    } else if (range === 'yesterday') {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const endD = new Date()
      ordersGte = `${formatLocalDate(d)}T00:00:00+07:00`
      ordersLt = `${formatLocalDate(endD)}T00:00:00+07:00`
    } else if (range === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      ordersGte = `${formatLocalDate(d)}T00:00:00+07:00`
    } else if (range === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      ordersGte = `${formatLocalDate(d)}T00:00:00+07:00`
    } else if (range === 'this_month' || range === 'thisMonth') {
      const d = new Date()
      ordersGte = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01T00:00:00+07:00`
    } else if (range === 'last_month' || range === 'lastMonth') {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const lastDay = new Date(y, m, 0).getDate()
      ordersGte = `${y}-${pad(m)}-01T00:00:00+07:00`
      ordersLte = `${y}-${pad(m)}-${pad(lastDay)}T23:59:59+07:00`
    } else if (range === 'custom' && customStartDate && customEndDate) {
      ordersGte = `${customStartDate}T00:00:00+07:00`
      ordersLte = `${customEndDate}T23:59:59+07:00`
    }

    const buildOrdersQuery = () => {
      let query = supabase
        .from('orders')
        .select('id, order_number, status, payment_method, total_amount, discount_amount, promo_subsidy, created_at, outlet_id, channel, sales_source, customer_name, cashier_name, external_order_id, is_endorse, order_items(id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, is_promo_reward, promo_id, promo_name, promo_buy_quantity, promo_get_quantity, original_unit_price, package_choices)')
        .neq('outlet_id', TEST_OUTLET_ID)
        .order('id', { ascending: false })
      if (!selectedOutlets.includes('all')) query = query.in('outlet_id', selectedOutlets)
      if (ordersGte) query = query.gte('created_at', ordersGte)
      if (ordersLt) query = query.lt('created_at', ordersLt)
      if (ordersLte) query = query.lte('created_at', ordersLte)
      return query
    }

    // Fetch Shifts
    let qShifts = supabase
      .from('shifts')
      .select('id, outlet_id, start_time, end_time, status, starting_cash, expected_ending_cash, actual_ending_cash, variance, expected_ending_petty_cash, actual_ending_petty_cash, petty_cash_variance')
      .neq('outlet_id', TEST_OUTLET_ID)
      .eq('status', 'closed')
      .order('end_time', { ascending: false })
      
    if (!selectedOutlets.includes('all')) {
      qShifts = qShifts.in('outlet_id', selectedOutlets)
    }

    if (range === 'today') {
      const today = new Date()
      qShifts = qShifts.gte('end_time', `${formatLocalDate(today)}T00:00:00+07:00`)
    } else if (range === 'yesterday') {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const endD = new Date()
      qShifts = qShifts.gte('end_time', `${formatLocalDate(d)}T00:00:00+07:00`).lt('end_time', `${formatLocalDate(endD)}T00:00:00+07:00`)
    } else if (range === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      qShifts = qShifts.gte('end_time', `${formatLocalDate(d)}T00:00:00+07:00`)
    } else if (range === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      qShifts = qShifts.gte('end_time', `${formatLocalDate(d)}T00:00:00+07:00`)
    } else if (range === 'this_month' || range === 'thisMonth') {
      const d = new Date()
      qShifts = qShifts.gte('end_time', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01T00:00:00+07:00`)
    } else if (range === 'last_month' || range === 'lastMonth') {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const lastDay = new Date(y, m, 0).getDate()
      qShifts = qShifts.gte('end_time', `${y}-${pad(m)}-01T00:00:00+07:00`).lte('end_time', `${y}-${pad(m)}-${pad(lastDay)}T23:59:59+07:00`)
    } else if (range === 'custom' && customStartDate && customEndDate) {
      qShifts = qShifts.gte('end_time', `${customStartDate}T00:00:00+07:00`).lte('end_time', `${customEndDate}T23:59:59+07:00`)
    }

    // Supabase/PostgREST membatasi max 1000 baris per query.
    // Query yang sudah dirampingkan (lean select) jauh lebih cepat (~90% lebih ringan)
    // dan tidak lagi membebani PostgREST dengan nested joins 4-tingkat.
    const PAGE_SIZE = 1000
    // Halaman ditarik per-gelombang secara paralel, bukan satu per satu.
    // Rentang 30 hari â‰ˆ 31 halaman; sebelumnya itu berarti 31 round-trip
    // BERURUTAN (tiap halaman menunggu halaman sebelumnya selesai). Sekarang
    // 4 halaman ditembak berbarengan lalu berhenti begitu ada halaman pendek
    // (tanda sudah mentok) â€” tanpa perlu query COUNT tambahan.
    // Ini murni perubahan cara mengambil data; urutan hasil tetap dijaga
    // (gelombang diproses berurutan) dan tidak ada logika agregasi yang berubah.
    const PAGE_CONCURRENCY = 4

    const fetchAllPaged = async <T,>(buildQuery: () => any, label: string): Promise<T[]> => {
      const all: T[] = []
      let offset = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const wave = await Promise.all(
          Array.from({ length: PAGE_CONCURRENCY }, (_, i) =>
            buildQuery().range(offset + i * PAGE_SIZE, offset + (i + 1) * PAGE_SIZE - 1)
          )
        )
        let reachedEnd = false
        for (const { data, error } of wave) {
          if (error) {
            console.error(`${label} error:`, error)
            throw error
          }
          const page = (data ?? []) as T[]
          all.push(...page)
          if (page.length < PAGE_SIZE) reachedEnd = true
        }
        if (reachedEnd) break
        offset += PAGE_CONCURRENCY * PAGE_SIZE
      }
      return all
    }

    const fetchAllOrders = () => fetchAllPaged<OrderRow>(buildOrdersQuery, 'fetchAllOrders')

    const buildEcommerceQuery = () => {
      let query = supabase
        .from('ecommerce_sales')
        .select('id, order_id, channel_id, total_amount, order_date, raw_data, ecommerce_sale_items(id, menu_id, quantity, price, subtotal, menu_items:menu_id(name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))))')
        .order('id', { ascending: false })
      
      if (ordersGte) query = query.gte('order_date', ordersGte)
      if (ordersLt) query = query.lt('order_date', ordersLt)
      if (ordersLte) query = query.lte('order_date', ordersLte)
      
      return query
    }

    const fetchEcommerceOrders = async () => {
      if (!selectedOutlets.includes('all') && !selectedOutlets.includes('ss-online')) return []

      const ecommerceSalesList = await fetchAllPaged<any>(buildEcommerceQuery, 'fetchEcommerceOrders')

      // Map to OrderRow format
      return ecommerceSalesList.map((saleRecord: any) => {
        const raw = saleRecord.raw_data || {}
        const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
        // `ecommerce_sales.total_amount` sudah bernilai KOTOR (sebelum fee platform).
        // Sebelumnya nilai itu dipetakan apa adanya ke `total_amount` sementara fee
        // juga diisikan ke `discount_amount`. Karena KPI menghitung
        // gross = total_amount + potongan, fee platform jadi terhitung DUA KALI
        // dan Gross Revenue kelebihan sebesar fee (Rp 12,5 juta pada Agustus 2026).
        //
        // Dipetakan ke NET agar konsisten dengan useSalesDaily (Untung Rugi) dan
        // ownerDashboard (Ringkasan Bisnis), yang keduanya menyimpan omzet net +
        // potongan terpisah sehingga gross-nya kembali tepat sama dengan kotor.
        // Fee tetap tampil di kartu "Admin Platform & Promo" lewat discount_amount.
        const omzetNet = Math.max(0, (Number(saleRecord.total_amount) || 0) - totalPotongan)
                return {
          id: saleRecord.id,
          order_number: 0,
          status: 'completed',
          payment_method: saleRecord.channel_id,
          total_amount: omzetNet,
          discount_amount: totalPotongan,
          promo_subsidy: 0,
          created_at: saleRecord.order_date,
          outlet_id: 'ss-online',
          channel: saleRecord.channel_id,
          sales_source: 'Online',
          customer_name: 'SS Online Customer',
          cashier_name: null,
          external_order_id: saleRecord.order_id,
          raw_data: raw,
          order_items: (saleRecord.ecommerce_sale_items || []).map((item: any) => {
            const menuItemName = item.menu_items?.name || 'Unknown Item'
            return {
              id: item.id,
              menu_item_id: item.menu_id,
              menu_item_name: menuItemName,
              quantity: item.quantity,
              unit_price: item.price,
              subtotal: item.subtotal,
              package_choices: null,
              menu_items: item.menu_items
            }
          })
        }
      }) as OrderRow[]
    }

    const menuItemsQuery = supabase
      .from('menu_items')
      .select('id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))')

    let qSettlements = supabase.from('platform_settlements').select('*')
    if (!selectedOutlets.includes('all')) {
      qSettlements = qSettlements.in('outlet_id', selectedOutlets)
    }
    if (dateStrRange.from) {
      qSettlements = qSettlements.gte('tanggal', dateStrRange.from)
    }
    if (dateStrRange.to) {
      qSettlements = qSettlements.lte('tanggal', dateStrRange.to)
    }

    const [ordersData, ecommerceData, { data: shiftsData }, { data: menuItemsData }, { data: settlementsData }] = await Promise.all([
      !selectedOutlets.includes('ss-online') ? fetchAllOrders() : Promise.resolve([]), 
      fetchEcommerceOrders(),
      qShifts, 
      menuItemsQuery,
      qSettlements
    ])

    // Abaikan hasil fetch basi â€” request lebih baru (mis. user selesai memilih
    // custom date setelah sebelumnya sempat fire fetch tanpa bound tanggal)
    // bisa resolve lebih dulu; tanpa guard ini, respons lama yang telat datang
    // akan menimpa balik data yang sudah benar dengan hasil unbounded.
    if (requestId !== fetchOrdersRequestId.current) return

    setOrders(
      [...ordersData, ...ecommerceData]
        .filter((o) => !isTestOutlet(o.outlet_id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    )
    setShifts(shiftsData ?? [])
    setMenuItems(menuItemsData ?? [])
    setSettlements(settlementsData ?? [])
    setLoading(false)
    setLastUpdated(new Date().toISOString())
  }, [range, selectedOutlets, customStartDate, customEndDate, dateStrRange])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Order dan detail item masuk sebagai satu transaksi pada POS baru, tetapi
  // berlangganan keduanya tetap diperlukan untuk order lama/penyuntingan item.
  // Debounce mencegah dua event pada order yang sama memicu dua fetch besar.
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    let pendingWhileHidden = false

    // Tiap order masuk dari outlet MANA PUN memicu penarikan ulang seluruh
    // rentang (30 hari â‰ˆ puluhan ribu baris). Dengan debounce 600ms, di jam
    // sibuk halaman ini praktis menarik ulang terus-menerus dan itulah yang
    // paling terasa sebagai "lemot". Dua peredam:
    //  1. Jendela debounce diperlebar â€” laporan periode panjang tidak butuh
    //     kesegaran sub-detik.
    //  2. Saat tab tidak terlihat, penarikan ditunda sampai user kembali,
    //     supaya tab yang dibiarkan terbuka berhenti membebani DB.
    const REFRESH_DEBOUNCE_MS = 4000

    const runRefresh = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        pendingWhileHidden = true
        return
      }
      fetchOrders()
    }
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(runRefresh, REFRESH_DEBOUNCE_MS)
    }
    const onVisible = () => {
      if (!document.hidden && pendingWhileHidden) {
        pendingWhileHidden = false
        fetchOrders()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    const realtime = supabase
      .channel('pos-reports-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refresh)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(realtime)
    }
  }, [fetchOrders])

  // Auto-reset selectedChannel jika filter Pawoon aktif tapi Pawoon sudah
  // tidak relevan untuk range yang dipilih (Agustus 2026 ke atas).
  const PAWOON_CHANNEL_KEYS = useMemo(() => new Set(['pos_pawoon_all', 'pos_pawoon', 'pos_fa']), [])
  useEffect(() => {
    if (!isPawoonVisible && selectedChannels.some(ch => PAWOON_CHANNEL_KEYS.has(ch))) {
      setSelectedChannels(['all'])
    }
  }, [isPawoonVisible])

  useEffect(() => {
    if (isSSOnlineSelected) {
      setSelectedPaymentMethod('all')
      if (selectedChannels.some(ch => ch !== 'all' && ch !== 'tiktok_shop' && ch !== 'shopee_shop')) {
        setSelectedChannels(['all'])
      }
    }
  }, [isSSOnlineSelected])

  // â”€â”€â”€ Available Channels â”€â”€â”€
  const PAWOON_KEYS = useMemo(() => new Set(['pos_pawoon_all', 'pos_pawoon', 'pos_fa']), [])
  const availableChannels = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>()

    // Channel standar â€” Pawoon hanya dimasukkan jika range mencakup Juli 2026 atau sebelumnya
    const defaults = [
      { key: 'pos_kasir', label: 'POS KASIR (Internal)' },
      ...(isPawoonVisible ? [
        { key: 'pos_pawoon_all', label: 'POS PAWOON (Semua)' },
        { key: 'pos_pawoon', label: 'POS PAWOON' },
        { key: 'pos_fa', label: 'FA PAWOON' },
      ] : []),
      { key: 'shopeefood', label: 'ShopeeFood' },
      { key: 'gofood', label: 'GoFood' },
      { key: 'grabfood', label: 'GrabFood' },
      { key: 'tiktokgo', label: 'TikTok Go' },
      { key: 'online', label: 'Website Online' },
    ]
    defaults.forEach(d => map.set(d.key, d))

    orders.forEach(o => {
      const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
      // Sembunyikan ENDORSE dari dropdown
      if (src.key === 'endors') return
      // Sembunyikan sumber Pawoon dari orders jika tidak relevan untuk range ini
      if (!isPawoonVisible && PAWOON_KEYS.has(src.key)) return
      if (!map.has(src.key)) {
        map.set(src.key, { key: src.key, label: src.label })
      }
    })
    return Array.from(map.values())
  }, [orders, isPawoonVisible, PAWOON_KEYS])

  // â”€â”€â”€ Shared helper (used in analytics useMemo AND downloadCSVAllChannels) â”€â”€â”€
  const isFoodApp = (ch: string) => ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo', 'generic_food_app', 'food_apps', 'foodapp', 'foodapps'].includes(ch.toLowerCase())

  const isChannelSelected = (target: string, order: any, src: string) => {
    if (target === 'food_apps') return isFoodApp(src)
    if (target === 'pos_kasir') return src === 'pos_kasir'
    if (target === 'pos_pawoon_all') return src === 'pos_pawoon' || src === 'pos_fa' || src === 'pos'
    if (target === 'pos_pawoon') {
      if (src !== 'pos_pawoon' && src !== 'pos') return false
      return !order.order_items.some((item: any) => item.menu_item_name.includes('FA'))
    }
    if (target === 'pos_fa') {
      if (src !== 'pos_pawoon' && src !== 'pos') return false
      return order.order_items.some((item: any) => item.menu_item_name.includes('FA'))
    }
    if (target === 'tiktokgo' || target === 'tiktok') return ['tiktokgo', 'tiktok', 'tiktok_go'].includes(src)
    if (target === 'tiktok_shop' || target === 'tiktokshop') {
      return ['tiktok_shop', 'tiktokshop', 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'].includes(src) || ['tiktok_shop', 'tiktokshop', 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'].includes((order.channel || '').toLowerCase())
    }
    if (target === 'shopee_shop' || target === 'shopeeseller' || target === 'shopee_seller') {
      return ['shopee_shop', 'shopeeseller', 'shopee_seller', 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'].includes(src) || ['shopee_shop', 'shopeeseller', 'shopee_seller', 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'].includes((order.channel || '').toLowerCase())
    }
    return src === target
  }

  // â”€â”€â”€ Derived Analytics â”€â”€â”€
  const analytics = useMemo(() => {

    const filteredOrders = selectedChannels.includes('all') 
      ? orders 
      : orders.filter(o => {
          const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).key.toLowerCase()
          return selectedChannels.some(target => isChannelSelected(target.toLowerCase(), o, src))
        })

    const completed = filteredOrders.filter(o => o.status === 'completed' || o.status === 'settled')
    const totalOrders = completed.length
    const buyOneGetOneOrders = completed.filter(order => order.order_items.some(item => item.is_promo_reward))
    const buyOneGetOneGiftUnits = buyOneGetOneOrders.reduce(
      (sum, order) => sum + order.order_items
        .filter(item => item.is_promo_reward)
        .reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
      0
    )
    // NET methodology (konsisten dengan halaman Laba Kotor, keputusan owner
    // 2026-07-29): order completed ditambah, order cancelled (void) DIKURANGKAN.
    // Cakupan lain di halaman ini (jumlah item terjual, best seller, breakdown
    // pembayaran) SENGAJA tetap completed-only untuk saat ini â€” hanya kartu
    // Gross Revenue/Gross Profit yang diperbaiki (2026-07-31, kasus EMPANG
    // 24 Juli: void P7KY2P6LD8NY7 Rp94.000 dulu tidak mengurangi apa pun).
    const actualNetRevenue = computeNetRevenueVoidAware(filteredOrders)

    // Hitung total selisih laci (variance) dari tutup shift
    const totalCashVariance = shifts.reduce((s, shift) => s + (shift.variance || 0), 0)

    const outletTypeMap = new Map<string, string>()
    outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))

    // Calculate Total HPP using order_items menu_items
    const totalHPP = completed
      .reduce((sum, o) => {
        const outletType = outletTypeMap.get(o.outlet_id)
        const orderChannel = o.channel || o.sales_source
        return sum + o.order_items.reduce((itemSum, item) => {
          const menuItem = item.menu_items || (item.menu_item_id ? menuItemByIdMap.get(item.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(item.menu_item_name))
          const hpp = getItemHpp(menuItem, outletType, item.menu_item_name, menuItemByNameMap, orderChannel, item.menu_item_id, menuItemByIdMap);
          return itemSum + (hpp * item.quantity);
        }, 0)
      }, 0)

    // Payment method breakdown
    const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
    completed.forEach(o => {
      const method = o.payment_method || 'unknown'
      if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, revenue: 0 }
      paymentBreakdown[method].count++
      paymentBreakdown[method].revenue += o.total_amount
    })

    // Kerugian/selisih kasir (variance) TIDAK BOLEH memotong Omzet Kotor (Gross Revenue)
    // karena Omzet adalah murni dari total nilai barang yang terjual.
    // Jika ingin menampilkan selisih kasir, sebaiknya ditampilkan di laporan terpisah atau pengeluaran.
    // Dihapus baris kode yang mengurangi totalRevenue dengan totalCashVariance.


    // Best sellers & Category Breakdown
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    const itemPdfMap: Record<string, { name: string; channel: string; qty: number; revenue: number }> = {}
    let mainFoodQty = 0
    let addOnsQty = 0

    completed.forEach(o => {
      const channelName = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).label

      o.order_items.forEach(oi => {
        const key = cleanItemName(oi.menu_item_name)
        if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 }
        itemMap[key].qty += oi.quantity
        itemMap[key].revenue += oi.subtotal
        
        const pdfKey = `${key}__${channelName}`
        if (!itemPdfMap[pdfKey]) itemPdfMap[pdfKey] = { name: key, channel: channelName, qty: 0, revenue: 0 }
        itemPdfMap[pdfKey].qty += oi.quantity
        itemPdfMap[pdfKey].revenue += oi.subtotal

        // Simple logic to detect Category: if parentId exists or "Extra" in name -> Add-on
        if (oi.menu_item_name.includes('|PARENT|') || oi.menu_item_name.toLowerCase().includes('extra')) {
          addOnsQty += oi.quantity
        } else {
          mainFoodQty += oi.quantity
        }
      })
    })
    
    const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty)
    const bestSellersPdf = Object.values(itemPdfMap).sort((a, b) => b.qty - a.qty)
    const categoryData = [
      { name: 'Menu Utama', value: mainFoodQty, color: '#f59e0b' },
      { name: 'Ekstra / Topping', value: addOnsQty, color: '#10b981' }
    ].filter(d => d.value > 0)

    // Success vs Failure
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled').length
    const successRate = filteredOrders.length > 0 ? Math.round((completed.length / filteredOrders.length) * 100) : 0

    // Potongan = diskon + subsidi promo yang TERCATAT, tanpa menebak-nebak.
    //
    // Sebelumnya ada suku `extraDiff` yang menebak "diskon tak tercatat" dengan
    // membandingkan jumlah subtotal item terhadap total_amount. Tebakan itu
    // dihapus karena dua alasan:
    //
    // 1. Untuk baris SS Online (ecommerce_sales) hasilnya palsu. Tebakan itu
    //    hanya menjumlahkan selisih POSITIF dan membuang yang negatif. Pada data
    //    impor TikTok Shop Agustus 2026, 557 baris berselisih +Rp 13.446.000 dan
    //    493 baris -Rp 12.920.000 -- bersihnya cuma Rp 526.000 (pembulatan
    //    platform, wajar), tapi karena sisi negatif dibuang, angkanya
    //    menggelembung jadi Rp 10.403.168 dan ikut menambah Gross Revenue.
    //
    // 2. Untuk order POS ia tidak pernah menangkap apa pun. Dari 59.812 order
    //    selesai sepanjang Juni-Agustus 2026: Juni Rp 0, Juli Rp 0, Agustus Rp 5
    //    (18 order, rata-rata Rp 0,28) -- murni sisa pembulatan. POS memang sudah
    //    mencatat diskon dengan benar di discount_amount/promo_subsidy, sehingga
    //    jaring pengaman ini tidak punya apa-apa untuk ditangkap.
    //
    // Dengan tebakan dihilangkan, Gross Revenue di halaman ini cocok sampai
    // rupiah terakhir dengan Ringkasan Bisnis dan Untung Rugi.
    const totalDeductions = isSSOnlineSelected
      ? completed.reduce((s, o) => s + (Number((o as any).discount_amount) || 0), 0)
      : completed.reduce((s, o) => {
          const disc = Number((o as any).discount_amount) || 0
          const promo = Number((o as any).promo_subsidy) || 0
          return s + disc + promo
        }, 0)

    const netRevenue = actualNetRevenue

    // Gross Revenue = total nilai kotor seluruh pesanan sebelum potongan/diskon/subsidi
    const grossRevenue = actualNetRevenue + totalDeductions
    const grossProfit = Math.max(0, grossRevenue - (totalHPP + totalDeductions))

    let totalSettlement = 0
    let totalRealAdmin = 0
    let settlementDateRange = ''

    if (isSSOnlineSelected) {
      totalSettlement = completed.reduce((sum, o) => {
        const net = Number((o as any).raw_data?.net_settlement)
        return sum + (isNaN(net) ? 0 : net)
      }, 0)
      totalRealAdmin = completed.reduce((sum, o) => {
        const potongan = Number((o as any).discount_amount) || Number((o as any).raw_data?.total_potongan) || 0
        return sum + potongan
      }, 0)
    } else if (selectedChannels.includes('tiktokgo') || selectedChannels.includes('tiktok')) {
      const relevantSettlements = settlements.filter(s => selectedChannels.includes(s.platform) || (s.platform === 'tiktokgo' && selectedChannels.includes('tiktok')) || (s.platform === 'tiktok' && selectedChannels.includes('tiktokgo')))
      totalSettlement = relevantSettlements.reduce((sum, s) => {
        return sum + (Number(s.omzet_kotor) || 0) - (Number(s.promo_merchant) || 0) - (Number(s.commission) || 0)
      }, 0)
      totalRealAdmin = relevantSettlements.reduce((sum, s) => sum + (Number(s.commission) || 0), 0)

      if (relevantSettlements.length > 0) {
        const dates = relevantSettlements.map(s => s.tanggal).filter(Boolean).sort()
        if (dates.length > 0) {
          const minDate = dates[0]
          const maxDate = dates[dates.length - 1]
          
          const formatDateStr = (d: string) => {
            const [y, m, day] = d.split('-')
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
            return `${day} ${months[parseInt(m) - 1]} ${y}`
          }

          if (minDate === maxDate) {
            settlementDateRange = formatDateStr(minDate)
          } else {
            settlementDateRange = `${formatDateStr(minDate)} - ${formatDateStr(maxDate)}`
          }
        }
      }
    }

    return {
      completedOrders: completed,
      paymentBreakdown,
      bestSellers,
      bestSellersPdf,
      categoryData,
      totalOrders,
      buyOneGetOneTransactions: buyOneGetOneOrders.length,
      buyOneGetOneGiftUnits,
      successRate,
      cancelledCount: cancelled,
      grossRevenue,
      totalDeductions,
      netRevenue,
      totalHPP,
      grossProfit,
      totalSettlement,
      totalRealAdmin,
      settlementDateRange
    }
  }, [orders, shifts, selectedChannels, menuItemByNameMap, menuItemByIdMap, settlements])

  const selectedOutletName = selectedOutlets.includes('all') 
      ? 'Semua Cabang' 
      : selectedOutlets.map(id => (id === 'ss-online' ? 'SS Online' : outlets.find(o => o.id === id)?.name)).filter(Boolean).join(', ') || 'Cabang Tidak Ditemukan'

  const PAYMENT_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    cash: { label: 'Tunai', color: '#10b981', bg: 'bg-emerald-50', icon: Banknote },
    qris: { label: 'QRIS', color: '#3b82f6', bg: 'bg-blue-50', icon: QrCode },
    card: { label: 'Kartu', color: '#8b5cf6', bg: 'bg-purple-50', icon: CreditCard },
    unknown: { label: 'Lainnya', color: '#6b7280', bg: 'bg-gray-50', icon: Package },
  }

  // â”€â”€â”€ Available Payment Methods â”€â”€â”€
  const availablePaymentMethods = useMemo(() => {
    const map = new Map<string, string>()
    map.set('cash', 'Tunai (Cash)')
    map.set('qris', 'QRIS')
    map.set('card', 'Kartu (Card)')

    orders.forEach(o => {
      if (o.payment_method) {
        const key = o.payment_method.toLowerCase()
        if (!map.has(key)) {
          const meta = PAYMENT_META[key]
          map.set(key, meta ? meta.label : key.toUpperCase())
        }
      }
    })
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [orders])

  // Table filtering and pagination
  const filteredTableData = useMemo(() => {
    let result = analytics.completedOrders
    if (selectedPaymentMethod !== 'all') {
      result = result.filter(o => (o.payment_method || 'unknown').toLowerCase() === selectedPaymentMethod.toLowerCase())
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o => 
        o.order_number.toString().includes(q) || 
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        o.order_items.some(i => 
          i.menu_item_name.toLowerCase().includes(q) ||
          (i.package_choices && JSON.stringify(i.package_choices).toLowerCase().includes(q))
        )
      )
    }
    return result
  }, [analytics.completedOrders, selectedPaymentMethod, searchQuery])

  const paginatedData = filteredTableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filteredTableData.length / itemsPerPage)


  // Item Breakdown (Rekap)
  const itemBreakdownData = useMemo(() => {
    const map = new Map<string, { name: string; groupLabel: string; qty: number; grossRevenue: number; netRevenue: number; hppPerUnit: number; totalHpp: number }>()
    const outletTypeMap = new Map<string, string>()
    outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))
    
    filteredTableData.forEach(order => {
      const outletType = outletTypeMap.get(order.outlet_id)
      
      // Hitung subtotal kotor dari seluruh item di pesanan ini
      const orderSubtotal = order.order_items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
      
      // Jika ada diskon/pajak di tingkat pesanan, distribusikan secara proporsional ke tiap item
      const ratio = orderSubtotal > 0 ? (order.total_amount / orderSubtotal) : 1

      order.order_items.forEach(item => {
        const cleanName = cleanItemName(item.menu_item_name)
        const src = resolveOrderSource(order.channel, order.sales_source, order.customer_name, order.is_endorse)
        
        let groupLabel = 'OFFLINE'
        if (order.outlet_id === 'ss-online' || src.key.includes('tiktok_shop') || src.key.includes('shopee_shop')) {
          groupLabel = 'SS ONLINE'
        } else if (['shopeefood', 'grabfood', 'gofood'].includes(src.key)) {
          groupLabel = 'FOOD APPS'
        } else if (['tiktokgo', 'tiktok', 'tiktok_go'].includes(src.key)) {
          groupLabel = 'TIKTOK'
        } else if (src.key === 'online') {
          groupLabel = 'WEB ONLINE'
        }
        
        const key = `${cleanName}-${groupLabel}`
        const menuItem = item.menu_items || (item.menu_item_id ? menuItemByIdMap.get(item.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(item.menu_item_name))
        const hppPerUnit = getItemHpp(menuItem, outletType, item.menu_item_name, menuItemByNameMap, order.channel || order.sales_source, item.menu_item_id, menuItemByIdMap)
        
        if (!map.has(key)) {
          map.set(key, {
            name: cleanName,
            groupLabel,
            qty: 0,
            grossRevenue: 0,
            netRevenue: 0,
            hppPerUnit,
            totalHpp: 0
          })
        }
        
        const existing = map.get(key)!
        existing.qty += item.quantity
        existing.grossRevenue += item.subtotal
        existing.netRevenue += (item.subtotal * ratio)
        existing.totalHpp += (hppPerUnit * item.quantity)
        existing.hppPerUnit = existing.qty > 0 ? Math.round(existing.totalHpp / existing.qty) : hppPerUnit
      })
    })
    
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
  }, [filteredTableData, outlets, menuItemByNameMap, menuItemByIdMap])

  const [itemBreakdownSearch, setItemBreakdownSearch] = useState('')
  const [itemBreakdownFilter, setItemBreakdownFilter] = useState('all')
  const [itemBreakdownSortColumn, setItemBreakdownSortColumn] = useState<'name' | 'groupLabel' | 'qty' | 'grossRevenue'>('qty')
  const [itemBreakdownSortDirection, setItemBreakdownSortDirection] = useState<'asc' | 'desc'>('desc')

  const filteredItemBreakdownData = useMemo(() => {
    let result = itemBreakdownData
    if (itemBreakdownFilter !== 'all') {
      result = result.filter(item => item.groupLabel === itemBreakdownFilter)
    }
    if (itemBreakdownSearch) {
      const q = itemBreakdownSearch.toLowerCase()
      result = result.filter(item => item.name.toLowerCase().includes(q) || item.groupLabel.toLowerCase().includes(q))
    }
    
    result = [...result].sort((a, b) => {
      let valA = a[itemBreakdownSortColumn]
      let valB = b[itemBreakdownSortColumn]
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return itemBreakdownSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        return itemBreakdownSortDirection === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
      }
    })
    
    return result
  }, [itemBreakdownData, itemBreakdownFilter, itemBreakdownSearch, itemBreakdownSortColumn, itemBreakdownSortDirection])

  const [itemBreakdownPage, setItemBreakdownPage] = useState(1)
  const paginatedItemBreakdown = filteredItemBreakdownData.slice((itemBreakdownPage - 1) * itemsPerPage, itemBreakdownPage * itemsPerPage)
  const totalItemBreakdownPages = Math.ceil(filteredItemBreakdownData.length / itemsPerPage)

  const toggleItemBreakdownSort = (col: 'name' | 'groupLabel' | 'qty' | 'grossRevenue') => {
    if (itemBreakdownSortColumn === col) {
      setItemBreakdownSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setItemBreakdownSortColumn(col)
      setItemBreakdownSortDirection('desc')
    }
  }

  const renderItemBreakdownSortIcon = (col: 'name' | 'groupLabel' | 'qty' | 'grossRevenue') => {
    if (itemBreakdownSortColumn !== col) return <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-30 transition-opacity" />
    return itemBreakdownSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }
  const downloadPDF = async () => {
    if (analytics.completedOrders.length === 0) return

    let dateRangeText = RANGE_LABELS[range]
    if (range === 'custom' && (customStartDate || customEndDate)) {
      dateRangeText = `${customStartDate || 'Awal'} s/d ${customEndDate || 'Sekarang'}`
    }

    const channelLabelText = selectedChannels.includes('all') 
      ? 'Semua Channel' 
      : selectedChannels.map(ch => ch === 'food_apps' ? 'Semua Food Apps' : (availableChannels.find(c => c.key === ch)?.label || ch)).join(', ')

    await generateExecutiveItemReportPDF({
      outletName: selectedOutletName,
      dateRangeLabel: dateRangeText,
      channelLabel: channelLabelText,
      grossRevenue: analytics.grossRevenue,
      totalOrders: analytics.completedOrders.length,
      bestSellers: (analytics as any).bestSellersPdf || analytics.bestSellers
    })
  }

  const downloadPDFAllChannels = async () => {
    // 1. Dapatkan valid orders yang sinkron dengan filter channel aktif
    const filteredForPDF = selectedChannels.includes('all') 
      ? orders
      : orders.filter(o => {
          const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).key.toLowerCase()
          return selectedChannels.some(target => isChannelSelected(target.toLowerCase(), o, src))
        })
    const validOrders = filteredForPDF.filter(o => o.status === 'completed' || o.status === 'settled')
    if (validOrders.length === 0) return

    let dateRangeText = RANGE_LABELS[range]
    if (range === 'custom' && (customStartDate || customEndDate)) {
      dateRangeText = `${customStartDate || 'Awal'} s/d ${customEndDate || 'Sekarang'}`
    }

    // 2. Kelompokkan per channel
    const outletTypeMap = new Map<string, string>()
    outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))

    const categoryMap: Record<string, {
      categoryName: string,
      grossRevenue: number,
      itemMap: Record<string, { name: string; qty: number; revenue: number; hppTotal: number; unitPrice: number }>
    }> = {}

    // "Total Revenue" per item HARUS bersumber dari rumus gross yang sama
    // dengan kartu KPI di layar (total_amount + diskon + promo per order),
    // bukan dari sekadar menjumlahkan order_items.subtotal.
    //
    // Sebelumnya kode ini menjumlahkan oi.subtotal apa adanya sebagai
    // "revenue" per item. Untuk data produksi (Agustus 2026), jumlah subtotal
    // item (Rp 1.830.040.996) TIDAK sama dengan gross order-level
    // (Rp 1.925.547.615, POS saja) — subtotal item sudah memperhitungkan
    // sebagian promo di level item (mis. item hadiah BOGO bersubtotal Rp 0)
    // tapi belum memperhitungkan diskon/subsidi di level order. Akibatnya
    // Grand Total di PDF (Rp 1.891.149.794 untuk 1-31 Agustus semua channel)
    // berbeda ~Rp 87 juta dari Gross Revenue di layar (Rp 1.978.446.055).
    //
    // Perbaikannya: gross per order (`orderGross`, rumus sama dengan KPI)
    // dibagi proporsional ke tiap item berdasarkan porsi subtotal-nya. Dengan
    // begitu jumlah "revenue" seluruh item per order SELALU tepat sama dengan
    // orderGross — sehingga bucket "Penyesuaian Sistem (Kode Unik QRIS)" yang
    // dulu menambal selisih itu (dan hanya menambal satu arah, gejala yang
    // sama seperti bug extraDiff) tidak lagi diperlukan dan dihapus.
    validOrders.forEach(o => {
      const srcInfo = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
      const srcKey = srcInfo.key.toLowerCase()
      const isTikTok = ['tiktok', 'tiktokgo'].includes(srcKey)
      const isFoodApp = ['gofood', 'grabfood', 'shopeefood', 'generic_food_app', 'food_apps'].includes(srcKey)

      let categoryName = srcInfo.label
      const isPawoon = o.customer_name === 'Pawoon Import' || srcKey === 'pos_pawoon' || srcKey === 'pos'

      if (isPawoon) {
        const hasFA = o.order_items.some(item => item.menu_item_name.includes('FA') || item.menu_item_name.includes('FOOD APPS'))
        const hasTikTok = o.order_items.some(item => item.menu_item_name.toLowerCase().includes('tiktok'))

        if (isTikTok || hasTikTok) {
          categoryName = 'POS Pawoon (TikTok)'
        } else if (hasFA || isFoodApp) {
          categoryName = 'POS Pawoon (Food Apps)'
        } else {
          categoryName = 'POS Pawoon (Offline/Kasir)'
        }
      } else if (srcKey === 'pos_kasir') {
        categoryName = 'POS KASIR (Internal)'
      } else if (isTikTok) {
        categoryName = 'TikTok Go'
      } else if (isFoodApp) {
        categoryName = 'Food Apps (GoFood/Grab/Shopee/dll)'
      } else if (srcKey === 'online') {
        categoryName = 'Website Online'
      } else if (srcKey === 'tiktok_shop' || srcKey.includes('tiktokshop')) {
        categoryName = 'TikTok Shop (Online)'
      } else if (srcKey === 'shopee_shop' || srcKey.includes('shopeeseller')) {
        categoryName = 'Shopee Shop (Online)'
      }

      const outletType = outletTypeMap.get(o.outlet_id)

      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = { categoryName, grossRevenue: 0, itemMap: {} }
      }

      const catData = categoryMap[categoryName]

      const disc = Number((o as any).discount_amount) || 0
      const promo = Number((o as any).promo_subsidy) || 0
      const orderGross = Number(o.total_amount) + disc + promo
      const orderItemsGross = (o.order_items || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)

      if (o.order_items && o.order_items.length > 0) {
        o.order_items.forEach(oi => {
          const key = cleanItemName(oi.menu_item_name)
          if (!catData.itemMap[key]) {
            catData.itemMap[key] = {
              name: key,
              qty: 0,
              revenue: 0,
              hppTotal: 0,
              unitPrice: oi.unit_price || (oi.subtotal / oi.quantity) || 0
            }
          }

          const menuItem = oi.menu_items || (oi.menu_item_id ? menuItemByIdMap.get(oi.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(oi.menu_item_name))
          const hppPerUnit = getItemHpp(menuItem, outletType, oi.menu_item_name, menuItemByNameMap, o.channel || o.sales_source, oi.menu_item_id, menuItemByIdMap)
          const itemRevenue = orderItemsGross > 0 ? (Number(oi.subtotal) / orderItemsGross) * orderGross : 0

          catData.itemMap[key].qty += oi.quantity
          catData.itemMap[key].revenue += itemRevenue
          catData.itemMap[key].hppTotal += (hppPerUnit * oi.quantity)
          catData.grossRevenue += itemRevenue
        })
      } else if (orderGross > 0) {
        const key = `Order #${o.order_number} (${o.customer_name || 'Pelanggan'})`
        if (!catData.itemMap[key]) {
          catData.itemMap[key] = {
            name: key,
            qty: 0,
            revenue: 0,
            hppTotal: 0,
            unitPrice: orderGross
          }
        }
        catData.itemMap[key].qty += 1
        catData.itemMap[key].revenue += orderGross
        catData.grossRevenue += orderGross
      }
    })

    // 3. Ubah ke array dan sort
    const categories = Object.values(categoryMap).map(cat => ({
      categoryName: cat.categoryName,
      grossRevenue: cat.grossRevenue,
      totalQty: Object.values(cat.itemMap).reduce((acc, item) => acc + item.qty, 0),
      totalHpp: Object.values(cat.itemMap).reduce((acc, item) => acc + item.hppTotal, 0),
      bestSellers: Object.values(cat.itemMap).sort((a, b) => b.qty - a.qty)
    }))

    // Sort kategori: POS Kasir di atas, sisanya berdasarkan revenue
    categories.sort((a, b) => {
      const aIsKasir = a.categoryName.toLowerCase().includes('kasir')
      const bIsKasir = b.categoryName.toLowerCase().includes('kasir')
      if (aIsKasir && !bIsKasir) return -1
      if (!aIsKasir && bIsKasir) return 1
      return b.grossRevenue - a.grossRevenue
    })

    await generateCategorizedReportPDF({
      outletName: selectedOutletName,
      dateRangeLabel: dateRangeText,
      categories
    })
  }

  const downloadCSVAllChannels = () => {
    // 1. Gunakan filteredOrders agar sesuai dengan filter channel yang aktif di UI
    const filteredForCSV = selectedChannels.includes('all') 
      ? orders
      : orders.filter(o => {
          const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).key.toLowerCase()
          return selectedChannels.some(target => isChannelSelected(target.toLowerCase(), o, src))
        })
    const validOrders = filteredForCSV.filter(o => o.status === 'completed' || o.status === 'settled')
    if (validOrders.length === 0) return

    let dateRangeText = RANGE_LABELS[range]
    if (range === 'custom' && (customStartDate || customEndDate)) {
      dateRangeText = `${customStartDate || 'Awal'} s/d ${customEndDate || 'Sekarang'}`
    }

    // 2. Kelompokkan per channel
    const outletTypeMap = new Map<string, string>()
    outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))

    const categoryMap: Record<string, {
      categoryName: string,
      grossRevenue: number,
      itemMap: Record<string, { name: string; qty: number; revenue: number; hppTotal: number; adminPlatform: number; grossProfit: number; unitPrice: number }>
    }> = {}

    // "Total Revenue" per item HARUS bersumber dari rumus gross yang sama
    // dengan kartu KPI di layar (total_amount + diskon + promo per order),
    // bukan dari sekadar menjumlahkan order_items.subtotal — lihat penjelasan
    // lengkap di komentar blok PDF Kategori (fungsi downloadPDFAllChannels)
    // yang punya perbaikan identik. Grand Total di CSV sebelumnya berbeda
    // ~Rp 87 juta dari Gross Revenue di layar untuk alasan yang sama.
    validOrders.forEach(o => {
      const srcInfo = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
      const srcKey = srcInfo.key.toLowerCase()
      const isTikTok = ['tiktok', 'tiktokgo'].includes(srcKey)
      const isFoodApp = ['gofood', 'grabfood', 'shopeefood', 'generic_food_app', 'food_apps'].includes(srcKey)

      let categoryName = srcInfo.label
      const isPawoon = o.customer_name === 'Pawoon Import' || srcKey === 'pos_pawoon' || srcKey === 'pos'

      if (isPawoon) {
        const hasFA = o.order_items.some(item => item.menu_item_name.includes('FA') || item.menu_item_name.includes('FOOD APPS'))
        const hasTikTok = o.order_items.some(item => item.menu_item_name.toLowerCase().includes('tiktok'))

        if (isTikTok || hasTikTok) {
          categoryName = 'POS Pawoon (TikTok)'
        } else if (hasFA || isFoodApp) {
          categoryName = 'POS Pawoon (Food Apps)'
        } else {
          categoryName = 'POS Pawoon (Offline/Kasir)'
        }
      } else if (srcKey === 'pos_kasir') {
        categoryName = 'POS KASIR (Internal)'
      } else if (isTikTok) {
        categoryName = 'TikTok Go'
      } else if (isFoodApp) {
        categoryName = 'Food Apps (GoFood/Grab/Shopee/dll)'
      } else if (srcKey === 'online') {
        categoryName = 'Website Online'
      } else if (srcKey === 'tiktok_shop' || srcKey.includes('tiktokshop')) {
        categoryName = 'TikTok Shop (Online)'
      } else if (srcKey === 'shopee_shop' || srcKey.includes('shopeeseller')) {
        categoryName = 'Shopee Shop (Online)'
      }

      const outletType = outletTypeMap.get(o.outlet_id)

      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = { categoryName, grossRevenue: 0, itemMap: {} }
      }

      const catData = categoryMap[categoryName]

      // Rumus SAMA dengan kartu KPI di layar dan blok PDF Kategori.
      const disc = Number((o as any).discount_amount) || 0
      const promo = Number((o as any).promo_subsidy) || 0
      const orderGross = Number(o.total_amount) + disc + promo
      const orderTotalDeductions = disc + promo
      // Pembagi untuk membagi gross & potongan pesanan secara proporsional
      // ke tiap item, berdasarkan porsi subtotal masing-masing.
      const orderItemsGross = (o.order_items || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)

      if (o.order_items && o.order_items.length > 0) {
        o.order_items.forEach(oi => {
          const key = cleanItemName(oi.menu_item_name)
          if (!catData.itemMap[key]) {
            catData.itemMap[key] = {
              name: key,
              qty: 0,
              revenue: 0,
              hppTotal: 0,
              adminPlatform: 0,
              grossProfit: 0,
              unitPrice: oi.unit_price || (oi.subtotal / oi.quantity) || 0
            }
          }

          const menuItem = oi.menu_items || (oi.menu_item_id ? menuItemByIdMap.get(oi.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(oi.menu_item_name))
          const hppPerUnit = getItemHpp(menuItem, outletType, oi.menu_item_name, menuItemByNameMap, o.channel || o.sales_source, oi.menu_item_id, menuItemByIdMap)
          const itemHpp = hppPerUnit * oi.quantity
          const itemWeight = orderItemsGross > 0 ? Number(oi.subtotal) / orderItemsGross : 0
          const itemRevenue = itemWeight * orderGross
          const itemDeduction = itemWeight * orderTotalDeductions
          const itemGrossProfit = itemRevenue - itemHpp - itemDeduction

          catData.itemMap[key].qty += oi.quantity
          catData.itemMap[key].revenue += itemRevenue
          catData.itemMap[key].hppTotal += itemHpp
          catData.itemMap[key].adminPlatform += itemDeduction
          catData.itemMap[key].grossProfit += itemGrossProfit

          catData.grossRevenue += itemRevenue
        })
      } else if (orderGross > 0) {
        const key = `Order #${o.order_number} (${o.customer_name || 'Pelanggan'})`
        if (!catData.itemMap[key]) {
          catData.itemMap[key] = {
            name: key,
            qty: 0,
            revenue: 0,
            hppTotal: 0,
            adminPlatform: 0,
            grossProfit: 0,
            unitPrice: orderGross
          }
        }
        const itemDeduction = orderTotalDeductions
        const itemGrossProfit = orderGross - itemDeduction

        catData.itemMap[key].qty += 1
        catData.itemMap[key].revenue += orderGross
        catData.itemMap[key].adminPlatform += itemDeduction
        catData.itemMap[key].grossProfit += itemGrossProfit

        catData.grossRevenue += orderGross
      }
    })

    const categories = Object.values(categoryMap).map(cat => ({
      categoryName: cat.categoryName,
      grossRevenue: cat.grossRevenue,
      totalQty: Object.values(cat.itemMap).reduce((acc, item) => acc + item.qty, 0),
      totalHpp: Object.values(cat.itemMap).reduce((acc, item) => acc + item.hppTotal, 0),
      bestSellers: Object.values(cat.itemMap).sort((a, b) => b.qty - a.qty)
    }))

    categories.sort((a, b) => {
      const aIsKasir = a.categoryName.toLowerCase().includes('kasir')
      const bIsKasir = b.categoryName.toLowerCase().includes('kasir')
      if (aIsKasir && !bIsKasir) return -1
      if (!aIsKasir && bIsKasir) return 1
      return b.grossRevenue - a.grossRevenue
    })

    // Build CSV content with Admin Platform and Gross Profit
    let csvContent = "Kategori/Channel,Nama Menu / Item,Harga Jual,HPP,Qty,Total HPP,Total Revenue,Admin Platform,Gross Profit\n";
    categories.forEach(cat => {
      cat.bestSellers.forEach(item => {
        const catName = `"${cat.categoryName.replace(/"/g, '""')}"`
        const itemName = `"${item.name.replace(/"/g, '""')}"`
        const hargaJual = item.unitPrice || (item.qty > 0 ? item.revenue / item.qty : 0)
        const hppSatuan = item.qty > 0 ? item.hppTotal / item.qty : 0
        const adminPlatform = Math.round(item.adminPlatform || 0)
        const grossProfit = Math.round(item.grossProfit || (item.revenue - item.hppTotal - adminPlatform))
        csvContent += `${catName},${itemName},${hargaJual},${hppSatuan},${item.qty},${item.hppTotal},${item.revenue},${adminPlatform},${grossProfit}\n`
      })
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const channelSuffix = selectedChannels.includes('all') ? 'Semua_Channel' : selectedChannels.join('_').replace(/[^a-zA-Z0-9]/g, '_')
    link.setAttribute('download', `Laporan_${channelSuffix}_${selectedOutletName}_${dateRangeText}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 pb-12 animate-fade-in" id="report-content">

      {/* â”€â”€ Header Web (Hidden on Print) â”€â”€ */}
      <div className="no-print flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <FileText className="w-7 h-7 text-amber-500" />
              Laporan & Analitik Detail
            </h1>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              Menampilkan data untuk: <strong className="text-gray-900">{selectedOutletName}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {initialOutlets.length > 1 && (
              <MultiSelectDropdown
                icon={Store}
                  options={[
                  { id: 'ss-online', name: 'SS Online (Semua Channel)' },
                  ...physicalOutlets.map(o => ({ id: o.id, name: o.name }))
                ]}
                selectedIds={branchFilterValue}
                onChange={setSelectedOutlets}
                allLabel="Semua Cabang"
              />
            )}

            <MultiSelectDropdown
              options={
                isSSOnlineSelected
                  ? [
                      { id: 'tiktok_shop', name: 'TikTok Seller' },
                      { id: 'shopee_shop', name: 'Shopee Seller' }
                    ]
                  : [
                      { id: 'food_apps', name: 'Semua Food Apps' },
                      ...availableChannels.map(ch => ({ id: ch.key, name: ch.label }))
                    ]
              }
              selectedIds={selectedChannels}
              onChange={setSelectedChannels}
              allLabel={isSSOnlineSelected ? 'Semua Platform' : 'Semua Channel'}
            />

            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
              <button
                onClick={() => setShowRangePicker(!showRangePicker)}
                className="w-full sm:w-auto flex items-center justify-between gap-2 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  {RANGE_LABELS[range]}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showRangePicker ? 'rotate-180' : ''}`} />
              </button>

              {range === 'custom' && (
                <div className="flex flex-col sm:flex-row items-center gap-2 text-sm bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200">
                  <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full sm:w-auto bg-transparent outline-none font-medium text-gray-700"/>
                  <span className="hidden sm:inline">-</span>
                  <span className="sm:hidden text-gray-400 text-xs">sampai</span>
                  <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full sm:w-auto bg-transparent outline-none font-medium text-gray-700"/>
                </div>
              )}

              {showRangePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRangePicker(false)} />
                  <div className="absolute left-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 w-48 animate-fade-in">
                    {(Object.keys(RANGE_LABELS) as DateRangeType[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => { setRange(r); setShowRangePicker(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                          ${range === r ? 'bg-amber-50 text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        {RANGE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>



            {initialOutlets.length > 1 && (
              <>
                <button
                  onClick={downloadCSVAllChannels}
                  disabled={orders.length === 0}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Download Laporan CSV Semua Channel (Dipisah per Kategori)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">CSV (Semua Channel)</span>
                  <span className="sm:hidden">CSV</span>
                </button>

                <button
                  onClick={downloadPDFAllChannels}
                  disabled={orders.length === 0}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Download Laporan PDF Semua Channel (Dipisah per Kategori)"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF (Semua Channel)</span>
                  <span className="sm:hidden">PDF 2</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Sinkronisasi / Last Updated */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 -mt-4 mb-2 text-xs">
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
                <span>Live Realtime Â· Sinkronisasi POS: <strong>{formatLastUpdated(lastUpdated)}</strong></span>
              </span>
            )}
          </div>
          <button
            onClick={() => fetchOrders()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white hover:bg-suka-gray-50 border border-suka-gray-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Muat ulang data transaksi dari database"
          >
            <RefreshCw className={`w-3 h-3 text-suka-orange ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      

      {/* â”€â”€ Header Print (Only Visible on Print) â”€â”€ */}
      <div className="hidden print:flex bg-white py-4 mb-6 border-b-2 border-gray-900 items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-amber-500" />
            Laporan Analitik Performa
          </h1>
          <p className="text-gray-900 text-sm mt-2 font-bold">Generated by Enterprise POS System</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-1">Informasi Laporan</p>
          <p className="text-base font-bold text-gray-900">Cabang: <span className="text-gray-900">{selectedOutletName}</span></p>
          <p className="text-sm font-bold text-gray-900">Periode: {RANGE_LABELS[range]}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
          {[1,2,3].map(i => <div key={i} className="card h-28 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <>
          {/* â”€â”€ KPI Cards (Gross Revenue, Total COGS, Admin Platform, Gross Profit) â”€â”€ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 xl:gap-5">
            {/* 1. Gross Revenue â€” omzet SEBELUM potongan (net + promo/diskon). */}
            <div className="bg-gradient-to-br from-amber-400 to-amber-600 text-white p-5 sm:p-6 rounded-3xl shadow-lg shadow-amber-500/20 relative overflow-hidden flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-bold text-white/90 uppercase tracking-widest mb-1.5">Gross Revenue</p>
                <p className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black mt-1 tracking-tight leading-tight tabular-nums">{formatRupiah(analytics.grossRevenue)}</p>
                <p className="text-[11px] text-white/80 mt-2.5 font-medium leading-relaxed">
                  {isSSOnlineSelected
                    ? 'Total omset produk (Subtotal setelah diskon penjual)'
                    : 'Total nilai omzet kotor sebelum diskon & subsidi'}
                </p>
              </div>
            </div>

            {/* 2. Total COGS */}
            <div className="bg-gradient-to-br from-rose-400 to-rose-600 text-white p-5 sm:p-6 rounded-3xl shadow-lg shadow-rose-500/20 relative overflow-hidden flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-bold text-white/90 uppercase tracking-widest mb-1.5">Total COGS</p>
                <p className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black mt-1 tracking-tight leading-tight tabular-nums">{formatRupiah(analytics.totalHPP)}</p>
                <p className="text-[11px] text-white/80 mt-2.5 font-medium leading-relaxed">
                  {isSSOnlineSelected
                    ? 'Modal bahan dasar (Tarif HPP khusus SS Online)'
                    : 'Total beban modal bahan dasar (HPP Resep)'}
                </p>
              </div>
            </div>

            {/* 3. Admin Platform */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-5 sm:p-6 rounded-3xl shadow-lg shadow-blue-500/20 relative overflow-hidden flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-bold text-white/90 uppercase tracking-widest mb-1.5">
                  {isSSOnlineSelected ? 'Beban Biaya Platform (P&L)' : 'Admin Platform & Promo'}
                </p>
                <p className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black mt-1 tracking-tight leading-tight tabular-nums">{formatRupiah(analytics.totalDeductions)}</p>
                <p className="text-[11px] text-white/80 mt-2.5 font-medium leading-relaxed">
                  {isSSOnlineSelected
                    ? 'Komisi Platform, Dinamis, Cashback, Admin Order, Logistik, Afiliasi & PPh 22 (Pengurang Laba Kotor)'
                    : 'Potongan diskon promo & subsidi food apps'}
                </p>
              </div>
            </div>

            {/* 4. Gross Profit */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 sm:p-6 rounded-3xl shadow-lg shadow-emerald-500/20 relative overflow-hidden flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-bold text-white/90 uppercase tracking-widest mb-1.5">Gross Profit</p>
                <p className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black mt-1 tracking-tight leading-tight tabular-nums">{formatRupiah(analytics.grossProfit)}</p>
                <p className="text-[11px] text-white/80 mt-2.5 font-medium leading-relaxed">
                  Gross Revenue - (COGS + Admin Platform)
                </p>
              </div>
            </div>
          </div>

          {(isSSOnlineSelected || selectedChannels.includes('tiktokgo') || selectedChannels.includes('tiktok')) && (
            <>
              <div className="my-8 border-t border-gray-200 dark:border-gray-700/50" />
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-500" />
                  Rekonsiliasi Settlement
                </h2>
                <p className="text-sm text-gray-500">Data ini ditarik dari hasil rekonsiliasi pembayaran platform.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:gap-5">
                {/* 5. Settlement (Conditional) */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-5 sm:p-6 rounded-3xl shadow-lg shadow-indigo-500/20 relative overflow-hidden flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
                  <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                  <div className="relative z-10">
                    <p className="text-xs font-bold text-white/90 uppercase tracking-widest mb-1.5">
                      {isSSOnlineSelected ? 'Total Settlement (Uang Cair)' : 'Total Settlement'}
                    </p>
                    <p className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black mt-1 tracking-tight leading-tight tabular-nums">{formatRupiah(analytics.totalSettlement)}</p>
                    <p className="text-xs text-white/70 mt-2 mb-3 leading-relaxed">
                      {isSSOnlineSelected
                        ? 'Uang Bersih yang Masuk ke Saldo Toko / Rekening Bank (Omset - Potongan Kas)'
                        : 'Omzet Kotor - Promo Merchant - (Platform comm. + Creator comm. + WHT)'}
                    </p>
                    {analytics.settlementDateRange && (
                      <p className="text-xs text-white/80 font-medium flex items-center gap-1.5 bg-white/10 w-fit px-2.5 py-1 rounded-full">
                        <Calendar className="w-3.5 h-3.5" />
                        {analytics.settlementDateRange}
                      </p>
                    )}
                  </div>
                </div>

                {/* 6. Admin Settlement (Conditional) */}
                {!isSSOnlineSelected && (
                  <div className="bg-gradient-to-br from-violet-500 to-violet-700 text-white p-5 sm:p-6 rounded-3xl shadow-lg shadow-violet-500/20 relative overflow-hidden flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative z-10">
                      <p className="text-xs font-bold text-white/90 uppercase tracking-widest mb-1.5">
                        Admin Settlement
                      </p>
                      <p className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black mt-1 tracking-tight leading-tight tabular-nums">{formatRupiah(analytics.totalRealAdmin)}</p>
                      <p className="text-xs text-white/70 mt-2 mb-3 leading-relaxed">
                        Platform commission + Creator commission + WHT
                      </p>
                      {analytics.settlementDateRange && (
                        <p className="text-xs text-white/80 font-medium flex items-center gap-1.5 bg-white/10 w-fit px-2.5 py-1 rounded-full">
                          <Calendar className="w-3.5 h-3.5" />
                          {analytics.settlementDateRange}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Success vs Failure Rate */}
            <div className="card bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Status Transaksi</h2>
              <p className="text-gray-400 print-dark-text text-xs mb-5">Pesanan Lunas vs Batal</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Selesai</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Pembayaran sukses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700 text-lg">{analytics.completedOrders.length}</p>
                    <p className="text-[10px] font-bold text-emerald-600">{analytics.successRate}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-red-500" />
                    <div>
                      <p className="text-sm font-bold text-red-800">Dibatalkan</p>
                      <p className="text-[10px] text-red-600 font-medium">Kadaluarsa / Batal Kasir</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-700 text-lg">{analytics.cancelledCount}</p>
                    <p className="text-[10px] font-bold text-red-600">{100 - analytics.successRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Items Sold */}
            <div className="card bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg mb-1">Kinerja Penjualan</h2>
                  <p className="text-gray-400 print-dark-text text-xs">Total item produk terjual</p>
                </div>
                <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              
              <div className="flex-1 flex flex-col justify-center items-center py-8 mt-2 bg-gradient-to-b from-gray-50/50 to-white rounded-2xl border border-gray-100/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]">
                <span className="text-[5.5rem] leading-none font-black text-gray-900 tracking-tighter drop-shadow-sm mb-2">
                  {analytics.categoryData.reduce((sum, item) => sum + item.value, 0)}
                </span>
                <span className="text-amber-500 font-bold uppercase tracking-[0.2em] text-[10px] bg-amber-50 px-3 py-1 rounded-full">
                  Item Terjual
                </span>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="card bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Distribusi Pembayaran</h2>
              <p className="text-gray-400 print-dark-text text-xs mb-5">Rincian per metode bayar</p>

              {Object.keys(analytics.paymentBreakdown).length === 0 ? (
                <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                  Belum ada data
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(analytics.paymentBreakdown)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([method, data]) => {
                      const meta = PAYMENT_META[method] || PAYMENT_META.unknown
                      const Icon = meta.icon
                      const pct = analytics.totalOrders > 0 ? Math.round((data.count / analytics.totalOrders) * 100) : 0
                      return (
                        <div key={method}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 ${meta.bg} rounded-xl flex items-center justify-center`}>
                                <Icon className="w-4 h-4" style={{ color: meta.color }} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-800">{meta.label}</p>
                                <p className="text-[10px] text-gray-400">{data.count} pesanan</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">{pct}%</p>
                              <p className="text-[10px] text-gray-400">{formatRupiah(data.revenue)}</p>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: meta.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* â”€â”€ Best Sellers â”€â”€ */}
            <div className="card bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80">
              <div className="flex items-center gap-2 mb-5">
                <Award className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-gray-900 text-lg">Item Yang Terjual</h2>
              </div>

              {analytics.bestSellers.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">Belum ada data penjualan</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {analytics.bestSellers.map((item, idx) => {
                    const maxQty = analytics.bestSellers[0].qty
                    const pct = (item.qty / maxQty) * 100
                    const medals = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰']
                    return (
                      <div key={item.name} className="group">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="w-6 text-center text-sm">
                            {idx < 3 ? medals[idx] : <span className="text-gray-400 font-bold text-xs">#{idx + 1}</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                <span className="text-xs text-gray-500 font-medium">{item.qty} terjual</span>
                                <span className="text-xs font-bold text-gray-900">{formatRupiah(item.revenue)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          

          
          {/* Advanced Data Table Transaksi */}
          <div className="card bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80 mt-6 overflow-hidden no-print">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b border-gray-100/80 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-gray-900 text-lg">Histori Transaksi Detail</h2>
                  {!selectedChannels.includes('all') && (
                    <button
                      type="button"
                      onClick={() => { setSelectedChannels(['all']); setCurrentPage(1); }}
                      className="inline-flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-2.5 py-1 rounded-full transition-all shadow-xs cursor-pointer"
                      title="Klik untuk hapus filter sumber"
                    >
                      <span>Sumber: <strong className="font-bold">{selectedChannels.map(ch => ch === 'food_apps' ? 'Semua Food Apps' : (isSSOnlineSelected ? (ch === 'tiktok_shop' ? 'TikTok Seller' : ch === 'shopee_shop' ? 'Shopee Seller' : ch) : (availableChannels.find(c => c.key === ch)?.label || ch))).join(', ')}</strong></span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isSSOnlineSelected && selectedPaymentMethod !== 'all' && (
                    <button
                      type="button"
                      onClick={() => { setSelectedPaymentMethod('all'); setCurrentPage(1); }}
                      className="inline-flex items-center gap-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold px-2.5 py-1 rounded-full transition-all shadow-xs cursor-pointer"
                      title="Klik untuk hapus filter metode bayar"
                    >
                      <span>Metode: <strong className="font-bold">{availablePaymentMethods.find(m => m.key === selectedPaymentMethod)?.label || selectedPaymentMethod.toUpperCase()}</strong></span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-0.5">
                  {selectedChannels.includes('all') && selectedPaymentMethod === 'all'
                    ? 'Semua transaksi sukses pada periode ini' 
                    : `Menampilkan transaksi terfilter (${filteredTableData.length} transaksi)`}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Dropdown Select Sumber */}
                <div className="relative flex-1 sm:flex-none min-w-[180px]">
                  <MultiSelectDropdown
                    options={
                      isSSOnlineSelected
                        ? [
                            { id: 'tiktok_shop', name: 'TikTok Seller' },
                            { id: 'shopee_shop', name: 'Shopee Seller' }
                          ]
                        : [
                            { id: 'food_apps', name: 'Semua Food Apps' },
                            ...availableChannels.map(ch => ({ id: ch.key, name: ch.label }))
                          ]
                    }
                    selectedIds={selectedChannels}
                    onChange={(ids) => {
                      setSelectedChannels(ids)
                      setCurrentPage(1)
                    }}
                    allLabel="Semua Sumber"
                    className="w-full"
                  />
                </div>

                {/* Dropdown Select Metode Bayar (Disembunyikan jika filter SS Online aktif) */}
                {!isSSOnlineSelected && (
                  <div className="relative flex-1 sm:flex-none min-w-[160px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Wallet className="h-4 w-4 text-blue-500" />
                    </div>
                    <select
                      value={selectedPaymentMethod}
                      onChange={(e) => {
                        setSelectedPaymentMethod(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="block w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm cursor-pointer shadow-2xs"
                    >
                      <option value="all">Semua Metode Bayar</option>
                      {availablePaymentMethods.map(pm => (
                        <option key={pm.key} value={pm.key}>{pm.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Input Cari */}
                <div className="relative flex-1 sm:flex-none min-w-[180px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm font-medium shadow-2xs"
                    placeholder="Cari no antrian / nama / item..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4">No. Antrian</th>
                    <th className="px-5 py-4">Waktu</th>
                    <th className="px-5 py-4">Nama</th>
                    <th className="px-5 py-4">Nama Item</th>
                    {!isSSOnlineSelected && <th className="px-5 py-4">Paket / Combo</th>}
                    <th className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span>Sumber</span>
                        <Filter className={`w-3.5 h-3.5 ${!selectedChannels.includes('all') ? 'text-amber-600' : 'text-gray-400 opacity-50'}`} />
                      </div>
                    </th>
                    {!isSSOnlineSelected && (
                      <th className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span>Metode Bayar</span>
                          <Filter className={`w-3.5 h-3.5 ${selectedPaymentMethod !== 'all' ? 'text-blue-600' : 'text-gray-400 opacity-50'}`} />
                        </div>
                      </th>
                    )}
                    <th className="px-5 py-4 text-right">Total Transaksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={isSSOnlineSelected ? 6 : 8} className="px-5 py-10 text-center text-gray-400 font-medium">Data tidak ditemukan</td>
                    </tr>
                  ) : (
                    paginatedData.map((order) => {
                      const orderSubtotal = order.order_items.reduce((sum, i) => sum + (Number(i.subtotal) || (Number(i.quantity) * Number(i.unit_price)) || 0), 0);
                      const offlineDiscount = Number((order as any).discount_amount) || 0;
                      const appSubsidy = Number((order as any).promo_subsidy) || 0;
                      const isEcommerce = order.outlet_id === 'ss-online' || isSSOnlineSelected;
                      const itemPromoDiscount = orderSubtotal > Number(order.total_amount) ? (orderSubtotal - Number(order.total_amount)) : 0;
                      const pkgs = extractOrderPackages(order);
                      const rewardItem = order.order_items.find(i => i.is_promo_reward)
                      const buyOneGetOneName = rewardItem?.promo_name
                      
                      return (
                        <tr key={order.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="px-5 py-4 font-bold text-gray-900">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md">#{order.order_number || 'ECOM'}</span>
                              <ScheduledPromoBadge names={order.scheduled_promo_names} />
                              {buyOneGetOneName && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md text-[10px] font-bold">BUY {rewardItem?.promo_buy_quantity ?? 1} GET {rewardItem?.promo_get_quantity ?? 1}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-500 font-medium text-xs">
                            {new Date(order.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-5 py-4 font-semibold text-gray-800 text-xs">
                            <div className="flex flex-col gap-1.5 items-start">
                              {order.customer_name ? (
                                <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded-md border border-gray-200/60 inline-block font-medium">{order.customer_name}</span>
                              ) : (
                                <span className="text-gray-400 font-normal italic">-</span>
                              )}
                              {order.cashier_name && (
                                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200/60 font-medium text-[10px] uppercase tracking-wider">
                                  Kasir: {order.cashier_name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-600 font-medium">
                            <div className="flex flex-col gap-1.5">
                              {order.order_items.map((i, idx) => (
                                <div key={idx} className="whitespace-normal leading-tight text-[13px] flex items-start gap-1.5">
                                  <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">{i.quantity}x</span> 
                                  <span className={i.is_promo_reward ? 'text-emerald-700 font-semibold' : ''}>
                                    {i.is_promo_reward ? `Gratis Â· ${cleanItemName(i.menu_item_name)}` : cleanItemName(i.menu_item_name)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          {!isSSOnlineSelected && (
                            <td className="px-5 py-4 font-medium text-gray-700">
                              {pkgs.length === 0 ? (
                                <span className="text-gray-400 font-normal italic">-</span>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {pkgs.map((pkg, idx) => (
                                    <div key={idx} className="flex flex-col gap-0.5">
                                      <div className="inline-flex items-center gap-1.5 whitespace-normal leading-tight text-[12px]">
                                        <span className="font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
                                          {pkg.qty}x
                                        </span>
                                        <span className="font-semibold text-amber-950 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                                          {pkg.name}
                                        </span>
                                      </div>
                                      {pkg.choices && Object.keys(pkg.choices).length > 0 && (
                                        <div className="pl-6 flex flex-wrap gap-1 text-[10px] text-gray-500 mt-0.5">
                                          {Object.entries(pkg.choices).map(([k, v]) => (
                                            <span key={k} className="bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded border border-gray-200/50">
                                              {k}: <strong className="text-gray-800">{v}</strong>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => {
                                const srcKey = resolveOrderSource(order.channel, order.sales_source, order.customer_name, order.is_endorse).key
                                setSelectedChannels(prev => prev.includes(srcKey) ? (prev.length === 1 ? ['all'] : prev.filter(x => x !== srcKey)) : [...prev.filter(x => x !== 'all'), srcKey])
                                setCurrentPage(1)
                              }}
                              className="hover:scale-105 active:scale-95 transition-all text-left inline-flex focus:outline-none cursor-pointer"
                              title="Klik untuk memfilter transaksi berdasarkan sumber ini"
                            >
                              <OrderSourceBadge channel={order.channel} salesSource={order.sales_source} customerName={order.customer_name} isEndorse={order.is_endorse} size="sm" />
                            </button>
                          </td>
                          {!isSSOnlineSelected && (
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => {
                                  const pm = (order.payment_method || 'unknown').toLowerCase()
                                  setSelectedPaymentMethod(prev => prev === pm ? 'all' : pm)
                                  setCurrentPage(1)
                                }}
                                className="hover:scale-105 active:scale-95 transition-all text-left inline-flex focus:outline-none cursor-pointer"
                                title="Klik untuk memfilter transaksi berdasarkan metode bayar ini"
                              >
                                <span className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 text-[10px] font-bold rounded-lg uppercase transition-colors">
                                  {order.payment_method || '-'}
                                </span>
                              </button>
                            </td>
                          )}
                          <td className="px-5 py-4 text-right">
                            {isEcommerce ? (
                              <>
                                {orderSubtotal > Number(order.total_amount) && (
                                  <div className="text-gray-400 text-[11px] font-medium line-through mb-0.5" title="Harga awal sebelum diskon">
                                    {formatRupiah(orderSubtotal)}
                                  </div>
                                )}
                                <div className="font-bold text-gray-900 text-base">{formatRupiah(order.total_amount)}</div>
                                {itemPromoDiscount > 0 && (
                                  <div className="text-[11px] font-medium text-red-500 mt-1">
                                    (Diskon: -{formatRupiah(itemPromoDiscount)})
                                  </div>
                                )}
                                {offlineDiscount > 0 && (
                                  <div className="text-[11px] font-medium text-orange-600 mt-1">
                                    (Biaya Platform: -{formatRupiah(offlineDiscount)})
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {offlineDiscount > 0 && (
                                  <div className="text-gray-400 text-[11px] font-medium line-through mb-0.5" title="Harga awal sebelum diskon">
                                    {formatRupiah(Number(order.total_amount) + offlineDiscount)}
                                  </div>
                                )}
                                <div className="font-bold text-gray-900 text-base">{formatRupiah(order.total_amount)}</div>
                                {offlineDiscount > 0 && (
                                  <div className="text-[11px] font-medium text-red-500 mt-1">
                                    (Diskon: -{formatRupiah(offlineDiscount)})
                                  </div>
                                )}
                                {appSubsidy > 0 && (
                                  <div className="text-[11px] font-medium text-orange-600 mt-1">
                                    (Subsidi App: -{formatRupiah(appSubsidy)})
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="bg-amber-50/50">
                  {(() => {
                    const totalGross = filteredTableData.reduce((acc, curr) => {
                      const itemSub = curr.order_items.reduce((sum, item) => sum + (Number(item.subtotal) || (Number(item.quantity) * Number(item.unit_price)) || 0), 0);
                      return acc + (itemSub > 0 ? itemSub : (Number(curr.total_amount) + (Number((curr as any).discount_amount) || 0)));
                    }, 0);
                    const totalNet = filteredTableData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
                    const totalOfflineDiscount = filteredTableData.reduce((acc, curr) => acc + (Number((curr as any).discount_amount) || 0), 0);
                    const totalAppSubsidy = filteredTableData.reduce((acc, curr) => acc + (Number((curr as any).promo_subsidy) || 0), 0);
                    const totalEcommerceDiscount = Math.max(0, totalGross - totalNet);
                    const totalItems = filteredTableData.reduce((acc, curr) => {
                      return acc + curr.order_items.reduce((sum, item) => sum + item.quantity, 0);
                    }, 0);
                    
                    return (
                      <>
                        <tr className="border-t border-amber-200">
                          <td colSpan={isSSOnlineSelected ? 4 : 6} className="px-5 py-3 text-right uppercase tracking-wider text-xs font-bold text-amber-900">
                            Total Harga Kotor
                          </td>
                          <td className="px-5 py-3 text-left">
                            <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                              {totalItems} Item
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-bold text-amber-800">
                            {formatRupiah(totalGross)}
                          </td>
                        </tr>
                        {isSSOnlineSelected ? (
                          <>
                            {totalEcommerceDiscount > 0 && (
                              <tr>
                                <td colSpan={5} className="px-5 py-3 text-right uppercase tracking-wider text-xs font-bold text-red-600">
                                  Potongan Promo / Diskon Produk
                                </td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-red-600 whitespace-nowrap">
                                  - {formatRupiah(totalEcommerceDiscount)}
                                </td>
                              </tr>
                            )}
                            {totalOfflineDiscount > 0 && (
                              <tr>
                                <td colSpan={5} className="px-5 py-3 text-right uppercase tracking-wider text-xs font-bold text-orange-600">
                                  Biaya Admin & Komisi Platform
                                </td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-orange-600 whitespace-nowrap">
                                  - {formatRupiah(totalOfflineDiscount)}
                                </td>
                              </tr>
                            )}
                          </>
                        ) : (
                          <>
                            {totalOfflineDiscount > 0 && (
                              <tr>
                                <td colSpan={7} className="px-5 py-3 text-right uppercase tracking-wider text-xs font-bold text-red-600">
                                  Potongan Diskon Promo Offline
                                </td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-red-600 whitespace-nowrap">
                                  - {formatRupiah(totalOfflineDiscount)}
                                </td>
                              </tr>
                            )}
                            {totalAppSubsidy > 0 && (
                              <tr>
                                <td colSpan={7} className="px-5 py-3 text-right uppercase tracking-wider text-xs font-bold text-orange-600">
                                  Total Subsidi Promo Food Apps
                                </td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-orange-600 whitespace-nowrap">
                                  - {formatRupiah(totalAppSubsidy)}
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs font-medium text-gray-400">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredTableData.length)} dari {filteredTableData.length}
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Sebelumnya
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Rekap Rincian Item Terjual & Laporan Laci Cash (Hanya Admin) */}
          {initialOutlets.length > 1 && (
            <>
              {/* Rekap Rincian Item Terjual */}
              <div className="card bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80 mt-6 overflow-hidden no-print">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Rekap Rincian Item Terjual</h2>
                <p className="text-gray-400 text-xs mt-0.5">Ringkasan total kuantitas per item berdasarkan sumber pesanan</p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm font-medium"
                    placeholder="Cari item..."
                    value={itemBreakdownSearch}
                    onChange={(e) => { setItemBreakdownSearch(e.target.value); setItemBreakdownPage(1); }}
                  />
                </div>
                <select
                  value={itemBreakdownFilter}
                  onChange={e => { setItemBreakdownFilter(e.target.value); setItemBreakdownPage(1); }}
                  className="w-full sm:w-auto bg-white border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm outline-none cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="OFFLINE">OFFLINE (POS PAWOON)</option>
                  <option value="FOOD APPS">FOOD APPS (GrabFood/GoFood/Shopee)</option>
                  <option value="TIKTOK">TIKTOK</option>
                  <option value="WEB ONLINE">WEB ONLINE</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100 select-none">
                  <tr>
                    <th 
                      className="px-5 py-4 cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Nama Item {renderItemBreakdownSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="px-5 py-4 cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('groupLabel')}
                    >
                      <div className="flex items-center gap-2">
                        Sumber Pesanan {renderItemBreakdownSortIcon('groupLabel')}
                      </div>
                    </th>
                    <th 
                      className="px-5 py-4 text-center cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('qty')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Total Qty Terjual {renderItemBreakdownSortIcon('qty')}
                      </div>
                    </th>
                    <th className="px-5 py-4 text-right cursor-default">
                      <div className="flex items-center justify-end gap-2">
                        HPP / Unit
                      </div>
                    </th>
                    <th className="px-5 py-4 text-right cursor-default">
                      <div className="flex items-center justify-end gap-2">
                        Total HPP
                      </div>
                    </th>
                    <th 
                      className="px-5 py-4 text-right cursor-pointer hover:bg-gray-200 transition-colors group"
                      onClick={() => toggleItemBreakdownSort('grossRevenue')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Total Pendapatan {renderItemBreakdownSortIcon('grossRevenue')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedItemBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-gray-400 font-medium">Data tidak ditemukan</td>
                    </tr>
                  ) : (
                    paginatedItemBreakdown.map((item, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                          <td className="px-5 py-4 font-bold text-gray-900 uppercase">
                            {item.groupLabel} {item.name}
                          </td>
                          <td className="px-5 py-4 uppercase text-gray-500 font-bold text-xs">
                            {item.groupLabel}
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-gray-900">
                            {item.qty}
                          </td>
                          <td className="px-5 py-4 text-right font-medium text-rose-600">
                            {formatRupiah(item.hppPerUnit)}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-rose-700">
                            {formatRupiah(item.totalHpp)}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-gray-900">
                            {formatRupiah(item.grossRevenue)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {filteredItemBreakdownData.length > 0 && (
                  <tfoot className="bg-amber-50/50 font-bold text-gray-900 border-t border-amber-200">
                    <tr>
                      <td colSpan={2} className="px-5 py-3 text-right uppercase tracking-wider text-xs text-amber-800">
                        Total Harga Kotor
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-xs">
                          {filteredItemBreakdownData.reduce((acc, curr) => acc + curr.qty, 0)} Item
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-base text-rose-700 col-span-2" colSpan={2}>
                        {formatRupiah(filteredItemBreakdownData.reduce((acc, curr) => acc + curr.totalHpp, 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-base text-amber-700">
                        {formatRupiah(filteredItemBreakdownData.reduce((acc, curr) => acc + curr.grossRevenue, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            
            {totalItemBreakdownPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs font-medium text-gray-400">
                  Menampilkan {((itemBreakdownPage - 1) * itemsPerPage) + 1} - {Math.min(itemBreakdownPage * itemsPerPage, filteredItemBreakdownData.length)} dari {filteredItemBreakdownData.length}
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setItemBreakdownPage(p => Math.max(1, p - 1))}
                    disabled={itemBreakdownPage === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Sebelumnya
                  </button>
                  <button 
                    onClick={() => setItemBreakdownPage(p => Math.min(totalItemBreakdownPages, p + 1))}
                    disabled={itemBreakdownPage === totalItemBreakdownPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
          
          
          {/* Laporan Tutup Shift */}
          {!selectedOutlets.includes('ss-online') && (
            <div className="card bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100/80 mt-6 overflow-hidden no-print">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Laporan Laci Cash</h2>
              <p className="text-gray-400 text-xs mt-0.5 mb-6">Rekonsiliasi kas laci dan petty cash (uang operasional)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedOutlets.includes('all') || selectedOutlets.length !== 1 ? (
                <div className="col-span-full p-10 text-center bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-amber-700 font-medium">Silakan pilih 1 spesifik outlet di filter atas untuk melihat Laporan Laci Cash (Petty Cash).</p>
                </div>
              ) : shifts.length === 0 ? (
                <div className="col-span-full p-10 text-center bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-gray-400 font-medium">Data shift tidak ditemukan</p>
                </div>
              ) : (
                shifts.map((shift) => {
                  const dateStr = new Date(shift.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  const startTimeStr = new Date(shift.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  const endTimeStr = shift.end_time ? new Date(shift.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Berjalan';
                  
                  const variance = shift.variance || 0;
                  const pcVariance = shift.petty_cash_variance || 0;
                  const outletName = initialOutlets.find(o => o.id === shift.outlet_id)?.name || 'Unknown Outlet';

                  return (
                    <div key={shift.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                      {/* Header Kartu */}
                      <div className="bg-amber-50 px-5 py-4 border-b border-amber-100 flex items-center gap-4">
                        <div className="bg-amber-100 p-2.5 rounded-lg text-amber-700">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-amber-900 text-sm mb-0.5">Shift {dateStr} - {outletName}</h3>
                          <p className="text-xs font-medium text-amber-700/80">{startTimeStr} - {endTimeStr}</p>
                        </div>
                      </div>
                      
                      {/* Body Kartu */}
                      <div className="p-5 flex-1 flex flex-col gap-4">
                        {/* Box Uang Laci */}
                        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100 flex-1">
                          <div className="flex items-center gap-2 mb-4">
                            <Wallet className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-gray-700 text-xs tracking-wider uppercase">Uang Laci (Sales)</span>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-500">Diserahkan Kasir</span>
                              <span className="font-extrabold text-gray-900 text-base">{formatRupiah(shift.actual_ending_cash)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-400">Menurut Sistem</span>
                              <span className="text-xs font-semibold text-gray-500">{formatRupiah(shift.expected_ending_cash)}</span>
                            </div>
                          </div>
                          
                          <div className="pt-3 mt-4 border-t border-gray-200/60 flex justify-between items-center">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status Uang Laci</span>
                            <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${
                              variance > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                              variance < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 
                              'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {variance > 0 ? `Lebih ${formatRupiah(variance)}` : 
                               variance < 0 ? `Kurang ${formatRupiah(Math.abs(variance))}` : 
                               'Pas (Balance)'}
                            </span>
                          </div>
                        </div>

                        {/* Box Petty Cash */}
                        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100 flex-1">
                          <div className="flex items-center gap-2 mb-4">
                            <Banknote className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-gray-700 text-xs tracking-wider uppercase">Dana Operasional</span>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-500">Sisa Uang (Fisik)</span>
                              <span className="font-extrabold text-blue-700 text-base">{formatRupiah(shift.actual_ending_petty_cash || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-400">Menurut Sistem</span>
                              <span className="text-xs font-semibold text-gray-500">{formatRupiah(shift.expected_ending_petty_cash || 0)}</span>
                            </div>
                          </div>
                          
                          <div className="pt-3 mt-4 border-t border-gray-200/60 flex justify-between items-center">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status Operasional</span>
                            <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${
                              pcVariance > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                              pcVariance < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 
                              'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {pcVariance > 0 ? `Lebih ${formatRupiah(pcVariance)}` : 
                               pcVariance < 0 ? `Kurang ${formatRupiah(Math.abs(pcVariance))}` : 
                               'Pas (Balance)'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Footer Kartu */}
                      <div className="bg-gray-50 border-t border-gray-100 p-3 flex justify-end">
                        <button 
                          onClick={() => openShiftExpenses(shift)}
                          className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-amber-200/50"
                        >
                          <FileText className="w-4 h-4" />
                          Rincian Petty Cash
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          )}
            </>
          )}
        </>
      )}

      {selectedShiftForExpenses && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Rincian Petty Cash</h3>
                <p className="text-xs text-gray-500 mt-1">Shift: {new Date(selectedShiftForExpenses.start_time).toLocaleString('id-ID')}</p>
              </div>
              <button 
                onClick={() => setSelectedShiftForExpenses(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-gray-100">
              <button
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activePettyCashTab === 'pengeluaran' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                onClick={() => setActivePettyCashTab('pengeluaran')}
              >
                Pengeluaran
              </button>
              <button
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activePettyCashTab === 'pemasukan' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                onClick={() => setActivePettyCashTab('pemasukan')}
              >
                Pemasukan (Top Up)
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loadingShiftExpenses ? (
                <div className="flex justify-center py-10 text-gray-400">Memuat data...</div>
              ) : activePettyCashTab === 'pengeluaran' ? (
                shiftExpenses.length === 0 ? (
                  <div className="flex justify-center py-10 text-gray-400 font-medium text-sm">Tidak ada pengeluaran petty cash di shift ini.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3">Waktu</th>
                          <th className="px-4 py-3">Kategori</th>
                          <th className="px-4 py-3">Catatan</th>
                          <th className="px-4 py-3 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {shiftExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-amber-50/50">
                            <td className="px-4 py-3 text-gray-500 font-medium text-xs">
                              {new Date(exp.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-gray-700 capitalize font-medium">
                              {exp.category?.replace('_', ' ')}
                            </td>
                            <td className="px-4 py-3 text-gray-600 italic">
                              {exp.description}
                              {exp.receipt_url && (
                                <button onClick={() => setSelectedReceiptUrl(exp.receipt_url || null)} className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                  <FileText className="w-3 h-3" />
                                  Lihat Bukti
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatRupiah(exp.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-700">Total Pengeluaran</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">
                            {formatRupiah(shiftExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              ) : (
                shiftTopups.length === 0 ? (
                  <div className="flex justify-center py-10 text-gray-400 font-medium text-sm">Tidak ada top up petty cash di shift ini.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3">Waktu</th>
                          <th className="px-4 py-3">Keterangan</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {shiftTopups.map((topup) => (
                          <tr key={topup.id} className="hover:bg-amber-50/50">
                            <td className="px-4 py-3 text-gray-500 font-medium text-xs">
                              {new Date(topup.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-gray-600 italic">
                              {topup.description || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${
                                topup.status === 'approved' || topup.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                topup.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {topup.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatRupiah(topup.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-700">Total Pemasukan (Approved/Completed)</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            {formatRupiah(shiftTopups.filter(t => t.status === 'approved' || t.status === 'completed').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              )}
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedShiftForExpenses(null)}
                className="px-4 py-2 font-bold text-gray-600 hover:text-gray-900 transition-colors bg-white border border-gray-200 rounded-xl shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Image Modal */}
      {selectedReceiptUrl && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in" 
          onClick={() => setSelectedReceiptUrl(null)}
        >
          {/* Image Container */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-4 pb-24" 
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={selectedReceiptUrl} 
              alt="Bukti Pengeluaran" 
              className="max-w-full max-h-full object-contain rounded-lg" 
            />
          </div>

          {/* Close Button (Bottom Center) */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-[10000] pointer-events-none">
            <button 
              onClick={() => setSelectedReceiptUrl(null)} 
              className="pointer-events-auto bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-bold rounded-full px-8 py-3.5 backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 shadow-2xl"
            >
              <XCircle className="w-5 h-5" />
              Tutup Gambar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}









