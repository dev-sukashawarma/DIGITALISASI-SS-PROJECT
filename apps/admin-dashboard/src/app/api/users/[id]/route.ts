import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verifyAdmin() {
  const supabaseAuth = await createClient()

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return false

  const supabaseService = createServiceClient()
  const { data: profile } = await supabaseService.from('outlet_staff').select('role').eq('id', user.id).single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) return false
  return true
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Akses ditolak. Harus Admin.' }, { status: 403 })
  }

  const { id: userId } = await params
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

  const allowedRoles = ['crew', 'kiosk', 'spv', 'owner', 'leader', 'admin', 'kitchen']
  if (!allowedRoles.includes(role)) {
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
  const { data: existingProfile } = await supabaseService.from('outlet_staff').select('id').eq('username', username).single()
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
  const { error: profileError } = await supabaseService.from('outlet_staff').update({
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Akses ditolak. Harus Admin.' }, { status: 403 })
  }

  const { id: userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'ID User tidak valid' }, { status: 400 })
  }

  const supabaseService = createServiceClient()
  
  // 1. Delete from outlet_staff first
  const { error: profileError } = await supabaseService.from('outlet_staff').delete().eq('id', userId)
  if (profileError) {
    console.error("Gagal menghapus profile:", profileError)
    return NextResponse.json({ error: 'Gagal menghapus profil user: ' + profileError.message }, { status: 500 })
  }

  // 2. Delete Auth User
  const { error } = await supabaseService.auth.admin.deleteUser(userId)
  if (error) {
    console.error("Gagal menghapus auth user:", error)
    // If it fails to delete the auth user, it's a partial failure, but we already deleted the profile.
    // If the error is simply because the user doesn't exist anymore, we can just return success.
    if (error.status === 404 || error.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Gagal menghapus autentikasi user: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
