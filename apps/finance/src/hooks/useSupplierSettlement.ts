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

/** Transaksi kas pembayaran PO (pengajuan / lunas / ditolak). */
export interface TxBayarPo {
  id: string
  source_id: string
  status: string
  amount: number
  note: string | null
  proof_url: string | null
  created_at: string
  approved_at: string | null
  pengaju: string | null
  penyetuju: string | null
}

/** PO yang sudah diterima + tagihannya (dari view definer po_payable_spv). */
export function usePayablePos(enabled = true) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<PayablePo[]>({
    queryKey: ['po_payable'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_payable_spv')
        .select('*')
        .order('tanggal_po', { ascending: false })
      if (error) throw error
      return ((data as PayablePo[]) ?? []).map((p) => ({ ...p, total: Number(p.total) || 0 }))
    },
  })
}

/** Jumlah pembayaran vendor menunggu approval (filter sama dengan daftar di hub). */
export function useBayarVendorPendingCount(enabled = true) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<number>({
    queryKey: ['po_payable', 'count', 'pending'],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('po_payable_spv')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'pending')
      if (error) throw error
      return count ?? 0
    },
  })
}

/** Transaksi pembayaran PO per PO (yang terbaru), untuk nama pengaju, catatan, dan bukti. */
export function useTxBayarPo(enabled = true) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<Record<string, TxBayarPo>>({
    queryKey: ['po_payable', 'tx'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_transaction')
        .select('id, source_id, status, amount, note, proof_url, created_at, approved_at, pengaju:outlet_staff!cash_transaction_created_by_fkey(name), penyetuju:outlet_staff!cash_transaction_approved_by_fkey(name)')
        .eq('source_type', 'supplier_po')
        .order('created_at', { ascending: true })
      if (error) throw error
      const hasil: Record<string, TxBayarPo> = {}
      for (const r of (data ?? []) as any[]) {
        hasil[r.source_id] = {
          ...r,
          amount: Number(r.amount) || 0,
          pengaju: r.pengaju?.name ?? null,
          penyetuju: r.penyetuju?.name ?? null,
        }
      }
      return hasil
    },
  })
}

function useSegarkan() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['po_payable'] })
    qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    qc.invalidateQueries({ queryKey: ['purchase-order'] })
    qc.invalidateQueries({ queryKey: ['cash_transaction'] })
    qc.invalidateQueries({ queryKey: ['cash_balance'] })
    qc.invalidateQueries({ queryKey: ['mutasi_rekening'] })
  }
}

/** Purchasing/finance mengajukan pembayaran PO (RPC ajukan_bayar_po). Saldo belum bergerak. */
export function useAjukanBayarPo() {
  const supabase = useMemo(() => createClient(), [])
  const segarkan = useSegarkan()
  return useMutation({
    mutationFn: async (v: { poId: string; catatan?: string }) => {
      const { data, error } = await supabase.rpc('ajukan_bayar_po', {
        p_po_id: v.poId,
        p_catatan: v.catatan?.trim() || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: segarkan,
  })
}

/** Admin finance menyetujui setelah transfer; bukti wajib (RPC setujui_bayar_po). Saldo terpotong. */
export function useSetujuiBayarPo() {
  const supabase = useMemo(() => createClient(), [])
  const segarkan = useSegarkan()
  return useMutation({
    mutationFn: async (v: { poId: string; proofFile: File; catatan?: string }) => {
      const path = `bayar-po/${Date.now()}-${v.proofFile.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
      if (upErr) throw upErr
      const { data, error } = await supabase.rpc('setujui_bayar_po', {
        p_po_id: v.poId,
        p_proof_url: path,
        p_catatan: v.catatan?.trim() || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: segarkan,
  })
}

/** Admin finance menolak pengajuan; PO kembali belum dibayar (RPC tolak_bayar_po). */
export function useTolakBayarPo() {
  const supabase = useMemo(() => createClient(), [])
  const segarkan = useSegarkan()
  return useMutation({
    mutationFn: async (v: { poId: string; alasan: string }) => {
      const { error } = await supabase.rpc('tolak_bayar_po', { p_po_id: v.poId, p_alasan: v.alasan })
      if (error) throw error
    },
    onSuccess: segarkan,
  })
}
