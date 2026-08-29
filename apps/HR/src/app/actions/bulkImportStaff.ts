'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import type { ParsedStaffRow } from '@/lib/parseStaffCsv'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface BulkImportSummary {
  total: number
  insertedCount: number
  updatedCount: number
  failedCount: number
  errors: { name: string; error: string }[]
}

export async function bulkImportStaffAction(
  rows: ParsedStaffRow[],
  options?: { updateExisting?: boolean; defaultPassword?: string }
): Promise<BulkImportSummary> {
  await requireRole(['admin', 'owner', 'admin_hr'])

  const admin = getAdminSupabase()
  const updateExisting = options?.updateExisting ?? true
  const defaultPassword = options?.defaultPassword || '123456'

  // Fetch existing staff for quick duplicate checking
  const { data: existingStaff } = await admin
    .from('outlet_staff')
    .select('id, name, username, role')

  const existingMapByName = new Map<string, any>()
  const existingMapByUsername = new Map<string, any>()

  existingStaff?.forEach((s) => {
    if (s.name) existingMapByName.set(s.name.toLowerCase().trim(), s)
    if (s.username) existingMapByUsername.set(s.username.toLowerCase().trim(), s)
  })

  let insertedCount = 0
  let updatedCount = 0
  let failedCount = 0
  const errors: { name: string; error: string }[] = []

  for (const row of rows) {
    try {
      const cleanNameKey = row.name.toLowerCase().trim()
      const cleanUsernameKey = row.username.toLowerCase().trim()

      const existing =
        existingMapByName.get(cleanNameKey) || existingMapByUsername.get(cleanUsernameKey)

      if (existing) {
        if (updateExisting) {
          // Update existing staff
          const { error: updateStaffErr } = await admin
            .from('outlet_staff')
            .update({
              role: row.role,
              outlet_id: row.outletId || null,
              status: row.status,
              contract_type: row.contractType,
              phone: row.phone || undefined,
            })
            .eq('id', existing.id)

          if (updateStaffErr) throw updateStaffErr

          // Upsert financials
          if (row.basicSalary > 0 || row.allowancePresence > 0 || row.bankAccountNumber) {
            await admin
              .from('staff_financials')
              .upsert(
                {
                  staff_id: existing.id,
                  basic_salary: row.basicSalary,
                  allowance_presence: row.allowancePresence,
                  allowance_position: 0,
                  bank_name: row.bankName || '',
                  bank_account_number: row.bankAccountNumber || '',
                  bank_account_name: row.bankAccountName || '',
                },
                { onConflict: 'staff_id' }
              )
          }

          updatedCount++
        }
      } else {
        // Create new staff
        const email = `${cleanUsernameKey}@outlet.local`

        // 1. Create Auth User
        const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
          email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            role: row.role,
            name: row.name,
            outlet_id: row.outletId,
          },
        })

        if (authErr) {
          throw new Error(`Gagal create user auth (${authErr.message})`)
        }

        const staffId = authUser.user.id

        // 2. Insert into outlet_staff
        const { error: insertStaffErr } = await admin.from('outlet_staff').insert({
          id: staffId,
          outlet_id: row.outletId || null,
          name: row.name,
          username: row.username,
          role: row.role,
          status: row.status,
          contract_type: row.contractType,
          is_bonus_eligible: true,
          phone: row.phone || null,
          leave_quota: 12,
        })

        if (insertStaffErr) {
          await admin.auth.admin.deleteUser(staffId)
          throw insertStaffErr
        }

        // 3. Insert into staff_financials
        if (row.basicSalary > 0 || row.allowancePresence > 0 || row.bankAccountNumber) {
          await admin.from('staff_financials').insert({
            staff_id: staffId,
            basic_salary: row.basicSalary,
            allowance_presence: row.allowancePresence,
            allowance_position: 0,
            bank_name: row.bankName || '',
            bank_account_number: row.bankAccountNumber || '',
            bank_account_name: row.bankAccountName || '',
          })
        }

        insertedCount++
      }
    } catch (err: any) {
      failedCount++
      errors.push({
        name: row.name,
        error: err.message || 'Gagal memproses data karyawan',
      })
    }
  }

  return {
    total: rows.length,
    insertedCount,
    updatedCount,
    failedCount,
    errors,
  }
}
