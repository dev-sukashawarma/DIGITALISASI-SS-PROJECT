// Hanya kode server. Gerbang SUKA Bot: sesi login + is_owner_or_admin() + status aktif.
// Middleware admin-dashboard SENGAJA dilewati untuk /api/asisten (owner tidak punya
// akses app admin-dashboard di ROLE_APP_ACCESS) — jadi pemeriksaan ini satu-satunya gerbang.
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'

export async function sesiSukaBot() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return null
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, status').eq('id', userId).maybeSingle(),
  ])
  if (error || boleh !== true || staff?.status !== 'active') return null
  return { supabase, userId, nama: (staff?.name as string) || 'Bos' }
}
