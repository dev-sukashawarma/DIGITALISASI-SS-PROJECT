import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
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

    // 1. Parse body untuk mendapatkan kiosk_id
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
    }

    const { kiosk_id } = body
    if (!kiosk_id) {
      return NextResponse.json({ error: 'ID Akun Kiosk tidak ditemukan.' }, { status: 400 })
    }

    // 2. Cari user kiosk spesifik di outlet yang sama
    const { data: kioskProfile } = await supabaseService
      .from('profiles')
      .select('id, username')
      .eq('id', kiosk_id)
      .eq('role', 'kiosk')
      .eq('outlet_id', profile.outlet_id)
      .eq('is_active', true)
      .single()

    if (!kioskProfile) {
      return NextResponse.json({ 
        error: 'Akun Kiosk tersebut tidak ditemukan atau tidak aktif di cabang ini.' 
      }, { status: 404 })
    }

    const requestUrl = new URL(request.url)
    const origin = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin || 'https://shawarma-order.vercel.app'

    // ARSITEKTUR BARU: Auto-Login Tahan Banting (Anti-Supabase Config Error)
    // 1. Generate password acak yang kuat
    const newPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10)

    // 2. Ubah password akun kiosk tersebut (tidak mengganggu Kiosk lain yang sudah login)
    const { error: updateError } = await supabaseService.auth.admin.updateUserById(
      kioskProfile.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Error updating kiosk password:', updateError)
      return NextResponse.json({ error: 'Gagal membuat akses baru untuk Kiosk.' }, { status: 500 })
    }

    // 3. Buat action_link yang mengarah langsung ke halaman Auth QR kita sendiri
    const actionLink = `${origin}/kiosk/qr-login?u=${encodeURIComponent(kioskProfile.username)}&p=${encodeURIComponent(newPassword)}`

    return NextResponse.json({ action_link: actionLink })
    
  } catch (err: any) {
    console.error('API Error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan internal peladen.' }, { status: 500 })
  }
}
