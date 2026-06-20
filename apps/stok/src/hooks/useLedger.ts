'use client'
import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { LedgerStok, LedgerTipe } from '@/types/stok'

const PAGE_SIZE = 50

export function useLedgerList(outletId: string | null | undefined, page = 0) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger', outletId, page],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase.from('ledger_stok').select('*').eq('outlet_id', outletId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (err) throw err
      return (data as LedgerStok[]) ?? []
    },
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })
  return { ledger: data ?? [], loading: isLoading, error: error ? (error as Error).message : null }
}

export interface ManualEntryInput {
  outletId: string; bahanBakuId: string; tipe: Extract<LedgerTipe,'waste'|'adjustment'|'transfer_keluar'>
  qtyAbs: number; catatan: string; createdBy: string
}

export function useLedgerActions() {
  const supabase = createClient()
  const addManual = useCallback(async (input: ManualEntryInput, signedOverride?: number) => {
    const qty = signedOverride ?? (input.tipe === 'adjustment' ? input.qtyAbs : -Math.abs(input.qtyAbs))
    const { error } = await supabase.from('ledger_stok').insert({
      outlet_id: input.outletId, bahan_baku_id: input.bahanBakuId,
      tipe: input.tipe, qty, catatan: input.catatan, created_by: input.createdBy,
    })
    if (error) throw new Error(error.message)
  }, [])
  return { addManual }
}
