'use client'

import { unggahDenganSesi } from '@suka/auth'
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/** Transfer antar rekening pusat (RPC record_cash_transfer): bukti diunggah dulu, lalu dua kaki tercatat. */
export function useTransferRekening() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { dari: string; ke: string; nominal: number; proofFile: File; note?: string | null }) => {
      // Foto dinormalkan (JPEG ringan, EXIF dibuang) + retry: lihat @suka/auth unggahDenganSesi.
      const { path } = await unggahDenganSesi({ supabase, bucket: 'finance-proofs', folder: 'transfer', file: v.proofFile })
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
