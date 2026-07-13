import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KasirOrderClient from './KasirOrderClient'

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
    return <KasirOrderClient serverOutletId="" />
  }

  // 3. Render client component dengan data awal kosong agar fetch di client (CSR) untuk navigasi instan
  return <KasirOrderClient serverOutletId={outletId} />
}
