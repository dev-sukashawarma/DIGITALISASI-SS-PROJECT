import { NextResponse } from 'next/server'
import { createClient, createServiceClient, ServiceRoleMissingError } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // Verifikasi apakah yang request adalah admin.
    // Pakai client sesi (RLS), BUKAN service client — supaya cek otorisasi tetap
    // jalan meski env service-role bermasalah, dan error-nya jelas di langkah yang benar.
    const supabaseAuth = await createClient()

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { data: profile } = await supabaseAuth
      .from('outlet_staff')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      return NextResponse.json({ error: 'Akses ditolak. Harus Admin atau Owner.' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
    }

    const { username, password, role, outlet_id, outlet_ids, is_active, inactive_reason } = body

    if (!username || !password || !role) {
      return NextResponse.json({ error: 'Username, password, dan role harus diisi' }, { status: 400 })
    }

    const allowedRoles = [
      'crew', 'kitchen', 'kiosk', 'leader', 
      'regional_manager', 'area_manager',
      'admin', 'admin_hr', 'admin_finance', 'purchasing', 
      'owner', 'mitra'
    ]
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Role yang dipilih tidak valid' }, { status: 400 })
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
    if (existingProfile) {
      return NextResponse.json({ error: 'Username sudah digunakan, silakan pilih username lain.' }, { status: 400 })
    }

    const supabaseService = createServiceClient()

    // Karena ini email-based auth di supabase, kita buat "pseudo-email"
    const email = `${username}@ss.com`

    // Buat user di auth.users menggunakan service role
    const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError || !authData.user) {
      console.error(authError)
      let errMsg = `Terjadi kesalahan pada sistem autentikasi: ${authError?.message ?? 'user tidak terbentuk'}`
      if (authError?.message?.includes('invalid format') || authError?.message?.includes('Unable to validate email')) {
        errMsg = 'Format username tidak valid.'
      } else if (authError?.message?.includes('already registered')) {
        errMsg = 'Username sudah digunakan, silakan pilih yang lain.'
      } else if (authError?.message?.includes('Password')) {
        errMsg = 'Password terlalu lemah, minimal 6 karakter.'
      }
      return NextResponse.json({ error: errMsg }, { status: 500 })
    }

    // Tambahkan baris outlet_staff (identitas kanonik).
    // name wajib (NOT NULL) → pakai username sebagai nama default.
    const { error: profileError } = await supabaseService.from('outlet_staff').insert({
      id: authData.user.id,
      name: username,
      role,
      outlet_id: primaryOutletId,
      username,
      status: (is_active ?? true) ? 'active' : 'inactive',
      is_active: is_active ?? true,
      inactive_reason: inactive_reason || null
    })

    if (profileError) {
      console.error(profileError)
      // Rollback user
      await supabaseService.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Gagal menyimpan profil user: ${profileError.message}` },
        { status: 500 }
      )
    }

    // Insert staff_outlets mapping so they have POS access to the new outlet(s)
    const staffOutletsData = finalOutletIds.map((oId: string) => ({
      staff_id: authData.user.id,
      outlet_id: oId
    }));
    const { error: insertStaffOutletsError } = await supabaseService.from('staff_outlets').insert(staffOutletsData)
    if (insertStaffOutletsError) {
      console.error('Gagal menambahkan staff_outlets baru:', insertStaffOutletsError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ServiceRoleMissingError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error('POST /api/users gagal:', err)
    return NextResponse.json(
      { error: `Kesalahan server: ${err instanceof Error ? err.message : 'tidak diketahui'}` },
      { status: 500 }
    )
  }
}
