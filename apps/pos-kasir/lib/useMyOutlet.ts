'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'

interface MyOutletData {
  outletId: string | null
  outletName: string | null
  outletRegion: string | null
  isBlocked: boolean
  blockedReason: string
}

const OUTLET_CACHE_KEY = 'my-outlet'

async function fetchMyOutletFromNetwork(): Promise<MyOutletData> {
  const supabase = createClient()

  // getSession() membaca sesi dari storage lokal (bisa jalan offline);
  // getUser() butuh round-trip jaringan. Pakai session dulu, lalu getUser
  // hanya sebagai fallback saat session kosong.
  const { data: { session } } = await supabase.auth.getSession()
  let userId = session?.user?.id ?? null

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) {
    return { outletId: '550e8400-e29b-41d4-a716-446655440001', outletName: 'Pusat (Kiosk)', outletRegion: null, isBlocked: false, blockedReason: '' }
  }

  const { data: profile, error } = await supabase.from('outlet_staff')
    .select('role, outlet_id, is_active, inactive_reason, outlets!outlet_staff_outlet_id_fkey(name, region, is_active, inactive_reason)')
    .eq('id', userId).single()

  // Error jaringan/DB (mis. offline) ' lempar supaya fallback cache dipakai.
  // PGRST116 (row tidak ditemukan) BUKAN error jaringan: user memang tak punya profil.
  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  if (!profile) {
    return { outletId: null, outletName: null, outletRegion: null, isBlocked: false, blockedReason: '' }
  }

  let isBlocked = false
  let blockedReason = ''

  if (profile.is_active === false) {
    isBlocked = true
    blockedReason = profile.inactive_reason || 'Akun Anda dinonaktifkan oleh Admin.'
  } else if (profile.outlets && (profile.outlets as any).is_active === false) {
    isBlocked = true
    blockedReason = (profile.outlets as any).inactive_reason || 'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.'
  }

  let outletId = profile.outlet_id ?? null;
  let outletName = (profile.outlets as any)?.name ?? null;
  let outletRegion = (profile.outlets as any)?.region ?? null;

  // Override outlet_id berdasarkan lokasi absen hari ini (jika karyawan BKO/mutasi harian)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: attData } = await supabase.from('attendance')
    .select('outlet_id, outlets(name, region)')
    .eq('outlet_staff_id', userId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attData && attData.outlet_id) {
    outletId = attData.outlet_id;
    outletName = (attData.outlets as any)?.name ?? outletName;
    outletRegion = (attData.outlets as any)?.region ?? outletRegion;
  }

  // Fallback untuk Admin yang ingin mengetes Kasir/Kiosk
  if ((profile as any).role === 'admin' && !outletId) {
    outletId = '550e8400-e29b-41d4-a716-446655440001'
    outletName = 'Pusat (Kiosk)'
  }

  return {
    outletId,
    outletName,
    outletRegion,
    isBlocked,
    blockedReason,
  }
}

async function fetchMyOutlet(): Promise<MyOutletData> {
  try {
    const data = await fetchMyOutletFromNetwork()
    // Simpan ke IndexedDB supaya identitas outlet tetap dikenali saat offline
    if (data.outletId) {
      await db.app_state.put({ key: OUTLET_CACHE_KEY, value: data, synced_at: Date.now() }).catch(() => {})
    }
    return data
  } catch (err) {
    // Offline / jaringan gagal ' pakai profil outlet terakhir yang tersimpan
    const cached = await db.app_state.get(OUTLET_CACHE_KEY).catch(() => undefined)
    if (cached?.value?.outletId) {
      console.warn('[useMyOutlet] Offline, memakai profil outlet dari IndexedDB')
      return cached.value as MyOutletData
    }
    throw err
  }
}

/**
 * Mengembalikan outlet_id milik user yang sedang login (kasir).
 * Identitas outlet ini tidak berubah selama sesi login, jadi di-cache
 * selamanya (staleTime: Infinity) agar tidak di-refetch tiap pindah tab.
 * Saat offline, profil outlet dibaca dari IndexedDB (hasil login terakhir).
 * `loaded` menandai proses pengambilan selesai (untuk menggating query agar
 * tidak terlanjur mengambil data SEBELUM outlet diketahui).
 */
export function useMyOutlet() {
  const { data, isFetched } = useQuery({
    queryKey: ['my-outlet'],
    queryFn: fetchMyOutlet,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  return {
    outletId: data?.outletId ?? null,
    outletName: data?.outletName ?? null,
    outletRegion: data?.outletRegion ?? null,
    loaded: isFetched,
    isBlocked: data?.isBlocked ?? false,
    blockedReason: data?.blockedReason ?? '',
  }
}
