import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const supabaseService = createServiceClient()
    const { data: profile } = await supabaseService.from('profiles').select('role, outlet_id').eq('id', user.id).single()

    if (!profile || profile.role !== 'kasir') {
      return NextResponse.json({ error: 'Akses ditolak. Harus Kasir.' }, { status: 403 })
    }

    if (!profile.outlet_id) {
      return NextResponse.json({ error: 'Kasir belum dihubungkan ke cabang manapun.' }, { status: 400 })
    }

    // Ambil daftar akun kiosk di cabang ini
    const { data: kioskProfiles, error } = await supabaseService
      .from('profiles')
      .select('id, username')
      .eq('role', 'kiosk')
      .eq('outlet_id', profile.outlet_id)
      .eq('is_active', true)
      .order('username', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ accounts: kioskProfiles || [] })
    
  } catch (err: any) {
    console.error('API Error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memuat akun Kiosk.' }, { status: 500 })
  }
}
