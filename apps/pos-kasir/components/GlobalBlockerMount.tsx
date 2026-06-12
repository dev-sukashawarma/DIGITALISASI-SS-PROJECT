'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BlockedOverlay from './BlockedOverlay'

export default function GlobalBlockerMount() {
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')
  const [blockType, setBlockType] = useState<'user' | 'outlet' | 'attendance'>('user')

  useEffect(() => {
    const supabase = createClient()
    let currentUid: string | null = null
    
    async function checkStatus() {
      if (!currentUid) {
        setIsBlocked(false)
        return
      }
      
      const { data: profile } = await supabase.from('profiles')
        .select('role, outlet_id, is_active, inactive_reason, outlets(is_active, inactive_reason)')
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
        } else if (profile.role === 'kasir' && profile.outlet_id) {
          try {
            // Cek kehadiran staff menggunakan RPC di database gabungan
            const { data: hasPresence, error } = await supabase
              .rpc('get_outlet_presence', { p_outlet_id: profile.outlet_id })
              
            if (error) throw error
            
            if (!hasPresence) {
              setIsBlocked(true)
              setBlockType('attendance')
              setBlockedReason('Menunggu kru absen hadir.')
            } else {
              setIsBlocked(false)
            }
          } catch (err) {
            console.error('Failed to check presence', err)
            setIsBlocked(true)
            setBlockType('attendance')
            setBlockedReason('Mengecek status absensi...')
          }
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
    const interval = setInterval(checkStatus, 15000)

    // Realtime listener agar pemblokiran instan tanpa harus menunggu 30 detik
    const channel = supabase.channel('global_blocker')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        checkStatus()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outlets' }, () => {
        checkStatus()
      })
      .subscribe()

    // Realtime listener untuk menangkap sinyal instan saat kru absen (masuk ATAU pulang)
    // Karena sekarang database sudah disatukan, kita bisa langsung listen ke tabel 'attendance'
    const attendanceChannel = supabase.channel('attendance_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, () => {
        // Setiap ada data absensi baru (masuk/pulang), langsung cek ulang kehadiran
        // JANGAN optimistik membuka — biarkan RPC get_outlet_presence yang menentukan
        checkStatus()
      })
      .subscribe()

    return () => { 
      sub.subscription.unsubscribe()
      clearInterval(interval)
      supabase.removeChannel(channel)
      supabase.removeChannel(attendanceChannel)
    }
  }, [])

  if (isBlocked) {
    return <BlockedOverlay reason={blockedReason} type={blockType} />
  }
  
  return null
}
