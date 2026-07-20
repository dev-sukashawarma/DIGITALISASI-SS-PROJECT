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
    .order('name', { ascending: true })
    
  // 3. Ambil semua saran masuk
  const { data: suggestions } = await supabase
    .from('mitra_suggestions')
    .select('*, outlets(name)')
    .order('created_at', { ascending: false })

  // 4. Ambil user list (auth.users via staf_profiles atau langsung auth.users)
  // As a workaround since auth.users needs service_role, we fetch from outlet_staff where role = 'MITRA'
  // Or we just get it from an RPC or endpoint. Here we'll just mock or use edge function, 
  // but if we have `staf_profiles`, let's check `outlet_staff` for now.
  const { data: staffList } = await supabase
    .from('outlet_staff')
    .select('id, name, role')
    .eq('role', 'MITRA')
    
  // Format user list for dropdown
  const allUsers = (staffList || []).map(s => ({
    id: s.id, // outlet_staff.id
    name: s.name,
    username: s.role
  }))
  
  return (
    <KelolaMitraView 
      mitraProfiles={mitraProfiles || []} 
      allOutlets={allOutlets || []} 
      suggestions={suggestions || []}
      allUsers={allUsers}
    />
  )
}
