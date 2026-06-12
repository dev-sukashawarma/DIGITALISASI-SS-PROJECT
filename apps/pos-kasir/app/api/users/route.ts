import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  // Verifikasi apakah yang request adalah admin
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
  const { data: profile } = await supabaseService.from('profiles').select('role').eq('id', user.id).single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Akses ditolak. Harus Admin.' }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { username, password, role, outlet_id, is_active, inactive_reason } = body

  if (!username || !password || !role) {
    return NextResponse.json({ error: 'Username, password, dan role harus diisi' }, { status: 400 })
  }

  if (role !== 'kasir' && role !== 'kiosk') {
    return NextResponse.json({ error: 'Hanya bisa membuat user kasir atau kiosk' }, { status: 400 })
  }

  if (!outlet_id) {
    return NextResponse.json({ error: 'Cabang (Outlet) harus dipilih' }, { status: 400 })
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/
  if (!usernameRegex.test(username)) {
    return NextResponse.json({ error: 'Username hanya boleh berisi huruf, angka, dan underscore (_) tanpa spasi.' }, { status: 400 })
  }

  // Cek apakah username sudah digunakan
  const { data: existingProfile } = await supabaseService.from('profiles').select('id').eq('username', username).single()
  if (existingProfile) {
    return NextResponse.json({ error: 'Username sudah digunakan, silakan pilih username lain.' }, { status: 400 })
  }

  // Karena ini email-based auth di supabase, kita buat "pseudo-email"
  const email = `${username}@outlet.local`

  // Buat user di auth.users menggunakan service role
  const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (authError || !authData.user) {
    console.error(authError)
    let errMsg = 'Terjadi kesalahan pada sistem autentikasi.'
    if (authError?.message?.includes('invalid format') || authError?.message?.includes('Unable to validate email')) {
      errMsg = 'Format username tidak valid.'
    } else if (authError?.message?.includes('already registered')) {
      errMsg = 'Username sudah digunakan, silakan pilih yang lain.'
    } else if (authError?.message?.includes('Password')) {
      errMsg = 'Password terlalu lemah, minimal 6 karakter.'
    }
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  // Tambahkan profile
  const { error: profileError } = await supabaseService.from('profiles').insert({
    id: authData.user.id,
    role,
    outlet_id,
    username,
    is_active: is_active ?? true,
    inactive_reason: inactive_reason || null
  })

  if (profileError) {
    console.error(profileError)
    // Rollback user
    await supabaseService.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Gagal menyimpan profil user' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
