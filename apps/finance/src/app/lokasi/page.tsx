import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { LokasiView } from './components/LokasiView'

export const dynamic = 'force-dynamic'

export default async function LokasiPage() {
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
    <LokasiView
      initialLocations={locations || []}
      initialBalances={balances || []}
    />
  )
}
