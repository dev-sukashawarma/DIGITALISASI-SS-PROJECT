'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/authz'

/**
 * Developer action to change user role globally.
 */
export async function changeUserRoleGlobal(userId: string, newRole: string) {
  // Only developer can perform this
  await requireRole(['developer'])
  
  const supabase = await createClient()

  // Update staff role
  const { error } = await supabase
    .from('outlet_staff')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

/**
 * Developer action to move a user to a different outlet.
 */
export async function moveUserOutletGlobal(userId: string, newOutletId: string | null) {
  await requireRole(['developer'])
  
  const supabase = await createClient()

  const { error } = await supabase
    .from('outlet_staff')
    .update({ outlet_id: newOutletId })
    .eq('id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function fetchUsersGlobal() {
  await requireRole(['developer'])
  
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('outlet_staff')
    .select(`
      id,
      name,
      role,
      status,
      username,
      outlet_id,
      outlets:outlet_id (
        name
      )
    `)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
