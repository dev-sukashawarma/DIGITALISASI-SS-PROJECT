// Gerbang tunggal app ini: sesi SSO + is_owner_or_admin() + staf aktif (spec kantor bot §10).
// Izin chat per bot dicek terpisah di route (lib/server/izinChat.ts).
// Dipakai di setiap route & halaman — app ini sengaja tanpa middleware (tak mengubah @suka/auth).
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { putuskanGerbang } from '@/lib/gerbang'

export type Sesi = { supabase: any; userId: string; nama: string; role: string | null }

interface EntriCacheSesi {
  userId: string
  nama: string
  role: string | null
  berlakuSampai: number
}

const CACHE_SESI_TTL_MS = 60_000
const MAKS_ENTRI_CACHE_SESI = 256
const cacheSesiTerverifikasi = new Map<string, EntriCacheSesi>()

export function resetCacheSesiServer() {
  cacheSesiTerverifikasi.clear()
}

function buatSidikCookieAuth(semuaCookie: Array<{ name: string; value: string }>): string {
  const relevan = semuaCookie
    .filter((c) => c.name.startsWith('sb-') && c.value)
    .sort((a, b) => a.name.localeCompare(b.name))
  if (relevan.length === 0) return ''
  const mentah = relevan.map((c) => `${c.name}=${c.value}`).join(';')
  return createHash('sha256').update(mentah).digest('hex')
}

export async function ambilSesi(): Promise<{ ok: true; sesi: Sesi } | { ok: false; status: 401 | 403 }> {
  const cookieStore = await cookies()
  const semuaCookie = cookieStore.getAll()

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      // Di Route Handler (/api/chat, /api/voice/tts, /api/voice/stt), simpan cookie hasil refresh agar tidak refresh berulang di tiap request!
      // Di Server Component, cookieStore.set melempar error read-only sehingga diabaikan dengan aman.
      for (const { name, value, options } of cookiesToSet) {
        try {
          cookieStore.set(name, value, options)
        } catch {}
      }
    },
  })

  const sidik = buatSidikCookieAuth(semuaCookie)
  const sekarang = Date.now()
  if (sidik) {
    const entri = cacheSesiTerverifikasi.get(sidik)
    if (entri && sekarang < entri.berlakuSampai) {
      return {
        ok: true,
        sesi: {
          supabase,
          userId: entri.userId,
          nama: entri.nama,
          role: entri.role,
        },
      }
    }
    if (entri) {
      cacheSesiTerverifikasi.delete(sidik)
    }
  }

  const userId = await getVerifiedUserId(supabase)
  if (!userId) return { ok: false, status: 401 }
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, role, status').eq('id', userId).maybeSingle(),
  ])
  const g = putuskanGerbang({ userId, boleh: boleh === true, galatRpc: !!error, status: staff?.status ?? null })
  if (!g.ok) return g

  const nama = (staff?.name as string) || 'Bos'
  const role = (staff?.role as string) ?? null

  // Perbarui sidik apabila @supabase/ssr baru saja me-refresh token di dalam getVerifiedUserId
  const sidikAkhir = buatSidikCookieAuth(cookieStore.getAll()) || sidik
  if (sidikAkhir) {
    if (cacheSesiTerverifikasi.size >= MAKS_ENTRI_CACHE_SESI) {
      const kunciPertama = cacheSesiTerverifikasi.keys().next().value
      if (kunciPertama) cacheSesiTerverifikasi.delete(kunciPertama)
    }
    cacheSesiTerverifikasi.set(sidikAkhir, {
      userId,
      nama,
      role,
      berlakuSampai: Date.now() + CACHE_SESI_TTL_MS,
    })
  }

  return { ok: true, sesi: { supabase, userId, nama, role } }
}
