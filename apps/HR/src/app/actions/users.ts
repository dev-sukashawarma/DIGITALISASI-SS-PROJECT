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
    bank_name, bank_account_number, bank_account_name,
    npwp, bpjs_ketenagakerjaan, bpjs_kesehatan
  } = values as any

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
    nik: nik || null,
    email: personal_email || null,
    phone: phone || null,
    address_ktp: address_ktp || null,
    address_domicile: address_domicile || null,
    birth_place: birth_place || null,
    birth_date: birth_date || null,
    gender: gender || null,
    religion: religion || null,
    emergency_name: emergency_name || null,
    emergency_relationship: emergency_relationship || null,
    emergency_phone: emergency_phone || null,
    nip: nip || null,
    contract_type: contract_type || null,
    join_date: join_date || null,
    resign_date: resign_date || null,
    leave_quota: typeof leave_quota === 'number' ? leave_quota : 12,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(staffId)
    throw new Error(`Gagal menyimpan data staff: ${insertError.message}`)
  }

  // 3. Financials
  if (bank_name || bank_account_number || bank_account_name || basic_salary !== undefined) {
    await admin.from('staff_financials').insert({
      staff_id: staffId,
      basic_salary: basic_salary || 0,
      allowance_position: allowance_position || 0,
      allowance_presence: allowance_presence || 0,
      bank_name: bank_name || '',
      bank_account_number: bank_account_number || '',
      bank_account_name: bank_account_name || '',
      npwp: npwp || null,
      bpjs_ketenagakerjaan: bpjs_ketenagakerjaan || null,
      bpjs_kesehatan: bpjs_kesehatan || null,
    })
  }

  if (role === 'leader' && Array.isArray(outlet_ids)) {
    const rows = outlet_ids.map((oid: string) => ({ staff_id: staffId, outlet_id: oid }))
    await admin.from('staff_outlets').insert(rows)
  }

  return { ok: true, staff_id: staffId }
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
