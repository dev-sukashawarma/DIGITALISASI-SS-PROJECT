import type { SupabaseClient } from '@supabase/supabase-js'
import type { OutletStaffProfile } from './types'

/** Ambil profil outlet_staff kanonik untuk user id. null jika tidak ada. */
export async function getOutletStaff(
  supabase: SupabaseClient,
  userId: string
): Promise<{ staff: OutletStaffProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('outlet_staff')
    .select('id, outlet_id, name, role, status, outlets(name)')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { staff: null, error: error.message }

  // Transform data to match OutletStaffProfile type
  // Supabase returns outlets as array, but type expects object
  if (!data) return { staff: null, error: null }

  const staff: OutletStaffProfile = {
    id: data.id,
    outlet_id: data.outlet_id,
    name: data.name,
    role: data.role,
    status: data.status,
    outlets: Array.isArray(data.outlets) && data.outlets.length > 0 ? data.outlets[0] : null,
  }

  return { staff, error: null }
}

/** Outlet yang boleh diakses user (resolusi role) via fungsi DB accessible_outlet_ids(). */
export async function getAccessibleOutletIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase.rpc('accessible_outlet_ids')
  if (error || !data) return []
  // RPC SETOF uuid -> array of { accessible_outlet_ids: uuid } atau array uuid
  return (data as unknown[]).map((row) =>
    typeof row === 'string' ? row : (row as { accessible_outlet_ids: string }).accessible_outlet_ids
  )
}
