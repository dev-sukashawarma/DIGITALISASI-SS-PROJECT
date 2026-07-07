import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import PembelianView from './PembelianView'

export const dynamic = 'force-dynamic'

export default async function PembelianPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  const d = new Date()
  d.setDate(d.getDate() - 30)
  const defaultFrom = d.toISOString().split('T')[0]
  const defaultTo = new Date().toISOString().split('T')[0]

  const { data: pos } = await supabase.rpc('get_purchase_orders', {
    p_from: defaultFrom,
    p_to: defaultTo,
    p_status: null,
  })

  return <PembelianView initialData={pos ?? []} defaultFrom={defaultFrom} defaultTo={defaultTo} />
}
