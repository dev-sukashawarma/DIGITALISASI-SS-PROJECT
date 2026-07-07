import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KasirOrderClient from './KasirOrderClient'
import type { OrderWithItems } from '@/types'

export const dynamic = 'force-dynamic' // Ensure realtime SSR

export default async function KasirOrdersServerPage() {
  const supabase = await createClient()
  
  // 1. Dapatkan sesi pengguna saat ini
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  }

  // 2. Dapatkan outlet_id
  const { data: profile } = await supabase.from('outlet_staff')
    .select('outlet_id')
    .eq('id', user.id)
    .single()

  const outletId = profile?.outlet_id
  
  if (!outletId) {
    return <KasirOrderClient initialOrders={[]} serverOutletId="" />
  }

  // 3. Fetch data pesanan hari ini secara SSR
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: initialOrders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .or(`created_at.gte.${today.toISOString()},status.in.(pending,preparing)`)
    .order('created_at', { ascending: false })
    .limit(200)

  // 4. Render client component dengan data awal
  return <KasirOrderClient initialOrders={(initialOrders as OrderWithItems[]) ?? []} serverOutletId={outletId} />
}
