'use client'

import { unggahDenganSesi } from '@suka/auth'
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/**
 * Uang dari/ke luar sistem: Top Up (masuk dari owner/atasan/modal) dan Refund Dana
 * (keluar, dikembalikan ke owner/atasan/pemodal), beserta pembatalannya.
 * Tanggal opsional (YYYY-MM-DD, 1 Nov 2026 s/d hari ini); kosong = sekarang.
 */
export function useTopUpSaldo() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  const segarkan = () => {
    qc.invalidateQueries({ queryKey: ['cash_transaction'] })
    qc.invalidateQueries({ queryKey: ['cash_balance'] })
    qc.invalidateQueries({ queryKey: ['mutasi_rekening'] })
  }

  const catat = useMutation({
    mutationFn: async (v: { rekening: string; nominal: number; sumber: string; proofFile: File; note?: string | null; tanggal?: string | null }) => {
      // Foto dinormalkan (JPEG ringan, EXIF dibuang) + retry: lihat @suka/auth unggahDenganSesi.
      const { path } = await unggahDenganSesi({ supabase, bucket: 'finance-proofs', folder: 'top-up', file: v.proofFile })
      const { data, error } = await supabase.rpc('record_top_up_saldo', {
        p_location: v.rekening,
        p_amount: v.nominal,
        p_sumber: v.sumber.trim(),
        p_proof_url: path,
        p_note: v.note?.trim() || null,
        p_tanggal: v.tanggal || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: segarkan,
  })

  const catatRefund = useMutation({
    mutationFn: async (v: { rekening: string; nominal: number; tujuan: string; proofFile: File; note?: string | null; tanggal?: string | null }) => {
      // Foto dinormalkan (JPEG ringan, EXIF dibuang) + retry: lihat @suka/auth unggahDenganSesi.
      const { path } = await unggahDenganSesi({ supabase, bucket: 'finance-proofs', folder: 'refund-dana', file: v.proofFile })
      const { data, error } = await supabase.rpc('record_refund_dana', {
        p_location: v.rekening,
        p_amount: v.nominal,
        p_tujuan: v.tujuan.trim(),
        p_proof_url: path,
        p_note: v.note?.trim() || null,
        p_tanggal: v.tanggal || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: segarkan,
  })

  const batalRefund = useMutation({
    mutationFn: async (v: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('batal_refund_dana', { p_id: v.id, p_alasan: v.alasan.trim() })
      if (error) throw error
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

  return { catat, batal, catatRefund, batalRefund }
}
