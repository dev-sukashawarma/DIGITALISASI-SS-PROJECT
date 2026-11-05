'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { IncomeKategori } from '@/lib/kas/incomeLainnya'

export interface IncomeLainnyaRow {
  id: string
  occurred_at: string
  kategori: IncomeKategori
  keterangan: string | null
  pembeli: string
  amount: number
  proof_url: string
  status: 'aktif' | 'batal'
  batal_at: string | null
  batal_alasan: string | null
  asal_outlet: { name: string } | null
  cash_location: { label: string } | null
}

const HALAMAN = 50

/** Daftar Income Lainnya per rentang tanggal WIB (inklusif), berhalaman. */
export function useIncomeLainnya(filter: { from: string; to: string; page: number }) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: ['income_lainnya', filter],
    queryFn: async () => {
      const start = filter.page * HALAMAN
      const { data, error, count } = await supabase
        .from('income_lainnya')
        .select(
          'id, occurred_at, kategori, keterangan, pembeli, amount, proof_url, status, batal_at, batal_alasan, asal_outlet:asal_outlet_id(name), cash_location:cash_location_id(label)',
          { count: 'exact' },
        )
        .gte('occurred_at', `${filter.from}T00:00:00+07:00`)
        .lte('occurred_at', `${filter.to}T23:59:59.999+07:00`)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .range(start, start + HALAMAN - 1)
      if (error) throw error
      return { rows: (data as unknown as IncomeLainnyaRow[]) ?? [], total: count ?? 0, halaman: HALAMAN }
    },
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['income_lainnya'] })
  qc.invalidateQueries({ queryKey: ['cash_transaction'] })
  qc.invalidateQueries({ queryKey: ['cash_balance'] })
}

export function useCatatIncome() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      tanggal: string
      kategori: IncomeKategori
      keterangan: string
      pembeli: string
      asalOutletId: string | null
      amount: number
      cashLocationId: string
      proofFile: File
    }) => {
      const path = `income-lainnya/${Date.now()}-${v.proofFile.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
      if (upErr) throw upErr
      const { data, error } = await supabase.rpc('record_income_lainnya', {
        p_occurred_at: `${v.tanggal}T12:00:00+07:00`,
        p_kategori: v.kategori,
        p_keterangan: v.keterangan.trim() || null,
        p_pembeli: v.pembeli.trim(),
        p_asal_outlet: v.asalOutletId,
        p_amount: v.amount,
        p_cash_location: v.cashLocationId,
        p_proof_url: path,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useBatalIncome() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('batal_income_lainnya', { p_id: v.id, p_alasan: v.alasan })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc),
  })
}
