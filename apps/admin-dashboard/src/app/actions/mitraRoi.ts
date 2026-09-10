'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { resolveMitraPolicy } from '@/lib/mitraPolicy'
import { cleanItemName } from '@/lib/order-item-name'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { getMitraAugustClosing, isAugust2026Period } from './mitraPnlClosingData'

/** 2026-08-01 00:00 WIB — awal data bagi hasil yang dihitung sistem. */
const SYSTEM_START_MONTH = '2026-08'

/** Tanggal hari ini menurut Asia/Jakarta (bukan UTC). */
function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

/** Daftar bulan `YYYY-MM` dari SYSTEM_START_MONTH s/d bulan berjalan (WIB). */
function monthsSinceSystemStart(): { key: string; from: string; to: string }[] {
  const out: { key: string; from: string; to: string }[] = []
  const last = todayWib().slice(0, 7)
  let [y, m] = SYSTEM_START_MONTH.split('-').map(Number)
  for (let guard = 0; guard < 240; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const from = `${key}-01`
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) // hari terakhir bulan itu
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
  const bepPercentage = Math.min(Math.round(roi * 10) / 10, 100)

  return {
    systemProfitMitra,
    historisProfitMitra,
    nilaiInvestasi,
    totalProfitKumulatif: totalDanaKembali,
    roi: Math.round(roi * 10) / 10,
    bepPercentage
  }
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
}

