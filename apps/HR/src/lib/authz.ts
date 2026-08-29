import { createServerComponentClient } from '@/lib/supabase-server'

export async function requireRole(
  allowedRoles: string[]
): Promise<{ userId: string; role: string }> {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  if (!staff || staff.status !== 'active' || !allowedRoles.includes(staff.role)) {
    throw new Error(`Forbidden: aksi ini hanya untuk role ${allowedRoles.join('/')}`)
  }

  return { userId: user.id, role: staff.role }
}
