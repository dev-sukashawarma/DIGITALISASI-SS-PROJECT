import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function verifyAdmin() {
  const cookieStore = cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return false

  const supabaseService = createServiceClient()
  const { data: profile } = await supabaseService.from('profiles').select('role').eq('id', user.id).single()

  if (!profile || profile.role !== 'admin') return false
  return true
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Akses ditolak. Harus Admin.' }, { status: 403 })
  }

  const userId = params.id
  if (!userId) {
    return NextResponse.json({ error: 'ID User tidak valid' }, { status: 400 })
  }

  const supabaseService = createServiceClient()

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { username, password, role, outlet_id, is_active, inactive_reason } = body

  if (!username || !role) {
    return NextResponse.json({ error: 'Username dan role harus diisi' }, { status: 400 })
  }

  if (role !== 'kasir' && role !== 'kiosk') {
    return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
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
  if (existingProfile && existingProfile.id !== userId) {
    return NextResponse.json({ error: 'Username sudah digunakan, silakan pilih username lain.' }, { status: 400 })
  }

  // Update Auth User if password is provided or username changed (email changed)
  const email = `${username}@outlet.local`
  const updateData: any = { email }
  if (password && password.trim() !== '') {
    updateData.password = password
  }

  const { error: authError } = await supabaseService.auth.admin.updateUserById(userId, updateData)
  
  if (authError) {
    console.error(authError)
    let errMsg = 'Terjadi kesalahan saat mengupdate data autentikasi.'
    if (authError.message.includes('invalid format') || authError.message.includes('Unable to validate email')) {
      errMsg = 'Format username tidak valid.'
    } else if (authError.message.includes('already registered')) {
      errMsg = 'Username sudah digunakan, silakan pilih yang lain.'
    } else if (authError.message.includes('Password')) {
      errMsg = 'Password terlalu lemah, minimal 6 karakter.'
    }
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  // Update Profile
  const { error: profileError } = await supabaseService.from('profiles').update({
    role,
    outlet_id,
    username,
    is_active: is_active ?? true,
    inactive_reason: inactive_reason || null
  }).eq('id', userId)

  if (profileError) {
    console.error(profileError)
    return NextResponse.json({ error: 'Gagal update profil user' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Akses ditolak. Harus Admin.' }, { status: 403 })
  }

  const userId = params.id
  if (!userId) {
    return NextResponse.json({ error: 'ID User tidak valid' }, { status: 400 })
  }

  const supabaseService = createServiceClient()
  
  const { error } = await supabaseService.auth.admin.deleteUser(userId)
  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menghapus user: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