export async function getMitraRealtimeBepBreakdown(mitraOutletIds: string[]): Promise<Record<string, MitraRealtimeBepItem>> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  if (mitraOutletIds.length === 0) return {}

  const months = monthsSinceSystemStart()

  // 1. Fetch investments, profiles, transfers
  const [invRes, profRes, transfersRes] = await Promise.all([
    supabase.from('mitra_investments').select('*').in('outlet_id', mitraOutletIds),
    supabase.from('mitra_profiles').select('*'),
    supabase.from('mitra_transfers').select('*').in('outlet_id', mitraOutletIds)
  ])

  const invMap: Record<string, any> = {}
  ;(invRes.data || []).forEach(inv => {
    invMap[inv.outlet_id] = inv
  })
  const profiles = profRes.data || []
  const transfersData = transfersRes.data || []

  // Deklarasi ini sempat hilang saat refactor performa di main (3e0b1e5c):
  // `resultMap` masih dipakai di bawah, tapi tidak pernah dideklarasikan lagi,
  // sehingga fungsi ini SELALU melempar ReferenceError saat dipanggil.
  const resultMap: Record<string, MitraRealtimeBepItem> = {}

  // HPP dasar, TANPA markup mitra. Rekursi paket memakai fungsi ini juga, supaya
  // komponen tidak ter-markup lebih dulu lalu ter-markup lagi di lapisan paket.
  function getItemHppBase(menuItem: any, channel?: string | null): number {
    if (!menuItem) return 0
    let baseHpp = 0
    const normCh = channel ? channel.toLowerCase() : null
    let channelHppVal: number | null = null

    if (menuItem.channel_hpp && typeof menuItem.channel_hpp === 'object' && normCh) {
      if (
        normCh === 'ss-online' ||
        normCh === 'ss_online' ||
        normCh.includes('tiktok') ||
        normCh.includes('shopee') ||
        normCh === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' ||
        normCh === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
      ) {
        channelHppVal = menuItem.channel_hpp.ss_online ?? menuItem.channel_hpp.tiktok_shop ?? menuItem.channel_hpp.shopee_shop ?? menuItem.channel_hpp[normCh] ?? null
      } else {
        channelHppVal = menuItem.channel_hpp[normCh] ?? null
      }
    }

    if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
      baseHpp = Number(channelHppVal)
    } else if (menuItem.hpp_override !== null && menuItem.hpp_override !== undefined && Number(menuItem.hpp_override) > 0) {
      baseHpp = Number(menuItem.hpp_override)
    } else if (menuItem.is_package && Array.isArray(menuItem.package_items)) {
      baseHpp = menuItem.package_items.reduce((sum: number, pkg: any) => {
        const compHpp = pkg.component ? getItemHppBase(pkg.component, channel) : 0
        const qty = Number(pkg.quantity) || 1
        return sum + (compHpp * qty)
      }, 0)
    }
    return baseHpp
  }

  // Markup mitra 10% diterapkan SEKALI, di lapisan terluar.
  function getItemHpp(menuItem: any, outletType: string = 'mitra', channel?: string | null): number {
    const baseHpp = getItemHppBase(menuItem, channel)
    if (outletType === 'mitra' && baseHpp > 0) {
      return Math.round(baseHpp * 1.10)
    }
    return Math.round(baseHpp)
  }

  // Cadangan HPP lewat NAMA menu: jalur pemesanan web menyimpan order_items
  // tanpa `menu_item_id`, sehingga lookup lewat id menghasilkan 0 dan biaya
  // bahannya hilang. Peta ini dimuat hanya saat jalur fallback dipakai.
  let menuByName: Map<string, any> | null = null
  const hppByName = async (rawName?: string | null, channel?: string | null): Promise<number> => {
    if (!rawName) return 0
    if (!menuByName) {
      const { data: menuList } = await supabase
        .from('menu_items')
        .select('id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))')
      menuByName = new Map<string, any>()
      for (const m of menuList ?? []) {
        if (m?.name) menuByName.set(cleanItemName(m.name).trim().toLowerCase(), m)
      }
    }
    const m = menuByName.get(cleanItemName(rawName).trim().toLowerCase())
    return m ? getItemHpp(m, 'mitra', channel) : 0
  }

  // 2. Agregat PER BULAN.
  //
  // Dulu seluruh rentang (1 Agu s/d hari ini) dihitung dengan SATU kebijakan,
  // yaitu kebijakan hari ini. Akibatnya bulan-bulan sebelum cutoff September
  // ikut memakai tarif baru: bagi hasil Agustus untuk outlet bertarif legacy
  // 60% terhitung 100% plus fee 3% yang saat itu belum berlaku. Sekarang tiap
  // bulan dihitung dengan kebijakan yang benar-benar berlaku di bulan itu.
  type WindowFin = { grossRevenue: number; totalDeductions: number; totalCogs: number; opex: number; waste: number }
  const emptyFin = (): WindowFin => ({ grossRevenue: 0, totalDeductions: 0, totalCogs: 0, opex: 0, waste: 0 })

  async function aggregateMonth(from: string, to: string): Promise<Record<string, WindowFin>> {
    const acc: Record<string, WindowFin> = {}
    const bump = (oid: string) => (acc[oid] ||= emptyFin())

    const [rpcRes, pettyRows, monthlyRows, wasteRes] = await Promise.all([
      supabase.rpc('get_mitra_orders_summary', {
        p_outlet_ids: mitraOutletIds,
        p_from: `${from}T00:00:00.000+07:00`,
        p_to: `${to}T23:59:59.999+07:00`
      }),
      // OPEX WAJIB dipaginasi — PostgREST memotong di 1.000 baris tanpa error,
      // dan OPEX yang hilang membuat laba, bagi hasil, dan BEP terlalu besar.
      fetchAllPages<any>(() => supabase
        .from('petty_cash_expenses')
        .select('id, amount, outlet_id')
        .in('outlet_id', mitraOutletIds)
        .is('deleted_at', null)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('id', { ascending: true })),
      fetchAllPages<any>(() => supabase
        .from('expenses')
        .select('id, amount, outlet_id, category')
        .in('outlet_id', mitraOutletIds)
        // `type='out'` tidak pernah dipakai pengeluaran sungguhan -- akibatnya
        // pengeluaran bulanan (gaji, listrik, sewa) tak pernah ikut ke OPEX di
        // perhitungan ROI/BEP, sehingga laba & BEP terlihat lebih cepat tercapai.
        // Pengeluaran nyata bertipe 'expense'.
        .eq('type', 'expense')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('id', { ascending: true })),
      supabase.rpc('get_waste_periode', { p_from: from, p_to: to })
    ])

    const { data: rpcData, error: rpcError } = rpcRes
    if (!rpcError && Array.isArray(rpcData)) {
      for (const row of rpcData) {
        const a = bump(row.outlet_id)
        a.grossRevenue += Number(row.gross_revenue) || 0
        a.totalDeductions += Number(row.deductions) || 0
        a.totalCogs += Number(row.cogs) || 0
      }
    } else {
      // Cadangan bila RPC tak tersedia: hitung dari order mentah, jendela sama.
      const orders = await fetchAllPages<any>(() => supabase
        .from('orders')
        .select('id, outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, is_endorse, total_amount, order_items(subtotal, quantity, menu_item_name, menu_items(hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))))')
        .in('outlet_id', mitraOutletIds)
        .eq('status', 'completed')
        .gte('created_at', `${from}T00:00:00.000+07:00`)
        .lte('created_at', `${to}T23:59:59.999+07:00`)
        // Urutan stabil WAJIB: tanpa ini paginasi bisa melewatkan/menggandakan baris.
        .order('id', { ascending: true }))

      for (const order of orders) {
        const a = bump(order.outlet_id)
        const totalAmt = Number(order.total_amount) || 0
        let orderCogs = 0
        for (const item of (order.order_items || [])) {
          const qty = Number(item.quantity) || 1
          const hpp = getItemHpp(item.menu_items, 'mitra', order.channel)
            || await hppByName(item.menu_item_name, order.channel)
          orderCogs += hpp * qty
        }
        // ACUAN TUNGGAL Omzet Kotor (migration 20300128000000).
        const itemValue = (order.order_items || []).reduce((s: number, i: any) => s + (Number(i.subtotal) || 0), 0)
        const deductions = (order.order_items || []).length > 0
          ? Math.max(0, itemValue - totalAmt)
          : (Number(order.discount_amount) || 0) + (Number(order.promo_subsidy) || 0)
        a.grossRevenue += totalAmt + deductions
        a.totalDeductions += deductions
        a.totalCogs += orderCogs
      }
    }

    const auditedOutlets = new Set<string>()
    for (const r of monthlyRows) {
      if (r.outlet_id && ['pengeluaran_outlet', 'bahan_baku', 'transport', 'utilitas', 'operasional'].includes(r.category)) {
        auditedOutlets.add(r.outlet_id)
      }
    }

    for (const r of pettyRows) {
      if (r.outlet_id && !auditedOutlets.has(r.outlet_id)) {
        bump(r.outlet_id).opex += Number(r.amount) || 0
      }
    }
    for (const r of monthlyRows) {
      if (r.outlet_id) bump(r.outlet_id).opex += Number(r.amount) || 0
    }
    for (const w of (wasteRes.data || [])) {
      if (mitraOutletIds.includes(w.outlet_id)) bump(w.outlet_id).waste += Number(w.nilai_waste) || 0
    }

    if (isAugust2026Period(from, to)) {
      for (const oid of mitraOutletIds) {
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
    }

    return acc
  }

  const monthlyAgg = await Promise.all(months.map(m => aggregateMonth(m.from, m.to)))

  for (const oid of mitraOutletIds) {
    const inv = invMap[oid]
    const profile = profiles.find(p => (p.outlet_ids || []).includes(oid))
    const modalInvestasi = Number(inv?.nilai_investasi) || 0
    const omzetHistoris = Number(inv?.omzet_historis) || 0
    const transferHistoris = Number(inv?.transfer_historis) || 0
    const systemTransfers = transfersData.filter(t => t.outlet_id === oid).reduce((sum, t) => sum + (Number(t.nominal) || 0), 0)

    // "Sudah kembali" = uang yang benar-benar sudah sampai ke mitra: bagi hasil
    // historis (diselesaikan di luar sistem) + transfer yang tercatat. Ini SATU
    // definisi, dipakai untuk memicu kebijakan BEP sekaligus untuk progress bar
    // -- sebelumnya pemicu kebijakan memakai transfer sedangkan progress bar
    // memakai akrual, sehingga Rp 71,7 juta transfer berbukti tak pernah
    // kelihatan di bar. Definisi yang sama dipakai mitraPnl.ts.
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

    months.forEach((m, idx) => {
      const w = monthlyAgg[idx][oid]
      if (!w) return
      const p = resolveMitraPolicy({
        periodFrom: m.from,
        isBep: isBepAlready,
        legacyProfitSharingPct: legacyShare,
        legacyManagementFee: legacyFee
      })
      const fee = Math.round((w.grossRevenue * p.managementFeePct) / 100)
      const laba = w.grossRevenue - w.totalDeductions - w.totalCogs - w.opex - w.waste - fee

      grossRevenue += w.grossRevenue
      totalDeductions += w.totalDeductions
      totalCogs += w.totalCogs
      opex += w.opex
      waste += w.waste
      managementFee += fee

      if (m.key >= mulaiAkru && sharingActive && laba > 0) {
        akrualBelumDitransfer += Math.round((laba * p.profitSharingPct) / 100)
      }
    })


    const netProfit = grossRevenue - totalDeductions - totalCogs - opex - waste - managementFee
    const mitraShare = akrualBelumDitransfer

    const totalDanaKembali = danaSudahKembali + akrualBelumDitransfer
    const roiPct = modalInvestasi > 0 ? (totalDanaKembali / modalInvestasi) * 100 : 0
    const bepPercentage = Math.min(Math.round(roiPct * 10) / 10, 100)
    const isBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi
    const sisaModal = Math.max(0, modalInvestasi - totalDanaKembali)

    resultMap[oid] = {
      outletId: oid,
      modalInvestasi,
      omzetHistoris,
      transferHistoris,
      transferSistem: systemTransfers,
      danaSudahKembali,
      akrualBelumDitransfer,
      profitSharingActive: sharingActive,
      revenue: grossRevenue,
      cogs: totalCogs,
      opex: opex + waste,
      managementFee,
      netProfit,
      mitraShare,
      totalDanaKembali,
      sisaModal,
      roiPct,
      bepPercentage,
      isBep
    }
  }

  return resultMap
}

