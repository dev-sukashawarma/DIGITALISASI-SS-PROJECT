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
    supabase.from('cash_locations').select('*').order('label'),
    supabase.from('cash_balances').select('*'),
    supabase
      .from('cash_transactions')
      .select('*, cash_location:location_id(label), outlet:outlet_id(name)')
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
