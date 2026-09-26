import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-service'
import { isExcludedOutlet, isTestOutlet } from '@/lib/outletFilters'
import type { OutletCashData } from '@/app/eom-closing/exportKasirPdf'
import type {
  ShiftVarianceLog,
  PettyCashCategoryItem,
  NonCashChannelItem,
} from '@/app/eom-closing/useEomKasirLive'

export const dynamic = 'force-dynamic'

const CATEGORY_LABEL_MAP: Record<string, string> = {
  pengeluaran_outlet: 'Operasional & Kebutuhan Toko',
  outlet: 'Pengeluaran Kebutuhan Laci Kasir',
  bb: 'Bahan Tambahan & Es Batu Segar',
  bahan_baku: 'Bahan Baku & Kemasan Darurat',
  pln: 'Token Listrik PLN & Utilitas Toko',
  utilities: 'Token Listrik & Utilitas Toko',
  utilitas: 'Token Listrik & Utilitas Toko',
  transport: 'Transportasi & Pengantaran Cepat',
  lembur: 'Uang Makan & Lembur Staf Shift',
  pdam: 'Air Minum Galon & Sanitasi Toko',
  operasional: 'Iuran Kebersihan, Parkir & Lingkungan',
  lainnya: 'Pengeluaran Operasional Lainnya',
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = parseInt(searchParams.get('month') || '9', 10)
    const year = parseInt(searchParams.get('year') || '2026', 10)

    const pad = (n: number) => String(n).padStart(2, '0')
    const startTz = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0)).toISOString()
    const endTz =
      month === 12
        ? new Date(Date.UTC(year + 1, 0, 1, -7, 0, 0)).toISOString()
        : new Date(Date.UTC(year, month, 1, -7, 0, 0)).toISOString()

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const startDate = `${year}-${pad(month)}-01`
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}`

    const supabase = getServiceSupabase()

    // 1. Fetch Outlets, Shifts, Petty Cash in parallel
    const outletsPromise = supabase
      .from('outlets')
      .select('id, name, type, bank_name, bank_account_number, is_active')
      .order('name')

    const shiftsPromise = supabase
      .from('shifts')
      .select(
        'id, outlet_id, staff_id, start_time, end_time, starting_cash, actual_ending_cash, expected_ending_cash, variance, status, notes, outlet_staff!shifts_staff_id_fkey(id, name, role)'
      )
      .gte('start_time', startTz)
      .lt('start_time', endTz)
      .limit(3000)

    const pettyCashPromise = supabase
      .from('petty_cash_expenses')
      .select('id, outlet_id, category, amount, description, expense_date')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .is('deleted_at', null)
      .limit(5000)

    // 2. Fetch Orders with server-side parallel wave pagination
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
            console.warn('Server EOM Orders wave fetch error:', pageErr)
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

    if (outletsRes.error) {
      throw outletsRes.error
    }

    // 3. Build valid operational outlets
    const rawOutlets = outletsRes.data || []
    const operationalOutlets = rawOutlets.filter(
      (o: any) => !isExcludedOutlet(o.name) && !isTestOutlet(o.name) && o.is_active !== false
    )

    const outletMap = new Map<
      string,
      OutletCashData & { rawType: string; shiftCount: number }
    >()

    operationalOutlets.forEach((o: any, idx: number) => {
      const isMitra = o.type?.toLowerCase().includes('mitra') || o.name?.toUpperCase().includes('MITRA')
      const isOnline = o.type?.toLowerCase().includes('online') || o.name?.toUpperCase().includes('ONLINE')
      const outletType = isOnline ? 'Online' : isMitra ? 'Mitra' : 'Internal'

      outletMap.set(o.id, {
        no: idx + 1,
        name: o.name.toUpperCase(),
        type: outletType,
        grossPos: 0,
        cash: 0,
        nonCash: 0,
        bankDeposit: 0,
        pettyCash: 0,
        poAlloc: 0,
        variance: 0,
        rawType: o.type || 'internal',
        shiftCount: 0,
      })
    })

    // 4. Aggregate Orders
    const channelSums: Record<string, { count: number; nominal: number }> = {
      qris: { count: 0, nominal: 0 },
      edc: { count: 0, nominal: 0 },
      cash: { count: 0, nominal: 0 },
      online: { count: 0, nominal: 0 },
    }

    allOrders.forEach((ord) => {
      const out = outletMap.get(ord.outlet_id)
      const amt = Number(ord.total_amount) || 0
      const pm = (ord.payment_method || '').toLowerCase()

      if (out) {
        out.grossPos += amt
        if (pm.includes('cash') || pm === 'tunai') {
          out.cash += amt
        } else {
          out.nonCash += amt
        }
      }

      if (pm.includes('qris') || pm.includes('qr') || pm.includes('gopay') || pm.includes('shopee')) {
        channelSums.qris.count += 1
        channelSums.qris.nominal += amt
      } else if (pm.includes('card') || pm.includes('debit') || pm.includes('credit') || pm.includes('edc')) {
        channelSums.edc.count += 1
        channelSums.edc.nominal += amt
      } else if (pm.includes('cash') || pm === 'tunai') {
        channelSums.cash.count += 1
        channelSums.cash.nominal += amt
      } else {
        channelSums.online.count += 1
        channelSums.online.nominal += amt
      }
    })

    // 5. Aggregate Petty Cash Expenses
    const catSums: Record<string, { nominal: number; outlets: Set<string> }> = {}
    ;(pettyRes.data || []).forEach((p: any) => {
      const out = outletMap.get(p.outlet_id)
      const amt = Number(p.amount) || 0
      const rawCat = (p.category || 'outlet').toLowerCase()
      const catKey = CATEGORY_LABEL_MAP[rawCat] || CATEGORY_LABEL_MAP.lainnya

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
        const staffName = staffObj?.name || 'Kasir Outlet'
        liveVariances.push({
          no: liveVariances.length + 1,
          day: d.getDate(),
          outlet: out?.name || 'CABANG OUTLET',
          shift: `Shift Kasir - ${staffName}`,
          sistem: Number(s.expected_ending_cash) || 0,
          fisik: Number(s.actual_ending_cash) || 0,
          selisih: varAmt,
          penyebab:
            s.notes ||
            (varAmt < 0
              ? 'Salah hitung kembalian / selisih fisik blind close kasir'
              : 'Kelebihan kembalian koin / pembulatan kasir'),
          status:
            varAmt < 0 ? 'LUNAS (Potong Kasbon Kasir)' : 'SELESAI (Disetor ke Kas Toko)',
        })
      }
    })

    // Sort variances by day ascending
    liveVariances.sort((a, b) => a.day - b.day)
    liveVariances.forEach((v, idx) => {
      v.no = idx + 1
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

    const compiledNonCash: NonCashChannelItem[] = [
      {
        no: 1,
        channel: 'QRIS Statis & Dinamis (BCA / Mandiri / ShopeePay)',
        volume: `${channelSums.qris.count.toLocaleString('id-ID')} Trx`,
        nominal: channelSums.qris.nominal,
        porsi: totalNonCash > 0 ? `${((channelSums.qris.nominal / totalNonCash) * 100).toFixed(1)}%` : '0%',
      },
      {
        no: 2,
        channel: 'EDC Kartu Debit & Kredit Bank',
        volume: `${channelSums.edc.count.toLocaleString('id-ID')} Trx`,
        nominal: channelSums.edc.nominal,
        porsi: totalNonCash > 0 ? `${((channelSums.edc.nominal / totalNonCash) * 100).toFixed(1)}%` : '0%',
      },
      {
        no: 3,
        channel: 'Virtual Account & Bank Transfer Langsung',
        volume: `${channelSums.online.count.toLocaleString('id-ID')} Trx`,
        nominal: channelSums.online.nominal,
        porsi: totalNonCash > 0 ? `${((channelSums.online.nominal / totalNonCash) * 100).toFixed(1)}%` : '0%',
      },
    ].filter((c) => c.nominal > 0)

    return NextResponse.json({
      outlets: compiledOutlets,
      shiftVariances: liveVariances,
      pettyCashCategories: compiledCategories,
      nonCashChannels: compiledNonCash,
      totalOrders: allOrders.length,
      totalShifts: totalShiftCount,
      isLive: allOrders.length > 0,
      lastFetchedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('API /api/eom-closing/kasir-live error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
