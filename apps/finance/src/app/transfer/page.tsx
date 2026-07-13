import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { TransferView } from './components/TransferView'

export const dynamic = 'force-dynamic'

export default async function TransferPage() {
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
