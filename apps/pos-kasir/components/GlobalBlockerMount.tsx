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
    const newTypes = [...bypassedTypes, blockType, 'all', 'attendance', 'checklist', 'closed']
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pos_gate_bypassed_types', JSON.stringify(newTypes))
    }
    setBypassedTypes(newTypes)
    setIsBlocked(false)
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

      // Check session storage first
      if (typeof window !== 'undefined') {
        try {
          const stored = JSON.parse(sessionStorage.getItem('pos_gate_bypassed_types') || '[]')
          if (stored.includes('all') || stored.includes(blockType)) {
            setIsBlocked(false)
            return
          }
        } catch (e) {}
      }

      const { data: profile } = await supabase.from('outlet_staff')
        .select('id, name, email, role, outlet_id, is_active, inactive_reason, outlets!outlet_staff_outlet_id_fkey(name, is_active, inactive_reason)')
        .eq('id', currentUid).single()

      if (profile && profile.role !== 'admin') {
        // Simpan outlet_id untuk filtering realtime
        outletIdRef.current = profile.outlet_id || null

        const outletName = (profile.outlets as any)?.name || ''
        const isDramaga = outletName.toLowerCase().includes('dramaga')
        
        // Bypass khusus development untuk Outlet BNR / testing
        const isBnr = outletName.toLowerCase().includes('bnr')
        if (process.env.NODE_ENV === 'development' && isBnr) {
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
        // Strict YYYY-MM-DD format
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

        // Cek apakah ada pengajuan bypass yang disetujui (status = 'approved') untuk outlet ini hari ini
        // Gunakan limit(1) agar tidak error jika ada multiple approved rows
        const { data: approvedBypass } = await supabase
          .from('bypass_requests')
          .select('id')
          .eq('outlet_id', outletId)
          .eq('status', 'approved')
          .gte('created_at', start)
          .limit(1)

        if (approvedBypass && approvedBypass.length > 0) {
          setIsBlocked(false)
          setChecklistProgress(undefined)
          return
        }

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
        // Jika error, jangan block — biarkan terbuka agar tidak mengganggu operasional
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

    // Polling setiap 5 detik sebagai safety net
    const interval = setInterval(checkStatus, 5000)

    // Realtime listener untuk perubahan outlet_staff/outlets
    const channel = supabase.channel('global_blocker')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outlet_staff' }, () => {
        checkStatus()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outlets' }, () => {
        checkStatus()
      })
      .subscribe()

    // Realtime listener untuk bypass_requests (langsung tangkap ketika SPV klik setujui)
    const bypassChannel = supabase.channel('bypass_requests_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bypass_requests' }, () => {
        console.log('[POS-Blocker] Bypass request change detected, re-checking...')
        checkStatus()
      })
      .subscribe()

    // Realtime listener untuk attendance
    const attendanceChannel = supabase.channel('attendance_outlet_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: outletIdRef.current ? `outlet_id=eq.${outletIdRef.current}` : undefined
        },
        () => {
          checkStatus()
        }
      )
      .subscribe()

    // Realtime listener untuk checklist
    const checklistChannel = supabase.channel('checklist_progress_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checklist_ticks' }, () => checkStatus())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checklist_records' }, () => checkStatus())
      .subscribe()

    return () => {
      sub.subscription.unsubscribe()
      clearInterval(interval)
      supabase.removeChannel(channel)
      supabase.removeChannel(bypassChannel)
      supabase.removeChannel(attendanceChannel)
      supabase.removeChannel(checklistChannel)
    }
  }, [bypassedTypes, blockType])

  if (isBlocked) {
    // Jika tipe blokir telah di-bypass oleh user/SPV
    if (bypassedTypes.includes('all') || bypassedTypes.includes(blockType) || (['attendance', 'checklist', 'closed'].includes(blockType) && bypassedTypes.includes(blockType))) {
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
