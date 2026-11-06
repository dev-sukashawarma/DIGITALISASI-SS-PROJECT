import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue, Outlet } from '@/lib/types'
import type { PettyCashTransaction, DailyPettyCashSummary } from '@/components/owner/PettyCashReportView'

/*
 * Disalin dari apps/admin-dashboard/src/app/actions/ownerDashboard.ts (getPettyCashData)
 * untuk halaman Laporan Petty Cash finance. Ubah keduanya bersamaan.
 * Sengaja BUKAN 'use server': hanya dipanggil dari page server (tidak jadi endpoint POST).
 */
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
    supabase.from('outlet_staff').select('id, name, role, outlet_id').limit(1000),
    supabase.from('users').select('id, name, username').limit(1000)
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
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('end_time', { ascending: false })
    .limit(500)

  if (filter.outletId && filter.outletId !== 'all') {
    shiftQuery = shiftQuery.eq('outlet_id', filter.outletId)
  }

  // 3. Query REAL table `petty_cash_expenses` for Kas Keluar
  let expenseQuery = supabase
    .from('petty_cash_expenses')
    .select('*, outlets(name)')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    // Abaikan pengeluaran yang sudah di-void (samakan dgn get_petty_cash_balance).
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1000)

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
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .in('status', ['forwarded_by_leader', 'approved', 'completed'])
    .order('created_at', { ascending: false })
    .limit(500)

  if (filter.from) {
    topupQuery = topupQuery.gte('created_at', `${filter.from}T00:00:00.000+07:00`)
  }
  if (filter.to) {
    topupQuery = topupQuery.lte('created_at', `${filter.to}T23:59:59.999+07:00`)
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
      type: 'out',
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

  // Filter topupEntries and expenseEntries to only include those that fall WITHIN a shift
  // Interim transactions are already rolled into the starting_petty_cash of the next shift
  const activeTopupEntries = topupEntries.filter(t => {
    return (shiftRows || []).some((s: any) => {
      if (s.outlet_id !== t.outlet_id) return false
      const sStart = new Date(s.start_time).getTime()
      const sEnd = s.end_time ? new Date(s.end_time).getTime() : Date.now() + 86400000 * 365 // Future if open
      const tTime = new Date(t.transaction_date).getTime()
      return tTime >= sStart && tTime <= sEnd
    })
  })

  const activeExpenseEntries = expenseEntries.filter(e => {
    return (shiftRows || []).some((s: any) => {
      if (s.outlet_id !== e.outlet_id) return false
      const sStart = new Date(s.start_time).getTime()
      const sEnd = s.end_time ? new Date(s.end_time).getTime() : Date.now() + 86400000 * 365
      const eTime = new Date(e.transaction_date).getTime()
      return eTime >= sStart && eTime <= sEnd
    })
  })

  // Combine and sort all transactions by transaction_date DESC
  const allTransactions = [...shiftEntries, ...activeExpenseEntries, ...activeTopupEntries].sort((a, b) =>
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
