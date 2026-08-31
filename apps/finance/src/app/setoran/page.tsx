import { createServerComponentClient } from '@/lib/supabase-server'
import { SetoranView } from './components/SetoranView'

export const dynamic = 'force-dynamic'

export default async function SetoranPage() {
  const supabase = await createServerComponentClient()

  const [
    { data: locations },
    { data: balances },
    { data: txs },
  ] = await Promise.all([
    supabase.from('cash_location').select('*').order('label'),
    supabase.from('cash_balance').select('*'),
    supabase
      .from('cash_transaction')
      .select('*, cash_location:cash_location_id(label, kind), outlet:outlet_id(name)')
      .order('occurred_at', { ascending: false })
      .limit(100),
  ])

  return (
    <SetoranView
      initialLocations={locations || []}
      initialBalances={balances || []}
      initialTxs={txs || []}
    />
  )
}
