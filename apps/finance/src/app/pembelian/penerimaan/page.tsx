import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { PenerimaanClient } from './PenerimaanClient'

export const dynamic = 'force-dynamic'

export default async function PenerimaanBarangPage() {
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

  let enrichedPos = pos ?? []
  if (enrichedPos.length > 0) {
    const poIds = enrichedPos.map((p: any) => p.id)
    const { data: extras } = await supabase
      .from('purchase_order')
      .select('id, diverifikasi_at, paid_at, payment_status, tanggal_estimasi_tiba')
      .in('id', poIds)

    const extrasMap = new Map((extras ?? []).map(x => [x.id, x]))
    enrichedPos = enrichedPos.map((p: any) => {
      const extra = extrasMap.get(p.id)
      return {
        ...p,
        diverifikasi_at: p.diverifikasi_at ?? extra?.diverifikasi_at ?? null,
        paid_at: p.paid_at ?? extra?.paid_at ?? null,
        payment_status: p.payment_status ?? extra?.payment_status ?? 'unpaid',
        tanggal_estimasi_tiba: p.tanggal_estimasi_tiba ?? extra?.tanggal_estimasi_tiba ?? null,
      }
    })
  }

  return (
    <PenerimaanClient 
      initialData={enrichedPos} 
      defaultFrom={defaultFrom} 
      defaultTo={defaultTo}
    />
  )
}
