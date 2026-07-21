import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { MitraOutletProvider } from './MitraOutletContext'
import { redirect } from 'next/navigation'

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
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  
  const { data: profile } = await supabase
    .from('mitra_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
    
  if (!profile) {
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
      {children}
    </MitraOutletProvider>
  )
}
