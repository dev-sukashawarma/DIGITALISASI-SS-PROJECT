'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface OutletOption {
  id: string
  name: string
}

/** Daftar outlet untuk atribusi setoran. */
export function useOutlets() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<OutletOption[]>({
    queryKey: ['outlets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name')
        .order('name', { ascending: true })
      if (error) throw error
      return (data as OutletOption[]) ?? []
    },
    staleTime: 5 * 60_000,
  })
}

export function useCashDeposit() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: {
      location: string
      amount: number
      outletId?: string | null
      note?: string | null
      proofFile?: File | null
    }) => {
      let proofUrl: string | null = null
      if (v.proofFile) {
        const path = `deposit/${Date.now()}-${v.proofFile.name.replace(/[^\w.\-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
        if (upErr) throw upErr
        proofUrl = path
      }
      const { data, error } = await supabase.rpc('record_cash_deposit', {
        p_location: v.location,
        p_amount: v.amount,
        p_outlet: v.outletId ?? null,
        p_note: v.note ?? null,
        p_proof_url: proofUrl,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash_transaction'] })
      qc.invalidateQueries({ queryKey: ['cash_balance'] })
    },
  })
}
