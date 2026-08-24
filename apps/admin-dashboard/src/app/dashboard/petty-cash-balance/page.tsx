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
}

export type PettyCashHistory = {
  id: string
  outlet_id: string
  shift_id: string | null
  application_mode: 'active_shift' | 'next_shift_opening'
  status: 'pending' | 'applied' | 'superseded'
  balance_before: number
  target_balance: number
  adjustment_amount: number
  note: string
  created_by: string
  created_at: string
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

  const [outletsResult, shiftsResult, balancesResult, adjustmentsResult, legacyHistoryResult] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, is_active')
      .neq('type', 'marketplace')
      .order('name'),
    supabase
      .from('shifts')
      .select('id, outlet_id, status, start_time, starting_petty_cash')
      .order('start_time', { ascending: false })
      .limit(2000),
    supabase.rpc('get_all_latest_petty_cash_balances'),
    supabase
      .from('petty_cash_adjustments')
      .select('id, outlet_id, shift_id, application_mode, status, balance_before, target_balance, adjustment_amount, note, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('petty_cash_balance_history')
      .select('id, outlet_id, shift_id, old_starting_balance, new_starting_balance, old_current_balance, new_current_balance, note, changed_by, changed_at')
      .order('changed_at', { ascending: false })
      .limit(300),
  ])

  const outlets = (outletsResult.data ?? []) as PettyCashOutlet[]
  const rawShifts = (shiftsResult.data ?? []) as PettyCashShift[]
  const rawAdjustments = (adjustmentsResult.data ?? []) as Omit<PettyCashHistory, 'admin_name'>[]
  const rawLegacy = (legacyHistoryResult.data ?? []) as {
    id: string; outlet_id: string; shift_id: string; old_current_balance: number;
    new_current_balance: number; note: string; changed_by: string; changed_at: string
  }[]

  const staffIds = Array.from(new Set([
    ...rawAdjustments.map((row) => row.created_by),
    ...rawLegacy.map((row) => row.changed_by),
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
    latestShifts.push(row)
  }

  const history: PettyCashHistory[] = rawAdjustments.map((row) => ({
    ...row,
    admin_name: adminNames.get(row.created_by) ?? null,
  })).concat(rawLegacy.map((row) => ({
    id: `legacy-${row.id}`,
    outlet_id: row.outlet_id,
    shift_id: row.shift_id,
    application_mode: 'active_shift' as const,
    status: 'applied' as const,
    balance_before: Number(row.old_current_balance) || 0,
    target_balance: Number(row.new_current_balance) || 0,
    adjustment_amount: (Number(row.new_current_balance) || 0) - (Number(row.old_current_balance) || 0),
    note: row.note,
    created_by: row.changed_by,
    created_at: row.changed_at,
    admin_name: adminNames.get(row.changed_by) ?? null,
  }))).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

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
