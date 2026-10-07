// Gerbang tunggal app ini (spec W2): sesi SSO + is_owner_or_admin() + staf aktif (+ role terpetakan untuk chat).
// Dipakai di setiap route & halaman — app ini sengaja tanpa middleware (tak mengubah @suka/auth).
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { profilUntukPeran, type Profil } from '@/lib/peran'
import { putuskanGerbang } from '@/lib/gerbang'

export type Sesi = { supabase: any; userId: string; nama: string; profil: Profil }
export type SesiKantor = { supabase: any; userId: string; nama: string }

async function bacaDasar() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return { supabase, userId: null, boleh: false, galatRpc: false, staff: null }
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, role, status').eq('id', userId).maybeSingle(),
  ])
  return { supabase, userId, boleh: boleh === true, galatRpc: !!error, staff }
}

export async function ambilSesi(): Promise<{ ok: true; sesi: Sesi } | { ok: false; status: 401 | 403 }> {
  const d = await bacaDasar()
  const g = putuskanGerbang(
    { userId: d.userId, boleh: d.boleh, galatRpc: d.galatRpc, status: d.staff?.status ?? null, role: d.staff?.role ?? null },
    true,
  )
  if (!g.ok) return g
  return {
    ok: true,
    sesi: { supabase: d.supabase, userId: d.userId!, nama: (d.staff?.name as string) || 'Bos', profil: profilUntukPeran(d.staff?.role)! },
  }
}

export async function ambilSesiKantor(): Promise<{ ok: true; sesi: SesiKantor } | { ok: false; status: 401 | 403 }> {
  const d = await bacaDasar()
  const g = putuskanGerbang(
    { userId: d.userId, boleh: d.boleh, galatRpc: d.galatRpc, status: d.staff?.status ?? null, role: d.staff?.role ?? null },
    false,
  )
  if (!g.ok) return g
  return { ok: true, sesi: { supabase: d.supabase, userId: d.userId!, nama: (d.staff?.name as string) || 'Bos' } }
}
