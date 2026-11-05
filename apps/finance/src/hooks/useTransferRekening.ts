'use client'

import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/** Transfer antar rekening pusat (RPC record_cash_transfer): bukti diunggah dulu, lalu dua kaki tercatat. */
export function useTransferRekening() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { dari: string; ke: string; nominal: number; proofFile: File; note?: string | null }) => {
      const path = `transfer/${Date.now()}-${v.proofFile.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
      if (upErr) throw upErr
      const { data, error } = await supabase.rpc('record_cash_transfer', {
        p_from: v.dari,
        p_to: v.ke,
        p_amount: v.nominal,
        p_proof_url: path,
        p_note: v.note?.trim() || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash_transaction'] })
      qc.invalidateQueries({ queryKey: ['cash_balance'] })
      qc.invalidateQueries({ queryKey: ['mutasi_rekening'] })
    },
  })
}
