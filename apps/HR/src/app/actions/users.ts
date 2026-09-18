'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import type { StaffFormValues } from '@/lib/types'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function createStaffSync(values: StaffFormValues) {
  await requireRole(['admin', 'owner', 'admin_hr'])

  const admin = getAdminSupabase()
  
  const {
    name, username, password, role, outlet_id, outlet_ids,
    nik, email: personal_email, phone, address_ktp, address_domicile,
    birth_place, birth_date, gender, religion,
    emergency_name, emergency_relationship, emergency_phone,
    nip, contract_type, join_date, resign_date, leave_quota,
    basic_salary, allowance_position, allowance_presence,
    allowance_meal, allowance_transport, allowance_communication,
    sales_bonus, deduction_kasbon, deduction_bpjs,
    bank_name, bank_account_number, bank_account_name,
    npwp, bpjs_ketenagakerjaan, bpjs_kesehatan
  } = values as any

  const cleanNik = typeof nik === 'string' && nik.trim() ? nik.trim() : null
  const cleanNip = typeof nip === 'string' && nip.trim() ? nip.trim() : null
  const cleanPersonalEmail = typeof personal_email === 'string' && personal_email.trim() ? personal_email.trim() : null
  const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null

  // Pre-check duplicate NIK
  if (cleanNik) {
    const { data: conflictNik } = await admin
      .from('outlet_staff')
      .select('id, name, username, outlets(name)')
      .eq('nik', cleanNik)
      .maybeSingle()
    if (conflictNik) {
      const outletName = (conflictNik as any).outlets?.name || 'Pusat'
      throw new Error(`NIK "${cleanNik}" sudah terdaftar atas nama karyawan "${conflictNik.name}" (${outletName}). Mohon periksa kembali data NIK.`)
    }
  }

  // Pre-check duplicate NIP
  if (cleanNip) {
    const { data: conflictNip } = await admin
      .from('outlet_staff')
      .select('id, name, username, outlets(name)')
      .eq('nip', cleanNip)
      .maybeSingle()
    if (conflictNip) {
      const outletName = (conflictNip as any).outlets?.name || 'Pusat'
      throw new Error(`NIP "${cleanNip}" sudah terdaftar atas nama karyawan "${conflictNip.name}" (${outletName}). Mohon periksa kembali data NIP.`)
    }
  }

  const email = `${String(username).toLowerCase().replace(/[^a-z0-9_]/g, '')}@outlet.local`

  // 1. Create auth user
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: password || '123456',
    email_confirm: true,
    user_metadata: { role, name, outlet_id },
  })
  if (createError) throw new Error(`Gagal membuat akun auth: ${createError.message}`)

  const staffId = newUser.user.id

  // 2. Insert into outlet_staff
  const { error: insertError } = await admin.from('outlet_staff').insert({
    id: staffId,
    outlet_id: outlet_id || null,
    name,
    role,
    username,
    status: 'active',
    is_bonus_eligible: values.is_bonus_eligible !== undefined ? values.is_bonus_eligible : true,
    nik: cleanNik,
    email: cleanPersonalEmail,
    phone: cleanPhone,
    address_ktp: address_ktp || null,
    address_domicile: address_domicile || null,
    birth_place: birth_place || null,
    birth_date: birth_date || null,
    gender: gender || null,
    religion: religion || null,
    emergency_name: emergency_name || null,
    emergency_relationship: emergency_relationship || null,
    emergency_phone: emergency_phone || null,
    nip: cleanNip,
    contract_type: contract_type || null,
    join_date: join_date || null,
    resign_date: resign_date || null,
    leave_quota: typeof leave_quota === 'number' ? leave_quota : 12,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(staffId)
    if (insertError.code === '23505' || insertError.message.includes('outlet_staff_nik_key')) {
      throw new Error(`NIK "${cleanNik}" sudah terdaftar pada karyawan lain. Mohon gunakan NIK yang berbeda.`)
    }
    if (insertError.code === '23505' || insertError.message.includes('outlet_staff_nip_key')) {
      throw new Error(`NIP "${cleanNip}" sudah terdaftar pada karyawan lain.`)
    }
    if (insertError.code === '23505' || insertError.message.includes('outlet_staff_username_key')) {
      throw new Error(`Username sudah terdaftar pada karyawan lain.`)
    }
    throw new Error(`Gagal menyimpan data staff: ${insertError.message}`)
  }

  // 3. Financials
  if (
    bank_name ||
    bank_account_number ||
    bank_account_name ||
    basic_salary !== undefined ||
    allowance_meal !== undefined ||
    allowance_transport !== undefined ||
    allowance_communication !== undefined ||
    sales_bonus !== undefined ||
    deduction_kasbon !== undefined ||
    deduction_bpjs !== undefined
  ) {
    await admin.from('staff_financials').insert({
      staff_id: staffId,
      basic_salary: basic_salary || 0,
      allowance_meal: allowance_meal || 0,
      allowance_transport: allowance_transport || 0,
      allowance_communication: allowance_communication || 0,
      sales_bonus: sales_bonus || 0,
      deduction_kasbon: deduction_kasbon || 0,
      deduction_bpjs: deduction_bpjs || 0,
      allowance_position: allowance_position || 0,
      allowance_presence: allowance_presence || 0,
      bank_name: bank_name || '',
      bank_account_number: bank_account_number || '',
      bank_account_name: bank_account_name || '',
      npwp: (typeof npwp === 'string' && npwp.trim()) || null,
      bpjs_ketenagakerjaan: (typeof bpjs_ketenagakerjaan === 'string' && bpjs_ketenagakerjaan.trim()) || null,
      bpjs_kesehatan: (typeof bpjs_kesehatan === 'string' && bpjs_kesehatan.trim()) || null,
    })
  }

  if (role === 'leader' && Array.isArray(outlet_ids)) {
    const rows = outlet_ids.map((oid: string) => ({ staff_id: staffId, outlet_id: oid }))
    await admin.from('staff_outlets').insert(rows)
  }

  return { ok: true, staff_id: staffId }
}

