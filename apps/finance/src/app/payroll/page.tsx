import { createServerComponentClient } from '@/lib/supabase-server'
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
      .from('payroll_slips')
      .select('*, outlet_staff(name, role, staff_financials(bank_name, bank_account_number))')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('status', 'final'),
  ])

  return (
    <PayrollView
      initialLocations={locations || []}
      initialBalances={balances || []}
      initialSlips={slips || []}
      currentMonth={currentMonth}
      currentYear={currentYear}
    />
  )
}
