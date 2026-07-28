// @ts-nocheck
'use server'

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue, SalesSource, SalesSummaryRow, Outlet } from '@/lib/types'
import type { SalesHourlyRow } from '@/hooks/useSalesHourly'
import type { PettyCashTransaction, DailyPettyCashSummary } from '@/components/owner/PettyCashReportView'
import type { AttendanceRecordExt } from '@/components/owner/AttendanceReportView'

export async function getOwnerDashboardData(filter: PeriodFilterValue, outlets: Outlet[]) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any)
        })
      } catch {
        // SSR ignored
      }
    }
  })

  // 1. Fetch sales_hourly_scoped
  let q = supabase
    .from('sales_hourly_scoped')
    .select('outlet_id, sales_source, sales_date, sales_hour, omzet, jumlah_order_completed')
    .gte('sales_date', filter.from)
    .lte('sales_date', filter.to)

  if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
  if (filter.source !== 'all') q = q.eq('sales_source', filter.source)

  // 2. Fetch orders to calculate exact total_deductions (discount_amount + promo_subsidy)
  // Fix: filter.from/to is YYYY-MM-DD. Use +07:00 timezone to get exactly 00:00 to 23:59 local time.
  const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
  const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`)

  let ordersQ = supabase
    .from('orders')
    .select('outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, total_amount, order_items(subtotal)')
    .eq('status', 'completed')
    .gte('created_at', fromStart.toISOString())
    .lte('created_at', toEnd.toISOString())

  if (filter.outletId !== 'all') ordersQ = ordersQ.eq('outlet_id', filter.outletId)

  const [{ data, error }, { data: ordersData }] = await Promise.all([q, ordersQ])
  if (error) throw new Error(error.message)

  // Map deductions per `${outlet_id}|${sales_source}|${sales_date}`
  const deductionsMap = new Map<string, number>()
  for (const o of ordersData || []) {
    const d = new Date(o.created_at)
    // Convert UTC created_at to local date YYYY-MM-DD (Asia/Jakarta +7)
    const localDate = new Date(d.getTime() + 7 * 3600 * 1000)
    const dateStr = localDate.toISOString().split('T')[0]
    
    const srcKey = String(o.sales_source || 'pos').toLowerCase()
    const key = `${o.outlet_id}|${srcKey}|${dateStr}`
    
    let deduction = 0
    const disc = Number(o.discount_amount) || 0
    const promo = Number(o.promo_subsidy) || 0
    if (disc > 0 || promo > 0) {
      deduction = disc + promo
    } else {
      const itemSubtotal = (o.order_items || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)
      const totalAmt = Number(o.total_amount) || 0
      const itemDiff = itemSubtotal > totalAmt ? itemSubtotal - totalAmt : 0
      deduction = itemDiff
    }
    deductionsMap.set(key, (deductionsMap.get(key) || 0) + deduction)
  }

  // Aggregate for Summary (KPI)
  const acc = new Map<string, SalesSummaryRow & { total_deductions?: number }>()
  for (const r of data || []) {
    const rSrcKey = String(r.sales_source || 'pos').toLowerCase()
    const key = `${r.outlet_id}|${rSrcKey}|${r.sales_date}`
    const existing = acc.get(key)
    const deductionCell = deductionsMap.get(key) || 0

    if (existing) {
      existing.omzet += Number(r.omzet)
      existing.jumlah_order_completed += Number(r.jumlah_order_completed)
      existing.jumlah_order_all += Number(r.jumlah_order_completed)
      // Fix: DO NOT add deductionCell again here, because it's already the total deduction for the entire day.
    } else {
      acc.set(key, {
        outlet_id: r.outlet_id,
        outlet_name: '',
        sales_source: r.sales_source as SalesSource,
        sales_date: r.sales_date,
        omzet: Number(r.omzet),
        total_deductions: deductionCell,
        jumlah_order_completed: Number(r.jumlah_order_completed),
        jumlah_order_all: Number(r.jumlah_order_completed),
      })
    }
  }

  const summaryResult = Array.from(acc.values())
  const nameById = new Map(outlets.map((o) => [o.id, o.name]))
  const kpiRows = summaryResult.map((r) => ({
    ...r,
    outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
  }))

  // Aggregate for Hourly (Trend)
  const hourMap = new Map<number, SalesHourlyRow>()
  for (let i = 0; i < 24; i++) hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
  for (const r of data || []) {
    const b = hourMap.get(r.sales_hour)
    if (!b) continue
    b.omzet += Number(r.omzet)
    b.jumlah_order_completed += Number(r.jumlah_order_completed)
  }
  const hourlyRows = Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)

  return {
    kpiRows,
    hourlyRows,
  }
}

/* ── Fetch REAL Petty Cash (Expenses + Shifts Starting Cash) ─────────── */

export async function getPettyCashData(
  filter: PeriodFilterValue,
  outlets: Outlet[]
): Promise<{
  transactions: PettyCashTransaction[]
  dailySummaries: DailyPettyCashSummary[]
}> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  // 1. Fetch Staff & User Mapping for Real Crew Names
  const [{ data: staffList }, { data: userList }] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role, outlet_id'),
    supabase.from('users').select('id, name, username')
  ])

  const staffMap = new Map((staffList || []).map((s) => [s.id, s.name]))
  const userMap = new Map((userList || []).map((u) => [u.id, u.name || u.username]))

  const staffByOutlet = new Map<string, string[]>()
  for (const s of staffList || []) {
    if (s.outlet_id && s.name) {
      const existing = staffByOutlet.get(s.outlet_id) || []
      existing.push(s.name)
      staffByOutlet.set(s.outlet_id, existing)
    }
  }

  // 2. Query REAL table `shifts` for Starting Petty Cash (Modal Diserahkan)
  let shiftQuery = supabase
    .from('shifts')
    .select('*, outlets(name)')
    .order('end_time', { ascending: false })

  if (filter.outletId && filter.outletId !== 'all') {
    shiftQuery = shiftQuery.eq('outlet_id', filter.outletId)
  }

  // 3. Query REAL table `petty_cash_expenses` for Kas Keluar
  let expenseQuery = supabase
    .from('petty_cash_expenses')
    .select('*, outlets(name)')
    .order('created_at', { ascending: false })

  if (filter.from) {
    expenseQuery = expenseQuery.gte('expense_date', filter.from)
  }
  if (filter.to) {
    expenseQuery = expenseQuery.lte('expense_date', filter.to)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    expenseQuery = expenseQuery.eq('outlet_id', filter.outletId)
  }

  let topupQuery = supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (filter.from) {
    topupQuery = topupQuery.gte('created_at', `${filter.from}T00:00:00.000Z`)
  }
  if (filter.to) {
    topupQuery = topupQuery.lte('created_at', `${filter.to}T23:59:59.999Z`)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    topupQuery = topupQuery.eq('outlet_id', filter.outletId)
  }

  const [{ data: shiftRows }, { data: expenseRows }, { data: topupRows }] = await Promise.all([
    shiftQuery,
    expenseQuery,
    topupQuery,
  ])

  // Map starting cash from shifts as Kas Masuk
  const shiftEntries: PettyCashTransaction[] = (shiftRows || [])
    .filter((s: any) => {
      if (Number(s.starting_petty_cash) <= 0) return false
      const dateStr = s.end_time ? s.end_time.split('T')[0] : s.start_time ? s.start_time.split('T')[0] : ''
      if (filter.from && dateStr < filter.from) return false
      if (filter.to && dateStr > filter.to) return false
      return true
    })
    .map((s: any) => {
      let resolvedStaffName = staffMap.get(s.staff_id) || staffMap.get(s.closed_by) || userMap.get(s.staff_id)
      if (!resolvedStaffName && s.outlet_id) {
        const candidates = staffByOutlet.get(s.outlet_id)
        if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
      }
      return {
        id: `shift-start-${s.id}`,
        outlet_id: s.outlet_id || '',
        outlet_name: s.outlets?.name || 'Outlet Utama',
        transaction_date: s.start_time || s.created_at,
        type: 'in' as const,
        category: 'Modal Awal Kasir',
        description: 'Modal awal kas kecil diserahkan per shift',
        amount: Number(s.starting_petty_cash) || 0,
        staff_name: resolvedStaffName || 'Kasir Staff',
        receipt_url: null,
      }
    })

  // Map expenses from petty_cash_expenses as Kas Keluar
  const expenseEntries: PettyCashTransaction[] = (expenseRows || []).map((r: any) => {
    let resolvedStaffName = staffMap.get(r.created_by) || userMap.get(r.created_by)
    if (!resolvedStaffName && r.outlet_id) {
      const candidates = staffByOutlet.get(r.outlet_id)
      if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
    }
    if (!resolvedStaffName) resolvedStaffName = 'Staff Kasir'

    let tDate = r.expense_date || r.created_at
    if (r.expense_date && r.created_at && r.expense_date.length === 10) {
      const timePart = r.created_at.includes('T') ? r.created_at.split('T')[1] : '00:00:00Z'
      tDate = `${r.expense_date}T${timePart}`
    }

    return {
      id: r.id,
      outlet_id: r.outlet_id || outlets[0]?.id || '',
      outlet_name: r.outlets?.name || 'Global Outlet',
      transaction_date: tDate,
      type: (r.type as 'in' | 'out') || 'out',
      category: r.category || 'Operasional',
      description: r.description || 'Pengeluaran petty cash kasir',
      amount: Number(r.amount) || 0,
      staff_name: resolvedStaffName,
      receipt_url: r.receipt_url || null,
    }
  })

  // Map topups from petty_cash_topups as Kas Masuk
  const topupEntries: PettyCashTransaction[] = (topupRows || []).map((r: any) => {
    let resolvedStaffName = staffMap.get(r.created_by) || userMap.get(r.created_by)
    if (!resolvedStaffName && r.outlet_id) {
      const candidates = staffByOutlet.get(r.outlet_id)
      if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
    }
    if (!resolvedStaffName) resolvedStaffName = 'Finance Staff'

    let tDate = r.completed_at || r.created_at

    return {
      id: r.id,
      outlet_id: r.outlet_id || outlets[0]?.id || '',
      outlet_name: r.outlets?.name || 'Global Outlet',
      transaction_date: tDate,
      type: 'in',
      category: 'Top Up Petty Cash',
      description: r.description || 'Pengisian saldo petty cash',
      amount: Number(r.amount) || 0,
      staff_name: resolvedStaffName,
      receipt_url: r.proof_of_transfer_url || null,
    }
  })

  // Combine and sort all transactions by transaction_date DESC
  const allTransactions = [...shiftEntries, ...expenseEntries, ...topupEntries].sort((a, b) =>
    b.transaction_date.localeCompare(a.transaction_date)
  )

  // Compute Daily Summaries
  const dailyMap = new Map<string, DailyPettyCashSummary>()

  for (const t of allTransactions) {
    const dateKey = t.transaction_date.slice(0, 10)
    const existing = dailyMap.get(dateKey) || {
      date: dateKey,
      total_in: 0,
      total_out: 0,
      ending_balance: 0,
      shift_count: 0,
    }

    if (t.type === 'in') {
      existing.total_in += t.amount
      existing.shift_count++
    } else {
      existing.total_out += t.amount
    }
    existing.ending_balance = existing.total_in - existing.total_out
    dailyMap.set(dateKey, existing)
  }

  const dailySummaries = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date))

  return {
    transactions: allTransactions,
    dailySummaries,
  }
}

/* ── Fetch REAL Attendance Rekap & Stealth Photos from `attendance` ──── */

export async function getAttendanceReportData(
  filter: PeriodFilterValue,
  outlets: Outlet[]
): Promise<AttendanceRecordExt[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Fetch Staff & Outlets for Mapping
  const [{ data: staffList }, { data: outletsList }] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role'),
    supabase.from('outlets').select('id, name')
  ])

  const staffMap = new Map((staffList || []).map((s) => [s.id, s]))
  const outletMap = new Map((outletsList || []).map((o) => [o.id, o.name]))

  // Helper function to generate Signed URL from `selfies` bucket
  const photoCache = new Map<string, string | null>()
  async function getSignedStealthPhoto(path?: string | null): Promise<string | null> {
    if (!path) return null
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    if (photoCache.has(path)) return photoCache.get(path)!

    // Create signed URL for stealth photo from selfies bucket
    const { data: selfieSigned } = await supabase.storage.from('selfies').createSignedUrl(path, 3600)
    if (selfieSigned?.signedUrl) {
      photoCache.set(path, selfieSigned.signedUrl)
      return selfieSigned.signedUrl
    }

    return null
  }

  // 2. Query REAL table `attendance` (singular) where all stealth camera photos are recorded
  let query = supabase
    .from('attendance')
    .select('*')
    .order('ts_server', { ascending: false })

  if (filter.from) {
    query = query.gte('ts_server', `${filter.from}T00:00:00.000Z`)
  }
  if (filter.to) {
    query = query.lte('ts_server', `${filter.to}T23:59:59.999Z`)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    query = query.eq('outlet_id', filter.outletId)
  }

  const { data: attRows, error } = await query

  if (error || !attRows) {
    console.error('Error querying table attendance from DB:', error?.message)
    return []
  }

  // Group attendance entries by `${outlet_staff_id}|${outlet_id}|${date}`
  const grouped = new Map<string, {
    id: string
    staff_id: string
    staff_name: string
    staff_role: string
    outlet_id: string
    outlet_name: string
    date: string
    clock_in: string | null
    clock_out: string | null
    raw_photo_in: string | null
    raw_photo_out: string | null
    status: string
    late_minutes: number
    out_status: string | null
    out_minutes: number | null
    notes: string | null
  }>()

  for (const r of attRows) {
    const dateStr = r.ts_server ? r.ts_server.split('T')[0] : ''
    const key = `${r.outlet_staff_id}|${r.outlet_id}|${dateStr}`
    const st = staffMap.get(r.outlet_staff_id)
    const outletName = outletMap.get(r.outlet_id)

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: r.id,
        staff_id: r.outlet_staff_id || '',
        staff_name: st?.name || 'Kasir Staff',
        staff_role: (st?.role || 'CREW').toUpperCase(),
        outlet_id: r.outlet_id || '',
        outlet_name: outletName || 'Outlet Utama',
        date: dateStr,
        clock_in: null,
        clock_out: null,
        raw_photo_in: null,
        raw_photo_out: null,
        status: 'hadir',
        late_minutes: 0,
        out_status: null,
        out_minutes: null,
        notes: null,
      })
    }

    const item = grouped.get(key)!
    if (r.type === 'in') {
      item.clock_in = new Date(r.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      item.raw_photo_in = r.selfie_url || null
      if (r.status === 'telat' || r.status === 'terlambat') {
        item.status = 'terlambat'
        item.late_minutes = r.telat_menit || 0
      }
    } else if (r.type === 'out') {
      item.clock_out = new Date(r.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      item.raw_photo_out = r.selfie_url || null
      item.out_status = r.status || 'tepat'
      item.out_minutes = r.telat_menit || 0
    }
  }

  // Convert grouped items to AttendanceRecordExt with Signed Stealth Photo URLs & Out Status
  const result: AttendanceRecordExt[] = await Promise.all(
    Array.from(grouped.values()).map(async (item) => {
      const signedIn = await getSignedStealthPhoto(item.raw_photo_in)
      const signedOut = await getSignedStealthPhoto(item.raw_photo_out)

      return {
        id: item.id,
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        staff_role: item.staff_role,
        outlet_id: item.outlet_id,
        outlet_name: item.outlet_name,
        date: item.date,
        clock_in: item.clock_in,
        clock_out: item.clock_out,
        status: item.status,
        late_minutes: item.late_minutes,
        out_status: item.out_status,
        out_minutes: item.out_minutes,
        notes: item.notes,
        stealth_photo_in_url: signedIn,
        stealth_photo_out_url: signedOut,
      }
    })
  )

  return result.sort((a, b) => b.date.localeCompare(a.date))
}

