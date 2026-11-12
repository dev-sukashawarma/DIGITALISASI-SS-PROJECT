'use client'

import { unggahDenganSesi } from '@suka/auth'
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/** Setor ke Bank: Rekening Bahan Baku Tunai → Rekening Bahan Baku (bank), receh → Rekening Petty Cash Tunai (RPC record_setor_bank). */
export function useSetorBank() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { diambil: number; keBank: number; proofFile: File; note?: string | null }) => {
      // Foto dinormalkan (JPEG ringan, EXIF dibuang) + retry: lihat @suka/auth unggahDenganSesi.
      const { path } = await unggahDenganSesi({ supabase, bucket: 'finance-proofs', folder: 'setor-bank', file: v.proofFile })
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
      qc.invalidateQueries({ queryKey: ['mutasi_rekening'] })
    },
  })
}
