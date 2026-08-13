'use client'
import { useCallback, useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useOfflineQueue } from '@suka/offline-queue'
import type { Opname, OpnameItem } from '@/types/stok'
import { useRealtimeInvalidate } from '@suka/realtime'
import { upsertOpnameItems } from '@/app/actions/opname'

export function useOpnameList(outletId: string | null | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['opname', outletId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('opname')
        .select('*, outlet_staff!opname_created_by_fkey(name), opname_item(qty_fisik, qty_system, selisih, flagged)')
        .eq('outlet_id', outletId)
        .order('tanggal', { ascending: false }).limit(60)
      return (data as Opname[]) ?? []
    },
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `opname_list_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    debounceMs: 800,
    subs: [
      { table: 'opname', filter: outletId ? `outlet_id=eq.${outletId}` : undefined, queryKeys: [['opname', outletId]] },
      { table: 'opname_item', queryKeys: [['opname', outletId]] },
    ],
  })

  return { opnameList: data ?? [], loading: isLoading }
}

interface FinalizePayload { opnameId: string }

export function useOpnameActions() {
  const supabase = createClient()
  const { add, flush, isOnline } = useOfflineQueue<FinalizePayload>('stok-opname-finalize')

  const createDraft = useCallback(async (outletId: string, tipe: string, createdBy: string, notes?: string) => {
    const { data, error } = await supabase.from('opname')
      .insert({ outlet_id: outletId, tipe, status: 'draft', created_by: createdBy, notes: notes || null }).select().single()
    if (error) throw error
    return data as Opname
  }, [])

  const createOrReuseDraft = useCallback(async (outletId: string, tipe: string, createdBy: string, notes?: string) => {
    // Cek apakah sudah ada opname hari ini untuk outlet ini (semua status kecuali rejected)
    // Gunakan range tanggal hari ini (WIB = UTC+7) agar timezone-safe
    const now = new Date()
    // Ambil tanggal hari ini dalam WIB
    const wibOffset = 7 * 60 // menit
    const wibNow = new Date(now.getTime() + wibOffset * 60 * 1000)
    const todayWIB = wibNow.toISOString().slice(0, 10) // "YYYY-MM-DD"

    // Urutan khusus 13 Agustus 2026 (permintaan owner, hari yang sama dgn fix
    // bug finalize opname supabaseKey): SEMUA outlet boleh opname maksimal 2x
    // hari ini, opname pertama bertipe 'ad_hoc', opname kedua bertipe 'harian'
    // (dibalik dari urutan normal) agar tak bentrok unique index
    // uniq_opname_harian_per_day (hanya berlaku utk tipe='harian'). Opname
    // kedua baru dibuat setelah yang pertama finalized. Hari-hari lain
    // otomatis kembali normal (1x/hari) karena gate ini per-tanggal.
    // HAPUS blok ini setelah 13/08/2026.
    const EXTRA_OPNAME_DATE = '2026-08-13'
    if (todayWIB === EXTRA_OPNAME_DATE) {
      const { data: todaysOpnames } = await supabase.from('opname')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('tanggal', todayWIB)
        .not('status', 'eq', 'rejected')
        .order('created_at', { ascending: true })

      const list = (todaysOpnames ?? []) as Opname[]

      if (list.length === 0) {
        const { data, error } = await supabase.from('opname')
          .insert({ outlet_id: outletId, tipe: 'ad_hoc', status: 'draft', created_by: createdBy, notes: notes || null }).select().single()
        if (error) throw error
        return data as Opname
      }

      if (list.length === 1) {
        if (list[0].status !== 'finalized') return list[0]
        const { data, error } = await supabase.from('opname')
          .insert({ outlet_id: outletId, tipe: 'harian', status: 'draft', created_by: createdBy, notes: notes || null }).select().single()
        if (error) throw error
        return data as Opname
      }

      // Sudah 2x hari ini → kembalikan yang terakhir apa adanya.
      return list[list.length - 1]
    }

    const { data: existing } = await supabase.from('opname')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('tipe', tipe)
      .eq('tanggal', todayWIB)
      .not('status', 'eq', 'rejected')
      .maybeSingle()

    // Kompensasi 1-hari (29 Juli 2026): outlet yang kena bug opname pagi itu
    // (RLS/kolom generated/pesan error salah) boleh opname ulang hari ini
    // kalau opname 'harian' hari ini sudah finalized — dibuat sebagai opname
    // kedua bertipe 'ad_hoc' (bukan reuse row lama) supaya tidak bentrok unique
    // index uniq_opname_harian_per_day (hanya berlaku utk tipe='harian').
    // Dibatasi maksimal 2 opname/hari/outlet. HAPUS blok ini setelah 29/07/2026.
    const COMPENSATION_DATE = '2026-07-29'
    const JATIASIH_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440012'
    const JATIASIH_DATES = ['2026-07-30', '2026-08-01', '2026-08-02', '2026-08-07']

    const isCompensation = todayWIB === COMPENSATION_DATE
    const isJatiasihException = outletId === JATIASIH_OUTLET_ID && JATIASIH_DATES.includes(todayWIB)

    if (existing && existing.status === 'finalized' && (isCompensation || isJatiasihException)) {
      const { count } = await supabase.from('opname')
        .select('id', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
        .eq('tanggal', todayWIB)
        .not('status', 'eq', 'rejected')

      // Untuk 7 Agustus 2026, batas maksimal opname Jatiasih adalah 2. Sebelumnya 3.
      const maxOpname = (isJatiasihException && todayWIB === '2026-08-07') ? 2 : (isJatiasihException ? 3 : 2);

      if ((count ?? 0) < maxOpname) {
        const { data, error } = await supabase.from('opname')
          .insert({ outlet_id: outletId, tipe: 'ad_hoc', status: 'draft', created_by: createdBy, notes: notes || null }).select().single()
        if (error) throw error
        return data as Opname
      }
    }

    if (existing) return existing as Opname

    // Tidak ada opname hari ini → buat baru
    const { data, error } = await supabase.from('opname')
      .insert({ outlet_id: outletId, tipe, status: 'draft', created_by: createdBy, notes: notes || null }).select().single()
    if (error) throw error
    return data as Opname
  }, [])

  const upsertItems = useCallback(async (items: Partial<OpnameItem>[]) => {
    // Pakai server action (service role) karena RLS tabel opname_item
    // tidak mengizinkan INSERT langsung dari client session crew biasa.
    const result = await upsertOpnameItems(items as Parameters<typeof upsertOpnameItems>[0])
    if (result.error) throw new Error(result.error)
  }, [])

  const setPendingApproval = useCallback(async (opnameId: string) => {
    const { error } = await supabase.rpc('set_opname_pending', { p_opname_id: opnameId })
    if (error) throw error
  }, [])

  const finalize = useCallback(async (opnameId: string) => {
    try {
      const { error } = await supabase.rpc('finalize_opname', { p_opname_id: opnameId })
      if (error) throw error
      return { queued: false }
    } catch (e) {
      add({ opnameId })
      return { queued: true }
    }
  }, [add])

  const flushFinalize = useCallback(async () => {
    return flush(async (data: FinalizePayload) => {
      // A thrown error is treated as 'retry' by flush; a clean resolve is 'done'.
      const { error } = await supabase.rpc('finalize_opname', { p_opname_id: data.opnameId })
      if (error) throw error
    })
  }, [flush])

  useEffect(() => { if (isOnline) flushFinalize() }, [isOnline, flushFinalize])

  return { createDraft, createOrReuseDraft, upsertItems, setPendingApproval, finalize }
}