export async function updateStaffSync(vars: { staff_id: string } & Partial<StaffFormValues>) {
  await requireRole(['admin', 'owner', 'admin_hr'])

  const admin = getAdminSupabase()
  const { staff_id, ...values } = vars
  if (!staff_id) throw new Error('ID staf tidak valid')

  const {
    name, role, outlet_id, outlet_ids, status, is_bonus_eligible,
    nik, email: personal_email, phone, address_ktp, address_domicile,
    birth_place, birth_date, gender, religion,
    emergency_name, emergency_relationship, emergency_phone,
    nip, contract_type, join_date, resign_date, leave_quota,
    basic_salary, allowance_position, allowance_presence,
    allowance_meal, allowance_transport, allowance_communication,
    sales_bonus, deduction_kasbon, deduction_bpjs,
    bank_name, bank_account_number, bank_account_name,
    npwp, bpjs_ketenagakerjaan, bpjs_kesehatan
  } = values as any

  const cleanNik = typeof nik === 'string' && nik.trim() ? nik.trim() : null
  const cleanNip = typeof nip === 'string' && nip.trim() ? nip.trim() : null
  const cleanPersonalEmail = typeof personal_email === 'string' && personal_email.trim() ? personal_email.trim() : null
  const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null

  // 1. Check duplicate NIK if provided
  if (cleanNik) {
    const { data: conflictNik } = await admin
      .from('outlet_staff')
      .select('id, name, username, outlets(name)')
      .eq('nik', cleanNik)
      .neq('id', staff_id)
      .maybeSingle()

    if (conflictNik) {
      const outletName = (conflictNik as any).outlets?.name || 'Pusat'
      throw new Error(`NIK "${cleanNik}" sudah terdaftar atas nama karyawan "${conflictNik.name}" (${outletName}). Mohon periksa kembali NIK yang dimasukkan.`)
    }
  }

  // 2. Check duplicate NIP if provided
  if (cleanNip) {
    const { data: conflictNip } = await admin
      .from('outlet_staff')
      .select('id, name, username, outlets(name)')
      .eq('nip', cleanNip)
      .neq('id', staff_id)
      .maybeSingle()

    if (conflictNip) {
      const outletName = (conflictNip as any).outlets?.name || 'Pusat'
      throw new Error(`NIP "${cleanNip}" sudah terdaftar atas nama karyawan "${conflictNip.name}" (${outletName}). Mohon periksa kembali NIP yang dimasukkan.`)
    }
  }

  // 3. Build outlet_staff patch
  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (role !== undefined) patch.role = role
  if (outlet_id !== undefined) patch.outlet_id = outlet_id || null
  if (status !== undefined) patch.status = status
  if (is_bonus_eligible !== undefined) patch.is_bonus_eligible = Boolean(is_bonus_eligible)
  if (nik !== undefined) patch.nik = cleanNik
  if (personal_email !== undefined) patch.email = cleanPersonalEmail
  if (phone !== undefined) patch.phone = cleanPhone
  if (address_ktp !== undefined) patch.address_ktp = address_ktp || null
  if (address_domicile !== undefined) patch.address_domicile = address_domicile || null
  if (birth_place !== undefined) patch.birth_place = birth_place || null
  if (birth_date !== undefined) patch.birth_date = birth_date || null
  if (gender !== undefined) patch.gender = gender || null
  if (religion !== undefined) patch.religion = religion || null
  if (emergency_name !== undefined) patch.emergency_name = emergency_name || null
  if (emergency_relationship !== undefined) patch.emergency_relationship = emergency_relationship || null
  if (emergency_phone !== undefined) patch.emergency_phone = emergency_phone || null
  if (nip !== undefined) patch.nip = cleanNip
  if (contract_type !== undefined) patch.contract_type = contract_type || null
  if (join_date !== undefined) patch.join_date = join_date || null
  if (resign_date !== undefined) patch.resign_date = resign_date || null
  if (leave_quota !== undefined) patch.leave_quota = leave_quota !== null ? Number(leave_quota) : 12

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await admin.from('outlet_staff').update(patch).eq('id', staff_id)
    if (updateError) {
      if (updateError.code === '23505' || updateError.message.includes('outlet_staff_nik_key')) {
        throw new Error(`NIK yang dimasukkan sudah terdaftar pada karyawan lain. Mohon gunakan NIK yang berbeda.`)
      }
      if (updateError.code === '23505' || updateError.message.includes('outlet_staff_nip_key')) {
        throw new Error(`NIP yang dimasukkan sudah terdaftar pada karyawan lain.`)
      }
      if (updateError.code === '23505' || updateError.message.includes('outlet_staff_username_key')) {
        throw new Error(`Username sudah digunakan oleh akun lain.`)
      }
      throw new Error(`Gagal memperbarui profil staf: ${updateError.message}`)
    }
  }

  // 4. Update / Upsert staff_financials
  const hasFinancialsInput =
    basic_salary !== undefined ||
    allowance_meal !== undefined ||
    allowance_transport !== undefined ||
    allowance_communication !== undefined ||
    sales_bonus !== undefined ||
    deduction_kasbon !== undefined ||
    deduction_bpjs !== undefined ||
    allowance_position !== undefined ||
    allowance_presence !== undefined ||
    bank_name !== undefined ||
    bank_account_number !== undefined ||
    bank_account_name !== undefined ||
    npwp !== undefined ||
    bpjs_ketenagakerjaan !== undefined ||
    bpjs_kesehatan !== undefined

  if (hasFinancialsInput) {
    const finPayload = {
      staff_id,
      basic_salary: basic_salary || 0,
      allowance_meal: allowance_meal || 0,
      allowance_transport: allowance_transport || 0,
      allowance_communication: allowance_communication || 0,
      sales_bonus: sales_bonus || 0,
      deduction_kasbon: deduction_kasbon || 0,
      deduction_bpjs: deduction_bpjs || 0,
      allowance_position: allowance_position || 0,
      allowance_presence: allowance_presence || 0,
      bank_name: bank_name || '',
      bank_account_number: bank_account_number || '',
      bank_account_name: bank_account_name || '',
      npwp: (typeof npwp === 'string' && npwp.trim()) || null,
      bpjs_ketenagakerjaan: (typeof bpjs_ketenagakerjaan === 'string' && bpjs_ketenagakerjaan.trim()) || null,
      bpjs_kesehatan: (typeof bpjs_kesehatan === 'string' && bpjs_kesehatan.trim()) || null,
      updated_at: new Date().toISOString(),
    }

    const { error: finError } = await admin.from('staff_financials').upsert(finPayload, { onConflict: 'staff_id' })
    if (finError) throw new Error(`Gagal menyimpan data finansial: ${finError.message}`)
  }

  // 5. Update staff_outlets if leader
  if ((role === 'leader' || role === 'area_manager') && Array.isArray(outlet_ids)) {
    await admin.from('staff_outlets').delete().eq('staff_id', staff_id)
    if (outlet_ids.length > 0) {
      const rows = outlet_ids.map((oid: string) => ({ staff_id, outlet_id: oid }))
      await admin.from('staff_outlets').insert(rows)
    }
  }

  return { ok: true, staff_id }
}

