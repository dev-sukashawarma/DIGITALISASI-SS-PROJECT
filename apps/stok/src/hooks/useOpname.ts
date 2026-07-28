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

    const { data: existing } = await supabase.from('opname')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('tipe', tipe)
      .eq('tanggal', todayWIB)
      .not('status', 'eq', 'rejected')
      .maybeSingle()

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
    await upsertOpnameItems(items as Parameters<typeof upsertOpnameItems>[0])
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
