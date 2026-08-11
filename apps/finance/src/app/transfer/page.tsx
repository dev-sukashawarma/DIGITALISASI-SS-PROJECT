import { createServerComponentClient } from '@/lib/supabase-server'
import { TransferView } from './components/TransferView'

export const dynamic = 'force-dynamic'

export default async function TransferPage() {
  const supabase = await createServerComponentClient()

  const [
    { data: locations },
    { data: balances },
  ] = await Promise.all([
    supabase.from('cash_locations').select('*').order('label'),
    supabase.from('cash_balances').select('*'),
  ])

  return (
    <TransferView
      initialLocations={locations || []}
      initialBalances={balances || []}
    />
  )
}
