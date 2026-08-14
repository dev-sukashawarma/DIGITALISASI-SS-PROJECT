import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import PODetailView from './PODetailView'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Fetch PO detail
  const { data: po, error } = await supabase
    .from('purchase_order')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !po) {
    return notFound()
  }

  const { data: items } = await supabase
    .from('purchase_order_item')
    .select('*, bahan_baku(nama, satuan)')
    .eq('purchase_order_id', id)
    .order('bahan_baku(nama)')

  const initialData = { ...po, items: items ?? [] }

  return (
    <PODetailView id={id} initialData={initialData as any} />
  )
}
