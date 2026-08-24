import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PettyCashBalanceView from './PettyCashBalanceView'

export const dynamic = 'force-dynamic'

export type PettyCashOutlet = {
  id: string
  name: string
  is_active: boolean
}
export type PettyCashShift = {
  id: string
  outlet_id: string
  status: string
  start_time: string
  starting_petty_cash: number | null
  admin_petty_cash_balance: number | null
  admin_petty_cash_note: string | null
  admin_petty_cash_updated_at: string | null
  admin_petty_cash_updated_by: string | null
  admin_name: string | null
}

export type PettyCashHistory = {
  id: string
  outlet_id: string
  shift_id: string
  old_starting_balance: number
  new_starting_balance: number
  old_current_balance: number
  new_current_balance: number
  note: string
  changed_by: string
  changed_at: string
  admin_name: string | null
}

export default async function PettyCashBalancePage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (staff?.role !== 'admin') redirect('/dashboard')

  const [outletsResult, shiftsResult, balancesResult, historyResult] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, is_active')
      .neq('type', 'marketplace')
      .order('name'),
    supabase
      .from('shifts')
      .select('id, outlet_id, status, start_time, starting_petty_cash, admin_petty_cash_balance, admin_petty_cash_note, admin_petty_cash_updated_at, admin_petty_cash_updated_by')
      .order('start_time', { ascending: false })
      .limit(2000),
    supabase.rpc('get_all_latest_petty_cash_balances'),
    supabase
      .from('petty_cash_balance_history')
      .select('id, outlet_id, shift_id, old_starting_balance, new_starting_balance, old_current_balance, new_current_balance, note, changed_by, changed_at')
      .order('changed_at', { ascending: false })
      .limit(300),
  ])

  const outlets = (outletsResult.data ?? []) as PettyCashOutlet[]
  const rawShifts = (shiftsResult.data ?? []) as Omit<PettyCashShift, 'admin_name'>[]
  const rawHistory = (historyResult.data ?? []) as Omit<PettyCashHistory, 'admin_name'>[]

  const staffIds = Array.from(new Set([
    ...rawShifts.map((row) => row.admin_petty_cash_updated_by),
    ...rawHistory.map((row) => row.changed_by),
  ].filter(Boolean))) as string[]

  const { data: adminRows } = staffIds.length
    ? await supabase.from('outlet_staff').select('id, name').in('id', staffIds)
    : { data: [] as { id: string; name: string }[] }

  const adminNames = new Map((adminRows ?? []).map((row) => [row.id, row.name]))
  const seenOutlets = new Set<string>()
  const latestShifts: PettyCashShift[] = []

  for (const row of rawShifts) {
    if (seenOutlets.has(row.outlet_id)) continue
    seenOutlets.add(row.outlet_id)
    latestShifts.push({
      ...row,
      admin_name: row.admin_petty_cash_updated_by
        ? adminNames.get(row.admin_petty_cash_updated_by) ?? null
        : null,
    })
  }

  const history: PettyCashHistory[] = rawHistory.map((row) => ({
    ...row,
    admin_name: adminNames.get(row.changed_by) ?? null,
  }))

  const balances = Object.fromEntries(
    ((balancesResult.data ?? []) as { outlet_id: string; balance: number }[])
      .map((row) => [row.outlet_id, Number(row.balance) || 0])
  )

  return (
    <PettyCashBalanceView
      outlets={outlets}
      shifts={latestShifts}
      balances={balances}
      history={history}
    />
  )
}
