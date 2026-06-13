'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Mengembalikan outlet_id milik user yang sedang login (kasir).
 * `loaded` menandai proses pengambilan selesai (untuk menggating query agar
 * tidak terlanjur mengambil data SEBELUM outlet diketahui).
 */
export function useMyOutlet() {
  const [outletId, setOutletId] = useState<string | null>(null)
  const [outletName, setOutletName] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoaded(true); return }
      
      const { data: profile } = await supabase.from('profiles')
        .select('outlet_id, is_active, inactive_reason, outlets(name, is_active, inactive_reason)')
        .eq('id', user.id).single()
        
      if (profile) {
        if (profile.is_active === false) {
          setIsBlocked(true)
          setBlockedReason(profile.inactive_reason || 'Akun Anda dinonaktifkan oleh Admin.')
        } else if (profile.outlets && (profile.outlets as any).is_active === false) {
          setIsBlocked(true)
          setBlockedReason((profile.outlets as any).inactive_reason || 'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.')
        }
        setOutletId(profile.outlet_id ?? null)
        setOutletName((profile.outlets as any)?.name || null)
      }
      setLoaded(true)
    })
  }, [])

  return { outletId, outletName, loaded, isBlocked, blockedReason }
}
