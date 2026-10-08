// Gerbang tunggal app ini: sesi SSO + is_owner_or_admin() + staf aktif (spec kantor bot §10).
// Izin chat per bot dicek terpisah di route (lib/server/izinChat.ts).
// Dipakai di setiap route & halaman — app ini sengaja tanpa middleware (tak mengubah @suka/auth).
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { putuskanGerbang } from '@/lib/gerbang'

export type Sesi = { supabase: any; userId: string; nama: string; role: string | null }

export async function ambilSesi(): Promise<{ ok: true; sesi: Sesi } | { ok: false; status: 401 | 403 }> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return { ok: false, status: 401 }
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, role, status').eq('id', userId).maybeSingle(),
  ])
  const g = putuskanGerbang({ userId, boleh: boleh === true, galatRpc: !!error, status: staff?.status ?? null })
  if (!g.ok) return g
  return { ok: true, sesi: { supabase, userId, nama: (staff?.name as string) || 'Bos', role: (staff?.role as string) ?? null } }
}
