import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveApiUser } from '@/lib/api-auth'

const ALLOWED_ROLES = ['crew', 'leader', 'spv', 'regional_manager', 'admin']

export async function GET(request: Request) {
  try {
    const user = await resolveApiUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const supabaseService = createServiceClient()
    const { data: profile } = await supabaseService.from('outlet_staff').select('role, outlet_id').eq('id', user.id).single()

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya staf kasir/cabang yang diizinkan.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const targetOutletId = profile.outlet_id || searchParams.get('outlet_id')

    if (!targetOutletId) {
      return NextResponse.json({ error: 'Kasir belum dihubungkan ke cabang manapun.' }, { status: 400 })
    }

    // Ambil daftar akun kiosk di cabang ini
    const { data: kioskProfiles, error } = await supabaseService
      .from('outlet_staff')
      .select('id, username')
      .eq('role', 'kiosk')
      .eq('outlet_id', targetOutletId)
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
