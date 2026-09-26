import { createServerComponentClient } from '@/lib/supabase-server'
import { getVerifiedUserId } from '@suka/auth'

export async function requireRole(
  allowedRoles: string[]
): Promise<{ userId: string; role: string }> {
  const supabase = await createServerComponentClient()
  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  // developer = superuser teknis: lolos semua daftar role.
  if (!staff || staff.status !== 'active' || !(allowedRoles.includes(staff.role) || staff.role === 'developer')) {
    throw new Error(`Forbidden: aksi ini hanya untuk role ${allowedRoles.join('/')}`)
  }

  return { userId, role: staff.role }
}
