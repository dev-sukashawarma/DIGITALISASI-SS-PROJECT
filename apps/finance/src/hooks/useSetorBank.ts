'use client'

import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/** Setor ke Bank: Kas Setoran Tunai → Rekening Setoran, receh → Kas Office Tunai (RPC record_setor_bank). */
export function useSetorBank() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { diambil: number; keBank: number; proofFile: File; note?: string | null }) => {
      const path = `setor-bank/${Date.now()}-${v.proofFile.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
      if (upErr) throw upErr
      const { data, error } = await supabase.rpc('record_setor_bank', {
        p_total_diambil: v.diambil,
        p_nominal_bank: v.keBank,
        p_proof_url: path,
        p_note: v.note?.trim() || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash_transaction'] })
      qc.invalidateQueries({ queryKey: ['cash_balance'] })
      qc.invalidateQueries({ queryKey: ['cash_location'] })
    },
  })
}
