'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface MyOutletData {
  outletId: string | null
  outletName: string | null
  isBlocked: boolean
  blockedReason: string
}

async function fetchMyOutlet(): Promise<MyOutletData> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { outletId: null, outletName: null, isBlocked: false, blockedReason: '' }
  }

  const { data: profile } = await supabase.from('outlet_staff')
    .select('outlet_id, is_active, inactive_reason, outlets!outlet_staff_outlet_id_fkey(name, is_active, inactive_reason)')
    .eq('id', user.id).single()

  if (!profile) {
    return { outletId: null, outletName: null, isBlocked: false, blockedReason: '' }
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

  return {
    outletId: profile.outlet_id ?? null,
    outletName: (profile.outlets as any)?.name || null,
    isBlocked,
    blockedReason,
  }
}

/**
 * Mengembalikan outlet_id milik user yang sedang login (kasir).
 * Identitas outlet ini tidak berubah selama sesi login, jadi di-cache
 * selamanya (staleTime: Infinity) agar tidak di-refetch tiap pindah tab.
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
    loaded: isFetched,
    isBlocked: data?.isBlocked ?? false,
    blockedReason: data?.blockedReason ?? '',
  }
}
