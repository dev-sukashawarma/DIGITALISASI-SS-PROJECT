'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BlockedOverlay from './BlockedOverlay'

export default function GlobalBlockerMount() {
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')
  const [blockType, setBlockType] = useState<'user' | 'outlet'>('user')

  useEffect(() => {
    const supabase = createClient()
    let currentUid: string | null = null
    
    async function checkStatus() {
      if (!currentUid) {
        setIsBlocked(false)
        return
      }
      
      const { data: profile } = await supabase.from('profiles')
        .select('role, is_active, inactive_reason, outlets(is_active, inactive_reason)')
        .eq('id', currentUid).single()
        
      if (profile && profile.role !== 'admin') {
        if (profile.is_active === false) {
          setIsBlocked(true)
          setBlockType('user')
          setBlockedReason(profile.inactive_reason || 'Akun Anda dinonaktifkan oleh Admin.')
        } else if (profile.outlets && (profile.outlets as any).is_active === false) {
          setIsBlocked(true)
          setBlockType('outlet')
          setBlockedReason((profile.outlets as any).inactive_reason || 'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.')
        } else {
          setIsBlocked(false)
        }
      } else {
        setIsBlocked(false)
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUid = user?.id || null
      checkStatus()
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUid = session?.user?.id || null
      checkStatus()
    })

    // Mengecek status secara berkala untuk amannya
    const interval = setInterval(checkStatus, 30000)

    // Realtime listener agar pemblokiran instan tanpa harus menunggu 30 detik
    const channel = supabase.channel('global_blocker')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        checkStatus()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outlets' }, () => {
        checkStatus()
      })
      .subscribe()

    return () => { 
      sub.subscription.unsubscribe()
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  if (isBlocked) {
    return <BlockedOverlay reason={blockedReason} type={blockType} />
  }
  
  return null
}
