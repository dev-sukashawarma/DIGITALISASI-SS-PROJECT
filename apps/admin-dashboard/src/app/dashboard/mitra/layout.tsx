import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { MitraOutletProvider } from './MitraOutletContext'
import { redirect } from 'next/navigation'
import { MitraMaintenanceView } from '@/components/maintenance/MitraMaintenanceView'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MitraDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    redirect('/login')
  }

  // 1. Cek role pengguna saat ini di outlet_staff
  const { data: staffData } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const userRole = (staffData?.role || '').toLowerCase()
  const isPrivileged = ['admin', 'owner', 'developer'].includes(userRole)

  // 2. Cek status maintenance dari global_settings
  const { data: settingRow } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'mitra_maintenance_config')
    .maybeSingle()

  const maintenanceConfig = (settingRow?.value || {}) as {
    is_active?: boolean
    custom_html?: string
  }

  const isMaintenanceActive = Boolean(maintenanceConfig.is_active)

  // Jika maintenance aktif dan pengguna BUKAN privileged (bukan developer/admin/owner),
  // cegat seluruh akses dan tampilkan halaman pemeliharaan
  if (isMaintenanceActive && !isPrivileged) {
    return <MitraMaintenanceView customHtml={maintenanceConfig.custom_html} />
  }
  
  // 3. Ambil data profil mitra
  const { data: profile } = await supabase
    .from('mitra_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
    
  if (!profile) {
    if (isPrivileged) {
      // Akun privileged (Developer/Admin/Owner) yang membuka portal tanpa profil mitra sendiri
      return (
        <div className="min-h-screen bg-slate-50">
          {isMaintenanceActive && (
            <div className="bg-amber-500 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
              <AlertTriangle className="w-4 h-4 shrink-0 text-white animate-pulse" />
              <span>
                Mode Pemeliharaan (Maintenance) Mitra sedang AKTIF. Portal ini sedang diblokir untuk akun Mitra dan hanya dapat diakses oleh Developer / Admin / Owner.
              </span>
            </div>
          )}
          {children}
        </div>
      )
    }

    return (
      <div className="p-8 max-w-lg mx-auto mt-20 text-center">
        <h2 className="text-xl font-bold mb-2">Profil Mitra Tidak Ditemukan</h2>
        <p className="text-gray-500">Akun Anda belum terdaftar sebagai Mitra. Silakan hubungi admin pusat.</p>
      </div>
    )
  }
  
  const outletIds: string[] = profile.outlet_ids || []
  let outlets: any[] = []
  if (outletIds.length > 0) {
    const { data: out } = await supabase
      .from('outlets')
      .select('*')
      .in('id', outletIds)
    outlets = out || []
  }

  return (
    <MitraOutletProvider profile={profile} outlets={outlets}>
      {isMaintenanceActive && isPrivileged && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
          <AlertTriangle className="w-4 h-4 shrink-0 text-white animate-pulse" />
          <span>
            Mode Pemeliharaan (Maintenance) Mitra sedang AKTIF. Portal ini sedang diblokir untuk akun Mitra dan hanya dapat diakses oleh Developer / Admin / Owner.
          </span>
        </div>
      )}
      {children}
    </MitraOutletProvider>
  )
}
