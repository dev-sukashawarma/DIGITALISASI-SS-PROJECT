'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useKioskControl } from '@/lib/useKioskControl'

/**
 * Mount global (di root layout) yang menjaga tablet kiosk tetap "online"
 * di SEMUA halaman (menu, detail, checkout, pembayaran, dsb) — bukan hanya di '/'.
 * Hanya aktif untuk akun ber-role 'kiosk'; untuk admin/kasir/anon tidak melakukan apa pun.
 *
 * Memakai onAuthStateChange agar presence langsung mulai BEGITU kiosk login
 * (tanpa perlu refresh halaman), karena root layout tidak remount saat navigasi.
 */
export default function KioskPresenceMount() {
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [outletId, setOutletId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadFor(uid: string | undefined) {
      if (!uid) {
        setUserId(null); setUsername(null); setOutletId(null)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, outlet_id, username')
        .eq('id', uid)
        .single()
      if (profile?.role === 'kiosk' && profile.outlet_id) {
        setUserId(uid)
        setUsername(profile.username ?? null)
        setOutletId(profile.outlet_id)
      } else {
        setUserId(null); setUsername(null); setOutletId(null)
      }
    }

    // Sesi yang sudah ada saat halaman dimuat
    supabase.auth.getUser().then(({ data: { user } }) => loadFor(user?.id))

    // Reaksi terhadap login/logout tanpa refresh (kunci perbaikan realtime)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadFor(session?.user?.id)
    })

    return () => { sub.subscription.unsubscribe() }
  }, [])

  useKioskControl({ userId, username, outletId })
  return null
}
