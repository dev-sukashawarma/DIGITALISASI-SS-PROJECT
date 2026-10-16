import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'

export async function ambilIdentitasTelegram() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return null
  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('id, role, status')
    .eq('id', userId)
    .maybeSingle()
  if (!staff || staff.status !== 'active') return null
  return { userId, role: staff.role as string }
}
