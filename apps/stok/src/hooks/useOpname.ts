'use client'
import { useCallback, useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useOfflineQueue } from '@suka/offline-queue'
import type { Opname, OpnameItem } from '@/types/stok'
import { useRealtimeInvalidate } from '@suka/realtime'
import {
  upsertOpnameItems,
  createOrReuseOpnameDraftAction,
  fetchTodayOpnameDraftAction,
  finalizeOpnameClientAction
} from '@/app/actions/opname'
import { getTodayWIB, getEffectiveTodayWIB } from '@/lib/stok/opnameDate'

export { getTodayWIB, getEffectiveTodayWIB }

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

// Tanggal hari ini dalam WIB (UTC+7) format "YYYY-MM-DD", timezone-safe.
// Dipakai konsisten oleh createOrReuseDraft dan fetchTodayDraft agar keduanya
// selalu merujuk hari yang sama.

export function useOpnameActions() {
  const supabase = createClient()
  const { add, flush, isOnline } = useOfflineQueue<FinalizePayload>('stok-opname-finalize')

  const createDraft = useCallback(async (outletId: string, tipe: string, createdBy: string, notes?: string) => {
    const res = await createOrReuseOpnameDraftAction(outletId, tipe, notes)
    if (res.error) throw new Error(res.error)
    return res.data!
  }, [])

  // Ambil draft opname yang sedang berjalan (status='draft') hari ini untuk
  // outlet ini, beserta item-item yang sudah tersimpan — dipakai OpnameForm
  // untuk resume saat crew buka lagi form setelah "Simpan Draft".
  const fetchTodayDraft = useCallback(async (outletId: string) => {
    const res = await fetchTodayOpnameDraftAction(outletId)
    if (res.error) throw new Error(res.error)
    return res.data
  }, [])

  const createOrReuseDraft = useCallback(async (outletId: string, tipe: string, createdBy: string, notes?: string) => {
    const res = await createOrReuseOpnameDraftAction(outletId, tipe, notes)
    if (res.error) throw new Error(res.error)
    return res.data!
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
      const res = await finalizeOpnameClientAction(opnameId)
      if (res.error) throw new Error(res.error)
      return { queued: false }
    } catch (e) {
      add({ opnameId })
      return { queued: true }
    }
  }, [add])

  const flushFinalize = useCallback(async () => {
    return flush(async (data: FinalizePayload) => {
      // A thrown error is treated as 'retry' by flush; a clean resolve is 'done'.
      const res = await finalizeOpnameClientAction(data.opnameId)
      if (res.error) throw new Error(res.error)
    })
  }, [flush])

  useEffect(() => { if (isOnline) flushFinalize() }, [isOnline, flushFinalize])

  return { createDraft, createOrReuseDraft, fetchTodayDraft, upsertItems, setPendingApproval, finalize }
}