export async function toggleStaffBonusEligibility(staffId: string, isBonusEligible: boolean) {
  await requireRole(['admin', 'owner', 'admin_hr'])
  const admin = getAdminSupabase()
  const { error } = await admin
    .from('outlet_staff')
    .update({ is_bonus_eligible: isBonusEligible })
    .eq('id', staffId)

  if (error) {
    throw new Error(`Gagal mengubah status bonus: ${error.message}`)
  }

  return { ok: true }
}

export async function deleteStaffSync(staffId: string): Promise<{
  ok: boolean
  archived?: boolean
  message: string
}> {
  await requireRole(['admin', 'owner', 'admin_hr'])

  if (!staffId) throw new Error('ID staf tidak valid')
  const admin = getAdminSupabase()

  // 1. Fetch staff info
  const { data: staff, error: staffErr } = await admin
    .from('outlet_staff')
    .select('id, name, status, outlet_id, resign_date')
    .eq('id', staffId)
    .single()

  if (staffErr || !staff) {
    throw new Error('Data karyawan tidak ditemukan')
  }

  // 2. Check operational records: shifts & attendance
  const { count: shiftCount } = await admin
    .from('shifts')
    .select('*', { count: 'exact', head: true })
    .or(`staff_id.eq.${staffId},closed_by.eq.${staffId}`)

  const { count: attendanceCount } = await admin
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('outlet_staff_id', staffId)

  const hasOperationalHistory = (shiftCount ?? 0) > 0 || (attendanceCount ?? 0) > 0

  if (hasOperationalHistory) {
    const today = new Date().toISOString().split('T')[0]

    // Soft delete / archive
    const { error: updateErr } = await admin
      .from('outlet_staff')
      .update({
        status: 'inactive',
        is_active: false,
        inactive_reason: 'Diarsipkan oleh HR (memiliki riwayat operasional shift/absensi)',
        resign_date: staff.resign_date || today,
      })
      .eq('id', staffId)

    if (updateErr) {
      throw new Error(`Gagal menonaktifkan karyawan: ${updateErr.message}`)
    }

    // Unassign from all outlets
    await admin.from('staff_outlets').delete().eq('staff_id', staffId)

    // Remove or revoke login credentials from auth.users
    try {
      await admin.auth.admin.deleteUser(staffId)
    } catch (authErr) {
      console.warn('Gagal menghapus user auth (kemungkinan sudah dihapus atau ada relasi auth):', authErr)
      try {
        await admin.auth.admin.updateUserById(staffId, {
          ban_duration: '876000h',
          user_metadata: { deactivated: true },
        })
      } catch (_) {}
    }

    return {
      ok: true,
      archived: true,
      message: `Karyawan "${staff.name}" memiliki riwayat operasional (${shiftCount || 0} shift, ${attendanceCount || 0} absensi). Akun berhasil diarsipkan (status Nonaktif) & akses login dicabut demi integritas data keuangan.`,
    }
  }

  // 3. No operational history -> Try hard delete
  await admin.from('staff_outlets').delete().eq('staff_id', staffId)
  await admin.from('staff_financials').delete().eq('staff_id', staffId)

  const { error: deleteError } = await admin.from('outlet_staff').delete().eq('id', staffId)
  if (deleteError) {
    if (deleteError.code === '23503' || deleteError.message.includes('foreign key constraint')) {
      const today = new Date().toISOString().split('T')[0]
      await admin
        .from('outlet_staff')
        .update({
          status: 'inactive',
          is_active: false,
          inactive_reason: 'Diarsipkan oleh HR (terkait data historis)',
          resign_date: staff.resign_date || today,
        })
        .eq('id', staffId)

      try {
        await admin.auth.admin.deleteUser(staffId)
      } catch (_) {}

      return {
        ok: true,
        archived: true,
        message: `Karyawan "${staff.name}" terkait dengan data sistem. Akun berhasil diarsipkan (status Nonaktif) & akses login dicabut.`,
      }
    }
    throw new Error(`Gagal menghapus karyawan: ${deleteError.message}`)
  }

  // Delete auth user
  try {
    await admin.auth.admin.deleteUser(staffId)
  } catch (authErr) {
    console.warn('Gagal menghapus auth user:', authErr)
  }

  return {
    ok: true,
    archived: false,
    message: `Karyawan "${staff.name}" berhasil dihapus permanen.`,
  }
}
