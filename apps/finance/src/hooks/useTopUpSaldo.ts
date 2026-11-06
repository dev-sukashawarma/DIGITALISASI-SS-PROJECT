'use client'

import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/** Top up saldo dari luar sistem (owner/atasan/modal) ke rekening pusat, dan pembatalannya. */
export function useTopUpSaldo() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  const segarkan = () => {
    qc.invalidateQueries({ queryKey: ['cash_transaction'] })
    qc.invalidateQueries({ queryKey: ['cash_balance'] })
    qc.invalidateQueries({ queryKey: ['mutasi_rekening'] })
  }

  const catat = useMutation({
    mutationFn: async (v: { rekening: string; nominal: number; sumber: string; proofFile: File; note?: string | null }) => {
      const path = `top-up/${Date.now()}-${v.proofFile.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
      if (upErr) throw upErr
      const { data, error } = await supabase.rpc('record_top_up_saldo', {
        p_location: v.rekening,
        p_amount: v.nominal,
        p_sumber: v.sumber.trim(),
        p_proof_url: path,
        p_note: v.note?.trim() || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: segarkan,
  })

  const batal = useMutation({
    mutationFn: async (v: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('batal_top_up_saldo', { p_id: v.id, p_alasan: v.alasan.trim() })
      if (error) throw error
    },
    onSuccess: segarkan,
  })

  return { catat, batal }
}
