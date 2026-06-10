'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { LedgerStok, LedgerTipe } from '@/types/stok'

const PAGE_SIZE = 50

export function useLedgerList(outletId: string | undefined, page = 0) {
  const [data, setData] = useState<LedgerStok[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!outletId) { setLoading(false); return }
    setError(null)
    const supabase = createClient()
    supabase.from('ledger_stok').select('*').eq('outlet_id', outletId)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(({ data, error: err }) => {
        if (err) throw err
        setData((data as LedgerStok[]) ?? [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [outletId, page])
  return { ledger: data, loading, error }
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
