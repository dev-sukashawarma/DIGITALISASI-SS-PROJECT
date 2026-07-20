import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { MitraDashboardView } from './MitraDashboardView'

export const dynamic = 'force-dynamic'

export default async function MitraDashboardPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="p-8 text-center text-gray-500">Akses ditolak. Sesi tidak valid.</div>
  }
  
  // 1. Fetch profil mitra
  const { data: profile } = await supabase
    .from('mitra_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
    
  if (!profile) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-20 text-center">
        <h2 className="text-xl font-bold mb-2">Profil Mitra Tidak Ditemukan</h2>
        <p className="text-gray-500">Akun Anda belum terdaftar sebagai Mitra. Silakan hubungi admin pusat untuk menambahkan profil Mitra Anda.</p>
      </div>
    )
  }
  
  // 2. Fetch outlets
  const outletIds: string[] = profile.outlet_ids || []
  let outlets: any[] = []
  if (outletIds.length > 0) {
    const { data: out } = await supabase
      .from('outlets')
      .select('*')
      .in('id', outletIds)
    outlets = out || []
  }
  
  // 3. Fetch investasi
  const investasiMap: Record<string, number> = {}
  if (outletIds.length > 0) {
    const { data: inv } = await supabase
      .from('mitra_investments')
      .select('outlet_id, nilai_investasi')
      .in('outlet_id', outletIds)
      
    if (inv) {
      inv.forEach(i => {
        investasiMap[i.outlet_id] = Number(i.nilai_investasi)
      })
    }
  }
  
  // 4. Hitung omzet bulan ini
  const omzetMap: Record<string, number> = {}
  if (outletIds.length > 0) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    // orders typically have payment_status = 'paid' or status = 'completed'
    // Let's use status = 'completed' based on typical structure
    const { data: orders } = await supabase
      .from('orders')
      .select('outlet_id, total_amount')
      .in('outlet_id', outletIds)
      .gte('created_at', startOfMonth.toISOString())
      .eq('status', 'completed')
      
    if (orders) {
      orders.forEach(o => {
        omzetMap[o.outlet_id] = (omzetMap[o.outlet_id] || 0) + Number(o.total_amount)
      })
    }
  }
  
  return (
    <MitraDashboardView 
      mitra={profile} 
      outlets={outlets} 
      investasiMap={investasiMap} 
      omzetMap={omzetMap} 
    />
  )
}
