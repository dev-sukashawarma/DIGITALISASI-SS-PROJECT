// Gerbang tunggal app ini (spec W2): sesi SSO + is_owner_or_admin() + staf aktif + role terpetakan.
// Dipakai di setiap route & halaman — app ini sengaja tanpa middleware (tak mengubah @suka/auth).
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { profilUntukPeran, type Profil } from '@/lib/peran'

export type Sesi = { supabase: any; userId: string; nama: string; profil: Profil }

export async function ambilSesi(): Promise<{ ok: true; sesi: Sesi } | { ok: false; status: 401 | 403 }> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return { ok: false, status: 401 }
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, role, status').eq('id', userId).maybeSingle(),
  ])
  const profil = profilUntukPeran(staff?.role)
  if (error || boleh !== true || staff?.status !== 'active' || !profil) return { ok: false, status: 403 }
  return { ok: true, sesi: { supabase, userId, nama: (staff?.name as string) || 'Bos', profil } }
}
