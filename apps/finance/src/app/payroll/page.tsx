import { createServerComponentClient } from '@/lib/supabase-server'
import { isTestOrDevStaff } from '@/lib/staffFilters'
import { PayrollView } from './components/PayrollView'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  const supabase = await createServerComponentClient()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [
    { data: locations },
    { data: balances },
    { data: slips },
  ] = await Promise.all([
    supabase.from('cash_locations').select('*').order('label'),
    supabase.from('cash_balances').select('*'),
    supabase
      .from('payroll_records')
      .select(`id, staff_id, period_month, period_year, total_salary, status,
        payment_status, paid_at, cash_transaction_id,
        outlet_staff:staff_id(
          id, name, username, email, account_category, role,
          staff_financials(bank_name, bank_account_number, bank_account_name)
        )`)
      .eq('period_month', currentMonth)
      .eq('period_year', currentYear)
      .eq('status', 'finalized')
      .order('payment_status', { ascending: true }),
  ])

  const filteredSlips = ((slips || []) as any[]).filter(s => !isTestOrDevStaff(s.outlet_staff))

  return (
    <PayrollView
      initialLocations={locations || []}
      initialBalances={balances || []}
      initialSlips={filteredSlips}
      currentMonth={currentMonth}
      currentYear={currentYear}
    />
  )
}
