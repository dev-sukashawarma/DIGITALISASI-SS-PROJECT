// @ts-nocheck
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import KelolaMitraView from './KelolaMitraView'

export const dynamic = 'force-dynamic'

export default async function KelolaMitraPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  
  // 1. Fetch Outlets type=mitra
  const { data: outlets } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active')
    .eq('type', 'mitra')
    .order('name')
  
  // 2. Fetch Investments
  const { data: investments } = await supabase
    .from('mitra_investments')
    .select('*')

  return (
    <KelolaMitraView 
      outlets={outlets ?? []} 
      investments={investments ?? []} 
    />
  )
}
