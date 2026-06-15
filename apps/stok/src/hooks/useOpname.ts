'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useOfflineQueue } from '@suka/offline-queue'
import type { Opname, OpnameItem } from '@/types/stok'

export function useOpnameList(outletId: string | undefined) {
  const [data, setData] = useState<Opname[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!outletId) {
      setLoading(false)
      return
    }
    const supabase = createClient()
    supabase.from('opname')
      .select('*, outlet_staff(name), opname_item(qty_fisik, qty_system, selisih, flagged)')
      .eq('outlet_id', outletId)
      .order('tanggal', { ascending: false }).limit(60)
      .then(({ data }) => { setData((data as Opname[]) ?? []); setLoading(false) })
  }, [outletId])
  return { opnameList: data, loading }
}

interface FinalizePayload { opnameId: string }

export function useOpnameActions() {
  const supabase = createClient()
  const { add, flush, isOnline } = useOfflineQueue<FinalizePayload>('stok-opname-finalize')

  const createDraft = useCallback(async (outletId: string, tipe: string, createdBy: string, notes?: string) => {
    const { data, error } = await supabase.from('opname')
      .insert({ outlet_id: outletId, tipe, created_by: createdBy, notes: notes || null }).select().single()
    if (error) throw error
    return data as Opname
  }, [])

  const upsertItems = useCallback(async (items: Partial<OpnameItem>[]) => {
    const { error } = await supabase.from('opname_item')
      .upsert(items, { onConflict: 'opname_id,bahan_baku_id' })
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
    return flush(async (items: Array<{ data: FinalizePayload }>) => {
      for (const it of items) {
        const { error } = await supabase.rpc('finalize_opname', { p_opname_id: it.data.opnameId })
        if (error) throw error
      }
    })
  }, [flush])

  useEffect(() => { if (isOnline) flushFinalize() }, [isOnline, flushFinalize])

  return { createDraft, upsertItems, finalize }
}
