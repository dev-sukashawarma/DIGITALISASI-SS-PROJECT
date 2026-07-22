import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import PettyCashView from './PettyCashView'

export const dynamic = 'force-dynamic'

export default async function AdminPettyCashPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data } = await supabase
    .from('petty_cash_topups')
    .select(`
      *,
      outlet:outlets(name, bank_name, bank_account_number, bank_account_name),
      creator:outlet_staff!petty_cash_topups_created_by_fkey(name),
      approver:outlet_staff!petty_cash_topups_approved_by_fkey(name)
    `)
    .order('created_at', { ascending: false })

  const initialRequests = data || []

  return <PettyCashView initialRequests={initialRequests as any} />
}
