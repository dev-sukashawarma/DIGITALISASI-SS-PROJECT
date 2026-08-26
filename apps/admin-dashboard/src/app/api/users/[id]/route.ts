import { NextResponse } from 'next/server'
import { createClient, createServiceClient, ServiceRoleMissingError } from '@/lib/supabase/server'

/** Ubah exception apa pun jadi respons JSON — jangan biarkan Next membalas HTML 500. */
function errorResponse(err: unknown) {
  if (err instanceof ServiceRoleMissingError) {
    return NextResponse.json({ error: err.message }, { status: 503 })
  }
  console.error('/api/users/[id] gagal:', err)
  return NextResponse.json(
    { error: `Kesalahan server: ${err instanceof Error ? err.message : 'tidak diketahui'}` },
    { status: 500 }
  )
}

// Cek otorisasi memakai client sesi (RLS), bukan service client, supaya tidak
// bergantung pada env service-role hanya untuk membaca role sendiri.
async function verifyAdmin() {
  const supabaseAuth = await createClient()

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabaseAuth
    .from('outlet_staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) return null
  return supabaseAuth
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseAuth = await verifyAdmin()
    if (!supabaseAuth) {
      return NextResponse.json({ error: 'Akses ditolak. Harus Admin.' }, { status: 403 })
    }

    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'ID User tidak valid' }, { status: 400 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
    }

    const { username, password, role, outlet_id, outlet_ids, is_active, inactive_reason, is_bonus_eligible } = body

    if (!username || !role) {
      return NextResponse.json({ error: 'Username dan role harus diisi' }, { status: 400 })
    }

    const allowedRoles = [
      'crew', 'kitchen', 'kiosk', 'leader', 
      'regional_manager', 'area_manager',
      'admin', 'admin_hr', 'admin_finance', 'purchasing', 
      'owner', 'mitra'
    ]
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }

    const isMultiOutletRole = [
      'admin', 'owner', 'regional_manager', 'area_manager', 
      'leader', 'admin_hr', 'admin_finance', 
      'purchasing', 'mitra'
    ].includes(role);
    const finalOutletIds = (isMultiOutletRole && Array.isArray(outlet_ids) && outlet_ids.length > 0) 
      ? outlet_ids 
      : [outlet_id].filter(Boolean);

    if (finalOutletIds.length === 0) {
      return NextResponse.json({ error: 'Cabang (Outlet) harus dipilih' }, { status: 400 })
    }

    const primaryOutletId = finalOutletIds[0];

    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ error: 'Username hanya boleh berisi huruf, angka, dan underscore (_) tanpa spasi.' }, { status: 400 })
    }

    // Cek apakah username sudah digunakan
    const { data: existingProfile } = await supabaseAuth
      .from('outlet_staff')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existingProfile && existingProfile.id !== userId) {
      return NextResponse.json({ error: 'Username sudah digunakan, silakan pilih username lain.' }, { status: 400 })
    }

    const supabaseService = createServiceClient()

    // Update Auth User if password is provided or username changed (email changed)
    const email = `${username}@ss.com`
    const updateData: Record<string, string> = { email }
    if (password && password.trim() !== '') {
      updateData.password = password
    }

    const { error: authError } = await supabaseService.auth.admin.updateUserById(userId, updateData)

    if (authError) {
      console.error(authError)
      let errMsg = `Terjadi kesalahan saat mengupdate data autentikasi: ${authError.message}`
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
      outlet_id: primaryOutletId,
      username,
      is_active: is_active ?? true,
      inactive_reason: inactive_reason || null,
      is_bonus_eligible: is_bonus_eligible !== undefined ? is_bonus_eligible : true
    }).eq('id', userId)

    if (profileError) {
      console.error(profileError)
      return NextResponse.json({ error: `Gagal update profil user: ${profileError.message}` }, { status: 500 })
    }

    // --- Migrate HR Data (Attendance & Staff Outlets) ---
    // Update attendance_logs to point to the new outlet, allowing them to clock in/out at the new outlet
    // We do NOT move financial data like shifts, cash_transaction, or petty_cash to keep accounting history intact.
    const { error: attendanceError } = await supabaseService.from('attendance_logs').update({
      outlet_id: primaryOutletId
    }).eq('staff_id', userId)

    if (attendanceError) {
      console.error('Gagal memindahkan data absensi:', attendanceError)
    }

    // Update staff_outlets mapping so they have POS access to the new outlet(s)
    const { error: deleteStaffOutletsError } = await supabaseService.from('staff_outlets').delete().eq('staff_id', userId)
    if (deleteStaffOutletsError) {
      console.error('Gagal mereset staff_outlets:', deleteStaffOutletsError)
    } else {
      const staffOutletsData = finalOutletIds.map((oId: string) => ({
        staff_id: userId,
        outlet_id: oId
      }));
      const { error: insertStaffOutletsError } = await supabaseService.from('staff_outlets').insert(staffOutletsData)
      if (insertStaffOutletsError) {
        console.error('Gagal menambahkan staff_outlets baru:', insertStaffOutletsError)
      }
    }
    // ----------------------------------------------------

    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseAuth = await verifyAdmin()
    if (!supabaseAuth) {
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
  } catch (err) {
    return errorResponse(err)
  }
}
