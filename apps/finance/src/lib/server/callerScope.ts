// @ts-nocheck
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'

const FULL_ACCESS_ROLES = ['admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen', 'admin_finance', 'purchasing', 'developer']

export async function resolveCallerScope() {
  const cookieStore = await cookies()
  const rawCookies = cookieStore.getAll()
  const supabase = createSupabaseServerClient({
    getAll: () => rawCookies,
    setAll: () => {}
  })

  const userId = await getVerifiedUserId(supabase, rawCookies)
  if (!userId) throw new Error('Unauthorized')

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', userId)
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
