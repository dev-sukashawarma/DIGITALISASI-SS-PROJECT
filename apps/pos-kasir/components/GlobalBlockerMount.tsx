'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import BlockedOverlay, { type BlockType, type ChecklistProgress } from './BlockedOverlay'

export default function GlobalBlockerMount() {
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')
  const [blockType, setBlockType] = useState<BlockType>('user')
  const [checklistProgress, setChecklistProgress] = useState<ChecklistProgress | undefined>(undefined)

  // Simpan outlet_id kasir agar bisa filter event attendance per outlet
  const outletIdRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let currentUid: string | null = null

    async function checkStatus() {
      if (!currentUid) {
        setIsBlocked(false)
        return
      }

      const { data: profile } = await supabase.from('outlet_staff')
        .select('role, outlet_id, is_active, inactive_reason, outlets!outlet_staff_outlet_id_fkey(is_active, inactive_reason)')
        .eq('id', currentUid).single()

      if (profile && profile.role !== 'admin') {
        // Simpan outlet_id untuk filtering realtime
        outletIdRef.current = profile.outlet_id || null

        if (profile.is_active === false) {
          setIsBlocked(true)
          setBlockType('user')
          setBlockedReason(profile.inactive_reason || 'Akun Anda dinonaktifkan oleh Admin.')
        } else if (profile.outlets && (profile.outlets as any).is_active === false) {
          setIsBlocked(true)
          setBlockType('outlet')
          setBlockedReason((profile.outlets as any).inactive_reason || 'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.')
        } else if (profile.role === 'kasir' && profile.outlet_id) {
          await checkKasirGate(profile.outlet_id)
        } else {
          setIsBlocked(false)
        }
      } else {
        // Admin tidak pernah diblokir
        setIsBlocked(false)
      }
    }

    // Gate dashboard kasir: status operasional outlet -> checklist buka toko
    // Lihat CONTEXT.md bagian "Operasional Harian Outlet & Gate Kasir"
    async function checkKasirGate(outletId: string) {
      try {
        const { data: dayStatus, error } = await supabase
          .rpc('get_outlet_day_status', { p_outlet_id: outletId })

        if (error) throw error

        if (dayStatus === 'belum_mulai') {
          setIsBlocked(true)
          setBlockType('attendance')
          setBlockedReason('Menunggu kru absen hadir.')
          setChecklistProgress(undefined)
          return
        }

        if (dayStatus === 'tutup') {
          setIsBlocked(true)
          setBlockType('closed')
          setBlockedReason('Semua kru sudah absen pulang. Toko sudah tutup untuk hari ini.')
          setChecklistProgress(undefined)
          return
        }

        // dayStatus === 'buka' -> cek progress checklist buka toko
        const { data: progressRows, error: progressError } = await supabase
          .rpc('get_outlet_checklist_progress', { p_outlet_id: outletId, p_phase: 'buka' })

        if (progressError) throw progressError

        const progress = Array.isArray(progressRows) ? progressRows[0] : progressRows
        const total = progress?.total_items ?? 0
        const done = progress?.done_items ?? 0

        if (total > 0 && done < total) {
          setIsBlocked(true)
          setBlockType('checklist')
          setBlockedReason('Checklist buka toko belum selesai.')
          setChecklistProgress({ total, done })
        } else {
          setIsBlocked(false)
          setChecklistProgress(undefined)
        }
      } catch (err) {
        console.error('[POS-Blocker] Failed to check status:', err)
        // Jika RPC belum ada di database, jangan block — biarkan terbuka
        // agar tidak mengganggu operasional
        setIsBlocked(false)
        setChecklistProgress(undefined)
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

    // Polling setiap 10 detik sebagai safety net
    const interval = setInterval(checkStatus, 10000)

    // Realtime listener untuk perubahan outlet_staff/outlets (nonaktif/aktif)
    const channel = supabase.channel('global_blocker')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outlet_staff' }, () => {
        checkStatus()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outlets' }, () => {
        checkStatus()
      })
      .subscribe()

    // Realtime listener untuk attendance — filter berdasarkan outlet_id
    // Ketika ada INSERT baru di tabel attendance (masuk ATAU pulang),
    // langsung re-check status operasional outlet kasir ini
    const attendanceChannel = supabase.channel('attendance_outlet_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          // Filter hanya event dari outlet kasir ini
          filter: outletIdRef.current ? `outlet_id=eq.${outletIdRef.current}` : undefined
        },
        () => {
          console.log('[POS-Blocker] Attendance event received, re-checking...')
          checkStatus()
        }
      )
      .subscribe((status) => {
        console.log('[POS-Blocker] Attendance channel status:', status)
      })

    // Realtime listener untuk checklist — tidak ada kolom outlet_id langsung di
    // daily_checklist_ticks/records, jadi subscribe tanpa filter & re-check via RPC
    const checklistChannel = supabase.channel('checklist_progress_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_checklist_ticks' },
        () => {
          console.log('[POS-Blocker] Checklist tick event received, re-checking...')
          checkStatus()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_checklist_records' },
        () => {
          checkStatus()
        }
      )
      .subscribe()

    // Re-subscribe attendance channel setelah outlet_id diketahui
    // karena saat pertama kali mount, outletIdRef mungkin masih null
    const resubscribeTimer = setTimeout(async () => {
      if (outletIdRef.current) {
        await supabase.removeChannel(attendanceChannel)

        const filteredChannel = supabase.channel('attendance_outlet_filtered')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'attendance',
              filter: `outlet_id=eq.${outletIdRef.current}`
            },
            () => {
              console.log('[POS-Blocker] Filtered attendance event for outlet:', outletIdRef.current)
              checkStatus()
            }
          )
          .subscribe((status) => {
            console.log('[POS-Blocker] Filtered attendance channel status:', status)
          })

        // Update cleanup to include new channel
        cleanupRef.current = () => {
          sub.subscription.unsubscribe()
          clearInterval(interval)
          supabase.removeChannel(channel)
          supabase.removeChannel(filteredChannel)
          supabase.removeChannel(checklistChannel)
        }
      }
    }, 3000) // Tunggu 3 detik agar profile sudah di-fetch

    // Cleanup ref untuk dynamic cleanup
    const cleanupRef = { current: () => {
      sub.subscription.unsubscribe()
      clearInterval(interval)
      clearTimeout(resubscribeTimer)
      supabase.removeChannel(channel)
      supabase.removeChannel(attendanceChannel)
      supabase.removeChannel(checklistChannel)
    }}

    return () => cleanupRef.current()
  }, [])

  if (isBlocked) {
    return <BlockedOverlay reason={blockedReason} type={blockType} progress={checklistProgress} />
  }

  return null
}
