import { cookies } from 'next/headers';
import { createSupabaseServerClient, getOutletStaff } from '@suka/auth';

const PRIVILEGED_ROLES = new Set(['admin', 'owner', 'spv', 'regional_manager', 'area_manager', 'kitchen', 'developer']);

/**
 * Verifikasi user yang login (via cookie session) berhak mengakses outlet_id
 * tertentu. Crew/kasir/kiosk hanya boleh outlet sendiri; admin/owner/spv bebas.
 * Dipakai sebelum query lewat service-role client (yang bypass RLS).
 */
export async function authorizeOutletAccess(
  outlet_id: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => {
        try {
          cookies.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // Ignore cookie write errors (RSC context may not support it)
        }
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('[authorizeOutletAccess] auth.getUser error:', authError);
      return { ok: false, status: 500, error: 'Failed to get user session' };
    }
    if (!user) {
      return { ok: false, status: 401, error: 'Unauthorized: No active session' };
    }

    const { staff, error: staffError } = await getOutletStaff(supabase, user.id);
    if (staffError) {
      console.error('[authorizeOutletAccess] getOutletStaff error:', staffError);
      return { ok: false, status: 500, error: 'Failed to fetch staff record' };
    }
    if (!staff) {
      return { ok: false, status: 403, error: 'Staff record not found' };
    }

    // Check if user has access to this outlet
    if (PRIVILEGED_ROLES.has(staff.role) || staff.outlet_id === outlet_id) {
      return { ok: true };
    }

    // Check if staff has active emergency assignment (BKO) for this outlet on today's date
    const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const { data: bko } = await supabase
      .from('emergency_crew_assignments')
      .select('id')
      .eq('staff_id', user.id)
      .eq('target_outlet_id', outlet_id)
      .eq('assignment_date', todayWib)
      .eq('status', 'active')
      .maybeSingle();

    if (bko) {
      return { ok: true };
    }

    return { ok: false, status: 403, error: 'Forbidden: outlet mismatch' };
  } catch (err: any) {
    console.error('[authorizeOutletAccess] unexpected error:', err);
    return { ok: false, status: 500, error: 'Authorization check failed' };
  }
}
