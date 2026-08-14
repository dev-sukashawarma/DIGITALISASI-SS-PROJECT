import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { KelolaMitraView } from './KelolaMitraView'

export const dynamic = 'force-dynamic'

export default async function KelolaMitraPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  // 1. Ambil profil mitra
  const { data: mitraProfiles } = await supabase
    .from('mitra_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    
  // 2. Ambil semua outlet (untuk pilihan)
  const { data: allOutlets } = await supabase
    .from('outlets')
    .select('id, name')
    .neq('id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('name', { ascending: true })
    
  // 3. Ambil semua saran masuk
  const { data: suggestions } = await supabase
    .from('mitra_suggestions')
    .select('*, outlets(name)')
    .order('created_at', { ascending: false })

  // 4. Ambil user list dari outlet_staff (khusus role MITRA / mitra)
  const { data: staffList } = await supabase
    .from('outlet_staff')
    .select('id, name, role, username')
    .in('role', ['mitra', 'MITRA'])
    .order('name', { ascending: true })
    
  // 5. Ambil daftar transfer
  const { data: transfers } = await supabase
    .from('mitra_transfers')
    .select('*, outlets(name)')
    .order('created_at', { ascending: false })
    
  // Format user list for dropdown
  const allUsers = (staffList || []).map(s => ({
    id: s.id,
    name: s.name || s.username || 'Tanpa Nama',
    username: s.username || '-',
    role: s.role || 'staff'
  }))
  
  return (
    <KelolaMitraView 
      mitraProfiles={mitraProfiles || []} 
      allOutlets={allOutlets || []} 
      suggestions={suggestions || []}
      allUsers={allUsers}
      transfers={transfers || []}
    />
  )
}


