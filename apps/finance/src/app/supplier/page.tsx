import { createServerComponentClient } from '@/lib/supabase-server'
import { SupplierView } from './components/SupplierView'

export const dynamic = 'force-dynamic'

export default async function SupplierPage() {
  const supabase = await createServerComponentClient()

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
