import { createServerComponentClient } from '@/lib/supabase-server'
import { LokasiView } from './components/LokasiView'

export const dynamic = 'force-dynamic'

export default async function LokasiPage() {
  const supabase = await createServerComponentClient()

  const [
    { data: locations },
    { data: balances },
  ] = await Promise.all([
    supabase.from('cash_locations').select('*').order('label'),
    supabase.from('cash_balances').select('*'),
  ])

  return (
    <LokasiView
      initialLocations={locations || []}
      initialBalances={balances || []}
    />
  )
}
