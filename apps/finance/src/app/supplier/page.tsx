import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { SupplierView } from './components/SupplierView'

export const dynamic = 'force-dynamic'

export default async function SupplierPage() {
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
    { data: pos },
  ] = await Promise.all([
    supabase.from('cash_locations').select('*').order('label'),
    supabase.from('cash_balances').select('*'),
    supabase
      .from('purchase_orders')
      .select('*')
      .eq('status', 'diterima')
      .order('tanggal_po', { ascending: false })
      .limit(100),
  ])

  return (
    <SupplierView
      initialLocations={locations || []}
      initialBalances={balances || []}
      initialPos={pos || []}
    />
  )
}
