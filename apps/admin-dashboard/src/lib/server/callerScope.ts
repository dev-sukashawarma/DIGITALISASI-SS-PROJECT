// @ts-nocheck
// Hanya untuk kode server (memakai next/headers). Sengaja tanpa paket
// `server-only` — tidak dideklarasikan di package.json app ini (phantom dependency).
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

const FULL_ACCESS_ROLES = ['admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen', 'admin_finance', 'purchasing', 'developer']

/** Menentukan scope outlet caller berdasarkan sesi login (bukan service-role),
 * supaya auth.uid() terisi di dalam RPC SECURITY DEFINER dan accessible_outlet_ids()
 * ikut memfilter. scopeKey dipakai sebagai bagian kunci cache agar user dengan
 * scope berbeda tidak saling membaca cache satu sama lain.
 */
export async function resolveCallerScope() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (staffError) throw new Error(`resolveCallerScope: ${staffError.message}`)

  if (staff?.role && FULL_ACCESS_ROLES.includes(staff.role)) {
    return { supabase, scopeKey: 'all', allowedOutletIds: 'all' as const }
  }

  const { data: outletIds, error: outletIdsError } = await supabase.rpc('accessible_outlet_ids')
  if (outletIdsError) throw new Error(`resolveCallerScope: ${outletIdsError.message}`)

  const allowedOutletIds: string[] = (outletIds ?? []).map((id: any) => String(id)).sort()
  return { supabase, scopeKey: allowedOutletIds.join(','), allowedOutletIds }
}

