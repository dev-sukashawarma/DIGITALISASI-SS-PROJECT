import type { SupabaseClient } from '@supabase/supabase-js'
import type { OutletStaffProfile } from './types'

/** Ambil profil outlet_staff kanonik untuk user id. null jika tidak ada. */
export async function getOutletStaff(
  supabase: SupabaseClient,
  userId: string
): Promise<{ staff: OutletStaffProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('outlet_staff')
    // Disambiguate the embed to the DIRECT FK (outlet_staff.outlet_id → outlets.id).
    // staff_outlets (many-to-many) adds a second outlet_staff↔outlets relationship,
    // so a bare `outlets(name)` errors: "more than one relationship was found".
    .select('id, outlet_id, name, role, status, ref_photo_url, username, outlets!outlet_staff_outlet_id_fkey(name)')
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
    ref_photo_url: data.ref_photo_url,
    username: data.username,
    outlets: Array.isArray(data.outlets) ? data.outlets[0] : (data.outlets || null),
  }

  // Override outlet_id berdasarkan lokasi absen hari ini (jika karyawan BKO/mutasi harian)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: attData } = await supabase.from('attendance')
    .select('outlet_id, outlets(name)')
    .eq('outlet_staff_id', userId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attData && attData.outlet_id) {
    staff.outlet_id = attData.outlet_id;
    if (staff.outlets && attData.outlets) {
      staff.outlets = {
        ...staff.outlets,
        name: (attData.outlets as any).name || staff.outlets.name
      };
    } else if (attData.outlets) {
      staff.outlets = { name: (attData.outlets as any).name };
    }
  }

  return { staff, error: null }
}

/** Outlet yang boleh diakses user (resolusi role) via fungsi DB accessible_outlet_ids(). */
export async function getAccessibleOutletIds(
  supabase: SupabaseClient
): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('accessible_outlet_ids')
    if (error) {
      console.error('[Auth] getAccessibleOutletIds RPC error:', error.message)
      return []
    }
    if (!Array.isArray(data)) {
      console.warn('[Auth] getAccessibleOutletIds returned non-array:', data)
      return []
    }
    // RPC SETOF uuid -> array of { accessible_outlet_ids: uuid } atau array uuid
    return (data as unknown[]).map((row) =>
      typeof row === 'string' ? row : (row as { accessible_outlet_ids: string }).accessible_outlet_ids
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Auth] getAccessibleOutletIds exception:', errorMsg)
    return []
  }
}
