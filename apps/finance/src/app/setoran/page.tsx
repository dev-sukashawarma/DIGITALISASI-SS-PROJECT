import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { SetoranView } from './components/SetoranView'

export const dynamic = 'force-dynamic'

export default async function SetoranPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

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
