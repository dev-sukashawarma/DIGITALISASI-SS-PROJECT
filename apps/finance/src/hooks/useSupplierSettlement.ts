'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export type PoPaymentStatus = 'unpaid' | 'pending' | 'paid'

export interface PayablePo {
  id: string
  nomor_po: string
  supplier_id: string | null
  supplier_nama: string
  tanggal_po: string
  status: string
  payment_status: PoPaymentStatus
  paid_at: string | null
  cash_transaction_id: string | null
  total: number
}

/** PO yang sudah diterima + tagihannya (dari view definer po_payable_spv). */
export function usePayablePos() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<PayablePo[]>({
    queryKey: ['po_payable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_payable_spv')
        .select('*')
        .order('payment_status', { ascending: true })
        .order('tanggal_po', { ascending: false })
      if (error) throw error
      return (data as PayablePo[]) ?? []
    },
  })
}

export function useSettlePo() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { poId: string; location: string }) => {
      const { data, error } = await supabase.rpc('settle_purchase_order', {
        p_po_id: v.poId,
        p_location: v.location,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['po_payable'] })
      qc.invalidateQueries({ queryKey: ['cash_transaction'] })
    },
  })
}
