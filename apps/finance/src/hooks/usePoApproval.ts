'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

export type PendingPo = {
  id: string
  nomor_po: string
  supplier_nama: string
  tanggal_po: string
  total: number
}

/** PO menunggu approval finance (status = menunggu_approval_finance). */
export function usePendingPos() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<PendingPo[]>({
    queryKey: ['po-pending-approval'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order')
        .select('id, nomor_po, supplier_nama, tanggal_po, purchase_order_item(subtotal)')
        .eq('status', 'menunggu_approval_finance')
        .order('tanggal_po', { ascending: true })
      if (error) throw error
      return (data as any[]).map((p) => ({
        id: p.id,
        nomor_po: p.nomor_po,
        supplier_nama: p.supplier_nama,
        tanggal_po: p.tanggal_po,
        total: (p.purchase_order_item ?? []).reduce((a: number, i: any) => a + Number(i.subtotal ?? 0), 0),
      }))
    },
  })
}

export function useApprovePo() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (poId: string) => {
      const { error } = await supabase.rpc('approve_po_finance', { p_po_id: poId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['po-pending-approval'] })
      toast.success('PO disetujui')
    },
    onError: (e: any) => toast.error(e.message ?? 'Gagal approve'),
  })
}

export function useRejectPo() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ poId, alasan }: { poId: string; alasan?: string }) => {
      const { error } = await supabase.rpc('reject_po_finance', { p_po_id: poId, p_alasan: alasan ?? null })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['po-pending-approval'] })
      toast.success('PO ditolak (kembali ke draft)')
    },
    onError: (e: any) => toast.error(e.message ?? 'Gagal menolak'),
  })
}
