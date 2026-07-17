'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import BlockedOverlay, { type BlockType, type ChecklistProgress } from './BlockedOverlay'

export default function GlobalBlockerMount() {
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')
  const [blockType, setBlockType] = useState<BlockType>('user')
  const [checklistProgress, setChecklistProgress] = useState<ChecklistProgress | undefined>(undefined)

  // Bypass State
  const [bypassedTypes, setBypassedTypes] = useState<string[]>([])

  // Cek apakah pernah di-bypass di session ini
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('pos_gate_bypassed_types')
        if (stored) setBypassedTypes(JSON.parse(stored))
      } catch (e) {
        // ignore
      }
    }
  }, [])

  function handleBypass() {
    const newTypes = [...bypassedTypes, blockType]
    sessionStorage.setItem('pos_gate_bypassed_types', JSON.stringify(newTypes))
    setBypassedTypes(newTypes)
  }

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
        .select('role, outlet_id, is_active, inactive_reason, outlets!outlet_staff_outlet_id_fkey(name, is_active, inactive_reason)')
        .eq('id', currentUid).single()

      if (profile && profile.role !== 'admin') {
        // Simpan outlet_id untuk filtering realtime
        outletIdRef.current = profile.outlet_id || null

        const outletName = (profile.outlets as any)?.name || ''
        const isDramaga = outletName.toLowerCase().includes('dramaga')
        
        // Bypass khusus Dramaga HANYA untuk hari ini (17 Juli 2026) di local
        const currentDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
        if (process.env.NODE_ENV === 'development' && isDramaga && currentDateStr === '2026-07-17') {
          setIsBlocked(false)
          return
        }

        if (profile.is_active === false) {
          setIsBlocked(true)
          setBlockType('user')
          setBlockedReason(profile.inactive_reason || 'Akun Anda dinonaktifkan oleh Admin.')
        } else if (profile.outlets && (profile.outlets as any).is_active === false) {
          setIsBlocked(true)
          setBlockType('outlet')
          setBlockedReason((profile.outlets as any).inactive_reason || 'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.')
        } else if (['crew', 'leader'].includes(profile.role) && profile.outlet_id) {
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
        // Use formatting that strictly outputs YYYY-MM-DD to avoid locale parsing issues
        const now = new Date()
        const formatter = new Intl.DateTimeFormat('en-CA', { 
          timeZone: 'Asia/Jakarta', 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        })
        const parts = formatter.formatToParts(now)
        const y = parts.find(p => p.type === 'year')?.value
        const m = parts.find(p => p.type === 'month')?.value
        const d = parts.find(p => p.type === 'day')?.value
        const todayStr = `${y}-${m}-${d}`
        
        const start = new Date(`${todayStr}T00:00:00+07:00`).toISOString()
        const end = new Date(`${todayStr}T23:59:59+07:00`).toISOString()

        const { data: attendances, error: attErr } = await supabase
          .from('attendance')
          .select('outlet_staff_id, type')
          .eq('outlet_id', outletId)
          .gte('ts_server', start)
          .lte('ts_server', end)
          .order('ts_server', { ascending: true })

        if (attErr) throw attErr

        let dayStatus = 'belum_mulai'
        if (attendances && attendances.length > 0) {
          const staffStatus = new Map<string, string>()
          for (const att of attendances) {
             staffStatus.set(att.outlet_staff_id, att.type)
          }
          const hasAnyoneIn = Array.from(staffStatus.values()).some(t => t === 'in')
          if (hasAnyoneIn) {
            dayStatus = 'buka'
          } else {
            dayStatus = 'tutup'
          }
        }

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
        const { data: cats } = await supabase
          .from("checklist_categories")
          .select("id, checklist_items(id, is_required)")
          .eq("outlet_id", outletId)
          .eq("phase", "buka")
        
        const requiredIds = ((cats as any[]) ?? [])
          .flatMap((c) => c.checklist_items ?? [])
          .filter((i: any) => i.is_required)
          .map((i: any) => i.id as string)

        const total = requiredIds.length
        let done = 0

        if (total > 0) {
          const { data: rec } = await supabase
            .from("daily_checklist_records")
            .select("id")
            .eq("outlet_id", outletId)
            .eq("date", todayStr)
            .maybeSingle()

          if (rec) {
             const { data: ticks } = await supabase
               .from("daily_checklist_ticks")
               .select("item_id")
               .eq("record_id", rec.id)
             
             const ticked = new Set(((ticks as any[]) ?? []).map(t => t.item_id as string))
             done = requiredIds.filter(id => ticked.has(id)).length
          }
        }

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
        // Jika error, jangan block — biarkan terbuka
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
    // Ketika ada perubahan di tabel attendance (masuk ATAU pulang ATAU hapus manual),
    // langsung re-check status operasional outlet kasir ini
    const attendanceChannel = supabase.channel('attendance_outlet_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
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
              event: '*',
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
    // Jika tipe blokir adalah karena absen/checklist/tutup, dan user sudah melakukan bypass untuk tipe ini
    if ((blockType === 'attendance' || blockType === 'checklist' || blockType === 'closed') && bypassedTypes.includes(blockType)) {
      return null
    }
    
    return (
      <BlockedOverlay 
        reason={blockedReason} 
        type={blockType} 
        progress={checklistProgress} 
        onBypass={handleBypass}
      />
    )
  }

  return null
}
