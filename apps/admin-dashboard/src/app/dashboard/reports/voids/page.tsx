import { createClient } from '@/lib/supabase/server'
import VoidsView from './VoidsView'

export const dynamic = 'force-dynamic'

export default async function VoidsReportPage() {
  const supabase = await createClient()

  // Fetch cancelled orders
  const { data: voids, error } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      total_amount,
      scheduled_promo_names,
      void_reason,
      void_at,
      outlets!inner(name),
      outlet_staff!orders_voided_by_fkey(name, role)
    `)
    .eq('status', 'cancelled')
    .order('void_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching voids:', error)
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Pembatalan & Kecurangan</h1>
        </div>
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
          Gagal mengambil data laporan pembatalan (voids). {error.message}
        </div>
      </div>
    )
  }

  return <VoidsView initialVoids={voids || []} />
}
